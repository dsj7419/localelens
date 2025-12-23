/**
 * Translation Service
 *
 * Single Responsibility: Translate detected text to target locales using GPT-4o.
 *
 * This is the TRANSLATOR in our two-model pipeline:
 * GPT-4o Vision (Inspector) -> GPT-4o (Translator) -> gpt-image-1.5 (Artist)
 *
 * Key features:
 * - Respects length constraints (translations similar length to original)
 * - Handles RTL languages correctly (Arabic)
 * - Preserves meaning and tone
 * - Contextual translation (knows text is for visual localization)
 */

import OpenAI from "openai";
import { env } from "~/env";
import type { LocaleId } from "../domain/value-objects/locale";
import { isRtlLocale, getLocaleMetadata } from "../domain/value-objects/locale";
import type { TextRegion } from "./textDetectionService";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/**
 * A translated text item with original and translated versions
 */
export interface TranslatedText {
  /** The original text that was detected */
  original: string;
  /** The translated text in the target locale */
  translated: string;
  /** The target locale */
  locale: LocaleId;
  /** Semantic role of this text (from detection) */
  role?: string;
  /** Order/position in the original layout */
  order?: number;
  /** Whether the translation fits the original bounding box (estimated) */
  fitsOriginalBox?: boolean;
}

/**
 * Translation context provides hints about how text should be translated
 */
export interface TranslationContext {
  /** The type of image (app-screenshot, banner, poster, etc.) */
  imageType: string;
  /** The tone to use for translations */
  tone?: "formal" | "casual" | "neutral" | "playful";
  /** Maximum character length for each translation (relative to original) */
  maxLengthRatio?: number;
  /** Whether to preserve formatting hints (e.g., all caps) */
  preserveFormatting?: boolean;
}

/**
 * Input for batch translation
 */
export interface TranslationInput {
  /** Text regions detected from the image */
  textRegions: TextRegion[];
  /** Target locale for translation */
  targetLocale: LocaleId;
  /** Optional context for better translations */
  context?: TranslationContext;
}

/**
 * Result of translation operation
 */
export interface TranslationResult {
  /** Whether translation was successful */
  success: boolean;
  /** Translated texts */
  translations: TranslatedText[];
  /** Error message if failed */
  error?: string;
  /** The locale that was used */
  locale: LocaleId;
}

/**
 * Interface for translation capability (ISP)
 */
export interface ITranslationService {
  /**
   * Translate detected text regions to a target locale
   * @param input The text regions and target locale
   * @returns Translated text with original mappings
   */
  translateTexts(input: TranslationInput): Promise<TranslationResult>;
}

// =============================================================================
// Translation Prompts
// =============================================================================

/**
 * System prompt for translation - establishes context and rules
 */
const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator specializing in marketing and visual content localization.

Your translations will be used to replace text in images, so you must:
1. Keep translations SIMILAR LENGTH to the original (max 20% longer)
2. Preserve the TONE and STYLE of the original
3. Ensure translations are culturally appropriate for the target locale
4. For headlines/titles: Keep them punchy and impactful
5. For buttons/CTAs: Keep them short and action-oriented
6. For bullet points: Maintain brevity and clarity

CRITICAL: Translations must FIT in the same visual space as the original text.
If a translation would be too long, use a shorter alternative that preserves meaning.

CRITICAL LINE-COUNT PRESERVATION:
- You MUST produce EXACTLY the same number of translations as source texts
- NEVER combine multiple source texts into a single translation
- Each source text region MUST have its own separate translation
- If a natural translation would combine phrases, split them creatively to maintain count`;

/**
 * Build the translation prompt for a specific locale
 */
function buildTranslationPrompt(
  texts: TextRegion[],
  locale: LocaleId,
  context?: TranslationContext
): string {
  const localeMeta = getLocaleMetadata(locale);
  const localeName = localeMeta.name;
  const isRtl = isRtlLocale(locale);

  // Build the text items to translate
  const textItems = texts.map((region, index) => ({
    index: index + 1,
    text: region.text,
    role: region.role ?? "other",
    characterCount: region.text.length,
  }));

  const contextInfo = context
    ? `\nImage type: ${context.imageType}\nTone: ${context.tone ?? "neutral"}`
    : "";

  const rtlNote = isRtl
    ? `\n\nIMPORTANT: The target language (${localeName}) is RTL (right-to-left). Ensure proper RTL text formatting.`
    : "";

  const lineCountConstraint = `

CRITICAL REQUIREMENT - LINE COUNT:
The source has EXACTLY ${texts.length} text regions.
Your translation MUST produce EXACTLY ${texts.length} translations.
Do NOT combine or merge any lines. Each source text MUST map to exactly one translation.

Example of WRONG behavior:
  Source: ["THAN YOU", "THINK"]
  Wrong: ["DE LO QUE CREES"] (INVALID - combined 2 into 1)
  Correct: ["DE LO QUE", "PIENSAS"] (Valid - maintained 2 translations)`;

  return `Translate the following texts to ${localeName} (${locale}).${contextInfo}${rtlNote}${lineCountConstraint}

