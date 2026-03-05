import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type AppEventEmitter } from "../utils/events.js";
import { spawnSubagent, type SubagentResult } from "./spawner.js";

/** Safe tools for exploration (read-only) */
const EXPLORE_ALLOWED_TOOLS = ["file_read", "glob_search", "grep_search"] as const;

/**
 * Spawn an explore subagent for codebase investigation.
 * The explore agent has read-only tool access (file_read, glob_search, grep_search).
 */
export async function spawnExploreAgent(options: {
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
    type: "explore",
    prompt: options.prompt,
    client: options.client,
    model: options.model,
    strategy: options.strategy,
    toolRegistry: options.toolRegistry,
    workingDirectory: options.workingDirectory,
    maxIterations: options.maxIterations ?? 15,
    signal: options.signal,
    parentEvents: options.parentEvents,
    allowedTools: [...EXPLORE_ALLOWED_TOOLS],
  });
}
