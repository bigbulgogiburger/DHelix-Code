import { homedir } from "node:os";
import { join } from "node:path";

/** Application version — synced with package.json */
export const VERSION = "0.1.0";

/** Application name */
export const APP_NAME = "dbcode";

/** Default configuration directory */
export const CONFIG_DIR = join(homedir(), `.${APP_NAME}`);

/** Default project configuration file name */
export const PROJECT_CONFIG_FILE = `${APP_NAME.toUpperCase()}.md`;

/** Project configuration directory name (e.g., ".dbcode") */
export const PROJECT_CONFIG_DIR = `.${APP_NAME}`;

/**
 * Get ordered DBCODE.md lookup paths for a given directory.
 * Primary: project root (convention), Fallback: .dbcode/ directory.
 * All code should use this to resolve DBCODE.md consistently.
 */
export function getProjectConfigPaths(cwd: string): readonly string[] {
  return [
    join(cwd, PROJECT_CONFIG_FILE), // DBCODE.md (project root — primary)
    join(cwd, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE), // .dbcode/DBCODE.md (fallback)
  ];
}

/** Default session storage directory */
export const SESSIONS_DIR = join(CONFIG_DIR, "sessions");

/** Default log file path */
export const LOG_FILE = join(CONFIG_DIR, "debug.log");

/** Input history file path */
export const INPUT_HISTORY_FILE = join(CONFIG_DIR, "input-history.json");

/** Maximum number of input history entries to persist */
export const INPUT_HISTORY_MAX = 500;

/** Agent loop limits */
export const AGENT_LOOP = {
  /** Maximum iterations before force-stop */
  maxIterations: 50,
  /** Context window usage threshold for auto-compaction (Layer 2) */
  compactionThreshold: 0.835,
  /** Reserve ratio for LLM response tokens */
  responseReserveRatio: 0.2,
} as const;

/** Tool execution timeouts (ms) */
export const TOOL_TIMEOUTS = {
  bash: 120_000,
  fileOps: 30_000,
  default: 30_000,
} as const;

/**
 * Resolve default model from environment.
 * Priority: DBCODE_MODEL > OPENAI_MODEL > built-in fallback.
 * This is the single source of truth — no other file should hardcode a model name.
 */
export const DEFAULT_MODEL =
  process.env.DBCODE_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

/** Token counter defaults */
export const TOKEN_DEFAULTS = {
  /** Default model for token counting */
  defaultModel: DEFAULT_MODEL,
  /** Maximum context window size (tokens) */
  maxContextWindow: 1_000_000,
} as const;

/** LLM defaults */
export const LLM_DEFAULTS = {
  /** Default API base URL (OpenAI-compatible) */
  baseUrl: process.env.DBCODE_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  /** Default model name — resolved from env */
  model: DEFAULT_MODEL,
  /** Default temperature */
  temperature: 0.0,
  /** Default max tokens for response */
  maxTokens: 32768,
} as const;

/** Auto-Memory — directory and file naming */
export const MEMORY_DIR = "memory" as const;
export const MEMORY_MAIN_FILE = "MEMORY.md" as const;

/** Auto-Memory — limits */
export const MEMORY_MAX_MAIN_LINES = 200;
export const MEMORY_MAX_TOPIC_LINES = 500;
export const MEMORY_MAX_ENTRIES_PER_SESSION = 20;
export const MEMORY_MIN_CONFIDENCE = 0.7;

/** Get the project-level memory directory (.dbcode/memory/) */
export function getProjectMemoryDir(projectDir: string): string {
  return join(projectDir, PROJECT_CONFIG_DIR, MEMORY_DIR);
}

/** Get the global user memory directory (~/.dbcode/memory/) */
export function getGlobalMemoryDir(): string {
  return join(CONFIG_DIR, MEMORY_DIR);
}
