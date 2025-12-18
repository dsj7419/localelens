/**
 * Locale Plan Service
 *
 * Single Responsibility: Build locale-specific prompts from DEMO_SCRIPT.
 * Contains the exact copy and prompt templates required for contest demo.
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
// Prompt Template (from DEMO_SCRIPT Section 9)
// =============================================================================

/**
 * Base prompt template - strict rules for minimal drift
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
 * RTL-specific addition for Arabic
 */
const RTL_ADDITION = `

RTL REQUIREMENT:
- Render all Arabic text right-to-left and right-aligned.
- Ensure correct Arabic letter shaping and natural typography.`;

/**
 * Stricter prompt template for regeneration (when drift is too high)
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
  getLocalizedCopy(locale: LocaleId): LocalizedCopy;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Locale Plan Service
 *
 * Builds final prompts for variant generation using exact DEMO_SCRIPT copy.
 */
export class LocalePlanService implements ILocalePlanService {
  /**
   * Build the complete prompt for a given locale
   */
  buildPrompt(locale: LocaleId): string {
    const copy = this.getLocalizedCopy(locale);

    let prompt = BASE_PROMPT_TEMPLATE.replace("{LOCALE}", locale)
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
   * Build a stricter prompt for regeneration (when drift is too high)
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
