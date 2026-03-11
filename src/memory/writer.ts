import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { BaseError } from "../utils/error.js";
import { getMemoryDir, getMemoryFilePath, getTopicFilePath } from "./paths.js";
import { normalizeTopicFileName } from "./loader.js";
import type { MemoryEntry } from "./types.js";

/** Memory write error */
export class MemoryWriteError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MEMORY_WRITE_ERROR", context);
  }
}

/** Default maximum lines for MEMORY.md before overflow triggers */
const DEFAULT_MAX_MEMORY_LINES = 200;

/**
 * Append a memory entry to MEMORY.md.
 * If the entry's content already exists (deduplication), it is skipped.
 * If MEMORY.md exceeds maxLines, overflow content is moved to topic files.
 */
export async function appendMemory(
  projectRoot: string,
  entry: MemoryEntry,
  maxLines: number = DEFAULT_MAX_MEMORY_LINES,
): Promise<{ readonly written: boolean; readonly overflowed: boolean }> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  // Ensure the memory directory exists
  await ensureDir(memoryDir);

  // Read existing content
  const existingContent = await readFileSafe(memoryFilePath);

  // Deduplication: check if the content already exists
  if (isDuplicate(existingContent, entry.content)) {
    return { written: false, overflowed: false };
  }

  // Build the new entry block
  const entryBlock = formatEntryBlock(entry);

  // Append the new entry to the appropriate topic section
  const updatedContent = appendToSection(existingContent, entry.topic, entryBlock);

  // Check if we need to truncate and overflow
  const lines = updatedContent.split("\n");
  let overflowed = false;

  if (lines.length > maxLines) {
    // Move overflow sections to topic files
    await handleOverflow(projectRoot, updatedContent, maxLines);
    overflowed = true;
  } else {
    // Write atomically
    await atomicWrite(memoryFilePath, updatedContent);
  }

  return { written: true, overflowed };
}

/**
 * Save the full content of MEMORY.md (overwrite).
 * Used for bulk updates or clearing.
 */
export async function saveMemory(projectRoot: string, content: string): Promise<void> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  await ensureDir(memoryDir);
  await atomicWrite(memoryFilePath, content);
}

/**
 * Write content to a topic file.
 */
export async function writeTopicFile(
  projectRoot: string,
  topic: string,
  content: string,
): Promise<string> {
  const memoryDir = getMemoryDir(projectRoot);
  const topicFileName = normalizeTopicFileName(topic);
  const topicFilePath = getTopicFilePath(projectRoot, topicFileName);

  await ensureDir(memoryDir);
  await atomicWrite(topicFilePath, content);

  return topicFileName;
}

/**
 * Clear all memory for a project (MEMORY.md and all topic files).
 */
export async function clearMemory(projectRoot: string): Promise<void> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  if (!existsSync(memoryDir)) {
    return;
  }

  // Clear MEMORY.md by writing empty content
  if (existsSync(memoryFilePath)) {
    await atomicWrite(memoryFilePath, "");
  }

  // Remove topic files
  const { readdir, unlink } = await import("node:fs/promises");
  try {
    const entries = await readdir(memoryDir);
    const topicFiles = entries.filter((e) => e.endsWith(".md") && e !== "MEMORY.md");
    await Promise.all(topicFiles.map((f) => unlink(`${memoryDir}/${f}`).catch(() => undefined)));
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Check if content is a duplicate of existing memory.
 * Uses normalized line-by-line comparison.
 */
function isDuplicate(existingContent: string, newContent: string): boolean {
  if (!existingContent.trim()) return false;

  const normalizedNew = newContent.trim().toLowerCase();
  if (!normalizedNew) return false;

  // Check if the exact content already exists anywhere in memory
  const normalizedExisting = existingContent.toLowerCase();
  return normalizedExisting.includes(normalizedNew);
}

/**
 * Format a memory entry as a markdown block.
 */
function formatEntryBlock(entry: MemoryEntry): string {
  return `- ${entry.content.trim()}`;
}

/**
 * Append content to the appropriate topic section in MEMORY.md.
 * Creates the section if it doesn't exist.
 */
function appendToSection(existingContent: string, topic: string, entryBlock: string): string {
  const sectionHeader = `## ${capitalize(topic)}`;

  if (!existingContent.trim()) {
    // New file: create with header
    return `# Project Memory\n\n${sectionHeader}\n\n${entryBlock}\n`;
  }

  // Check if section exists
  const sectionRegex = new RegExp(`^## ${escapeRegex(capitalize(topic))}$`, "m");
  if (sectionRegex.test(existingContent)) {
    // Find the section and append to it (before the next section or end of file)
    const lines = existingContent.split("\n");
    const result: string[] = [];
    let inTargetSection = false;
    let appended = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === sectionHeader) {
        inTargetSection = true;
        result.push(line);
        continue;
      }

      // If we hit another section header while in our target section, append before it
      if (inTargetSection && line.startsWith("## ") && !appended) {
        result.push(entryBlock);
        result.push("");
        appended = true;
        inTargetSection = false;
      }

      result.push(line);
    }

    // If we reached the end while still in the target section
    if (!appended) {
      // Ensure there's a blank line before the entry if the last line isn't blank
      const lastLine = result[result.length - 1];
      if (lastLine !== undefined && lastLine.trim() !== "") {
        result.push(entryBlock);
      } else {
        result.push(entryBlock);
      }
    }

    return result.join("\n");
  }

  // Section doesn't exist: append new section at end
  const trimmed = existingContent.trimEnd();
  return `${trimmed}\n\n${sectionHeader}\n\n${entryBlock}\n`;
}

