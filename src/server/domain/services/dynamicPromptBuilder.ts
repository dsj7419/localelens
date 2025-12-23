/**
 * Dynamic Prompt Builder
 *
 * Single Responsibility: Build image-specific prompts from Vision analysis and translations.
 *
 * This is the PROMPT BUILDER in our two-model pipeline:
 * GPT-4o Vision (Inspector) -> GPT-4o (Translator) -> DynamicPromptBuilder -> gpt-image-1.5 (Artist)
 *
 * Why this exists:
 * - Hardcoded prompts only work for ONE demo image
 * - Dynamic prompts describe the ACTUAL image content
 * - Layout-aware templates produce better results for each image type
 *
 * This file lives in domain/services because it contains pure business logic
 * with no external dependencies (ISP compliance).
 */

import type { LocaleId } from "../value-objects/locale";
import { isRtlLocale, getLocaleMetadata } from "../value-objects/locale";
import type { ImageAnalysis, TextRegion, ImageLayout } from "../../services/textDetectionService";
import type { TranslatedText } from "../../services/translationService";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/**
 * Input for building a dynamic prompt
 */
export interface DynamicPromptInput {
  /** Image analysis from TextDetectionService */
  analysis: ImageAnalysis;
  /** Translations from TranslationService */
  translations: TranslatedText[];
  /** Target locale */
  locale: LocaleId;
  /** Whether to use ultra-strict preservation mode */
  ultraStrict?: boolean;
}

/**
 * Result of prompt building
 */
export interface DynamicPromptResult {
  /** The generated prompt */
  prompt: string;
  /** The layout type that was used */
  layout: ImageLayout;
  /** Number of text regions in prompt */
  textRegionCount: number;
}

/**
 * Interface for dynamic prompt building capability (ISP)
 */
export interface IDynamicPromptBuilder {
  /**
   * Build a prompt from image analysis and translations
   * @param input The analysis, translations, and locale
   * @returns A prompt tailored to the specific image
   */
  buildPrompt(input: DynamicPromptInput): DynamicPromptResult;
}

// =============================================================================
// Layout-Specific Templates
// =============================================================================

/**
 * Template for app screenshot images
 * These typically have UI elements, buttons, and structured layouts
 */
const APP_SCREENSHOT_TEMPLATE = `You are a LOCALIZATION TOOL performing text translation on a mobile app screenshot.

TASK: Replace the original English text with {LOCALE_NAME} translations. This is a SURGICAL text substitution - the translated text must occupy the EXACT same visual positions as the original.

IMAGE DESCRIPTION: {IMAGE_DESCRIPTION}
BACKGROUND/SURFACE: {SURFACE_TEXTURE}

UI ELEMENTS DETECTED: {UI_ELEMENTS}
IMPORTANT: Preserve ALL UI elements (icons, buttons, status bar) in their exact positions. Only modify the TEXT content.

LOCALIZATION RULES (CRITICAL):
1. This is TRANSLATION - you are replacing English words with {LOCALE_NAME} equivalents
2. The NEW text must occupy the EXACT SAME POSITION as the original
3. Text next to icons: starts immediately after the icon, same horizontal position
4. Button text: stays CENTERED inside the button
5. Headlines: stay centered in their container

PIXEL-PERFECT PRESERVATION (VIOLATION = FAILURE):
- Every pixel OUTSIDE the mask MUST remain IDENTICAL to the original
- Do NOT move, resize, or reposition ANY visual elements
- Do NOT add shadows, glows, gradients, or any effects
- Icons, buttons, and all non-text elements stay EXACTLY where they are
- Background must be preserved EXACTLY

TEXT STYLING:
- MATCH the original font: family, weight, size, color, letter-spacing
- If translated text is longer, use slightly smaller font to FIT
- Do NOT let text overflow or get cut off

{RTL_INSTRUCTIONS}

EXACT TEXT REPLACEMENTS:
{TEXT_REPLACEMENTS}`;

/**
 * Template for sticky note / motivational poster images
 * These typically have colored notes on a background
 */
const STICKY_NOTES_TEMPLATE = `You are a LOCALIZATION TOOL performing text translation on a motivational poster/sticky notes image.

TASK: Replace the text on each sticky note with {LOCALE_NAME} translations. Preserve the note colors and positions exactly.

IMAGE DESCRIPTION: {IMAGE_DESCRIPTION}
BACKGROUND/SURFACE: {SURFACE_TEXTURE}
DOMINANT COLORS: {DOMINANT_COLORS}

STICKY NOTE PRESERVATION (CRITICAL):
1. Each colored note/card must remain its EXACT original color
2. Note positions must NOT change
3. Only the TEXT on each note changes
4. Preserve any shadows, tape, or decorative elements

LOCALIZATION RULES:
1. Replace each piece of text with its {LOCALE_NAME} translation
2. Text should be CENTERED on its note/card
3. Match the original text style (font weight, size)
4. If translation is longer, use slightly smaller text to FIT on the note

PIXEL-PERFECT PRESERVATION:
- The background behind the notes must be IDENTICAL
- Note shapes, colors, and positions are FIXED
- Only text content changes

TEXT STYLING:
- Bold, impactful text that fills the note appropriately
- Match original text color (if it was white/dark based on note color)

{RTL_INSTRUCTIONS}

EXACT TEXT REPLACEMENTS:
{TEXT_REPLACEMENTS}`;

