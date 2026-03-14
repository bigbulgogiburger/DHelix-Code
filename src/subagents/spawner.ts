import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { ToolRegistry } from "../tools/registry.js";
import { runAgentLoop, type AgentLoopResult } from "../core/agent-loop.js";
import { buildSystemPrompt, type SessionState } from "../core/system-prompt-builder.js";
import { createEventEmitter, type AppEventEmitter } from "../utils/events.js";
import { BaseError } from "../utils/error.js";
import { type SharedAgentState, createSharedAgentState } from "./shared-state.js";
import {
  type AgentDefinition,
  type AgentModel,
  type AgentPermissionMode,
  type AgentMemoryScope,
} from "./definition-types.js";
import { resolveProvider } from "../llm/model-router.js";

const execFileAsync = promisify(execFile);

/** Directory for persisted agent history files */
const AGENT_HISTORY_DIR = join(homedir(), ".dbcode", "agent-history");

/** Maximum number of agent history files kept on disk */
const MAX_PERSISTED_HISTORIES = 20;

/** Subagent execution error */
export class SubagentError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SUBAGENT_ERROR", context);
  }
}

/** Subagent type — built-in types or custom agent definition names */
export type SubagentType = "explore" | "plan" | "general" | (string & {});

/** Configuration for spawning a subagent */
export interface SubagentConfig {
  /** Type of subagent to spawn */
  readonly type: SubagentType;
  /** The task/prompt for the subagent */
  readonly prompt: string;
  /** LLM provider to use */
  readonly client: LLMProvider;
  /** Model to use */
  readonly model: string;
  /** Tool call strategy */
  readonly strategy: ToolCallStrategy;
  /** Tool registry (may be filtered for the subagent) */
  readonly toolRegistry: ToolRegistry;
  /** Working directory */
  readonly workingDirectory?: string;
  /** Maximum iterations for the subagent loop */
  readonly maxIterations?: number;
  /** Abort signal for cancellation */
  readonly signal?: AbortSignal;
  /** Parent event emitter (for notifications) */
  readonly parentEvents?: AppEventEmitter;
  /** Allowed tool names (if restricted) */
  readonly allowedTools?: readonly string[];
  /** Run subagent in background (non-blocking, emits event on completion) */
  readonly run_in_background?: boolean;
  /** Isolation mode: "worktree" creates a git worktree for the subagent */
  readonly isolation?: "worktree";
  /** Resume from a previous subagent's message history by agent ID */
  readonly resume?: string;
  /** Shared state for inter-agent communication */
  readonly sharedState?: SharedAgentState;
  /** Model override: "sonnet"|"opus"|"haiku"|"inherit" (default: inherit from parent) */
  readonly modelOverride?: AgentModel;
  /** Permission mode for subagent */
  readonly permissionMode?: AgentPermissionMode;
  /** Maximum context tokens (enables auto-compaction in subagent loop) */
  readonly maxContextTokens?: number;
  /** Custom agent definition from .dbcode/agents/*.md */
  readonly agentDefinition?: AgentDefinition;
  /** Tools to disallow (blacklist, removed from available tools) */
  readonly disallowedTools?: readonly string[];
  /** Skill names to preload into subagent context */
  readonly skills?: readonly string[];
  /** Memory scope for persistent learning */
  readonly memory?: AgentMemoryScope;
}

/** Result from a subagent execution */
export interface SubagentResult {
  /** Unique agent ID for this execution */
  readonly agentId: string;
  /** The subagent type */
  readonly type: SubagentType;
  /** Final text response from the subagent */
  readonly response: string;
  /** Number of iterations the subagent ran */
  readonly iterations: number;
  /** Whether the subagent was aborted */
  readonly aborted: boolean;
  /** Full message history (for inspection or resume) */
  readonly messages: readonly ChatMessage[];
  /** Working directory used (may differ if worktree isolation was used) */
  readonly workingDirectory?: string;
  /** Shared state instance used during execution (if any) */
  readonly sharedState?: SharedAgentState;
}

/** In-memory store for completed subagent histories (for resume) */
const agentHistoryStore = new Map<string, readonly ChatMessage[]>();

