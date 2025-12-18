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
} from "~/server/infrastructure/repositories/prisma.project.repository";
import { createFileStore } from "~/server/services/fileStore";
import { getOpenAIImageService } from "~/server/services/openaiImage";
import { getLocalePlanService } from "~/server/domain/services/localePlan.service";
import { getVariantGenerationService } from "~/server/domain/services/variantGeneration.service";
import { getDemoModeService } from "~/server/services/demoModeService";
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
