/**
 * Image Upload Orchestrator Service
 *
 * Orchestrates image upload operations (base image, mask).
 * Single responsibility: Coordinate image upload pipeline.
 */

import type { FileStore } from "./fileStore";
import type { IProjectRepository, IMaskRepository } from "../domain/repositories/project.repository";
import type { Project, Mask } from "../domain/entities/project";

export interface ImageUploadResult {
  filePath: string;
}

export interface BaseImageUploadResult extends ImageUploadResult {
  project: Project;
}

export interface MaskUploadResult extends ImageUploadResult {
  mask: Mask;
}

export interface IImageUploadOrchestrator {
  uploadBaseImage(base64Data: string): Promise<BaseImageUploadResult>;
  uploadMask(base64Data: string): Promise<MaskUploadResult>;
  deleteMask(): Promise<void>;
}

interface Dependencies {
  fileStore: FileStore;
  projectRepo: IProjectRepository;
  maskRepo: IMaskRepository;
}

/**
 * ImageUploadOrchestrator
 *
 * Coordinates image upload pipeline:
 * 1. Decodes base64 data
 * 2. Saves to file store
 * 3. Updates database
 */
export class ImageUploadOrchestrator implements IImageUploadOrchestrator {
  constructor(
    private readonly projectId: string,
    private readonly deps: Dependencies
  ) {}

  /**
   * Upload base image
   *
   * Pipeline:
   * 1. Decode base64 to buffer
   * 2. Save to file store
   * 3. Update project record with path
   */
  async uploadBaseImage(base64Data: string): Promise<BaseImageUploadResult> {
    const { fileStore, projectRepo } = this.deps;

    // Decode base64
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");

    // Save to file store
    const filePath = await fileStore.saveBaseImage(imageBuffer);

    // Update project record
    const project = await projectRepo.updateBaseImagePath(this.projectId, filePath);

    return { project, filePath };
  }

  /**
   * Upload mask image
   *
   * Pipeline:
   * 1. Decode base64 to buffer
   * 2. Save to file store
   * 3. Create or update mask record
   */
  async uploadMask(base64Data: string): Promise<MaskUploadResult> {
    const { fileStore, maskRepo } = this.deps;

    // Decode base64
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const maskBuffer = Buffer.from(cleanBase64, "base64");

    // Save to file store
    const filePath = await fileStore.saveMaskImage(maskBuffer);

    // Create or update mask record (upsert)
    const mask = await maskRepo.update(this.projectId, filePath);

    return { mask, filePath };
  }

  /**
   * Delete mask
   *
   * Pipeline:
   * 1. Delete file from store
   * 2. Delete database record
   */
  async deleteMask(): Promise<void> {
    const { fileStore, maskRepo } = this.deps;

    // Delete file
    await fileStore.deleteMaskImage();

    // Delete database record
    await maskRepo.delete(this.projectId);
  }
}

/**
 * Factory function for creating ImageUploadOrchestrator
 */
export function createImageUploadOrchestrator(
  projectId: string,
  deps: Dependencies
): IImageUploadOrchestrator {
  return new ImageUploadOrchestrator(projectId, deps);
}
