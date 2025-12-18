/**
 * Variant Generation Service
 *
 * Single Responsibility: Orchestrate the full variant generation pipeline.
 * Coordinates OpenAI calls, file storage, drift computation, and DB updates.
 */

import type { LocaleId } from "../value-objects/locale";
import type { DriftStatus } from "../value-objects/drift";
import type { Variant } from "../entities/project";
import type { IVariantRepository, CreateVariantInput } from "../repositories/project.repository";
import type { FileStore } from "../../services/fileStore";
import type { OpenAIImageService } from "../../services/openaiImage";
import { getDiffService } from "../../services/diffService";
import { getHeatmapService } from "../../services/heatmapService";

// =============================================================================
// Types
// =============================================================================

export interface GenerateVariantInput {
  projectId: string;
  locale: LocaleId;
  prompt: string;
  baseImageBuffer: Buffer;
  maskBuffer: Buffer;
}

export interface GenerateVariantResult {
  success: boolean;
  variant?: Variant;
  imageBuffer?: Buffer;
  modelUsed?: string;
  driftScore?: number | null;
  driftStatus?: DriftStatus;
  error?: string;
}

export interface ProcessVariantInput {
  projectId: string;
  locale: LocaleId;
  prompt: string;
  variantBuffer: Buffer;
  baseImageBuffer: Buffer;
  maskBuffer: Buffer;
  modelUsed: string | null;
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
 * 1. Call OpenAI to generate image
 * 2. Save variant to file store
 * 3. Compute drift score
 * 4. Generate and save heatmap/overlay
 * 5. Update database with results
 */
export class VariantGenerationService implements IVariantGenerationService {
  /**
   * Generate a variant using OpenAI and process it
   */
  async generateVariant(
    input: GenerateVariantInput,
    imageService: OpenAIImageService,
    fileStore: FileStore,
    variantRepo: IVariantRepository
  ): Promise<GenerateVariantResult> {
    const { projectId, locale, prompt, baseImageBuffer, maskBuffer } = input;

    // Call OpenAI
    const result = await imageService.editImage({
      prompt,
      imageBuffer: baseImageBuffer,
      maskBuffer,
    });

    if (!result.success || !result.imageBuffer) {
      return {
        success: false,
        error: result.error ?? "Failed to generate variant",
      };
    }

    // Process the generated variant
    return this.processVariant(
      {
        projectId,
        locale,
        prompt,
        variantBuffer: result.imageBuffer,
        baseImageBuffer,
        maskBuffer,
        modelUsed: result.modelUsed ?? null,
      },
      fileStore,
      variantRepo
    );
  }

  /**
   * Process a variant buffer (save, compute drift, update DB)
   * Used for both fresh generation and demo mode loading
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
    } = input;

    try {
      // Save the variant image
      const outputPath = await fileStore.saveVariantImage(locale, variantBuffer);

      // Delete existing variant if any
      const existing = await variantRepo.findByProjectAndLocale(projectId, locale);
      if (existing) {
        await variantRepo.delete(existing.id);
      }

      // Create variant record
      let variant = await variantRepo.create({
        projectId,
        locale,
        prompt,
        outputImagePath: outputPath,
        modelUsed,
      });

      // Compute drift and generate heatmap
      const driftResult = await this.computeDriftAndHeatmap(
        baseImageBuffer,
        variantBuffer,
        maskBuffer,
        locale,
        fileStore
      );

      // Update variant with drift score if successful
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
        imageBuffer: variantBuffer,
        modelUsed: modelUsed ?? undefined,
        driftScore: variant.driftScore,
        driftStatus: variant.driftStatus,
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
