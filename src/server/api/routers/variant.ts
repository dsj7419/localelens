/**
 * Variant Router
 *
 * tRPC router for variant generation and management.
 * THIN LAYER - delegates to domain services for business logic.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  PrismaProjectRepository,
  PrismaMaskRepository,
  PrismaVariantRepository,
  PrismaImageAnalysisRepository,
} from "~/server/infrastructure/repositories/prisma.project.repository";
import { createFileStore } from "~/server/services/fileStore";
import { getOpenAIImageService } from "~/server/services/openaiImage";
import { getLocalePlanService } from "~/server/domain/services/localePlan.service";
import { getVariantGenerationService } from "~/server/domain/services/variantGeneration.service";
import { getDemoModeService } from "~/server/services/demoModeService";
import { getTextDetectionService, type ImageAnalysis, type TextRegion } from "~/server/services/textDetectionService";
import { getTranslationService, type TranslatedText } from "~/server/services/translationService";
import { getDynamicPromptBuilder } from "~/server/domain/services/dynamicPromptBuilder";
import { getVerificationService } from "~/server/services/verificationService";
import {
  SUPPORTED_LOCALES,
  type LocaleId,
  getLocaleMetadata,
} from "~/server/domain/value-objects/locale";

// Zod schemas
const generateVariantSchema = z.object({
  projectId: z.string().cuid(),
  locale: z.enum(SUPPORTED_LOCALES),
  /** Enable pixel-perfect mode for 0% drift (default: true) */
  pixelPerfect: z.boolean().default(true),
});

const generateAllVariantsSchema = z.object({
  projectId: z.string().cuid(),
  locales: z.array(z.enum(SUPPORTED_LOCALES)).min(1).max(3),
  /** Enable pixel-perfect mode for 0% drift (default: true) */
  pixelPerfect: z.boolean().default(true),
});

const generateWithVisionSchema = z.object({
  projectId: z.string().cuid(),
  locale: z.enum(SUPPORTED_LOCALES),
  /** Enable pixel-perfect mode for 0% drift (default: true) */
  pixelPerfect: z.boolean().default(true),
  /** Use ultra-strict preservation mode */
  ultraStrict: z.boolean().default(false),
});

const generateAllWithVisionSchema = z.object({
  projectId: z.string().cuid(),
  locales: z.array(z.enum(SUPPORTED_LOCALES)).min(1).max(3),
  /** Enable pixel-perfect mode for 0% drift (default: true) */
  pixelPerfect: z.boolean().default(true),
  /** Use ultra-strict preservation mode */
  ultraStrict: z.boolean().default(false),
});

const verifyVariantSchema = z.object({
  projectId: z.string().cuid(),
  locale: z.enum(SUPPORTED_LOCALES),
});

