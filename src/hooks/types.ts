import { type ExtractedToolCall, type ToolResult } from "../tools/types.js";

/**
 * All hook event names (17 events).
 * Hooks execute handlers matched to these events at specific lifecycle points.
 */
export type HookEvent =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PermissionRequest"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "SubagentStart"
  | "SubagentStop"
  | "Stop"
  | "TeammateIdle"
  | "TaskCompleted"
  | "ConfigChange"
  | "PreCompact"
  | "InstructionsLoaded"
  | "WorktreeCreate"
  | "WorktreeRemove";

/** All valid hook event names as an array for validation */
export const HOOK_EVENTS: readonly HookEvent[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "TeammateIdle",
  "TaskCompleted",
  "ConfigChange",
  "PreCompact",
  "InstructionsLoaded",
  "WorktreeCreate",
  "WorktreeRemove",
] as const;

/** Handler type discriminator */
export type HookHandlerType = "command" | "http" | "prompt" | "agent";

/** Base handler interface — all handlers share these fields */
interface BaseHookHandler {
  readonly type: HookHandlerType;
  /** Timeout in milliseconds (default: 30000) */
  readonly timeoutMs?: number;
  /** If true, hook failure blocks the operation (default: false) */
  readonly blocking?: boolean;
}

/** Shell command handler — executes a shell command */
export interface CommandHookHandler extends BaseHookHandler {
  readonly type: "command";
  /** Shell command to execute. Supports variable interpolation (e.g., $FILE_PATH) */
  readonly command: string;
}

/** HTTP handler — sends POST request to a URL */
export interface HttpHookHandler extends BaseHookHandler {
  readonly type: "http";
  /** URL to POST the event payload to */
  readonly url: string;
  /** Additional HTTP headers */
  readonly headers?: Readonly<Record<string, string>>;
}

/** Prompt handler — single-turn LLM evaluation for semantic validation */
export interface PromptHookHandler extends BaseHookHandler {
  readonly type: "prompt";
  /** Prompt template (supports variable interpolation) */
  readonly prompt: string;
  /** Model to use for evaluation (defaults to current model) */
  readonly model?: string;
}

/** Agent handler — spawns a subagent with tool access for AI-based validation */
export interface AgentHookHandler extends BaseHookHandler {
  readonly type: "agent";
  /** Prompt for the subagent */
  readonly prompt: string;
  /** Tools the subagent is allowed to use */
  readonly allowedTools?: readonly string[];
  /** Model to use (defaults to current model) */
  readonly model?: string;
}

/** Union of all hook handler types */
export type HookHandler =
  | CommandHookHandler
  | HttpHookHandler
  | PromptHookHandler
  | AgentHookHandler;

/** A hook rule: matcher pattern + list of handlers */
export interface HookRule {
  /** Glob pattern to match tool names or event-specific criteria (e.g., "file_edit|file_write") */
  readonly matcher?: string;
  /** Handlers to execute when this rule matches */
  readonly hooks: readonly HookHandler[];
}

/** Hook configuration — maps event names to rules */
export type HookConfig = Partial<Record<HookEvent, readonly HookRule[]>>;

/** Event payload passed to hook handlers */
export interface HookEventPayload {
  /** The event that triggered this hook */
  readonly event: HookEvent;
  /** Session ID */
  readonly sessionId?: string;
  /** Working directory */
  readonly workingDirectory?: string;
  /** Tool call info (for tool-related events) */
  readonly toolCall?: ExtractedToolCall;
  /** Tool result (for PostToolUse/PostToolUseFailure) */
  readonly toolResult?: ToolResult;
  /** Affected file path (for file-related operations) */
  readonly filePath?: string;
  /** Additional event-specific data */
  readonly data?: Readonly<Record<string, unknown>>;
}

/** Result from executing a hook handler */
export interface HookHandlerResult {
  /** Exit code: 0 = pass, 2 = block, other = error */
  readonly exitCode: number;
  /** stdout output (may be injected into context) */
  readonly stdout: string;
  /** stderr output */
  readonly stderr: string;
  /** Whether this hook blocks the operation */
  readonly blocked: boolean;
  /** Handler type that produced this result */
  readonly handlerType: HookHandlerType;
}

/** Aggregate result from running all hooks for an event */
export interface HookRunResult {
  /** Whether any hook blocked the operation */
  readonly blocked: boolean;
  /** Block reason (from first blocking hook's stdout) */
  readonly blockReason?: string;
  /** All individual handler results */
  readonly results: readonly HookHandlerResult[];
  /** Combined stdout from all hooks (for context injection) */
  readonly contextOutput: string;
}
