/**
 * Demo Mode Service
 *
 * Single Responsibility: Manage demo mode fallback when OpenAI API is unavailable.
 * Provides pre-generated outputs for judges when API returns 403 or key is missing.
 */

import fs from "fs/promises";
import path from "path";
import type { LocaleId } from "../domain/value-objects/locale";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface DemoOutputs {
  variants: Map<LocaleId, Buffer>;
  heatmaps: Map<LocaleId, Buffer>;
}

export interface IDemoModeService {
  isDemoModeRequired(error?: Error | string): boolean;
  loadDemoOutputs(): Promise<DemoOutputs>;
  getDemoVariant(locale: LocaleId): Promise<Buffer | null>;
  getDemoHeatmap(locale: LocaleId): Promise<Buffer | null>;
}

// =============================================================================
// Constants
// =============================================================================

const DEMO_OUTPUTS_DIR = path.join(
  process.cwd(),
  "docs",
  "demo-assets",
  "expected-outputs"
);

/** Error patterns that trigger demo mode */
const DEMO_MODE_TRIGGERS = [
  "403",
  "Forbidden",
  "rate limit",
  "insufficient_quota",
  "invalid_api_key",
  "authentication",
  "organization",
  "billing",
];

// =============================================================================
// Demo Mode Service Implementation
// =============================================================================

/**
 * Demo Mode Service
 *
 * Detects when API is unavailable and provides pre-generated demo outputs.
 * Critical for ensuring judges can evaluate the tool even with API issues.
 */
export class DemoModeService implements IDemoModeService {
  /**
   * Check if demo mode should be activated based on an error
   */
  isDemoModeRequired(error?: Error | string): boolean {
    if (!error) return false;

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    const lowerMessage = errorMessage.toLowerCase();

    return DEMO_MODE_TRIGGERS.some((trigger) =>
      lowerMessage.includes(trigger.toLowerCase())
    );
  }

  /**
   * Load all demo outputs
   */
  async loadDemoOutputs(): Promise<DemoOutputs> {
    const variants = new Map<LocaleId, Buffer>();
    const heatmaps = new Map<LocaleId, Buffer>();

    const locales: LocaleId[] = ["es-MX", "fr-CA", "ar"];

    for (const locale of locales) {
      const variantBuffer = await this.getDemoVariant(locale);
      if (variantBuffer) {
        variants.set(locale, variantBuffer);
      }

      const heatmapBuffer = await this.getDemoHeatmap(locale);
      if (heatmapBuffer) {
        heatmaps.set(locale, heatmapBuffer);
      }
    }

    return { variants, heatmaps };
  }

  /**
   * Get demo variant for a specific locale
   */
  async getDemoVariant(locale: LocaleId): Promise<Buffer | null> {
    const filePath = path.join(DEMO_OUTPUTS_DIR, "variants", `${locale}.png`);

    try {
      await fs.access(filePath);
      return await fs.readFile(filePath);
    } catch {
      console.log(`[DemoModeService] Demo variant not found for ${locale}`);
      return null;
    }
  }

  /**
   * Get demo heatmap for a specific locale
   */
  async getDemoHeatmap(locale: LocaleId): Promise<Buffer | null> {
    const filePath = path.join(DEMO_OUTPUTS_DIR, "drift", `${locale}_heatmap.png`);

    try {
      await fs.access(filePath);
      return await fs.readFile(filePath);
    } catch {
      console.log(`[DemoModeService] Demo heatmap not found for ${locale}`);
      return null;
    }
  }

  /**
   * Check if demo outputs are available
   */
  async hasDemoOutputs(): Promise<boolean> {
    try {
      await fs.access(DEMO_OUTPUTS_DIR);
      const files = await fs.readdir(path.join(DEMO_OUTPUTS_DIR, "variants"));
      return files.length > 0;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

let serviceInstance: DemoModeService | null = null;

export function getDemoModeService(): DemoModeService {
  if (!serviceInstance) {
    serviceInstance = new DemoModeService();
  }
  return serviceInstance;
}

export function createDemoModeService(): DemoModeService {
  return new DemoModeService();
}