/**
 * Persist agent history to disk at ~/.dbcode/agent-history/{agentId}.json.
 * Keeps at most MAX_PERSISTED_HISTORIES files; the oldest are removed.
 */
async function persistAgentHistory(
  agentId: string,
  messages: readonly ChatMessage[],
): Promise<void> {
  try {
    await mkdir(AGENT_HISTORY_DIR, { recursive: true });
    const filePath = join(AGENT_HISTORY_DIR, `${agentId}.json`);
    await writeFile(filePath, JSON.stringify(messages), "utf-8");

    // Prune oldest files beyond the limit
    const entries = await readdir(AGENT_HISTORY_DIR);
    const jsonFiles = entries.filter((f) => f.endsWith(".json"));

    if (jsonFiles.length > MAX_PERSISTED_HISTORIES) {
      // Resolve modification times so we can sort oldest-first
      const fileStats = await Promise.all(
        jsonFiles.map(async (name) => {
          const fp = join(AGENT_HISTORY_DIR, name);
          const s = await stat(fp);
          return { name, mtimeMs: s.mtimeMs, path: fp };
        }),
      );
      fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);

      const toRemove = fileStats.slice(0, fileStats.length - MAX_PERSISTED_HISTORIES);
      const { unlink } = await import("node:fs/promises");
      await Promise.all(toRemove.map((f) => unlink(f.path).catch(() => {})));
    }
  } catch {
    // Best-effort persistence — do not fail the agent run
  }
}

/**
 * Load agent history from disk if available.
 * Returns undefined when the file does not exist or cannot be parsed.
 */
