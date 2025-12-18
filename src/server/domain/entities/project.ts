/**
 * Project Entity
 *
 * Core domain entity representing a localization project.
 * Pure data structure - behavior lives in services.
 */

import type { LocaleId } from "../value-objects/locale";
import type { DriftStatus } from "../value-objects/drift";

/**
 * Project entity
 */
export interface Project {
  id: string;
  name: string;
  baseImagePath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mask entity (1:1 with Project)
 */
export interface Mask {
  id: string;
  projectId: string;
  maskImagePath: string;
  createdAt: Date;
}

/**
 * Variant entity (localized output)
 */
export interface Variant {
  id: string;
  projectId: string;
  locale: LocaleId;
  prompt: string;
  outputImagePath: string;
  driftScore: number | null;
  driftStatus: DriftStatus;
  modelUsed: string | null;
  createdAt: Date;
}

/**
 * Project with all related entities (aggregate)
 */
export interface ProjectAggregate {
  project: Project;
  mask: Mask | null;
  variants: Variant[];
}

/**
 * Create project input DTO
 */
export interface CreateProjectInput {
  name: string;
}

/**
 * Project summary for listing
 */
export interface ProjectSummary {
  id: string;
  name: string;
  hasBaseImage: boolean;
  hasMask: boolean;
  variantCount: number;
  createdAt: Date;
}
