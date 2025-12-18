/**
 * useKeyboardShortcuts Hook
 *
 * Handles global keyboard shortcuts for the application.
 * Single responsibility: Keyboard event management.
 */

import { useEffect, useCallback } from "react";
import type { MaskTool } from "~/components/project/sidebar";
import type { WorkflowStep } from "~/components/project/StepProgress";

interface KeyboardShortcutsOptions {
  /** Current workflow step (shortcuts only active on mask step) */
  currentStep: WorkflowStep;
  /** Callback for undo action */
  onUndo?: () => void;
  /** Callback for redo action */
  onRedo?: () => void;
  /** Callback for tool change */
  onToolChange?: (tool: MaskTool) => void;
  /** Callback for save mask */
  onSave?: () => void;
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

/**
 * Keyboard shortcut mappings
 */
export const SHORTCUTS = {
  undo: { key: "z", ctrlKey: true, label: "Ctrl+Z" },
  redo: { key: "y", ctrlKey: true, label: "Ctrl+Y" },
  redoAlt: { key: "z", ctrlKey: true, shiftKey: true, label: "Ctrl+Shift+Z" },
  brush: { key: "b", label: "B" },
  rectangle: { key: "r", label: "R" },
  ellipse: { key: "e", label: "E" },
  eraser: { key: "x", label: "X" },
  save: { key: "s", ctrlKey: true, label: "Ctrl+S" },
} as const;

/**
 * Get shortcut label for a tool
 */
export function getToolShortcut(tool: MaskTool): string | undefined {
  switch (tool) {
    case "edit-brush":
      return SHORTCUTS.brush.label;
    case "edit-rect":
      return SHORTCUTS.rectangle.label;
    case "edit-ellipse":
      return SHORTCUTS.ellipse.label;
    case "keep-brush":
      return SHORTCUTS.eraser.label;
    default:
      return undefined;
  }
}

/**
 * useKeyboardShortcuts Hook
 *
 * Registers keyboard shortcuts for mask editing operations.
 * Shortcuts are only active when on the mask step.
 */
export function useKeyboardShortcuts({
  currentStep,
  onUndo,
  onRedo,
  onToolChange,
  onSave,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only handle shortcuts on mask step
      if (currentStep !== "mask" || !enabled) return;

      // Don't handle shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isModifier = ctrlKey || metaKey;
      const lowerKey = key.toLowerCase();

      // Undo: Ctrl+Z / Cmd+Z
      if (isModifier && lowerKey === "z" && !shiftKey) {
        event.preventDefault();
        onUndo?.();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      if (isModifier && (lowerKey === "y" || (lowerKey === "z" && shiftKey))) {
        event.preventDefault();
        onRedo?.();
        return;
      }

      // Save: Ctrl+S / Cmd+S
      if (isModifier && lowerKey === "s") {
        event.preventDefault();
        onSave?.();
        return;
      }

      // Tool shortcuts (no modifier)
      if (!isModifier && !shiftKey) {
        switch (lowerKey) {
          case "b":
            event.preventDefault();
            onToolChange?.("edit-brush");
            break;
          case "r":
            event.preventDefault();
            onToolChange?.("edit-rect");
            break;
          case "e":
            event.preventDefault();
            onToolChange?.("edit-ellipse");
            break;
          case "x":
            event.preventDefault();
            onToolChange?.("keep-brush");
            break;
        }
      }
    },
    [currentStep, enabled, onUndo, onRedo, onToolChange, onSave]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts: SHORTCUTS,
    getToolShortcut,
  };
}