/**
 * Template for banner/marketing images
 */
const BANNER_TEMPLATE = `You are a LOCALIZATION TOOL performing text translation on a marketing banner.

TASK: Replace English text with {LOCALE_NAME} translations while preserving the visual design.

IMAGE DESCRIPTION: {IMAGE_DESCRIPTION}
BACKGROUND/SURFACE: {SURFACE_TEXTURE}
DOMINANT COLORS: {DOMINANT_COLORS}

BANNER DESIGN PRESERVATION (CRITICAL):
1. Maintain the overall visual hierarchy
2. Headlines should remain prominent
3. Preserve any brand elements or logos
4. Background imagery must be IDENTICAL

LOCALIZATION RULES:
1. Headlines: Keep them punchy and impactful in {LOCALE_NAME}
2. Body text: Clear and readable
3. CTAs: Short, action-oriented
4. Text positions should remain visually balanced

PIXEL-PERFECT PRESERVATION:
- Only modify pixels inside the masked regions
- Preserve all non-text visual elements
- Background gradients, images, patterns stay IDENTICAL

{RTL_INSTRUCTIONS}

EXACT TEXT REPLACEMENTS:
{TEXT_REPLACEMENTS}`;

/**
 * Template for poster/print images
 */
const POSTER_TEMPLATE = `You are a LOCALIZATION TOOL performing text translation on a poster/print design.

TASK: Replace English text with {LOCALE_NAME} translations while preserving the artistic design.

IMAGE DESCRIPTION: {IMAGE_DESCRIPTION}
BACKGROUND/SURFACE: {SURFACE_TEXTURE}
DOMINANT COLORS: {DOMINANT_COLORS}

POSTER DESIGN PRESERVATION (CRITICAL):
1. Maintain typographic hierarchy
2. Preserve artistic balance and composition
3. Keep any decorative text styling
4. Background and imagery must be IDENTICAL

LOCALIZATION RULES:
1. Match the original text positioning and alignment
2. Preserve any stylistic treatments (outlines, shadows, effects)
3. Text should have same visual weight
4. Abbreviate if needed to fit the same space

{RTL_INSTRUCTIONS}

EXACT TEXT REPLACEMENTS:
{TEXT_REPLACEMENTS}`;

/**
 * Generic template for unknown layouts
 */
const GENERIC_TEMPLATE = `You are a LOCALIZATION TOOL performing text translation on an image.

TASK: Replace English text with {LOCALE_NAME} translations while preserving the overall design.

IMAGE DESCRIPTION: {IMAGE_DESCRIPTION}
BACKGROUND/SURFACE: {SURFACE_TEXTURE}

PRESERVATION RULES (CRITICAL):
1. Only modify pixels inside the masked regions
2. Preserve ALL non-text elements exactly
3. Background must remain IDENTICAL
4. Text positions should not shift

LOCALIZATION RULES:
1. Replace each piece of text with its {LOCALE_NAME} translation
2. Match original text styling (font, size, color)
3. Keep text aligned as in original
4. Fit translations in the same visual space

{RTL_INSTRUCTIONS}

EXACT TEXT REPLACEMENTS:
{TEXT_REPLACEMENTS}`;

// =============================================================================
// RTL Instructions
// =============================================================================

const RTL_INSTRUCTIONS = `
RTL LAYOUT REQUIREMENTS (Arabic):
- Render all text right-to-left (RTL)
- Right-align text blocks
- Ensure correct Arabic letter shaping and ligatures
- Maintain proper character connections
- Preserve original bounding box positions (flip alignment only)`;

const LTR_INSTRUCTIONS = `
TEXT DIRECTION: Left-to-right (LTR)
Maintain standard Western text layout.`;

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Dynamic Prompt Builder
 *
 * Builds prompts tailored to specific images based on Vision analysis.
 * Uses layout-specific templates for optimal results.
 *
 * This replaces the hardcoded prompts that only worked for one demo image.
 */
