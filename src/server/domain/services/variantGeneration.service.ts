/**
 * Variant Generation Service
 *
 * Single Responsibility: Orchestrate the full variant generation pipeline.
 * Coordinates OpenAI calls, file storage, drift computation, and DB updates.
 *
 * Enhanced for gpt-image-1.5 mastery:
 * - Automatic dimension preservation (fixes aspect ratio distortion)
 * - Pixel-perfect composite mode support (0% drift guarantee)
 * - Multi-generation selection support
 */

import type { LocaleId } from "../value-objects/locale";
import type { DriftStatus } from "../value-objects/drift";
import type { Variant } from "../entities/project";
import type { IVariantRepository } from "../repositories/project.repository";
import type { FileStore } from "../../services/fileStore";
import type { OpenAIImageService } from "../../services/openaiImage";
import { getDiffService } from "../../services/diffService";
import { getHeatmapService } from "../../services/heatmapService";
import { getImageProcessingService } from "../../services/imageProcessingService";

// =============================================================================
// Types
// =============================================================================

export interface GenerateVariantInput {
  projectId: string;
  locale: LocaleId;
  prompt: string;
  baseImageBuffer: Buffer;
  maskBuffer: Buffer;
  /** Enable pixel-perfect mode (composite original + generated using mask) */
  pixelPerfect?: boolean;
}

export interface GenerateVariantResult {
  success: boolean;
  variant?: Variant;
  imageBuffer?: Buffer;
  modelUsed?: string;
  driftScore?: number | null;
  driftStatus?: DriftStatus;
  error?: string;
  /** Whether pixel-perfect composite was applied */
  pixelPerfectApplied?: boolean;
  /** Whether dimensions were adjusted */
  dimensionsAdjusted?: boolean;
}

export interface ProcessVariantInput {
  projectId: string;
  locale: LocaleId;
  prompt: string;
  variantBuffer: Buffer;
  baseImageBuffer: Buffer;
  maskBuffer: Buffer;
  modelUsed: string | null;
  /** Enable pixel-perfect mode */
  pixelPerfect?: boolean;
}

export interface IVariantGenerationService {
  generateVariant(
    input: GenerateVariantInput,
    imageService: OpenAIImageService,
    fileStore: FileStore,
    variantRepo: IVariantRepository
  ): Promise<GenerateVariantResult>;

  processVariant(
    input: ProcessVariantInput,
    fileStore: FileStore,
    variantRepo: IVariantRepository
  ): Promise<GenerateVariantResult>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Variant Generation Service
 *
 * Handles the complete variant generation pipeline:
 * 1. Store original image dimensions
 * 2. Call OpenAI gpt-image-1.5 to generate image
 * 3. Resize output to match original dimensions (fix aspect ratio)
 * 4. Optionally apply pixel-perfect composite (0% drift guarantee)
 * 5. Save variant to file store
 * 6. Compute drift score
 * 7. Generate and save heatmap/overlay
 * 8. Update database with results
 */
export class VariantGenerationService implements IVariantGenerationService {
  /**
   * Generate a variant using OpenAI and process it
   *
   * Automatically handles dimension preservation to fix aspect ratio issues.
   * Optionally applies pixel-perfect composite for 0% drift guarantee.
   */
  async generateVariant(
    input: GenerateVariantInput,
    imageService: OpenAIImageService,
    fileStore: FileStore,
    variantRepo: IVariantRepository
  ): Promise<GenerateVariantResult> {
    const { projectId, locale, prompt, baseImageBuffer, maskBuffer, pixelPerfect = false } = input;
    const imageProcessingService = getImageProcessingService();

    // Step 1: Get original image dimensions (for post-resize)
    const dimensionsResult = await imageProcessingService.getDimensions(baseImageBuffer);
    if (!dimensionsResult.success || !dimensionsResult.dimensions) {
      return {
        success: false,
        error: `Failed to get image dimensions: ${dimensionsResult.error}`,
      };
    }
    const originalDimensions = dimensionsResult.dimensions;
    console.log(
      `[VariantGenerationService] Original dimensions: ${originalDimensions.width}×${originalDimensions.height}`
    );

    // Step 2: Call OpenAI gpt-image-1.5 with optimized parameters
    // Using size: "auto" to let API optimize, then we'll resize to original
    const result = await imageService.editImage({
      prompt,
      imageBuffer: baseImageBuffer,
      maskBuffer,
      // Using defaults: size="auto", quality="high", background="opaque", outputFormat="png"
    });

    if (!result.success || !result.imageBuffer) {
      return {
        success: false,
        error: result.error ?? "Failed to generate variant",
      };
    }

    // Step 3: Resize output to match original dimensions
    let processedBuffer = result.imageBuffer;
    let dimensionsAdjusted = false;

    const outputDimensionsResult = await imageProcessingService.getDimensions(result.imageBuffer);
    if (outputDimensionsResult.success && outputDimensionsResult.dimensions) {
      const outputDims = outputDimensionsResult.dimensions;
      console.log(
        `[VariantGenerationService] API output dimensions: ${outputDims.width}×${outputDims.height}`
      );

      // Check if resize is needed
      if (
        outputDims.width !== originalDimensions.width ||
        outputDims.height !== originalDimensions.height
      ) {
        console.log(
          `[VariantGenerationService] Resizing to match original: ${originalDimensions.width}×${originalDimensions.height}`
        );
        const resizeResult = await imageProcessingService.resizeToMatch(
          result.imageBuffer,
          originalDimensions
        );
        if (resizeResult.success && resizeResult.buffer) {
          processedBuffer = resizeResult.buffer;
          dimensionsAdjusted = true;
          console.log(`[VariantGenerationService] Resize successful`);
        } else {
          console.warn(
            `[VariantGenerationService] Resize failed: ${resizeResult.error}, using original output`
          );
        }
      }
    }

    // Step 4: Process the variant (save, compute drift, etc.)
    const processResult = await this.processVariant(
      {
        projectId,
        locale,
        prompt,
        variantBuffer: processedBuffer,
        baseImageBuffer,
        maskBuffer,
        modelUsed: result.modelUsed ?? null,
        pixelPerfect,
      },
      fileStore,
      variantRepo
    );

    // Add dimension adjustment info to result
    if (processResult.success) {
      processResult.dimensionsAdjusted = dimensionsAdjusted;
    }

    return processResult;
  }