export const variantRouter = createTRPCRouter({
  /**
   * Generate a single variant for a locale
   */
  generate: publicProcedure
    .input(generateVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, locale, pixelPerfect } = input;

      // Load dependencies
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const maskRepo = new PrismaMaskRepository(ctx.db);
      const variantRepo = new PrismaVariantRepository(ctx.db);
      const fileStore = createFileStore(projectId);
      const imageService = getOpenAIImageService();
      const localePlanService = getLocalePlanService();
      const variantGenService = getVariantGenerationService();

      // Validate project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const mask = await maskRepo.findByProjectId(projectId);
      if (!mask) {
        throw new Error("No mask found for project");
      }

      // Load images
      const baseImageBuffer = await fileStore.getBaseImage();
      if (!baseImageBuffer) {
        throw new Error("Base image not found");
      }

      const maskBuffer = await fileStore.getMaskImage();
      if (!maskBuffer) {
        throw new Error("Mask image not found");
      }

      // Build prompt
      const prompt = localePlanService.buildPrompt(locale);

      console.log(`[VariantRouter] Generating ${getLocaleMetadata(locale).name} variant (pixelPerfect: ${pixelPerfect})`);

      // Delegate to service
      const result = await variantGenService.generateVariant(
        { projectId, locale, prompt, baseImageBuffer, maskBuffer, pixelPerfect },
        imageService,
        fileStore,
        variantRepo
      );

      if (!result.success || !result.variant || !result.imageBuffer) {
        throw new Error(result.error ?? "Failed to generate variant");
      }

      console.log(`[VariantRouter] Generated ${locale} with model ${result.modelUsed}`);

      // Return with base64 for immediate display
      const imageBase64 = result.imageBuffer.toString("base64");

      return {
        variant: result.variant,
        imageBase64: `data:image/png;base64,${imageBase64}`,
        modelUsed: result.modelUsed,
        driftScore: result.driftScore,
        driftStatus: result.driftStatus,
      };
    }),

  /**
   * Generate variants for multiple locales
   */
  generateAll: publicProcedure
    .input(generateAllVariantsSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, locales, pixelPerfect } = input;
      const results: Array<{
        locale: LocaleId;
        success: boolean;
        error?: string;
        modelUsed?: string;
      }> = [];

      // Load dependencies
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const maskRepo = new PrismaMaskRepository(ctx.db);
      const variantRepo = new PrismaVariantRepository(ctx.db);
      const fileStore = createFileStore(projectId);
      const imageService = getOpenAIImageService();
      const localePlanService = getLocalePlanService();
      const variantGenService = getVariantGenerationService();

      // Validate project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const mask = await maskRepo.findByProjectId(projectId);
      if (!mask) {
        throw new Error("No mask found for project");
      }

      // Load images once
      const baseImageBuffer = await fileStore.getBaseImage();
      if (!baseImageBuffer) {
        throw new Error("Base image not found");
      }

      const maskBuffer = await fileStore.getMaskImage();
      if (!maskBuffer) {
        throw new Error("Mask image not found");
      }

      // Generate each locale sequentially
      for (const locale of locales) {
        const localeMetadata = getLocaleMetadata(locale);
        console.log(
          `[VariantRouter] Generating ${localeMetadata.name} variant (${locales.indexOf(locale) + 1}/${locales.length}, pixelPerfect: ${pixelPerfect})`
        );

        const prompt = localePlanService.buildPrompt(locale);

        const result = await variantGenService.generateVariant(
          { projectId, locale, prompt, baseImageBuffer, maskBuffer, pixelPerfect },
          imageService,
          fileStore,
          variantRepo
        );

        results.push({
          locale,
          success: result.success,
          error: result.error,
          modelUsed: result.modelUsed,
        });

        if (result.success) {
          console.log(`[VariantRouter] Generated ${locale} with model ${result.modelUsed}`);
        } else {
          console.error(`[VariantRouter] Failed to generate ${locale}: ${result.error}`);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(`[VariantRouter] Generation complete: ${successCount}/${locales.length} succeeded`);

      return {
        results,
        successCount,
        totalCount: locales.length,
      };
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // Vision-Powered Generation (Two-Model Pipeline)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a variant using Vision-powered pipeline
   *
   * This uses the two-model pipeline:
   * 1. GPT-4o Vision (Inspector) - Detect text in image
   * 2. GPT-4o (Translator) - Translate detected text
   * 3. DynamicPromptBuilder - Build image-specific prompt
   * 4. gpt-image-1.5 (Artist) - Generate localized variant
   *
   * This works with ANY image, not just the demo screenshot.
   */
  generateWithVision: publicProcedure
    .input(generateWithVisionSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, locale, pixelPerfect, ultraStrict } = input;

      // Load dependencies
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const maskRepo = new PrismaMaskRepository(ctx.db);
      const variantRepo = new PrismaVariantRepository(ctx.db);
      const imageAnalysisRepo = new PrismaImageAnalysisRepository(ctx.db);
      const fileStore = createFileStore(projectId);
      const imageService = getOpenAIImageService();
      const textDetectionService = getTextDetectionService();
      const translationService = getTranslationService();
      const promptBuilder = getDynamicPromptBuilder();
      const variantGenService = getVariantGenerationService();

      // Validate project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const mask = await maskRepo.findByProjectId(projectId);
      if (!mask) {
        throw new Error("No mask found for project");
      }

      // Load images
      const baseImageBuffer = await fileStore.getBaseImage();
      if (!baseImageBuffer) {
        throw new Error("Base image not found");
      }

      const maskBuffer = await fileStore.getMaskImage();
      if (!maskBuffer) {
        throw new Error("Mask image not found");
      }

      console.log(`[VariantRouter] Vision pipeline: Starting for ${getLocaleMetadata(locale).name}`);

      // Step 1: Get or create image analysis
      let analysis: ImageAnalysis;
      const existingAnalysis = await imageAnalysisRepo.findByProjectId(projectId);

      if (existingAnalysis) {
        console.log(`[VariantRouter] Vision pipeline: Using existing analysis`);
        // Reconstruct ImageAnalysis from stored data
        analysis = {
          textRegions: JSON.parse(existingAnalysis.textRegions) as TextRegion[],
          layout: existingAnalysis.layout as ImageAnalysis["layout"],
          surfaceTexture: existingAnalysis.surfaceTexture,
          dominantColors: JSON.parse(existingAnalysis.dominantColors) as string[],
          hasUIElements: existingAnalysis.hasUIElements,
          uiElements: existingAnalysis.uiElements
            ? (JSON.parse(existingAnalysis.uiElements) as string[])
            : undefined,
          imageDescription: existingAnalysis.imageDescription,
          analyzedAt: existingAnalysis.analyzedAt,
        };
      } else {
        console.log(`[VariantRouter] Vision pipeline: Running new analysis`);
        analysis = await textDetectionService.analyzeImage(baseImageBuffer);

        // Store analysis for future use
        await imageAnalysisRepo.upsert({
          projectId,
          textRegions: JSON.stringify(analysis.textRegions),
          layout: analysis.layout,
          surfaceTexture: analysis.surfaceTexture,
          dominantColors: JSON.stringify(analysis.dominantColors),
          hasUIElements: analysis.hasUIElements,
          uiElements: analysis.uiElements ? JSON.stringify(analysis.uiElements) : undefined,
          imageDescription: analysis.imageDescription,
        });
      }

      console.log(
        `[VariantRouter] Vision pipeline: ${analysis.textRegions.length} text regions, layout: ${analysis.layout}`
      );

      // Step 2: Translate detected text
      const translationResult = await translationService.translateTexts({
        textRegions: analysis.textRegions,
        targetLocale: locale,
        context: {
          imageType: analysis.layout,
          tone: "neutral",
        },
      });

      if (!translationResult.success) {
        throw new Error(`Translation failed: ${translationResult.error}`);
      }

      console.log(
        `[VariantRouter] Vision pipeline: Translated ${translationResult.translations.length} texts to ${locale}`
      );

      // Step 3: Build dynamic prompt
      const promptResult = promptBuilder.buildPrompt({
        analysis,
        translations: translationResult.translations,
        locale,
        ultraStrict,
      });

      console.log(
        `[VariantRouter] Vision pipeline: Built ${promptResult.layout} prompt with ${promptResult.textRegionCount} regions`
      );

      // Step 4: Generate variant
      const result = await variantGenService.generateVariant(
        {
          projectId,
          locale,
          prompt: promptResult.prompt,
          baseImageBuffer,
          maskBuffer,
          pixelPerfect,
        },
        imageService,
        fileStore,
        variantRepo
      );

      if (!result.success || !result.variant || !result.imageBuffer) {
        throw new Error(result.error ?? "Failed to generate variant");
      }

      console.log(
        `[VariantRouter] Vision pipeline: Generated ${locale} with model ${result.modelUsed}`
      );

      // Return with base64 for immediate display
      const imageBase64 = result.imageBuffer.toString("base64");

      return {
        variant: result.variant,
        imageBase64: `data:image/png;base64,${imageBase64}`,
        modelUsed: result.modelUsed,
        driftScore: result.driftScore,
        driftStatus: result.driftStatus,
        visionPipeline: true,
        analysisUsed: {
          layout: analysis.layout,
          textRegionCount: analysis.textRegions.length,
          translationCount: translationResult.translations.length,
        },
      };
    }),

  /**
   * Generate variants for multiple locales using Vision pipeline
   */
  generateAllWithVision: publicProcedure
    .input(generateAllWithVisionSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, locales, pixelPerfect, ultraStrict } = input;
      const results: Array<{
        locale: LocaleId;
        success: boolean;
        error?: string;
        modelUsed?: string;
        visionPipeline: boolean;
      }> = [];

      // Load dependencies
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const maskRepo = new PrismaMaskRepository(ctx.db);
      const variantRepo = new PrismaVariantRepository(ctx.db);
      const imageAnalysisRepo = new PrismaImageAnalysisRepository(ctx.db);
      const fileStore = createFileStore(projectId);
      const imageService = getOpenAIImageService();
      const textDetectionService = getTextDetectionService();
      const translationService = getTranslationService();
      const promptBuilder = getDynamicPromptBuilder();
      const variantGenService = getVariantGenerationService();

      // Validate project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      const mask = await maskRepo.findByProjectId(projectId);
      if (!mask) {
        throw new Error("No mask found for project");
      }

      // Load images once
      const baseImageBuffer = await fileStore.getBaseImage();
      if (!baseImageBuffer) {
        throw new Error("Base image not found");
      }

      const maskBuffer = await fileStore.getMaskImage();
      if (!maskBuffer) {
        throw new Error("Mask image not found");
      }

      console.log(
        `[VariantRouter] Vision pipeline (batch): Starting for ${locales.length} locales`
      );

      // Step 1: Get or create image analysis (once for all locales)
      let analysis: ImageAnalysis;
      const existingAnalysis = await imageAnalysisRepo.findByProjectId(projectId);

      if (existingAnalysis) {
        console.log(`[VariantRouter] Vision pipeline: Using existing analysis`);
        analysis = {
          textRegions: JSON.parse(existingAnalysis.textRegions) as TextRegion[],
          layout: existingAnalysis.layout as ImageAnalysis["layout"],
          surfaceTexture: existingAnalysis.surfaceTexture,
          dominantColors: JSON.parse(existingAnalysis.dominantColors) as string[],
          hasUIElements: existingAnalysis.hasUIElements,
          uiElements: existingAnalysis.uiElements
            ? (JSON.parse(existingAnalysis.uiElements) as string[])
            : undefined,
          imageDescription: existingAnalysis.imageDescription,
          analyzedAt: existingAnalysis.analyzedAt,
        };
      } else {
        console.log(`[VariantRouter] Vision pipeline: Running new analysis`);
        analysis = await textDetectionService.analyzeImage(baseImageBuffer);

        // Store for future use
        await imageAnalysisRepo.upsert({
          projectId,
          textRegions: JSON.stringify(analysis.textRegions),
          layout: analysis.layout,
          surfaceTexture: analysis.surfaceTexture,
          dominantColors: JSON.stringify(analysis.dominantColors),
          hasUIElements: analysis.hasUIElements,
          uiElements: analysis.uiElements ? JSON.stringify(analysis.uiElements) : undefined,
          imageDescription: analysis.imageDescription,
        });
      }

      console.log(
        `[VariantRouter] Vision pipeline: ${analysis.textRegions.length} text regions detected`
      );

      // Generate each locale sequentially
      for (const locale of locales) {
        const localeMetadata = getLocaleMetadata(locale);
        console.log(
          `[VariantRouter] Vision pipeline: Generating ${localeMetadata.name} (${locales.indexOf(locale) + 1}/${locales.length})`
        );

        try {
          // Step 2: Translate
          const translationResult = await translationService.translateTexts({
            textRegions: analysis.textRegions,
            targetLocale: locale,
            context: {
              imageType: analysis.layout,
              tone: "neutral",
            },
          });

          if (!translationResult.success) {
            throw new Error(`Translation failed: ${translationResult.error}`);
          }

          // Step 3: Build prompt
          const promptResult = promptBuilder.buildPrompt({
            analysis,
            translations: translationResult.translations,
            locale,
            ultraStrict,
          });

          // Step 4: Generate
          const result = await variantGenService.generateVariant(
            {
              projectId,
              locale,
              prompt: promptResult.prompt,
              baseImageBuffer,
              maskBuffer,
              pixelPerfect,
            },
            imageService,
            fileStore,
            variantRepo
          );

          results.push({
            locale,
            success: result.success,
            error: result.error,
            modelUsed: result.modelUsed,
            visionPipeline: true,
          });

          if (result.success) {
            console.log(
              `[VariantRouter] Vision pipeline: Generated ${locale} with model ${result.modelUsed}`
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`[VariantRouter] Vision pipeline: Failed ${locale}: ${errorMessage}`);
          results.push({
            locale,
            success: false,
            error: errorMessage,
            visionPipeline: true,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(
        `[VariantRouter] Vision pipeline complete: ${successCount}/${locales.length} succeeded`
      );

      return {
        results,
        successCount,
        totalCount: locales.length,
        visionPipeline: true,
        analysisUsed: {
          layout: analysis.layout,
          textRegionCount: analysis.textRegions.length,
        },
      };
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // Verification (Sprint 9 - Translation Accuracy)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verify translation accuracy for a generated variant
   *
   * Uses GPT-4o Vision to extract text from the generated image and
   * compare to expected translations. Returns accuracy percentage.
   *
   * This is a separate endpoint to give users control over verification costs.
   */
  verify: publicProcedure
    .input(verifyVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, locale } = input;

      // Load dependencies
      const variantRepo = new PrismaVariantRepository(ctx.db);
      const imageAnalysisRepo = new PrismaImageAnalysisRepository(ctx.db);
      const fileStore = createFileStore(projectId);
      const translationService = getTranslationService();
      const verificationService = getVerificationService();

      const localeName = getLocaleMetadata(locale).name;
      console.log(`[VariantRouter] Verifying translation for ${localeName}`);

      // Get the variant
      const variant = await variantRepo.findByProjectAndLocale(projectId, locale);
      if (!variant) {
        console.error(`[VariantRouter] Variant not found for ${localeName}`);
        throw new Error(`Variant not found for locale ${locale}`);
      }
      console.log(`[VariantRouter] Found variant ${variant.id}`);

      // Get the generated image
      const variantBuffer = await fileStore.getVariantImage(locale);
      if (!variantBuffer) {
        console.error(`[VariantRouter] Variant image not found for ${localeName}`);
        throw new Error("Variant image not found");
      }
      console.log(`[VariantRouter] Loaded variant image (${variantBuffer.length} bytes)`);

      // Get image analysis to get expected translations
      const analysis = await imageAnalysisRepo.findByProjectId(projectId);
      if (!analysis) {
        console.error(`[VariantRouter] No image analysis found for project`);
        throw new Error("No image analysis found - run Vision mode first");
      }
      console.log(`[VariantRouter] Found image analysis (layout: ${analysis.layout})`);

      // Parse text regions from analysis
      const textRegions = JSON.parse(analysis.textRegions) as TextRegion[];
      console.log(`[VariantRouter] Parsed ${textRegions.length} text regions`);

      if (textRegions.length === 0) {
        console.warn(`[VariantRouter] No text regions to verify - analysis has no detected text`);
        throw new Error("No text regions found in analysis - cannot verify");
      }

      // Get translations for this locale
      console.log(`[VariantRouter] Getting translations for ${localeName}...`);
      const translationResult = await translationService.translateTexts({
        textRegions,
        targetLocale: locale,
        context: {
          imageType: analysis.layout,
          tone: "neutral",
        },
      });

      if (!translationResult.success) {
        console.error(`[VariantRouter] Translation failed: ${translationResult.error}`);
        throw new Error(`Translation failed: ${translationResult.error}`);
      }
      console.log(`[VariantRouter] Got ${translationResult.translations.length} translations`);

      // Verify the generated image with GPT-4o Vision
      console.log(`[VariantRouter] Starting GPT-4o Vision verification...`);
      const verificationResult = await verificationService.verifyTranslation({
        generatedImageBuffer: variantBuffer,
        expectedTranslations: translationResult.translations,
        locale,
      });

      console.log(
        `[VariantRouter] Verification complete: ${verificationResult.accuracy.toFixed(1)}% (${verificationResult.overallStatus})`
      );

      // Update variant with verification data
      await variantRepo.updateVerification(
        variant.id,
        verificationResult.accuracy,
        verificationResult.overallStatus,
        JSON.stringify(verificationResult)
      );

      return {
        locale,
        accuracy: verificationResult.accuracy,
        status: verificationResult.overallStatus,
        matches: verificationResult.matches,
        expectedCount: verificationResult.expectedTexts.length,
        actualCount: verificationResult.actualTexts.length,
      };
    }),

  /**
   * List variants for a project
   */
  list: publicProcedure
    .input(z.object({ projectId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const variantRepo = new PrismaVariantRepository(ctx.db);
      const variants = await variantRepo.findByProjectId(input.projectId);
      return { variants };
    }),

  /**
   * Delete a variant
   */
  delete: publicProcedure
    .input(z.object({ variantId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const variantRepo = new PrismaVariantRepository(ctx.db);
      await variantRepo.delete(input.variantId);
      return { success: true };
    }),

  /**
   * Regenerate a variant with stricter constraints
   */
  regenerateStricter: publicProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        locale: z.enum(SUPPORTED_LOCALES),
        /** Enable pixel-perfect mode for 0% drift (default: true) */
        pixelPerfect: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, locale, pixelPerfect } = input;

      // Load dependencies
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const maskRepo = new PrismaMaskRepository(ctx.db);
      const variantRepo = new PrismaVariantRepository(ctx.db);
      const fileStore = createFileStore(projectId);
      const imageService = getOpenAIImageService();
      const localePlanService = getLocalePlanService();
      const variantGenService = getVariantGenerationService();

      // Validate
      const project = await projectRepo.findById(projectId);
      if (!project) throw new Error("Project not found");

      const mask = await maskRepo.findByProjectId(projectId);
      if (!mask) throw new Error("No mask found for project");

      const baseImageBuffer = await fileStore.getBaseImage();
      if (!baseImageBuffer) throw new Error("Base image not found");

      const maskBuffer = await fileStore.getMaskImage();
      if (!maskBuffer) throw new Error("Mask image not found");

      // Use ultra-strict prompt for regeneration
      const prompt = localePlanService.buildUltraStrictPrompt(locale);

      console.log(`[VariantRouter] Regenerating ${getLocaleMetadata(locale).name} with ultra-strict constraints (pixelPerfect: ${pixelPerfect})`);

      const result = await variantGenService.generateVariant(
        { projectId, locale, prompt, baseImageBuffer, maskBuffer, pixelPerfect },
        imageService,
        fileStore,
        variantRepo
      );

      if (!result.success || !result.variant || !result.imageBuffer) {
        throw new Error(result.error ?? "Failed to regenerate variant");
      }

      const imageBase64 = result.imageBuffer.toString("base64");

      return {
        variant: result.variant,
        imageBase64: `data:image/png;base64,${imageBase64}`,
        modelUsed: result.modelUsed,
        driftScore: result.driftScore,
        driftStatus: result.driftStatus,
      };
    }),

  /**
   * Get drift overlay for a variant
   */
  getOverlay: publicProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        locale: z.enum(SUPPORTED_LOCALES),
      })
    )
    .query(async ({ input }) => {
      const fileStore = createFileStore(input.projectId);
      const buffer = await fileStore.getOverlayImage(input.locale);

      if (!buffer) {
        return { overlayBase64: null };
      }

      const base64 = buffer.toString("base64");
      return { overlayBase64: `data:image/png;base64,${base64}` };
    }),

  /**
   * Check if demo outputs are available
   */
  checkDemoMode: publicProcedure.query(async () => {
    const demoModeService = getDemoModeService();
    const hasDemoOutputs = await demoModeService.hasDemoOutputs();
    return { hasDemoOutputs };
  }),

  /**
   * Load demo outputs when API is unavailable
   */
  loadDemoOutputs: publicProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        locales: z.array(z.enum(SUPPORTED_LOCALES)).min(1).max(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, locales } = input;
      const results: Array<{
        locale: LocaleId;
        success: boolean;
        error?: string;
        demoMode: boolean;
      }> = [];

      const variantRepo = new PrismaVariantRepository(ctx.db);
      const fileStore = createFileStore(projectId);
      const demoModeService = getDemoModeService();
      const variantGenService = getVariantGenerationService();

      // Load images
      const baseImageBuffer = await fileStore.getBaseImage();
      const maskBuffer = await fileStore.getMaskImage();

      console.log("[VariantRouter] Loading demo outputs (API unavailable)");

      for (const locale of locales) {
        // Load demo variant
        const variantBuffer = await demoModeService.getDemoVariant(locale);

        if (!variantBuffer) {
          results.push({
            locale,
            success: false,
            error: `Demo output not found for ${locale}`,
            demoMode: true,
          });
          continue;
        }

        // Process using service (handles drift computation too)
        if (baseImageBuffer && maskBuffer) {
          const result = await variantGenService.processVariant(
            {
              projectId,
              locale,
              prompt: "[DEMO MODE] Pre-generated output",
              variantBuffer,
              baseImageBuffer,
              maskBuffer,
              modelUsed: "demo-mode",
            },
            fileStore,
            variantRepo
          );

          results.push({
            locale,
            success: result.success,
            error: result.error,
            demoMode: true,
          });
        } else {
          results.push({
            locale,
            success: false,
            error: "Base image or mask not found",
            demoMode: true,
          });
        }

        console.log(`[VariantRouter] Loaded demo output for ${locale}`);
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(`[VariantRouter] Demo outputs loaded: ${successCount}/${locales.length}`);

      return {
        results,
        successCount,
        totalCount: locales.length,
        demoMode: true,
      };
    }),
});
