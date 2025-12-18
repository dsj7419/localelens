/**
 * Locale Plan Service
 *
 * Single Responsibility: Build locale-specific prompts from DEMO_SCRIPT.
 * Contains the exact copy and prompt templates required for contest demo.
 *
 * Enhanced for gpt-image-1.5 Mastery:
 * - Surgical prompt templates for maximum preservation
 * - Without input_fidelity, prompts are our PRIMARY lever for preservation
 * - Multiple strictness levels for different use cases
 */

import type { LocaleId } from "../value-objects/locale";
import { isRtlLocale } from "../value-objects/locale";

// =============================================================================
// Localized Copy (from DEMO_SCRIPT Section 7)
// =============================================================================

export interface LocalizedCopy {
  headline: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  cta: string;
  footer: string;
}

/**
 * Exact localized copy from DEMO_SCRIPT
 */
export const LOCALIZED_COPY: Record<LocaleId, LocalizedCopy> = {
  "es-MX": {
    headline: "PLANEA TU DÍA EN SEGUNDOS",
    bullet1: "Sugerencias inteligentes de horario",
    bullet2: "Recordatorios con un toque",
    bullet3: "Compártelo con tu equipo",
    cta: "PRUÉBALO GRATIS",
    footer: "Producto ficticio. Solo demo.",
  },
  "fr-CA": {
    headline: "PLANIFIEZ EN QUELQUES SECONDES",
    bullet1: "Suggestions d'horaire intelligentes",
    bullet2: "Rappels en un seul toucher",
    bullet3: "Partagez avec votre équipe",
    cta: "ESSAI GRATUIT",
    footer: "Produit fictif. Démo seulement.",
  },
  ar: {
    headline: "خطّط ليومك في ثوانٍ",
    bullet1: "اقتراحات ذكية للجدول",
    bullet2: "تذكيرات بلمسة واحدة",
    bullet3: "شارك مع فريقك",
    cta: "جرّبه مجانًا",
    footer: "منتج خيالي. للعرض فقط.",
  },
};

// =============================================================================
// Surgical Prompt Templates (gpt-image-1.5 Optimized)
// =============================================================================

/**
 * SURGICAL PROMPT TEMPLATE
 *
 * This is our PRIMARY lever for image preservation since gpt-image-1.5
 * does NOT support the input_fidelity parameter.
 *
 * Key strategies:
 * 1. Explicit LOCALIZATION context - model understands the purpose
 * 2. Position anchoring - text occupies SAME positions as original
 * 3. Explicit negative constraints (what NOT to do)
 * 4. Medical/surgical terminology emphasizes precision
 * 5. EXPLICIT icon/symbol preservation instructions
 */
const SURGICAL_PROMPT_TEMPLATE = `You are a LOCALIZATION TOOL performing text translation on an app store screenshot.

TASK: Replace English text with {LOCALE} translations. This is a SURGICAL text substitution - the translated text must occupy the EXACT same visual positions as the original English text.

LOCALIZATION RULES (CRITICAL):
1. This is TRANSLATION - you are replacing English words with their {LOCALE} equivalents
2. The NEW text must START at the SAME position as the original text
3. The NEW text must be CENTERED/ALIGNED the same way as the original
4. If text is next to a checkmark icon, the text starts RIGHT AFTER the checkmark - same position
5. If text is inside a button, it must be CENTERED in that button - same as original
6. Headlines stay centered in their container - same position

PIXEL-PERFECT PRESERVATION (VIOLATION = FAILURE):
- Every pixel OUTSIDE the mask MUST remain BYTE-FOR-BYTE IDENTICAL
- Do NOT move, resize, or reposition ANY visual elements
- Do NOT add shadows, glows, gradients, or effects
- Do NOT change brightness, contrast, or colors anywhere
- Checkmark icons, bullet markers, and all symbols stay EXACTLY where they are
- The button shape, position, and style stays EXACTLY the same - only the text inside changes
- Background gradients and textures must be preserved EXACTLY

TEXT STYLING:
- MATCH the original font: family, weight, size, color, letter-spacing
- If the translated text is longer, use a slightly smaller size to FIT the same bounding box
- Do NOT let text overflow its container or get cut off

PROTECTED ELEMENTS (DO NOT TOUCH):
- Device frame, status bar, navigation
- All icons, checkmarks, and bullet markers
- Button shapes and backgrounds
- Any non-text visual elements

TARGET LOCALE: {LOCALE}
WRITING TONE: neutral, professional

EXACT TEXT TO RENDER (replace English with these translations):
HEADLINE: {HEADLINE}
BULLET 1 (after checkmark): {BULLET1}
BULLET 2 (after checkmark): {BULLET2}
BULLET 3 (after checkmark): {BULLET3}
CTA BUTTON TEXT (centered in button): {CTA}
FOOTER: {FOOTER}`;

