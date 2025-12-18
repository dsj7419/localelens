import fs from "fs/promises";
import path from "path";

const LOCAL_DATA_ROOT = path.join(process.cwd(), ".local-data");

export interface ProjectPaths {
  root: string;
  base: string;
  mask: string;
  variants: string;
  drift: string;
  exports: string;
}

export interface FileStoreConfig {
  projectId: string;
}

/**
 * FileStore Service
 * Handles all local file operations with deterministic naming.
 * All paths use forward slashes internally and path.join for OS compatibility.
 */
export class FileStore {
  private projectId: string;

  constructor(config: FileStoreConfig) {
    this.projectId = config.projectId;
  }

  /**
   * Get all paths for a project
   */
  getPaths(): ProjectPaths {
    const root = path.join(LOCAL_DATA_ROOT, "projects", this.projectId);
    return {
      root,
      base: path.join(root, "base.png"),
      mask: path.join(root, "mask.png"),
      variants: path.join(root, "variants"),
      drift: path.join(root, "drift"),
      exports: path.join(root, "exports"),
    };
  }

  /**
   * Ensure all project directories exist
   */
  async ensureProjectDirectories(): Promise<void> {
    const paths = this.getPaths();
    await fs.mkdir(paths.root, { recursive: true });
    await fs.mkdir(paths.variants, { recursive: true });
    await fs.mkdir(paths.drift, { recursive: true });
    await fs.mkdir(paths.exports, { recursive: true });
  }

  /**
   * Save base image
   */
  async saveBaseImage(buffer: Buffer): Promise<string> {
    await this.ensureProjectDirectories();
    const filePath = this.getPaths().base;
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Save mask image
   */
  async saveMaskImage(buffer: Buffer): Promise<string> {
    await this.ensureProjectDirectories();
    const filePath = this.getPaths().mask;
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Save variant image for a specific locale
   */
  async saveVariantImage(locale: string, buffer: Buffer): Promise<string> {
    await this.ensureProjectDirectories();
    const filePath = path.join(this.getPaths().variants, `${locale}.png`);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Save export file (montage or zip)
   */
  async saveExportFile(
    filename: string,
    buffer: Buffer
  ): Promise<string> {
    await this.ensureProjectDirectories();
    const filePath = path.join(this.getPaths().exports, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Read a file as buffer
   */
  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get base image buffer
   */
  async getBaseImage(): Promise<Buffer | null> {
    const filePath = this.getPaths().base;
    if (await this.fileExists(filePath)) {
      return this.readFile(filePath);
    }
    return null;
  }

  /**
   * Get mask image buffer
   */
  async getMaskImage(): Promise<Buffer | null> {
    const filePath = this.getPaths().mask;
    if (await this.fileExists(filePath)) {
      return this.readFile(filePath);
    }
    return null;
  }

  /**
   * Get variant image buffer for a specific locale
   */
  async getVariantImage(locale: string): Promise<Buffer | null> {
    const filePath = path.join(this.getPaths().variants, `${locale}.png`);
    if (await this.fileExists(filePath)) {
      return this.readFile(filePath);
    }
    return null;
  }

  /**
   * Save heatmap image for a specific locale
   */
  async saveHeatmapImage(locale: string, buffer: Buffer): Promise<string> {
    await this.ensureProjectDirectories();
    const filePath = path.join(this.getPaths().drift, `${locale}_heatmap.png`);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Get heatmap image buffer for a specific locale
   */
  async getHeatmapImage(locale: string): Promise<Buffer | null> {
    const filePath = path.join(this.getPaths().drift, `${locale}_heatmap.png`);
    if (await this.fileExists(filePath)) {
      return this.readFile(filePath);
    }
    return null;
  }

  /**
   * Save overlay image for a specific locale (heatmap overlaid on variant)
   */
  async saveOverlayImage(locale: string, buffer: Buffer): Promise<string> {
    await this.ensureProjectDirectories();
    const filePath = path.join(this.getPaths().drift, `${locale}_overlay.png`);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Get overlay image buffer for a specific locale
   */
  async getOverlayImage(locale: string): Promise<Buffer | null> {
    const filePath = path.join(this.getPaths().drift, `${locale}_overlay.png`);
    if (await this.fileExists(filePath)) {
      return this.readFile(filePath);
    }
    return null;
  }

  /**
   * List all variant locales that have been generated
   */
  async listVariants(): Promise<string[]> {
    const variantsDir = this.getPaths().variants;
    if (!(await this.fileExists(variantsDir))) {
      return [];
    }
    const files = await fs.readdir(variantsDir);
    return files
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.replace(".png", ""));
  }

  /**
   * Delete a project and all its files
   */
  async deleteProject(): Promise<void> {
    const projectRoot = this.getPaths().root;
    if (await this.fileExists(projectRoot)) {
      await fs.rm(projectRoot, { recursive: true, force: true });
    }
  }

  /**
   * Get montage path
   */
  getMontageFilePath(): string {
    return path.join(this.getPaths().exports, "montage_2x2.png");
  }

  /**
   * Get zip export path
   */
  getZipFilePath(): string {
    return path.join(
      this.getPaths().exports,
      `localelens_${this.projectId}_variants.zip`
    );
  }
}

/**
 * Static utility for outputs directory (used for test generation)
 */
export async function ensureOutputsDirectory(): Promise<string> {
  const outputsDir = path.join(LOCAL_DATA_ROOT, "outputs");
  await fs.mkdir(outputsDir, { recursive: true });
  return outputsDir;
}

/**
 * Save a test output image
 */
export async function saveTestOutput(
  filename: string,
  buffer: Buffer
): Promise<string> {
  const outputsDir = await ensureOutputsDirectory();
  const filePath = path.join(outputsDir, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Create a FileStore instance for a project
 */
export function createFileStore(projectId: string): FileStore {
  return new FileStore({ projectId });
}
