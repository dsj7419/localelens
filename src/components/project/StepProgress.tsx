"use client";

import { cn } from "~/lib/utils";
import { Upload, PaintBucket, Sparkles, LayoutGrid, Check } from "lucide-react";

export type WorkflowStep = "upload" | "mask" | "generate" | "results";

interface StepConfig {
  id: WorkflowStep;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
  { id: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
  { id: "mask", label: "Mask", icon: <PaintBucket className="h-4 w-4" /> },
  { id: "generate", label: "Generate", icon: <Sparkles className="h-4 w-4" /> },
  { id: "results", label: "Results", icon: <LayoutGrid className="h-4 w-4" /> },
];

interface StepProgressProps {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  onStepClick: (step: WorkflowStep) => void;
  disabledSteps?: WorkflowStep[];
}

/**
 * StepProgress Component
 *
 * Horizontal step indicator for the workflow.
 * Shows current position, completed steps, and allows navigation.
 * Features smooth animations and visual feedback.
 */
export function StepProgress({
  currentStep,
  completedSteps,
  onStepClick,
  disabledSteps = [],
}: StepProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.includes(step.id);
        const isDisabled = disabledSteps.includes(step.id);
        const isPast = index < currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Button */}
            <button
              onClick={() => !isDisabled && onStepClick(step.id)}
              disabled={isDisabled}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                "transition-all duration-300 ease-out",
                // Active state with glow
                isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
                // Completed state
                !isActive && isCompleted && "bg-primary/15 text-primary hover:bg-primary/25",
                // Available but not yet reached
                !isActive && !isCompleted && !isDisabled && "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                // Disabled
                isDisabled && "text-muted-foreground/40 cursor-not-allowed opacity-50"
              )}
            >
              {/* Icon container with animation */}
              <span className={cn(
                "flex items-center justify-center h-5 w-5 rounded-full transition-all duration-300",
                isActive && "bg-primary-foreground/20 scale-110",
                isCompleted && !isActive && "bg-primary/20",
                // Subtle pulse for active step
                isActive && "animate-pulse"
              )}>
                {isCompleted && !isActive ? (
                  <Check className="h-3 w-3 animate-in zoom-in-50 duration-200" />
                ) : (
                  <span className={cn(
                    "transition-transform duration-200",
                    isActive && "scale-110"
                  )}>
                    {step.icon}
                  </span>
                )}
              </span>
              <span className="hidden sm:inline">{step.label}</span>

              {/* Active indicator ring */}
              {isActive && (
                <span className="absolute inset-0 rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background animate-in zoom-in-95 duration-200" />
              )}
            </button>

            {/* Connector Line with animated fill */}
            {index < STEPS.length - 1 && (
              <div className="relative w-8 h-0.5 mx-1 rounded-full bg-border overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all duration-500 ease-out",
                    (isPast || (isCompleted && completedSteps.includes(STEPS[index + 1]?.id ?? "" as WorkflowStep)))
                      ? "w-full"
                      : isCompleted
                        ? "w-1/2"
                        : "w-0"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
