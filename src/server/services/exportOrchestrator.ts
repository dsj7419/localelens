/**
 * Export Orchestrator Service
 *
 * Orchestrates export operations (montage generation, ZIP creation).
 * Single responsibility: Coordinate export pipeline.
 */

import type { FileStore } from "./fileStore";
import type { IExportService } from "./exportService";
import type { IMontageService } from "./montageService";
import type { IVariantRepository } from "../domain/repositories/project.repository";
import { SUPPORTED_LOCALES, LOCALE_REGISTRY, type LocaleId } from "../domain/value-objects/locale";

export interface MontageResult {
  montageBuffer: Buffer;
  montageBase64: string;
  filePath: string;
}

export interface ExportZipResult {
  zipBuffer: Buffer;
  zipBase64: string;
  filePath: string;
  fileSize: number;
}

export interface IExportOrchestrator {
  generateMontage(): Promise<MontageResult>;
  generateExportZip(): Promise<ExportZipResult>;
}

interface Dependencies {
  fileStore: FileStore;
  variantRepo: IVariantRepository;
  exportService: IExportService;
  montageService: IMontageService;
}

/**
 * ExportOrchestrator
 *
 * Coordinates the export pipeline:
 * 1. Loads base image, mask, and variants
 * 2. Delegates to export/montage services
 * 3. Saves output files
 */
export class ExportOrchestrator implements IExportOrchestrator {
  constructor(
    private readonly projectId: string,
    private readonly deps: Dependencies
  ) {}

  /**
   * Generate montage image
   */
  async generateMontage(): Promise<MontageResult> {
    const { fileStore, variantRepo, montageService } = this.deps;

    // Load base image
    const baseImage = await fileStore.getBaseImage();
    if (!baseImage) {
      throw new Error("Base image not found");
    }

    // Load variants
    const variants = await variantRepo.findByProjectId(this.projectId);
    if (variants.length === 0) {
      throw new Error("No variants found");
    }

    // Build image array for montage
    const images: Array<{ buffer: Buffer; label: string }> = [
      { buffer: baseImage, label: "Original (English)" },
    ];

    // Load variant images in locale order
    for (const locale of SUPPORTED_LOCALES) {
      const variantBuffer = await fileStore.getVariantImage(locale);
      if (variantBuffer) {
        images.push({
          buffer: variantBuffer,
          label: LOCALE_REGISTRY[locale].name,
        });
      }
    }

    // Pad to 4 images if needed (2x2 grid)
    while (images.length < 4) {
      images.push({ buffer: baseImage, label: "Placeholder" });
    }

    // Generate montage
    const montageBuffer = await montageService.generateMontage({ images });

    // Save montage
    const filePath = await fileStore.saveExportFile("montage_2x2.png", montageBuffer);

    // Return with base64
    const montageBase64 = `data:image/png;base64,${montageBuffer.toString("base64")}`;

    return {
      montageBuffer,
      montageBase64,
      filePath,
    };
  }

  /**
   * Generate ZIP export package
   */
  async generateExportZip(): Promise<ExportZipResult> {
    const { fileStore, variantRepo, exportService } = this.deps;

    // Load base image
    const baseImage = await fileStore.getBaseImage();
    if (!baseImage) {
      throw new Error("Base image not found");
    }

    // Load mask image
    const maskImage = await fileStore.getMaskImage();
    if (!maskImage) {
      throw new Error("Mask image not found");
    }

    // Load variants
    const variants = await variantRepo.findByProjectId(this.projectId);
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
      `localelens_${this.projectId}_variants.zip`,
      result.zipBuffer
    );
    await fileStore.saveExportFile("montage_2x2.png", result.montageBuffer);

    // Return with base64
    const zipBase64 = `data:application/zip;base64,${result.zipBuffer.toString("base64")}`;

    return {
      zipBuffer: result.zipBuffer,
      zipBase64,
      filePath: zipPath,
      fileSize: result.zipBuffer.length,
    };
  }
}

/**
 * Factory function for creating ExportOrchestrator
 */
export function createExportOrchestrator(
  projectId: string,
  deps: Dependencies
): IExportOrchestrator {
  return new ExportOrchestrator(projectId, deps);
}
