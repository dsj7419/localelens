/**
 * Montage Service
 *
 * Single Responsibility: Generate 2x2 grid montage images.
 * Creates README-ready comparison grids with labels.
 */

import sharp from "sharp";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

export interface MontageImage {
  buffer: Buffer;
  label: string;
}

export interface MontageGenerateInput {
  /** Images to include in montage (expects 4 for 2x2) */
  images: MontageImage[];
  /** Padding between images in pixels */
  padding?: number;
  /** Label font size (approximate) */
  labelHeight?: number;
  /** Background color */
  backgroundColor?: string;
}

export interface IMontageService {
  generateMontage(input: MontageGenerateInput): Promise<Buffer>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_PADDING = 16;
const DEFAULT_LABEL_HEIGHT = 32;
const DEFAULT_BACKGROUND = "#1a1a1a"; // Dark theme

// =============================================================================
// Montage Service Implementation
// =============================================================================

/**
 * Montage Service
 *
 * Creates 2x2 grid montage from four images with labels.
 * Optimized for README gallery display.
 */
export class MontageService implements IMontageService {
  /**
   * Generate a 2x2 montage image with labels
   */
  async generateMontage(input: MontageGenerateInput): Promise<Buffer> {
    const {
      images,
      padding = DEFAULT_PADDING,
      labelHeight = DEFAULT_LABEL_HEIGHT,
      backgroundColor = DEFAULT_BACKGROUND,
    } = input;

    if (images.length < 4) {
      throw new Error("Montage requires exactly 4 images for 2x2 grid");
    }

    // Use first 4 images
    const gridImages = images.slice(0, 4);

    // Get dimensions from first image
    const firstMeta = await sharp(gridImages[0]!.buffer).metadata();
    const cellWidth = firstMeta.width ?? 540;
    const cellHeight = firstMeta.height ?? 960;

    // Calculate montage dimensions
    const totalWidth = cellWidth * 2 + padding * 3;
    const totalHeight = (cellHeight + labelHeight) * 2 + padding * 3;

    // Create base canvas
    const canvas = sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: backgroundColor,
      },
    });

    // Prepare composite operations
    const composites: sharp.OverlayOptions[] = [];

    // Process each image
    for (let i = 0; i < 4; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;

      const x = padding + col * (cellWidth + padding);
      const y = padding + row * (cellHeight + labelHeight + padding);

      const image = gridImages[i]!;

      // Resize image to cell dimensions
      const resizedImage = await sharp(image.buffer)
        .resize(cellWidth, cellHeight, { fit: "contain", background: backgroundColor })
        .png()
        .toBuffer();

      // Add image to composites
      composites.push({
        input: resizedImage,
        left: x,
        top: y + labelHeight,
      });

      // Create label
      const labelSvg = this.createLabelSvg(image.label, cellWidth, labelHeight);
      composites.push({
        input: Buffer.from(labelSvg),
        left: x,
        top: y,
      });
    }

    // Generate final montage
    const montageBuffer = await canvas.composite(composites).png().toBuffer();

    console.log(
      `[MontageService] Generated montage (${totalWidth}x${totalHeight})`
    );

    return montageBuffer;
  }

  /**
   * Create SVG label element
   */
  private createLabelSvg(text: string, width: number, height: number): string {
    const escapedText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#2a2a2a"/>
        <text
          x="50%"
          y="50%"
          dominant-baseline="middle"
          text-anchor="middle"
          fill="#ffffff"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="16"
          font-weight="500"
        >${escapedText}</text>
      </svg>
    `.trim();
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: MontageService | null = null;

export function getMontageService(): MontageService {
  if (!serviceInstance) {
    serviceInstance = new MontageService();
  }
  return serviceInstance;
}

export function createMontageService(): MontageService {
  return new MontageService();
}
