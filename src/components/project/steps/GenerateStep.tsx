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
}

interface GenerateStepCanvasProps {
  baseImageUrl: string | null;
  maskUrl: string | null;
  selectedLocales: LocaleId[];
  canvasWidth: number;
  canvasHeight: number;
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
    />
  );
}

export function GenerateStepCanvas({
  baseImageUrl,
  maskUrl,
  selectedLocales,
  canvasWidth,
  canvasHeight,
}: GenerateStepCanvasProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
        {/* Base image */}
        {baseImageUrl && (
          <img
            src={baseImageUrl}
            alt="Base"
            className="absolute inset-0 w-full h-full object-contain rounded-lg"
          />
        )}
        {/* Mask overlay */}
        {maskUrl && (
          <img
            src={maskUrl}
            alt="Mask"
            className="absolute inset-0 w-full h-full object-contain rounded-lg"
            style={{ opacity: 0.3 }}
          />
        )}
        {/* Locale badges */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-center">
          {selectedLocales.map((locale) => (
            <Badge key={locale} variant="secondary" className="text-xs">
              {LOCALE_REGISTRY[locale].name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
