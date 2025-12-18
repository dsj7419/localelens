/**
 * Project Router
 *
 * tRPC router for project management operations.
 * Thin layer that delegates to domain services and repositories.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  PrismaProjectRepository,
  PrismaMaskRepository,
  PrismaVariantRepository,
  PrismaProjectAggregateRepository,
} from "~/server/infrastructure/repositories/prisma.project.repository";
import { createFileStore } from "~/server/services/fileStore";
import { getExportService } from "~/server/services/exportService";
import { getMontageService } from "~/server/services/montageService";
import { SUPPORTED_LOCALES, LOCALE_REGISTRY, type LocaleId } from "~/server/domain/value-objects/locale";
import fs from "fs/promises";
import path from "path";

// Demo asset paths (canonical from DEMO_SCRIPT)
const DEMO_ASSETS_DIR = path.join(process.cwd(), "docs", "demo-assets");
const DEMO_BASE_IMAGE = "base_appstore_en_1080x1920.png";
const DEMO_MASK_IMAGE = "mask_text_regions_1080x1920.png";

// Zod schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

const projectIdSchema = z.object({
  projectId: z.string().cuid(),
});

const uploadBaseImageSchema = z.object({
  projectId: z.string().cuid(),
  imageBase64: z.string(), // base64 encoded image data
});

const saveMaskSchema = z.object({
  projectId: z.string().cuid(),
  maskBase64: z.string(), // base64 encoded mask data
});

const localeSchema = z.enum(SUPPORTED_LOCALES);

export const projectRouter = createTRPCRouter({
  /**
   * Create a new project
   */
  create: publicProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.db);
      const project = await repo.create({ name: input.name });
      return { project };
    }),

  /**
   * List all projects
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const repo = new PrismaProjectRepository(ctx.db);
    const projects = await repo.findAll();
    return { projects };
  }),

  /**
   * Get a project with all its relations
   */
  get: publicProcedure.input(projectIdSchema).query(async ({ ctx, input }) => {
    const repo = new PrismaProjectAggregateRepository(ctx.db);
    const aggregate = await repo.findByIdWithRelations(input.projectId);

    if (!aggregate) {
      throw new Error("Project not found");
    }

    return { aggregate };
  }),

  /**
   * Delete a project and all its files
   */
  delete: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const fileStore = createFileStore(input.projectId);

      // Delete files first
      await fileStore.deleteProject();

      // Then delete from database
      await projectRepo.delete(input.projectId);

      return { success: true };
    }),

  /**
   * Upload base image for a project
   */
  uploadBaseImage: publicProcedure
    .input(uploadBaseImageSchema)
    .mutation(async ({ ctx, input }) => {
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const fileStore = createFileStore(input.projectId);

      // Decode base64 to buffer
      const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");

      // Save to file store
      const filePath = await fileStore.saveBaseImage(imageBuffer);

      // Update project record
      const project = await projectRepo.updateBaseImagePath(input.projectId, filePath);

      return { project, filePath };
    }),

  /**
   * Save mask for a project
   */
  saveMask: publicProcedure
    .input(saveMaskSchema)
    .mutation(async ({ ctx, input }) => {
      const maskRepo = new PrismaMaskRepository(ctx.db);
      const fileStore = createFileStore(input.projectId);

      // Decode base64 to buffer
      const base64Data = input.maskBase64.replace(/^data:image\/\w+;base64,/, "");
      const maskBuffer = Buffer.from(base64Data, "base64");

      // Save to file store
      const filePath = await fileStore.saveMaskImage(maskBuffer);

      // Create or update mask record
      const mask = await maskRepo.update(input.projectId, filePath);

      return { mask, filePath };
    }),

  /**
   * Get base image as base64
   */
  getBaseImage: publicProcedure
    .input(projectIdSchema)
    .query(async ({ input }) => {
      const fileStore = createFileStore(input.projectId);
      const buffer = await fileStore.getBaseImage();

      if (!buffer) {
        return { imageBase64: null };
      }

      const base64 = buffer.toString("base64");
      return { imageBase64: `data:image/png;base64,${base64}` };
    }),

  /**
   * Get mask image as base64
   */
  getMask: publicProcedure.input(projectIdSchema).query(async ({ input }) => {
    const fileStore = createFileStore(input.projectId);
    const buffer = await fileStore.getMaskImage();

    if (!buffer) {
      return { maskBase64: null };
    }

    const base64 = buffer.toString("base64");
    return { maskBase64: `data:image/png;base64,${base64}` };
  }),

  /**
   * Get variant image as base64
   */
  getVariantImage: publicProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        locale: localeSchema,
      })
    )
    .query(async ({ input }) => {
      const fileStore = createFileStore(input.projectId);
      const buffer = await fileStore.getVariantImage(input.locale);

      if (!buffer) {
        return { imageBase64: null };
      }

      const base64 = buffer.toString("base64");
      return { imageBase64: `data:image/png;base64,${base64}` };
    }),

  /**
   * Load Demo Project - one-click setup with canonical demo assets
   */
  loadDemoProject: publicProcedure.mutation(async ({ ctx }) => {
    const projectRepo = new PrismaProjectRepository(ctx.db);
    const maskRepo = new PrismaMaskRepository(ctx.db);

    // Create project
    const project = await projectRepo.create({ name: "Demo App Store" });
    const fileStore = createFileStore(project.id);

    // Load demo base image
    const baseImagePath = path.join(DEMO_ASSETS_DIR, DEMO_BASE_IMAGE);
    const baseImageBuffer = await fs.readFile(baseImagePath);
    const savedBasePath = await fileStore.saveBaseImage(baseImageBuffer);
    await projectRepo.updateBaseImagePath(project.id, savedBasePath);

    // Load demo mask
    const maskImagePath = path.join(DEMO_ASSETS_DIR, DEMO_MASK_IMAGE);
    const maskImageBuffer = await fs.readFile(maskImagePath);
    const savedMaskPath = await fileStore.saveMaskImage(maskImageBuffer);
    await maskRepo.create(project.id, savedMaskPath);

    // Return project with preselected locales
    return {
      project,
      baseImagePath: savedBasePath,
      maskPath: savedMaskPath,
      preselectedLocales: SUPPORTED_LOCALES as unknown as LocaleId[],
    };
  }),

  /**
   * Load demo base image into existing project
   */
  loadDemoBaseImage: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const fileStore = createFileStore(input.projectId);

      const baseImagePath = path.join(DEMO_ASSETS_DIR, DEMO_BASE_IMAGE);
      const baseImageBuffer = await fs.readFile(baseImagePath);
      const savedPath = await fileStore.saveBaseImage(baseImageBuffer);
      const project = await projectRepo.updateBaseImagePath(input.projectId, savedPath);

      return { project, filePath: savedPath };
    }),

  /**
   * Load demo mask into existing project
   */
  loadDemoMask: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const maskRepo = new PrismaMaskRepository(ctx.db);
      const fileStore = createFileStore(input.projectId);

      const maskImagePath = path.join(DEMO_ASSETS_DIR, DEMO_MASK_IMAGE);
      const maskImageBuffer = await fs.readFile(maskImagePath);
      const savedPath = await fileStore.saveMaskImage(maskImageBuffer);
      const mask = await maskRepo.update(input.projectId, savedPath);

      return { mask, filePath: savedPath };
    }),

  /**
   * Generate and get montage image
   */
  getMontage: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const fileStore = createFileStore(input.projectId);
      const montageService = getMontageService();
      const variantRepo = new PrismaVariantRepository(ctx.db);

      // Get base image
      const baseImage = await fileStore.getBaseImage();
      if (!baseImage) {
        throw new Error("Base image not found");
      }

      // Get variants
      const variants = await variantRepo.findByProjectId(input.projectId);
      if (variants.length === 0) {
        throw new Error("No variants found");
      }

      // Load variant images
      const images: Array<{ buffer: Buffer; label: string }> = [
        { buffer: baseImage, label: "Original (English)" },
      ];

      for (const locale of SUPPORTED_LOCALES) {
        const variantBuffer = await fileStore.getVariantImage(locale);
        if (variantBuffer) {
          images.push({
            buffer: variantBuffer,
            label: LOCALE_REGISTRY[locale].name,
          });
        }
      }

      // Pad to 4 images if needed
      while (images.length < 4) {
        images.push({ buffer: baseImage, label: "Placeholder" });
      }

      // Generate montage
      const montageBuffer = await montageService.generateMontage({ images });

      // Save montage
      const montagePath = await fileStore.saveExportFile("montage_2x2.png", montageBuffer);

      // Return as base64
      const base64 = montageBuffer.toString("base64");
      return {
        montageBase64: `data:image/png;base64,${base64}`,
        filePath: montagePath,
      };
    }),

  /**
   * Generate and download ZIP export
   */
  getExportZip: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const fileStore = createFileStore(input.projectId);
      const exportService = getExportService();
      const variantRepo = new PrismaVariantRepository(ctx.db);

      // Get base image
      const baseImage = await fileStore.getBaseImage();
      if (!baseImage) {
        throw new Error("Base image not found");
      }

      // Get mask image
      const maskImage = await fileStore.getMaskImage();
      if (!maskImage) {
        throw new Error("Mask image not found");
      }

      // Get variants
      const variants = await variantRepo.findByProjectId(input.projectId);
      if (variants.length === 0) {
        throw new Error("No variants found");
      }

      // Load variant and heatmap images
      const variantBuffers = new Map<LocaleId, Buffer>();
      const heatmapBuffers = new Map<LocaleId, Buffer>();

      for (const variant of variants) {
        const variantBuffer = await fileStore.getVariantImage(variant.locale);
        if (variantBuffer) {
          variantBuffers.set(variant.locale, variantBuffer);
        }

        const heatmapBuffer = await fileStore.getHeatmapImage(variant.locale);
        if (heatmapBuffer) {
          heatmapBuffers.set(variant.locale, heatmapBuffer);
        }
      }

      // Create export package
      const result = await exportService.createExportPackage({
        baseImage,
        maskImage,
        variants: variantBuffers,
        heatmaps: heatmapBuffers,
      });

      // Save files
      const zipPath = await fileStore.saveExportFile(
        `localelens_${input.projectId}_variants.zip`,
        result.zipBuffer
      );
      await fileStore.saveExportFile("montage_2x2.png", result.montageBuffer);

      // Return as base64
      const base64 = result.zipBuffer.toString("base64");
      return {
        zipBase64: `data:application/zip;base64,${base64}`,
        filePath: zipPath,
        fileSize: result.zipBuffer.length,
      };
    }),

  /**
   * Get heatmap image for a specific locale
   */
  getHeatmapImage: publicProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        locale: z.enum(SUPPORTED_LOCALES),
      })
    )
    .query(async ({ input }) => {
      const fileStore = createFileStore(input.projectId);
      const buffer = await fileStore.getHeatmapImage(input.locale);

      if (!buffer) {
        return { imageBase64: null };
      }

      const base64 = buffer.toString("base64");
      return { imageBase64: `data:image/png;base64,${base64}` };
    }),
});