export class DynamicPromptBuilder implements IDynamicPromptBuilder {
  /**
   * Build a prompt from image analysis and translations
   */
  buildPrompt(input: DynamicPromptInput): DynamicPromptResult {
    const { analysis, translations, locale, ultraStrict = false } = input;

    // Get the appropriate template for this layout
    const template = this.getTemplateForLayout(analysis.layout);

    // Get locale metadata
    const localeMeta = getLocaleMetadata(locale);
    const isRtl = isRtlLocale(locale);

    // Build the text replacements section
    const textReplacements = this.buildTextReplacements(analysis.textRegions, translations);

    // Build the prompt from template
    let prompt = template
      .replace(/{LOCALE_NAME}/g, localeMeta.name)
      .replace(/{IMAGE_DESCRIPTION}/g, analysis.imageDescription || "Image for localization")
      .replace(/{SURFACE_TEXTURE}/g, analysis.surfaceTexture || "standard background")
      .replace(/{DOMINANT_COLORS}/g, (analysis.dominantColors || []).join(", ") || "various")
      .replace(/{UI_ELEMENTS}/g, (analysis.uiElements || []).join(", ") || "none detected")
      .replace(/{RTL_INSTRUCTIONS}/g, isRtl ? RTL_INSTRUCTIONS : LTR_INSTRUCTIONS)
      .replace(/{TEXT_REPLACEMENTS}/g, textReplacements);

    // Add ultra-strict prefix if needed
    if (ultraStrict) {
      prompt = this.addUltraStrictPrefix(prompt);
    }

    return {
      prompt,
      layout: analysis.layout,
      textRegionCount: translations.length,
    };
  }

  /**
   * Get the template for a specific layout type
   */
  private getTemplateForLayout(layout: ImageLayout): string {
    switch (layout) {
      case "app-screenshot":
        return APP_SCREENSHOT_TEMPLATE;
      case "sticky-notes":
        return STICKY_NOTES_TEMPLATE;
      case "banner":
      case "social-media":
        return BANNER_TEMPLATE;
      case "poster":
      case "presentation":
        return POSTER_TEMPLATE;
      case "product":
      case "unknown":
      default:
        return GENERIC_TEMPLATE;
    }
  }

  /**
   * Build the text replacements section of the prompt
   */
  private buildTextReplacements(
    textRegions: TextRegion[],
    translations: TranslatedText[]
  ): string {
    // Create a map of original text to translation
    const translationMap = new Map<string, string>();
    for (const t of translations) {
      translationMap.set(t.original, t.translated);
    }

    // Build replacement lines
    const lines: string[] = [];
    const usedOriginals = new Set<string>();

    // First, match by order
    for (let i = 0; i < textRegions.length; i++) {
      const region = textRegions[i];
      if (!region) continue;

      const translation = translations.find((t) => t.order === i + 1);
      const translatedText = translation?.translated ?? translationMap.get(region.text) ?? region.text;

      const roleLabel = this.getRoleLabel(region.role);
      lines.push(`${i + 1}. [${roleLabel}] "${region.text}" → "${translatedText}"`);
      usedOriginals.add(region.text);
    }

    // Add any translations that weren't matched (shouldn't happen, but safety)
    for (const t of translations) {
      if (!usedOriginals.has(t.original)) {
        const roleLabel = this.getRoleLabel(t.role);
        lines.push(`• [${roleLabel}] "${t.original}" → "${t.translated}"`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Get a human-readable label for a text role
   */
  private getRoleLabel(role?: string): string {
    switch (role) {
      case "headline":
        return "HEADLINE";
      case "subheadline":
        return "SUBHEADLINE";
      case "bullet":
        return "BULLET";
      case "cta":
        return "BUTTON/CTA";
      case "footer":
        return "FOOTER";
      case "label":
        return "LABEL";
      default:
        return "TEXT";
    }
  }

  /**
   * Add ultra-strict preservation prefix for maximum fidelity
   */
  private addUltraStrictPrefix(prompt: string): string {
    const prefix = `ULTRA-STRICT PRESERVATION MODE - MAXIMUM PRECISION

WARNING: This is an ultra-strict localization. ANY modification to pixels outside the mask region is UNACCEPTABLE.

ABSOLUTE RULES:
- The image OUTSIDE masked regions must be PIXEL-IDENTICAL to the original
- Not "similar" - IDENTICAL. Every pixel value must match exactly.
- Do not enhance, sharpen, blur, adjust colors, or modify ANYTHING
- If you cannot preserve pixels perfectly, do NOT attempt the edit

`;
    return prefix + prompt;
  }
}

// =============================================================================
// Factory (Dependency Inversion)
// =============================================================================

let serviceInstance: DynamicPromptBuilder | null = null;

/**
 * Get the Dynamic Prompt Builder instance (singleton)
 */
export function getDynamicPromptBuilder(): DynamicPromptBuilder {
  if (!serviceInstance) {
    serviceInstance = new DynamicPromptBuilder();
  }
  return serviceInstance;
}

/**
 * Create a new Dynamic Prompt Builder instance (for testing)
 */
export function createDynamicPromptBuilder(): DynamicPromptBuilder {
  return new DynamicPromptBuilder();
}
