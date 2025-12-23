/**
 * Prisma Project Repository
 *
 * Concrete implementation of project repositories using Prisma.
 * Implements Dependency Inversion - depends on repository interfaces.
 */

import type { PrismaClient, Project as PrismaProject, Mask as PrismaMask, Variant as PrismaVariant, ImageAnalysis as PrismaImageAnalysis } from "../../../../generated/prisma";
import type {
  Project,
  Mask,
  Variant,
  ProjectAggregate,
  CreateProjectInput,
  ProjectSummary,
} from "../../domain/entities/project";
import type {
  IProjectRepository,
  IMaskRepository,
  IVariantRepository,
  IProjectAggregateRepository,
  CreateVariantInput,
} from "../../domain/repositories/project.repository";
import type { LocaleId } from "../../domain/value-objects/locale";
import type { DriftStatus } from "../../domain/value-objects/drift";

// =============================================================================
// Project Repository Implementation
// =============================================================================

export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateProjectInput): Promise<Project> {
    const result = await this.db.project.create({
      data: { name: input.name },
    });
    return this.mapToProject(result);
  }

  async findById(id: string): Promise<Project | null> {
    const result = await this.db.project.findUnique({ where: { id } });
    return result ? this.mapToProject(result) : null;
  }

  async findAll(): Promise<ProjectSummary[]> {
    const results = await this.db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        mask: true,
        variants: true,
      },
    });

    return results.map((p: PrismaProject & { mask: PrismaMask | null; variants: PrismaVariant[] }) => ({
      id: p.id,
      name: p.name,
      hasBaseImage: !!p.baseImagePath,
      hasMask: !!p.mask,
      variantCount: p.variants.length,
      createdAt: p.createdAt,
    }));
  }

  async updateBaseImagePath(id: string, path: string): Promise<Project> {
    const result = await this.db.project.update({
      where: { id },
      data: { baseImagePath: path },
    });
    return this.mapToProject(result);
  }

  async delete(id: string): Promise<void> {
    await this.db.project.delete({ where: { id } });
  }

  private mapToProject(data: {
    id: string;
    name: string;
    baseImagePath: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return {
      id: data.id,
      name: data.name,
      baseImagePath: data.baseImagePath,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

// =============================================================================
// Mask Repository Implementation
// =============================================================================

export class PrismaMaskRepository implements IMaskRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(projectId: string, maskImagePath: string): Promise<Mask> {
    const result = await this.db.mask.create({
      data: { projectId, maskImagePath },
    });
    return this.mapToMask(result);
  }

  async findByProjectId(projectId: string): Promise<Mask | null> {
    const result = await this.db.mask.findUnique({ where: { projectId } });
    return result ? this.mapToMask(result) : null;
  }

  async update(projectId: string, maskImagePath: string): Promise<Mask> {
    const result = await this.db.mask.upsert({
      where: { projectId },
      update: { maskImagePath },
      create: { projectId, maskImagePath },
    });
    return this.mapToMask(result);
  }

  async delete(projectId: string): Promise<void> {
    await this.db.mask.deleteMany({ where: { projectId } });
  }

  private mapToMask(data: {
    id: string;
    projectId: string;
    maskImagePath: string;
    createdAt: Date;
  }): Mask {
    return {
      id: data.id,
      projectId: data.projectId,
      maskImagePath: data.maskImagePath,
      createdAt: data.createdAt,
    };
  }
}

// =============================================================================
// Variant Repository Implementation
// =============================================================================

export class PrismaVariantRepository implements IVariantRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateVariantInput): Promise<Variant> {
    const result = await this.db.variant.create({
      data: {
        projectId: input.projectId,
        locale: input.locale,
        prompt: input.prompt,
        outputImagePath: input.outputImagePath,
        modelUsed: input.modelUsed,
        driftStatus: "PENDING",
      },
    });
    return this.mapToVariant(result);
  }

  async findByProjectId(projectId: string): Promise<Variant[]> {
    const results = await this.db.variant.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return results.map((v: PrismaVariant) => this.mapToVariant(v));
  }

  async findByProjectAndLocale(
    projectId: string,
    locale: LocaleId
  ): Promise<Variant | null> {
    const result = await this.db.variant.findUnique({
      where: { projectId_locale: { projectId, locale } },
    });
    return result ? this.mapToVariant(result) : null;
  }

  async updateDriftScore(
    id: string,
    driftScore: number,
    driftStatus: DriftStatus
  ): Promise<Variant> {
    const result = await this.db.variant.update({
      where: { id },
      data: { driftScore, driftStatus },
    });
    return this.mapToVariant(result);
  }

  async delete(id: string): Promise<void> {
    await this.db.variant.delete({ where: { id } });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.db.variant.deleteMany({ where: { projectId } });
  }

  /**
   * Update verification data for a variant (Sprint 9)
   */
  async updateVerification(
    id: string,
    translationAccuracy: number,
    verificationStatus: "pass" | "warn" | "fail",
    verificationDetails: string
  ): Promise<Variant> {
    const result = await this.db.variant.update({
      where: { id },
      data: {
        translationAccuracy,
        verificationStatus,
        verificationDetails,
      },
    });
    return this.mapToVariant(result);
  }

  private mapToVariant(data: {
    id: string;
    projectId: string;
    locale: string;
    prompt: string;
    outputImagePath: string;
    driftScore: number | null;
    driftStatus: string;
    modelUsed: string | null;
    createdAt: Date;
    translationAccuracy?: number | null;
    verificationStatus?: string | null;
    verificationDetails?: string | null;
  }): Variant {
    return {
      id: data.id,
      projectId: data.projectId,
      locale: data.locale as LocaleId,
      prompt: data.prompt,
      outputImagePath: data.outputImagePath,
      driftScore: data.driftScore,
      driftStatus: data.driftStatus as DriftStatus,
      modelUsed: data.modelUsed,
      createdAt: data.createdAt,
      translationAccuracy: data.translationAccuracy ?? null,
      verificationStatus: (data.verificationStatus as "pass" | "warn" | "fail") ?? null,
      verificationDetails: data.verificationDetails ?? null,
    };
  }
}

