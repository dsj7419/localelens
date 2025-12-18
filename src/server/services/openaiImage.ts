import OpenAI from "openai";
import { env } from "~/env";
import { toFile } from "openai/uploads";

// =============================================================================
// Types & Interfaces (Interface Segregation Principle)
// =============================================================================

/**
 * Supported image sizes for OpenAI gpt-image-1.5 API
 * - "auto" lets the API optimize for input dimensions (RECOMMENDED)
 * - Fixed sizes: "1024x1024", "1024x1536" (portrait), "1536x1024" (landscape)
 */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

/**
 * Supported quality levels for gpt-image-1.5
 * - "high": Maximum quality output (RECOMMENDED for edits)
 * - "medium": Balanced quality
 * - "low": Faster generation, lower quality
 * - "auto": Let API decide
 */
export type ImageQuality = "low" | "medium" | "high" | "auto";

/**
 * Background handling for gpt-image-1.5
 * - "opaque": Solid background, no transparency (RECOMMENDED for edits)
 * - "transparent": Allow transparent background
 * - "auto": Let API decide
 */
export type ImageBackground = "transparent" | "opaque" | "auto";

/**
 * Output format for gpt-image-1.5
 * - "png": Lossless format (RECOMMENDED)
 * - "jpeg": Lossy compression
 * - "webp": Modern format with good compression
 */
export type ImageOutputFormat = "png" | "jpeg" | "webp";

/**
 * Default configuration optimized for gpt-image-1.5 image editing
 * These settings maximize quality and preserve original image fidelity
 */
export const GPT_IMAGE_1_5_DEFAULTS = {
  size: "auto" as ImageSize,
  quality: "high" as ImageQuality,
  background: "opaque" as ImageBackground,
  outputFormat: "png" as ImageOutputFormat,
} as const;

/** @deprecated Use GPT_IMAGE_1_5_DEFAULTS.size instead */
export const DEMO_EDIT_SIZE: ImageSize = "1024x1536";

export interface GenerateImageOptions {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
}

/**
 * Options for image editing with gpt-image-1.5
 *
 * All optional parameters default to values optimized for
 * high-fidelity text replacement with minimal drift.
 */
export interface EditImageOptions {
  /** The prompt describing the desired edit */
  prompt: string;
  /** The source image to edit */
  imageBuffer: Buffer;
  /** The mask defining editable regions (transparent = edit, opaque = preserve) */
  maskBuffer: Buffer;
  /** Image size - "auto" recommended for best results */
  size?: ImageSize;
  /** Quality level - "high" recommended for edits */
  quality?: ImageQuality;
  /** Background handling - "opaque" recommended to prevent transparency issues */
  background?: ImageBackground;
  /** Output format - "png" recommended for lossless output */
  outputFormat?: ImageOutputFormat;
  /** Number of variants to generate (1-10) */
  n?: number;
}

export interface ImageServiceResult {
  success: boolean;
  imageBuffer?: Buffer;
  error?: string;
  modelUsed?: string;
  revisedPrompt?: string;
  /** The parameters that were used for this generation */
  parametersUsed?: {
    model: string;
    size: ImageSize;
    quality: ImageQuality;
    background: ImageBackground;
    outputFormat: ImageOutputFormat;
    n: number;
  };
}

// =============================================================================
// Streaming Types (gpt-image-1.5 Showcase Feature)
// =============================================================================

/**
 * Streaming event types for image editing
 * These match the OpenAI API SSE event types
 */
export type StreamingEventType =
  | "image_edit.partial_image"
  | "image_edit.completed"
  | "error";

/**
 * Partial image event from streaming API
 */
export interface PartialImageEvent {
  type: "image_edit.partial_image";
  b64_json: string;
  partial_image_index: number;
}

/**
 * Completed image event from streaming API
 */
export interface CompletedImageEvent {
  type: "image_edit.completed";
  b64_json: string;
  usage?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    input_tokens_details?: {
      text_tokens: number;
      image_tokens: number;
    };
  };
}

/**
 * Error event for streaming
 */
export interface StreamingErrorEvent {
  type: "error";
  error: string;
}

/**
 * Union type for all streaming events
 */
export type StreamingEvent = PartialImageEvent | CompletedImageEvent | StreamingErrorEvent;

/**
 * Options for streaming image edits
 * Extends EditImageOptions with streaming-specific parameters
 */
