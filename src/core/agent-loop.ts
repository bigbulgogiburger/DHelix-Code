import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type ExtractedToolCall, type ToolCallResult } from "../tools/types.js";
import { executeToolCall } from "../tools/executor.js";
import { type AppEventEmitter } from "../utils/events.js";
import { AGENT_LOOP } from "../constants.js";

/** Configuration for the agent loop */
export interface AgentLoopConfig {
  readonly client: LLMProvider;
  readonly model: string;
  readonly toolRegistry: ToolRegistry;
  readonly strategy: ToolCallStrategy;
  readonly events: AppEventEmitter;
  readonly maxIterations?: number;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
  readonly workingDirectory?: string;
  readonly checkPermission?: (call: ExtractedToolCall) => Promise<PermissionResult>;
}

/** Result of a permission check */
export interface PermissionResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/** Result of the agent loop */
export interface AgentLoopResult {
  readonly messages: readonly ChatMessage[];
  readonly iterations: number;
  readonly aborted: boolean;
}

/**
 * Run the ReAct agent loop.
 * Repeatedly: call LLM → extract tool calls → check permissions → execute → append results → loop.
 * Stops when: no tool calls, max iterations reached, or aborted.
 */
export async function runAgentLoop(
  config: AgentLoopConfig,
  initialMessages: readonly ChatMessage[],
): Promise<AgentLoopResult> {
  const maxIterations = config.maxIterations ?? AGENT_LOOP.maxIterations;
  const messages: ChatMessage[] = [...initialMessages];
  let iterations = 0;

  while (iterations < maxIterations) {
    if (config.signal?.aborted) {
      return { messages, iterations, aborted: true };
    }

    iterations++;
    config.events.emit("agent:iteration", { iteration: iterations });

    // Prepare request with tool definitions
    const toolDefs = config.toolRegistry.getDefinitionsForLLM();
    const prepared = config.strategy.prepareRequest(messages, toolDefs);

    // Call LLM
    config.events.emit("llm:start", { iteration: iterations });

    const response = await config.client.chat({
      model: config.model,
      messages: prepared.messages,
      tools: prepared.tools,
      temperature: config.temperature ?? 0,
      maxTokens: config.maxTokens ?? 4096,
      signal: config.signal,
    });

    config.events.emit("llm:complete", {
      tokenCount: response.usage.totalTokens,
    });

    // Append assistant message
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
    };
    messages.push(assistantMessage);

    // Extract tool calls
    const extractedCalls = config.strategy.extractToolCalls(response.content, response.toolCalls);

    if (extractedCalls.length === 0) {
      break; // No tool calls — conversation turn complete
    }

    // Execute each tool call
    const results: ToolCallResult[] = [];

    for (const call of extractedCalls) {
      config.events.emit("tool:start", { name: call.name, id: call.id });

      // Check permission
      if (config.checkPermission) {
        const permission = await config.checkPermission(call);
        if (!permission.allowed) {
          results.push({
            id: call.id,
            name: call.name,
            output: `Permission denied: ${permission.reason ?? "User rejected"}`,
            isError: true,
          });
          config.events.emit("tool:complete", {
            name: call.name,
            id: call.id,
            isError: true,
          });
          continue;
        }
      }

      // Execute
      const result = await executeToolCall(config.toolRegistry, call, {
        workingDirectory: config.workingDirectory ?? process.cwd(),
        signal: config.signal,
      });

      results.push(result);
      config.events.emit("tool:complete", {
        name: call.name,
        id: call.id,
        isError: result.isError,
      });
    }

    // Append tool results as messages
    const toolMessages = config.strategy.formatToolResults(results);
    messages.push(...toolMessages);
  }

  return { messages, iterations, aborted: false };
}
