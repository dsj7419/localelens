/**
 * Mask Suggestion Service
 *
 * Single Responsibility: Generate mask suggestions from detected text regions.
 *
 * This service uses Vision-detected bounding boxes to automatically generate
 * clean rectangular masks, eliminating the need for manual brush strokes.
 *
 * Why this exists:
 * - Hand-drawn masks create "smudge" artifacts in generated images
 * - Clean rectangles produce better quality output
 * - Auto-mask from detected regions ensures complete text coverage
 * - Reduces user friction and improves workflow speed
 *
 * The service generates PNG masks with alpha channels:
 * - Transparent (alpha=0) = regions to EDIT (text areas)
 * - Opaque (alpha=255) = regions to PRESERVE
 *
 * This matches OpenAI's mask format requirements.
 */

import sharp from "sharp";
import type { ImageAnalysis, TextRegion, BoundingBox } from "./textDetectionService";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/**
 * A single mask region in pixel coordinates
 */
export interface MaskRegion {
  /** Left edge in pixels */
  x: number;
  /** Top edge in pixels */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Padding applied (in pixels) */
  padding: number;
  /** The detected text in this region */
  label: string;
  /** Original bounding box (normalized 0-1) */
  normalizedBox: BoundingBox;
}

/**
 * Complete mask suggestion result
 */
export interface MaskSuggestion {
  /** All mask regions with coordinates */
  regions: MaskRegion[];
  /** Pre-generated mask image as PNG buffer */
  maskBuffer: Buffer;
  /** Percentage of image covered by mask regions */
  coverage: number;
  /** Image dimensions the mask was generated for */
  imageDimensions: {
    width: number;
    height: number;
  };
}

/**
 * Input for mask generation
 */
export interface MaskSuggestionInput {
  /** Image analysis from TextDetectionService */
  analysis: ImageAnalysis;
  /** Width of the base image in pixels */
  imageWidth: number;
  /** Height of the base image in pixels */
  imageHeight: number;
  /** Padding percentage (default: 10 = 10% of region size) */
  paddingPercent?: number;
  /** Minimum padding in pixels (default: 5) */
  minPadding?: number;
  /** Maximum padding in pixels (default: 50) */
  maxPadding?: number;
}

/**
 * Interface for mask suggestion capability (ISP)
 */
export interface IMaskSuggestionService {
  /**
   * Generate a mask suggestion from image analysis
   * @param input The analysis and image dimensions
   * @returns Mask suggestion with regions and pre-generated PNG
   */
  generateSuggestion(input: MaskSuggestionInput): Promise<MaskSuggestion>;
}

// =============================================================================
// Constants
// =============================================================================

/** Default padding as percentage of region size */
const DEFAULT_PADDING_PERCENT = 10;

/** Minimum padding in pixels */
const DEFAULT_MIN_PADDING = 5;

/** Maximum padding in pixels */
const DEFAULT_MAX_PADDING = 50;

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Mask Suggestion Service
 *
 * Generates clean rectangular masks from detected text regions.
 * Uses Sharp to create PNG with proper alpha channel.
 *
 * This is a KEY QUALITY IMPROVEMENT over hand-drawn masks.
 */
