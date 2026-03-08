import { mkdir, readFile, writeFile, readdir, stat, copyFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { BaseError } from "../utils/error.js";

/** Checkpoint management error */
export class CheckpointError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "CHECKPOINT_ERROR", context);
  }
}

/** A single file snapshot within a checkpoint */
export interface FileSnapshot {
  readonly relativePath: string;
  readonly contentHash: string;
  readonly size: number;
  readonly exists: boolean;
}

/** Checkpoint metadata */
export interface Checkpoint {
  readonly id: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly description: string;
  readonly messageIndex: number;
  readonly files: readonly FileSnapshot[];
}

/** Options for creating a checkpoint */
export interface CreateCheckpointOptions {
  readonly sessionId: string;
  readonly description: string;
  readonly messageIndex: number;
  readonly workingDirectory: string;
  readonly trackedFiles: readonly string[];
}

/** Result of restoring a checkpoint */
export interface RestoreResult {
  readonly restoredFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly checkpoint: Checkpoint;
}

/**
 * Checkpoint manager — handles file state checkpointing and rewind capability.
 *
 * Checkpoints store file content snapshots and can restore them.
 * Directory structure per session:
 * ```
 * {session-dir}/checkpoints/
 * ├── cp-001.json    # Checkpoint metadata + file list
 * ├── cp-001/        # Stored file contents
 * │   ├── src__index.ts
 * │   └── src__utils__path.ts
 * └── ...
 * ```
 */
export class CheckpointManager {
  private readonly checkpointsDir: string;
  private nextId: number;

  constructor(sessionDir: string) {
    this.checkpointsDir = join(sessionDir, "checkpoints");
    this.nextId = 1;
  }

  /** Ensure the checkpoints directory exists */
  private async ensureDir(): Promise<void> {
    await mkdir(this.checkpointsDir, { recursive: true });
  }

  /**
   * Create a checkpoint of the specified files.
   */
  async createCheckpoint(options: CreateCheckpointOptions): Promise<Checkpoint> {
    await this.ensureDir();

    // Determine next checkpoint ID
    await this.syncNextId();
    const id = `cp-${String(this.nextId).padStart(3, "0")}`;
    this.nextId++;

    const cpDir = join(this.checkpointsDir, id);
    await mkdir(cpDir, { recursive: true });

    // Snapshot each tracked file
    const snapshots: FileSnapshot[] = [];
    for (const filePath of options.trackedFiles) {
      const fullPath = resolve(options.workingDirectory, filePath);
      const relativeTo = relative(options.workingDirectory, fullPath);
      const safeFileName = relativeTo.replace(/[\\/]/g, "__");

      try {
        const fileStat = await stat(fullPath);
        if (!fileStat.isFile()) continue;

        // Read once, hash from buffer, write to checkpoint
        const content = await readFile(fullPath);
        const destPath = join(cpDir, safeFileName);
        await writeFile(destPath, content);
        const hash = createHash("sha256").update(content).digest("hex");

        snapshots.push({
          relativePath: relativeTo.replace(/\\/g, "/"),
          contentHash: hash,
          size: fileStat.size,
          exists: true,
        });
      } catch {
        // File doesn't exist — record as non-existent
        snapshots.push({
          relativePath: relativeTo.replace(/\\/g, "/"),
          contentHash: "",
          size: 0,
          exists: false,
        });
      }
    }

    const checkpoint: Checkpoint = {
      id,
      sessionId: options.sessionId,
      createdAt: new Date().toISOString(),
      description: options.description,
      messageIndex: options.messageIndex,
      files: snapshots,
    };

    // Write checkpoint metadata
    await writeFile(
      join(this.checkpointsDir, `${id}.json`),
      JSON.stringify(checkpoint, null, 2),
      "utf-8",
    );

    return checkpoint;
  }

  /**
   * List all checkpoints, sorted by creation time (oldest first).
   */
  async listCheckpoints(): Promise<readonly Checkpoint[]> {
    await this.ensureDir();

    try {
      const entries = await readdir(this.checkpointsDir);
      const jsonFiles = entries.filter((e) => e.endsWith(".json")).sort();

      const checkpoints: Checkpoint[] = [];
      for (const file of jsonFiles) {
        const content = await readFile(join(this.checkpointsDir, file), "utf-8");
        checkpoints.push(JSON.parse(content) as Checkpoint);
      }

      return checkpoints;
    } catch {
      return [];
    }
  }

  /**
   * Get a specific checkpoint by ID.
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint> {
    const metaPath = join(this.checkpointsDir, `${checkpointId}.json`);
    try {
      const content = await readFile(metaPath, "utf-8");
      return JSON.parse(content) as Checkpoint;
    } catch {
      throw new CheckpointError("Checkpoint not found", { checkpointId });
    }
  }

  /**
   * Restore files from a checkpoint to the working directory.
   */
  async restoreCheckpoint(checkpointId: string, workingDirectory: string): Promise<RestoreResult> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    const cpDir = join(this.checkpointsDir, checkpointId);

    const restoredFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const snapshot of checkpoint.files) {
      if (!snapshot.exists) {
        skippedFiles.push(snapshot.relativePath);
        continue;
      }

      const safeFileName = snapshot.relativePath.replace(/[\\/]/g, "__");
      const srcPath = join(cpDir, safeFileName);
      const destPath = resolve(workingDirectory, snapshot.relativePath);

      try {
        // Ensure destination directory exists
        await mkdir(dirname(destPath), { recursive: true });

        await copyFile(srcPath, destPath);
        restoredFiles.push(snapshot.relativePath);
      } catch {
        skippedFiles.push(snapshot.relativePath);
      }
    }

    return { restoredFiles, skippedFiles, checkpoint };
  }

  /**
   * Get a summary of changes between a checkpoint and current file state.
   */
  async diffFromCheckpoint(
    checkpointId: string,
    workingDirectory: string,
  ): Promise<
    readonly {
      readonly path: string;
      readonly status: "modified" | "unchanged" | "deleted" | "new";
    }[]
  > {
    const checkpoint = await this.getCheckpoint(checkpointId);
    const results: { path: string; status: "modified" | "unchanged" | "deleted" | "new" }[] = [];

    for (const snapshot of checkpoint.files) {
      const fullPath = resolve(workingDirectory, snapshot.relativePath);

      if (!snapshot.exists) {
        // File didn't exist at checkpoint time
        try {
          await stat(fullPath);
          results.push({ path: snapshot.relativePath, status: "new" });
        } catch {
          results.push({ path: snapshot.relativePath, status: "unchanged" });
        }
        continue;
      }

      try {
        const content = await readFile(fullPath);
        const currentHash = createHash("sha256").update(content).digest("hex");

        if (currentHash === snapshot.contentHash) {
          results.push({ path: snapshot.relativePath, status: "unchanged" });
        } else {
          results.push({ path: snapshot.relativePath, status: "modified" });
        }
      } catch {
        results.push({ path: snapshot.relativePath, status: "deleted" });
      }
    }

    return results;
  }

  /** Sync nextId from existing checkpoint files */
  private async syncNextId(): Promise<void> {
    try {
      const entries = await readdir(this.checkpointsDir);
      const cpFiles = entries.filter((e) => e.match(/^cp-\d+\.json$/));
      if (cpFiles.length === 0) {
        this.nextId = 1;
        return;
      }

      const maxId = Math.max(
        ...cpFiles.map((f) => {
          const match = f.match(/^cp-(\d+)\.json$/);
          return match ? parseInt(match[1], 10) : 0;
        }),
      );
      this.nextId = maxId + 1;
    } catch {
      this.nextId = 1;
    }
  }
}
