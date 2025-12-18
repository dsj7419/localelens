/**
 * ResultsStep Component
 *
 * Renders the Results step UI (sidebar + canvas).
 * Single responsibility: Results step presentation.
 */

"use client";

import { ResultsSidebar } from "../sidebar";
import { LOCALE_REGISTRY, type LocaleId } from "~/server/domain/value-objects/locale";
import type { Variant } from "~/server/domain/entities/project";

interface ResultsStepSidebarProps {
  variants: Variant[];
  activeVariant: LocaleId | "original";
  showOverlay: boolean;
  isExporting: boolean;
  isRegenerating: string | null;
  onVariantSelect: (variant: LocaleId | "original") => void;
  onToggleOverlay: () => void;
  onDownloadVariant: (locale: LocaleId) => void;
  onDownloadOriginal: () => void;
  onRegenerate: (locale: LocaleId) => void;
  onExportZip: () => void;
  onExportMontage: () => void;
}

interface ResultsStepCanvasProps {
  baseImageUrl: string | null;
  activeVariant: LocaleId | "original";
  showOverlay: boolean;
  variantImageUrl: string | null;
  overlayImageUrl: string | null;
  isLoadingVariant: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function ResultsStepSidebar({
  variants,
  activeVariant,
  showOverlay,
  isExporting,
  isRegenerating,
  onVariantSelect,
  onToggleOverlay,
  onDownloadVariant,
  onDownloadOriginal,
  onRegenerate,
  onExportZip,
  onExportMontage,
}: ResultsStepSidebarProps) {
  return (
    <ResultsSidebar
      variants={variants}
      activeVariant={activeVariant}
      showOverlay={showOverlay}
      isExporting={isExporting}
      isRegenerating={isRegenerating}
      onVariantSelect={onVariantSelect}
      onToggleOverlay={onToggleOverlay}
      onDownloadVariant={onDownloadVariant}
      onDownloadOriginal={onDownloadOriginal}
      onRegenerate={onRegenerate}
      onExportZip={onExportZip}
      onExportMontage={onExportMontage}
    />
  );
}

export function ResultsStepCanvas({
  baseImageUrl,
  activeVariant,
  showOverlay,
  variantImageUrl,
  overlayImageUrl,
  isLoadingVariant,
  canvasWidth,
  canvasHeight,
}: ResultsStepCanvasProps) {
  const scaledWidth = canvasWidth * 0.45;
  const scaledHeight = canvasHeight * 0.45;

  return (
    <div className="flex items-center justify-center h-full gap-6">
      {/* Original */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground text-center">Original</p>
        <div
          className="relative rounded-lg overflow-hidden border border-border"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          {baseImageUrl ? (
            <img src={baseImageUrl} alt="Original" className="w-full h-full object-contain" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No image
            </div>
          )}
        </div>
      </div>

      {/* Variant */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground text-center">
          {activeVariant === "original"
            ? "Select a variant"
            : `${LOCALE_REGISTRY[activeVariant as LocaleId].name}${showOverlay ? " (Drift)" : ""}`}
        </p>
        <div
          className="relative rounded-lg overflow-hidden border border-border"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          {activeVariant === "original" ? (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-muted/20">
              Select a variant from the sidebar
            </div>
          ) : isLoadingVariant ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : variantImageUrl ? (
            <img
              src={showOverlay && overlayImageUrl ? overlayImageUrl : variantImageUrl}
              alt={`${activeVariant} variant`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-muted/20">
              Image not found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