async function loadAgentHistoryFromDisk(
  agentId: string,
): Promise<readonly ChatMessage[] | undefined> {
  try {
    const filePath = join(AGENT_HISTORY_DIR, `${agentId}.json`);
    const raw = await readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as ChatMessage[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Store a completed agent's message history (in-memory + disk) */
async function storeAgentHistory(agentId: string, messages: readonly ChatMessage[]): Promise<void> {
  agentHistoryStore.set(agentId, messages);

  // Keep in-memory store bounded
  if (agentHistoryStore.size > 50) {
    const firstKey = agentHistoryStore.keys().next().value;
    if (firstKey !== undefined) {
      agentHistoryStore.delete(firstKey);
    }
  }

  // Persist to disk asynchronously
  await persistAgentHistory(agentId, messages);
}

/**
 * Retrieve a previous agent's message history for resume.
 * Checks in-memory cache first, then falls back to disk.
 */
export async function getAgentHistory(
  agentId: string,
): Promise<readonly ChatMessage[] | undefined> {
  const cached = agentHistoryStore.get(agentId);
  if (cached) {
    return cached;
  }

  // Attempt to load from disk
  const fromDisk = await loadAgentHistoryFromDisk(agentId);
  if (fromDisk) {
    // Re-populate in-memory cache
    agentHistoryStore.set(agentId, fromDisk);
    return fromDisk;
  }

  return undefined;
}

/**
 * Create a filtered tool registry containing only the allowed tools.
 */
function createFilteredRegistry(
  source: ToolRegistry,
  allowedTools: readonly string[],
): ToolRegistry {
  const filtered = new ToolRegistry();
  const allowedSet = new Set(allowedTools);

  for (const tool of source.getAll()) {
    if (allowedSet.has(tool.name)) {
      filtered.register(tool);
    }
  }

  return filtered;
}

/**
 * Map model alias to actual model identifier.
 */
const MODEL_ALIAS_MAP: Readonly<Record<string, string>> = {
  sonnet: "claude-sonnet-4-5-20250514",
  opus: "claude-opus-4-5-20250514",
  haiku: "claude-haiku-4-5-20251001",
};

/**
 * Resolve the model and LLM provider for a subagent based on the override setting.
 * Returns the parent model/client when override is absent or "inherit".
 */
function resolveModelForSubagent(
  parentModel: string,
  parentClient: LLMProvider,
  override?: AgentModel,
): { readonly model: string; readonly client: LLMProvider } {
  if (!override || override === "inherit") {
    return { model: parentModel, client: parentClient };
  }

  const resolvedModel = MODEL_ALIAS_MAP[override] ?? override;
  const resolvedClient = resolveProvider(resolvedModel);
  return { model: resolvedModel, client: resolvedClient };
}

/**
 * Create a filtered tool registry with both allowlist and denylist support.
 * Allowlist is applied first (if provided), then denylist removes from the result.
 */
function createFilteredRegistryWithBlacklist(
  source: ToolRegistry,
  allowedTools?: readonly string[],
  disallowedTools?: readonly string[],
): ToolRegistry {
  const afterAllow = allowedTools ? createFilteredRegistry(source, allowedTools) : source;

  if (!disallowedTools || disallowedTools.length === 0) {
    return afterAllow;
  }

  const denySet = new Set(disallowedTools);
  const result = new ToolRegistry();
  for (const tool of afterAllow.getAll()) {
    if (!denySet.has(tool.name)) {
      result.register(tool);
    }
  }
  return result;
}

/**
 * Build a system prompt tailored to the subagent type.
 * Uses SessionState-based conditional sections for type-specific instructions.
 */
function buildSubagentSystemPrompt(type: SubagentType, toolRegistry: ToolRegistry): string {
  const toolNames = toolRegistry.getAll().map((t) => t.name);
  const builtinTypes = new Set<string>(["explore", "plan", "general"]);
  const sessionState: SessionState = {
    mode: "normal",
    isSubagent: true,
    subagentType: builtinTypes.has(type) ? (type as "explore" | "plan" | "general") : undefined,
    availableTools: toolNames,
    extendedThinkingEnabled: false,
    features: {},
  };

  return buildSystemPrompt({ toolRegistry, sessionState });
}

/**
 * Create a git worktree for isolated subagent execution.
 * Worktrees are created under .dbcode/worktrees/<agentId> following
 * the Claude Code convention of project-local isolation directories.
 * Returns the worktree path, branch name, and a cleanup function.
 */
async function createWorktree(
  baseDir: string,
  agentId: string,
): Promise<{ worktreePath: string; branchName: string; cleanup: () => Promise<void> }> {
  const worktreeDir = join(baseDir, ".dbcode", "worktrees");
  const worktreePath = join(worktreeDir, agentId);
  const branchName = `dbcode-worktree-${agentId}`;

  // Ensure directory exists
  await mkdir(worktreeDir, { recursive: true });

  try {
    await execFileAsync("git", ["worktree", "add", "-b", branchName, worktreePath], {
      cwd: baseDir,
    });
  } catch (error) {
    throw new SubagentError("Failed to create git worktree", {
      worktreePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const cleanup = async (): Promise<void> => {
    try {
      // Check if worktree has changes
      const status = await execFileAsync("git", ["status", "--porcelain"], {
        cwd: worktreePath,
      });
      const hasChanges = status.stdout.trim().length > 0;

      if (!hasChanges) {
        // No changes — clean up completely
        await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], {
          cwd: baseDir,
        });
        await execFileAsync("git", ["branch", "-D", branchName], { cwd: baseDir });
      }
      // If has changes, keep branch for user review
    } catch {
      // Best-effort cleanup
    }
  };

  return { worktreePath, branchName, cleanup };
}

/**
 * Detect and clean orphaned worktrees on startup.
 * Worktrees with no uncommitted changes are removed.
 */
export async function cleanOrphanedWorktrees(repoRoot: string): Promise<number> {
  const worktreeDir = join(repoRoot, ".dbcode", "worktrees");

  try {
    const entries = await readdir(worktreeDir);
    let cleaned = 0;

    for (const entry of entries) {
      const worktreePath = join(worktreeDir, entry);
      try {
        // Check if worktree has changes
        const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
          cwd: worktreePath,
        });

        if (stdout.trim().length === 0) {
          // No changes — safe to remove
          await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], {
            cwd: repoRoot,
          });
          cleaned++;
        }
      } catch {
        // Worktree might be invalid — try force removal
        try {
          await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], {
            cwd: repoRoot,
          });
          cleaned++;
        } catch {
          // Skip if even force removal fails
        }
      }
    }

    return cleaned;
  } catch {
    return 0; // worktree dir doesn't exist yet
  }
}

