/**
 * ImageLightbox Component
 *
 * Displays an image in a fullscreen modal overlay for detailed inspection.
 * Built for the LocaleLens contest to showcase localization results.
 *
 * Features:
 * - Click outside or press Escape to close (handled by Radix Dialog)
 * - Smooth fade-in/zoom animations
 * - Maximum image visibility while respecting viewport bounds
 * - Accessible with screen reader support
 * - Loading state with smooth image reveal
 *
 * ED-059: ImageLightbox for click-to-zoom on result images.
 */

"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "~/components/ui/dialog";
import { ZoomIn } from "lucide-react";

interface ImageLightboxProps {
  /** Whether the lightbox is open */
  open: boolean;
  /** Callback when lightbox should close */
  onOpenChange: (open: boolean) => void;
  /** URL of the image to display */
  imageUrl: string | null;
  /** Title/label for the image (shown visually and for accessibility) */
  title: string;
}

export function ImageLightbox({
  open,
  onOpenChange,
  imageUrl,
  title,
}: ImageLightboxProps) {
  // Track image loading state for smooth reveal
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset loading state when dialog closes or image changes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      // Small delay to allow close animation before resetting
      setTimeout(() => setImageLoaded(false), 200);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  // Handle image load completion
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-[95vw] !max-h-[95vh] !w-auto !h-auto !p-3 !gap-2 bg-background/98 backdrop-blur-md border-border/50 shadow-2xl"
        showCloseButton={true}
      >
        {/* Screen reader accessible title (visually hidden) */}
        <DialogTitle className="sr-only">{title} - Full Size View</DialogTitle>

        {/* Visual title bar with context */}
        <div className="flex items-center justify-center gap-2 text-sm text-foreground/80 pb-1">
          <ZoomIn className="h-4 w-4 text-primary/70" />
          <span className="font-medium">{title}</span>
          <span className="text-xs text-muted-foreground ml-1">
            (Esc to close)
          </span>
        </div>

        {/* Image container with loading state */}
        <div className="relative flex items-center justify-center min-h-[200px]">
          {/* Loading spinner - shown until image loads */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          )}

          {/* Full-size image with smooth reveal */}
          <img
            src={imageUrl}
            alt={title}
            onLoad={handleImageLoad}
            className={`max-w-[90vw] max-h-[85vh] object-contain rounded-md shadow-lg transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        {/* Subtle hint footer */}
        <div className="text-center text-xs text-muted-foreground/60 pt-1">
          Click outside the image to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
