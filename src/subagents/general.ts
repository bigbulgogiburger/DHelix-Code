import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type AppEventEmitter } from "../utils/events.js";
import { spawnSubagent, type SubagentResult } from "./spawner.js";

/**
 * Spawn a general-purpose subagent for delegated task execution.
 * The general agent has access to ALL tools (no filtering).
 */
export async function spawnGeneralAgent(options: {
  readonly prompt: string;
  readonly client: LLMProvider;
  readonly model: string;
  readonly strategy: ToolCallStrategy;
  readonly toolRegistry: ToolRegistry;
  readonly workingDirectory?: string;
  readonly maxIterations?: number;
  readonly signal?: AbortSignal;
  readonly parentEvents?: AppEventEmitter;
  readonly allowedTools?: readonly string[];
}): Promise<SubagentResult> {
  return spawnSubagent({
    type: "general",
    prompt: options.prompt,
    client: options.client,
    model: options.model,
    strategy: options.strategy,
    toolRegistry: options.toolRegistry,
    workingDirectory: options.workingDirectory,
    maxIterations: options.maxIterations ?? 25,
    signal: options.signal,
    parentEvents: options.parentEvents,
    allowedTools: options.allowedTools,
  });
}
