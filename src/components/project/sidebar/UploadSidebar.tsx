"use client";

import { useRef } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Upload, Sparkles, FileImage, ArrowRight } from "lucide-react";

interface UploadSidebarProps {
  hasBaseImage: boolean;
  isUploading: boolean;
  isDemoLoading: boolean;
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

        {/* File Info */}
        {hasBaseImage && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileImage className="h-4 w-4" />
                <span>Image loaded</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Continue Button */}
      <div className="pt-4 border-t border-border space-y-2">
        <Button
          className="w-full gap-2"
          onClick={onContinue}
          disabled={!hasBaseImage}
        >
          Continue to Mask
          <ArrowRight className="h-4 w-4" />
        </Button>
        {!hasBaseImage && (
          <p className="text-xs text-muted-foreground text-center">
            Upload an image to continue
          </p>
        )}
      </div>
    </div>
  );
}
