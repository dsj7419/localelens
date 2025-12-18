/**
 * Diff Service
 *
 * Single Responsibility: Compute pixel-level drift between base and variant images.
 * Measures changes outside the masked (editable) regions.
 */

import sharp from "sharp";
import {
  createDriftResult,
  type DriftResult,
} from "../domain/value-objects/drift";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

export interface DiffComputeInput {
  baseBuffer: Buffer;
  variantBuffer: Buffer;
  maskBuffer: Buffer;
}

export interface DiffComputeResult {
  drift: DriftResult;
  /** Raw difference buffer (grayscale) - for heatmap generation */
  diffBuffer: Buffer;
  /** Width of the processed images */
  width: number;
  /** Height of the processed images */
  height: number;
}

export interface IDiffService {
  computeDrift(input: DiffComputeInput): Promise<DiffComputeResult>;
}

// =============================================================================
// Constants
// =============================================================================

/** Threshold for considering a pixel "changed" (0-255 scale) */
const PIXEL_CHANGE_THRESHOLD = 10;

// =============================================================================
// Diff Service Implementation
// =============================================================================

/**
 * Diff Service
 *
 * Computes pixel-level drift between base and variant images,
 * considering only pixels OUTSIDE the masked regions.
 */
export class DiffService implements IDiffService {
  /**
   * Compute drift score and generate difference buffer
   *
   * Algorithm:
   * 1. Resize all images to match dimensions
   * 2. Convert to raw pixel data
   * 3. For each pixel outside mask (where mask is opaque/white):
   *    - Compute RGB distance between base and variant
   *    - If distance > threshold, count as changed
   * 4. Calculate drift percentage
   */
  async computeDrift(input: DiffComputeInput): Promise<DiffComputeResult> {
    const { baseBuffer, variantBuffer, maskBuffer } = input;

    // Get base image metadata for dimensions
    const baseMeta = await sharp(baseBuffer).metadata();
    const width = baseMeta.width ?? 1024;
    const height = baseMeta.height ?? 1536;

    // Process all images to same dimensions and extract raw RGBA data
    const [baseRaw, variantRaw, maskRaw] = await Promise.all([
      this.extractRawPixels(baseBuffer, width, height),
      this.extractRawPixels(variantBuffer, width, height),
      this.extractRawPixels(maskBuffer, width, height),
    ]);

    // Compute pixel differences
    const totalPixels = width * height;
    const diffData = new Uint8Array(totalPixels); // Grayscale diff for heatmap
    let outsideMaskPixels = 0;
    let changedPixels = 0;

    for (let i = 0; i < totalPixels; i++) {
      const pixelOffset = i * 4; // RGBA

      // Check if pixel is OUTSIDE mask (mask alpha > 127 means preserve/outside)
      // In OpenAI mask format: transparent = edit, opaque = preserve
      const maskAlpha = maskRaw[pixelOffset + 3]!;
      const isOutsideMask = maskAlpha > 127;

      if (isOutsideMask) {
        outsideMaskPixels++;

        // Compute RGB difference
        const rDiff = Math.abs(baseRaw[pixelOffset]! - variantRaw[pixelOffset]!);
        const gDiff = Math.abs(baseRaw[pixelOffset + 1]! - variantRaw[pixelOffset + 1]!);
        const bDiff = Math.abs(baseRaw[pixelOffset + 2]! - variantRaw[pixelOffset + 2]!);

        // Average difference for this pixel
        const avgDiff = (rDiff + gDiff + bDiff) / 3;
        diffData[i] = Math.min(255, Math.round(avgDiff * 2)); // Amplify for visibility

        // Count as changed if above threshold
        if (avgDiff > PIXEL_CHANGE_THRESHOLD) {
          changedPixels++;
        }
      } else {
        // Inside mask - zero diff (expected to change)
        diffData[i] = 0;
      }
    }

    // Create diff buffer as grayscale PNG
    const diffBuffer = await sharp(Buffer.from(diffData), {
      raw: {
        width,
        height,
        channels: 1,
      },
    })
      .png()
      .toBuffer();

    // Calculate drift result
    const drift = createDriftResult(changedPixels, outsideMaskPixels);

    console.log(
      `[DiffService] Computed drift: ${drift.score.toFixed(2)}% (${changedPixels}/${outsideMaskPixels} pixels changed outside mask)`
    );

    return {
      drift,
      diffBuffer,
      width,
      height,
    };
  }

  /**
   * Extract raw RGBA pixel data from an image buffer
   */
  private async extractRawPixels(
    buffer: Buffer,
    width: number,
    height: number
  ): Promise<Uint8Array> {
    const { data } = await sharp(buffer)
      .resize(width, height, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return new Uint8Array(data);
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: DiffService | null = null;

export function getDiffService(): DiffService {
  if (!serviceInstance) {
    serviceInstance = new DiffService();
  }
  return serviceInstance;
}

export function createDiffService(): DiffService {
  return new DiffService();
}
