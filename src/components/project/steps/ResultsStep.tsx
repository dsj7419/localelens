/**
 * ResultsStep Component
 *
 * Renders the Results step UI (sidebar + canvas).
 * Single responsibility: Results step presentation.
 *
 * ED-059: ImageLightbox for click-to-zoom on result images.
 * Users can click any image to view at full size in a modal overlay.
 */

"use client";

import { useState } from "react";
import { ResultsSidebar } from "../sidebar";
import { ImageLightbox } from "../ImageLightbox";
import { LOCALE_REGISTRY, type LocaleId } from "~/server/domain/value-objects/locale";
import type { Variant } from "~/server/domain/entities/project";

interface ResultsStepSidebarProps {
  variants: Variant[];
  activeVariant: LocaleId | "original";
  showOverlay: boolean;
  isExporting: boolean;
  isRegenerating: string | null;
  isVerifying: string | null;
  onVariantSelect: (variant: LocaleId | "original") => void;
  onToggleOverlay: () => void;
  onDownloadVariant: (locale: LocaleId) => void;
  onDownloadOriginal: () => void;
  onRegenerate: (locale: LocaleId) => void;
  onVerify: (locale: LocaleId) => void;
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
  isVerifying,
  onVariantSelect,
  onToggleOverlay,
  onDownloadVariant,
  onDownloadOriginal,
  onRegenerate,
  onVerify,
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
      isVerifying={isVerifying}
      onVariantSelect={onVariantSelect}
      onToggleOverlay={onToggleOverlay}
      onDownloadVariant={onDownloadVariant}
      onDownloadOriginal={onDownloadOriginal}
      onRegenerate={onRegenerate}
      onVerify={onVerify}
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

  // Lightbox state for click-to-zoom feature (ED-059)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState("");

  // Open lightbox with specified image
  const openLightbox = (imageUrl: string | null, title: string) => {
    if (imageUrl) {
      setLightboxImage(imageUrl);
      setLightboxTitle(title);
      setLightboxOpen(true);
    }
  };

  // Get the current variant display image
  const currentVariantImage = showOverlay && overlayImageUrl ? overlayImageUrl : variantImageUrl;
  const variantTitle = activeVariant === "original"
    ? "Original"
    : `${LOCALE_REGISTRY[activeVariant as LocaleId].name}${showOverlay ? " (Drift Overlay)" : ""}`;

  return (
    <>
      <div className="flex items-center justify-center h-full gap-6">
        {/* Original */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">Original</p>
          <div
            className={`relative rounded-lg overflow-hidden border border-border transition-all ${
              baseImageUrl ? "cursor-zoom-in hover:ring-2 hover:ring-primary/50" : ""
            }`}
            style={{ width: scaledWidth, height: scaledHeight }}
            onClick={() => baseImageUrl && openLightbox(baseImageUrl, "Original")}
            title={baseImageUrl ? "Click to view full size" : undefined}
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
            className={`relative rounded-lg overflow-hidden border border-border transition-all ${
              currentVariantImage ? "cursor-zoom-in hover:ring-2 hover:ring-primary/50" : ""
            }`}
            style={{ width: scaledWidth, height: scaledHeight }}
            onClick={() => currentVariantImage && openLightbox(currentVariantImage, variantTitle)}
            title={currentVariantImage ? "Click to view full size" : undefined}
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
                src={currentVariantImage ?? variantImageUrl}
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

      {/* Image Lightbox (ED-059) */}
      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={lightboxImage}
        title={lightboxTitle}
      />
    </>
  );
}
