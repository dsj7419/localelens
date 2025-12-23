/**
 * Streaming Variant Generation API Endpoint
 *
 * Server-Sent Events (SSE) endpoint for streaming image generation.
 * Demonstrates world-class use of gpt-image-1.5's streaming capability.
 *
 * This endpoint showcases:
 * - Real-time partial image streaming
 * - Progressive image reveal for better UX
 * - Token usage reporting
 *
 * @route POST /api/variant/stream
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";
import {
  PrismaProjectRepository,
  PrismaMaskRepository,
  PrismaVariantRepository,
  PrismaImageAnalysisRepository,
} from "~/server/infrastructure/repositories/prisma.project.repository";
import { createFileStore } from "~/server/services/fileStore";
import { getOpenAIImageService } from "~/server/services/openaiImage";
import { getLocalePlanService } from "~/server/domain/services/localePlan.service";
import { getVariantGenerationService } from "~/server/domain/services/variantGeneration.service";
import { getImageProcessingService } from "~/server/services/imageProcessingService";
import { getTextDetectionService, type ImageAnalysis, type TextRegion } from "~/server/services/textDetectionService";
import { getTranslationService } from "~/server/services/translationService";
import { getDynamicPromptBuilder } from "~/server/domain/services/dynamicPromptBuilder";
import { getPromptEngineeringService } from "~/server/services/promptEngineeringService";
import { SUPPORTED_LOCALES, type LocaleId, getLocaleMetadata } from "~/server/domain/value-objects/locale";
import type { StreamingEvent } from "~/server/services/openaiImage";

// Request validation schema
const streamingRequestSchema = z.object({
  projectId: z.string().cuid(),
  locale: z.enum(SUPPORTED_LOCALES),
  pixelPerfect: z.boolean().default(true),
  partialImages: z.number().min(0).max(3).default(2),
  visionMode: z.boolean().default(true), // Enable Vision pipeline by default
  enhancedPrompt: z.boolean().default(true), // Use PromptEngineeringService (Sprint 10)
});

/**
 * SSE Event Types for client consumption
 */
interface SSEEvent {
  type: "start" | "partial" | "processing" | "complete" | "error";
  data: Record<string, unknown>;
}

/**
 * Helper to format SSE event
 */
function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/**
 * POST /api/variant/stream
 *
 * Streams image generation with partial images.
 * Returns SSE events for real-time UI updates.
 */