/**
 * Spawn a subagent with isolated context.
 * The subagent runs its own agent loop with a separate event emitter,
 * optionally filtered tool set, and its own conversation.
 *
 * Enhanced features:
 * - `run_in_background`: Runs non-blocking; emits completion event via parentEvents
 * - `isolation: "worktree"`: Creates a git worktree for file-safe isolation
 * - `resume`: Loads previous agent's message history for context continuity
 */
export async function spawnSubagent(config: SubagentConfig): Promise<SubagentResult> {
  const {
    type,
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    workingDirectory,
    maxIterations = 20,
    signal,
    parentEvents,
    allowedTools,
    run_in_background,
    isolation,
    resume,
    sharedState,
    modelOverride,
    permissionMode,
    maxContextTokens,
    agentDefinition,
    disallowedTools,
    skills,
    memory,
  } = config;

  const agentId = randomUUID();

  const executeParams = {
    agentId,
    type,
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    workingDirectory,
    maxIterations,
    signal,
    parentEvents,
    allowedTools,
    isolation,
    resume,
    sharedState,
    modelOverride,
    permissionMode,
    maxContextTokens,
    agentDefinition,
    disallowedTools,
    skills,
    memory,
  };

  // Background mode: fire-and-forget with event notification
  if (run_in_background) {
    const backgroundPromise = executeSubagent(executeParams);

    // Run in background, emit event on completion
    void backgroundPromise
      .then((result) => {
        parentEvents?.emit("tool:complete", {
          name: `subagent:${type}`,
          id: agentId,
          isError: false,
          output: result.response,
        });
      })
      .catch((error) => {
        parentEvents?.emit("tool:complete", {
          name: `subagent:${type}`,
          id: agentId,
          isError: true,
          output: error instanceof Error ? error.message : String(error),
        });
      });

    // Return immediately with a placeholder result
    return {
      agentId,
      type,
      response: `[Subagent ${type} running in background with ID: ${agentId}]`,
      iterations: 0,
      aborted: false,
      messages: [],
      sharedState,
    };
  }

  return executeSubagent(executeParams);
}

