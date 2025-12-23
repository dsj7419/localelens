"use client";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Sparkles, PlayCircle, Check, Zap, Info, Eye, Loader2, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  SUPPORTED_LOCALES,
  LOCALE_REGISTRY,
  type LocaleId,
} from "~/server/domain/value-objects/locale";
import { GenerationProgress } from "../GenerationProgress";

interface GenerateSidebarProps {
  selectedLocales: LocaleId[];
  isGenerating: boolean;
  isDemoMode: boolean;
  progress: number;
  isDemoProject?: boolean;
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

/**
 * GenerateSidebar Component
 *
 * Sidebar panel for the Generate step.
 * Contains locale selection and generation controls.
 */
export function GenerateSidebar({
  selectedLocales,
  isGenerating,
  isDemoMode,
  progress,
  streamingEnabled = false,
  onStreamingChange,
  visionModeEnabled = false,
  onVisionModeChange,
  isAnalyzing = false,
  hasAnalysis = false,
  detectedTextCount = 0,
  onLocaleToggle,
  onSelectAll,
  onClearAll,
  onGenerate,
  onDemoMode,
  onCancel,
  onCurrentLocaleChange,
}: GenerateSidebarProps) {
  const allSelected = selectedLocales.length === SUPPORTED_LOCALES.length;
  const noneSelected = selectedLocales.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-5">
        {/* Locale Selection Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Target Locales</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onSelectAll}
                disabled={allSelected || isGenerating}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onClearAll}
                disabled={noneSelected || isGenerating}
              >
                None
              </Button>
            </div>
          </div>

          {/* Locale List */}
          <div className="space-y-1">
            {SUPPORTED_LOCALES.map((locale) => {
              const meta = LOCALE_REGISTRY[locale];
              const isSelected = selectedLocales.includes(locale);

              return (
                <button
                  key={locale}
                  onClick={() => !isGenerating && onLocaleToggle(locale)}
                  disabled={isGenerating}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left
                    ${isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/50 border border-transparent hover:bg-muted"
                    }
                    ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  <div className={`
                    flex items-center justify-center h-4 w-4 rounded border transition-all
                    ${isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30"
                    }
                  `}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {meta.name}
                      </span>
                      {meta.direction === "rtl" && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          RTL
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {meta.nativeName}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {noneSelected && (
            <p className="text-xs text-destructive">
              Select at least one locale
            </p>
          )}
        </div>

        <Separator />

        {/* Streaming Toggle */}
        {onStreamingChange && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Live Preview</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-50">
                      <p className="text-xs">
                        Shows progressive image generation in real-time.
                        Each preview incurs additional API cost.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <button
                onClick={() => onStreamingChange(!streamingEnabled)}
                disabled={isGenerating}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${streamingEnabled ? "bg-amber-500" : "bg-muted"}
                  ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                    ${streamingEnabled ? "translate-x-4" : "translate-x-0.5"}
                  `}
                />
              </button>
            </div>
            {streamingEnabled && (
              <p className="text-xs text-muted-foreground">
                Progressive preview enabled - additional cost per generation
              </p>
            )}
          </div>
        )}

        <Separator />

        {/* Vision Mode Toggle - Universal Image Support */}
        {onVisionModeChange && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Vision Mode</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  NEW
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-60">
                      <p className="text-xs">
                        Uses GPT-4o Vision to detect text in your image, then translates
                        dynamically. Works with ANY image, not just demo screenshots.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <button
                onClick={() => onVisionModeChange(!visionModeEnabled)}
                disabled={isGenerating || isAnalyzing}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${visionModeEnabled ? "bg-purple-500" : "bg-muted"}
                  ${isGenerating || isAnalyzing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                    ${visionModeEnabled ? "translate-x-4" : "translate-x-0.5"}
                  `}
                />
              </button>
            </div>

            {/* Vision Mode Status */}
            {visionModeEnabled && (
              <div className="space-y-2">
                {/* Analysis in Progress */}
                {isAnalyzing && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                        Analyzing Image...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Detecting text with GPT-4o Vision
                      </p>
                    </div>
                  </div>
                )}

                {/* Analysis Complete */}
                {!isAnalyzing && hasAnalysis && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Check className="h-4 w-4 text-purple-500" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                        Text Detected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {detectedTextCount} region{detectedTextCount !== 1 ? "s" : ""} found
                      </p>
                    </div>
                  </div>
                )}

                {/* Info text */}
                <p className="text-xs text-muted-foreground">
                  {hasAnalysis
                    ? "Ready to generate with dynamic translations"
                    : isAnalyzing
                    ? "Please wait while we analyze your image..."
                    : "Enable to auto-detect and translate text"
                  }
                </p>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Generation Progress */}
        {(isGenerating || progress === 100) && (
          <GenerationProgress
            locales={selectedLocales}
            isGenerating={isGenerating}
            isDemoMode={isDemoMode}
            onCurrentLocaleChange={onCurrentLocaleChange}
          />
        )}
      </div>

      {/* Generate Buttons */}
      <div className="pt-4 border-t border-border space-y-2">
        {onDemoMode && !isGenerating && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onDemoMode}
            disabled={isGenerating || noneSelected}
          >
            <PlayCircle className="h-4 w-4" />
            Demo Mode
          </Button>
        )}
        {isGenerating ? (
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={onCancel}
          >
            <XCircle className="h-4 w-4" />
            Cancel Generation
          </Button>
        ) : (
          <Button
            className="w-full gap-2"
            onClick={onGenerate}
            disabled={noneSelected}
          >
            <Sparkles className="h-4 w-4" />
            Generate {selectedLocales.length} Variant(s)
          </Button>
        )}
      </div>
    </div>
  );
}
