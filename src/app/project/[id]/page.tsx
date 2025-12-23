/**
 * Project Page
 *
 * Main project workflow page with sidebar + canvas layout.
 * Uses custom hooks for state management and step components for rendering.
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "~/trpc/react";

import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";

import { Logo } from "~/components/Logo";
import { StepProgress } from "~/components/project/StepProgress";
import {
  UploadStepSidebar,
  UploadStepCanvas,
  MaskStepSidebar,
  MaskStepCanvas,
  GenerateStepSidebar,
  GenerateStepCanvas,
  ResultsStepSidebar,
  ResultsStepCanvas,
} from "~/components/project/steps";
import {
  useProjectQueries,
  useVariantImage,
  useProjectMutations,
  useMaskEditor,
  useWorkflow,
  useResultsState,
  useKeyboardShortcuts,
  useStreamingGeneration,
} from "~/hooks";
import { SUPPORTED_LOCALES, type LocaleId } from "~/server/domain/value-objects/locale";

// Canvas container dimensions (max size)
const MAX_CANVAS_WIDTH = 540;
const MAX_CANVAS_HEIGHT = 960;

/**
 * Calculate canvas dimensions that preserve base image aspect ratio
 * while fitting within the max container size.
 */
function calculateCanvasDimensions(
  baseWidth: number | null,
  baseHeight: number | null
): { width: number; height: number } {
  // Default to max dimensions if no base image
  if (!baseWidth || !baseHeight) {
    return { width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_HEIGHT };
  }

  const baseAspectRatio = baseWidth / baseHeight;
  const containerAspectRatio = MAX_CANVAS_WIDTH / MAX_CANVAS_HEIGHT;

  let width: number;
  let height: number;

  if (baseAspectRatio > containerAspectRatio) {
    // Image is wider than container - fit to width
    width = MAX_CANVAS_WIDTH;
    height = Math.round(MAX_CANVAS_WIDTH / baseAspectRatio);
  } else {
    // Image is taller than container - fit to height
    height = MAX_CANVAS_HEIGHT;
    width = Math.round(MAX_CANVAS_HEIGHT * baseAspectRatio);
  }

  return { width, height };
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Data Layer (Queries)
  // ─────────────────────────────────────────────────────────────────────────────

  const queries = useProjectQueries({ projectId });

  // ─────────────────────────────────────────────────────────────────────────────
  // State Management (Hooks)
  // ─────────────────────────────────────────────────────────────────────────────

  const workflow = useWorkflow({
    hasBaseImage: queries.hasBaseImage,
    hasMask: queries.hasMask,
    hasVariants: queries.hasVariants,
  });

  const maskEditor = useMaskEditor();
  const results = useResultsState();

  // Fetch selected variant image (only when a locale is selected)
  const selectedLocale = results.activeVariant !== "original" ? results.activeVariant as LocaleId : null;
  const variantImage = useVariantImage(projectId, selectedLocale);

  // Generation state (kept local for progress tracking)
  const [selectedLocales, setSelectedLocales] = useState<LocaleId[]>([...SUPPORTED_LOCALES]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentGeneratingLocale, setCurrentGeneratingLocale] = useState<LocaleId | null>(null);
  const [streamingEnabled, setStreamingEnabled] = useState(false);

  // Vision pipeline state
  // Default to ON since Vision mode is more accurate and works with any image
  const [visionModeEnabled, setVisionModeEnabled] = useState(true);
  const [detectedTextCount, setDetectedTextCount] = useState(0);
  const [hasAnalysis, setHasAnalysis] = useState(false);

  // Track if we've checked for existing analysis on load
  const [analysisChecked, setAnalysisChecked] = useState(false);

  // Verification state (Sprint 9)
  const [verifyingLocale, setVerifyingLocale] = useState<LocaleId | null>(null);

  // Track if generation was cancelled (to ignore results when mutation completes)
  const generationCancelledRef = useRef(false);
  // UI state for showing "Cancelling..." while waiting for server
  const [isCancelling, setIsCancelling] = useState(false);

  // Calculate canvas dimensions based on base image aspect ratio
  const canvasDimensions = useMemo(
    () => calculateCanvasDimensions(queries.baseImageWidth, queries.baseImageHeight),
    [queries.baseImageWidth, queries.baseImageHeight]
  );

  // Streaming generation hook for gpt-image-1.5 progressive preview
  const streaming = useStreamingGeneration();

  // Vision pipeline query - ALWAYS check for existing analysis on load
  // This runs independently of visionModeEnabled so we can show mask suggestions
  // even when user hasn't enabled Vision Mode yet
  const existingAnalysisQuery = api.project.getImageAnalysis.useQuery(
    { projectId },
    { enabled: !analysisChecked } // Only run once on load
  );

  // Vision pipeline query (used when Vision Mode is actively enabled)
  const imageAnalysisQuery = api.project.getImageAnalysis.useQuery(
    { projectId },
    { enabled: visionModeEnabled && analysisChecked }
  );

  // Vision pipeline mutations
  const analyzeImageMutation = api.project.analyzeImage.useMutation({
    onSuccess: (data) => {
      if (data.success && data.analysis) {
        setDetectedTextCount(data.analysis.textRegionCount);
        setHasAnalysis(true);
      }
    },
  });

  // Verification mutation (Sprint 9)
  const verifyMutation = api.variant.verify.useMutation({
    onSuccess: (data) => {
      void queries.refetchProject();
      setVerifyingLocale(null);
      toast.success(
        `Verification complete: ${data.accuracy.toFixed(1)}%`,
        { description: `Status: ${data.status.toUpperCase()} (${data.matches.filter(m => m.status === "match").length}/${data.expectedCount} matched)` }
      );
    },
    onError: (error) => {
      setVerifyingLocale(null);
      console.error("[ProjectPage] Verification failed:", error.message);
      toast.error("Verification failed", { description: error.message });
    },
  });

  // Mask suggestion query (Sprint 9) - only enabled when we have an analysis
  const maskSuggestionQuery = api.project.getSuggestedMask.useQuery(
    { projectId },
    { enabled: hasAnalysis }
  );

  // Mask suggestion mutation (Sprint 9)
  const applySuggestedMaskMutation = api.project.applySuggestedMask.useMutation({
    onSuccess: async (data) => {
      // Refetch project to update hasMask state (enables Continue button)
      await queries.refetchProject();
      // Refetch and load the mask into the canvas
      const result = await queries.refetchMask();
      if (result.data?.maskBase64) {
        maskEditor.loadMask(result.data.maskBase64);
      }
      // Inform user this is a starting point
      toast.success(
        `Auto-mask applied (${data.regionCount} regions)`,
        { description: "This is a starting point — use the tools above to refine if needed." }
      );
    },
  });

  // Check for existing analysis on initial load (runs once)
  useEffect(() => {
    // Mark as checked once we have data OR an error (to prevent retrying)
    if (!analysisChecked && (existingAnalysisQuery.data !== undefined || existingAnalysisQuery.isError)) {
      setAnalysisChecked(true);
      if (existingAnalysisQuery.data?.analysis) {
        setDetectedTextCount(existingAnalysisQuery.data.analysis.textRegions.length);
        setHasAnalysis(true);
        console.log(`[ProjectPage] Found existing analysis with ${existingAnalysisQuery.data.analysis.textRegions.length} regions`);
      } else {
        console.log(`[ProjectPage] No existing analysis found for project`);
      }
    }
  }, [existingAnalysisQuery.data, existingAnalysisQuery.isError, analysisChecked]);

  // Update state when analysis is loaded from Vision Mode query
  useEffect(() => {
    if (imageAnalysisQuery.data?.analysis) {
      setDetectedTextCount(imageAnalysisQuery.data.analysis.textRegions.length);
      setHasAnalysis(true);
    }
  }, [imageAnalysisQuery.data]);

  // Auto-analyze when Vision Mode is enabled (remove need for separate button)
  useEffect(() => {
    if (
      visionModeEnabled &&
      analysisChecked && // Wait until we've checked for existing analysis
      !hasAnalysis &&
      !analyzeImageMutation.isPending &&
      queries.hasBaseImage
    ) {
      // No existing analysis, trigger one automatically
      analyzeImageMutation.mutate({ projectId });
    }
  }, [visionModeEnabled, analysisChecked, hasAnalysis, queries.hasBaseImage, analyzeImageMutation, projectId]);

  // Vision pipeline generation mutation
  const generateWithVisionMutation = api.variant.generateAllWithVision.useMutation({
    onSuccess: (data) => {
      // Check if generation was cancelled - ignore results if so
      if (generationCancelledRef.current) {
        console.log("[ProjectPage] Generation was cancelled, ignoring results");
        generationCancelledRef.current = false;
        setIsCancelling(false);
        setGenerationProgress(0);
        setCurrentGeneratingLocale(null);
        toast.success("Generation cancelled", { description: "Results discarded as requested" });
        return;
      }
      setIsCancelling(false);
      setGenerationProgress(100);
      void queries.refetchProject();
      workflow.goToResults();
      if (data.successCount > 0) {
        results.selectFirstVariant(selectedLocales);
      }
    },
    onError: () => {
      generationCancelledRef.current = false;
      setIsCancelling(false);
      setGenerationProgress(0);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const mutations = useProjectMutations({
    projectId,
    onProjectChange: () => void queries.refetchProject(),
    onBaseImageChange: async () => {
      await queries.refetchBaseImage();
      // Auto-analyze the uploaded image for text detection
      // This enables the "Use Suggested Mask" feature on the Mask step
      console.log(`[ProjectPage] Base image uploaded, triggering auto-analysis`);
      analyzeImageMutation.mutate({ projectId });
    },
    onMaskChange: async () => {
      const result = await queries.refetchMask();
      if (result.data?.maskBase64) {
        maskEditor.loadMask(result.data.maskBase64);
      }
    },
    onVariantsChange: () => void queries.refetchProject(),
    onGenerationComplete: (successCount, totalCount) => {
      setGenerationProgress(100);
      workflow.goToResults();
      if (successCount > 0) {
        results.selectFirstVariant(selectedLocales);
      }
    },
    onGenerationError: () => {
      setGenerationProgress(0);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  useKeyboardShortcuts({
    currentStep: workflow.currentStep,
    onUndo: maskEditor.undo,
    onRedo: maskEditor.redo,
    onToolChange: maskEditor.setActiveTool,
    onSave: () => mutations.handleSaveMask(() => maskEditor.save()),
    enabled: !mutations.isGenerating,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleLocaleToggle = useCallback((locale: LocaleId) => {
    setSelectedLocales((prev) =>
      prev.includes(locale) ? prev.filter((l) => l !== locale) : [...prev, locale]
    );
  }, []);

  // Cancel handler for generation
  const handleCancelGeneration = useCallback(() => {
    console.log("[ProjectPage] Cancelling generation");
    // Mark as cancelled so mutation results are ignored
    generationCancelledRef.current = true;
    // Show cancelling state in UI
    setIsCancelling(true);
    // Cancel streaming if active
    streaming.cancel();
    toast.info("Cancellation requested", { description: "Waiting for server to complete current operation..." });
  }, [streaming]);

  const handleGenerate = useCallback(async () => {
    // Reset cancelled flag when starting new generation
    generationCancelledRef.current = false;
    setIsCancelling(false);
    setIsDemoMode(false);
    setGenerationProgress(0);

    // Vision pipeline mode - use the two-model pipeline
    if (visionModeEnabled) {
      generateWithVisionMutation.mutate({
        projectId,
        locales: selectedLocales,
        pixelPerfect: true,
        ultraStrict: false,
      });
      return;
    }

    if (streamingEnabled && selectedLocales.length === 1) {
      // Use streaming endpoint for single locale (best streaming experience)
      const locale = selectedLocales[0]!;
      setCurrentGeneratingLocale(locale);

      const result = await streaming.generate({
        projectId,
        locale,
        pixelPerfect: true,
        partialImages: 2,
      });

      if (result) {
        setGenerationProgress(100);
        await queries.refetchProject();
        workflow.goToResults();
        results.selectFirstVariant(selectedLocales);
      }

      setCurrentGeneratingLocale(null);
    } else if (streamingEnabled && selectedLocales.length > 1) {
      // Sequential streaming for multiple locales
      for (let i = 0; i < selectedLocales.length; i++) {
        const locale = selectedLocales[i]!;
        setCurrentGeneratingLocale(locale);
        setGenerationProgress(Math.round((i / selectedLocales.length) * 100));

        const result = await streaming.generate({
          projectId,
          locale,
          pixelPerfect: true,
          partialImages: 2,
        });

        if (!result) {
          console.error(`[ProjectPage] Streaming failed for ${locale}`);
          // Continue with next locale even if one fails
        }
      }

      setGenerationProgress(100);
      setCurrentGeneratingLocale(null);
      await queries.refetchProject();
      workflow.goToResults();
      results.selectFirstVariant(selectedLocales);
    } else {
      // Use existing tRPC mutation (non-streaming)
      mutations.handleGenerate(selectedLocales);
    }
  }, [visionModeEnabled, streamingEnabled, selectedLocales, projectId, streaming, mutations, queries, workflow, results, generateWithVisionMutation]);

  const handleDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setGenerationProgress(0);
    mutations.handleDemoMode(selectedLocales);
  }, [selectedLocales, mutations]);

  const handleSaveMask = useCallback(() => {
    mutations.handleSaveMask(() => maskEditor.save());
  }, [mutations, maskEditor]);

  const handleLoadDemoMask = useCallback(() => {
    if (maskEditor.hasChanges) {
      if (!confirm("You have unsaved changes. Load demo mask anyway?")) {
        return;
      }
    }
    mutations.loadDemoMask.mutate({ projectId });
  }, [projectId, mutations, maskEditor.hasChanges]);

  const handleDeleteMask = useCallback(() => {
    if (confirm("Delete the saved mask and start over? This cannot be undone.")) {
      mutations.deleteMask.mutate({ projectId });
      maskEditor.clearCanvas();
    }
  }, [projectId, mutations, maskEditor]);

  const handleDownloadVariant = useCallback(
    (locale: LocaleId) => {
      // Download currently displayed variant (must be selected first)
      if (locale !== selectedLocale || !variantImage.imageUrl) return;
      const link = document.createElement("a");
      link.href = variantImage.imageUrl;
      link.download = `localelens_${locale}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [selectedLocale, variantImage.imageUrl]
  );

  // Verification handler (Sprint 9)
  const handleVerify = useCallback((locale: LocaleId) => {
    setVerifyingLocale(locale);
    verifyMutation.mutate({ projectId, locale });
  }, [projectId, verifyMutation]);

  // Apply suggested mask handler (Sprint 9)
  const handleApplySuggestedMask = useCallback(() => {
    applySuggestedMaskMutation.mutate({ projectId });
  }, [projectId, applySuggestedMaskMutation]);

  const handleDownloadOriginal = useCallback(() => {
    if (!queries.baseImageUrl) return;
    const link = document.createElement("a");
    link.href = queries.baseImageUrl;
    link.download = "localelens_original.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [queries.baseImageUrl]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading State
  // ─────────────────────────────────────────────────────────────────────────────

  if (queries.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const renderSidebar = () => {
    switch (workflow.currentStep) {
      case "upload":
        return (
          <UploadStepSidebar
            hasBaseImage={queries.hasBaseImage}
            isUploading={mutations.isUploading}
            isDemoLoading={mutations.isDemoLoading}
            isAnalyzing={analyzeImageMutation.isPending}
            hasAnalysis={hasAnalysis}
            detectedTextCount={detectedTextCount}
            onFileSelect={mutations.handleFileUpload}
            onLoadDemo={() => mutations.loadDemoBaseImage.mutate({ projectId })}
            onContinue={workflow.goToMask}
          />
        );

      case "mask":
        return (
          <MaskStepSidebar
            activeTool={maskEditor.activeTool}
            brushSize={maskEditor.brushSize}
            canUndo={maskEditor.canUndo}
            canRedo={maskEditor.canRedo}
            hasChanges={maskEditor.hasChanges}
            hasMask={queries.hasMask}
            isDemoProject={queries.isDemoProject}
            hasSuggestion={!!maskSuggestionQuery.data?.suggestion}
            isApplyingSuggestion={applySuggestedMaskMutation.isPending}
            suggestionRegionCount={maskSuggestionQuery.data?.suggestion?.regionCount ?? null}
            onToolChange={maskEditor.setActiveTool}
            onBrushSizeChange={maskEditor.setBrushSize}
            onUndo={maskEditor.undo}
            onRedo={maskEditor.redo}
            onEditAll={maskEditor.editAll}
            onKeepAll={maskEditor.keepAll}
            onLoadDemo={handleLoadDemoMask}
            onApplySuggestion={handleApplySuggestedMask}
            onSave={handleSaveMask}
            onDeleteMask={handleDeleteMask}
            onContinue={workflow.goToGenerate}
          />
        );

      case "generate":
        return (
          <GenerateStepSidebar
            selectedLocales={selectedLocales}
            isGenerating={mutations.isGenerating || streaming.isStreaming || generateWithVisionMutation.isPending}
            isDemoMode={isDemoMode}
            progress={generationProgress}
            isDemoProject={queries.isDemoProject}
            streamingEnabled={streamingEnabled}
            onStreamingChange={setStreamingEnabled}
            visionModeEnabled={visionModeEnabled}
            onVisionModeChange={setVisionModeEnabled}
            isAnalyzing={analyzeImageMutation.isPending}
            hasAnalysis={hasAnalysis}
            detectedTextCount={detectedTextCount}
            onLocaleToggle={handleLocaleToggle}
            onSelectAll={() => setSelectedLocales([...SUPPORTED_LOCALES])}
            onClearAll={() => setSelectedLocales([])}
            onGenerate={handleGenerate}
            onDemoMode={handleDemoMode}
            onCancel={handleCancelGeneration}
            isCancelling={isCancelling}
            onCurrentLocaleChange={setCurrentGeneratingLocale}
          />
        );

      case "results":
        return (
          <ResultsStepSidebar
            variants={queries.variants}
            activeVariant={results.activeVariant}
            showOverlay={results.showOverlay}
            isExporting={mutations.isExporting}
            isRegenerating={mutations.regenerateVariant.isPending ? "loading" : null}
            isVerifying={verifyingLocale}
            onVariantSelect={results.selectVariant}
            onToggleOverlay={results.toggleOverlay}
            onDownloadVariant={handleDownloadVariant}
            onDownloadOriginal={handleDownloadOriginal}
            onRegenerate={(locale) => mutations.regenerateVariant.mutate({ projectId, locale })}
            onVerify={handleVerify}
            onExportZip={() => mutations.exportZip.mutate({ projectId })}
            onExportMontage={() => mutations.generateMontage.mutate({ projectId })}
          />
        );
    }
  };

  const renderCanvas = () => {
    switch (workflow.currentStep) {
      case "upload":
        return (
          <UploadStepCanvas
            baseImageUrl={queries.baseImageUrl}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
          />
        );

      case "mask":
        return (
          <MaskStepCanvas
            canvasRef={maskEditor.canvasRef}
            baseImageUrl={queries.baseImageUrl}
            maskUrl={queries.maskUrl}
            tool={maskEditor.activeTool}
            brushSize={maskEditor.brushSize}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            onStateChange={maskEditor.handleStateChange}
          />
        );

      case "generate":
        return (
          <GenerateStepCanvas
            baseImageUrl={queries.baseImageUrl}
            maskUrl={queries.maskUrl}
            selectedLocales={selectedLocales}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
            isGenerating={mutations.isGenerating || streaming.isStreaming}
            currentLocale={currentGeneratingLocale}
            // Streaming props
            streamingEnabled={streamingEnabled}
            isStreaming={streaming.isStreaming}
            streamingProgress={streaming.progress}
            streamingPartialImages={streaming.partialImages}
            streamingResult={streaming.result}
            streamingError={streaming.error}
          />
        );

      case "results":
        return (
          <ResultsStepCanvas
            baseImageUrl={queries.baseImageUrl}
            activeVariant={results.activeVariant}
            showOverlay={results.showOverlay}
            variantImageUrl={variantImage.imageUrl}
            overlayImageUrl={variantImage.overlayUrl}
            isLoadingVariant={variantImage.isLoading}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
          />
        );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 h-14 border-b border-border/40 bg-background/80 backdrop-blur-sm flex items-center px-4 gap-4">
        <button onClick={() => router.push("/")} className="hover:opacity-80 transition">
          <Logo size="sm" />
        </button>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-muted-foreground truncate max-w-40">
          {queries.project?.name}
        </span>

        <div className="flex-1" />

        <StepProgress
          currentStep={workflow.currentStep}
          completedSteps={workflow.completedSteps}
          disabledSteps={workflow.disabledSteps}
          onStepClick={workflow.setCurrentStep}
        />

        <div className="flex-1" />

        {isDemoMode && queries.variants.some((v) => v.modelUsed === "demo-mode") && (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            Demo Mode
          </Badge>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Glass Morphism */}
        <aside className="w-72 shrink-0 border-r border-border/40 bg-background/80 backdrop-blur-xl">
          <ScrollArea className="h-full">
            <div className="p-4">{renderSidebar()}</div>
          </ScrollArea>
        </aside>

        {/* Canvas Area with Subtle Gradient */}
        <main className="flex-1 overflow-auto bg-linear-to-br from-muted/20 via-background to-muted/30">
          <div className="step-transition">
            {renderCanvas()}
          </div>
        </main>
      </div>
    </div>
  );
}
