"use client";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Download,
  FileArchive,
  LayoutGrid,
  Image,
  RefreshCw,
  Eye,
  EyeOff,
  CheckSquare,
} from "lucide-react";
import type { Variant } from "~/server/domain/entities/project";
import {
  LOCALE_REGISTRY,
  type LocaleId,
} from "~/server/domain/value-objects/locale";
import type { DriftStatus } from "~/server/domain/value-objects/drift";
import { VerificationBadge } from "../VerificationBadge";

interface ResultsSidebarProps {
  variants: Variant[];
  activeVariant: LocaleId | "original";
  showOverlay: boolean;
  isExporting: boolean;
  isRegenerating: string | null;
  isVerifying: string | null;
  onVariantSelect: (locale: LocaleId | "original") => void;
  onToggleOverlay: () => void;
  onDownloadVariant: (locale: LocaleId) => void;
  onDownloadOriginal: () => void;
  onRegenerate: (locale: LocaleId) => void;
  onVerify: (locale: LocaleId) => void;
  onExportZip: () => void;
  onExportMontage: () => void;
}

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
 * Get color class for verification accuracy
 * Green: 75%+, Yellow: 60-74.99%, Red: below 60%
 */
function getAccuracyColorClass(accuracy: number | null): string {
  if (accuracy === null) return "";
  if (accuracy >= 75) return "text-green-500";
  if (accuracy >= 60) return "text-yellow-500";
  return "text-red-500";
}

/**
 * ResultsSidebar Component
 *
 * Sidebar panel for the Results step.
 * Contains variant list and export controls.
 */
export function ResultsSidebar({
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
}: ResultsSidebarProps) {
  const activeVariantData = variants.find((v) => v.locale === activeVariant);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-5">
        {/* Variant List */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Variants</h3>

          <div className="space-y-1">
            {/* Original */}
            <button
              onClick={() => onVariantSelect("original")}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left
                ${activeVariant === "original"
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-muted/50 border border-transparent hover:bg-muted"
                }
              `}
            >
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Original</span>
            </button>

            {/* Generated Variants */}
            {variants.map((v) => {
              const meta = LOCALE_REGISTRY[v.locale];
              const isActive = activeVariant === v.locale;
              const hasAccuracy = v.translationAccuracy !== null;
              const accuracyColor = getAccuracyColorClass(v.translationAccuracy);

              return (
                <button
                  key={v.locale}
                  onClick={() => onVariantSelect(v.locale)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left
                    ${isActive
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/50 border border-transparent hover:bg-muted"
                    }
                  `}
                >
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
                  </div>
                  {/* Verification accuracy indicator */}
                  {hasAccuracy && (
                    <span className={`text-xs font-semibold ${accuracyColor}`}>
                      {v.translationAccuracy?.toFixed(0)}%
                    </span>
                  )}
                  {v.driftStatus !== "PENDING" && (
                    <Badge
                      variant={getDriftBadgeVariant(v.driftStatus)}
                      className="text-[10px] px-1.5"
                    >
                      {v.driftStatus}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Selected Variant Controls */}
        {activeVariant !== "original" && activeVariantData && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Drift Inspector</h3>

            {activeVariantData.driftStatus !== "PENDING" && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Score</span>
                  <Badge variant={getDriftBadgeVariant(activeVariantData.driftStatus)}>
                    {activeVariantData.driftStatus}
                    {activeVariantData.driftScore !== null &&
                      ` (${activeVariantData.driftScore.toFixed(1)}%)`}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={onToggleOverlay}
                  >
                    {showOverlay ? (
                      <>
                        <EyeOff className="h-3 w-3" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        Overlay
                      </>
                    )}
                  </Button>

                  {(activeVariantData.driftStatus === "FAIL" ||
                    activeVariantData.driftStatus === "WARN") && (
                    <Button
                      variant={
                        activeVariantData.driftStatus === "FAIL"
                          ? "destructive"
                          : "secondary"
                      }
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => onRegenerate(activeVariantData.locale)}
                      disabled={isRegenerating === activeVariantData.locale}
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${
                          isRegenerating === activeVariantData.locale
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                      Retry
                    </Button>
                  )}
                </div>
              </>
            )}

            <Separator />

            <h3 className="text-sm font-medium">Translation Accuracy</h3>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Accuracy</span>
              <VerificationBadge
                accuracy={activeVariantData.translationAccuracy}
                status={activeVariantData.verificationStatus}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => onVerify(activeVariantData.locale)}
              disabled={isVerifying === activeVariantData.locale}
            >
              <CheckSquare
                className={`h-4 w-4 ${
                  isVerifying === activeVariantData.locale ? "animate-pulse" : ""
                }`}
              />
              {isVerifying === activeVariantData.locale
                ? "Verifying..."
                : activeVariantData.verificationStatus
                  ? "Re-Verify"
                  : "Verify Translation"}
            </Button>

            <Separator />

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => onDownloadVariant(activeVariantData.locale)}
            >
              <Download className="h-4 w-4" />
              Download Variant
            </Button>
          </div>
        )}

        {activeVariant === "original" && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Original Image</h3>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={onDownloadOriginal}
            >
              <Download className="h-4 w-4" />
              Download Original
            </Button>
          </div>
        )}
      </div>

      {/* Export Buttons */}
      <div className="pt-4 border-t border-border space-y-2">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onExportMontage}
          disabled={isExporting}
        >
          <LayoutGrid className="h-4 w-4" />
          {isExporting ? "Generating..." : "Download Montage"}
        </Button>
        <Button
          className="w-full gap-2"
          onClick={onExportZip}
          disabled={isExporting}
        >
          <FileArchive className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export All (ZIP)"}
        </Button>
      </div>
    </div>
  );
}