// =============================================================================
// Image Analysis Repository Implementation
// =============================================================================

/**
 * Image Analysis data structure (matches Prisma model)
 */
export interface ImageAnalysisData {
  id: string;
  projectId: string;
  textRegions: string; // JSON string
  layout: string;
  surfaceTexture: string;
  dominantColors: string; // JSON string
  hasUIElements: boolean;
  uiElements: string | null;
  imageDescription: string;
  analyzedAt: Date;
}

/**
 * Input for creating image analysis
 */
export interface CreateImageAnalysisInput {
  projectId: string;
  textRegions: string;
  layout: string;
  surfaceTexture: string;
  dominantColors: string;
  hasUIElements: boolean;
  uiElements?: string;
  imageDescription: string;
}

export class PrismaImageAnalysisRepository {
  constructor(private readonly db: PrismaClient) {}

  async upsert(input: CreateImageAnalysisInput): Promise<ImageAnalysisData> {
    const result = await this.db.imageAnalysis.upsert({
      where: { projectId: input.projectId },
      update: {
        textRegions: input.textRegions,
        layout: input.layout,
        surfaceTexture: input.surfaceTexture,
        dominantColors: input.dominantColors,
        hasUIElements: input.hasUIElements,
        uiElements: input.uiElements ?? null,
        imageDescription: input.imageDescription,
        analyzedAt: new Date(),
      },
      create: {
        projectId: input.projectId,
        textRegions: input.textRegions,
        layout: input.layout,
        surfaceTexture: input.surfaceTexture,
        dominantColors: input.dominantColors,
        hasUIElements: input.hasUIElements,
        uiElements: input.uiElements ?? null,
        imageDescription: input.imageDescription,
      },
    });
    return this.mapToImageAnalysis(result);
  }

  async findByProjectId(projectId: string): Promise<ImageAnalysisData | null> {
    const result = await this.db.imageAnalysis.findUnique({
      where: { projectId },
    });
    return result ? this.mapToImageAnalysis(result) : null;
  }

  async delete(projectId: string): Promise<void> {
    await this.db.imageAnalysis.deleteMany({ where: { projectId } });
  }

  private mapToImageAnalysis(data: PrismaImageAnalysis): ImageAnalysisData {
    return {
      id: data.id,
      projectId: data.projectId,
      textRegions: data.textRegions,
      layout: data.layout,
      surfaceTexture: data.surfaceTexture,
      dominantColors: data.dominantColors,
      hasUIElements: data.hasUIElements,
      uiElements: data.uiElements,
      imageDescription: data.imageDescription,
      analyzedAt: data.analyzedAt,
    };
  }
}

// =============================================================================
// Aggregate Repository Implementation
// =============================================================================

export class PrismaProjectAggregateRepository
  implements IProjectAggregateRepository
{
  constructor(private readonly db: PrismaClient) {}

  async findByIdWithRelations(id: string): Promise<ProjectAggregate | null> {
    const result = await this.db.project.findUnique({
      where: { id },
      include: {
        mask: true,
        variants: { orderBy: { createdAt: "desc" } },
        imageAnalysis: true,
      },
    });

    if (!result) return null;

    return {
      project: {
        id: result.id,
        name: result.name,
        baseImagePath: result.baseImagePath,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      mask: result.mask
        ? {
            id: result.mask.id,
            projectId: result.mask.projectId,
            maskImagePath: result.mask.maskImagePath,
            createdAt: result.mask.createdAt,
          }
        : null,
      variants: result.variants.map((v: PrismaVariant) => ({
        id: v.id,
        projectId: v.projectId,
        locale: v.locale as LocaleId,
        prompt: v.prompt,
        outputImagePath: v.outputImagePath,
        driftScore: v.driftScore,
        driftStatus: v.driftStatus as DriftStatus,
        modelUsed: v.modelUsed,
        createdAt: v.createdAt,
        translationAccuracy: v.translationAccuracy ?? null,
        verificationStatus: (v.verificationStatus as "pass" | "warn" | "fail") ?? null,
        verificationDetails: v.verificationDetails ?? null,
      })),
      imageAnalysis: result.imageAnalysis
        ? {
            id: result.imageAnalysis.id,
            projectId: result.imageAnalysis.projectId,
            textRegions: result.imageAnalysis.textRegions,
            layout: result.imageAnalysis.layout,
            surfaceTexture: result.imageAnalysis.surfaceTexture,
            dominantColors: result.imageAnalysis.dominantColors,
            hasUIElements: result.imageAnalysis.hasUIElements,
            uiElements: result.imageAnalysis.uiElements,
            imageDescription: result.imageAnalysis.imageDescription,
            analyzedAt: result.imageAnalysis.analyzedAt,
          }
        : null,
    };
  }
}
