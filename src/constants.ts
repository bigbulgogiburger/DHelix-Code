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
    join(cwd, PROJECT_CONFIG_FILE),                     // DBCODE.md (project root — primary)
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

/** Token counter defaults */
export const TOKEN_DEFAULTS = {
  /** Default model for token counting */
  defaultModel: "gpt-4",
  /** Maximum context window size (tokens) */
  maxContextWindow: 1_000_000,
} as const;

/** LLM defaults */
export const LLM_DEFAULTS = {
  /** Default API base URL (OpenAI-compatible) */
  baseUrl: "https://api.openai.com/v1",
  /** Default model name */
  model: "gpt-4.1-mini",
  /** Default temperature */
  temperature: 0.0,
  /** Default max tokens for response */
  maxTokens: 32768,
} as const;