Input texts to translate (EXACTLY ${texts.length} items - you MUST return EXACTLY ${texts.length} translations):
${textItems.map((item) => `${item.index}. [${item.role}] "${item.text}" (${item.characterCount} chars)`).join("\n")}

Return a JSON object with this EXACT structure:
{
  "translations": [
    {
      "index": 1,
      "original": "Original text",
      "translated": "Translated text",
      "role": "headline",
      "characterCount": 15,
      "fitsOriginalBox": true
    }
  ]
}

RULES:
- You MUST return EXACTLY ${texts.length} translations - no more, no less
- Keep translations as close to original length as possible
- If translation is >20% longer, find a shorter alternative
- Set "fitsOriginalBox" to false if translation is significantly longer
- Preserve any formatting (e.g., if original is ALL CAPS, use ALL CAPS)
- For numbers and proper nouns, keep them as appropriate for ${localeName}

Return ONLY the JSON object, no explanation.`;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Translation Service
 *
 * Translates detected text to target locales using GPT-4o.
 * Optimized for visual content localization with length constraints.
 */
export class TranslationService implements ITranslationService {
  private readonly client: OpenAI;
  private readonly model = "gpt-4o"; // GPT-4o for translation

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Translate detected text regions to a target locale
   */
  async translateTexts(input: TranslationInput): Promise<TranslationResult> {
    const { textRegions, targetLocale, context } = input;

    console.log(
      `[TranslationService] Translating ${textRegions.length} texts to ${targetLocale}`
    );

    // Handle empty input
    if (textRegions.length === 0) {
      return {
        success: true,
        translations: [],
        locale: targetLocale,
      };
    }

    try {
      // Build the translation prompt
      const userPrompt = buildTranslationPrompt(textRegions, targetLocale, context);

      // Call GPT-4o for translation
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: TRANSLATION_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 2048,
        temperature: 0.3, // Lower temperature for more consistent translations
        response_format: { type: "json_object" },
      });

      // Extract and parse the response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in GPT-4o response");
      }

      console.log(`[TranslationService] Received response, parsing...`);

      // Parse the JSON response
      const parsed = JSON.parse(content) as RawTranslationResponse;

      // Validate line count matches
      const expectedCount = textRegions.length;
      const actualCount = parsed.translations?.length ?? 0;
      if (actualCount !== expectedCount) {
        console.warn(
          `[TranslationService] Line count mismatch: expected ${expectedCount}, got ${actualCount}. Proceeding with available translations.`
        );
      }

      // Transform to our output format
      const translations = this.transformResponse(parsed, textRegions, targetLocale);

      console.log(
        `[TranslationService] Successfully translated ${translations.length} texts`
      );

      return {
        success: true,
        translations,
        locale: targetLocale,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TranslationService] Translation failed:`, errorMessage);

      return {
        success: false,
        translations: [],
        error: errorMessage,
        locale: targetLocale,
      };
    }
  }

  /**
   * Transform the raw GPT-4o response to our format
   */
  private transformResponse(
    raw: RawTranslationResponse,
    originalRegions: TextRegion[],
    locale: LocaleId
  ): TranslatedText[] {
    const translations: TranslatedText[] = [];

    // Create a map of original texts for fallback
    const originalMap = new Map<number, TextRegion>();
    originalRegions.forEach((region, index) => {
      originalMap.set(index + 1, region);
    });

    // Process each translation
    for (const item of raw.translations ?? []) {
      const originalRegion = originalMap.get(item.index);
      if (!originalRegion) continue;

      translations.push({
        original: item.original ?? originalRegion.text,
        translated: item.translated ?? originalRegion.text, // Fallback to original
        locale,
        role: item.role ?? originalRegion.role,
        order: item.index,
        fitsOriginalBox: item.fitsOriginalBox ?? true,
      });
    }

    // Ensure all original texts are represented (fallback for missed items)
    for (const [index, region] of originalMap) {
      const exists = translations.some((t) => t.order === index);
      if (!exists) {
        console.warn(
          `[TranslationService] Missing translation for index ${index}, using original`
        );
        translations.push({
          original: region.text,
          translated: region.text, // Use original as fallback
          locale,
          role: region.role,
          order: index,
          fitsOriginalBox: true,
        });
      }
    }

    // Sort by order
    translations.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return translations;
  }
}

// =============================================================================
// Raw Response Type (internal)
// =============================================================================

interface RawTranslationResponse {
  translations?: Array<{
    index: number;
    original?: string;
    translated?: string;
    role?: string;
    characterCount?: number;
    fitsOriginalBox?: boolean;
  }>;
}

// =============================================================================
// Factory (Dependency Inversion)
// =============================================================================

let serviceInstance: TranslationService | null = null;

/**
 * Get the Translation Service instance (singleton)
 */
export function getTranslationService(): TranslationService {
  if (!serviceInstance) {
    serviceInstance = new TranslationService();
  }
  return serviceInstance;
}

/**
 * Create a new Translation Service instance (for testing)
 */
export function createTranslationService(): TranslationService {
  return new TranslationService();
}
