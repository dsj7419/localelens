/**
 * Image Processing Service
 *
 * Single Responsibility: Image dimension handling and resizing.
 * Ensures aspect ratio preservation throughout the variant generation pipeline.
 *
 * Key functions:
 * - Get image dimensions
 * - Resize images to match target dimensions
 * - Preserve aspect ratio during processing
 *
 * This service solves the aspect ratio mismatch problem:
 * - Source images may be 1080×1920 (ratio 0.5625)
 * - API may output 1024×1536 (ratio 0.667)
 * - Different ratios cause visible distortion
 *
 * Solution: Post-resize API output to match original dimensions exactly.
 */

import sharp from "sharp";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/**
 * Image dimensions
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Result of dimension extraction
 */
export interface DimensionsResult {
  success: boolean;
  dimensions?: ImageDimensions;
  error?: string;
}

/**
 * Result of resize operation
 */
export interface ResizeResult {
  success: boolean;
  buffer?: Buffer;
  originalDimensions?: ImageDimensions;
  newDimensions?: ImageDimensions;
  error?: string;
}

/**
 * Interface for image processing capability (ISP)
 */
export interface IImageProcessingService {
  getDimensions(buffer: Buffer): Promise<DimensionsResult>;
  resizeToMatch(buffer: Buffer, target: ImageDimensions): Promise<ResizeResult>;
  resizePreservingAspect(
    buffer: Buffer,
    maxWidth: number,
    maxHeight: number
  ): Promise<ResizeResult>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Image Processing Service
 *
 * Handles image dimension operations using Sharp.
 * Ensures pixel-perfect dimension matching for variant generation.
 */
export class ImageProcessingService implements IImageProcessingService {
  /**
   * Get the dimensions of an image buffer
   */
  async getDimensions(buffer: Buffer): Promise<DimensionsResult> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          success: false,
          error: "Unable to extract image dimensions",
        };
      }

      return {
        success: true,
        dimensions: {
          width: metadata.width,
          height: metadata.height,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[ImageProcessingService] Failed to get dimensions:",
        errorMessage
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Resize an image to exactly match target dimensions
   *
   * Uses `fit: "fill"` to ensure exact dimension match.
   * This may cause slight distortion if aspect ratios differ significantly,
   * but ensures pixel-perfect alignment for compositing operations.
   *
   * For best results, use `size: "auto"` with the API and let it
   * choose dimensions close to the original.
   */
  async resizeToMatch(
    buffer: Buffer,
    target: ImageDimensions
  ): Promise<ResizeResult> {
    try {
      // Get original dimensions for logging
      const originalMeta = await sharp(buffer).metadata();
      const originalDimensions: ImageDimensions = {
        width: originalMeta.width ?? 0,
        height: originalMeta.height ?? 0,
      };

      // Skip resize if already matching
      if (
        originalDimensions.width === target.width &&
        originalDimensions.height === target.height
      ) {
        console.log(
          "[ImageProcessingService] Dimensions already match, skipping resize"
        );
        return {
          success: true,
          buffer,
          originalDimensions,
          newDimensions: target,
        };
      }

      console.log(
        `[ImageProcessingService] Resizing from ${originalDimensions.width}×${originalDimensions.height} to ${target.width}×${target.height}`
      );

      // Resize to exact dimensions
      const resizedBuffer = await sharp(buffer)
        .resize(target.width, target.height, {
          fit: "fill", // Exact dimensions, may stretch
          kernel: "lanczos3", // High-quality resampling
        })
        .png() // Ensure lossless output
        .toBuffer();

      return {
        success: true,
        buffer: resizedBuffer,
        originalDimensions,
        newDimensions: target,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[ImageProcessingService] Resize failed:",
        errorMessage
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Resize an image while preserving aspect ratio
   *
   * Fits the image within the given max dimensions while maintaining
   * the original aspect ratio. Useful for preparing images for API
   * calls that have size constraints.
   */
  async resizePreservingAspect(
    buffer: Buffer,
    maxWidth: number,
    maxHeight: number
  ): Promise<ResizeResult> {
    try {
      const originalMeta = await sharp(buffer).metadata();
      const originalDimensions: ImageDimensions = {
        width: originalMeta.width ?? 0,
        height: originalMeta.height ?? 0,
      };

      // Calculate target dimensions while preserving aspect ratio
      const aspectRatio = originalDimensions.width / originalDimensions.height;
      let newWidth = maxWidth;
      let newHeight = Math.round(maxWidth / aspectRatio);

      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = Math.round(maxHeight * aspectRatio);
      }

      // Skip if no resize needed
      if (
        originalDimensions.width <= maxWidth &&
        originalDimensions.height <= maxHeight
      ) {
        console.log(
          "[ImageProcessingService] Image within bounds, skipping resize"
        );
        return {
          success: true,
          buffer,
          originalDimensions,
          newDimensions: originalDimensions,
        };
      }

      console.log(
        `[ImageProcessingService] Resizing (preserving aspect) from ${originalDimensions.width}×${originalDimensions.height} to ${newWidth}×${newHeight}`
      );

      const resizedBuffer = await sharp(buffer)
        .resize(newWidth, newHeight, {
          fit: "inside", // Preserve aspect ratio
          kernel: "lanczos3",
        })
        .png()
        .toBuffer();

      return {
        success: true,
        buffer: resizedBuffer,
        originalDimensions,
        newDimensions: { width: newWidth, height: newHeight },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[ImageProcessingService] Resize (preserving aspect) failed:",
        errorMessage
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Ensure an image has an alpha channel (RGBA)
   *
   * Required for mask operations where transparency indicates edit regions.
   */
  async ensureAlpha(buffer: Buffer): Promise<ResizeResult> {
    try {
      const metadata = await sharp(buffer).metadata();
      const dimensions: ImageDimensions = {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
      };

      const resultBuffer = await sharp(buffer)
        .ensureAlpha()
        .png()
        .toBuffer();

      return {
        success: true,
        buffer: resultBuffer,
        originalDimensions: dimensions,
        newDimensions: dimensions,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[ImageProcessingService] EnsureAlpha failed:",
        errorMessage
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: ImageProcessingService | null = null;

/**
 * Get the Image Processing Service instance (singleton)
 */
export function getImageProcessingService(): ImageProcessingService {
  if (!serviceInstance) {
    serviceInstance = new ImageProcessingService();
  }
  return serviceInstance;
}

/**
 * Create a new Image Processing Service instance
 */
export function createImageProcessingService(): ImageProcessingService {
  return new ImageProcessingService();
}
