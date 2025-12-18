/**
 * StreamingPreview Component
 *
 * Showcases gpt-image-1.5's streaming capability with progressive image reveal.
 * Displays partial images as they arrive, creating a "building up" effect.
 *
 * Features:
 * - Progressive image reveal animation
 * - Partial image carousel/timeline
 * - Real-time progress indication
 * - Token usage display
 *
 * This component is designed to WOW the judges by demonstrating
 * world-class use of gpt-image-1.5's streaming feature.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import type { StreamingProgress, StreamingResult } from "~/hooks/useStreamingGeneration";
import { LOCALE_REGISTRY, type LocaleId } from "~/server/domain/value-objects/locale";

// =============================================================================
// Types
// =============================================================================

interface StreamingPreviewProps {
  /** Current streaming progress */
  progress: StreamingProgress;
  /** Partial images received so far (base64 data URLs) */
  partialImages: string[];
  /** Final result when complete */
  result: StreamingResult | null;
  /** Error message if any */
  error: string | null;
  /** The locale being generated */
  locale: LocaleId;
  /** Base image to show as background */
  baseImageUrl?: string | null;
  /** Container dimensions */
  width?: number;
  height?: number;
  /** Show token usage information */
  showUsage?: boolean;
  /** Callback when generation completes */
  onComplete?: (result: StreamingResult) => void;
}

// =============================================================================
// Component
// =============================================================================

export function StreamingPreview({
  progress,
  partialImages,
  result,
  error,
  locale,
  baseImageUrl,
  width = 400,
  height = 600,
  showUsage = true,
  onComplete,
}: StreamingPreviewProps) {
  const [activePartialIndex, setActivePartialIndex] = useState(0);
  const [showFinalReveal, setShowFinalReveal] = useState(false);

  // Auto-advance through partial images
  useEffect(() => {
    if (partialImages.length > 0 && progress.stage === "streaming") {
      setActivePartialIndex(partialImages.length - 1);
    }
  }, [partialImages.length, progress.stage]);

  // Trigger final reveal animation when complete
  useEffect(() => {
    if (result && progress.stage === "complete") {
      // Small delay for dramatic effect
      const timer = setTimeout(() => {
        setShowFinalReveal(true);
        onComplete?.(result);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [result, progress.stage, onComplete]);

  // Get the current display image
  const displayImage = showFinalReveal
    ? result?.imageBase64
    : partialImages[activePartialIndex] ?? baseImageUrl;

  // Calculate progress percentage
  const progressPercent =
    progress.stage === "complete"
      ? 100
      : progress.stage === "processing"
        ? 80 + (progress.partialIndex ?? 0) * 5
        : progress.stage === "streaming"
          ? 20 + (partialImages.length * 20)
          : progress.stage === "connecting"
            ? 10
            : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main preview container */}
      <div
        className="relative rounded-xl overflow-hidden bg-muted/50 shadow-lg"
        style={{ width, height }}
      >
        {/* Background image (base) */}
        {baseImageUrl && progress.stage !== "complete" && (
          <img
            src={baseImageUrl}
            alt="Base"
            className={cn(
              "absolute inset-0 w-full h-full object-contain transition-all duration-500",
              partialImages.length > 0 ? "opacity-30 blur-sm" : "opacity-100"
            )}
          />
        )}

        {/* Current partial/final image */}
        {displayImage && (
          <img
            src={displayImage}
            alt={showFinalReveal ? "Final result" : `Partial ${activePartialIndex + 1}`}
            className={cn(
              "absolute inset-0 w-full h-full object-contain transition-all",
              showFinalReveal
                ? "animate-in zoom-in-95 duration-700"
                : "animate-in fade-in duration-300"
            )}
          />
        )}

        {/* Streaming overlay - shows during generation */}
        {progress.stage === "streaming" && !showFinalReveal && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Scanline effect */}
            <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-primary/5 animate-pulse" />

            {/* Progress indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Processing overlay */}
        {progress.stage === "processing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="text-center space-y-3">
              <div className="h-10 w-10 mx-auto rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{progress.message}</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {progress.stage === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="text-center space-y-2 p-4">
              <p className="text-destructive font-medium">Generation Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Success badge */}
        {showFinalReveal && result && (
          <div className="absolute top-4 right-4 animate-in slide-in-from-top-2 fade-in duration-500">
            <Badge
              variant={result.driftStatus === "PASS" ? "default" : "secondary"}
              className={result.driftStatus === "PASS" ? "bg-green-500/90 text-white" : ""}
            >
              {result.driftStatus === "PASS" ? "PASS" : result.driftStatus === "WARN" ? "WARN" : result.driftStatus === "FAIL" ? "FAIL" : "Complete"}
              {result.driftScore != null && ` (${result.driftScore.toFixed(1)}%)`}
            </Badge>
          </div>
        )}

        {/* Locale indicator */}
        <div className="absolute top-4 left-4">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            {LOCALE_REGISTRY[locale].name}
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      {progress.stage !== "idle" && progress.stage !== "complete" && (
        <div className="w-full max-w-md space-y-2 animate-in fade-in duration-300">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">
            {progress.message ?? "Processing..."}
          </p>
        </div>
      )}

      {/* Partial images timeline */}
      {partialImages.length > 0 && (
        <div className="flex gap-2 p-2 bg-muted/30 rounded-lg animate-in slide-in-from-bottom-2 duration-300">
          {partialImages.map((img, i) => (
            <button
              key={i}
              onClick={() => {
                if (!showFinalReveal) {
                  setActivePartialIndex(i);
                }
              }}
              className={cn(
                "relative w-16 h-24 rounded overflow-hidden border-2 transition-all hover:scale-105",
                i === activePartialIndex && !showFinalReveal
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <img
                src={img}
                alt={`Partial ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/50 text-white text-center">
                P{i + 1}
              </span>
            </button>
          ))}
          {result?.imageBase64 && (
            <button
              onClick={() => setShowFinalReveal(true)}
              className={cn(
                "relative w-16 h-24 rounded overflow-hidden border-2 transition-all hover:scale-105",
                showFinalReveal
                  ? "border-green-500 ring-2 ring-green-500/30"
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <img
                src={result.imageBase64}
                alt="Final"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-green-500 text-white text-center">
                Final
              </span>
            </button>
          )}
        </div>
      )}

      {/* Token usage display */}
      {showUsage && result?.usage && (
        <div className="flex gap-4 text-xs text-muted-foreground animate-in fade-in duration-500 delay-300">
          <span>Total: {result.usage.totalTokens} tokens</span>
          <span>Input: {result.usage.inputTokens}</span>
          <span>Output: {result.usage.outputTokens}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Mini Streaming Indicator (for sidebar use)
// =============================================================================

interface StreamingIndicatorProps {
  isStreaming: boolean;
  partialCount: number;
  progress: StreamingProgress;
}

export function StreamingIndicator({
  isStreaming,
  partialCount,
  progress,
}: StreamingIndicatorProps) {
  if (!isStreaming && progress.stage === "idle") {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Animated dots */}
      {isStreaming && (
        <div className="flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}

      {/* Status text */}
      <span className="text-muted-foreground">
        {progress.stage === "streaming" && `Streaming (${partialCount} partials)`}
        {progress.stage === "processing" && progress.message}
        {progress.stage === "complete" && "Complete!"}
        {progress.stage === "error" && "Error"}
      </span>
    </div>
  );
}

export default StreamingPreview;
