/**
 * Text Detection Service
 *
 * Single Responsibility: Use GPT-4o Vision to detect and extract text from images.
 *
 * This is the INSPECTOR in our two-model pipeline:
 * GPT-4o Vision (Inspector) -> GPT-4o (Translator) -> gpt-image-1.5 (Artist)
 *
 * Why this exists:
 * - gpt-image-1.5 cannot "read" text - it's a generation model, not vision
 * - GPT-4o Vision can extract text, positions, and style information
 * - This enables dynamic prompt generation for ANY image
 *
 * Without this, prompts are hardcoded for ONE demo image, causing:
 * - "Phantom UI elements" when users upload custom images
 * - Wrong translations being sent to images that don't have demo text
 */

import OpenAI from "openai";
import { env } from "~/env";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/**
 * Bounding box for a detected text region
 * Coordinates are normalized (0-1) relative to image dimensions
 */
export interface BoundingBox {
  x: number; // Left edge (0-1)
  y: number; // Top edge (0-1)
  width: number; // Width (0-1)
  height: number; // Height (0-1)
}

/**
 * Style information for detected text
 */
export interface TextStyle {
  fontWeight?: "normal" | "bold" | "light";
  fontSize?: "small" | "medium" | "large" | "xlarge";
  alignment?: "left" | "center" | "right";
  color?: string; // Descriptive color (e.g., "white", "dark blue")
  case?: "normal" | "uppercase" | "lowercase";
}

/**
 * A detected text region in the image
 */
export interface TextRegion {
  /** The detected text content */
  text: string;
  /** Bounding box in normalized coordinates (0-1) */
  boundingBox: BoundingBox;
  /** Confidence level of detection (0-1) */
  confidence: number;
  /** Style information if detected */
  style?: TextStyle;
  /** Semantic role of this text (headline, bullet, cta, footer, etc.) */
  role?: "headline" | "subheadline" | "bullet" | "cta" | "footer" | "label" | "other";
  /** Index/order of this text region (for multi-line text) */
  order?: number;
}

/**
 * Layout type classification for the image
 */
export type ImageLayout =
  | "app-screenshot" // Mobile app screenshot with UI elements
  | "sticky-notes" // Motivational poster with sticky notes
  | "banner" // Marketing banner or hero image
  | "poster" // Print poster or flyer
  | "social-media" // Social media graphic
  | "product" // Product packaging or label
  | "presentation" // Slide or presentation graphic
  | "unknown"; // Could not classify

/**
 * Complete analysis result for an image
 */
export interface ImageAnalysis {
  /** All detected text regions */
  textRegions: TextRegion[];
  /** Classification of the image layout type */
  layout: ImageLayout;
  /** Description of the background/surface texture for preservation prompts */
  surfaceTexture: string;
  /** Dominant colors in the image */
  dominantColors: string[];
  /** Whether the image has UI elements (buttons, icons, etc.) */
  hasUIElements: boolean;
  /** Specific UI elements detected */
  uiElements?: string[];
  /** Overall description of the image for context */
  imageDescription: string;
  /** Timestamp of analysis */
  analyzedAt: Date;
}

/**
 * Interface for text detection capability (ISP)
 */
export interface ITextDetectionService {
  /**
   * Analyze an image and extract text regions, layout, and style info
   * @param imageBuffer The image to analyze (PNG, JPEG, WebP)
   * @returns Complete image analysis with text regions
   */
  analyzeImage(imageBuffer: Buffer): Promise<ImageAnalysis>;
}

// =============================================================================
// Grid Constants (must be before class that uses them)
// =============================================================================

const GRID_COLS = 8; // A-H
const GRID_ROWS = 12; // 1-12
const CELL_WIDTH = 1 / GRID_COLS; // 0.125 (12.5%)
const CELL_HEIGHT = 1 / GRID_ROWS; // 0.0833 (8.33%)

// =============================================================================
// GPT-4o Vision Prompt
// =============================================================================

/**
 * Semantic position detection prompt
 *
 * GPT-4o is bad at precise coordinates but GOOD at describing
 * spatial relationships in human terms. We ask for:
 * - Horizontal position: "left", "center-left", "center", "center-right", "right"
 * - Vertical position: "top", "upper", "middle", "lower", "bottom"
 * - Size: "small", "medium", "large"
 *
 * We then convert these semantic descriptions to coordinates.
 */