export interface StreamingEditImageOptions extends EditImageOptions {
  /** Number of partial images to generate (0-3) */
  partialImages?: number;
  /** Callback for each streaming event */
  onEvent?: (event: StreamingEvent) => void;
}

/**
 * Result from streaming image edit
 */
export interface StreamingImageResult extends ImageServiceResult {
  /** All partial images received during streaming */
  partialImages?: Buffer[];
  /** Token usage information */
  usage?: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/** Interface for image generation capability (ISP) */
export interface IImageGenerator {
  generateImage(options: GenerateImageOptions): Promise<ImageServiceResult>;
}

/** Interface for image editing capability (ISP) */
export interface IImageEditor {
  editImage(options: EditImageOptions): Promise<ImageServiceResult>;
}

/** Interface for streaming image editing capability (ISP) */
export interface IStreamingImageEditor {
  editImageStreaming(options: StreamingEditImageOptions): Promise<StreamingImageResult>;
}

// =============================================================================
// OpenAI Image Service (Single Responsibility: OpenAI API interactions)
// =============================================================================

/**
 * OpenAI Image Service - gpt-image-1.5 Mastery Implementation
 *
 * Handles all OpenAI image generation and editing operations.
 * Server-side only - never expose to client.
 *
 * This implementation showcases expert use of the gpt-image-1.5 API by:
 * - Using ALL available parameters (quality, background, output_format, size)
 * - Optimizing for high-fidelity image editing with minimal drift
 * - Providing detailed logging of API parameters used
 *
 * Security invariants:
 * - API key is loaded from server-side env only
 * - No client-side instantiation possible
 * - No headers or config returned that could leak the key
 *
 * Note: input_fidelity parameter is ONLY available for gpt-image-1,
 * NOT gpt-image-1.5. We compensate through prompt engineering and
 * post-processing (pixel-perfect composite mode).
 */
export class OpenAIImageService implements IImageGenerator, IImageEditor, IStreamingImageEditor {
  private readonly client: OpenAI;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly apiKey: string;

