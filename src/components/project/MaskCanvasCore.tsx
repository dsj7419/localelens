"use client";

import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { MaskTool } from "./sidebar/MaskSidebar";

export interface MaskCanvasCoreRef {
  save: () => string | null;
  undo: () => void;
  redo: () => void;
  editAll: () => void;
  keepAll: () => void;
  loadMask: (url: string) => void;
  getHasChanges: () => boolean;
  getCanUndo: () => boolean;
  getCanRedo: () => boolean;
}

interface MaskCanvasCoreProps {
  baseImageUrl: string | null;
  existingMaskUrl?: string | null;
  tool: MaskTool;
  brushSize: number;
  width?: number;
  height?: number;
  onStateChange?: (state: { hasChanges: boolean; canUndo: boolean; canRedo: boolean }) => void;
}

const MAX_HISTORY_SIZE = 30;

/**
 * MaskCanvasCore Component
 *
 * Canvas-only mask editor without toolbar.
 * Controlled via ref methods and props.
 */
export const MaskCanvasCore = forwardRef<MaskCanvasCoreRef, MaskCanvasCoreProps>(
  function MaskCanvasCore(
    {
      baseImageUrl,
      existingMaskUrl,
      tool,
      brushSize,
      width = 540,
      height = 960,
      onStateChange,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);

    // History state
    const historyRef = useRef<ImageData[]>([]);
    const positionRef = useRef(-1);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Notify parent of state changes
    useEffect(() => {
      onStateChange?.({ hasChanges, canUndo, canRedo });
    }, [hasChanges, canUndo, canRedo, onStateChange]);

    const updateButtonState = useCallback(() => {
      setCanUndo(positionRef.current > 0);
      setCanRedo(positionRef.current < historyRef.current.length - 1);
    }, []);

    const saveHistoryState = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (positionRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, positionRef.current + 1);
      }

      historyRef.current.push(imageData);
      positionRef.current = historyRef.current.length - 1;

      while (historyRef.current.length > MAX_HISTORY_SIZE) {
        historyRef.current.shift();
        positionRef.current = Math.max(0, positionRef.current - 1);
      }

      updateButtonState();
    }, [updateButtonState]);

    const initHistory = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current = [imageData];
      positionRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
    }, []);

    // Initialize canvas
    const initializeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !overlay) return;

      const ctx = canvas.getContext("2d");
      const overlayCtx = overlay.getContext("2d");
      if (!ctx || !overlayCtx) return;

      canvas.width = width;
      canvas.height = height;
      overlay.width = width;
      overlay.height = height;

      // Initialize to fully protected (black)
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      overlayCtx.clearRect(0, 0, width, height);

      historyRef.current = [];
      positionRef.current = -1;
      setCanUndo(false);
      setCanRedo(false);
    }, [width, height]);

    // Load mask from URL
    const loadMaskFromUrl = useCallback(
      (url: string) => {
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
          console.error("[MaskCanvasCore] Failed to load mask image");
        };
        img.src = url;
      },
      [width, height, initHistory]
    );

    useEffect(() => {
      initializeCanvas();
    }, [initializeCanvas]);

    useEffect(() => {
      if (existingMaskUrl) {
        loadMaskFromUrl(existingMaskUrl);
      }
    }, [existingMaskUrl, loadMaskFromUrl]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        save: () => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          setHasChanges(false);
          return canvas.toDataURL("image/png");
        },
        undo: () => {
          const canvas = canvasRef.current;
          if (!canvas || positionRef.current <= 0) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          positionRef.current--;
          const imageData = historyRef.current[positionRef.current];
          if (imageData) {
            ctx.putImageData(imageData, 0, 0);
          }
          setHasChanges(true);
          updateButtonState();
        },
        redo: () => {
          const canvas = canvasRef.current;
          if (!canvas || positionRef.current >= historyRef.current.length - 1) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          positionRef.current++;
          const imageData = historyRef.current[positionRef.current];
          if (imageData) {
            ctx.putImageData(imageData, 0, 0);
          }
          setHasChanges(true);
          updateButtonState();
        },
        editAll: () => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          saveHistoryState();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setHasChanges(true);
        },
        keepAll: () => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          saveHistoryState();
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          setHasChanges(true);
        },
        loadMask: loadMaskFromUrl,
        getHasChanges: () => hasChanges,
        getCanUndo: () => canUndo,
        getCanRedo: () => canRedo,
      }),
      [loadMaskFromUrl, hasChanges, canUndo, canRedo, saveHistoryState, updateButtonState]
    );

    // Get canvas coordinates
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

    // Draw with brush
    const drawBrush = useCallback(
      (x: number, y: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.beginPath();
        ctx.arc(x, y, brushSize, 0, Math.PI * 2);

        if (tool === "edit-brush") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000000";
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        } else if (tool === "keep-brush") {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#000000";
          ctx.fill();
        }

        setHasChanges(true);
      },
      [brushSize, tool]
    );

    // Draw brush preview
    const drawBrushPreview = useCallback(
      (x: number, y: number) => {
        const overlay = overlayRef.current;
        if (!overlay) return;

        const ctx = overlay.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.beginPath();
        ctx.arc(x, y, brushSize, 0, Math.PI * 2);
        ctx.strokeStyle =
          tool === "edit-brush" || tool === "edit-rect" || tool === "edit-ellipse"
            ? "rgba(59, 130, 246, 0.8)"
            : "rgba(249, 115, 22, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      },
      [brushSize, tool]
    );

    // Draw shape preview
    const drawShapePreview = useCallback(
      (startX: number, startY: number, endX: number, endY: number) => {
        const overlay = overlayRef.current;
        if (!overlay) return;

        const ctx = overlay.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, overlay.width, overlay.height);

        const isEdit = tool === "edit-rect" || tool === "edit-ellipse";
        ctx.strokeStyle = isEdit
          ? "rgba(59, 130, 246, 0.8)"
          : "rgba(249, 115, 22, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);

        if (tool === "edit-rect" || tool === "keep-rect") {
          ctx.strokeRect(x, y, w, h);
        } else {
          // Ellipse
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
      [tool]
    );

    // Finalize shape
    const finalizeShape = useCallback(
      (startX: number, startY: number, endX: number, endY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);

        const isEdit = tool === "edit-rect" || tool === "edit-ellipse";

        if (isEdit) {
          // Clear (make transparent)
          ctx.globalCompositeOperation = "destination-out";
        } else {
          // Fill with black (protect)
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#000000";
        }

        ctx.beginPath();
        if (tool === "edit-rect" || tool === "keep-rect") {
          ctx.rect(x, y, w, h);
        } else {
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        setHasChanges(true);
      },
      [tool]
    );

    // Mouse handlers
    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);

        // Save baseline on first operation
        if (!canUndo && !canRedo) {
          saveHistoryState();
        }

        if (tool.includes("rect") || tool.includes("ellipse")) {
          setShapeStart(coords);
        } else {
          setIsDrawing(true);
          drawBrush(coords.x, coords.y);
        }
      },
      [tool, getCanvasCoords, drawBrush, saveHistoryState, canUndo, canRedo]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);

        if (shapeStart) {
          drawShapePreview(shapeStart.x, shapeStart.y, coords.x, coords.y);
        } else if (tool === "edit-brush" || tool === "keep-brush") {
          drawBrushPreview(coords.x, coords.y);
          if (isDrawing) {
            drawBrush(coords.x, coords.y);
          }
        }
      },
      [tool, shapeStart, isDrawing, getCanvasCoords, drawBrush, drawBrushPreview, drawShapePreview]
    );

    const handleMouseUp = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);
        const overlay = overlayRef.current;

        if (shapeStart) {
          if (overlay) {
            const ctx = overlay.getContext("2d");
            ctx?.clearRect(0, 0, overlay.width, overlay.height);
          }
          finalizeShape(shapeStart.x, shapeStart.y, coords.x, coords.y);
          setShapeStart(null);
          saveHistoryState();
        } else if (isDrawing) {
          saveHistoryState();
        }

        setIsDrawing(false);
      },
      [shapeStart, isDrawing, getCanvasCoords, finalizeShape, saveHistoryState]
    );

    const handleMouseLeave = useCallback(() => {
      setIsDrawing(false);
      setShapeStart(null);

      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        ctx?.clearRect(0, 0, overlay.width, overlay.height);
      }
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            ref && "current" in ref && ref.current?.redo();
          } else {
            ref && "current" in ref && ref.current?.undo();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
          e.preventDefault();
          ref && "current" in ref && ref.current?.redo();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [ref]);

    return (
      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          width,
          height,
          background:
            "repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 50% / 20px 20px",
        }}
      >
        {/* Base image */}
        {baseImageUrl && (
          <img
            src={baseImageUrl}
            alt="Base"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Mask canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ opacity: 0.4, pointerEvents: "none" }}
        />

        {/* Interactive overlay */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Placeholder */}
        {!baseImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Upload a base image first
          </div>
        )}
      </div>
    );
  }
);
