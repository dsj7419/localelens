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
// GPT-4o Vision Prompt
// =============================================================================

const VISION_ANALYSIS_PROMPT = `Analyze this image and extract ALL visible text with their positions and styles.

Return a JSON object with this EXACT structure:
{
  "textRegions": [
    {
      "text": "The exact text content",
      "boundingBox": {
        "x": 0.1,
        "y": 0.2,
        "width": 0.3,
        "height": 0.05
      },
      "confidence": 0.95,
      "style": {
        "fontWeight": "bold",
        "fontSize": "large",
        "alignment": "center",
        "color": "white",
        "case": "uppercase"
      },
      "role": "headline",
      "order": 1
    }
  ],
  "layout": "app-screenshot",
  "surfaceTexture": "Description of the background texture (e.g., 'gradient blue to purple', 'solid white', 'colored sticky notes on gray background')",
  "dominantColors": ["blue", "white", "green"],
  "hasUIElements": true,
  "uiElements": ["checkmark icons", "button", "status bar"],
  "imageDescription": "Brief description of what the image shows"
}

IMPORTANT RULES:
1. Extract ALL visible text, no matter how small
2. boundingBox coordinates are NORMALIZED (0-1 range) relative to image size
3. For "role", use:
   - "headline" for main titles/headers
   - "subheadline" for secondary titles
   - "bullet" for bullet points or list items
   - "cta" for call-to-action buttons
   - "footer" for footer text/disclaimers
   - "label" for labels or captions
   - "other" for miscellaneous text
4. For "layout", choose the most appropriate:
   - "app-screenshot" for mobile app UIs
   - "sticky-notes" for motivational posters with notes
   - "banner" for marketing banners
   - "poster" for print posters
   - "social-media" for social graphics
   - "product" for product packaging
   - "presentation" for slides
   - "unknown" if unclear
5. "order" should reflect reading order (1 = first to read)
6. Be VERY accurate with bounding boxes - they will be used to create masks
7. Include ALL UI elements you see (icons, buttons, etc.) in "uiElements"

Return ONLY the JSON object, no markdown or explanation.`;

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

      // Validate and transform the response
      const analysis = this.transformResponse(parsed);

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
   * Transform and validate the raw GPT-4o response
   */
  private transformResponse(raw: RawAnalysisResponse): ImageAnalysis {
    // Transform text regions with validation
    const textRegions: TextRegion[] = (raw.textRegions ?? []).map((region, index) => ({
      text: region.text ?? "",
      boundingBox: this.validateBoundingBox(region.boundingBox),
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
    }));

    // Sort by order
    textRegions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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
   * Validate and clamp bounding box values to 0-1 range
   */
  private validateBoundingBox(box?: Partial<BoundingBox>): BoundingBox {
    const clamp = (val: number | undefined, defaultVal: number) =>
      Math.min(1, Math.max(0, val ?? defaultVal));

    return {
      x: clamp(box?.x, 0),
      y: clamp(box?.y, 0),
      width: clamp(box?.width, 0.2),
      height: clamp(box?.height, 0.05),
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
