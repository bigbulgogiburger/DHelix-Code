import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type ExtractedToolCall, type ToolCallResult } from "../tools/types.js";
import { executeToolCall } from "../tools/executor.js";
import { type AppEventEmitter } from "../utils/events.js";
import { AGENT_LOOP } from "../constants.js";
import { LLMError } from "../utils/error.js";

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
  /** Maximum LLM call retries per iteration (default: 2) */
  readonly maxRetries?: number;
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

/** Error classification for retry decisions */
type LLMErrorClass = "transient" | "overload" | "permanent";

/**
 * Classify an LLM error to determine retry behavior.
 */
function classifyLLMError(error: unknown): LLMErrorClass {
  if (!(error instanceof Error)) return "permanent";

  const message = error.message.toLowerCase();

  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("overload") ||
    message.includes("503") ||
    message.includes("capacity")
  ) {
    return "overload";
  }

  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("network")
  ) {
    return "transient";
  }

  return "permanent";
}

/**
 * Wait for a delay, respecting abort signal.
 */
function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new LLMError("Aborted"));
    });
  });
}

/**
 * Run the ReAct agent loop.
 * Repeatedly: call LLM → extract tool calls → check permissions → execute → append results → loop.
 * Stops when: no tool calls, max iterations reached, or aborted.
 *
 * Error recovery: classify-retry-fallback pattern.
 * - Transient/overload errors: retry with exponential backoff
 * - Permanent errors: fail immediately
 */
export async function runAgentLoop(
  config: AgentLoopConfig,
  initialMessages: readonly ChatMessage[],
): Promise<AgentLoopResult> {
  const maxIterations = config.maxIterations ?? AGENT_LOOP.maxIterations;
  const maxRetries = config.maxRetries ?? 2;
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

    // Call LLM with retry logic
    config.events.emit("llm:start", { iteration: iterations });

    let response;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await config.client.chat({
          model: config.model,
          messages: prepared.messages,
          tools: prepared.tools,
          temperature: config.temperature ?? 0,
          maxTokens: config.maxTokens ?? 4096,
          signal: config.signal,
        });
        break;
      } catch (error) {
        lastError = error;
        const errorClass = classifyLLMError(error);

        if (errorClass === "permanent") {
          throw error;
        }

        // Retry with exponential backoff for transient/overload errors
        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          config.events.emit("llm:error", {
            error: error instanceof Error ? error : new Error(String(error)),
          });
          await waitWithAbort(delay, config.signal);
        }
      }
    }

    if (!response) {
      throw lastError instanceof LLMError
        ? lastError
        : new LLMError("LLM call failed after retries", {
            cause: lastError instanceof Error ? lastError.message : String(lastError),
            attempts: maxRetries + 1,
          });
    }

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
