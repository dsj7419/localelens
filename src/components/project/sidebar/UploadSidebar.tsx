"use client";

import { useRef } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Upload, Sparkles, FileImage, ArrowRight, ScanSearch, CheckCircle2 } from "lucide-react";

interface UploadSidebarProps {
  hasBaseImage: boolean;
  isUploading: boolean;
  isDemoLoading: boolean;
  isAnalyzing?: boolean;
  hasAnalysis?: boolean;
  detectedTextCount?: number;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
}

/**
 * UploadSidebar Component
 *
 * Sidebar panel for the Upload step.
 * Contains upload controls and demo loader.
 */
export function UploadSidebar({
  hasBaseImage,
  isUploading,
  isDemoLoading,
  isAnalyzing,
  hasAnalysis,
  detectedTextCount,
  onFileSelect,
  onLoadDemo,
  onContinue,
}: UploadSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6">
        {/* Upload Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Base Image</h3>
          <p className="text-xs text-muted-foreground">
            Upload the marketing visual you want to localize.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFileSelect}
            className="hidden"
          />

          <Button
            variant="default"
            className="w-full justify-start gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : hasBaseImage ? "Replace Image" : "Upload Image"}
          </Button>
        </div>

        <Separator />

        {/* Demo Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Quick Start</h3>
          <p className="text-xs text-muted-foreground">
            Load a pre-configured demo to see LocaleLens in action.
          </p>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={onLoadDemo}
            disabled={isDemoLoading}
          >
            <Sparkles className="h-4 w-4" />
            {isDemoLoading ? "Loading..." : "Load Demo Asset"}
          </Button>
        </div>

        {/* File Info & Analysis Status */}
        {hasBaseImage && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileImage className="h-4 w-4" />
                <span>Image loaded</span>
              </div>

              {/* Analysis Status */}
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-sm text-purple-400">
                  <ScanSearch className="h-4 w-4 animate-pulse" />
                  <span>Analyzing text regions...</span>
                </div>
              )}
              {hasAnalysis && !isAnalyzing && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {detectedTextCount !== undefined && detectedTextCount > 0
                      ? `${detectedTextCount} text regions detected`
                      : "Analysis complete"}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Continue Button */}
      <div className="pt-4 border-t border-border space-y-2">
        <Button
          className="w-full gap-2"
          onClick={onContinue}
          disabled={!hasBaseImage || isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <ScanSearch className="h-4 w-4 animate-pulse" />
              Analyzing...
            </>
          ) : (
            <>
              Continue to Mask
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {!hasBaseImage && (
          <p className="text-xs text-muted-foreground text-center">
            Upload an image to continue
          </p>
        )}
        {hasBaseImage && isAnalyzing && (
          <p className="text-xs text-muted-foreground text-center">
            Detecting text regions for auto-mask...
          </p>
        )}
      </div>
    </div>
  );
}
