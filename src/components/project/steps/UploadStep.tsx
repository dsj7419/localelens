/**
 * UploadStep Component
 *
 * Renders the Upload step UI (sidebar + canvas).
 * Single responsibility: Upload step presentation.
 */

"use client";

import { UploadSidebar } from "../sidebar";

interface UploadStepSidebarProps {
  // State
  hasBaseImage: boolean;
  isUploading: boolean;
  isDemoLoading: boolean;

  // Analysis state (auto-runs after upload)
  isAnalyzing?: boolean;
  hasAnalysis?: boolean;
  detectedTextCount?: number;

  // Handlers
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
}

interface UploadStepCanvasProps {
  baseImageUrl: string | null;
  canvasWidth: number;
  canvasHeight: number;
}

export function UploadStepSidebar({
  hasBaseImage,
  isUploading,
  isDemoLoading,
  isAnalyzing,
  hasAnalysis,
  detectedTextCount,
  onFileSelect,
  onLoadDemo,
  onContinue,
}: UploadStepSidebarProps) {
  return (
    <UploadSidebar
      hasBaseImage={hasBaseImage}
      isUploading={isUploading}
      isDemoLoading={isDemoLoading}
      isAnalyzing={isAnalyzing}
      hasAnalysis={hasAnalysis}
      detectedTextCount={detectedTextCount}
      onFileSelect={onFileSelect}
      onLoadDemo={onLoadDemo}
      onContinue={onContinue}
    />
  );
}

export function UploadStepCanvas({
  baseImageUrl,
  canvasWidth,
  canvasHeight,
}: UploadStepCanvasProps) {
  return (
    <div className="flex items-center justify-center h-full">
      {baseImageUrl ? (
        <div
          className="relative rounded-lg overflow-hidden border border-border shadow-lg"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          <img
            src={baseImageUrl}
            alt="Base image"
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          <p className="text-muted-foreground text-center px-8">
            Upload a marketing visual to get started
          </p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            Supports PNG, JPG, WebP
          </p>
        </div>
      )}
    </div>
  );
}
