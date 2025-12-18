import { useCallback, useRef, useState } from "react";

const MAX_HISTORY_SIZE = 50;

/**
 * useMaskHistory Hook
 *
 * Single Responsibility: Manage undo/redo history for canvas operations.
 * Stores canvas ImageData snapshots for efficient memory usage.
 */
export function useMaskHistory(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /**
   * Save current canvas state to history
   * Call this BEFORE making any changes
   */
  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Truncate any "future" history if we're not at the end
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Add new state
    historyRef.current.push(imageData);

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, [canvasRef]);

  /**
   * Undo last operation
   */
  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    historyIndexRef.current--;
    const imageData = historyRef.current[historyIndexRef.current];
    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
    }

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, [canvasRef]);

  /**
   * Redo previously undone operation
   */
  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    historyIndexRef.current++;
    const imageData = historyRef.current[historyIndexRef.current];
    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
    }

    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [canvasRef]);

  /**
   * Clear all history (call when canvas is reset)
   */
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  /**
   * Initialize history with current state
   */
  const initHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = [imageData];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, [canvasRef]);

  return {
    saveState,
    undo,
    redo,
    clearHistory,
    initHistory,
    canUndo,
    canRedo,
  };
}
