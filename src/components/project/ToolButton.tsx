"use client";

import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  isActive?: boolean;
  disabled?: boolean;
  variant?: "default" | "primary" | "destructive";
  onClick: () => void;
  className?: string;
}

/**
 * ToolButton Component
 *
 * Icon button with tooltip for toolbars.
 * Supports active state and variants.
 */
export function ToolButton({
  icon,
  label,
  tooltip,
  isActive = false,
  disabled = false,
  variant = "default",
  onClick,
  className,
}: ToolButtonProps) {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center h-9 w-9 rounded-lg transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "default" && !isActive && "hover:bg-accent text-muted-foreground hover:text-foreground",
        variant === "default" && isActive && "bg-primary text-primary-foreground",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={label}
    >
      {icon}
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

interface ToolGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * ToolGroup Component
 *
 * Groups related tools with a label.
 */
export function ToolGroup({ label, children, className }: ToolGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {children}
      </div>
    </div>
  );
}
