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
 * useVariantImages Hook
 *
 * Fetches variant and overlay images for results display.
 * Separated from main queries due to dynamic nature.
 */
export function useVariantImages(projectId: string, variants: Array<{ locale: LocaleId }>) {
  // Create queries for each variant's image
  const variantQueries = variants.map((v) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api.project.getVariantImage.useQuery({ projectId, locale: v.locale })
  );

  const overlayQueries = variants.map((v) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api.variant.getOverlay.useQuery({ projectId, locale: v.locale })
  );

  const getVariantImageUrl = (locale: LocaleId): string | null => {
    const index = variants.findIndex((v) => v.locale === locale);
    if (index === -1) return null;
    return variantQueries[index]?.data?.imageBase64 ?? null;
  };

  const getOverlayImageUrl = (locale: LocaleId): string | null => {
    const index = variants.findIndex((v) => v.locale === locale);
    if (index === -1) return null;
    return overlayQueries[index]?.data?.overlayBase64 ?? null;
  };

  return {
    variantQueries,
    overlayQueries,
    getVariantImageUrl,
    getOverlayImageUrl,
  };
}
