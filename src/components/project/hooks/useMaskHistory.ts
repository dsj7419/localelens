import { useCallback, useRef, useState } from "react";

const MAX_HISTORY_SIZE = 30;

/**
 * useMaskHistory Hook
 *
 * Simple undo/redo history for canvas operations.
 *
 * Model: Save state BEFORE each operation. First save becomes the baseline.
 * - Position 0: State before first operation (baseline)
 * - Position 1: State before second operation (after first completed)
 * - etc.
 *
 * Undo goes back to previous saved state.
 * Redo goes forward to next saved state.
 */
export function useMaskHistory(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const historyRef = useRef<ImageData[]>([]);
  const positionRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateButtonState = useCallback(() => {
    setCanUndo(positionRef.current > 0);
    setCanRedo(positionRef.current < historyRef.current.length - 1);
  }, []);

  /**
   * Save current canvas state to history.
   * Call this BEFORE making any changes.
   */
  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Truncate any future history if we're not at the end
    if (positionRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, positionRef.current + 1);
    }

    // Add new state
    historyRef.current.push(imageData);
    positionRef.current = historyRef.current.length - 1;

    // Enforce max size
    while (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current.shift();
      positionRef.current = Math.max(0, positionRef.current - 1);
    }

    updateButtonState();
  }, [canvasRef, updateButtonState]);

  /**
   * Undo - restore previous state
   */
  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || positionRef.current <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    positionRef.current--;
    const imageData = historyRef.current[positionRef.current];
    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
    }

    updateButtonState();
  }, [canvasRef, updateButtonState]);

  /**
   * Redo - restore next state
   */
  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || positionRef.current >= historyRef.current.length - 1) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    positionRef.current++;
    const imageData = historyRef.current[positionRef.current];
    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
    }

    updateButtonState();
  }, [canvasRef, updateButtonState]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    positionRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  /**
   * Initialize history with current canvas state as baseline.
   * Call after canvas is fully set up with initial content.
   */
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
