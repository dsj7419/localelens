/**
 * Prompt Engineering Service
 *
 * Single Responsibility: Use GPT-4o to write intelligent, specific prompts
 * for gpt-image-1.5 image editing.
 *
 * THE KEY INNOVATION:
 * Instead of generic templates, we use GPT-4o's understanding of the image
 * to generate prompts that are AS SPECIFIC as manually-written ones.
 *
 * This is the difference between:
 *   Generic: "Replace text next to icons"
 *   Specific: "Replace 'Smart schedule suggestions' immediately to the right
 *             of the blue checkmark icon, maintaining the same font weight
 *             and starting at the exact same horizontal position"
 */

import OpenAI from "openai";
import { env } from "~/env";
import type { LocaleId } from "../domain/value-objects/locale";
import { getLocaleMetadata, isRtlLocale } from "../domain/value-objects/locale";
import type { ImageAnalysis, TextRegion } from "./textDetectionService";
import type { TranslatedText } from "./translationService";

// =============================================================================
// Types
// =============================================================================

/**
 * Enhanced structural analysis with spatial relationships
 */
export interface SpatialRelationship {
  textContent: string;
  relationship: string; // Natural language: "immediately right of checkmark icon"
  container?: string; // "inside blue rounded button", etc.
  position: string; // "top-center", "middle-left", etc.
}

export interface UIElement {
  type: "icon" | "button" | "frame" | "divider" | "logo" | "image" | "background";
  description: string;
  position: string;
  preservationPriority: "critical" | "high" | "medium";
}

export interface EnhancedAnalysis {
  /** Base analysis data */
  baseAnalysis: ImageAnalysis;
  /** Spatial relationships between text and UI elements */
  spatialRelationships: SpatialRelationship[];
  /** Detailed UI element information */
  detailedUIElements: UIElement[];
  /** Identified anchor points */
  anchorPoints: string[];
  /** Elements that must be preserved */
  preservationList: string[];
}

export interface PromptEngineeringInput {
  /** Original image analysis */
  analysis: ImageAnalysis;
  /** Translated text to use */
  translations: TranslatedText[];
  /** Target locale */
  locale: LocaleId;
  /** Base image buffer for enhanced analysis */
  imageBuffer?: Buffer;
  /** Whether to run enhanced analysis (costs extra GPT-4o call) */
  enhancedMode?: boolean;
}

export interface PromptEngineeringResult {
  /** The generated prompt for gpt-image-1.5 */
  prompt: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** List of elements to preserve */
  preservationElements: string[];
  /** Identified anchor points */
  anchorPoints: string[];
  /** Whether enhanced analysis was used */
  enhancedAnalysisUsed: boolean;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Prompt Engineering Service
 *
 * Uses GPT-4o to write highly specific prompts for gpt-image-1.5.
 * This bridges the gap between generic templates and human-written precision.
 */
export class PromptEngineeringService {
  private readonly client: OpenAI;
  private readonly model = "gpt-4o";

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate an intelligent, specific prompt for gpt-image-1.5
   *
   * This is the core innovation - using GPT-4o to write prompts that are
   * as specific as manually-crafted ones for the demo image.
   */
  async engineerPrompt(input: PromptEngineeringInput): Promise<PromptEngineeringResult> {
    const { analysis, translations, locale, imageBuffer, enhancedMode = true } = input;

    const localeMeta = getLocaleMetadata(locale);
    const isRtl = isRtlLocale(locale);

    // Build the context for GPT-4o
    const analysisContext = this.formatAnalysisForPrompt(analysis);
    const translationsContext = this.formatTranslationsForPrompt(translations);
    const rtlContext = isRtl ? this.getRtlContext() : "";

    // The meta-prompt: asking GPT-4o to write a prompt for gpt-image-1.5
    const metaPrompt = `You are an expert prompt engineer specializing in image editing AI models.

Your task is to write a DETAILED, SPECIFIC prompt for gpt-image-1.5 (an image editing model) that will replace English text with ${localeMeta.name} translations.

## IMAGE ANALYSIS
${analysisContext}

## TRANSLATIONS TO APPLY
${translationsContext}

## TARGET LOCALE
${localeMeta.name} (${locale})${isRtl ? " - RIGHT-TO-LEFT language" : ""}
${rtlContext}

## YOUR TASK

Write a prompt for gpt-image-1.5 that:

1. **Describes the exact visual structure** of the image (layout, key elements, hierarchy)

2. **Specifies exactly where each translated text should appear** using:
   - Spatial relationships: "immediately to the right of [icon]"
   - Container relationships: "centered inside [button]"
   - Position anchors: "below [element], above [element]"

3. **Names specific anchor points** that define text positions:
   - Icons that precede text (e.g., "checkmark icon at start of each bullet")
   - Containers that hold text (e.g., "blue rounded button")
   - Visual markers (e.g., "brand logo", "divider line")

4. **Lists everything that must be PRESERVED** (not modified):
   - All icons and their exact positions
   - Button shapes and colors (only text inside changes)
   - Background elements, gradients, images
   - Device frames, status bars, navigation
   - Any non-text visual elements

5. **Includes strong preservation warnings** emphasizing:
   - Pixel-perfect preservation outside text areas
   - No modifications to icons, backgrounds, or UI elements
   - Text positions must match original exactly

Write the prompt as if a human expert carefully analyzed this exact image and crafted a custom prompt for it. Be SPECIFIC, not generic.

## OUTPUT FORMAT

Write ONLY the prompt text, nothing else. Start directly with the role assignment.`;

    try {
      // If we have the image and enhanced mode, include it for visual context
      const messages: OpenAI.ChatCompletionMessageParam[] = [];

      if (imageBuffer && enhancedMode) {
        const base64Image = imageBuffer.toString("base64");
        messages.push({
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: metaPrompt,
            },
          ],
        });
      } else {
        messages.push({
          role: "user",
          content: metaPrompt,
        });
      }

