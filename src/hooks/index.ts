/**
 * Hooks Index
 *
 * Re-exports all custom hooks for clean imports.
 */

export { useProjectQueries, useVariantImage } from "./useProjectQueries";
export { useProjectMutations } from "./useProjectMutations";
export { useMaskEditor } from "./useMaskEditor";
export { useWorkflow } from "./useWorkflow";
export { useResultsState } from "./useResultsState";
export { useKeyboardShortcuts, getToolShortcut, SHORTCUTS } from "./useKeyboardShortcuts";
export { useStreamingGeneration } from "./useStreamingGeneration";
export type {
  StreamingGenerationOptions,
  StreamingProgress,
  StreamingResult,
  UseStreamingGenerationReturn,
} from "./useStreamingGeneration";