/** Internal execution logic for subagent (used by both sync and background modes) */
async function executeSubagent(params: {
  agentId: string;
  type: SubagentType;
  prompt: string;
  client: LLMProvider;
  model: string;
  strategy: ToolCallStrategy;
  toolRegistry: ToolRegistry;
  workingDirectory?: string;
  maxIterations: number;
  signal?: AbortSignal;
  parentEvents?: AppEventEmitter;
  allowedTools?: readonly string[];
  isolation?: "worktree";
  resume?: string;
  sharedState?: SharedAgentState;
  modelOverride?: AgentModel;
  permissionMode?: AgentPermissionMode;
  maxContextTokens?: number;
  agentDefinition?: AgentDefinition;
  disallowedTools?: readonly string[];
  skills?: readonly string[];
  memory?: AgentMemoryScope;
}): Promise<SubagentResult> {
  const {
    agentId,
    type,
    prompt,
    strategy,
    toolRegistry,
    maxIterations,
    signal,
    parentEvents,
    allowedTools,
    isolation,
    resume,
    sharedState,
    modelOverride,
    maxContextTokens,
    agentDefinition,
    disallowedTools,
  } = params;

  // Resolve model override — may switch provider
  const { model: effectiveModel, client: effectiveClient } = resolveModelForSubagent(
    params.model,
    params.client,
    modelOverride,
  );

  let effectiveWorkingDir = params.workingDirectory;
  let worktreeCleanup: (() => Promise<void>) | undefined;

  // Set up worktree isolation if requested
  if (isolation === "worktree" && effectiveWorkingDir) {
    const wt = await createWorktree(effectiveWorkingDir, agentId);
    effectiveWorkingDir = wt.worktreePath;
    worktreeCleanup = wt.cleanup;
  }

  try {
    // Notify parent that subagent is starting
    parentEvents?.emit("agent:iteration", { iteration: 0 });

    // Report initial progress via shared state if available
    if (sharedState) {
      sharedState.reportProgress(agentId, 0, "starting");
    }

    // Create filtered registry with both allowlist and denylist
    let agentRegistry = createFilteredRegistryWithBlacklist(
      toolRegistry,
      allowedTools,
      disallowedTools,
    );

    // Sub-agent in plan mode: block MCP and non-safe tools
    if (params.permissionMode === "plan") {
      const planSafe = new ToolRegistry();
      for (const tool of agentRegistry.getAll()) {
        // Block MCP tools
        if (tool.name.startsWith("mcp__")) continue;
        // Block dangerous/confirm tools
        if (tool.permissionLevel !== "safe") continue;
        planSafe.register(tool);
      }
      agentRegistry = planSafe;
    }

    // Build system prompt: use agent definition body if provided, otherwise default
    const systemPrompt = agentDefinition
      ? agentDefinition.systemPrompt
      : buildSubagentSystemPrompt(type, agentRegistry);

    // Create isolated event emitter
    const events = createEventEmitter();

    // Build initial messages (with optional resume context)
    const initialMessages: ChatMessage[] = [];

    if (resume) {
      const previousHistory = await getAgentHistory(resume);
      if (previousHistory) {
        // Carry over previous conversation, then add new system prompt and user message
        initialMessages.push(...previousHistory);
        initialMessages.push({
          role: "user",
          content: `[Resumed from agent ${resume}]\n\n${prompt}`,
        });
      } else {
        // No history found, start fresh
        initialMessages.push(
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        );
      }
    } else {
      initialMessages.push(
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      );
    }

    // Wall-clock timeout to prevent subagents from running indefinitely
    const SUBAGENT_TIMEOUT_MS = 300_000; // 5 minutes

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new SubagentError("Subagent timed out after 5 minutes")),
        SUBAGENT_TIMEOUT_MS,
      );
      // Allow the process to exit even if the timer is still pending
      if (typeof timer === "object" && "unref" in timer) {
        timer.unref();
      }
    });

    const result: AgentLoopResult = await Promise.race([
      runAgentLoop(
        {
          client: effectiveClient,
          model: effectiveModel,
          toolRegistry: agentRegistry,
          strategy,
          events,
          maxIterations,
          signal,
          workingDirectory: effectiveWorkingDir,
          maxContextTokens,
        },
        initialMessages,
      ),
      timeoutPromise,
    ]);

    // Store message history for potential future resume (in-memory + disk)
    await storeAgentHistory(agentId, result.messages);

    // Extract the final assistant response
    const lastAssistantMessage = [...result.messages].reverse().find((m) => m.role === "assistant");

    const response = lastAssistantMessage?.content ?? "";

    // Publish result to shared state if available
    if (sharedState) {
      sharedState.reportProgress(agentId, 1, "completed");
      sharedState.send({
        fromAgentId: agentId,
        type: "result",
        content: response,
        timestamp: Date.now(),
      });
    }

    return {
      agentId,
      type,
      response,
      iterations: result.iterations,
      aborted: result.aborted,
      messages: result.messages,
      workingDirectory: effectiveWorkingDir,
      sharedState,
    };
  } catch (error) {
    // Report error to shared state if available
    if (sharedState) {
      sharedState.reportProgress(agentId, 0, "failed");
      sharedState.send({
        fromAgentId: agentId,
        type: "error",
        content: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }

    throw new SubagentError(`Subagent (${type}) failed`, {
      agentId,
      type,
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Clean up worktree if one was created
    if (worktreeCleanup) {
      await worktreeCleanup();
    }
  }
}

/**
 * Spawn multiple subagents in parallel and collect their results.
 * All subagents share the same abort signal for coordinated cancellation.
 *
 * A SharedAgentState instance is automatically created and injected into
 * every config that does not already carry one, enabling inter-agent
 * communication and shared key-value storage across the parallel group.
 */
export async function spawnParallelSubagents(
  configs: readonly SubagentConfig[],
): Promise<readonly SubagentResult[]> {
  // Create a single shared state for the entire parallel group
  const groupSharedState = createSharedAgentState();

  const enrichedConfigs = configs.map((cfg) => ({
    ...cfg,
    sharedState: cfg.sharedState ?? groupSharedState,
  }));

  return Promise.all(enrichedConfigs.map(spawnSubagent));
}
