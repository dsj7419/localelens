"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { useMaskHistory } from "./hooks/useMaskHistory";
import { Undo2, Redo2, Paintbrush, Eraser, Square, Trash2, Grid3X3 } from "lucide-react";

interface MaskCanvasProps {
  baseImageUrl: string | null;
  existingMaskUrl?: string | null;
  onSave: (maskDataUrl: string) => void;
  onLoadDemoMask?: () => void;
  width?: number;
  height?: number;
}

type Tool = "select" | "deselect" | "rectangle";

/**
 * MaskCanvas Component
 *
 * Canvas-based mask editor for defining editable regions.
 *
 * Mask Logic:
 * - Transparent (clear) = AI WILL edit this region
 * - White (opaque) = AI will NOT edit this region
 *
 * Tools:
 * - Select: Mark regions for AI editing (makes transparent)
 * - Deselect: Protect regions from AI editing (makes white)
 * - Rectangle: Quick rectangular selection
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
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [brushSize, setBrushSize] = useState(30);
  const [hasChanges, setHasChanges] = useState(false);
  const [maskVersion, setMaskVersion] = useState(0);

  // Rectangle drawing state
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);

  // History management
  const { saveState, undo, redo, clearHistory, initHistory, canUndo, canRedo } =
    useMaskHistory(canvasRef);

  /**
   * Initialize or reset canvas to fully protected (white)
   */
  const initializeCanvas = useCallback(() => {
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

    // Initialize to fully protected (white)
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fillRect(0, 0, width, height);

    // Clear overlay
    overlayCtx.clearRect(0, 0, width, height);
  }, [width, height]);

  /**
   * Load mask from URL onto canvas
   */
  const loadMaskFromUrl = useCallback((url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Reset composite operation before drawing
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, width, height);
      setHasChanges(false);
      initHistory();
    };
    img.onerror = () => {
      console.error("[MaskCanvas] Failed to load mask image");
    };
    img.src = url;
  }, [width, height, initHistory]);

  // Initialize canvas on mount
  useEffect(() => {
    initializeCanvas();
    clearHistory();
  }, [initializeCanvas, clearHistory]);

  // Load existing mask when URL changes or version increments
  useEffect(() => {
    if (existingMaskUrl) {
      loadMaskFromUrl(existingMaskUrl);
    }
  }, [existingMaskUrl, maskVersion, loadMaskFromUrl]);

  // Force reload when demo mask is loaded externally
  const handleLoadDemoMask = useCallback(() => {
    if (onLoadDemoMask) {
      onLoadDemoMask();
      // Increment version to force reload even if URL is the same
      setMaskVersion((v) => v + 1);
    }
  }, [onLoadDemoMask]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're focused on the canvas area
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== document.body) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

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

      if (tool === "select") {
        // Make transparent = AI will edit here
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill();
      } else if (tool === "deselect") {
        // Make white = AI will NOT edit here
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fill();
      }

      // Always reset composite operation
      ctx.globalCompositeOperation = "source-over";
      setHasChanges(true);
    },
    [brushSize, tool]
  );

  // Handle mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e);

      // Save state for undo BEFORE making changes
      saveState();

      if (tool === "rectangle") {
        setRectStart(coords);
      } else {
        setIsDrawing(true);
        draw(coords.x, coords.y);
      }
    },
    [tool, getCanvasCoords, draw, saveState]
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
        ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
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

            // Draw rectangle on mask (make transparent = editable)
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillRect(
              Math.min(rectStart.x, coords.x),
              Math.min(rectStart.y, coords.y),
              Math.abs(coords.x - rectStart.x),
              Math.abs(coords.y - rectStart.y)
            );
            // Reset composite operation
            ctx.globalCompositeOperation = "source-over";
            setHasChanges(true);
          }
        }
        setRectStart(null);
      }
      setIsDrawing(false);
    },
    [tool, rectStart, getCanvasCoords]
  );

  // Clear mask (all white = fully protected, nothing editable)
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveState();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasChanges(true);
  }, [saveState]);

  // Fill mask (all transparent = everything editable)
  const handleFillAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveState();
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasChanges(true);
  }, [saveState]);

  // Save mask as PNG
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    setHasChanges(false);
  }, [onSave]);

  // Handle undo with state update
  const handleUndo = useCallback(() => {
    undo();
    setHasChanges(true);
  }, [undo]);

  // Handle redo with state update
  const handleRedo = useCallback(() => {
    redo();
    setHasChanges(true);
  }, [redo]);

  return (
    <div className="space-y-4" ref={containerRef} tabIndex={-1}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tools */}
        <div className="flex items-center gap-1">
          <Button
            variant={tool === "select" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("select")}
            title="Select regions for AI to edit"
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            Select
          </Button>
          <Button
            variant={tool === "deselect" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("deselect")}
            title="Protect regions from AI editing"
          >
            <Eraser className="h-4 w-4 mr-1" />
            Protect
          </Button>
          <Button
            variant={tool === "rectangle" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("rectangle")}
            title="Draw rectangular selection"
          >
            <Square className="h-4 w-4 mr-1" />
            Rectangle
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Size:</span>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-sm w-6 text-right">{brushSize}</span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Canvas operations */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            title="Clear all selections (protect everything)"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFillAll}
            title="Select everything for editing"
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Select All
          </Button>
          {onLoadDemoMask && (
            <Button variant="outline" size="sm" onClick={handleLoadDemoMask}>
              Load Demo
            </Button>
          )}
        </div>

        {/* Save button */}
        <div className="ml-auto">
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="min-w-[100px]"
          >
            Save Mask
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        className="relative border border-border rounded-lg overflow-hidden"
        style={{
          width,
          height,
          background: "repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 50% / 20px 20px"
        }}
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

        {/* Mask canvas - red tint shows protected areas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            mixBlendMode: "multiply",
            opacity: 0.4,
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
            if (rectStart) {
              const overlay = overlayRef.current;
              if (overlay) {
                const ctx = overlay.getContext("2d");
                ctx?.clearRect(0, 0, overlay.width, overlay.height);
              }
            }
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

      {/* Help text */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          <strong>Select</strong> = mark regions for AI to edit (shows through).{" "}
          <strong>Protect</strong> = keep regions unchanged (tinted).
        </p>
        <p className="text-xs">
          Tip: Use <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Z</kbd> to undo,{" "}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Shift+Z</kbd> to redo.
        </p>
      </div>
    </div>
  );
}
