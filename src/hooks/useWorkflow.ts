/**
 * useWorkflow Hook
 *
 * Manages workflow step navigation and state.
 * Single responsibility: Workflow step management.
 */

import { useState, useCallback, useMemo } from "react";
import type { WorkflowStep } from "~/components/project/StepProgress";

interface WorkflowState {
  hasBaseImage: boolean;
  hasMask: boolean;
  hasVariants: boolean;
}

export function useWorkflow(state: WorkflowState) {
  const { hasBaseImage, hasMask, hasVariants } = state;

  const [currentStep, setCurrentStep] = useState<WorkflowStep>("upload");

  // Compute completed steps
  const completedSteps = useMemo<WorkflowStep[]>(() => {
    const completed: WorkflowStep[] = [];
    if (hasBaseImage) completed.push("upload");
    if (hasMask) completed.push("mask");
    if (hasVariants) completed.push("generate");
    return completed;
  }, [hasBaseImage, hasMask, hasVariants]);

  // Compute disabled steps
  const disabledSteps = useMemo<WorkflowStep[]>(() => {
    const disabled: WorkflowStep[] = [];
    if (!hasBaseImage) {
      disabled.push("mask", "generate", "results");
    } else if (!hasMask) {
      disabled.push("generate", "results");
    } else if (!hasVariants) {
      disabled.push("results");
    }
    return disabled;
  }, [hasBaseImage, hasMask, hasVariants]);

  // Navigation helpers
  const goToUpload = useCallback(() => setCurrentStep("upload"), []);
  const goToMask = useCallback(() => setCurrentStep("mask"), []);
  const goToGenerate = useCallback(() => setCurrentStep("generate"), []);
  const goToResults = useCallback(() => setCurrentStep("results"), []);

  const canGoToMask = hasBaseImage;
  const canGoToGenerate = hasBaseImage && hasMask;
  const canGoToResults = hasBaseImage && hasMask && hasVariants;

  return {
    currentStep,
    setCurrentStep,
    completedSteps,
    disabledSteps,

    // Navigation
    goToUpload,
    goToMask,
    goToGenerate,
    goToResults,

    // Guards
    canGoToMask,
    canGoToGenerate,
    canGoToResults,
  };
}
