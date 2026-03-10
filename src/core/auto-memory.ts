import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { z } from "zod";
import { BaseError } from "../utils/error.js";
import { joinPath } from "../utils/path.js";
import { CONFIG_DIR } from "../constants.js";

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/** Memory system error */
export class MemoryError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MEMORY_ERROR", context);
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Zod schema for validating topic names */
export const topicNameSchema = z
  .string()
  .min(1, "Topic name must not be empty")
  .max(100, "Topic name must be 100 characters or fewer")
  .regex(
    /^[a-zA-Z][a-zA-Z0-9 _-]*$/,
    "Topic name must start with a letter and contain only letters, digits, spaces, hyphens, or underscores",
  );

/** Zod schema for memory content */
export const memoryContentSchema = z.string().min(1, "Memory content must not be empty");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of lines allowed in MEMORY.md before truncation */
const MAX_MEMORY_LINES = 200;

/** Name of the main memory file */
const MAIN_MEMORY_FILE = "MEMORY.md";

/** Truncation warning comment inserted when content is trimmed */
const TRUNCATION_WARNING =
  "<!-- WARNING: Content was truncated to 200 lines. Older entries may have been removed. -->";

/** Base directory for project memory storage */
const PROJECTS_BASE_DIR = joinPath(CONFIG_DIR, "projects");

// ---------------------------------------------------------------------------
// MemoryManager
// ---------------------------------------------------------------------------

/**
 * MemoryManager — loads, saves, and manages per-project auto-memory.
 *
 * Memory is stored at:
 *   ~/.dbcode/projects/{projectHash}/memory/MEMORY.md
 *
 * where projectHash = sha256(absoluteCwd).slice(0, 12)
 *
 * Topic-based memory files (e.g., debugging.md, patterns.md) live in the same
 * directory and can be used to organise knowledge into separate concerns.
 */
export class MemoryManager {
  /** Absolute path of the project root used to derive the project hash */
  readonly projectRoot: string;

  /** SHA-256-based project hash (first 12 hex chars) */
  readonly projectHash: string;

  constructor(cwd: string) {
    this.projectRoot = resolve(cwd);
    this.projectHash = computeProjectHash(this.projectRoot);
  }

  // -----------------------------------------------------------------------
  // Main memory
  // -----------------------------------------------------------------------

