import { loadProjectMemory, loadTopicMemory, listTopicFiles } from "./loader.js";
import { appendMemory, saveMemory, writeTopicFile, clearMemory } from "./writer.js";
import { getMemoryDir, getMemoryFilePath, computeProjectHash } from "./paths.js";
import type { MemoryConfig, MemoryEntry, MemoryLoadResult } from "./types.js";
import { CONFIG_DIR } from "../constants.js";
import { joinPath } from "../utils/path.js";

/** Default memory configuration */
const DEFAULT_CONFIG: MemoryConfig = {
  maxLoadLines: 200,
  maxMemoryLines: 200,
  projectsBaseDir: joinPath(CONFIG_DIR, "projects"),
};

/**
 * MemoryManager — orchestrates loading, saving, and querying project memory.
 *
 * Memory is stored at: ~/.dbcode/projects/{projectHash}/memory/MEMORY.md
 * where projectHash = SHA-256(absoluteProjectRoot).slice(0, 16)
 */
export class MemoryManager {
  readonly config: MemoryConfig;
  private readonly projectRoot: string;

  constructor(projectRoot: string, config?: Partial<MemoryConfig>) {
    this.projectRoot = projectRoot;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Load project memory (first maxLoadLines of MEMORY.md).
   * Used at session start to inject into system prompt.
   */
  async loadMemory(): Promise<MemoryLoadResult> {
    return loadProjectMemory(this.projectRoot, this.config.maxLoadLines);
  }

  /**
   * Save full content to MEMORY.md (overwrites existing).
   */
  async saveMemory(content: string): Promise<void> {
    return saveMemory(this.projectRoot, content);
  }

  /**
   * Append a memory entry, with deduplication and auto-overflow.
   */
  async appendMemory(entry: MemoryEntry): Promise<{ readonly written: boolean; readonly overflowed: boolean }> {
    return appendMemory(this.projectRoot, entry, this.config.maxMemoryLines);
  }

  /**
   * Get available topic files.
   */
  async getTopicFiles(): Promise<readonly string[]> {
    return listTopicFiles(this.projectRoot);
  }

  /**
   * Read a specific topic file.
   * Returns null if the topic file doesn't exist.
   */
  async readTopicFile(topic: string): Promise<string | null> {
    return loadTopicMemory(this.projectRoot, topic);
  }

  /**
   * Write content to a topic file.
   * Returns the normalized filename.
   */
  async writeTopicFile(topic: string, content: string): Promise<string> {
    return writeTopicFile(this.projectRoot, topic, content);
  }

  /**
   * Clear all memory for this project.
   */
  async clearMemory(): Promise<void> {
    return clearMemory(this.projectRoot);
  }

  /**
   * Get the project hash for this project root.
   */
  getProjectHash(): string {
    return computeProjectHash(this.projectRoot);
  }

  /**
   * Get the memory directory path for this project.
   */
  getMemoryDir(): string {
    return getMemoryDir(this.projectRoot);
  }

  /**
   * Get the MEMORY.md file path for this project.
   */
  getMemoryFilePath(): string {
    return getMemoryFilePath(this.projectRoot);
  }
}