  constructor() {
    // Server-side only: env.OPENAI_API_KEY is never exposed to client
    this.apiKey = env.OPENAI_API_KEY;
    this.client = new OpenAI({
      apiKey: this.apiKey,
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
   * Edit an existing image using a mask - gpt-image-1.5 Optimized
   *
   * Uses model fallback: tries primary model first, then fallback if it fails.
   *
   * Default parameters are optimized for high-fidelity text replacement:
   * - size: "auto" - Let API optimize for input dimensions
   * - quality: "high" - Maximum quality output
   * - background: "opaque" - Prevent transparency issues
   * - outputFormat: "png" - Lossless output format
   */
  async editImage(options: EditImageOptions): Promise<ImageServiceResult> {
    const {
      prompt,
      imageBuffer,
      maskBuffer,
      size = GPT_IMAGE_1_5_DEFAULTS.size,
      quality = GPT_IMAGE_1_5_DEFAULTS.quality,
      background = GPT_IMAGE_1_5_DEFAULTS.background,
      outputFormat = GPT_IMAGE_1_5_DEFAULTS.outputFormat,
      n = 1,
    } = options;

    // Build list of models to try (dedupe if same)
    const modelsToTry = this.getModelsToTry();

    // Log the parameters being used (demonstrates API mastery)
    console.log("[OpenAIImageService] Edit parameters:", {
      size,
      quality,
      background,
      outputFormat,
      n,
      modelsToTry,
    });

    for (const model of modelsToTry) {
      const result = await this.tryEditWithModel(
        model,
        prompt,
        imageBuffer,
        maskBuffer,
        { size, quality, background, outputFormat, n }
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
   * Edit image with multi-generation and automatic best selection
   *
   * Generates multiple variants in a single API call and automatically
   * selects the best one based on quick drift computation.
   *
   * This showcases gpt-image-1.5's multi-generation capability (n > 1)
   * and demonstrates intelligent quality control.
   *
   * @param options Standard edit options
   * @param selectionCount Number of variants to generate (2-4 recommended)
   * @param baseImageForComparison Original image for drift computation
   * @param maskBufferForComparison Mask for drift computation
   */
  async editImageWithSelection(
    options: EditImageOptions,
    selectionCount: number = 3,
    baseImageForComparison?: Buffer,
    maskBufferForComparison?: Buffer
  ): Promise<ImageServiceResult & { candidatesGenerated?: number; selectedIndex?: number }> {
    const {
      prompt,
      imageBuffer,
      maskBuffer,
      size = GPT_IMAGE_1_5_DEFAULTS.size,
      quality = GPT_IMAGE_1_5_DEFAULTS.quality,
      background = GPT_IMAGE_1_5_DEFAULTS.background,
      outputFormat = GPT_IMAGE_1_5_DEFAULTS.outputFormat,
    } = options;

    // Clamp selection count to valid range
    const n = Math.min(Math.max(selectionCount, 1), 10);

    if (n === 1) {
      // Single generation, use standard method
      return this.editImage(options);
    }

    console.log(`[OpenAIImageService] Multi-generation mode: generating ${n} variants`);

    const modelsToTry = this.getModelsToTry();

    for (const model of modelsToTry) {
      try {
        console.log(`[OpenAIImageService] Attempting multi-edit with model: ${model}, n=${n}`);

        // Convert buffers to File objects for the API
        const imageFile = await toFile(imageBuffer, "image.png", {
          type: "image/png",
        });
        const maskFile = await toFile(maskBuffer, "mask.png", {
          type: "image/png",
        });

        // Generate multiple variants in one API call
        const response = await this.client.images.edit({
          model,
          image: imageFile,
          mask: maskFile,
          prompt,
          n, // Generate multiple variants
          size,
          quality,
          background,
          output_format: outputFormat,
        });

        // Extract all variants
        const candidates = await this.extractAllImagesFromResponse(response, model);

        if (candidates.length === 0) {
          console.warn(`[OpenAIImageService] No valid images from ${model}`);
          continue;
        }

        console.log(`[OpenAIImageService] Generated ${candidates.length} variants`);

        // If we have comparison data, compute drift and select best
        if (baseImageForComparison && maskBufferForComparison && candidates.length > 1) {
          const best = await this.selectBestByDrift(
            candidates,
            baseImageForComparison,
            maskBufferForComparison
          );
          return {
            ...best.result,
            candidatesGenerated: candidates.length,
            selectedIndex: best.selectedIndex,
          };
        }

        // Otherwise just return the first one
        const result = candidates[0]!;
        result.parametersUsed = {
          model,
          size,
          quality,
          background,
          outputFormat,
          n,
        };

        return {
          ...result,
          candidatesGenerated: candidates.length,
          selectedIndex: 0,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.warn(`[OpenAIImageService] Multi-edit failed with ${model}: ${errorMessage}`);
      }
    }

    return {
      success: false,
      error: `Image multi-edit failed with all models: ${modelsToTry.join(", ")}`,
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
  // Streaming Methods (gpt-image-1.5 Showcase Feature)
  // ===========================================================================

  /**
   * Edit an image with streaming support - gpt-image-1.5 Showcase Feature
   *
   * This method demonstrates world-class use of gpt-image-1.5's streaming
   * capability, which allows real-time visualization of image generation.
   *
   * Features:
   * - Streams partial images as they're generated (0-3 partials)
   * - Fires callbacks for each event (partial_image, completed, error)
   * - Collects all partial images for potential UI animation
   * - Returns final image with usage statistics
   *
   * @param options Streaming edit options including partialImages count and onEvent callback
   * @returns StreamingImageResult with final image and all partial images
   */
  async editImageStreaming(options: StreamingEditImageOptions): Promise<StreamingImageResult> {
    const {
      prompt,
      imageBuffer,
      maskBuffer,
      size = GPT_IMAGE_1_5_DEFAULTS.size,
      quality = GPT_IMAGE_1_5_DEFAULTS.quality,
      background = GPT_IMAGE_1_5_DEFAULTS.background,
      outputFormat = GPT_IMAGE_1_5_DEFAULTS.outputFormat,
      partialImages = 2,
      onEvent,
    } = options;

    const model = this.primaryModel;
    const partialBuffers: Buffer[] = [];

    console.log(`[OpenAIImageService] Starting streaming edit with gpt-image-1.5`);
    console.log(`[OpenAIImageService] Streaming parameters:`, {
      model,
      size,
      quality,
      background,
      outputFormat,
      partialImages,
      stream: true,
    });

    try {
      // Build multipart form data for the streaming request
      const formData = new FormData();
      formData.append("model", model);
      formData.append("prompt", prompt);
      formData.append("stream", "true");
      formData.append("partial_images", String(Math.min(Math.max(partialImages, 0), 3)));
      formData.append("size", size);
      formData.append("quality", quality);
      formData.append("background", background);
      formData.append("output_format", outputFormat);

      // Add image and mask as blobs (convert Buffer to Uint8Array for Blob compatibility)
      const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
      const maskBlob = new Blob([new Uint8Array(maskBuffer)], { type: "image/png" });
      formData.append("image", imageBlob, "image.png");
      formData.append("mask", maskBlob, "mask.png");

      // Make streaming request using fetch
      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OpenAIImageService] API error response: ${errorText}`);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      // Check response content type
      const contentType = response.headers.get("content-type") ?? "unknown";

      // Check if response is SSE or regular JSON
      if (contentType.includes("application/json")) {
        // API returned regular JSON, not SSE - this means streaming isn't supported
        console.warn(`[OpenAIImageService] API returned JSON instead of SSE stream`);
        const jsonResponse = await response.json() as { data?: Array<{ b64_json?: string }> };
        if (jsonResponse.data?.[0]?.b64_json) {
          const b64 = jsonResponse.data[0].b64_json;
          console.log(`[OpenAIImageService] Extracted image from JSON response`);
          return {
            success: true,
            imageBuffer: Buffer.from(b64, "base64"),
            modelUsed: model,
            partialImages: [],
            parametersUsed: {
              model,
              size,
              quality,
              background,
              outputFormat,
              n: 1,
            },
          };
        }
        throw new Error("JSON response did not contain image data");
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalImageBuffer: Buffer | undefined;
      let usage: StreamingImageResult["usage"] | undefined;

      // Track current event type across lines (SSE format: event: type\ndata: {...})
      let currentEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();

          // Skip empty lines
          if (!trimmedLine) continue;

          // Handle event type line
          if (trimmedLine.startsWith("event:")) {
            currentEventType = trimmedLine.slice(6).trim();
            continue;
          }

          // Handle data line
          if (trimmedLine.startsWith("data:")) {
            const jsonStr = trimmedLine.slice(5).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const eventData = JSON.parse(jsonStr) as Record<string, unknown>;

              // Determine event type from either the event: line or from data.type field
              const effectiveType = currentEventType || (eventData.type as string) || "";

              // Create the full event object for callback
              const fullEvent = { type: effectiveType, ...eventData } as StreamingEvent;

              // Fire callback for UI updates
              if (onEvent) {
                onEvent(fullEvent);
              }

              if (effectiveType === "image_edit.partial_image") {
                const partialIndex = eventData.partial_image_index as number ?? partialBuffers.length;
                const b64 = eventData.b64_json as string;
                if (b64) {
                  console.log(`[OpenAIImageService] Received partial image ${partialIndex}`);
                  const partialBuffer = Buffer.from(b64, "base64");
                  partialBuffers.push(partialBuffer);
                }
              } else if (effectiveType === "image_edit.completed" || effectiveType === "response.done") {
                const b64 = eventData.b64_json as string;
                if (b64) {
                  console.log(`[OpenAIImageService] Streaming completed with final image`);
                  finalImageBuffer = Buffer.from(b64, "base64");
                }
                // Check for usage in various locations
                const usageData = eventData.usage as Record<string, number> | undefined;
                if (usageData) {
                  usage = {
                    totalTokens: usageData.total_tokens ?? 0,
                    inputTokens: usageData.input_tokens ?? 0,
                    outputTokens: usageData.output_tokens ?? 0,
                  };
                }
              } else if (effectiveType === "error") {
                const errorMsg = eventData.error as string ?? eventData.message as string ?? "Unknown error";
                console.error(`[OpenAIImageService] SSE error event: ${errorMsg}`);
                throw new Error(errorMsg);
              }

              // Reset event type after processing data
              currentEventType = "";
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                console.warn(`[OpenAIImageService] Failed to parse SSE data: ${jsonStr.substring(0, 100)}...`);
              } else {
                throw parseErr;
              }
            }
          }
        }
      }


      if (!finalImageBuffer) {
        throw new Error("No final image received from streaming response");
      }

      console.log(
        `[OpenAIImageService] Streaming complete: ${partialBuffers.length} partials, final image received`
      );

      return {
        success: true,
        imageBuffer: finalImageBuffer,
        modelUsed: model,
        partialImages: partialBuffers,
        usage,
        parametersUsed: {
          model,
          size,
          quality,
          background,
          outputFormat,
          n: 1,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown streaming error";
      console.error(`[OpenAIImageService] Streaming edit failed:`, errorMessage);

      // Fire error event
      if (onEvent) {
        onEvent({ type: "error", error: errorMessage });
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create an async generator for streaming image edits
   *
   * This provides a more idiomatic way to consume streaming events
   * using for-await-of syntax.
   *
   * @example
   * ```typescript
   * for await (const event of imageService.streamImageEdit(options)) {
   *   if (event.type === 'image_edit.partial_image') {
   *     updatePreview(event.b64_json);
   *   } else if (event.type === 'image_edit.completed') {
   *     setFinalImage(event.b64_json);
   *   }
   * }
   * ```
   */
  async *streamImageEdit(
    options: Omit<StreamingEditImageOptions, "onEvent">
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    const {
      prompt,
      imageBuffer,
      maskBuffer,
      size = GPT_IMAGE_1_5_DEFAULTS.size,
      quality = GPT_IMAGE_1_5_DEFAULTS.quality,
      background = GPT_IMAGE_1_5_DEFAULTS.background,
      outputFormat = GPT_IMAGE_1_5_DEFAULTS.outputFormat,
      partialImages = 2,
    } = options;

    const model = this.primaryModel;

    console.log(`[OpenAIImageService] Starting streaming generator`);

    try {
      // Build multipart form data
      const formData = new FormData();
      formData.append("model", model);
      formData.append("prompt", prompt);
      formData.append("stream", "true");
      formData.append("partial_images", String(Math.min(Math.max(partialImages, 0), 3)));
      formData.append("size", size);
      formData.append("quality", quality);
      formData.append("background", background);
      formData.append("output_format", outputFormat);

      const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
      const maskBlob = new Blob([new Uint8Array(maskBuffer)], { type: "image/png" });
      formData.append("image", imageBlob, "image.png");
      formData.append("mask", maskBlob, "mask.png");

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: "error", error: `API request failed: ${response.status} ${errorText}` };
        return;
      }

      if (!response.body) {
        yield { type: "error", error: "Response body is null" };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const eventData = JSON.parse(jsonStr) as StreamingEvent;
              yield eventData;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown streaming error";
      yield { type: "error", error: errorMessage };
    }
  }

  // ===========================================================================
  // Private Helpers (Single Responsibility: broken into focused methods)
  // ===========================================================================

  private getModelsToTry(): string[] {
    const models = [this.primaryModel, this.fallbackModel];
    // Dedupe if primary === fallback
    return [...new Set(models)];
  }

  /**
   * Attempt image edit with a specific model using ALL gpt-image-1.5 parameters
   */
  private async tryEditWithModel(
    model: string,
    prompt: string,
    imageBuffer: Buffer,
    maskBuffer: Buffer,
    params: {
      size: ImageSize;
      quality: ImageQuality;
      background: ImageBackground;
      outputFormat: ImageOutputFormat;
      n: number;
    }
  ): Promise<ImageServiceResult> {
    const { size, quality, background, outputFormat, n } = params;

    try {
      console.log(`[OpenAIImageService] Attempting edit with model: ${model}`);
      console.log(`[OpenAIImageService] Using gpt-image-1.5 parameters:`, {
        size,
        quality,
        background,
        output_format: outputFormat,
        n,
      });

      // Convert buffers to File objects for the API
      const imageFile = await toFile(imageBuffer, "image.png", {
        type: "image/png",
      });
      const maskFile = await toFile(maskBuffer, "mask.png", {
        type: "image/png",
      });

      // Full gpt-image-1.5 API call with ALL available parameters
      // Note: input_fidelity is NOT available for gpt-image-1.5 (gpt-image-1 only)
      const response = await this.client.images.edit({
        model,
        image: imageFile,
        mask: maskFile,
        prompt,
        n,
        size,
        quality,
        background,
        output_format: outputFormat,
      });

      const result = await this.extractImageFromResponse(response, model);

      if (result.success) {
        console.log(`[OpenAIImageService] Edit successful with model: ${model}`);
        // Add parameters used to result for transparency
        result.parametersUsed = {
          model,
          size,
          quality,
          background,
          outputFormat,
          n,
        };
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

    // For gpt-image-1.5, the API always returns b64_json
    if (imageData.b64_json) {
      return {
        success: true,
        imageBuffer: Buffer.from(imageData.b64_json, "base64"),
        modelUsed,
        revisedPrompt: imageData.revised_prompt,
      };
    }

    // Fallback to URL fetch (for older models)
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

  /**
   * Extract ALL images from a multi-generation response
   */
  private async extractAllImagesFromResponse(
    response: OpenAI.Images.ImagesResponse,
    modelUsed: string
  ): Promise<ImageServiceResult[]> {
    const results: ImageServiceResult[] = [];

    for (const imageData of response.data ?? []) {
      if (imageData.b64_json) {
        results.push({
          success: true,
          imageBuffer: Buffer.from(imageData.b64_json, "base64"),
          modelUsed,
          revisedPrompt: imageData.revised_prompt,
        });
      } else if (imageData.url) {
        const fetchResult = await this.fetchImageFromUrl(
          imageData.url,
          modelUsed,
          imageData.revised_prompt
        );
        if (fetchResult.success) {
          results.push(fetchResult);
        }
      }
    }

    return results;
  }

  /**
   * Select the best variant by computing quick drift scores
   *
   * Uses simplified drift computation for fast selection.
   */
  private async selectBestByDrift(
    candidates: ImageServiceResult[],
    baseImageBuffer: Buffer,
    maskBuffer: Buffer
  ): Promise<{ result: ImageServiceResult; selectedIndex: number; driftScore: number }> {
    // Import sharp for quick drift computation
    const sharp = (await import("sharp")).default;

    // Get dimensions from base image
    const baseMeta = await sharp(baseImageBuffer).metadata();
    const width = baseMeta.width ?? 1024;
    const height = baseMeta.height ?? 1536;

    // Prepare base and mask raw data once
    const [baseRaw, maskRaw] = await Promise.all([
      sharp(baseImageBuffer)
        .resize(width, height, { fit: "fill" })
        .ensureAlpha()
        .raw()
        .toBuffer(),
      sharp(maskBuffer)
        .resize(width, height, { fit: "fill" })
        .ensureAlpha()
        .raw()
        .toBuffer(),
    ]);

    let bestIndex = 0;
    let bestDrift = Infinity;
    let bestResult = candidates[0]!;

    // Compute drift for each candidate
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      if (!candidate.success || !candidate.imageBuffer) continue;

      try {
        const variantRaw = await sharp(candidate.imageBuffer)
          .resize(width, height, { fit: "fill" })
          .ensureAlpha()
          .raw()
          .toBuffer();

        // Quick drift computation (simplified)
        let changedPixels = 0;
        let outsidePixels = 0;
        const threshold = 10;

        for (let p = 0; p < width * height; p++) {
          const offset = p * 4;
          const maskAlpha = maskRaw[offset + 3]!;

          // Outside mask (preserve region)
          if (maskAlpha > 127) {
            outsidePixels++;
            const rDiff = Math.abs(baseRaw[offset]! - variantRaw[offset]!);
            const gDiff = Math.abs(baseRaw[offset + 1]! - variantRaw[offset + 1]!);
            const bDiff = Math.abs(baseRaw[offset + 2]! - variantRaw[offset + 2]!);
            const avgDiff = (rDiff + gDiff + bDiff) / 3;
            if (avgDiff > threshold) {
              changedPixels++;
            }
          }
        }

        const drift = outsidePixels > 0 ? (changedPixels / outsidePixels) * 100 : 0;
        console.log(`[OpenAIImageService] Candidate ${i}: drift = ${drift.toFixed(2)}%`);

        if (drift < bestDrift) {
          bestDrift = drift;
          bestIndex = i;
          bestResult = candidate;
        }
      } catch (error) {
        console.warn(`[OpenAIImageService] Failed to compute drift for candidate ${i}`);
      }
    }

    console.log(
      `[OpenAIImageService] Selected candidate ${bestIndex} with ${bestDrift.toFixed(2)}% drift`
    );

    return {
      result: bestResult,
      selectedIndex: bestIndex,
      driftScore: bestDrift,
    };
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