  /**
   * Process a variant buffer (save, compute drift, update DB)
   * Used for both fresh generation and demo mode loading
   *
   * If pixelPerfect mode is enabled, applies composite to guarantee 0% drift.
   */
  async processVariant(
    input: ProcessVariantInput,
    fileStore: FileStore,
    variantRepo: IVariantRepository
  ): Promise<GenerateVariantResult> {
    const {
      projectId,
      locale,
      prompt,
      variantBuffer,
      baseImageBuffer,
      maskBuffer,
      modelUsed,
      pixelPerfect = false,
    } = input;

    try {
      // Step 1: Apply pixel-perfect composite if enabled
      let finalBuffer = variantBuffer;
      let pixelPerfectApplied = false;

      if (pixelPerfect) {
        console.log(`[VariantGenerationService] Applying pixel-perfect composite for ${locale}`);
        const compositeResult = await this.applyPixelPerfectComposite(
          baseImageBuffer,
          variantBuffer,
          maskBuffer
        );
        if (compositeResult.success && compositeResult.buffer) {
          finalBuffer = compositeResult.buffer;
          pixelPerfectApplied = true;
          console.log(`[VariantGenerationService] Pixel-perfect composite applied successfully`);
        } else {
          console.warn(
            `[VariantGenerationService] Pixel-perfect composite failed: ${compositeResult.error}`
          );
        }
      }

      // Step 2: Save the variant image
      const outputPath = await fileStore.saveVariantImage(locale, finalBuffer);

      // Step 3: Delete existing variant if any
      const existing = await variantRepo.findByProjectAndLocale(projectId, locale);
      if (existing) {
        await variantRepo.delete(existing.id);
      }

      // Step 4: Create variant record
      let variant = await variantRepo.create({
        projectId,
        locale,
        prompt,
        outputImagePath: outputPath,
        modelUsed,
      });

      // Step 5: Compute drift and generate heatmap
      const driftResult = await this.computeDriftAndHeatmap(
        baseImageBuffer,
        finalBuffer,
        maskBuffer,
        locale,
        fileStore
      );

      // Step 6: Update variant with drift score if successful
      if (driftResult.success && driftResult.score !== undefined) {
        variant = await variantRepo.updateDriftScore(
          variant.id,
          driftResult.score,
          driftResult.status!
        );
      }

      return {
        success: true,
        variant,
        imageBuffer: finalBuffer,
        modelUsed: modelUsed ?? undefined,
        driftScore: variant.driftScore,
        driftStatus: variant.driftStatus,
        pixelPerfectApplied,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[VariantGenerationService] Failed to process ${locale}:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Apply pixel-perfect composite
   *
   * Combines original image and generated variant using the mask:
   * - Where mask is OPAQUE (preserve regions): use ORIGINAL pixels
   * - Where mask is TRANSPARENT (edit regions): use GENERATED pixels
   *
   * Result: Guaranteed 0% drift outside mask.
   */
  private async applyPixelPerfectComposite(
    originalBuffer: Buffer,
    generatedBuffer: Buffer,
    maskBuffer: Buffer
  ): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
    try {
      // Import sharp dynamically to keep this file focused
      const sharp = (await import("sharp")).default;
      const imageProcessingService = getImageProcessingService();

      // Get dimensions from original
      const dimsResult = await imageProcessingService.getDimensions(originalBuffer);
      if (!dimsResult.success || !dimsResult.dimensions) {
        return { success: false, error: "Failed to get original dimensions" };
      }
      const { width, height } = dimsResult.dimensions;

      // Ensure all images are same dimensions
      const [originalResized, generatedResized, maskResized] = await Promise.all([
        sharp(originalBuffer).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer(),
        sharp(generatedBuffer).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer(),
        sharp(maskBuffer).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer(),
      ]);

      // Create output buffer (RGBA)
      const outputData = new Uint8Array(width * height * 4);

      // Composite pixel by pixel
      for (let i = 0; i < width * height; i++) {
        const offset = i * 4;

        // Get mask alpha (alpha > 127 = preserve/opaque, alpha <= 127 = edit/transparent)
        const maskAlpha = maskResized[offset + 3]!;
        const useOriginal = maskAlpha > 127;

        if (useOriginal) {
          // Use original pixel (preserve region)
          outputData[offset] = originalResized[offset]!;
          outputData[offset + 1] = originalResized[offset + 1]!;
          outputData[offset + 2] = originalResized[offset + 2]!;
          outputData[offset + 3] = originalResized[offset + 3]!;
        } else {
          // Use generated pixel (edit region)
          outputData[offset] = generatedResized[offset]!;
          outputData[offset + 1] = generatedResized[offset + 1]!;
          outputData[offset + 2] = generatedResized[offset + 2]!;
          outputData[offset + 3] = generatedResized[offset + 3]!;
        }
      }

      // Convert back to PNG
      const resultBuffer = await sharp(Buffer.from(outputData), {
        raw: {
          width,
          height,
          channels: 4,
        },
      })
        .png()
        .toBuffer();

      return { success: true, buffer: resultBuffer };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[VariantGenerationService] Pixel-perfect composite failed:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Compute drift and generate heatmap/overlay
   */
  private async computeDriftAndHeatmap(
    baseBuffer: Buffer,
    variantBuffer: Buffer,
    maskBuffer: Buffer,
    locale: LocaleId,
    fileStore: FileStore
  ): Promise<{ success: boolean; score?: number; status?: DriftStatus }> {
    try {
      const diffService = getDiffService();
      const heatmapService = getHeatmapService();

      // Compute drift
      const diffResult = await diffService.computeDrift({
        baseBuffer,
        variantBuffer,
        maskBuffer,
      });

      // Generate heatmap
      const heatmapResult = await heatmapService.generateHeatmap({
        diffBuffer: diffResult.diffBuffer,
        variantBuffer,
      });

      // Save heatmap and overlay
      await fileStore.saveHeatmapImage(locale, heatmapResult.heatmapBuffer);
      await fileStore.saveOverlayImage(locale, heatmapResult.overlayBuffer);

      console.log(
        `[VariantGenerationService] Drift for ${locale}: ${diffResult.drift.score.toFixed(2)}% (${diffResult.drift.status})`
      );

      return {
        success: true,
        score: diffResult.drift.score,
        status: diffResult.drift.status,
      };
    } catch (error) {
      console.error(`[VariantGenerationService] Drift computation failed for ${locale}:`, error);
      return { success: false };
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: VariantGenerationService | null = null;

export function getVariantGenerationService(): VariantGenerationService {
  if (!serviceInstance) {
    serviceInstance = new VariantGenerationService();
  }
  return serviceInstance;
}
