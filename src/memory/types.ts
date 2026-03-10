import { z } from "zod";

/** Configuration for the auto-memory system */
export interface MemoryConfig {
  /** Maximum number of lines to load from MEMORY.md at session start */
  readonly maxLoadLines: number;
  /** Maximum number of lines before auto-truncation triggers overflow to topic files */
  readonly maxMemoryLines: number;
  /** Base directory for all project memory storage (~/.dbcode/projects/) */
  readonly projectsBaseDir: string;
}

/** A single memory entry to be appended */
export interface MemoryEntry {
  /** Topic/section the entry belongs to (e.g., "debugging", "patterns", "preferences") */
  readonly topic: string;
  /** The content to store (markdown) */
  readonly content: string;
}

/** Result of loading project memory */
export interface MemoryLoadResult {
  /** Content from MEMORY.md (up to maxLoadLines) */
  readonly content: string;
  /** Full path to the MEMORY.md file */
  readonly memoryFilePath: string;
  /** Whether the memory file exists on disk */
  readonly exists: boolean;
  /** Available topic files */
  readonly topicFiles: readonly string[];
}

/** Zod schema for validating memory entry input */
export const memoryEntrySchema = z.object({
  topic: z.string().min(1).max(100),
  content: z.string().min(1),
});
