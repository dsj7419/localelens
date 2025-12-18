"use client";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Sparkles, PlayCircle, Check, Zap, Info } from "lucide-react";
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
  onLocaleToggle: (locale: LocaleId) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onGenerate: () => void;
  onDemoMode?: () => void;
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
  onLocaleToggle,
  onSelectAll,
  onClearAll,
  onGenerate,
  onDemoMode,
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
        {onDemoMode && (
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
        <Button
          className="w-full gap-2"
          onClick={onGenerate}
          disabled={isGenerating || noneSelected}
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Generating..." : `Generate ${selectedLocales.length} Variant(s)`}
        </Button>
      </div>
    </div>
  );
}
