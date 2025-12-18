"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { useMaskHistory } from "./hooks/useMaskHistory";
import { Undo2, Redo2, Paintbrush, Shield, Square, Trash2, Maximize2 } from "lucide-react";

interface MaskCanvasProps {
  baseImageUrl: string | null;
  existingMaskUrl?: string | null;
  onSave: (maskDataUrl: string) => void;
  onLoadDemoMask?: () => void;
  width?: number;
  height?: number;
}

type Tool = "edit" | "keep" | "rectangle";

/**
 * MaskCanvas Component
 *
 * Canvas-based mask editor for defining editable regions.
 * Uses the SAME format as OpenAI API expects:
 * - Opaque (black) = Protected (AI will NOT edit these areas)
 * - Transparent = Editable (AI WILL edit these areas)
 *
 * Visual Display:
 * - Black areas shown as dark overlay = Protected/Keep
 * - Transparent areas show base image clearly = Will be edited
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
  const [tool, setTool] = useState<Tool>("edit");
  const [brushSize, setBrushSize] = useState(30);
  const [hasChanges, setHasChanges] = useState(false);
  const [maskVersion, setMaskVersion] = useState(0);

  // Rectangle drawing state
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);

  // History management
  const { saveState, undo, redo, clearHistory, initHistory, canUndo, canRedo } =
    useMaskHistory(canvasRef);

  /**
   * Initialize canvas to fully protected (black fill)
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

    // Initialize to fully protected (black = opaque = AI won't edit)
    ctx.fillStyle = "#000000";
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
      setMaskVersion((v) => v + 1);
    }
  }, [onLoadDemoMask]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      if (tool === "edit") {
        // Make transparent = AI will edit here
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "#000000";
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (tool === "keep") {
        // Make black (opaque) = AI will NOT edit here
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#000000";
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

      // Save baseline state only on very first operation
      // (subsequent saves happen on mouseUp)
      if (!canUndo && !canRedo) {
        saveState();
      }

      if (tool === "rectangle") {
        setRectStart(coords);
      } else {
        setIsDrawing(true);
        draw(coords.x, coords.y);
      }
    },
    [tool, getCanvasCoords, draw, saveState, canUndo, canRedo]
  );

  // Draw brush preview cursor on overlay
  const drawBrushPreview = useCallback(
    (x: number, y: number) => {
      const overlay = overlayRef.current;
      if (!overlay) return;

      const ctx = overlay.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      // Blue for edit (erase), orange for keep (protect)
      ctx.strokeStyle = tool === "edit" ? "rgba(59, 130, 246, 0.8)" : "rgba(249, 115, 22, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    },
    [brushSize, tool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e);

      if (tool === "rectangle" && rectStart) {
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
      } else if (tool !== "rectangle") {
        drawBrushPreview(coords.x, coords.y);

        if (isDrawing) {
          draw(coords.x, coords.y);
        }
      }
    },
    [tool, rectStart, isDrawing, getCanvasCoords, draw, drawBrushPreview]
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
            overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

            const x = Math.min(rectStart.x, coords.x);
            const y = Math.min(rectStart.y, coords.y);
            const w = Math.abs(coords.x - rectStart.x);
            const h = Math.abs(coords.y - rectStart.y);
            ctx.clearRect(x, y, w, h);
            setHasChanges(true);
          }
        }
        setRectStart(null);
        // Save final state after rectangle operation
        saveState();
      } else if (isDrawing) {
        // Save final state after brush stroke completes
        saveState();
      }
      setIsDrawing(false);
    },
    [tool, rectStart, getCanvasCoords, isDrawing, saveState]
  );

  // Protect All - fill with black (AI won't edit anything)
  const handleProtectAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveState();
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasChanges(true);
  }, [saveState]);

  // Edit All - clear to transparent (AI will edit everything)
  const handleEditAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveState();
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

  const handleUndo = useCallback(() => {
    undo();
    setHasChanges(true);
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
    setHasChanges(true);
  }, [redo]);

  return (
    <div className="space-y-4" ref={containerRef} tabIndex={-1}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Brush Tools */}
        <div className="flex items-center gap-1">
          <Button
            variant={tool === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("edit")}
            title="Paint areas for AI to edit (erases protection)"
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            Edit Brush
          </Button>
          <Button
            variant={tool === "keep" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("keep")}
            title="Paint areas to keep unchanged (adds protection)"
          >
            <Shield className="h-4 w-4 mr-1" />
            Keep Brush
          </Button>
          <Button
            variant={tool === "rectangle" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("rectangle")}
            title="Draw rectangle area for AI to edit"
          >
            <Square className="h-4 w-4 mr-1" />
            Edit Rect
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

        {/* Fill Operations */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleProtectAll}
            title="Keep everything - fill with protection"
          >
            <Shield className="h-4 w-4 mr-1" />
            Keep All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditAll}
            title="Edit everything - remove all protection"
          >
            <Maximize2 className="h-4 w-4 mr-1" />
            Edit All
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Demo & Save */}
        <div className="flex items-center gap-1">
          {onLoadDemoMask && (
            <Button variant="outline" size="sm" onClick={handleLoadDemoMask}>
              Load Demo
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="min-w-24"
          >
            Save Mask
          </Button>
        </div>
      </div>

      {/* Canvas container - CENTERED */}
      <div className="flex justify-center">
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

          {/* Mask canvas - white areas shown as overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{
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
              const overlay = overlayRef.current;
              if (overlay) {
                const ctx = overlay.getContext("2d");
                ctx?.clearRect(0, 0, overlay.width, overlay.height);
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
      </div>

      {/* Help text */}
      <div className="text-sm text-muted-foreground space-y-1 text-center">
        <p>
          <span className="inline-block w-3 h-3 bg-black/40 border border-border rounded mr-1 align-middle"></span>
          <strong>Dark overlay</strong> = Protected (AI keeps this).{" "}
          <span className="inline-block w-3 h-3 bg-transparent border border-border rounded mr-1 align-middle"></span>
          <strong>Clear</strong> = AI will edit this.
        </p>
        <p className="text-xs">
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Z</kbd> undo |{" "}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Shift+Z</kbd> redo
        </p>
      </div>
    </div>
  );
}
