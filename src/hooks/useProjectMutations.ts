/**
 * useProjectMutations Hook
 *
 * Centralizes all project-related mutations.
 * Single responsibility: Mutation orchestration for project operations.
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { LocaleId } from "~/server/domain/value-objects/locale";

interface UseProjectMutationsOptions {
  projectId: string;
  onProjectChange?: () => void;
  onBaseImageChange?: () => void;
  onMaskChange?: () => void | Promise<unknown>;
  onVariantsChange?: () => void;
  onGenerationComplete?: (successCount: number, totalCount: number) => void;
  onGenerationError?: () => void;
}

export function useProjectMutations({
  projectId,
  onProjectChange,
  onBaseImageChange,
  onMaskChange,
  onVariantsChange,
  onGenerationComplete,
  onGenerationError,
}: UseProjectMutationsOptions) {
  // ─────────────────────────────────────────────────────────────────────────────
  // Image Upload Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const uploadBaseImage = api.project.uploadBaseImage.useMutation({
    onSuccess: () => {
      toast.success("Base image uploaded");
      onProjectChange?.();
      onBaseImageChange?.();
    },
    onError: (error) => toast.error("Upload failed", { description: error.message }),
  });

  const loadDemoBaseImage = api.project.loadDemoBaseImage.useMutation({
    onSuccess: () => {
      toast.success("Demo base image loaded");
      onProjectChange?.();
      onBaseImageChange?.();
    },
    onError: (error) => toast.error("Load failed", { description: error.message }),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Mask Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const saveMask = api.project.saveMask.useMutation({
    onSuccess: () => {
      toast.success("Mask saved");
      onProjectChange?.();
      onMaskChange?.();
    },
    onError: (error) => toast.error("Save failed", { description: error.message }),
  });

  const loadDemoMask = api.project.loadDemoMask.useMutation({
    onSuccess: () => {
      toast.success("Demo mask loaded");
      onProjectChange?.();
      // Note: caller should handle canvas reload via onMaskChange
    },
    onError: (error) => toast.error("Load failed", { description: error.message }),
  });

  const deleteMask = api.project.deleteMask.useMutation({
    onSuccess: () => {
      toast.success("Mask deleted");
      onProjectChange?.();
      onMaskChange?.();
    },
    onError: (error) => toast.error("Delete failed", { description: error.message }),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Generation Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const generateVariants = api.variant.generateAll.useMutation({
    onSuccess: (data) => {
      onProjectChange?.();
      onVariantsChange?.();
      if (data.successCount === data.totalCount) {
        toast.success("All variants generated successfully!");
      } else {
        toast.warning(`Generated ${data.successCount}/${data.totalCount} variants`);
      }
      onGenerationComplete?.(data.successCount, data.totalCount);
    },
    onError: (error) => {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes("403") || errorMsg.includes("forbidden") || errorMsg.includes("rate limit")) {
        toast.error("API unavailable", { description: "Try Demo Mode to see pre-generated outputs" });
      } else {
        toast.error("Generation failed", { description: error.message });
      }
      onGenerationError?.();
    },
  });

  const loadDemoOutputs = api.variant.loadDemoOutputs.useMutation({
    onSuccess: (data) => {
      onProjectChange?.();
      onVariantsChange?.();
      if (data.successCount === data.totalCount) {
        toast.success("Demo outputs loaded successfully!");
      } else {
        toast.warning(`Loaded ${data.successCount}/${data.totalCount} demo outputs`);
      }
      onGenerationComplete?.(data.successCount, data.totalCount);
    },
    onError: (error) => {
      toast.error("Demo mode failed", { description: error.message });
      onGenerationError?.();
    },
  });

  const regenerateVariant = api.variant.regenerateStricter.useMutation({
    onSuccess: (data) => {
      toast.success(`Regenerated. New drift: ${data.driftScore?.toFixed(2) ?? "N/A"}%`);
      onProjectChange?.();
      onVariantsChange?.();
    },
    onError: (error) => toast.error("Regeneration failed", { description: error.message }),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Export Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const exportZip = api.project.getExportZip.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = data.zipBase64;
      link.download = `localelens_${projectId}_variants.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`ZIP exported (${(data.fileSize / 1024).toFixed(1)} KB)`);
    },
    onError: (error) => toast.error("Export failed", { description: error.message }),
  });

  const generateMontage = api.project.getMontage.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = data.montageBase64;
      link.download = "localelens_montage_2x2.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Montage downloaded");
    },
    onError: (error) => toast.error("Montage generation failed", { description: error.message }),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Action Handlers (convenience wrappers)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        uploadBaseImage.mutate({ projectId, imageBase64: base64 });
      };
      reader.readAsDataURL(file);
    },
    [projectId, uploadBaseImage]
  );

  const handleSaveMask = useCallback(
    (getDataUrl: () => string | null) => {
      const dataUrl = getDataUrl();
      if (dataUrl) {
        saveMask.mutate({ projectId, maskBase64: dataUrl });
      }
    },
    [projectId, saveMask]
  );

  const handleGenerate = useCallback(
    (locales: LocaleId[]) => {
      if (locales.length === 0) {
        toast.error("Select at least one locale");
        return;
      }
      generateVariants.mutate({ projectId, locales });
    },
    [projectId, generateVariants]
  );

  const handleDemoMode = useCallback(
    (locales: LocaleId[]) => {
      if (locales.length === 0) {
        toast.error("Select at least one locale");
        return;
      }
      loadDemoOutputs.mutate({ projectId, locales });
    },
    [projectId, loadDemoOutputs]
  );

  return {
    // Mutations (for accessing isPending states)
    uploadBaseImage,
    loadDemoBaseImage,
    saveMask,
    loadDemoMask,
    deleteMask,
    generateVariants,
    loadDemoOutputs,
    regenerateVariant,
    exportZip,
    generateMontage,

    // Computed states
    isUploading: uploadBaseImage.isPending,
    isDemoLoading: loadDemoBaseImage.isPending,
    isSavingMask: saveMask.isPending,
    isGenerating: generateVariants.isPending || loadDemoOutputs.isPending,
    isRegenerating: regenerateVariant.isPending,
    isExporting: exportZip.isPending || generateMontage.isPending,

    // Action handlers
    handleFileUpload,
    handleSaveMask,
    handleGenerate,
    handleDemoMode,
  };
}
