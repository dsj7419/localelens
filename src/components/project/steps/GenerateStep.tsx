/**
 * GenerateStep Component
 *
 * Renders the Generate step UI (sidebar + canvas).
 * Single responsibility: Generate step presentation.
 */

"use client";

import { Badge } from "~/components/ui/badge";
import { GenerateSidebar } from "../sidebar";
import { LOCALE_REGISTRY, type LocaleId } from "~/server/domain/value-objects/locale";

interface GenerateStepSidebarProps {
  selectedLocales: LocaleId[];
  isGenerating: boolean;
  isDemoMode: boolean;
  progress: number;
  isDemoProject: boolean;
  onLocaleToggle: (locale: LocaleId) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onGenerate: () => void;
  onDemoMode?: () => void;
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
}

export function GenerateStepSidebar({
  selectedLocales,
  isGenerating,
  isDemoMode,
  progress,
  isDemoProject,
  onLocaleToggle,
  onSelectAll,
  onClearAll,
  onGenerate,
  onDemoMode,
  onCurrentLocaleChange,
}: GenerateStepSidebarProps) {
  return (
    <GenerateSidebar
      selectedLocales={selectedLocales}
      isGenerating={isGenerating}
      isDemoMode={isDemoMode}
      progress={progress}
      onLocaleToggle={onLocaleToggle}
      onSelectAll={onSelectAll}
      onClearAll={onClearAll}
      onGenerate={onGenerate}
      onDemoMode={isDemoProject ? onDemoMode : undefined}
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
}: GenerateStepCanvasProps) {
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
        {isGenerating && (
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
