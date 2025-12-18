/**
 * useProjectQueries Hook
 *
 * Centralizes all project-related data fetching.
 * Single responsibility: Query orchestration for project data.
 */

import { api } from "~/trpc/react";
import type { LocaleId } from "~/server/domain/value-objects/locale";

interface UseProjectQueriesOptions {
  projectId: string;
  enabled?: boolean;
}

export function useProjectQueries({ projectId, enabled = true }: UseProjectQueriesOptions) {
  // Core project data
  const projectQuery = api.project.get.useQuery(
    { projectId },
    { enabled: enabled && !!projectId }
  );

  const baseImageQuery = api.project.getBaseImage.useQuery(
    { projectId },
    { enabled: enabled && !!projectId }
  );

  const maskQuery = api.project.getMask.useQuery(
    { projectId },
    { enabled: enabled && !!projectId }
  );

  // Derived data
  const aggregate = projectQuery.data?.aggregate;
  const project = aggregate?.project ?? null;
  const mask = aggregate?.mask ?? null;
  const variants = aggregate?.variants ?? [];

  // Computed flags
  const hasBaseImage = !!project?.baseImagePath;
  const hasMask = !!mask;
  const hasVariants = variants.length > 0;
  const isDemoProject = project?.name?.toLowerCase().includes("demo") ?? false;

  // Image URLs
  const baseImageUrl = baseImageQuery.data?.imageBase64 ?? null;
  const maskUrl = maskQuery.data?.maskBase64 ?? null;

  // Refetch functions
  const refetchAll = async () => {
    await Promise.all([
      projectQuery.refetch(),
      baseImageQuery.refetch(),
      maskQuery.refetch(),
    ]);
  };

  return {
    // Raw queries (for accessing loading states)
    projectQuery,
    baseImageQuery,
    maskQuery,

    // Derived data
    project,
    mask,
    variants,

    // Computed flags
    hasBaseImage,
    hasMask,
    hasVariants,
    isDemoProject,
    isLoading: projectQuery.isLoading,

    // Image URLs
    baseImageUrl,
    maskUrl,

    // Actions
    refetchProject: projectQuery.refetch,
    refetchBaseImage: baseImageQuery.refetch,
    refetchMask: maskQuery.refetch,
    refetchAll,
  };
}

/**
 * useVariantImage Hook
 *
 * Fetches a single variant image and overlay.
 * Call this hook for the currently selected variant only.
 */
export function useVariantImage(projectId: string, locale: LocaleId | null) {
  const variantQuery = api.project.getVariantImage.useQuery(
    { projectId, locale: locale! },
    { enabled: !!locale }
  );

  const overlayQuery = api.variant.getOverlay.useQuery(
    { projectId, locale: locale! },
    { enabled: !!locale }
  );

  return {
    imageUrl: variantQuery.data?.imageBase64 ?? null,
    overlayUrl: overlayQuery.data?.overlayBase64 ?? null,
    isLoading: variantQuery.isLoading || overlayQuery.isLoading,
  };
}
