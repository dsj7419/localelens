import OpenAI from "openai";
import { env } from "~/env";
import { toFile } from "openai/uploads";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/** Supported image sizes for OpenAI API */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

/** Supported quality levels */
export type ImageQuality = "low" | "medium" | "high" | "auto";

/** Demo-specific size for 1080x1920 portrait assets */
export const DEMO_EDIT_SIZE: ImageSize = "1024x1536";

export interface GenerateImageOptions {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
}

export interface EditImageOptions {
  prompt: string;
  imageBuffer: Buffer;
  maskBuffer: Buffer;
  size?: ImageSize;
}

export interface ImageServiceResult {
  success: boolean;
  imageBuffer?: Buffer;
  error?: string;
  modelUsed?: string;
  revisedPrompt?: string;
}

/** Interface for image generation capability (ISP) */
export interface IImageGenerator {
  generateImage(options: GenerateImageOptions): Promise<ImageServiceResult>;
}

/** Interface for image editing capability (ISP) */
export interface IImageEditor {
  editImage(options: EditImageOptions): Promise<ImageServiceResult>;
}

// =============================================================================
// OpenAI Image Service (Single Responsibility: OpenAI API interactions)
// =============================================================================

/**
 * OpenAI Image Service
 *
 * Handles all OpenAI image generation and editing operations.
 * Server-side only - never expose to client.
 *
 * Security invariants:
 * - API key is loaded from server-side env only
 * - No client-side instantiation possible
 * - No headers or config returned that could leak the key
 */
export class OpenAIImageService implements IImageGenerator, IImageEditor {
  private readonly client: OpenAI;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;

  constructor() {
    // Server-side only: env.OPENAI_API_KEY is never exposed to client
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    this.primaryModel = env.IMAGE_MODEL;
    this.fallbackModel = env.IMAGE_MODEL_FALLBACK;
  }

  /**
   * Get the configured models for logging/debugging
   */
  getModelConfig(): { primary: string; fallback: string } {
    return {
      primary: this.primaryModel,
      fallback: this.fallbackModel,
    };
  }

  /**
   * Generate a new image from a prompt
   */
  async generateImage(options: GenerateImageOptions): Promise<ImageServiceResult> {
    const { prompt, size = "1024x1024", quality = "high" } = options;

    try {
      const response = await this.client.images.generate({
        model: this.primaryModel,
        prompt,
        n: 1,
        size,
        quality,
        response_format: "b64_json",
      });

      return await this.extractImageFromResponse(response, this.primaryModel);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[OpenAIImageService] Generate failed:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Edit an existing image using a mask
   *
   * Uses model fallback: tries primary model first, then fallback if it fails.
   * For demo consistency, use DEMO_EDIT_SIZE (1024x1536) for portrait assets.
   */
  async editImage(options: EditImageOptions): Promise<ImageServiceResult> {
    const { prompt, imageBuffer, maskBuffer, size = DEMO_EDIT_SIZE } = options;

    // Build list of models to try (dedupe if same)
    const modelsToTry = this.getModelsToTry();

    for (const model of modelsToTry) {
      const result = await this.tryEditWithModel(
        model,
        prompt,
        imageBuffer,
        maskBuffer,
        size
      );

      if (result.success) {
        return result;
      }
    }

    return {
      success: false,
      error: `Image edit failed with all models: ${modelsToTry.join(", ")}`,
    };
  }

  /**
   * Generate a simple test image to verify the API is working
   */
  async testGenerate(): Promise<ImageServiceResult> {
    return this.generateImage({
      prompt:
        "A simple, clean test pattern with the text 'LocaleLens Test' in a modern sans-serif font, centered on a gradient background from blue to purple. Minimalist design.",
      size: "1024x1024",
      quality: "low",
    });
  }

  // ===========================================================================
  // Private Helpers (Single Responsibility: broken into focused methods)
  // ===========================================================================

  private getModelsToTry(): string[] {
    const models = [this.primaryModel, this.fallbackModel];
    // Dedupe if primary === fallback
    return [...new Set(models)];
  }

  private async tryEditWithModel(
    model: string,
    prompt: string,
    imageBuffer: Buffer,
    maskBuffer: Buffer,
    size: ImageSize
  ): Promise<ImageServiceResult> {
    try {
      console.log(`[OpenAIImageService] Attempting edit with model: ${model}`);

      // Convert buffers to File objects for the API
      const imageFile = await toFile(imageBuffer, "image.png", {
        type: "image/png",
      });
      const maskFile = await toFile(maskBuffer, "mask.png", {
        type: "image/png",
      });

      const response = await this.client.images.edit({
        model,
        image: imageFile,
        mask: maskFile,
        prompt,
        n: 1,
        size,
        response_format: "b64_json",
      });

      const result = await this.extractImageFromResponse(response, model);

      if (result.success) {
        console.log(`[OpenAIImageService] Edit successful with model: ${model}`);
      } else {
        console.warn(`[OpenAIImageService] No valid image data from ${model}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[OpenAIImageService] Edit failed with ${model}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private async extractImageFromResponse(
    response: OpenAI.Images.ImagesResponse,
    modelUsed: string
  ): Promise<ImageServiceResult> {
    const imageData = response.data?.[0];

    if (!imageData) {
      return { success: false, error: "No image data returned" };
    }

    // Prefer b64_json (avoids URL fetch variability)
    if (imageData.b64_json) {
      return {
        success: true,
        imageBuffer: Buffer.from(imageData.b64_json, "base64"),
        modelUsed,
        revisedPrompt: imageData.revised_prompt,
      };
    }

    // Fallback to URL fetch
    if (imageData.url) {
      return await this.fetchImageFromUrl(imageData.url, modelUsed, imageData.revised_prompt);
    }

    return { success: false, error: "No image URL or base64 data returned" };
  }

  private async fetchImageFromUrl(
    url: string,
    modelUsed: string,
    revisedPrompt?: string
  ): Promise<ImageServiceResult> {
    try {
      const imageResponse = await fetch(url);
      const arrayBuffer = await imageResponse.arrayBuffer();
      return {
        success: true,
        imageBuffer: Buffer.from(arrayBuffer),
        modelUsed,
        revisedPrompt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "URL fetch failed";
      return { success: false, error: errorMessage };
    }
  }
}

// =============================================================================
// Factory (Dependency Inversion: depend on abstraction via factory)
// =============================================================================

let serviceInstance: OpenAIImageService | null = null;

/**
 * Get the OpenAI Image Service instance (singleton)
 *
 * Note: Singleton is acceptable for v1. If per-request configuration
 * is needed later, convert to factory pattern with config injection.
 */
export function getOpenAIImageService(): OpenAIImageService {
  if (!serviceInstance) {
    serviceInstance = new OpenAIImageService();
  }
  return serviceInstance;
}

/**
 * Create a new OpenAI Image Service instance (for testing or custom config)
 */
export function createOpenAIImageService(): OpenAIImageService {
  return new OpenAIImageService();
}
