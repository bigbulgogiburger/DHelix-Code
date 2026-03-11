import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { getLogger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentMemoryScope = "user" | "project" | "local";

/** Maximum lines to read from MEMORY.md */
const MEMORY_MAX_LINES = 200;

/** File tools required for agents to manage their own memory */
const REQUIRED_TOOLS = ["file_read", "file_write", "file_edit"] as const;

// ---------------------------------------------------------------------------
// AgentMemoryManager
// ---------------------------------------------------------------------------

/**
 * Manages persistent memory for a specific agent type.
 *
 * Each agent gets its own memory directory (scoped by user, project, or local)
 * containing a MEMORY.md file and optional topic-specific files. The memory
 * prompt section is injected into the agent's system prompt so it can build
 * on previous experience across sessions.
 */
export class AgentMemoryManager {
  private readonly agentName: string;
  private readonly scope: AgentMemoryScope;
  private readonly workingDirectory: string;

  constructor(agentName: string, scope: AgentMemoryScope, workingDirectory?: string) {
    this.agentName = agentName;
    this.scope = scope;
    this.workingDirectory = workingDirectory ?? process.cwd();
  }

  /**
   * Get the memory directory path based on scope.
   *
   * - user:    ~/.dbcode/agent-memory/{agent-name}/
   * - project: .dbcode/agent-memory/{agent-name}/  (relative to workingDirectory)
   * - local:   .dbcode/agent-memory-local/{agent-name}/  (relative to workingDirectory)
   */
  getMemoryDir(): string {
    switch (this.scope) {
      case "user":
        return join(homedir(), ".dbcode", "agent-memory", this.agentName);
      case "project":
        return join(this.workingDirectory, ".dbcode", "agent-memory", this.agentName);
      case "local":
        return join(this.workingDirectory, ".dbcode", "agent-memory-local", this.agentName);
    }
  }

  /** Ensure the memory directory exists. */
  async initialize(): Promise<void> {
    const dir = this.getMemoryDir();
    try {
      await mkdir(dir, { recursive: true });
    } catch (error: unknown) {
      const logger = getLogger();
      logger.warn({ error: String(error), dir }, "Failed to create agent memory directory");
    }
  }

  /**
   * Read MEMORY.md content (first 200 lines).
   * Returns empty string if the file does not exist.
   */
  async readMemory(): Promise<string> {
    const memoryPath = join(this.getMemoryDir(), "MEMORY.md");
    try {
      const content = await readFile(memoryPath, "utf-8");
      const lines = content.split("\n");
      if (lines.length > MEMORY_MAX_LINES) {
        return lines.slice(0, MEMORY_MAX_LINES).join("\n");
      }
      return content;
    } catch {
      // File does not exist or is unreadable — not an error
      return "";
    }
  }

  /** Write content to MEMORY.md. Creates the file if it does not exist. */
  async writeMemory(content: string): Promise<void> {
    const dir = this.getMemoryDir();
    await mkdir(dir, { recursive: true });
    const memoryPath = join(dir, "MEMORY.md");
    await writeFile(memoryPath, content, "utf-8");
  }

  /**
   * Build a system prompt section containing the agent's memory context.
   * Designed to be appended to the subagent system prompt.
   */
  async getMemoryPromptSection(): Promise<string> {
    const dir = this.getMemoryDir();
    const content = await this.readMemory();

    const memoryContent = content
      ? content
      : "No memory file yet. Create one to start building knowledge.";

    return [
      "# Agent Memory",
      "",
      `You have a persistent agent memory directory at \`${dir}\`. Its contents persist across conversations.`,
      "",
      "## How to use your memory:",
      "- Consult MEMORY.md before starting work for accumulated knowledge",
      "- Update MEMORY.md as you discover patterns and insights",
      "- Create topic-specific files for detailed notes",
      "- Keep MEMORY.md concise (under 200 lines)",
      "",
      "## Current MEMORY.md:",
      memoryContent,
    ].join("\n");
  }

  /** Get the list of tool names required for memory operations. */
  static getRequiredTools(): readonly string[] {
    return REQUIRED_TOOLS;
  }
}
