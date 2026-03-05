import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { ToolRegistry } from "../tools/registry.js";
import { runAgentLoop, type AgentLoopResult } from "../core/agent-loop.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { createEventEmitter, type AppEventEmitter } from "../utils/events.js";
import { BaseError } from "../utils/error.js";

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
}

/** Result from a subagent execution */
export interface SubagentResult {
  /** The subagent type */
  readonly type: SubagentType;
  /** Final text response from the subagent */
  readonly response: string;
  /** Number of iterations the subagent ran */
  readonly iterations: number;
  /** Whether the subagent was aborted */
  readonly aborted: boolean;
  /** Full message history (for inspection) */
  readonly messages: readonly ChatMessage[];
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
 * Spawn a subagent with isolated context.
 * The subagent runs its own agent loop with a separate event emitter,
 * optionally filtered tool set, and its own conversation.
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
  } = config;

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

  // Build initial messages
  const initialMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  try {
    const result: AgentLoopResult = await runAgentLoop(
      {
        client,
        model,
        toolRegistry: agentRegistry,
        strategy,
        events,
        maxIterations,
        signal,
        workingDirectory,
      },
      initialMessages,
    );

    // Extract the final assistant response
    const lastAssistantMessage = [...result.messages].reverse().find((m) => m.role === "assistant");

    return {
      type,
      response: lastAssistantMessage?.content ?? "",
      iterations: result.iterations,
      aborted: result.aborted,
      messages: result.messages,
    };
  } catch (error) {
    throw new SubagentError(`Subagent (${type}) failed`, {
      type,
      cause: error instanceof Error ? error.message : String(error),
    });
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
