/**
 * MaskStep Component
 *
 * Renders the Mask step UI (sidebar + canvas).
 * Single responsibility: Mask step presentation.
 */

"use client";

import type { RefObject } from "react";
import { MaskSidebar, type MaskTool } from "../sidebar";
import { MaskCanvasCore, type MaskCanvasCoreRef } from "../MaskCanvasCore";

interface MaskStepSidebarProps {
  // Tool state
  activeTool: MaskTool;
  brushSize: number;

  // Canvas state
  canUndo: boolean;
  canRedo: boolean;
  hasChanges: boolean;
  hasMask: boolean;

  // Demo mode
  isDemoProject: boolean;

  // Mask suggestion (Sprint 9)
  hasSuggestion: boolean;
  isApplyingSuggestion: boolean;
  suggestionRegionCount: number | null;

  // Tool handlers
  onToolChange: (tool: MaskTool) => void;
  onBrushSizeChange: (size: number) => void;

  // Canvas operations
  onUndo: () => void;
  onRedo: () => void;
  onEditAll: () => void;
  onKeepAll: () => void;

  // Actions
  onLoadDemo?: () => void;
  onApplySuggestion?: () => void;
  onSave: () => void;
  onDeleteMask: () => void;
  onContinue: () => void;
}

interface MaskStepCanvasProps {
  canvasRef: RefObject<MaskCanvasCoreRef | null>;
  baseImageUrl: string | null;
  maskUrl: string | null;
  tool: MaskTool;
  brushSize: number;
  width: number;
  height: number;
  onStateChange: (state: { hasChanges: boolean; canUndo: boolean; canRedo: boolean }) => void;
}

export function MaskStepSidebar({
  activeTool,
  brushSize,
  canUndo,
  canRedo,
  hasChanges,
  hasMask,
  isDemoProject,
  hasSuggestion,
  isApplyingSuggestion,
  suggestionRegionCount,
  onToolChange,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onEditAll,
  onKeepAll,
  onLoadDemo,
  onApplySuggestion,
  onSave,
  onDeleteMask,
  onContinue,
}: MaskStepSidebarProps) {
  return (
    <MaskSidebar
      activeTool={activeTool}
      brushSize={brushSize}
      canUndo={canUndo}
      canRedo={canRedo}
      hasChanges={hasChanges}
      hasMask={hasMask}
      hasSuggestion={hasSuggestion}
      isApplyingSuggestion={isApplyingSuggestion}
      suggestionRegionCount={suggestionRegionCount}
      onToolChange={onToolChange}
      onBrushSizeChange={onBrushSizeChange}
      onUndo={onUndo}
      onRedo={onRedo}
      onEditAll={onEditAll}
      onKeepAll={onKeepAll}
      onLoadDemo={isDemoProject ? onLoadDemo : undefined}
      onApplySuggestion={hasSuggestion ? onApplySuggestion : undefined}
      onSave={onSave}
      onDeleteMask={onDeleteMask}
      onContinue={onContinue}
    />
  );
}

export function MaskStepCanvas({
  canvasRef,
  baseImageUrl,
  maskUrl,
  tool,
  brushSize,
  width,
  height,
  onStateChange,
}: MaskStepCanvasProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <MaskCanvasCore
        ref={canvasRef}
        baseImageUrl={baseImageUrl}
        existingMaskUrl={maskUrl}
        tool={tool}
        brushSize={brushSize}
        width={width}
        height={height}
        onStateChange={onStateChange}
      />
    </div>
  );
}