/**
 * Handle overflow when MEMORY.md exceeds maxLines.
 * Moves older sections to topic files, keeping a link in MEMORY.md.
 */
async function handleOverflow(
  projectRoot: string,
  content: string,
  maxLines: number,
): Promise<void> {
  const memoryFilePath = getMemoryFilePath(projectRoot);
  const lines = content.split("\n");

  // Parse sections from content
  const sections = parseSections(content);

  if (sections.length <= 1) {
    // Only one section (or none) — just truncate
    const truncated = lines.slice(0, maxLines).join("\n") + "\n";
    await atomicWrite(memoryFilePath, truncated);
    return;
  }

  // Move older sections (all except the last 2) to topic files
  const keepCount = Math.min(2, sections.length);
  const overflowSections = sections.slice(0, sections.length - keepCount);
  const keepSections = sections.slice(sections.length - keepCount);

  // Write overflow to topic files
  const topicLinks: string[] = [];
  for (const section of overflowSections) {
    const topicFileName = await writeTopicFile(projectRoot, section.name, section.content);
    topicLinks.push(`- [${section.name}](./${topicFileName})`);
  }

  // Rebuild MEMORY.md with links to overflow and kept sections
  const parts: string[] = ["# Project Memory\n"];

  if (topicLinks.length > 0) {
    parts.push("## Archived Topics\n");
    parts.push(topicLinks.join("\n"));
    parts.push("");
  }

  for (const section of keepSections) {
    parts.push(section.content);
  }

  const newContent = parts.join("\n").trimEnd() + "\n";
  await atomicWrite(memoryFilePath, newContent);
}

/** Parse MEMORY.md into named sections */
function parseSections(
  content: string,
): readonly { readonly name: string; readonly content: string }[] {
  const lines = content.split("\n");
  const sections: { readonly name: string; readonly content: string }[] = [];
  let currentName = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = /^## (.+)$/.exec(line);
    if (match) {
      if (currentName) {
        sections.push({ name: currentName, content: currentLines.join("\n").trimEnd() });
      }
      currentName = match[1];
      currentLines = [line];
    } else if (currentName) {
      currentLines.push(line);
    }
  }

  if (currentName) {
    sections.push({ name: currentName, content: currentLines.join("\n").trimEnd() });
  }

  return sections;
}

/** Capitalize the first letter of a string */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Escape special regex characters */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Read a file safely, returning empty string if not found */
async function readFileSafe(filePath: string): Promise<string> {
  if (!existsSync(filePath)) return "";
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

/** Ensure a directory exists */
async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Write a file atomically using rename.
 * Writes to a temporary file first, then renames to the target path.
 * This prevents partial writes on crash.
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath);
  } catch (error: unknown) {
    // Clean up temp file on failure
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup error
    }
    throw new MemoryWriteError("Failed to write memory file atomically", {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
