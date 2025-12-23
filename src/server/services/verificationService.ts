/**
 * Verification Service
 *
 * Single Responsibility: Verify that translations were correctly rendered in generated images.
 *
 * This is the VERIFIER in our two-model pipeline:
 * GPT-4o Vision (Inspector) -> GPT-4o (Translator) -> gpt-image-1.5 (Artist) -> GPT-4o Vision (Verifier)
 *
 * Why this exists:
 * - gpt-image-1.5 may render text incorrectly (wrong characters, truncated, missing)
 * - Verification provides confidence that translations actually rendered
 * - Enables "Translation Accuracy" metric alongside Drift Score
 * - Professional QA mindset that differentiates LocaleLens from competitors
 *
 * The service re-reads generated images with GPT-4o Vision and compares
 * the extracted text to expected translations.
 */

import OpenAI from "openai";
import { env } from "~/env";
import type { LocaleId } from "../domain/value-objects/locale";
import { getLocaleMetadata, isRtlLocale } from "../domain/value-objects/locale";
import type { TranslatedText } from "./translationService";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/**
 * Status of a single text match comparison
 */
export type MatchStatus = "match" | "partial" | "mismatch" | "missing";

/**
 * Result of comparing a single expected text with actual rendered text
 */
export interface VerificationMatch {
  /** The expected translated text */
  expected: string;
  /** The actual text extracted from the generated image */
  actual: string;
  /** Similarity score (0-100%) using Levenshtein distance */
  similarity: number;
  /** Match status based on similarity threshold */
  status: MatchStatus;
  /** The role/position of this text (headline, bullet, etc.) */
  role?: string;
  /** Order/index of this text region */
  order?: number;
}

/**
 * Overall verification result for a generated variant
 */
export interface VerificationResult {
  /** The locale that was verified */
  locale: LocaleId;
  /** All expected translation texts */
  expectedTexts: string[];
  /** All texts extracted from the generated image */
  actualTexts: string[];
  /** Overall accuracy percentage (0-100) */
  accuracy: number;
  /** Detailed match results for each text region */
  matches: VerificationMatch[];
  /** Overall verification status */
  overallStatus: "pass" | "warn" | "fail";
  /** Timestamp of verification */
  verifiedAt: Date;
}

/**
 * Input for verification operation
 */
export interface VerificationInput {
  /** The generated image buffer to verify */
  generatedImageBuffer: Buffer;
  /** The expected translations */
  expectedTranslations: TranslatedText[];
  /** The locale of the variant */
  locale: LocaleId;
}

/**
 * Interface for verification capability (ISP)
 */
export interface IVerificationService {
  /**
   * Verify that translations were correctly rendered in a generated image
   * @param input The generated image and expected translations
   * @returns Verification result with accuracy and match details
   */
  verifyTranslation(input: VerificationInput): Promise<VerificationResult>;
}

// =============================================================================
// Constants
// =============================================================================

/** Threshold for "match" status (95% or higher) */
const MATCH_THRESHOLD = 95;

/** Threshold for "partial" status (70-95%) */
const PARTIAL_THRESHOLD = 70;

/** Threshold for overall "pass" status (85% or higher average accuracy) */
const PASS_THRESHOLD = 85;

/** Threshold for overall "warn" status (60-85%) */
const WARN_THRESHOLD = 60;

// =============================================================================
// GPT-4o Vision Verification Prompt
// =============================================================================

const VERIFICATION_PROMPT = `Analyze this generated image and extract ALL visible text.

Your task is to identify every piece of text in the image, reading it exactly as rendered.

Return a JSON object with this EXACT structure:
{
  "extractedTexts": [
    {
      "text": "The exact text as rendered in the image",
      "order": 1,
      "role": "headline"
    },
    {
      "text": "Another text element",
      "order": 2,
      "role": "bullet"
    }
  ],
  "readingConfidence": 0.95,
  "notes": "Any relevant notes about text quality or issues"
}

IMPORTANT RULES:
1. Extract text EXACTLY as it appears - including any misspellings or errors
2. Preserve exact capitalization, punctuation, and spacing
3. For RTL languages (Arabic, Hebrew), read right-to-left correctly
4. "order" should follow visual reading order (top-to-bottom, left-to-right for LTR)
5. "role" should be: "headline", "subheadline", "bullet", "cta", "footer", "label", or "other"
6. "readingConfidence" is your confidence in the extraction (0-1)
7. If text is partially visible or unclear, still extract what you can see

Return ONLY the JSON object, no markdown or explanation.`;