  /**
   * Load the main MEMORY.md content.
   * Returns an empty string if the file does not exist.
   * Content is capped at {@link MAX_MEMORY_LINES} lines.
   */
  async loadMainMemory(): Promise<string> {
    const filePath = this.mainMemoryPath();

    if (!existsSync(filePath)) {
      return "";
    }

    try {
      const raw = await readFile(filePath, "utf-8");
      const lines = raw.split("\n");

      if (lines.length > MAX_MEMORY_LINES) {
        return lines.slice(0, MAX_MEMORY_LINES).join("\n");
      }

      return raw;
    } catch (error: unknown) {
      throw new MemoryError("Failed to load main memory", {
        filePath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save content to the main MEMORY.md file.
   * Writes atomically (write-to-temp + rename).
   * If the content exceeds {@link MAX_MEMORY_LINES} lines it is truncated and
   * a warning comment is prepended.
   */
  async saveMainMemory(content: string): Promise<void> {
    const dir = this.getMemoryDir();
    const filePath = this.mainMemoryPath();

    await ensureDir(dir);

    const lines = content.split("\n");
    let finalContent: string;

    if (lines.length > MAX_MEMORY_LINES) {
      const truncated = lines.slice(0, MAX_MEMORY_LINES).join("\n");
      finalContent = `${TRUNCATION_WARNING}\n${truncated}`;
    } else {
      finalContent = content;
    }

    await atomicWrite(filePath, finalContent);
  }

  // -----------------------------------------------------------------------
  // Topic memory
  // -----------------------------------------------------------------------

  /**
   * Load a topic memory file (e.g., "debugging" -> debugging.md).
   * Returns `null` if the file does not exist.
   */
  async loadTopicMemory(topic: string): Promise<string | null> {
    const parsed = topicNameSchema.safeParse(topic);
    if (!parsed.success) {
      throw new MemoryError("Invalid topic name", {
        topic,
        issues: parsed.error.issues.map((i) => i.message),
      });
    }

    const filePath = this.topicPath(topic);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      return await readFile(filePath, "utf-8");
    } catch (error: unknown) {
      throw new MemoryError("Failed to load topic memory", {
        topic,
        filePath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save content to a topic memory file.
   * Creates the file if it does not exist.
   * Writes atomically (write-to-temp + rename).
   */
  async saveTopicMemory(topic: string, content: string): Promise<void> {
    const parsedTopic = topicNameSchema.safeParse(topic);
    if (!parsedTopic.success) {
      throw new MemoryError("Invalid topic name", {
        topic,
        issues: parsedTopic.error.issues.map((i) => i.message),
      });
    }

    const parsedContent = memoryContentSchema.safeParse(content);
    if (!parsedContent.success) {
      throw new MemoryError("Invalid memory content", {
        topic,
        issues: parsedContent.error.issues.map((i) => i.message),
      });
    }

    const dir = this.getMemoryDir();
    const filePath = this.topicPath(topic);

    await ensureDir(dir);
    await atomicWrite(filePath, content);
  }

  // -----------------------------------------------------------------------
  // Listing & directory helpers
  // -----------------------------------------------------------------------

  /**
   * List available topic names (derived from .md files in the memory directory,
   * excluding MEMORY.md itself).
   * Returns an empty array if the memory directory does not exist.
   */
  async listTopics(): Promise<readonly string[]> {
    const dir = this.getMemoryDir();

    if (!existsSync(dir)) {
      return [];
    }

    try {
      const entries = await readdir(dir);
      return entries
        .filter((entry) => entry.endsWith(".md") && entry !== MAIN_MEMORY_FILE)
        .map((entry) => entry.slice(0, -3)) // strip .md
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Get the absolute path to the memory directory for this project.
   * Path: ~/.dbcode/projects/{projectHash}/memory/
   */
  getMemoryDir(): string {
    return joinPath(PROJECTS_BASE_DIR, this.projectHash, "memory");
  }

  /**
   * Delete a specific topic memory file.
   * No-op if the file does not exist.
   */
  async deleteTopic(topic: string): Promise<void> {
    const parsed = topicNameSchema.safeParse(topic);
    if (!parsed.success) {
      throw new MemoryError("Invalid topic name", {
        topic,
        issues: parsed.error.issues.map((i) => i.message),
      });
    }

    const filePath = this.topicPath(topic);

    if (!existsSync(filePath)) {
      return;
    }

    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(filePath);
    } catch (error: unknown) {
      throw new MemoryError("Failed to delete topic memory", {
        topic,
        filePath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear all memory for this project — removes MEMORY.md and all topic files.
   */
  async clearAll(): Promise<void> {
    const dir = this.getMemoryDir();

    if (!existsSync(dir)) {
      return;
    }

    try {
      await rm(dir, { recursive: true, force: true });
    } catch (error: unknown) {
      throw new MemoryError("Failed to clear memory directory", {
        dir,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Full path to the main MEMORY.md */
  private mainMemoryPath(): string {
    return joinPath(this.getMemoryDir(), MAIN_MEMORY_FILE);
  }

  /** Full path to a topic file */
  private topicPath(topic: string): string {
    const safe = normalizeTopicFileName(topic);
    return joinPath(this.getMemoryDir(), safe);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic project hash from an absolute path.
 * Uses SHA-256, returning the first 12 hex characters.
 */
export function computeProjectHash(absolutePath: string): string {
  const hash = createHash("sha256").update(absolutePath).digest("hex");
  return hash.slice(0, 12);
}

/**
 * Normalise a human-readable topic name into a safe .md filename.
 *
 * - Lowercases the input
 * - Replaces non-alphanumeric characters (except hyphens and underscores) with hyphens
 * - Collapses consecutive hyphens
 * - Trims leading/trailing hyphens
 * - Appends `.md`
 */
export function normalizeTopicFileName(topic: string): string {
  const base = topic.endsWith(".md") ? topic.slice(0, -3) : topic;
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe || "untitled"}.md`;
}

// ---------------------------------------------------------------------------
// Internal I/O utilities
// ---------------------------------------------------------------------------

/** Ensure a directory (and its parents) exist */
async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Write a file atomically using the write-to-temp + rename pattern.
 * `rename()` is atomic on the same filesystem on both macOS and Linux/Windows.
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;

  try {
    await ensureDir(dir);
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath);
  } catch (error: unknown) {
    // Best-effort cleanup of the temp file
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new MemoryError("Failed to write memory file atomically", {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
