import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { BaseError } from "../utils/error.js";
import { getMemoryDir, getMemoryFilePath } from "./paths.js";
import type { MemoryLoadResult } from "./types.js";

/** Memory loading error */
export class MemoryLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MEMORY_LOAD_ERROR", context);
  }
}

/** Default maximum lines to load from MEMORY.md */
const DEFAULT_MAX_LOAD_LINES = 200;

/**
 * Load project memory from MEMORY.md.
 * Returns the first `maxLines` lines of content.
 * Gracefully returns empty result if the memory directory or file doesn't exist.
 */
export async function loadProjectMemory(
  projectRoot: string,
  maxLines: number = DEFAULT_MAX_LOAD_LINES,
): Promise<MemoryLoadResult> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  if (!existsSync(memoryDir) || !existsSync(memoryFilePath)) {
    return {
      content: "",
      memoryFilePath,
      exists: false,
      topicFiles: [],
    };
  }

  try {
    const rawContent = await readFile(memoryFilePath, "utf-8");
    const lines = rawContent.split("\n");
    const truncatedContent = lines.slice(0, maxLines).join("\n").trimEnd();
    const topicFiles = await listTopicFiles(projectRoot);

    return {
      content: truncatedContent,
      memoryFilePath,
      exists: true,
      topicFiles,
    };
  } catch (error: unknown) {
    throw new MemoryLoadError("Failed to load project memory", {
      projectRoot,
      memoryFilePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Load a specific topic memory file.
 * Returns the full content of the topic file.
 * Returns null if the topic file doesn't exist.
 */
export async function loadTopicMemory(projectRoot: string, topic: string): Promise<string | null> {
  const memoryDir = getMemoryDir(projectRoot);
  const topicFileName = normalizeTopicFileName(topic);
  const topicFilePath = `${memoryDir}/${topicFileName}`;

  if (!existsSync(topicFilePath)) {
    return null;
  }

  try {
    return await readFile(topicFilePath, "utf-8");
  } catch (error: unknown) {
    throw new MemoryLoadError("Failed to load topic memory", {
      projectRoot,
      topic,
      topicFilePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * List all topic files in the memory directory.
 * Returns filenames (without path) of .md files that are not MEMORY.md.
 */
export async function listTopicFiles(projectRoot: string): Promise<readonly string[]> {
  const memoryDir = getMemoryDir(projectRoot);

  if (!existsSync(memoryDir)) {
    return [];
  }

  try {
    const entries = await readdir(memoryDir);
    return entries.filter((e) => e.endsWith(".md") && e !== "MEMORY.md").sort();
  } catch {
    return [];
  }
}

/**
 * Normalize a topic name to a valid filename.
 * Ensures .md extension and safe characters.
 */
function normalizeTopicFileName(topic: string): string {
  const base = topic.endsWith(".md") ? topic.slice(0, -3) : topic;
  // Replace unsafe characters with hyphens, collapse multiples, trim edges
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe || "untitled"}.md`;
}

export { normalizeTopicFileName };