export async function POST(request: NextRequest) {
  // Create SSE encoder
  const encoder = new TextEncoder();

  // Parse and validate request
  let input: z.infer<typeof streamingRequestSchema>;
  try {
    const body = await request.json();
    input = streamingRequestSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body", details: error instanceof Error ? error.message : "Unknown" },
      { status: 400 }
    );
  }

  const { projectId, locale, pixelPerfect, partialImages, visionMode, enhancedPrompt } = input;

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      try {
        // Send start event
        send({
          type: "start",
          data: {
            projectId,
            locale,
            localeName: getLocaleMetadata(locale).name,
            partialImages,
            pixelPerfect,
            visionMode,
            enhancedPrompt,
            timestamp: Date.now(),
          },
        });

        // Load dependencies
        const projectRepo = new PrismaProjectRepository(db);
        const maskRepo = new PrismaMaskRepository(db);
        const variantRepo = new PrismaVariantRepository(db);
        const imageAnalysisRepo = new PrismaImageAnalysisRepository(db);
        const fileStore = createFileStore(projectId);
        const imageService = getOpenAIImageService();
        const localePlanService = getLocalePlanService();
        const variantGenService = getVariantGenerationService();
        const imageProcessingService = getImageProcessingService();

        // Vision pipeline services (loaded when needed)
        const textDetectionService = visionMode ? getTextDetectionService() : null;
        const translationService = visionMode ? getTranslationService() : null;
        const dynamicPromptBuilder = visionMode ? getDynamicPromptBuilder() : null;
        const promptEngineeringService = (visionMode && enhancedPrompt) ? getPromptEngineeringService() : null;

        // Validate project
        const project = await projectRepo.findById(projectId);
        if (!project) {
          send({ type: "error", data: { error: "Project not found" } });
          controller.close();
          return;
        }

        const mask = await maskRepo.findByProjectId(projectId);
        if (!mask) {
          send({ type: "error", data: { error: "No mask found for project" } });
          controller.close();
          return;
        }

        // Load images
        const baseImageBuffer = await fileStore.getBaseImage();
        if (!baseImageBuffer) {
          send({ type: "error", data: { error: "Base image not found" } });
          controller.close();
          return;
        }

        const maskBuffer = await fileStore.getMaskImage();
        if (!maskBuffer) {
          send({ type: "error", data: { error: "Mask image not found" } });
          controller.close();
          return;
        }

        // Get original dimensions for post-resize
        const dimensionsResult = await imageProcessingService.getDimensions(baseImageBuffer);
        const originalDimensions = dimensionsResult.success ? dimensionsResult.dimensions : null;

        // Build prompt - use Vision pipeline if enabled
        let prompt: string;
        let visionPipelineUsed = false;
        let enhancedPromptUsed = false;

        if (visionMode && textDetectionService && translationService) {
          // Vision Pipeline: Analyze → Translate → Build Prompt
          send({
            type: "processing",
            data: {
              stage: "vision",
              message: "Analyzing image with Vision...",
            },
          });

          // Step 1: Get or create image analysis
          let analysis: ImageAnalysis;
          const existingAnalysis = await imageAnalysisRepo.findByProjectId(projectId);

          if (existingAnalysis) {
            console.log(`[StreamingAPI] Vision: Using existing analysis`);
            analysis = {
              textRegions: JSON.parse(existingAnalysis.textRegions) as TextRegion[],
              layout: existingAnalysis.layout as ImageAnalysis["layout"],
              surfaceTexture: existingAnalysis.surfaceTexture,
              dominantColors: JSON.parse(existingAnalysis.dominantColors) as string[],
              hasUIElements: existingAnalysis.hasUIElements,
              uiElements: existingAnalysis.uiElements
                ? (JSON.parse(existingAnalysis.uiElements) as string[])
                : undefined,
              imageDescription: existingAnalysis.imageDescription,
              analyzedAt: existingAnalysis.analyzedAt,
            };
          } else {
            console.log(`[StreamingAPI] Vision: Running new analysis`);
            analysis = await textDetectionService.analyzeImage(baseImageBuffer);

            // Store analysis for future use
            await imageAnalysisRepo.upsert({
              projectId,
              textRegions: JSON.stringify(analysis.textRegions),
              layout: analysis.layout,
              surfaceTexture: analysis.surfaceTexture,
              dominantColors: JSON.stringify(analysis.dominantColors),
              hasUIElements: analysis.hasUIElements,
              uiElements: analysis.uiElements ? JSON.stringify(analysis.uiElements) : undefined,
              imageDescription: analysis.imageDescription,
            });
          }

          // Step 2: Translate detected text
          send({
            type: "processing",
            data: {
              stage: "translation",
              message: `Translating to ${getLocaleMetadata(locale).name}...`,
            },
          });

          const translationResult = await translationService.translateTexts({
            textRegions: analysis.textRegions,
            targetLocale: locale,
            context: {
              imageType: analysis.layout,
              tone: "neutral",
            },
          });

          if (!translationResult.success) {
            throw new Error(`Translation failed: ${translationResult.error}`);
          }

          // Step 3: Build prompt (use PromptEngineeringService if enabled, fallback to DynamicPromptBuilder)
          send({
            type: "processing",
            data: {
              stage: "prompt",
              message: enhancedPrompt ? "GPT-4o engineering prompt..." : "Building prompt...",
            },
          });

          if (enhancedPrompt && promptEngineeringService) {
            // Sprint 10: GPT-4o writes prompts for gpt-image-1.5
            try {
              const engineeredResult = await promptEngineeringService.engineerPrompt({
                analysis,
                translations: translationResult.translations,
                locale,
                imageBuffer: baseImageBuffer,
                enhancedMode: true,
              });

              if (engineeredResult.prompt && engineeredResult.confidence > 0.5) {
                prompt = engineeredResult.prompt;
                enhancedPromptUsed = true;
                console.log(`[StreamingAPI] Vision: Using AI-engineered prompt (confidence: ${engineeredResult.confidence})`);
              } else {
                // Fallback to dynamic builder
                if (dynamicPromptBuilder) {
                  const promptResult = dynamicPromptBuilder.buildPrompt({
                    analysis,
                    translations: translationResult.translations,
                    locale,
                  });
                  prompt = promptResult.prompt;
                } else {
                  prompt = localePlanService.buildPrompt(locale);
                }
                console.log(`[StreamingAPI] Vision: Fallback to template prompt (low confidence)`);
              }
            } catch (err) {
              // Fallback on error
              console.error(`[StreamingAPI] PromptEngineeringService error:`, err);
              if (dynamicPromptBuilder) {
                const promptResult = dynamicPromptBuilder.buildPrompt({
                  analysis,
                  translations: translationResult.translations,
                  locale,
                });
                prompt = promptResult.prompt;
              } else {
                prompt = localePlanService.buildPrompt(locale);
              }
            }
          } else if (dynamicPromptBuilder) {
            const promptResult = dynamicPromptBuilder.buildPrompt({
              analysis,
              translations: translationResult.translations,
              locale,
            });
            prompt = promptResult.prompt;
            console.log(`[StreamingAPI] Vision: Using dynamic template prompt`);
          } else {
            prompt = localePlanService.buildPrompt(locale);
          }

          visionPipelineUsed = true;
          console.log(
            `[StreamingAPI] Vision pipeline: ${analysis.textRegions.length} regions, ${translationResult.translations.length} translations`
          );
        } else {
          // Legacy: Use hardcoded prompts
          prompt = localePlanService.buildPrompt(locale);
          console.log(`[StreamingAPI] Using legacy prompt builder`);
        }

        console.log(`[StreamingAPI] Starting streaming generation for ${locale} (vision: ${visionPipelineUsed}, enhanced: ${enhancedPromptUsed})`);

        // Stream the image generation
        const streamingResult = await imageService.editImageStreaming({
          prompt,
          imageBuffer: baseImageBuffer,
          maskBuffer,
          partialImages,
          onEvent: (event: StreamingEvent) => {
            if (event.type === "image_edit.partial_image") {
              // Send partial image to client
              send({
                type: "partial",
                data: {
                  index: event.partial_image_index,
                  imageBase64: `data:image/png;base64,${event.b64_json}`,
                  timestamp: Date.now(),
                },
              });
            }
          },
        });

        if (!streamingResult.success || !streamingResult.imageBuffer) {
          send({ type: "error", data: { error: streamingResult.error ?? "Streaming failed" } });
          controller.close();
          return;
        }

        // Send processing event (post-processing starts)
        send({
          type: "processing",
          data: {
            stage: "resize",
            message: "Adjusting dimensions to match original...",
          },
        });

        // Resize to original dimensions if needed
        let processedBuffer = streamingResult.imageBuffer;
        let dimensionsAdjusted = false;

        if (originalDimensions) {
          const outputDims = await imageProcessingService.getDimensions(streamingResult.imageBuffer);
          if (outputDims.success && outputDims.dimensions) {
            if (
              outputDims.dimensions.width !== originalDimensions.width ||
              outputDims.dimensions.height !== originalDimensions.height
            ) {
              const resizeResult = await imageProcessingService.resizeToMatch(
                streamingResult.imageBuffer,
                originalDimensions
              );
              if (resizeResult.success && resizeResult.buffer) {
                processedBuffer = resizeResult.buffer;
                dimensionsAdjusted = true;
              }
            }
          }
        }

        // Process and save variant (handles pixel-perfect, drift, etc.)
        send({
          type: "processing",
          data: {
            stage: "composite",
            message: pixelPerfect
              ? "Applying pixel-perfect composite..."
              : "Computing drift score...",
          },
        });

        const processResult = await variantGenService.processVariant(
          {
            projectId,
            locale,
            prompt,
            variantBuffer: processedBuffer,
            baseImageBuffer,
            maskBuffer,
            modelUsed: streamingResult.modelUsed ?? null,
            pixelPerfect,
          },
          fileStore,
          variantRepo
        );

        if (!processResult.success) {
          send({ type: "error", data: { error: processResult.error ?? "Processing failed" } });
          controller.close();
          return;
        }

        // Send complete event with final image
        const finalImageBase64 = processResult.imageBuffer?.toString("base64") ?? "";

        send({
          type: "complete",
          data: {
            variant: processResult.variant,
            imageBase64: `data:image/png;base64,${finalImageBase64}`,
            modelUsed: streamingResult.modelUsed,
            driftScore: processResult.driftScore,
            driftStatus: processResult.driftStatus,
            pixelPerfectApplied: processResult.pixelPerfectApplied,
            dimensionsAdjusted,
            usage: streamingResult.usage,
            partialImagesReceived: streamingResult.partialImages?.length ?? 0,
            timestamp: Date.now(),
          },
        });

        console.log(`[StreamingAPI] Streaming generation complete for ${locale}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[StreamingAPI] Error:", errorMessage);
        send({ type: "error", data: { error: errorMessage } });
      } finally {
        controller.close();
      }
    },
  });

  // Return SSE response
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

/**
 * GET handler for SSE connection test
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/variant/stream",
    method: "POST",
    description: "Streaming variant generation with partial images",
    contentType: "text/event-stream",
    events: {
      start: "Generation started, includes metadata",
      partial: "Partial image received from gpt-image-1.5",
      processing: "Post-processing stage update",
      complete: "Final variant with drift score",
      error: "Error occurred during generation",
    },
    requestSchema: {
      projectId: "string (CUID)",
      locale: SUPPORTED_LOCALES,
      pixelPerfect: "boolean (default: true)",
      partialImages: "number 0-3 (default: 2)",
    },
  });
}
