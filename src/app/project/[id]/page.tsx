"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";
import { MaskCanvas } from "~/components/project/MaskCanvas";
import { LocaleSelector } from "~/components/project/LocaleSelector";
import { VariantViewer } from "~/components/project/VariantViewer";
import { SUPPORTED_LOCALES, type LocaleId } from "~/server/domain/value-objects/locale";
import { Image, PaintBucket, Sparkles } from "lucide-react";
import { Logo } from "~/components/Logo";

type WorkflowTab = "upload" | "mask" | "generate" | "results";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<WorkflowTab>("upload");
  const [selectedLocales, setSelectedLocales] = useState<LocaleId[]>([
    ...SUPPORTED_LOCALES,
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Fetch project data
  const { data: projectData, refetch: refetchProject } =
    api.project.get.useQuery({ projectId }, { enabled: !!projectId });

  const { data: baseImageData, refetch: refetchBaseImage } =
    api.project.getBaseImage.useQuery({ projectId }, { enabled: !!projectId });

  const { data: maskData, refetch: refetchMask } = api.project.getMask.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  // Mutations
  const uploadBaseImage = api.project.uploadBaseImage.useMutation({
    onSuccess: () => {
      toast.success("Base image uploaded");
      void refetchProject();
      void refetchBaseImage();
      setActiveTab("mask");
    },
    onError: (error) => {
      toast.error("Upload failed", { description: error.message });
    },
  });

  const saveMask = api.project.saveMask.useMutation({
    onSuccess: () => {
      toast.success("Mask saved");
      void refetchProject();
      void refetchMask();
      setActiveTab("generate");
    },
    onError: (error) => {
      toast.error("Save failed", { description: error.message });
    },
  });

  const loadDemoBaseImage = api.project.loadDemoBaseImage.useMutation({
    onSuccess: () => {
      toast.success("Demo base image loaded");
      void refetchProject();
      void refetchBaseImage();
    },
    onError: (error) => {
      toast.error("Load failed", { description: error.message });
    },
  });

  const loadDemoMask = api.project.loadDemoMask.useMutation({
    onSuccess: () => {
      toast.success("Demo mask loaded");
      void refetchProject();
      void refetchMask();
    },
    onError: (error) => {
      toast.error("Load failed", { description: error.message });
    },
  });

  const generateVariants = api.variant.generateAll.useMutation({
    onMutate: () => {
      setIsGenerating(true);
      setGenerationProgress(0);
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      setGenerationProgress(100);
      void refetchProject();

      if (data.successCount === data.totalCount) {
        toast.success("All variants generated successfully!");
      } else {
        toast.warning(
          `Generated ${data.successCount}/${data.totalCount} variants`
        );
      }
      setActiveTab("results");
    },
    onError: (error) => {
      setIsGenerating(false);
      // Check if this is an API unavailability error
      const errorMsg = error.message.toLowerCase();
      if (
        errorMsg.includes("403") ||
        errorMsg.includes("forbidden") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("quota") ||
        errorMsg.includes("billing")
      ) {
        toast.error("API unavailable", {
          description: "Try Demo Mode to see pre-generated outputs",
        });
      } else {
        toast.error("Generation failed", { description: error.message });
      }
    },
  });

  const loadDemoOutputs = api.variant.loadDemoOutputs.useMutation({
    onMutate: () => {
      setIsGenerating(true);
      setIsDemoMode(true);
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      void refetchProject();

      if (data.successCount === data.totalCount) {
        toast.success("Demo outputs loaded successfully!");
      } else {
        toast.warning(
          `Loaded ${data.successCount}/${data.totalCount} demo outputs`
        );
      }
      setActiveTab("results");
    },
    onError: (error) => {
      setIsGenerating(false);
      toast.error("Demo mode failed", { description: error.message });
    },
  });

  // Handlers
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
    (maskDataUrl: string) => {
      saveMask.mutate({ projectId, maskBase64: maskDataUrl });
    },
    [projectId, saveMask]
  );

  const handleGenerate = useCallback(() => {
    if (selectedLocales.length === 0) {
      toast.error("Select at least one locale");
      return;
    }
    setIsDemoMode(false);
    generateVariants.mutate({ projectId, locales: selectedLocales });
  }, [projectId, selectedLocales, generateVariants]);

  const handleDemoMode = useCallback(() => {
    if (selectedLocales.length === 0) {
      toast.error("Select at least one locale");
      return;
    }
    loadDemoOutputs.mutate({ projectId, locales: selectedLocales });
  }, [projectId, selectedLocales, loadDemoOutputs]);

  // Derived state
  const project = projectData?.aggregate?.project;
  const variants = projectData?.aggregate?.variants ?? [];
  const hasBaseImage = !!project?.baseImagePath;
  const hasMask = !!projectData?.aggregate?.mask;
  const baseImageUrl = baseImageData?.imageBase64 ?? null;
  const maskUrl = maskData?.maskBase64 ?? null;

  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="hover:opacity-80 transition"
            >
              <Logo size="md" />
            </button>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm text-muted-foreground truncate max-w-50">
              {project?.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasBaseImage && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Image className="h-3 w-3" />
                <span className="hidden sm:inline">Base</span>
              </div>
            )}
            {hasMask && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <PaintBucket className="h-3 w-3" />
                <span className="hidden sm:inline">Mask</span>
              </div>
            )}
            {variants.length > 0 && (
              <Badge variant="default" className="text-xs h-5">
                {variants.length} variant{variants.length !== 1 && "s"}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container px-4 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as WorkflowTab)}
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">1. Upload</TabsTrigger>
            <TabsTrigger value="mask" disabled={!hasBaseImage}>
              2. Mask
            </TabsTrigger>
            <TabsTrigger value="generate" disabled={!hasBaseImage || !hasMask}>
              3. Generate
            </TabsTrigger>
            <TabsTrigger value="results" disabled={variants.length === 0}>
              4. Results
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Base Image</CardTitle>
                <CardDescription>
                  Upload the marketing visual you want to localize, or use the
                  demo asset.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  {baseImageUrl ? (
                    <div className="relative aspect-9/16 max-w-md w-full overflow-hidden rounded-lg border border-border">
                      <img
                        src={baseImageUrl}
                        alt="Base image"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-md aspect-9/16 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <p className="text-muted-foreground">
                          No image uploaded
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Supports PNG, JPG, WebP
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="default"
                        className="pointer-events-none"
                        disabled={uploadBaseImage.isPending}
                      >
                        {uploadBaseImage.isPending
                          ? "Uploading..."
                          : hasBaseImage
                            ? "Replace Image"
                            : "Upload Image"}
                      </Button>
                    </label>
                    <Button
                      variant="outline"
                      onClick={() => loadDemoBaseImage.mutate({ projectId })}
                      disabled={loadDemoBaseImage.isPending}
                    >
                      {loadDemoBaseImage.isPending
                        ? "Loading..."
                        : "Load Demo Asset"}
                    </Button>
                  </div>
                </div>

                {hasBaseImage && (
                  <div className="flex justify-end">
                    <Button onClick={() => setActiveTab("mask")}>
                      Continue to Mask Editor →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mask Tab */}
          <TabsContent value="mask" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Mask</CardTitle>
                <CardDescription>
                  Paint the regions you want to replace with localized text.
                  Transparent areas will be edited.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MaskCanvas
                  baseImageUrl={baseImageUrl}
                  existingMaskUrl={maskUrl}
                  onSave={handleSaveMask}
                  onLoadDemoMask={() => loadDemoMask.mutate({ projectId })}
                  width={540}
                  height={960}
                />

                {hasMask && (
                  <div className="flex justify-end mt-4">
                    <Button onClick={() => setActiveTab("generate")}>
                      Continue to Generation →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Variants</CardTitle>
                <CardDescription>
                  Select target locales and generate localized variants using AI
                  image editing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <LocaleSelector
                  selectedLocales={selectedLocales}
                  onSelectionChange={setSelectedLocales}
                  disabled={isGenerating}
                />

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Ready to Generate</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedLocales.length} locale(s) selected
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleDemoMode}
                        disabled={
                          isGenerating ||
                          selectedLocales.length === 0 ||
                          !hasBaseImage ||
                          !hasMask
                        }
                      >
                        Demo Mode
                      </Button>
                      <Button
                        size="lg"
                        onClick={handleGenerate}
                        disabled={
                          isGenerating ||
                          selectedLocales.length === 0 ||
                          !hasBaseImage ||
                          !hasMask
                        }
                      >
                        {isGenerating
                          ? "Generating..."
                          : `Generate ${selectedLocales.length} Variant(s)`}
                      </Button>
                    </div>
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <Progress value={generationProgress} />
                      <p className="text-sm text-muted-foreground text-center">
                        {isDemoMode
                          ? "Loading demo outputs..."
                          : "Generating variants... This may take a minute."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-6 space-y-4">
            {/* Demo Mode Banner */}
            {isDemoMode && variants.some((v) => v.modelUsed === "demo-mode") && (
              <Card className="border-amber-500/50 bg-amber-500/10">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-500 text-amber-500">
                      Demo Mode
                    </Badge>
                    <span className="text-sm text-amber-500">
                      API unavailable — showing pre-generated outputs. Drift analysis and exports still work.
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Generated Variants</CardTitle>
                <CardDescription>
                  View and compare your localized variants. Download individual
                  images or export all.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VariantViewer
                  projectId={projectId}
                  baseImageUrl={baseImageUrl}
                  variants={variants}
                  onVariantsChange={() => void refetchProject()}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
