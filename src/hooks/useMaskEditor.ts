/**
 * useMaskEditor Hook
 *
 * Manages mask editing state and canvas operations.
 * Single responsibility: Mask editor state management.
 */

import { useState, useRef, useCallback } from "react";
import type { MaskCanvasCoreRef } from "~/components/project/MaskCanvasCore";
import type { MaskTool } from "~/components/project/sidebar";

interface MaskEditorState {
  hasChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export function useMaskEditor() {
  // Tool state
  const [activeTool, setActiveTool] = useState<MaskTool>("edit-brush");
  const [brushSize, setBrushSize] = useState(30);

  // Canvas state
  const [state, setState] = useState<MaskEditorState>({
    hasChanges: false,
    canUndo: false,
    canRedo: false,
  });

  // Canvas ref
  const canvasRef = useRef<MaskCanvasCoreRef>(null);

  // Canvas operations
  const undo = useCallback(() => canvasRef.current?.undo(), []);
  const redo = useCallback(() => canvasRef.current?.redo(), []);
  const editAll = useCallback(() => canvasRef.current?.editAll(), []);
  const keepAll = useCallback(() => canvasRef.current?.keepAll(), []);

  const save = useCallback((): string | null => {
    return canvasRef.current?.save() ?? null;
  }, []);

  const loadMask = useCallback((url: string) => {
    canvasRef.current?.loadMask(url);
  }, []);

  const clearCanvas = useCallback(() => {
    canvasRef.current?.keepAll();
    setState({ hasChanges: false, canUndo: false, canRedo: false });
  }, []);

  // State update handler (passed to canvas)
  const handleStateChange = useCallback((newState: MaskEditorState) => {
    setState(newState);
  }, []);

  return {
    // Ref (pass to MaskCanvasCore)
    canvasRef,

    // Tool state
    activeTool,
    brushSize,
    setActiveTool,
    setBrushSize,

    // Canvas state
    hasChanges: state.hasChanges,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    handleStateChange,

    // Canvas operations
    undo,
    redo,
    editAll,
    keepAll,
    save,
    loadMask,
    clearCanvas,
  };
}
