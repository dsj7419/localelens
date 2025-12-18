"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

interface MaskCanvasProps {
  baseImageUrl: string | null;
  existingMaskUrl?: string | null;
  onSave: (maskDataUrl: string) => void;
  onLoadDemoMask?: () => void;
  width?: number;
  height?: number;
}

type Tool = "brush" | "eraser" | "rectangle";

/**
 * MaskCanvas Component
 *
 * Canvas-based mask editor for defining editable regions.
 * Transparent regions in the mask = areas that will be edited.
 */
export function MaskCanvas({
  baseImageUrl,
  existingMaskUrl,
  onSave,
  onLoadDemoMask,
  width = 540,
  height = 960,
}: MaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(30);
  const [hasChanges, setHasChanges] = useState(false);

  // Rectangle drawing state
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);

  // Initialize canvas with base image
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const ctx = canvas.getContext("2d");
    const overlayCtx = overlay.getContext("2d");
    if (!ctx || !overlayCtx) return;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;

    // Initialize mask canvas (solid white = keep, transparent = edit)
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fillRect(0, 0, width, height);

    // Load existing mask if provided
    if (existingMaskUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasChanges(false);
      };
      img.src = existingMaskUrl;
    }
  }, [width, height, existingMaskUrl]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = overlayRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  // Draw on mask canvas
  const draw = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);

      if (tool === "brush") {
        // Transparent = editable region
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill();
      } else if (tool === "eraser") {
        // White = keep region
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fill();
      }

      setHasChanges(true);
    },
    [brushSize, tool]
  );

  // Handle mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e);

      if (tool === "rectangle") {
        setRectStart(coords);
      } else {
        setIsDrawing(true);
        draw(coords.x, coords.y);
      }
    },
    [tool, getCanvasCoords, draw]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e);

      if (tool === "rectangle" && rectStart) {
        // Draw preview rectangle on overlay
        const overlay = overlayRef.current;
        if (!overlay) return;

        const ctx = overlay.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          rectStart.x,
          rectStart.y,
          coords.x - rectStart.x,
          coords.y - rectStart.y
        );
      } else if (isDrawing) {
        draw(coords.x, coords.y);
      }
    },
    [tool, rectStart, isDrawing, getCanvasCoords, draw]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool === "rectangle" && rectStart) {
        const coords = getCanvasCoords(e);
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;

        if (canvas && overlay) {
          const ctx = canvas.getContext("2d");
          const overlayCtx = overlay.getContext("2d");

          if (ctx && overlayCtx) {
            // Clear overlay
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

            // Draw rectangle on mask (transparent)
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillRect(
              Math.min(rectStart.x, coords.x),
              Math.min(rectStart.y, coords.y),
              Math.abs(coords.x - rectStart.x),
              Math.abs(coords.y - rectStart.y)
            );
            setHasChanges(true);
          }
        }
        setRectStart(null);
      }
      setIsDrawing(false);
    },
    [tool, rectStart, getCanvasCoords]
  );

  // Clear mask (all white = no editable regions)
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasChanges(true);
  }, []);

  // Fill mask (all transparent = everything editable)
  const handleFillAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasChanges(true);
  }, []);

  // Save mask as PNG
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    setHasChanges(false);
  }, [onSave]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant={tool === "brush" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("brush")}
          >
            Brush
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("eraser")}
          >
            Eraser
          </Button>
          <Button
            variant={tool === "rectangle" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("rectangle")}
          >
            Rectangle
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Size:</span>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm w-8">{brushSize}</span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={handleFillAll}>
            Fill All
          </Button>
          {onLoadDemoMask && (
            <Button variant="outline" size="sm" onClick={onLoadDemoMask}>
              Load Demo Mask
            </Button>
          )}
        </div>

        <div className="ml-auto">
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="min-w-25"
          >
            Save Mask
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        className="relative border border-border rounded-lg overflow-hidden bg-[repeating-conic-gradient(#808080_0%_25%,transparent_0%_50%)] bg-size-[20px_20px]"
        style={{ width, height }}
      >
        {/* Base image layer */}
        {baseImageUrl && (
          <img
            src={baseImageUrl}
            alt="Base"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Mask canvas (semi-transparent red overlay to show editable regions) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            mixBlendMode: "multiply",
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />

        {/* Interactive overlay canvas */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDrawing(false);
            setRectStart(null);
          }}
        />

        {/* Placeholder when no base image */}
        {!baseImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Upload a base image first
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Paint regions to mark as editable (transparent). White areas will be preserved.
      </p>
    </div>
  );
}
