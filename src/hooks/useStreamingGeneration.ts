/**
 * useStreamingGeneration Hook
 *
 * React hook for streaming variant generation with gpt-image-1.5.
 * Provides real-time updates as partial images are generated.
 *
 * Features:
 * - Automatic SSE connection management
 * - Partial image collection for progressive reveal
 * - Processing stage tracking
 * - Error handling with recovery
 *
 * @example
 * ```tsx
 * const { generate, isStreaming, partialImages, progress, result } = useStreamingGeneration();
 *
 * // Start streaming generation
 * await generate({ projectId, locale: "es-MX" });
 *
 * // Display partial images as they arrive
 * {partialImages.map((img, i) => <img key={i} src={img} />)}
 * ```
 */

import { useState, useCallback, useRef } from "react";
import type { LocaleId } from "~/server/domain/value-objects/locale";
import type { DriftStatus } from "~/server/domain/value-objects/drift";

// =============================================================================
// Types
// =============================================================================

export interface StreamingGenerationOptions {
  projectId: string;
  locale: LocaleId;
  pixelPerfect?: boolean;
  partialImages?: number;
  visionMode?: boolean; // Enable Vision pipeline (GPT-4o analysis + translation)
  enhancedPrompt?: boolean; // Use PromptEngineeringService (Sprint 10)
}

export interface StreamingProgress {
  stage: "idle" | "connecting" | "streaming" | "processing" | "complete" | "error";
  message?: string;
  partialIndex?: number;
}

export interface StreamingResult {
  variant: {
    id: string;
    locale: LocaleId;
    driftScore: number | null;
    driftStatus: DriftStatus | null;
  };
  imageBase64: string;
  modelUsed?: string;
  driftScore?: number | null;
  driftStatus?: DriftStatus;
  pixelPerfectApplied?: boolean;
  dimensionsAdjusted?: boolean;
  usage?: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
  partialImagesReceived?: number;
}

export interface UseStreamingGenerationReturn {
  /** Start streaming generation */
  generate: (options: StreamingGenerationOptions) => Promise<StreamingResult | null>;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Array of partial images received (base64 data URLs) */
  partialImages: string[];
  /** Current progress state */
  progress: StreamingProgress;
  /** Final result after completion */
  result: StreamingResult | null;
  /** Error message if generation failed */
  error: string | null;
  /** Cancel ongoing generation */
  cancel: () => void;
  /** Reset state for new generation */
  reset: () => void;
}

// =============================================================================
// SSE Event Types (matching server)
// =============================================================================

interface StartEvent {
  type: "start";
  data: {
    projectId: string;
    locale: LocaleId;
    localeName: string;
    partialImages: number;
    pixelPerfect: boolean;
    timestamp: number;
  };
}

interface PartialEvent {
  type: "partial";
  data: {
    index: number;
    imageBase64: string;
    timestamp: number;
  };
}

interface ProcessingEvent {
  type: "processing";
  data: {
    stage: string;
    message: string;
  };
}

interface CompleteEvent {
  type: "complete";
  data: StreamingResult;
}

interface ErrorEvent {
  type: "error";
  data: {
    error: string;
  };
}

type SSEEvent = StartEvent | PartialEvent | ProcessingEvent | CompleteEvent | ErrorEvent;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useStreamingGeneration(): UseStreamingGenerationReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [partialImages, setPartialImages] = useState<string[]>([]);
  const [progress, setProgress] = useState<StreamingProgress>({ stage: "idle" });
  const [result, setResult] = useState<StreamingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setIsStreaming(false);
    setPartialImages([]);
    setProgress({ stage: "idle" });
    setResult(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setProgress({ stage: "idle", message: "Cancelled" });
  }, []);

  const generate = useCallback(
    async (options: StreamingGenerationOptions): Promise<StreamingResult | null> => {
      const {
        projectId,
        locale,
        pixelPerfect = true,
        partialImages: partialImagesCount = 2,
        visionMode = true, // Default to Vision pipeline
        enhancedPrompt = true, // Default to PromptEngineeringService
      } = options;

      // Reset state
      reset();
      setIsStreaming(true);
      setProgress({ stage: "connecting", message: "Connecting to server..." });

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/variant/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            locale,
            pixelPerfect,
            partialImages: partialImagesCount,
            visionMode,
            enhancedPrompt,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: StreamingResult | null = null;

        // Track event type/data across chunks (SSE events may be split)
        let currentEventType = "";
        let currentEventData = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete events
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentEventData = line.slice(6).trim();

              if (currentEventType && currentEventData) {
                try {
                  const eventData = JSON.parse(currentEventData) as SSEEvent["data"];

                  switch (currentEventType) {
                    case "start":
                      setProgress({
                        stage: "streaming",
                        message: `Generating ${(eventData as StartEvent["data"]).localeName} variant...`,
                      });
                      break;

                    case "partial":
                      const partialData = eventData as PartialEvent["data"];
                      setPartialImages((prev) => [...prev, partialData.imageBase64]);
                      setProgress({
                        stage: "streaming",
                        message: `Received partial image ${partialData.index + 1}...`,
                        partialIndex: partialData.index,
                      });
                      break;

                    case "processing":
                      const processingData = eventData as ProcessingEvent["data"];
                      setProgress({
                        stage: "processing",
                        message: processingData.message,
                      });
                      break;

                    case "complete":
                      const completeData = eventData as CompleteEvent["data"];
                      finalResult = completeData;
                      setResult(completeData);
                      setProgress({
                        stage: "complete",
                        message: "Generation complete!",
                      });
                      break;

                    case "error":
                      const errorData = eventData as ErrorEvent["data"];
                      throw new Error(errorData.error);
                  }
                } catch (parseError) {
                  // Only swallow JSON parse errors, re-throw actual event errors
                  if (parseError instanceof SyntaxError) {
                    console.warn("[useStreamingGeneration] JSON parse failed, data length:", currentEventData.length);
                  } else {
                    throw parseError;
                  }
                }

                currentEventType = "";
                currentEventData = "";
              }
            }
          }
        }

        setIsStreaming(false);
        return finalResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";

        if (err instanceof Error && err.name === "AbortError") {
          setProgress({ stage: "idle", message: "Cancelled" });
          return null;
        }

        setError(errorMessage);
        setProgress({ stage: "error", message: errorMessage });
        setIsStreaming(false);
        return null;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [reset]
  );

  return {
    generate,
    isStreaming,
    partialImages,
    progress,
    result,
    error,
    cancel,
    reset,
  };
}

export default useStreamingGeneration;
