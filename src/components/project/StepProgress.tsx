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
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                isActive && "bg-primary text-primary-foreground",
                !isActive && isCompleted && "bg-primary/20 text-primary hover:bg-primary/30",
                !isActive && !isCompleted && !isDisabled && "text-muted-foreground hover:text-foreground hover:bg-muted",
                isDisabled && "text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "flex items-center justify-center h-5 w-5 rounded-full transition-all",
                isActive && "bg-primary-foreground/20",
                isCompleted && !isActive && "bg-primary/30"
              )}>
                {isCompleted && !isActive ? (
                  <Check className="h-3 w-3" />
                ) : (
                  step.icon
                )}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>

            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 mx-1 rounded-full transition-colors",
                  isPast || isCompleted ? "bg-primary/40" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
