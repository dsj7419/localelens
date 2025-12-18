"use client";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Slider } from "~/components/ui/slider";
import { ToolButton, ToolGroup } from "../ToolButton";
import {
  Paintbrush,
  Shield,
  Square,
  Circle,
  Maximize2,
  Undo2,
  Redo2,
  ArrowRight,
  Download,
  Trash2,
} from "lucide-react";

export type MaskTool =
  | "edit-brush"
  | "keep-brush"
  | "edit-rect"
  | "keep-rect"
  | "edit-ellipse"
  | "keep-ellipse";

interface MaskSidebarProps {
  activeTool: MaskTool;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  hasChanges: boolean;
  hasMask: boolean;
  onToolChange: (tool: MaskTool) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onEditAll: () => void;
  onKeepAll: () => void;
  onLoadDemo?: () => void; // Optional - only shown for demo projects
  onSave: () => void;
  onDeleteMask?: () => void; // Optional - delete saved mask
  onContinue: () => void;
}

/**
 * MaskSidebar Component
 *
 * Sidebar panel for the Mask step.
 * Contains all mask editing tools organized in groups.
 */
export function MaskSidebar({
  activeTool,
  brushSize,
  canUndo,
  canRedo,
  hasChanges,
  hasMask,
  onToolChange,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onEditAll,
  onKeepAll,
  onLoadDemo,
  onSave,
  onDeleteMask,
  onContinue,
}: MaskSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-5">
        {/* Brushes */}
        <ToolGroup label="Brushes">
          <ToolButton
            icon={<Paintbrush className="h-4 w-4" />}
            label="Edit Brush"
            tooltip="Paint areas for AI to edit"
            isActive={activeTool === "edit-brush"}
            onClick={() => onToolChange("edit-brush")}
          />
          <ToolButton
            icon={<Shield className="h-4 w-4" />}
            label="Keep Brush"
            tooltip="Paint areas to keep unchanged"
            isActive={activeTool === "keep-brush"}
            onClick={() => onToolChange("keep-brush")}
          />
        </ToolGroup>

        {/* Shapes */}
        <ToolGroup label="Shapes">
          <ToolButton
            icon={<Square className="h-4 w-4" />}
            label="Edit Rectangle"
            tooltip="Draw rectangle area to edit"
            isActive={activeTool === "edit-rect"}
            onClick={() => onToolChange("edit-rect")}
          />
          <ToolButton
            icon={
              <span className="relative">
                <Square className="h-4 w-4" />
                <Shield className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
              </span>
            }
            label="Keep Rectangle"
            tooltip="Draw rectangle area to keep"
            isActive={activeTool === "keep-rect"}
            onClick={() => onToolChange("keep-rect")}
          />
          <ToolButton
            icon={<Circle className="h-4 w-4" />}
            label="Edit Ellipse"
            tooltip="Draw ellipse area to edit"
            isActive={activeTool === "edit-ellipse"}
            onClick={() => onToolChange("edit-ellipse")}
          />
          <ToolButton
            icon={
              <span className="relative">
                <Circle className="h-4 w-4" />
                <Shield className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
              </span>
            }
            label="Keep Ellipse"
            tooltip="Draw ellipse area to keep"
            isActive={activeTool === "keep-ellipse"}
            onClick={() => onToolChange("keep-ellipse")}
          />
        </ToolGroup>

        {/* Brush Size - only show for brush tools */}
        {(activeTool === "edit-brush" || activeTool === "keep-brush") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Brush Size
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {brushSize}px
              </span>
            </div>
            <Slider
              value={[brushSize]}
              onValueChange={([value]) => onBrushSizeChange(value ?? 30)}
              min={5}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        )}

        <Separator />

        {/* Fill Operations */}
        <ToolGroup label="Fill">
          <ToolButton
            icon={<Maximize2 className="h-4 w-4" />}
            label="Edit All"
            tooltip="Make entire image editable"
            onClick={onEditAll}
          />
          <ToolButton
            icon={<Shield className="h-4 w-4" />}
            label="Keep All"
            tooltip="Protect entire image"
            onClick={onKeepAll}
          />
        </ToolGroup>

        {/* History */}
        <ToolGroup label="History">
          <ToolButton
            icon={<Undo2 className="h-4 w-4" />}
            label="Undo"
            tooltip="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolButton
            icon={<Redo2 className="h-4 w-4" />}
            label="Redo"
            tooltip="Redo (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={onRedo}
          />
        </ToolGroup>

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          {onLoadDemo && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onLoadDemo}
            >
              <Download className="h-4 w-4" />
              Load Demo Mask
            </Button>
          )}
          <Button
            variant={hasChanges ? "default" : "outline"}
            size="sm"
            className="w-full"
            onClick={onSave}
            disabled={!hasChanges}
          >
            {hasChanges ? "Save Mask" : "Mask Saved"}
          </Button>
        </div>
      </div>

      {/* Continue Button */}
      <div className="pt-4 border-t border-border space-y-2">
        <div className="flex gap-2">
          <Button
            className="flex-1 gap-2"
            onClick={onContinue}
            disabled={!hasMask}
          >
            Continue to Generate
            <ArrowRight className="h-4 w-4" />
          </Button>
          {hasMask && onDeleteMask && (
            <Button
              variant="outline"
              size="icon"
              onClick={onDeleteMask}
              title="Delete saved mask and start over"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!hasMask && (
          <p className="text-xs text-muted-foreground text-center">
            Draw a mask and save it to continue
          </p>
        )}
      </div>
    </div>
  );
}
