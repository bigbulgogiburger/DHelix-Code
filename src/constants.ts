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

/** Default session storage directory */
export const SESSIONS_DIR = join(CONFIG_DIR, "sessions");

/** Default log file path */
export const LOG_FILE = join(CONFIG_DIR, "debug.log");

/** Agent loop limits */
export const AGENT_LOOP = {
  /** Maximum iterations before force-stop */
  maxIterations: 50,
  /** Context window usage threshold for auto-compaction */
  compactionThreshold: 0.95,
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
  maxContextWindow: 128_000,
} as const;

/** LLM defaults */
export const LLM_DEFAULTS = {
  /** Default API base URL (OpenAI-compatible) */
  baseUrl: "http://localhost:11434/v1",
  /** Default model name */
  model: "llama3.1",
  /** Default temperature */
  temperature: 0.0,
  /** Default max tokens for response */
  maxTokens: 4096,
} as const;