const VISION_ANALYSIS_PROMPT = `Analyze this image and locate ALL text elements.

For EACH text element, describe its position using these terms:

HORIZONTAL POSITION (where the text CENTER is located):
- "far-left" = leftmost 20% of image
- "left" = 20-40% from left
- "center" = 40-60% (middle)
- "right" = 60-80% from left
- "far-right" = rightmost 20%

VERTICAL POSITION (where the text CENTER is located):
- "top" = top 20%
- "upper" = 20-40% from top
- "middle" = 40-60%
- "lower" = 60-80% from top
- "bottom" = bottom 20%

TEXT SIZE relative to image:
- "small" = less than 15% of image width
- "medium" = 15-30% of image width
- "large" = more than 30% of image width

Return JSON:
{
  "textRegions": [
    {
      "text": "YOU ARE",
      "horizontalPosition": "left",
      "verticalPosition": "upper",
      "textSize": "medium",
      "confidence": 0.95,
      "role": "headline"
    },
    {
      "text": "STRONGER",
      "horizontalPosition": "left",
      "verticalPosition": "middle",
      "textSize": "large",
      "confidence": 0.95,
      "role": "headline"
    }
  ],
  "layout": "sticky-notes",
  "surfaceTexture": "colored sticky notes on gray background",
  "dominantColors": ["yellow", "green", "orange", "pink"],
  "hasUIElements": false,
  "imageDescription": "Motivational text on stacked sticky notes with dumbbells in background"
}

CRITICAL RULES:
1. Create a SEPARATE entry for EACH distinct text element
2. Look at where the TEXT actually is, not where the sticky note is
3. If text is on the LEFT side of the image, use "far-left" or "left"
4. Be accurate about horizontal position - this is the most important field

ROLE VALUES: headline, subheadline, bullet, cta, footer, label, other
LAYOUT VALUES: app-screenshot, sticky-notes, banner, poster, social-media, product, presentation, unknown

Return ONLY valid JSON.`;

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Text Detection Service
 *
 * Uses GPT-4o Vision to analyze images and extract:
 * - All visible text with positions (normalized bounding boxes)
 * - Layout classification (app screenshot, poster, banner, etc.)
 * - Surface texture description for preservation prompts
 * - UI element detection (icons, buttons, etc.)
 *
 * This is a CRITICAL component for universal image support.
 * Without this, prompts would be hardcoded for one demo image.
 */
