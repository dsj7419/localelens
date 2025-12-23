/**
 * GenerateStep Component
 *
 * Renders the Generate step UI (sidebar + canvas).
 * Single responsibility: Generate step presentation.
 *
 * Enhanced for gpt-image-1.5 streaming showcase:
 * - Shows StreamingPreview when streaming is active
 * - Displays progressive image reveal for wow factor
 */

"use client";

import { Badge } from "~/components/ui/badge";
import { GenerateSidebar } from "../sidebar";
import { StreamingPreview } from "../StreamingPreview";
import { LOCALE_REGISTRY, type LocaleId } from "~/server/domain/value-objects/locale";
import type { StreamingProgress, StreamingResult } from "~/hooks/useStreamingGeneration";

interface GenerateStepSidebarProps {
  selectedLocales: LocaleId[];
  isGenerating: boolean;
  isDemoMode: boolean;
  progress: number;
  isDemoProject: boolean;
  /** Enable streaming mode with progressive image preview */
  streamingEnabled?: boolean;
  /** Callback when streaming toggle changes */
  onStreamingChange?: (enabled: boolean) => void;
  /** Enable Vision pipeline for universal image support */
  visionModeEnabled?: boolean;
  /** Callback when Vision mode toggle changes */
  onVisionModeChange?: (enabled: boolean) => void;
  /** Whether image analysis is in progress */
  isAnalyzing?: boolean;
  /** Whether image has been analyzed */
  hasAnalysis?: boolean;
  /** Number of detected text regions */
  detectedTextCount?: number;
  onLocaleToggle: (locale: LocaleId) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onGenerate: () => void;
  onDemoMode?: () => void;
  onCancel?: () => void;
  onCurrentLocaleChange?: (locale: LocaleId | null) => void;
}

interface GenerateStepCanvasProps {
  baseImageUrl: string | null;
  maskUrl: string | null;
  selectedLocales: LocaleId[];
  canvasWidth: number;
  canvasHeight: number;
  isGenerating?: boolean;
  currentLocale?: LocaleId | null;
  // Streaming props for gpt-image-1.5 showcase
  streamingEnabled?: boolean;
  isStreaming?: boolean;
  streamingProgress?: StreamingProgress;
  streamingPartialImages?: string[];
  streamingResult?: StreamingResult | null;
  streamingError?: string | null;
}

export function GenerateStepSidebar({
  selectedLocales,
  isGenerating,
  isDemoMode,
  progress,
  isDemoProject,
  streamingEnabled,
  onStreamingChange,
  visionModeEnabled,
  onVisionModeChange,
  isAnalyzing,
  hasAnalysis,
  detectedTextCount,
  onLocaleToggle,
  onSelectAll,
  onClearAll,
  onGenerate,
  onDemoMode,
  onCancel,
  onCurrentLocaleChange,
}: GenerateStepSidebarProps) {
  return (
    <GenerateSidebar
      selectedLocales={selectedLocales}
      isGenerating={isGenerating}
      isDemoMode={isDemoMode}
      progress={progress}
      streamingEnabled={streamingEnabled}
      onStreamingChange={onStreamingChange}
      visionModeEnabled={visionModeEnabled}
      onVisionModeChange={onVisionModeChange}
      isAnalyzing={isAnalyzing}
      hasAnalysis={hasAnalysis}
      detectedTextCount={detectedTextCount}
      onLocaleToggle={onLocaleToggle}
      onSelectAll={onSelectAll}
      onClearAll={onClearAll}
      onGenerate={onGenerate}
      onDemoMode={isDemoProject ? onDemoMode : undefined}
      onCancel={onCancel}
      onCurrentLocaleChange={onCurrentLocaleChange}
    />
  );
}

export function GenerateStepCanvas({
  baseImageUrl,
  maskUrl,
  selectedLocales,
  canvasWidth,
  canvasHeight,
  isGenerating,
  currentLocale,
  // Streaming props
  streamingEnabled,
  isStreaming,
  streamingProgress,
  streamingPartialImages,
  streamingResult,
  streamingError,
}: GenerateStepCanvasProps) {
  // Show StreamingPreview when streaming is active
  if (streamingEnabled && isStreaming && currentLocale && streamingProgress) {
    return (
      <div className="flex items-center justify-center h-full">
        <StreamingPreview
          progress={streamingProgress}
          partialImages={streamingPartialImages ?? []}
          result={streamingResult ?? null}
          error={streamingError ?? null}
          locale={currentLocale}
          baseImageUrl={baseImageUrl}
          width={canvasWidth}
          height={canvasHeight}
          showUsage={true}
        />
      </div>
    );
  }

  // Default non-streaming view
  return (
    <div className="flex items-center justify-center h-full">
      <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
        {/* Base image */}
        {baseImageUrl && (
          <img
            src={baseImageUrl}
            alt="Base"
            className={`absolute inset-0 w-full h-full object-contain rounded-lg transition-all duration-500 ${
              isGenerating ? "brightness-75" : ""
            }`}
          />
        )}
        {/* Mask overlay - pulse animation during generation */}
        {maskUrl && (
          <img
            src={maskUrl}
            alt="Mask"
            className={`absolute inset-0 w-full h-full object-contain rounded-lg transition-opacity duration-300 ${
              isGenerating ? "animate-pulse opacity-50" : "opacity-30"
            }`}
          />
        )}

        {/* Generation overlay */}
        {isGenerating && !isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-sm rounded-lg animate-in fade-in duration-300">
            {/* Animated spinner */}
            <div className="relative mb-4">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
            </div>

            {/* Current locale being generated */}
            {currentLocale && (
              <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-sm text-muted-foreground">Generating</p>
                <Badge variant="default" className="text-sm px-3 py-1">
                  {LOCALE_REGISTRY[currentLocale].name}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {LOCALE_REGISTRY[currentLocale].nativeName}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Locale badges - only show when not generating */}
        {!isGenerating && (
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-center">
            {selectedLocales.map((locale) => (
              <Badge key={locale} variant="secondary" className="text-xs">
                {LOCALE_REGISTRY[locale].name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
