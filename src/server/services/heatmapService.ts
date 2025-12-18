/**
 * Heatmap Service
 *
 * Single Responsibility: Generate visual heatmap overlays from diff data.
 * Creates colorized representations of pixel drift.
 */

import sharp from "sharp";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

export interface HeatmapGenerateInput {
  /** Grayscale diff buffer from DiffService */
  diffBuffer: Buffer;
  /** Original variant buffer to overlay on */
  variantBuffer: Buffer;
  /** Overlay opacity (0-1) */
  opacity?: number;
}

export interface HeatmapResult {
  /** Standalone heatmap PNG (colored diff) */
  heatmapBuffer: Buffer;
  /** Heatmap overlaid on variant image */
  overlayBuffer: Buffer;
}

export interface IHeatmapService {
  generateHeatmap(input: HeatmapGenerateInput): Promise<HeatmapResult>;
}

// =============================================================================
// Constants
// =============================================================================

/** Default overlay opacity */
const DEFAULT_OPACITY = 0.5;

// =============================================================================
// Heatmap Service Implementation
// =============================================================================

/**
 * Heatmap Service
 *
 * Generates colorized heatmap images from grayscale diff data.
 * Uses a blue-to-red color gradient to visualize change intensity.
 */
export class HeatmapService implements IHeatmapService {
  /**
   * Generate heatmap and overlay from diff data
   */
  async generateHeatmap(input: HeatmapGenerateInput): Promise<HeatmapResult> {
    const { diffBuffer, variantBuffer, opacity = DEFAULT_OPACITY } = input;

    // Get dimensions from variant
    const variantMeta = await sharp(variantBuffer).metadata();
    const width = variantMeta.width ?? 1024;
    const height = variantMeta.height ?? 1536;

    // Get grayscale diff data
    const diffRaw = await sharp(diffBuffer)
      .resize(width, height, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();

    // Create colorized heatmap (RGBA)
    const heatmapData = new Uint8Array(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      const intensity = diffRaw[i]!;
      const pixelOffset = i * 4;

      // Apply color gradient: blue (cold) -> yellow -> red (hot)
      const { r, g, b, a } = this.intensityToColor(intensity);

      heatmapData[pixelOffset] = r;
      heatmapData[pixelOffset + 1] = g;
      heatmapData[pixelOffset + 2] = b;
      heatmapData[pixelOffset + 3] = a;
    }

    // Create heatmap PNG
    const heatmapBuffer = await sharp(Buffer.from(heatmapData), {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();

    // Apply opacity to heatmap before compositing
    // Sharp doesn't support opacity in composite, so we adjust alpha channel
    const heatmapWithOpacity = await sharp(heatmapBuffer)
      .ensureAlpha(opacity)
      .png()
      .toBuffer();

    // Create overlay by compositing heatmap on variant
    const overlayBuffer = await sharp(variantBuffer)
      .resize(width, height, { fit: "fill" })
      .composite([
        {
          input: heatmapWithOpacity,
          blend: "over",
        },
      ])
      .png()
      .toBuffer();

    console.log(`[HeatmapService] Generated heatmap (${width}x${height})`);

    return {
      heatmapBuffer,
      overlayBuffer,
    };
  }

  /**
   * Convert intensity (0-255) to RGBA color using heat gradient
   *
   * 0 = transparent (no change)
   * 1-85 = blue/cyan (low change)
   * 86-170 = yellow/orange (medium change)
   * 171-255 = red (high change)
   */
  private intensityToColor(intensity: number): {
    r: number;
    g: number;
    b: number;
    a: number;
  } {
    // No change = transparent
    if (intensity < 5) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    // Normalize to 0-1
    const normalized = intensity / 255;

    let r: number, g: number, b: number;

    if (normalized < 0.33) {
      // Blue to cyan
      const t = normalized / 0.33;
      r = 0;
      g = Math.round(t * 255);
      b = 255;
    } else if (normalized < 0.66) {
      // Cyan to yellow
      const t = (normalized - 0.33) / 0.33;
      r = Math.round(t * 255);
      g = 255;
      b = Math.round((1 - t) * 255);
    } else {
      // Yellow to red
      const t = (normalized - 0.66) / 0.34;
      r = 255;
      g = Math.round((1 - t) * 255);
      b = 0;
    }

    // Alpha based on intensity (more visible for higher intensity)
    const a = Math.min(255, Math.round(128 + intensity * 0.5));

    return { r, g, b, a };
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: HeatmapService | null = null;

export function getHeatmapService(): HeatmapService {
  if (!serviceInstance) {
    serviceInstance = new HeatmapService();
  }
  return serviceInstance;
}

export function createHeatmapService(): HeatmapService {
  return new HeatmapService();
}
