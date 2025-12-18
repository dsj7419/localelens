/**
 * Project Repository Interface
 *
 * Abstraction for project persistence (Dependency Inversion Principle).
 * Implementations can use Prisma, in-memory, or any other storage.
 */

import type {
  Project,
  Mask,
  Variant,
  ProjectAggregate,
  CreateProjectInput,
  ProjectSummary,
} from "../entities/project";
import type { LocaleId } from "../value-objects/locale";
import type { DriftStatus } from "../value-objects/drift";

/**
 * Project repository interface (SRP: only project CRUD)
 */
export interface IProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<ProjectSummary[]>;
  updateBaseImagePath(id: string, path: string): Promise<Project>;
  delete(id: string): Promise<void>;
}

/**
 * Mask repository interface (SRP: only mask CRUD)
 */
export interface IMaskRepository {
  create(projectId: string, maskImagePath: string): Promise<Mask>;
  findByProjectId(projectId: string): Promise<Mask | null>;
  update(projectId: string, maskImagePath: string): Promise<Mask>;
  delete(projectId: string): Promise<void>;
}

/**
 * Variant repository interface (SRP: only variant CRUD)
 */
export interface IVariantRepository {
  create(input: CreateVariantInput): Promise<Variant>;
  findByProjectId(projectId: string): Promise<Variant[]>;
  findByProjectAndLocale(projectId: string, locale: LocaleId): Promise<Variant | null>;
  updateDriftScore(
    id: string,
    driftScore: number,
    driftStatus: DriftStatus
  ): Promise<Variant>;
  delete(id: string): Promise<void>;
  deleteByProjectId(projectId: string): Promise<void>;
}

/**
 * Create variant input
 */
export interface CreateVariantInput {
  projectId: string;
  locale: LocaleId;
  prompt: string;
  outputImagePath: string;
  modelUsed: string | null;
}

/**
 * Aggregate repository for loading full project with relations
 */
export interface IProjectAggregateRepository {
  findByIdWithRelations(id: string): Promise<ProjectAggregate | null>;
}
