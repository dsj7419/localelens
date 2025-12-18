/**
 * UploadStep Component
 *
 * Renders the Upload step UI (sidebar + canvas).
 * Single responsibility: Upload step presentation.
 */

"use client";

import { UploadSidebar } from "../sidebar";

interface UploadStepProps {
  // State
  hasBaseImage: boolean;
  baseImageUrl: string | null;
  isUploading: boolean;
  isDemoLoading: boolean;

  // Canvas dimensions
  canvasWidth: number;
  canvasHeight: number;

  // Handlers
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
}

export function UploadStepSidebar({
  hasBaseImage,
  isUploading,
  isDemoLoading,
  onFileSelect,
  onLoadDemo,
  onContinue,
}: Omit<UploadStepProps, "baseImageUrl" | "canvasWidth" | "canvasHeight">) {
  return (
    <UploadSidebar
      hasBaseImage={hasBaseImage}
      isUploading={isUploading}
      isDemoLoading={isDemoLoading}
      onFileSelect={onFileSelect}
      onLoadDemo={onLoadDemo}
      onContinue={onContinue}
    />
  );
}

export function UploadStepCanvas({
  hasBaseImage,
  baseImageUrl,
  canvasWidth,
  canvasHeight,
}: Pick<UploadStepProps, "hasBaseImage" | "baseImageUrl" | "canvasWidth" | "canvasHeight">) {
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