/**
 * ULTRA-STRICT PROMPT TEMPLATE
 *
 * Even more restrictive version for when standard surgical prompt
 * still produces too much drift. Used for regeneration attempts.
 * Includes explicit icon/symbol preservation for bullet points.
 */
const ULTRA_STRICT_PROMPT_TEMPLATE = `LOCALIZATION TOOL - MAXIMUM PRECISION TEXT TRANSLATION

YOU ARE A PRECISION LOCALIZATION INSTRUMENT. Your task is to TRANSLATE English text to {LOCALE} while keeping everything else IDENTICAL.

WHAT THIS IS: A localization/translation tool. You are replacing English words with their {LOCALE} equivalents. The layout, positions, and all visual elements stay EXACTLY the same.

POSITION ANCHORING (CRITICAL):
- Each piece of translated text must occupy the EXACT SAME POSITION as the original English
- Text next to checkmark icons: starts immediately after the checkmark, SAME horizontal position
- Headline text: stays CENTERED in its container, SAME vertical position
- Button text: stays CENTERED inside the button, SAME position
- Do NOT shift, move, or reposition any text blocks

ABSOLUTE PRESERVATION (ANY VIOLATION IS UNACCEPTABLE):
- The image OUTSIDE the masked region must be PIXEL-IDENTICAL to the original
- Not "similar" - IDENTICAL. Every pixel, every color value, unchanged
- Do not adjust, enhance, sharpen, blur, or modify ANYTHING outside the mask
- Do not add any visual effects, shadows, or glows
- Background gradients, textures, and patterns must be preserved EXACTLY

NON-TEXT ELEMENT PRESERVATION (CRITICAL):
- All icons, checkmarks, bullet markers STAY in their EXACT positions
- Do NOT add, remove, duplicate, or modify any non-text visual elements
- The 3 checkmark icons are ANCHOR POINTS - they define where bullet text starts
- Button shapes are CONTAINERS - text centers inside them, button doesn't move

TEXT STYLING:
- Match the EXACT typography: font, weight, size, color, spacing
- If translated text is longer, use slightly smaller font to FIT - never overflow
- Text must NOT get cut off at edges - scale down if needed
- Leave all icons/symbols UNTOUCHED

PROTECTED ELEMENTS (DO NOT TOUCH):
- Device frame/bezels
- Status bar elements
- Navigation buttons
- All icons including checkmarks
- Background imagery
- UI chrome and borders
- Button shapes and backgrounds

TARGET LOCALE: {LOCALE}
WRITING TONE: neutral

RENDER THIS EXACT TEXT (translations to replace English):
HEADLINE (centered): {HEADLINE}
BULLET 1 (after checkmark): {BULLET1}
BULLET 2 (after checkmark): {BULLET2}
BULLET 3 (after checkmark): {BULLET3}
CTA (centered in button): {CTA}
FOOTER: {FOOTER}

REMEMBER: This is TRANSLATION. Same positions, same layout, different language.`;

/**
 * RTL-specific addition for Arabic
 *
 * Added to prompts when generating Arabic variants.
 */
const RTL_ADDITION = `

RTL LAYOUT REQUIREMENTS:
- Render all Arabic text right-to-left (RTL)
- Right-align all text blocks
- Ensure correct Arabic letter shaping and ligatures
- Maintain natural Arabic typography and character connections
- Preserve the original text bounding box positions (just flip alignment)`;

/**
 * @deprecated Use SURGICAL_PROMPT_TEMPLATE instead
 * Kept for backwards compatibility during transition
 */
const BASE_PROMPT_TEMPLATE = `You are editing an existing marketing screenshot.

STRICT RULES:
- Only modify pixels inside the masked (transparent) regions.
- Do NOT change anything outside the masked regions: layout, colors, icons, background, device frame, spacing, shadows, and UI elements must remain identical.
- Preserve the original typographic style as closely as possible (font weight, size, letter spacing, alignment, and visual hierarchy).
- Keep text within the original bounding boxes; if space is tight, shorten phrasing slightly while preserving meaning.

TARGET LOCALE: {LOCALE}
WRITING TONE: neutral

TEXT TO RENDER (exact):
HEADLINE: {HEADLINE}
BULLET 1: {BULLET1}
BULLET 2: {BULLET2}
BULLET 3: {BULLET3}
CTA: {CTA}
FOOTER: {FOOTER}`;

/**
 * @deprecated Use ULTRA_STRICT_PROMPT_TEMPLATE instead
 */
