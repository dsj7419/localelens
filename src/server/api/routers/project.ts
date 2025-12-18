/**
 * Project Router
 *
 * tRPC router for project management operations.
 * THIN LAYER - delegates to orchestrators and repositories.
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
import { createImageUploadOrchestrator } from "~/server/services/imageUploadOrchestrator";
import { createExportOrchestrator } from "~/server/services/exportOrchestrator";
import { SUPPORTED_LOCALES, type LocaleId } from "~/server/domain/value-objects/locale";
import fs from "fs/promises";
import path from "path";

// Demo asset paths (canonical from DEMO_SCRIPT)
const DEMO_ASSETS_DIR = path.join(process.cwd(), "docs", "demo-assets");
const DEMO_BASE_IMAGE = "base_appstore_en_1080x1920.png";
const DEMO_MASK_IMAGE = "mask_text_regions_1080x1920.png";

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

const projectIdSchema = z.object({
  projectId: z.string().cuid(),
});

const uploadBaseImageSchema = z.object({
  projectId: z.string().cuid(),
  imageBase64: z.string(),
});

const saveMaskSchema = z.object({
  projectId: z.string().cuid(),
  maskBase64: z.string(),
});

const localeSchema = z.enum(SUPPORTED_LOCALES);

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export const projectRouter = createTRPCRouter({
  // ───────────────────────────────────────────────────────────────────────────
  // Project CRUD
  // ───────────────────────────────────────────────────────────────────────────

  create: publicProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = new PrismaProjectRepository(ctx.db);
      const project = await repo.create({ name: input.name });
      return { project };
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    const repo = new PrismaProjectRepository(ctx.db);
    const projects = await repo.findAll();
    return { projects };
  }),

  get: publicProcedure.input(projectIdSchema).query(async ({ ctx, input }) => {
    const repo = new PrismaProjectAggregateRepository(ctx.db);
    const aggregate = await repo.findByIdWithRelations(input.projectId);
    if (!aggregate) {
      throw new Error("Project not found");
    }
    return { aggregate };
  }),

  delete: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const projectRepo = new PrismaProjectRepository(ctx.db);
      const fileStore = createFileStore(input.projectId);
      await fileStore.deleteProject();
      await projectRepo.delete(input.projectId);
      return { success: true };
    }),

  // ───────────────────────────────────────────────────────────────────────────
  // Image Upload (delegated to orchestrator)
  // ───────────────────────────────────────────────────────────────────────────

  uploadBaseImage: publicProcedure
    .input(uploadBaseImageSchema)
    .mutation(async ({ ctx, input }) => {
      const orchestrator = createImageUploadOrchestrator(input.projectId, {
        fileStore: createFileStore(input.projectId),
        projectRepo: new PrismaProjectRepository(ctx.db),
        maskRepo: new PrismaMaskRepository(ctx.db),
      });
      const result = await orchestrator.uploadBaseImage(input.imageBase64);
      return { project: result.project, filePath: result.filePath };
    }),

  saveMask: publicProcedure
    .input(saveMaskSchema)
    .mutation(async ({ ctx, input }) => {
      const orchestrator = createImageUploadOrchestrator(input.projectId, {
        fileStore: createFileStore(input.projectId),
        projectRepo: new PrismaProjectRepository(ctx.db),
        maskRepo: new PrismaMaskRepository(ctx.db),
      });
      const result = await orchestrator.uploadMask(input.maskBase64);
      return { mask: result.mask, filePath: result.filePath };
    }),

  deleteMask: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const orchestrator = createImageUploadOrchestrator(input.projectId, {
        fileStore: createFileStore(input.projectId),
        projectRepo: new PrismaProjectRepository(ctx.db),
        maskRepo: new PrismaMaskRepository(ctx.db),
      });
      await orchestrator.deleteMask();
      return { success: true };
    }),

  // ───────────────────────────────────────────────────────────────────────────
  // Image Retrieval (direct file store access - simple queries)
  // ───────────────────────────────────────────────────────────────────────────

  getBaseImage: publicProcedure
    .input(projectIdSchema)
    .query(async ({ input }) => {
      const fileStore = createFileStore(input.projectId);
      const buffer = await fileStore.getBaseImage();
      if (!buffer) return { imageBase64: null };
      return { imageBase64: `data:image/png;base64,${buffer.toString("base64")}` };
    }),

  getMask: publicProcedure.input(projectIdSchema).query(async ({ input }) => {
    const fileStore = createFileStore(input.projectId);
    const buffer = await fileStore.getMaskImage();
    if (!buffer) return { maskBase64: null };
    return { maskBase64: `data:image/png;base64,${buffer.toString("base64")}` };
  }),

  getVariantImage: publicProcedure
    .input(z.object({ projectId: z.string().cuid(), locale: localeSchema }))
    .query(async ({ input }) => {
      const fileStore = createFileStore(input.projectId);
      const buffer = await fileStore.getVariantImage(input.locale);
      if (!buffer) return { imageBase64: null };
      return { imageBase64: `data:image/png;base64,${buffer.toString("base64")}` };
    }),

  getHeatmapImage: publicProcedure
    .input(z.object({ projectId: z.string().cuid(), locale: z.enum(SUPPORTED_LOCALES) }))
    .query(async ({ input }) => {
      const fileStore = createFileStore(input.projectId);
      const buffer = await fileStore.getHeatmapImage(input.locale);
      if (!buffer) return { imageBase64: null };
      return { imageBase64: `data:image/png;base64,${buffer.toString("base64")}` };
    }),

  // ───────────────────────────────────────────────────────────────────────────
  // Export Operations (delegated to orchestrator)
  // ───────────────────────────────────────────────────────────────────────────

  getMontage: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const orchestrator = createExportOrchestrator(input.projectId, {
        fileStore: createFileStore(input.projectId),
        variantRepo: new PrismaVariantRepository(ctx.db),
        exportService: getExportService(),
        montageService: getMontageService(),
      });
      const result = await orchestrator.generateMontage();
      return { montageBase64: result.montageBase64, filePath: result.filePath };
    }),

  getExportZip: publicProcedure
    .input(projectIdSchema)
    .mutation(async ({ ctx, input }) => {
      const orchestrator = createExportOrchestrator(input.projectId, {
        fileStore: createFileStore(input.projectId),
        variantRepo: new PrismaVariantRepository(ctx.db),
        exportService: getExportService(),
        montageService: getMontageService(),
      });
      const result = await orchestrator.generateExportZip();
      return {
        zipBase64: result.zipBase64,
        filePath: result.filePath,
        fileSize: result.fileSize,
      };
    }),

  // ───────────────────────────────────────────────────────────────────────────
  // Demo Operations (file loading - acceptable in router for simplicity)
  // ───────────────────────────────────────────────────────────────────────────

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

    return {
      project,
      baseImagePath: savedBasePath,
      maskPath: savedMaskPath,
      preselectedLocales: SUPPORTED_LOCALES as unknown as LocaleId[],
    };
  }),

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
});
