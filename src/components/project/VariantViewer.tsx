"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import type { Variant } from "~/server/domain/entities/project";
import {
  LOCALE_REGISTRY,
  type LocaleId,
} from "~/server/domain/value-objects/locale";
import type { DriftStatus } from "~/server/domain/value-objects/drift";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface VariantViewerProps {
  projectId: string;
  baseImageUrl: string | null;
  variants: Variant[];
  onVariantsChange?: () => void;
}

/**
 * Get drift status badge variant
 */
function getDriftBadgeVariant(
  status: DriftStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PASS":
      return "default";
    case "WARN":
      return "secondary";
    case "FAIL":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * VariantViewer Component
 *
 * Displays generated variants in tabs with before/after comparison.
 * Includes drift inspector, overlay toggle, regenerate button, and export controls.
 */
export function VariantViewer({
  projectId,
  baseImageUrl,
  variants,
  onVariantsChange,
}: VariantViewerProps) {
  const [activeLocale, setActiveLocale] = useState<LocaleId | "original">(
    variants[0]?.locale ?? "original"
  );
  const [showOverlay, setShowOverlay] = useState<Record<string, boolean>>({});
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch variant images
  const variantQueries = variants.map((v) =>
    api.project.getVariantImage.useQuery({
      projectId,
      locale: v.locale,
    })
  );

  // Fetch overlay images
  const overlayQueries = variants.map((v) =>
    api.variant.getOverlay.useQuery({
      projectId,
      locale: v.locale,
    })
  );

  // Mutations
  const regenerateMutation = api.variant.regenerateStricter.useMutation({
    onMutate: ({ locale }) => {
      setIsRegenerating(locale);
    },
    onSuccess: (data) => {
      setIsRegenerating(null);
      toast.success(
        `Regenerated with stricter constraints. New drift: ${data.driftScore?.toFixed(2) ?? "N/A"}%`
      );
      onVariantsChange?.();
    },
    onError: (error) => {
      setIsRegenerating(null);
      toast.error("Regeneration failed", { description: error.message });
    },
  });

  const exportZipMutation = api.project.getExportZip.useMutation({
    onMutate: () => {
      setIsExporting(true);
    },
    onSuccess: (data) => {
      setIsExporting(false);
      // Trigger download
      const link = document.createElement("a");
      link.href = data.zipBase64;
      link.download = `localelens_${projectId}_variants.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`ZIP exported (${(data.fileSize / 1024).toFixed(1)} KB)`);
    },
    onError: (error) => {
      setIsExporting(false);
      toast.error("Export failed", { description: error.message });
    },
  });

  const montageMutation = api.project.getMontage.useMutation({
    onMutate: () => {
      setIsExporting(true);
    },
    onSuccess: (data) => {
      setIsExporting(false);
      // Trigger download
      const link = document.createElement("a");
      link.href = data.montageBase64;
      link.download = "localelens_montage_2x2.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Montage downloaded");
    },
    onError: (error) => {
      setIsExporting(false);
      toast.error("Montage generation failed", { description: error.message });
    },
  });

  const getVariantImageUrl = (locale: LocaleId): string | null => {
    const index = variants.findIndex((v) => v.locale === locale);
    if (index === -1) return null;
    return variantQueries[index]?.data?.imageBase64 ?? null;
  };

  const getOverlayImageUrl = (locale: LocaleId): string | null => {
    const index = variants.findIndex((v) => v.locale === locale);
    if (index === -1) return null;
    return overlayQueries[index]?.data?.overlayBase64 ?? null;
  };

  const handleDownload = (locale: LocaleId) => {
    const imageUrl = getVariantImageUrl(locale);
    if (!imageUrl) return;

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `localelens_${locale}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadOriginal = () => {
    if (!baseImageUrl) return;

    const link = document.createElement("a");
    link.href = baseImageUrl;
    link.download = "localelens_original.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerate = (locale: LocaleId) => {
    regenerateMutation.mutate({ projectId, locale });
  };

  const handleExportZip = () => {
    exportZipMutation.mutate({ projectId });
  };

  const handleDownloadMontage = () => {
    montageMutation.mutate({ projectId });
  };

  const toggleOverlay = (locale: string) => {
    setShowOverlay((prev) => ({
      ...prev,
      [locale]: !prev[locale],
    }));
  };

  if (variants.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No variants generated yet. Select locales and click Generate Variants.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {variants.length} variant(s) generated
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadMontage}
            disabled={isExporting}
          >
            {isExporting ? "Generating..." : "Download Montage"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExportZip}
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : "Download ZIP"}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeLocale}
        onValueChange={(v) => setActiveLocale(v as LocaleId | "original")}
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="original">Original</TabsTrigger>
          {variants.map((v) => {
            const meta = LOCALE_REGISTRY[v.locale];
            return (
              <TabsTrigger key={v.locale} value={v.locale}>
                <span>{meta.name}</span>
                {meta.direction === "rtl" && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    RTL
                  </Badge>
                )}
                {v.driftStatus !== "PENDING" && (
                  <Badge
                    variant={getDriftBadgeVariant(v.driftStatus)}
                    className="ml-2 text-xs"
                  >
                    {v.driftStatus}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="original" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Original (English)</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadOriginal}
                disabled={!baseImageUrl}
              >
                Download
              </Button>
            </div>
            <div className="relative aspect-9/16 max-w-md mx-auto overflow-hidden rounded-lg border border-border bg-muted">
              {baseImageUrl ? (
                <img
                  src={baseImageUrl}
                  alt="Original"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  No base image
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {variants.map((v) => {
          const meta = LOCALE_REGISTRY[v.locale];
          const imageUrl = getVariantImageUrl(v.locale);
          const overlayUrl = getOverlayImageUrl(v.locale);
          const isOverlayVisible = showOverlay[v.locale] ?? false;

          return (
            <TabsContent key={v.locale} value={v.locale} className="mt-4">
              <div className="space-y-4">
                {/* Header with controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{meta.name}</h3>
                    <span className="text-muted-foreground">
                      ({meta.nativeName})
                    </span>
                    {v.modelUsed && (
                      <Badge variant="secondary" className="text-xs">
                        {v.modelUsed}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(v.locale)}
                    disabled={!imageUrl}
                  >
                    Download
                  </Button>
                </div>

                {/* Drift Inspector Panel */}
                {v.driftStatus !== "PENDING" && (
                  <Card className="bg-muted/50">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              Drift Score:
                            </span>
                            <Badge variant={getDriftBadgeVariant(v.driftStatus)}>
                              {v.driftStatus}{" "}
                              {v.driftScore !== null &&
                                `(${v.driftScore.toFixed(2)}%)`}
                            </Badge>
                          </div>
                          <Separator orientation="vertical" className="h-6" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleOverlay(v.locale)}
                            disabled={!overlayUrl}
                          >
                            {isOverlayVisible ? "Hide Overlay" : "Show Overlay"}
                          </Button>
                        </div>
                        {v.driftStatus === "FAIL" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRegenerate(v.locale)}
                            disabled={isRegenerating === v.locale}
                          >
                            {isRegenerating === v.locale
                              ? "Regenerating..."
                              : "Regenerate (Stricter)"}
                          </Button>
                        )}
                        {v.driftStatus === "WARN" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRegenerate(v.locale)}
                            disabled={isRegenerating === v.locale}
                          >
                            {isRegenerating === v.locale
                              ? "Regenerating..."
                              : "Try Stricter"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Side-by-side view */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground text-center">
                      Original
                    </p>
                    <div className="relative aspect-9/16 overflow-hidden rounded-lg border border-border bg-muted">
                      {baseImageUrl ? (
                        <img
                          src={baseImageUrl}
                          alt="Original"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground text-center">
                      {meta.name} Variant
                      {isOverlayVisible && " (Drift Overlay)"}
                    </p>
                    <div className="relative aspect-9/16 overflow-hidden rounded-lg border border-border bg-muted">
                      {imageUrl ? (
                        <img
                          src={isOverlayVisible && overlayUrl ? overlayUrl : imageUrl}
                          alt={`${meta.name} variant${isOverlayVisible ? " with drift overlay" : ""}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          Loading...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
