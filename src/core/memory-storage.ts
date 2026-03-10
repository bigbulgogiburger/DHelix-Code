import { readdir, readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { joinPath, normalizePath } from "../utils/path.js";
import { APP_NAME } from "../constants.js";
import { BaseError } from "../utils/error.js";

/**
 * Configuration for memory file storage locations and limits.
 */
export interface MemoryConfig {
  readonly projectDir: string;
  readonly globalDir: string;
  readonly maxMainLines: number;
  readonly maxTopicLines: number;
}

/**
 * Metadata about a single memory file on disk.
 */
export interface MemoryFileInfo {
  readonly name: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly modifiedAt: Date;
  readonly lineCount: number;
}

/** Error for memory storage operations */
export class MemoryStorageError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MEMORY_STORAGE_ERROR", context);
  }
}

/** Project memory directory relative to project root */
const PROJECT_MEMORY_DIR = `.${APP_NAME}/memory`;

/** Main memory filename */
const MAIN_MEMORY_FILE = "MEMORY.md";

/**
 * Get the default memory paths for a project directory.
 * Project memory lives under `{projectDir}/.dbcode/memory/`.
 * Global memory lives under `~/.dbcode/memory/`.
 */
export function getMemoryPaths(projectDir: string): MemoryConfig {
  return {
    projectDir: normalizePath(projectDir),
    globalDir: joinPath(homedir(), `.${APP_NAME}`, "memory"),
    maxMainLines: 200,
    maxTopicLines: 500,
  };
}

/**
 * Read the main MEMORY.md file, returning at most `maxMainLines` lines.
 * Returns an empty string if the file does not exist.
 */
export async function readMainMemory(config: MemoryConfig): Promise<string> {
  const filePath = joinPath(config.projectDir, PROJECT_MEMORY_DIR, MAIN_MEMORY_FILE);
  const content = await readFileSafe(filePath);
  if (!content) {
    return "";
  }
  return truncateLines(content, config.maxMainLines);
}

/**
 * Read a topic memory file (e.g., "debugging", "patterns").
 * Returns null if the file does not exist.
 */
export async function readTopicMemory(config: MemoryConfig, topic: string): Promise<string | null> {
  const fileName = ensureMarkdownExtension(topic);
  const filePath = joinPath(config.projectDir, PROJECT_MEMORY_DIR, fileName);
  const content = await readFileSafe(filePath);
  if (content === null) {
    return null;
  }
  return truncateLines(content, config.maxTopicLines);
}

/**
 * Read the global MEMORY.md file (cross-project patterns).
 * Returns an empty string if the file does not exist.
 */
export async function readGlobalMemory(config: MemoryConfig): Promise<string> {
  const filePath = joinPath(config.globalDir, MAIN_MEMORY_FILE);
  const content = await readFileSafe(filePath);
  if (!content) {
    return "";
  }
  return truncateLines(content, config.maxMainLines);
}

/**
 * Write content to the main MEMORY.md file.
 * Creates the memory directory if it does not exist.
 */
export async function writeMainMemory(config: MemoryConfig, content: string): Promise<void> {
  const dir = joinPath(config.projectDir, PROJECT_MEMORY_DIR);
  await ensureDirectory(dir);
  const filePath = joinPath(dir, MAIN_MEMORY_FILE);
  await writeFileSafe(filePath, content);
}

/**
 * Write content to a topic memory file.
 * Creates the memory directory if it does not exist.
 */
export async function writeTopicMemory(
  config: MemoryConfig,
  topic: string,
  content: string,
): Promise<void> {
  const fileName = ensureMarkdownExtension(topic);
  const dir = joinPath(config.projectDir, PROJECT_MEMORY_DIR);
  await ensureDirectory(dir);
  const filePath = joinPath(dir, fileName);
  await writeFileSafe(filePath, content);
}

/**
 * Write content to the global MEMORY.md file.
 * Creates the global memory directory if it does not exist.
 */
export async function writeGlobalMemory(config: MemoryConfig, content: string): Promise<void> {
  await ensureDirectory(config.globalDir);
  const filePath = joinPath(config.globalDir, MAIN_MEMORY_FILE);
  await writeFileSafe(filePath, content);
}

/**
 * List all memory files in the project memory directory.
 * Returns an empty array if the directory does not exist.
 */
export async function listMemoryFiles(config: MemoryConfig): Promise<readonly MemoryFileInfo[]> {
  const dir = joinPath(config.projectDir, PROJECT_MEMORY_DIR);
  try {
    const entries = await readdir(dir);
    const mdFiles = entries.filter((entry) => entry.endsWith(".md"));

    const fileInfos = await Promise.all(
      mdFiles.map(async (name) => {
        const filePath = joinPath(dir, name);
        return buildFileInfo(name, filePath);
      }),
    );

    return fileInfos
      .filter((info): info is MemoryFileInfo => info !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return [];
    }
    throw new MemoryStorageError("Failed to list memory files", {
      dir,
      cause: String(error),
    });
  }
}

/**
 * Delete a memory file by filename.
 * Throws MemoryStorageError if the file does not exist.
 */
export async function deleteMemoryFile(config: MemoryConfig, filename: string): Promise<void> {
  const fileName = ensureMarkdownExtension(filename);
  const filePath = joinPath(config.projectDir, PROJECT_MEMORY_DIR, fileName);
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      throw new MemoryStorageError(`Memory file not found: ${fileName}`, {
        filePath,
      });
    }
    throw new MemoryStorageError(`Failed to delete memory file: ${fileName}`, {
      filePath,
      cause: String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read a file safely, returning null if it does not exist. */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return null;
    }
    throw new MemoryStorageError(`Failed to read memory file: ${filePath}`, {
      filePath,
      cause: String(error),
    });
  }
}

/** Write a file safely, overwriting existing content. */
async function writeFileSafe(filePath: string, content: string): Promise<void> {
  try {
    await writeFile(filePath, content, "utf-8");
  } catch (error: unknown) {
    throw new MemoryStorageError(`Failed to write memory file: ${filePath}`, {
      filePath,
      cause: String(error),
    });
  }
}

/** Ensure a directory exists, creating it recursively if needed. */
async function ensureDirectory(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error: unknown) {
    throw new MemoryStorageError(`Failed to create memory directory: ${dir}`, {
      dir,
      cause: String(error),
    });
  }
}

/** Build a MemoryFileInfo from a file path, or return null on error. */
async function buildFileInfo(name: string, filePath: string): Promise<MemoryFileInfo | null> {
  try {
    const [fileStat, content] = await Promise.all([stat(filePath), readFile(filePath, "utf-8")]);
    const lineCount = content.split("\n").length;

    return {
      name,
      path: normalizePath(filePath),
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime,
      lineCount,
    };
  } catch {
    return null;
  }
}

/** Truncate content to a maximum number of lines. */
function truncateLines(content: string, maxLines: number): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) {
    return content;
  }
  return lines.slice(0, maxLines).join("\n");
}

/** Ensure a filename has a .md extension. */
function ensureMarkdownExtension(name: string): string {
  return name.endsWith(".md") ? name : `${name}.md`;
}

/** Type guard for ENOENT (file not found) errors. */
function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}