export class MaskSuggestionService implements IMaskSuggestionService {
  /**
   * Generate a mask suggestion from image analysis
   */
  async generateSuggestion(input: MaskSuggestionInput): Promise<MaskSuggestion> {
    const {
      analysis,
      imageWidth,
      imageHeight,
      paddingPercent = DEFAULT_PADDING_PERCENT,
      minPadding = DEFAULT_MIN_PADDING,
      maxPadding = DEFAULT_MAX_PADDING,
    } = input;

    console.log(
      `[MaskSuggestionService] Generating mask for ${analysis.textRegions.length} regions (${imageWidth}x${imageHeight})`
    );

    // Convert normalized bounding boxes to pixel coordinates with padding
    const regions = this.convertToPixelRegions(
      analysis.textRegions,
      imageWidth,
      imageHeight,
      paddingPercent,
      minPadding,
      maxPadding
    );

    // Debug: Log pixel regions before merge
    console.log(`[MaskSuggestionService] Pixel regions before merge:`);
    regions.forEach((r, i) => {
      console.log(
        `  [${i}] "${r.label.substring(0, 25)}..." at (${r.x}, ${r.y}) size ${r.width}x${r.height} pad=${r.padding}`
      );
    });

    // DISABLED: Merging was combining separate text elements (like sticky notes)
    // Each text region should remain separate for accurate masking
    // const mergedRegions = this.mergeOverlappingRegions(regions);
    const mergedRegions = regions; // Keep all regions separate

    // Debug: Log final regions
    console.log(`[MaskSuggestionService] Final regions (no merge):`);
    mergedRegions.forEach((r, i) => {
      console.log(
        `  [${i}] "${r.label.substring(0, 25)}..." at (${r.x}, ${r.y}) size ${r.width}x${r.height}`
      );
    });

    console.log(
      `[MaskSuggestionService] ${regions.length} regions (merging disabled)`
    );

    // Generate the mask PNG
    const maskBuffer = await this.generateMaskPng(
      mergedRegions,
      imageWidth,
      imageHeight
    );

    // Calculate coverage percentage
    const coverage = this.calculateCoverage(mergedRegions, imageWidth, imageHeight);

    console.log(
      `[MaskSuggestionService] Generated mask with ${coverage.toFixed(1)}% coverage`
    );

    return {
      regions: mergedRegions,
      maskBuffer,
      coverage,
      imageDimensions: {
        width: imageWidth,
        height: imageHeight,
      },
    };
  }

  /**
   * Convert normalized bounding boxes to pixel coordinates with padding
   */
  private convertToPixelRegions(
    textRegions: TextRegion[],
    imageWidth: number,
    imageHeight: number,
    paddingPercent: number,
    minPadding: number,
    maxPadding: number
  ): MaskRegion[] {
    return textRegions.map((region) => {
      const box = region.boundingBox;

      // Convert normalized (0-1) to pixel coordinates
      let x = Math.round(box.x * imageWidth);
      let y = Math.round(box.y * imageHeight);
      let width = Math.round(box.width * imageWidth);
      let height = Math.round(box.height * imageHeight);

      // Calculate padding based on region size
      const avgSize = (width + height) / 2;
      let padding = Math.round((avgSize * paddingPercent) / 100);
      padding = Math.max(minPadding, Math.min(maxPadding, padding));

      // Apply padding
      x = Math.max(0, x - padding);
      y = Math.max(0, y - padding);
      width = Math.min(imageWidth - x, width + padding * 2);
      height = Math.min(imageHeight - y, height + padding * 2);

      return {
        x,
        y,
        width,
        height,
        padding,
        label: region.text,
        normalizedBox: box,
      };
    });
  }

