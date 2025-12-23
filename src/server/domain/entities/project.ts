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
 * Verification status for translation accuracy
 */
export type VerificationStatus = "pass" | "warn" | "fail";

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
  // Verification fields (Sprint 9)
  translationAccuracy: number | null;
  verificationStatus: VerificationStatus | null;
  verificationDetails: string | null; // JSON string of VerificationResult
}

/**
 * Image Analysis entity (Vision-powered text detection results)
 */
export interface ImageAnalysisEntity {
  id: string;
  projectId: string;
  textRegions: string; // JSON string of TextRegion[]
  layout: string; // ImageLayout type
  surfaceTexture: string;
  dominantColors: string; // JSON string of string[]
  hasUIElements: boolean;
  uiElements: string | null; // JSON string of string[]
  imageDescription: string;
  analyzedAt: Date;
}

/**
 * Project with all related entities (aggregate)
 */
export interface ProjectAggregate {
  project: Project;
  mask: Mask | null;
  variants: Variant[];
  imageAnalysis: ImageAnalysisEntity | null;
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