// =============================================================================
// Levenshtein Distance Helper
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * This measures the minimum number of single-character edits needed
 * to transform one string into another.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // deletion
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

/**
 * Calculate similarity percentage between two strings
 * Returns 100 for identical strings, 0 for completely different
 */
function calculateSimilarity(expected: string, actual: string): number {
  if (expected === actual) return 100;
  if (!expected || !actual) return 0;

  // Normalize strings for comparison
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);

  if (normalizedExpected === normalizedActual) return 100;

  const distance = levenshteinDistance(normalizedExpected, normalizedActual);
  const maxLength = Math.max(normalizedExpected.length, normalizedActual.length);

  if (maxLength === 0) return 100;

  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.max(0, Math.min(100, similarity));
}

/**
 * Normalize text for comparison (lowercase, trim, normalize whitespace)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/['']/g, "'") // Normalize quotes
    .replace(/[""]/g, '"'); // Normalize double quotes
}

/**
 * Determine match status based on similarity score
 */
function getMatchStatus(similarity: number): MatchStatus {
  if (similarity >= MATCH_THRESHOLD) return "match";
  if (similarity >= PARTIAL_THRESHOLD) return "partial";
  return "mismatch";
}

/**
 * Determine overall verification status based on accuracy
 */
function getOverallStatus(accuracy: number): "pass" | "warn" | "fail" {
  if (accuracy >= PASS_THRESHOLD) return "pass";
  if (accuracy >= WARN_THRESHOLD) return "warn";
  return "fail";
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Verification Service
 *
 * Uses GPT-4o Vision to extract text from generated images and compare
 * to expected translations. Provides accuracy metrics and detailed
 * match information.
 *
 * This is a CRITICAL component for quality assurance.
 * It proves that translations actually rendered correctly.
 */
export class VerificationService implements IVerificationService {
  private readonly client: OpenAI;
  private readonly model = "gpt-4o"; // GPT-4o for vision capabilities

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Verify that translations were correctly rendered in a generated image
   */
  async verifyTranslation(input: VerificationInput): Promise<VerificationResult> {
    const { generatedImageBuffer, expectedTranslations, locale } = input;
    const localeMeta = getLocaleMetadata(locale);

    console.log(
      `[VerificationService] Starting verification for ${localeMeta.name} (${expectedTranslations.length} texts)`
    );

    try {
      // Extract text from generated image using GPT-4o Vision
      const extractedTexts = await this.extractTextsFromImage(
        generatedImageBuffer,
        locale
      );

      console.log(
        `[VerificationService] Extracted ${extractedTexts.length} texts from generated image`
      );

      // Match extracted texts to expected translations
      const matches = this.matchTexts(expectedTranslations, extractedTexts);

      // Calculate overall accuracy
      const accuracy = this.calculateOverallAccuracy(matches);
      const overallStatus = getOverallStatus(accuracy);

      console.log(
        `[VerificationService] Verification complete: ${accuracy.toFixed(1)}% accuracy (${overallStatus})`
      );

      return {
        locale,
        expectedTexts: expectedTranslations.map((t) => t.translated),
        actualTexts: extractedTexts.map((t) => t.text),
        accuracy,
        matches,
        overallStatus,
        verifiedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[VerificationService] Verification failed:`, errorMessage);

      // Return failed verification result (graceful degradation)
      return this.createFailedResult(locale, expectedTranslations, errorMessage);
    }
  }

  /**
   * Extract texts from an image using GPT-4o Vision
   */
  private async extractTextsFromImage(
    imageBuffer: Buffer,
    locale: LocaleId
  ): Promise<ExtractedText[]> {
    const base64Image = imageBuffer.toString("base64");
    const mimeType = this.detectMimeType(imageBuffer);
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const localeMeta = getLocaleMetadata(locale);
    const isRtl = isRtlLocale(locale);

    const localeContext = isRtl
      ? `The image contains ${localeMeta.name} text which is RTL (right-to-left). Read accordingly.`
      : `The image contains ${localeMeta.name} text.`;

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
                detail: "high",
              },
            },
            {
              type: "text",
              text: `${localeContext}\n\n${VERIFICATION_PROMPT}`,
            },
          ],
        },
      ],
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in GPT-4o Vision response");
    }

    const parsed = JSON.parse(content) as RawVerificationResponse;
    return this.transformExtractedTexts(parsed);
  }

  /**
   * Transform raw GPT-4o response to structured extracted texts
   */
  private transformExtractedTexts(raw: RawVerificationResponse): ExtractedText[] {
    return (raw.extractedTexts ?? []).map((item, index) => ({
      text: item.text ?? "",
      order: item.order ?? index + 1,
      role: item.role ?? "other",
    }));
  }

  /**
   * Match extracted texts to expected translations
   */
  private matchTexts(
    expected: TranslatedText[],
    actual: ExtractedText[]
  ): VerificationMatch[] {
    const matches: VerificationMatch[] = [];

    // Sort both by order for position-based matching
    const sortedExpected = [...expected].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const sortedActual = [...actual].sort((a, b) => a.order - b.order);

    // For each expected translation, find the best matching actual text
    for (let i = 0; i < sortedExpected.length; i++) {
      const exp = sortedExpected[i]!;

      // First try position-based match
      let bestMatch: ExtractedText | undefined = sortedActual[i];
      let bestSimilarity = bestMatch
        ? calculateSimilarity(exp.translated, bestMatch.text)
        : 0;

      // If position match is poor, try to find a better match
      if (bestSimilarity < PARTIAL_THRESHOLD) {
        for (const act of sortedActual) {
          const similarity = calculateSimilarity(exp.translated, act.text);
          if (similarity > bestSimilarity) {
            bestMatch = act;
            bestSimilarity = similarity;
          }
        }
      }

      if (bestMatch) {
        matches.push({
          expected: exp.translated,
          actual: bestMatch.text,
          similarity: bestSimilarity,
          status: getMatchStatus(bestSimilarity),
          role: exp.role,
          order: exp.order,
        });
      } else {
        // No match found - missing
        matches.push({
          expected: exp.translated,
          actual: "",
          similarity: 0,
          status: "missing",
          role: exp.role,
          order: exp.order,
        });
      }
    }

    return matches;
  }

  /**
   * Calculate overall accuracy from match results
   */
  private calculateOverallAccuracy(matches: VerificationMatch[]): number {
    if (matches.length === 0) return 100; // No texts to verify = 100%

    const totalSimilarity = matches.reduce((sum, m) => sum + m.similarity, 0);
    return totalSimilarity / matches.length;
  }

  /**
   * Detect MIME type from buffer magic bytes
   */
  private detectMimeType(buffer: Buffer): string {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
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
    return "image/png";
  }

  /**
   * Create a failed verification result for error cases
   */
  private createFailedResult(
    locale: LocaleId,
    expected: TranslatedText[],
    errorReason: string
  ): VerificationResult {
    return {
      locale,
      expectedTexts: expected.map((t) => t.translated),
      actualTexts: [],
      accuracy: 0,
      matches: expected.map((t) => ({
        expected: t.translated,
        actual: `[Error: ${errorReason}]`,
        similarity: 0,
        status: "missing" as const,
        role: t.role,
        order: t.order,
      })),
      overallStatus: "fail",
      verifiedAt: new Date(),
    };
  }
}

// =============================================================================
// Internal Types
// =============================================================================

interface ExtractedText {
  text: string;
  order: number;
  role: string;
}

interface RawVerificationResponse {
  extractedTexts?: Array<{
    text?: string;
    order?: number;
    role?: string;
  }>;
  readingConfidence?: number;
  notes?: string;
}

// =============================================================================
// Factory (Dependency Inversion: depend on abstraction via factory)
// =============================================================================

let serviceInstance: VerificationService | null = null;

/**
 * Get the Verification Service instance (singleton)
 */
export function getVerificationService(): VerificationService {
  if (!serviceInstance) {
    serviceInstance = new VerificationService();
  }
  return serviceInstance;
}

/**
 * Create a new Verification Service instance (for testing)
 */
export function createVerificationService(): VerificationService {
  return new VerificationService();
}