  /**
   * Merge TRULY overlapping regions only
   *
   * We're now much more conservative - only merge regions that actually
   * overlap or are immediately adjacent (within 2px). This prevents
   * combining separate text elements on different sticky notes.
   */
  private mergeOverlappingRegions(regions: MaskRegion[]): MaskRegion[] {
    if (regions.length <= 1) return regions;

    // Sort by y position (top to bottom), then x (left to right)
    const sorted = [...regions].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) < 5) { // Only treat as same row if within 5px
        return a.x - b.x;
      }
      return yDiff;
    });

    const merged: MaskRegion[] = [];
    let current = sorted[0]!;

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!;

      if (this.regionsActuallyOverlap(current, next)) {
        // Merge only truly overlapping regions
        current = this.mergeTwo(current, next);
        console.log(`[MaskSuggestionService] Merged overlapping: "${current.label}"`);
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);

    console.log(
      `[MaskSuggestionService] Merge result: ${regions.length} regions -> ${merged.length} (merged ${regions.length - merged.length})`
    );

    return merged;
  }

  /**
   * Check if two regions ACTUALLY overlap (very conservative)
   * Only returns true if boxes share pixels or are immediately adjacent (2px)
   */
  private regionsActuallyOverlap(a: MaskRegion, b: MaskRegion): boolean {
    // Very small tolerance - only merge if nearly touching
    const tolerance = 2;

    const aRight = a.x + a.width;
    const aBottom = a.y + a.height;
    const bRight = b.x + b.width;
    const bBottom = b.y + b.height;

    // Check for actual overlap or immediate adjacency
    const horizontalOverlap = !(a.x > bRight + tolerance || aRight + tolerance < b.x);
    const verticalOverlap = !(a.y > bBottom + tolerance || aBottom + tolerance < b.y);

    return horizontalOverlap && verticalOverlap;
  }

  /**
   * Merge two overlapping regions into one
   */
  private mergeTwo(a: MaskRegion, b: MaskRegion): MaskRegion {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);

    return {
      x,
      y,
      width: right - x,
      height: bottom - y,
      padding: Math.max(a.padding, b.padding),
      label: `${a.label} + ${b.label}`,
      normalizedBox: {
        // Average the normalized boxes
        x: (a.normalizedBox.x + b.normalizedBox.x) / 2,
        y: (a.normalizedBox.y + b.normalizedBox.y) / 2,
        width: (a.normalizedBox.width + b.normalizedBox.width) / 2,
        height: (a.normalizedBox.height + b.normalizedBox.height) / 2,
      },
    };
  }

  /**
   * Generate PNG mask buffer using Sharp
   *
   * The mask format for OpenAI:
   * - Transparent (alpha=0) = regions to EDIT
   * - Opaque (alpha=255) = regions to PRESERVE
   *
   * We start with a fully opaque (white) image and cut out
   * transparent rectangles for the edit regions.
   */
  private async generateMaskPng(
    regions: MaskRegion[],
    imageWidth: number,
    imageHeight: number
  ): Promise<Buffer> {
    // Create SVG with transparent rectangles on white background
    // This approach gives us clean rectangular masks with sharp edges

    const regionRects = regions
      .map(
        (r) =>
          `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="black" />`
      )
      .join("\n");

    const svg = `<svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white" />
  ${regionRects}
</svg>`;

    // Convert SVG to PNG, then use black areas as transparency mask
    const svgBuffer = Buffer.from(svg);

    // Create the mask: white = keep (opaque), black = edit (transparent)
    const mask = await sharp(svgBuffer)
      .ensureAlpha()
      .toBuffer();

    // Get raw pixel data
    const { data, info } = await sharp(mask)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create output buffer with proper alpha channel
    // Match MaskCanvasCore format:
    // - Black pixels (R=0,G=0,B=0) with alpha=255 = KEEP regions
    // - Black pixels (R=0,G=0,B=0) with alpha=0 = EDIT regions (transparent)
    const outputData = Buffer.alloc(info.width * info.height * 4);

    for (let i = 0; i < info.width * info.height; i++) {
      const srcOffset = i * 4;
      const r = data[srcOffset]!;
      const g = data[srcOffset + 1]!;
      const b = data[srcOffset + 2]!;

      // If pixel is black in SVG (edit region), make it transparent
      // If pixel is white in SVG (preserve region), make it opaque black
      const isEditRegion = r < 128 && g < 128 && b < 128;

      // Always use black color - matches canvas behavior
      outputData[srcOffset] = 0; // R = 0 (black)
      outputData[srcOffset + 1] = 0; // G = 0 (black)
      outputData[srcOffset + 2] = 0; // B = 0 (black)
      outputData[srcOffset + 3] = isEditRegion ? 0 : 255; // A: 0 = edit (transparent), 255 = keep (opaque)
    }

    // Create final PNG with proper alpha channel
    const finalMask = await sharp(outputData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();

    return finalMask;
  }

  /**
   * Calculate what percentage of the image is covered by mask regions
   */
  private calculateCoverage(
    regions: MaskRegion[],
    imageWidth: number,
    imageHeight: number
  ): number {
    const totalPixels = imageWidth * imageHeight;
    if (totalPixels === 0) return 0;

    // Sum up area covered (simple sum, may overcount overlaps but acceptable)
    const coveredPixels = regions.reduce((sum, r) => sum + r.width * r.height, 0);

    return (coveredPixels / totalPixels) * 100;
  }
}

// =============================================================================
// Factory (Dependency Inversion: depend on abstraction via factory)
// =============================================================================

let serviceInstance: MaskSuggestionService | null = null;

/**
 * Get the Mask Suggestion Service instance (singleton)
 */
export function getMaskSuggestionService(): MaskSuggestionService {
  if (!serviceInstance) {
    serviceInstance = new MaskSuggestionService();
  }
  return serviceInstance;
}

/**
 * Create a new Mask Suggestion Service instance (for testing)
 */
export function createMaskSuggestionService(): MaskSuggestionService {
  return new MaskSuggestionService();
}