      console.log(`[PromptEngineeringService] Generating intelligent prompt for ${locale}`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent output
      });

      const generatedPrompt = response.choices[0]?.message?.content?.trim();

      if (!generatedPrompt) {
        throw new Error("No prompt generated");
      }

      console.log(
        `[PromptEngineeringService] Generated ${generatedPrompt.length} character prompt`
      );

      // Extract preservation elements and anchor points from the analysis
      const preservationElements = this.extractPreservationElements(analysis);
      const anchorPoints = this.extractAnchorPoints(analysis);

      return {
        prompt: generatedPrompt,
        confidence: 0.85, // Base confidence for AI-generated prompts
        preservationElements,
        anchorPoints,
        enhancedAnalysisUsed: !!imageBuffer && enhancedMode,
      };
    } catch (error) {
      console.error("[PromptEngineeringService] Error:", error);

      // Fallback to a well-structured but less specific prompt
      return this.buildFallbackPrompt(analysis, translations, locale);
    }
  }

  /**
   * Format the image analysis for the meta-prompt
   */
  private formatAnalysisForPrompt(analysis: ImageAnalysis): string {
    const lines: string[] = [];

    lines.push(`**Layout Type:** ${analysis.layout}`);
    lines.push(`**Image Description:** ${analysis.imageDescription || "Marketing image with text"}`);
    lines.push(`**Surface/Background:** ${analysis.surfaceTexture || "Standard background"}`);

    if (analysis.dominantColors?.length) {
      lines.push(`**Dominant Colors:** ${analysis.dominantColors.join(", ")}`);
    }

    if (analysis.uiElements?.length) {
      lines.push(`**UI Elements:** ${analysis.uiElements.join(", ")}`);
    }

    lines.push("");
    lines.push("**Text Regions Detected:**");

    for (let i = 0; i < analysis.textRegions.length; i++) {
      const region = analysis.textRegions[i]!;
      const role = region.role || "text";
      const position = this.describePosition(region.boundingBox);
      lines.push(`${i + 1}. [${role.toUpperCase()}] "${region.text}" - ${position}`);
    }

    return lines.join("\n");
  }

  /**
   * Format translations for the meta-prompt
   */
  private formatTranslationsForPrompt(translations: TranslatedText[]): string {
    return translations
      .map((t, i) => {
        const role = t.role || "text";
        return `${i + 1}. [${role.toUpperCase()}] "${t.original}" → "${t.translated}"`;
      })
      .join("\n");
  }

  /**
   * Get RTL-specific context
   */
  private getRtlContext(): string {
    return `
## RTL REQUIREMENTS
- All text must be rendered right-to-left
- Text blocks should be right-aligned
- Ensure proper Arabic/Hebrew letter shaping and ligatures
- Maintain character connections for cursive scripts
- Preserve original bounding box positions (flip alignment within box)`;
  }

  /**
   * Describe a position from bounding box coordinates
   */
  private describePosition(box: { x: number; y: number; width: number; height: number }): string {
    const vertical = box.y < 0.33 ? "top" : box.y < 0.66 ? "middle" : "bottom";
    const horizontal = box.x < 0.33 ? "left" : box.x < 0.66 ? "center" : "right";
    return `${vertical}-${horizontal} area`;
  }

  /**
   * Extract preservation elements from analysis
   */
  private extractPreservationElements(analysis: ImageAnalysis): string[] {
    const elements: string[] = [];

    // Standard preservation list based on layout
    switch (analysis.layout) {
      case "app-screenshot":
        elements.push(
          "Device frame and bezels",
          "Status bar",
          "Navigation elements",
          "All icons and checkmarks",
          "Button shapes and colors",
          "Background gradients"
        );
        break;
      case "sticky-notes":
        elements.push(
          "Sticky note shapes and colors",
          "Note positions and shadows",
          "Background surface texture",
          "Any decorative elements"
        );
        break;
      case "banner":
      case "social-media":
        elements.push(
          "Background imagery",
          "Brand elements and logos",
          "Visual hierarchy",
          "Color scheme"
        );
        break;
      default:
        elements.push(
          "All non-text visual elements",
          "Background",
          "Icons and symbols",
          "Layout structure"
        );
    }

    // Add detected UI elements
    if (analysis.uiElements) {
      for (const element of analysis.uiElements) {
        if (!elements.includes(element)) {
          elements.push(element);
        }
      }
    }

    return elements;
  }

  /**
   * Extract anchor points from analysis
   */
  private extractAnchorPoints(analysis: ImageAnalysis): string[] {
    const anchors: string[] = [];

    // Find text with specific roles that suggest anchor points
    for (const region of analysis.textRegions) {
      if (region.role === "bullet") {
        anchors.push(`Icon/marker before "${region.text.substring(0, 20)}..."`);
      }
      if (region.role === "cta") {
        anchors.push(`Button container for "${region.text}"`);
      }
    }

    // Add generic anchors based on layout
    if (analysis.layout === "app-screenshot") {
      anchors.push("App icon/logo at top");
      if (analysis.textRegions.some((r) => r.role === "bullet")) {
        anchors.push("Checkmark/bullet icons for list items");
      }
    }

    return anchors;
  }

  /**
   * Build a fallback prompt if GPT-4o fails
   */
  private buildFallbackPrompt(
    analysis: ImageAnalysis,
    translations: TranslatedText[],
    locale: LocaleId
  ): PromptEngineeringResult {
    const localeMeta = getLocaleMetadata(locale);
    const isRtl = isRtlLocale(locale);

    // Build a well-structured fallback prompt
    const textReplacements = translations
      .map((t, i) => {
        const role = (t.role || "text").toUpperCase();
        return `${i + 1}. [${role}] "${t.original}" → "${t.translated}"`;
      })
      .join("\n");

    const prompt = `You are a LOCALIZATION TOOL performing text translation on a ${analysis.layout} image.

TASK: Replace English text with ${localeMeta.name} translations. This is SURGICAL text substitution - translated text must occupy EXACT same positions as original.

IMAGE DESCRIPTION: ${analysis.imageDescription || "Image with text for localization"}
BACKGROUND/SURFACE: ${analysis.surfaceTexture || "Standard background"}

CRITICAL RULES:
1. Each translated text must START at the SAME position as the original
2. Text next to icons: starts immediately AFTER the icon, same horizontal position
3. Text inside buttons: stays CENTERED in the button
4. Headlines: stay centered in their container

PIXEL-PERFECT PRESERVATION (VIOLATION = FAILURE):
- Every pixel OUTSIDE the mask must remain IDENTICAL to original
- Do NOT move, resize, or reposition ANY visual elements
- Do NOT add shadows, glows, gradients, or effects
- All icons, markers, and symbols stay EXACTLY where they are
- Background must be preserved EXACTLY

TEXT STYLING:
- MATCH original font: family, weight, size, color, spacing
- If translated text is longer, use slightly smaller font to FIT
- Do NOT let text overflow or get cut off

${isRtl ? `RTL LAYOUT:
- Render all ${localeMeta.name} text right-to-left
- Right-align text blocks
- Ensure correct letter shaping and ligatures

` : ""}EXACT TEXT REPLACEMENTS:
${textReplacements}`;

    return {
      prompt,
      confidence: 0.6, // Lower confidence for fallback
      preservationElements: this.extractPreservationElements(analysis),
      anchorPoints: this.extractAnchorPoints(analysis),
      enhancedAnalysisUsed: false,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: PromptEngineeringService | null = null;

export function getPromptEngineeringService(): PromptEngineeringService {
  if (!serviceInstance) {
    serviceInstance = new PromptEngineeringService();
  }
  return serviceInstance;
}

export function createPromptEngineeringService(): PromptEngineeringService {
  return new PromptEngineeringService();
}