export class TextDetectionService implements ITextDetectionService {
  private readonly client: OpenAI;
  private readonly model = "gpt-4o"; // GPT-4o for vision capabilities

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze an image and extract text regions, layout, and style info
   *
   * Uses GPT-4o Vision with structured JSON output for reliable parsing.
   */
  async analyzeImage(imageBuffer: Buffer): Promise<ImageAnalysis> {
    console.log(`[TextDetectionService] Starting image analysis with GPT-4o Vision`);

    try {
      // Convert buffer to base64 data URI
      const base64Image = imageBuffer.toString("base64");
      const mimeType = this.detectMimeType(imageBuffer);
      const dataUri = `data:${mimeType};base64,${base64Image}`;

      // Call GPT-4o Vision
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: dataUri,
                  detail: "high", // Use high detail for better text detection
                },
              },
              {
                type: "text",
                text: VISION_ANALYSIS_PROMPT,
              },
            ],
          },
        ],
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });

      // Extract and parse the response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in GPT-4o Vision response");
      }

      console.log(`[TextDetectionService] Received response, parsing JSON...`);

      // Parse the JSON response
      const parsed = JSON.parse(content) as RawAnalysisResponse;

      // Debug: Log raw bounding boxes from GPT-4o
      console.log(`[TextDetectionService] Raw GPT-4o response - ${parsed.textRegions?.length ?? 0} regions:`);
      parsed.textRegions?.forEach((region, i) => {
        const box = region.boundingBox;
        console.log(
          `  [${i}] "${region.text?.substring(0, 30)}..." box: x=${box?.x?.toFixed(3)}, y=${box?.y?.toFixed(3)}, w=${box?.width?.toFixed(3)}, h=${box?.height?.toFixed(3)}`
        );
      });

      // Validate and transform the response
      const analysis = this.transformResponse(parsed);

      // Debug: Log validated bounding boxes
      console.log(`[TextDetectionService] After validation - ${analysis.textRegions.length} regions:`);
      analysis.textRegions.forEach((region, i) => {
        const box = region.boundingBox;
        console.log(
          `  [${i}] "${region.text.substring(0, 30)}..." box: x=${box.x.toFixed(3)}, y=${box.y.toFixed(3)}, w=${box.width.toFixed(3)}, h=${box.height.toFixed(3)}`
        );
      });

      console.log(
        `[TextDetectionService] Analysis complete: ${analysis.textRegions.length} text regions detected, layout: ${analysis.layout}`
      );

      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TextDetectionService] Analysis failed:`, errorMessage);

      // Return empty analysis on error (graceful degradation)
      return this.createEmptyAnalysis(errorMessage);
    }
  }

  /**
   * Detect MIME type from buffer magic bytes
   */
  private detectMimeType(buffer: Buffer): string {
    // Check PNG magic bytes
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    // Check JPEG magic bytes
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    // Check WebP magic bytes
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return "image/webp";
    }
    // Default to PNG
    return "image/png";
  }

  /**
   * Convert semantic position descriptions to bounding box
   */
  private semanticToBoundingBox(
    horizontalPos: string | undefined,
    verticalPos: string | undefined,
    textSize: string | undefined
  ): BoundingBox {
    // Get horizontal position (default to left if not specified)
    const hPos = HORIZONTAL_POSITIONS[horizontalPos?.toLowerCase() ?? ""] ?? HORIZONTAL_POSITIONS["left"]!;

    // Get vertical position (default to middle if not specified)
    const vPos = VERTICAL_POSITIONS[verticalPos?.toLowerCase() ?? ""] ?? VERTICAL_POSITIONS["middle"]!;

    // Get size multipliers (default to medium)
    const size = TEXT_SIZES[textSize?.toLowerCase() ?? ""] ?? TEXT_SIZES["medium"]!;

    // Calculate width and height
    const width = Math.min(0.45, hPos.defaultWidth * size.widthMultiplier); // Cap at 45%
    const height = Math.min(0.20, vPos.defaultHeight * size.heightMultiplier); // Cap at 20%

    // Calculate x, y from center point
    const x = Math.max(0, Math.min(1 - width, hPos.center - width / 2));
    const y = Math.max(0, Math.min(1 - height, vPos.center - height / 2));

    console.log(
      `[TextDetectionService] Semantic "${horizontalPos}/${verticalPos}/${textSize}" -> box: x=${x.toFixed(3)}, y=${y.toFixed(3)}, w=${width.toFixed(3)}, h=${height.toFixed(3)}`
    );

    return { x, y, width, height };
  }

  /**
   * Transform and validate the raw GPT-4o response
   */
  private transformResponse(raw: RawAnalysisResponse): ImageAnalysis {
    // Transform text regions with validation
    const textRegions: TextRegion[] = (raw.textRegions ?? []).map((region, index) => {
      // Priority order: semantic position > grid cells > bounding box > default
      let boundingBox: BoundingBox;

      if (region.horizontalPosition || region.verticalPosition) {
        // New semantic position format (preferred)
        boundingBox = this.semanticToBoundingBox(
          region.horizontalPosition,
          region.verticalPosition,
          region.textSize
        );
        console.log(`[TextDetectionService] Text "${region.text?.substring(0, 20)}..." uses semantic: h=${region.horizontalPosition}, v=${region.verticalPosition}, size=${region.textSize}`);
      } else if (region.gridCells && region.gridCells.length > 0) {
        // Grid cells format (fallback)
        boundingBox = this.gridCellsToBoundingBox(region.gridCells);
        console.log(`[TextDetectionService] Text "${region.text?.substring(0, 20)}..." uses grid cells: [${region.gridCells.join(", ")}]`);
      } else if (region.boundingBox) {
        // Legacy bounding box format
        boundingBox = this.validateBoundingBox(region.boundingBox);
        console.log(`[TextDetectionService] Text "${region.text?.substring(0, 20)}..." uses legacy bounding box`);
      } else {
        // No location info - use default
        boundingBox = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
        console.warn(`[TextDetectionService] Text "${region.text?.substring(0, 20)}..." has no location info, using default`);
      }

      return {
        text: region.text ?? "",
        boundingBox,
        confidence: Math.min(1, Math.max(0, region.confidence ?? 0.8)),
        style: region.style
          ? {
              fontWeight: this.validateFontWeight(region.style.fontWeight),
              fontSize: this.validateFontSize(region.style.fontSize),
              alignment: this.validateAlignment(region.style.alignment),
              color: region.style.color,
              case: this.validateCase(region.style.case),
            }
          : undefined,
        role: this.validateRole(region.role),
        order: region.order ?? index + 1,
      };
    });

    // Sort by order
    textRegions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    console.log(`[TextDetectionService] Transformed ${textRegions.length} text regions`);

    return {
      textRegions,
      layout: this.validateLayout(raw.layout),
      surfaceTexture: raw.surfaceTexture ?? "unknown background",
      dominantColors: raw.dominantColors ?? [],
      hasUIElements: raw.hasUIElements ?? false,
      uiElements: raw.uiElements,
      imageDescription: raw.imageDescription ?? "Image analysis",
      analyzedAt: new Date(),
    };
  }

  /**
   * Convert grid cell notation (e.g., "D3") to column/row indices
   */
  private parseGridCell(cell: string): { col: number; row: number } | null {
    const match = cell.match(/^([A-H])(\d{1,2})$/i);
    if (!match) {
      console.warn(`[TextDetectionService] Invalid grid cell: ${cell}`);
      return null;
    }

    const col = match[1]!.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, ...
    const row = parseInt(match[2]!, 10) - 1; // 1-based to 0-based

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
      console.warn(`[TextDetectionService] Grid cell out of range: ${cell}`);
      return null;
    }

    return { col, row };
  }

  /**
   * Convert an array of grid cells to a bounding box
   * Finds the min/max of all cells to create a rectangular region
   */
  private gridCellsToBoundingBox(cells: string[]): BoundingBox {
    if (!cells || cells.length === 0) {
      // Default to center of image if no cells
      return { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    }

    let minCol = GRID_COLS;
    let maxCol = -1;
    let minRow = GRID_ROWS;
    let maxRow = -1;

    for (const cell of cells) {
      const parsed = this.parseGridCell(cell);
      if (parsed) {
        minCol = Math.min(minCol, parsed.col);
        maxCol = Math.max(maxCol, parsed.col);
        minRow = Math.min(minRow, parsed.row);
        maxRow = Math.max(maxRow, parsed.row);
      }
    }

    // If no valid cells found, default to center
    if (maxCol < 0 || maxRow < 0) {
      return { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    }

    // Convert grid coordinates to normalized bounding box
    // Add 1 to max because we want to include the entire cell
    const x = minCol * CELL_WIDTH;
    const y = minRow * CELL_HEIGHT;
    const width = (maxCol - minCol + 1) * CELL_WIDTH;
    const height = (maxRow - minRow + 1) * CELL_HEIGHT;

    console.log(
      `[TextDetectionService] Grid cells [${cells.join(", ")}] -> box: x=${x.toFixed(3)}, y=${y.toFixed(3)}, w=${width.toFixed(3)}, h=${height.toFixed(3)}`
    );

    return { x, y, width, height };
  }

  /**
   * Validate and clamp bounding box values to 0-1 range
   * Also validates that boxes aren't suspiciously large
   */
  private validateBoundingBox(box?: Partial<BoundingBox>): BoundingBox {
    const clamp = (val: number | undefined, defaultVal: number) =>
      Math.min(1, Math.max(0, val ?? defaultVal));

    let width = clamp(box?.width, 0.2);
    let height = clamp(box?.height, 0.05);

    // Sanity check: individual text elements rarely span more than 40% of image
    // If they do, it's likely GPT-4o combined multiple elements
    const MAX_REASONABLE_WIDTH = 0.5;
    const MAX_REASONABLE_HEIGHT = 0.15; // Text is typically much shorter than wide

    if (width > MAX_REASONABLE_WIDTH) {
      console.warn(`[TextDetectionService] Box width ${width} exceeds max ${MAX_REASONABLE_WIDTH}, capping`);
      width = MAX_REASONABLE_WIDTH;
    }
    if (height > MAX_REASONABLE_HEIGHT) {
      console.warn(`[TextDetectionService] Box height ${height} exceeds max ${MAX_REASONABLE_HEIGHT}, capping`);
      height = MAX_REASONABLE_HEIGHT;
    }

    return {
      x: clamp(box?.x, 0),
      y: clamp(box?.y, 0),
      width,
      height,
    };
  }

  /**
   * Validate font weight
   */
  private validateFontWeight(weight?: string): "normal" | "bold" | "light" {
    if (weight === "bold" || weight === "light") return weight;
    return "normal";
  }

  /**
   * Validate font size
   */
  private validateFontSize(size?: string): "small" | "medium" | "large" | "xlarge" {
    if (size === "small" || size === "medium" || size === "large" || size === "xlarge") return size;
    return "medium";
  }

  /**
   * Validate alignment
   */
  private validateAlignment(alignment?: string): "left" | "center" | "right" {
    if (alignment === "left" || alignment === "center" || alignment === "right") return alignment;
    return "left";
  }

  /**
   * Validate text case
   */
  private validateCase(textCase?: string): "normal" | "uppercase" | "lowercase" {
    if (textCase === "uppercase" || textCase === "lowercase") return textCase;
    return "normal";
  }

  /**
   * Validate text role
   */
  private validateRole(
    role?: string
  ): "headline" | "subheadline" | "bullet" | "cta" | "footer" | "label" | "other" {
    const validRoles = ["headline", "subheadline", "bullet", "cta", "footer", "label", "other"];
    if (role && validRoles.includes(role))
      return role as "headline" | "subheadline" | "bullet" | "cta" | "footer" | "label" | "other";
    return "other";
  }

  /**
   * Validate layout type
   */
  private validateLayout(layout?: string): ImageLayout {
    const validLayouts: ImageLayout[] = [
      "app-screenshot",
      "sticky-notes",
      "banner",
      "poster",
      "social-media",
      "product",
      "presentation",
      "unknown",
    ];
    if (layout && validLayouts.includes(layout as ImageLayout)) return layout as ImageLayout;
    return "unknown";
  }

  /**
   * Create an empty analysis for error cases (graceful degradation)
   */
  private createEmptyAnalysis(errorReason?: string): ImageAnalysis {
    return {
      textRegions: [],
      layout: "unknown",
      surfaceTexture: "unknown",
      dominantColors: [],
      hasUIElements: false,
      imageDescription: errorReason ?? "Analysis failed",
      analyzedAt: new Date(),
    };
  }
}

// =============================================================================
// Raw Response Type (internal)
// =============================================================================

interface RawAnalysisResponse {
  textRegions?: Array<{
    text?: string;
    // Semantic position format (preferred)
    horizontalPosition?: string;
    verticalPosition?: string;
    textSize?: string;
    // Grid-based format (fallback)
    gridCells?: string[];
    // Legacy bounding box format (fallback)
    boundingBox?: Partial<BoundingBox>;
    confidence?: number;
    style?: {
      fontWeight?: string;
      fontSize?: string;
      alignment?: string;
      color?: string;
      case?: string;
    };
    role?: string;
    order?: number;
  }>;
  layout?: string;
  surfaceTexture?: string;
  dominantColors?: string[];
  hasUIElements?: boolean;
  uiElements?: string[];
  imageDescription?: string;
}

// =============================================================================
// Semantic Position Mappings
// =============================================================================

const HORIZONTAL_POSITIONS: Record<string, { center: number; defaultWidth: number }> = {
  "far-left": { center: 0.10, defaultWidth: 0.20 },
  "left": { center: 0.30, defaultWidth: 0.25 },
  "center-left": { center: 0.35, defaultWidth: 0.25 },
  "center": { center: 0.50, defaultWidth: 0.30 },
  "center-right": { center: 0.65, defaultWidth: 0.25 },
  "right": { center: 0.70, defaultWidth: 0.25 },
  "far-right": { center: 0.90, defaultWidth: 0.20 },
};

// Vertical positions are MORE COMPACT than horizontal
// Most text in images is clustered in the middle 60% (20%-80%)
// Stacked text (like sticky notes) is especially compact
const VERTICAL_POSITIONS: Record<string, { center: number; defaultHeight: number }> = {
  "top": { center: 0.15, defaultHeight: 0.12 },
  "upper": { center: 0.28, defaultHeight: 0.12 },
  "upper-middle": { center: 0.38, defaultHeight: 0.12 },
  "middle": { center: 0.48, defaultHeight: 0.12 },
  "lower-middle": { center: 0.58, defaultHeight: 0.12 },
  "lower": { center: 0.68, defaultHeight: 0.12 },
  "bottom": { center: 0.78, defaultHeight: 0.12 },
};

const TEXT_SIZES: Record<string, { widthMultiplier: number; heightMultiplier: number }> = {
  "small": { widthMultiplier: 0.6, heightMultiplier: 0.6 },
  "medium": { widthMultiplier: 1.0, heightMultiplier: 1.0 },
  "large": { widthMultiplier: 1.5, heightMultiplier: 1.3 },
  "xlarge": { widthMultiplier: 2.0, heightMultiplier: 1.5 },
};

// =============================================================================
// Factory (Dependency Inversion: depend on abstraction via factory)
// =============================================================================

let serviceInstance: TextDetectionService | null = null;

/**
 * Get the Text Detection Service instance (singleton)
 */
export function getTextDetectionService(): TextDetectionService {
  if (!serviceInstance) {
    serviceInstance = new TextDetectionService();
  }
  return serviceInstance;
}

/**
 * Create a new Text Detection Service instance (for testing)
 */
export function createTextDetectionService(): TextDetectionService {
  return new TextDetectionService();
}