const STRICTER_PROMPT_TEMPLATE = `You are editing an existing marketing screenshot with MAXIMUM PRESERVATION requirements.

CRITICAL CONSTRAINTS (MUST FOLLOW EXACTLY):
- ONLY modify pixels STRICTLY inside the masked (transparent) regions.
- ABSOLUTELY DO NOT modify ANY pixels outside the mask - not even slightly.
- The background, icons, device frame, shadows, gradients, and ALL non-text elements must be PIXEL-PERFECT identical to the original.
- Match the EXACT font weight, size, letter spacing, line height, and alignment of the original text.
- If the new text is longer, compress or abbreviate it to fit within the EXACT same bounding box.
- Do not introduce any new colors, gradients, or visual effects.
- Do not add any shadows, outlines, or decorations to the text.

TARGET LOCALE: {LOCALE}
WRITING TONE: neutral

TEXT TO RENDER (exact):
HEADLINE: {HEADLINE}
BULLET 1: {BULLET1}
BULLET 2: {BULLET2}
BULLET 3: {BULLET3}
CTA: {CTA}
FOOTER: {FOOTER}

PRESERVATION IS THE HIGHEST PRIORITY. Any modification outside the mask is unacceptable.`;

// =============================================================================
// Service Interface (ISP)
// =============================================================================

export interface ILocalePlanService {
  buildPrompt(locale: LocaleId): string;
  buildStricterPrompt(locale: LocaleId): string;
  buildSurgicalPrompt(locale: LocaleId): string;
  buildUltraStrictPrompt(locale: LocaleId): string;
  getLocalizedCopy(locale: LocaleId): LocalizedCopy;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Locale Plan Service
 *
 * Builds final prompts for variant generation using exact DEMO_SCRIPT copy.
 *
 * Prompt Hierarchy (from least to most strict):
 * 1. buildPrompt() - Standard surgical prompt (DEFAULT)
 * 2. buildStricterPrompt() - More emphasis on preservation
 * 3. buildSurgicalPrompt() - Full surgical prompt (same as default)
 * 4. buildUltraStrictPrompt() - Maximum strictness for regeneration
 */
export class LocalePlanService implements ILocalePlanService {
  /**
   * Build the standard surgical prompt for a given locale
   *
   * This is the DEFAULT prompt - already optimized for gpt-image-1.5.
   * Uses surgical precision language since input_fidelity is unavailable.
   */
  buildPrompt(locale: LocaleId): string {
    return this.buildSurgicalPrompt(locale);
  }

  /**
   * Build a stricter prompt for regeneration attempts
   *
   * @deprecated Use buildUltraStrictPrompt() for maximum strictness
   */
  buildStricterPrompt(locale: LocaleId): string {
    const copy = this.getLocalizedCopy(locale);

    let prompt = STRICTER_PROMPT_TEMPLATE.replace("{LOCALE}", locale)
      .replace("{HEADLINE}", copy.headline)
      .replace("{BULLET1}", copy.bullet1)
      .replace("{BULLET2}", copy.bullet2)
      .replace("{BULLET3}", copy.bullet3)
      .replace("{CTA}", copy.cta)
      .replace("{FOOTER}", copy.footer);

    // Add RTL requirements for Arabic
    if (isRtlLocale(locale)) {
      prompt += RTL_ADDITION;
    }

    return prompt;
  }

  /**
   * Build the surgical precision prompt
   *
   * Optimized for gpt-image-1.5 which lacks input_fidelity parameter.
   * Uses explicit negative constraints and medical terminology.
   */
  buildSurgicalPrompt(locale: LocaleId): string {
    const copy = this.getLocalizedCopy(locale);

    let prompt = SURGICAL_PROMPT_TEMPLATE.replace("{LOCALE}", locale)
      .replace("{HEADLINE}", copy.headline)
      .replace("{BULLET1}", copy.bullet1)
      .replace("{BULLET2}", copy.bullet2)
      .replace("{BULLET3}", copy.bullet3)
      .replace("{CTA}", copy.cta)
      .replace("{FOOTER}", copy.footer);

    // Add RTL requirements for Arabic
    if (isRtlLocale(locale)) {
      prompt += RTL_ADDITION;
    }

    return prompt;
  }

  /**
   * Build ultra-strict prompt for maximum preservation
   *
   * Use this when:
   * - Standard surgical prompt still produces high drift
   * - Regenerating after a failed attempt
   * - Particularly sensitive images with fine details
   */
  buildUltraStrictPrompt(locale: LocaleId): string {
    const copy = this.getLocalizedCopy(locale);

    let prompt = ULTRA_STRICT_PROMPT_TEMPLATE.replace("{LOCALE}", locale)
      .replace("{HEADLINE}", copy.headline)
      .replace("{BULLET1}", copy.bullet1)
      .replace("{BULLET2}", copy.bullet2)
      .replace("{BULLET3}", copy.bullet3)
      .replace("{CTA}", copy.cta)
      .replace("{FOOTER}", copy.footer);

    // Add RTL requirements for Arabic
    if (isRtlLocale(locale)) {
      prompt += RTL_ADDITION;
    }

    return prompt;
  }

  /**
   * Get the localized copy for a given locale
   */
  getLocalizedCopy(locale: LocaleId): LocalizedCopy {
    return LOCALIZED_COPY[locale];
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: LocalePlanService | null = null;

export function getLocalePlanService(): LocalePlanService {
  if (!serviceInstance) {
    serviceInstance = new LocalePlanService();
  }
  return serviceInstance;
}
