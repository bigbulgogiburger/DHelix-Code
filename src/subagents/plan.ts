import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type AppEventEmitter } from "../utils/events.js";
import { spawnSubagent, type SubagentResult } from "./spawner.js";

/** Tools for planning (read-only + search) */
const PLAN_ALLOWED_TOOLS = ["file_read", "glob_search", "grep_search"] as const;

/**
 * Spawn a plan subagent for implementation planning with dependency analysis.
 * The plan agent can read and search the codebase but cannot modify it.
 */
export async function spawnPlanAgent(options: {
  readonly prompt: string;
  readonly client: LLMProvider;
  readonly model: string;
  readonly strategy: ToolCallStrategy;
  readonly toolRegistry: ToolRegistry;
  readonly workingDirectory?: string;
  readonly maxIterations?: number;
  readonly signal?: AbortSignal;
  readonly parentEvents?: AppEventEmitter;
}): Promise<SubagentResult> {
  return spawnSubagent({
    type: "plan",
    prompt: options.prompt,
    client: options.client,
    model: options.model,
    strategy: options.strategy,
    toolRegistry: options.toolRegistry,
    workingDirectory: options.workingDirectory,
    maxIterations: options.maxIterations ?? 10,
    signal: options.signal,
    parentEvents: options.parentEvents,
    allowedTools: [...PLAN_ALLOWED_TOOLS],
  });
}
