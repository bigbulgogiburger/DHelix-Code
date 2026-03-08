import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { ToolRegistry } from "../tools/registry.js";
import { runAgentLoop, type AgentLoopResult } from "../core/agent-loop.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { createEventEmitter, type AppEventEmitter } from "../utils/events.js";
import { BaseError } from "../utils/error.js";

const execFileAsync = promisify(execFile);

/** Subagent execution error */
export class SubagentError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SUBAGENT_ERROR", context);
  }
}

/** Subagent type */
export type SubagentType = "explore" | "plan" | "general";

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
}

/** In-memory store for completed subagent histories (for resume) */
const agentHistoryStore = new Map<string, readonly ChatMessage[]>();

/** Store a completed agent's message history */
function storeAgentHistory(agentId: string, messages: readonly ChatMessage[]): void {
  agentHistoryStore.set(agentId, messages);
  // Keep store bounded
  if (agentHistoryStore.size > 50) {
    const firstKey = agentHistoryStore.keys().next().value;
    if (firstKey !== undefined) {
      agentHistoryStore.delete(firstKey);
    }
  }
}

/** Retrieve a previous agent's message history for resume */
export function getAgentHistory(agentId: string): readonly ChatMessage[] | undefined {
  return agentHistoryStore.get(agentId);
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
 * Build a system prompt tailored to the subagent type.
 */
function buildSubagentSystemPrompt(type: SubagentType, toolRegistry: ToolRegistry): string {
  const base = buildSystemPrompt({ toolRegistry });

  const typeInstructions: Record<SubagentType, string> = {
    explore: [
      "You are an exploration subagent. Your role is to investigate the codebase",
      "and gather information. Use file reading, searching, and grep tools",
      "extensively. Provide a comprehensive summary of your findings.",
    ].join(" "),
    plan: [
      "You are a planning subagent. Your role is to analyze requirements,",
      "identify dependencies, and create a structured implementation plan.",
      "Break down the task into clear, ordered steps with estimated complexity.",
    ].join(" "),
    general: [
      "You are a general-purpose subagent. Complete the given task using",
      "the available tools. Be thorough and report your results clearly.",
    ].join(" "),
  };

  return `${base}\n\n${typeInstructions[type]}`;
}

/**
 * Create a git worktree for isolated subagent execution.
 * Returns the worktree path and a cleanup function.
 */
async function createWorktree(
  baseDir: string,
  agentId: string,
): Promise<{ worktreePath: string; cleanup: () => Promise<void> }> {
  const worktreePath = `/tmp/dbcode-worktree-${agentId}`;
  const branchName = `subagent/${agentId}`;

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
      await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], {
        cwd: baseDir,
      });
      await execFileAsync("git", ["branch", "-D", branchName], { cwd: baseDir });
    } catch {
      // Best-effort cleanup
    }
  };

  return { worktreePath, cleanup };
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
  } = config;

  const agentId = randomUUID();

  // Background mode: fire-and-forget with event notification
  if (run_in_background) {
    const backgroundPromise = executeSubagent({
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
    });

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
    };
  }

  return executeSubagent({
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
  });
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
}): Promise<SubagentResult> {
  const {
    agentId,
    type,
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    maxIterations,
    signal,
    parentEvents,
    allowedTools,
    isolation,
    resume,
  } = params;

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

    // Create filtered registry if tool restrictions apply
    const agentRegistry = allowedTools
      ? createFilteredRegistry(toolRegistry, allowedTools)
      : toolRegistry;

    // Build subagent-specific system prompt
    const systemPrompt = buildSubagentSystemPrompt(type, agentRegistry);

    // Create isolated event emitter
    const events = createEventEmitter();

    // Build initial messages (with optional resume context)
    const initialMessages: ChatMessage[] = [];

    if (resume) {
      const previousHistory = getAgentHistory(resume);
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

    const result: AgentLoopResult = await runAgentLoop(
      {
        client,
        model,
        toolRegistry: agentRegistry,
        strategy,
        events,
        maxIterations,
        signal,
        workingDirectory: effectiveWorkingDir,
      },
      initialMessages,
    );

    // Store message history for potential future resume
    storeAgentHistory(agentId, result.messages);

    // Extract the final assistant response
    const lastAssistantMessage = [...result.messages].reverse().find((m) => m.role === "assistant");

    return {
      agentId,
      type,
      response: lastAssistantMessage?.content ?? "",
      iterations: result.iterations,
      aborted: result.aborted,
      messages: result.messages,
      workingDirectory: effectiveWorkingDir,
    };
  } catch (error) {
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
 */
export async function spawnParallelSubagents(
  configs: readonly SubagentConfig[],
): Promise<readonly SubagentResult[]> {
  return Promise.all(configs.map(spawnSubagent));
}
