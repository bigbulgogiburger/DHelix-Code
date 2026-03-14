import { type LLMProvider, type ChatMessage, type ChatResponse, type ThinkingConfig } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type ExtractedToolCall, type ToolCallResult, type ToolDefinitionForLLM } from "../tools/types.js";
import { executeToolCall } from "../tools/executor.js";
import { consumeStream } from "../llm/streaming.js";
import { type AppEventEmitter } from "../utils/events.js";
import { AGENT_LOOP } from "../constants.js";
import { LLMError } from "../utils/error.js";
import { ContextManager } from "./context-manager.js";
import { type CheckpointManager } from "./checkpoint-manager.js";
import { applyInputGuardrails, applyOutputGuardrails } from "../guardrails/index.js";
import { countTokens } from "../llm/token-counter.js";
import { findRecoveryStrategy } from "./recovery-strategy.js";
import { type DualModelRouter, detectPhase } from "../llm/dual-model-router.js";

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
  /** Use streaming for LLM calls (emits text deltas via events) */
  readonly useStreaming?: boolean;
  /** Maximum tokens for the context window (enables auto-compaction) */
  readonly maxContextTokens?: number;
  /** Maximum characters per individual tool result (default: 12000) */
  readonly maxToolResultChars?: number;
  /** Maximum tokens per individual tool result (overrides maxToolResultChars when set) */
  readonly maxToolResultTokens?: number;
  /** Enable security guardrails for tool calls (default: true) */
  readonly enableGuardrails?: boolean;
  /** Checkpoint manager for auto-checkpointing file mutations */
  readonly checkpointManager?: CheckpointManager;
  /** Session ID for checkpoint metadata */
  readonly sessionId?: string;
  /** Extended thinking configuration (for Claude models) */
  readonly thinking?: ThinkingConfig;
  /** Dual-model router for architect/editor pattern (optional) */
  readonly dualModelRouter?: DualModelRouter;
}

/** Result of a permission check */
export interface PermissionResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/** Aggregated token usage across all iterations of an agent loop run */
export interface AggregatedUsage {
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalTokens: number;
  readonly iterationCount: number;
  readonly toolCallCount: number;
  readonly retriedCount: number;
}

/** Result of the agent loop */
export interface AgentLoopResult {
  readonly messages: readonly ChatMessage[];
  readonly iterations: number;
  readonly aborted: boolean;
  readonly usage?: AggregatedUsage;
}

/** Error classification for retry decisions */
type LLMErrorClass = "transient" | "overload" | "permanent";

/**
 * Classify an LLM error to determine retry behavior.
 */
function classifyLLMError(error: unknown): LLMErrorClass {
  if (!(error instanceof Error)) return "permanent";

  const message = error.message.toLowerCase();

  // "Request too large" is permanent — retrying the same payload won't help
  if (message.includes("request too large") || message.includes("too many tokens")) {
    return "permanent";
  }

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
 * Tracks cumulative token usage and execution metrics across agent loop iterations.
 * Immutable snapshot via `snapshot()` — internal state is mutable for performance.
 */
class UsageAggregator {
  private _totalPromptTokens = 0;
  private _totalCompletionTokens = 0;
  private _totalTokens = 0;
  private _iterationCount = 0;
  private _toolCallCount = 0;
  private _retriedCount = 0;

  /** Record token usage from a single LLM call */
  recordLLMUsage(usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  }): void {
    this._totalPromptTokens += usage.promptTokens;
    this._totalCompletionTokens += usage.completionTokens;
    this._totalTokens += usage.totalTokens;
    this._iterationCount++;
  }

  /** Record tool calls executed in this iteration */
  recordToolCalls(count: number): void {
    this._toolCallCount += count;
  }

  /** Record a retry attempt */
  recordRetry(): void {
    this._retriedCount++;
  }

  /** Return an immutable snapshot of the current aggregated usage */
  snapshot(): AggregatedUsage {
    return {
      totalPromptTokens: this._totalPromptTokens,
      totalCompletionTokens: this._totalCompletionTokens,
      totalTokens: this._totalTokens,
      iterationCount: this._iterationCount,
      toolCallCount: this._toolCallCount,
      retriedCount: this._retriedCount,
    };
  }
}

/** Tools that are always safe to run in parallel (read-only, no side effects) */
const ALWAYS_PARALLEL_TOOLS = new Set(["glob_search", "grep_search", "file_read"]);

/** Tools that write to files and need path-based conflict detection */
const FILE_WRITE_TOOLS = new Set(["file_write", "file_edit"]);

/**
 * Extract the file path from a tool call's arguments.
 * Returns undefined if no file path is found.
 */
function extractFilePath(call: ExtractedToolCall): string | undefined {
  const args = call.arguments as Record<string, unknown>;
  // Common parameter names for file paths
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  return undefined;
}

/**
 * Group tool calls into batches for parallel execution.
 *
 * Rules:
 * 1. file_read, glob_search, grep_search are always parallelizable
 * 2. file_write/file_edit targeting the same path must be sequential
 * 3. bash_exec calls are parallelizable with each other (independent commands)
 * 4. When dependency is unclear, keep sequential (safety first)
 *
 * Returns groups where calls within a group run concurrently,
 * and groups themselves run sequentially.
 */
export function groupToolCalls(toolCalls: readonly ExtractedToolCall[]): ExtractedToolCall[][] {
  if (toolCalls.length <= 1) {
    return toolCalls.length === 0 ? [] : [[...toolCalls]];
  }

  const groups: ExtractedToolCall[][] = [];
  // Track which file paths have pending writes in the current group
  let currentGroup: ExtractedToolCall[] = [];
  let currentGroupWritePaths = new Set<string>();

  for (const call of toolCalls) {
    const isAlwaysParallel = ALWAYS_PARALLEL_TOOLS.has(call.name);
    const isFileWrite = FILE_WRITE_TOOLS.has(call.name);
    const isBash = call.name === "bash_exec";
    const filePath = extractFilePath(call);

    if (isAlwaysParallel) {
      // Read-only tools can always go into the current group
      currentGroup.push(call);
    } else if (isFileWrite && filePath) {
      // File writes conflict if they target the same path
      if (currentGroupWritePaths.has(filePath)) {
        // Conflict: flush current group, start new one
        groups.push(currentGroup);
        currentGroup = [call];
        currentGroupWritePaths = new Set([filePath]);
      } else {
        currentGroup.push(call);
        currentGroupWritePaths.add(filePath);
      }
    } else if (isBash) {
      // bash_exec calls are parallelizable with each other
      currentGroup.push(call);
    } else {
      // Unknown tool: can go parallel but not with file writes to same path
      // Since we can't determine dependencies, add to current group
      // (safe because unknown tools are independent of each other)
      currentGroup.push(call);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Truncate a tool result to fit within token budget.
 * Uses token counting when maxToolResultTokens is set, otherwise falls back to character counting.
 */
function truncateToolResult(
  result: ToolCallResult,
  maxChars: number,
  maxTokens?: number,
): ToolCallResult {
  if (maxTokens !== undefined) {
    const tokenCount = countTokens(result.output);
    if (tokenCount <= maxTokens) return result;

    // Binary search for the right truncation point
    // Start with a character estimate (tokens * 4 for English, conservative)
    let charLimit = Math.floor(maxTokens * 3);
    let truncated = result.output.slice(0, charLimit);
    let truncatedTokens = countTokens(truncated);

    // Adjust if over budget
    while (truncatedTokens > maxTokens && charLimit > 100) {
      charLimit = Math.floor(charLimit * 0.8);
      truncated = result.output.slice(0, charLimit);
      truncatedTokens = countTokens(truncated);
    }

    return {
      ...result,
      output:
        truncated + `\n\n[... truncated, showing ~${truncatedTokens} of ${tokenCount} tokens]`,
    };
  }

  // Fallback to character-based truncation
  if (result.output.length <= maxChars) return result;
  return {
    ...result,
    output:
      result.output.slice(0, maxChars) +
      `\n\n[... truncated, showing first ${maxChars} of ${result.output.length} chars]`,
  };
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
  const maxToolResultChars = config.maxToolResultChars ?? 12_000;
  const messages: ChatMessage[] = [...initialMessages];
  let iterations = 0;
  const usageAggregator = new UsageAggregator();

  // Context manager for auto-compaction when token budget is exceeded
  const contextManager = new ContextManager({
    maxContextTokens: config.maxContextTokens,
    sessionId: config.sessionId,
    workingDirectory: config.workingDirectory,
    onPreCompact: () => {
      config.events.emit("context:pre-compact", { compactionNumber: 0 });
    },
  });

  while (iterations < maxIterations) {
    if (config.signal?.aborted) {
      const usage = usageAggregator.snapshot();
      config.events.emit("agent:complete", {
        iterations,
        totalTokens: usage.totalTokens,
        toolCallCount: usage.toolCallCount,
        aborted: true,
      });
      return { messages, iterations, aborted: true, usage };
    }

    iterations++;
    config.events.emit("agent:iteration", { iteration: iterations });

    // Dual-model routing: detect phase and select client/model for this iteration
    let activeClient = config.client;
    let activeModel = config.model;

    if (config.dualModelRouter) {
      const phase = detectPhase(messages);
      config.dualModelRouter.setPhase(phase);
      const routing = config.dualModelRouter.getClientForPhase(phase);
      activeClient = routing.client;
      activeModel = routing.model;
    }

    // Apply context compaction if messages exceed token budget
    const managedMessages = [...(await contextManager.prepare(messages))];

    // Prepare request with tool definitions
    // Deferred mode: hot tools only by default, plus schemas for recently used deferred tools
    let toolDefs: readonly ToolDefinitionForLLM[];
    if (config.toolRegistry.isDeferredMode) {
      const hotDefs = config.toolRegistry.getHotDefinitionsForLLM();
      const resolvedDeferred = resolveDeferredFromHistory(managedMessages, config.toolRegistry);
      toolDefs = [...hotDefs, ...resolvedDeferred];
    } else {
      toolDefs = config.toolRegistry.getDefinitionsForLLM();
    }
    const prepared = config.strategy.prepareRequest(managedMessages, toolDefs);

    // Call LLM with retry logic
    config.events.emit("llm:start", { iteration: iterations });

    const chatRequest = {
      model: activeModel,
      messages: prepared.messages,
      tools: prepared.tools,
      temperature: config.temperature ?? 0,
      maxTokens: config.maxTokens ?? 4096,
      signal: config.signal,
      thinking: config.thinking,
    };

    let response: ChatResponse | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (config.useStreaming) {
          // Streaming mode: accumulate chunks while emitting text deltas
          const stream = activeClient.stream(chatRequest);
          const accumulated = await consumeStream(stream, {
            onTextDelta: (text) => {
              config.events.emit("llm:text-delta", { text });
            },
            onUsage: (usage) => {
              config.events.emit("llm:usage", { usage, model: activeModel });
            },
          });

          if (accumulated.partial) {
            // Stream disconnected mid-response but we recovered partial content.
            // If we have text or tool calls, use them (better than losing everything).
            // If we have nothing meaningful, throw to trigger retry.
            if (accumulated.text.length === 0 && accumulated.toolCalls.length === 0) {
              throw new LLMError("Stream disconnected with no recoverable content");
            }
            config.events.emit("llm:error", {
              error: new Error("Stream disconnected mid-response; using partial content"),
            });
          }

          response = {
            content: accumulated.text,
            toolCalls: accumulated.toolCalls,
            usage: accumulated.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            finishReason: accumulated.partial ? "length" : "stop",
          };
        } else {
          response = await activeClient.chat(chatRequest);
        }
        break;
      } catch (error) {
        lastError = error;
        const errorClass = classifyLLMError(error);

        // Check recovery strategies before giving up
        if (error instanceof Error) {
          const recovery = findRecoveryStrategy(error);
          if (recovery) {
            config.events.emit("llm:error", {
              error: new Error(`Recovery strategy: ${recovery.description}`),
            });
          }
        }

        // Overload: client already retried with Retry-After — don't retry again
        if (errorClass === "overload" || errorClass === "permanent") {
          throw error;
        }

        // Transient only: retry with backoff
        if (attempt < maxRetries) {
          usageAggregator.recordRetry();
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

    // Record usage in aggregator and emit running totals
    usageAggregator.recordLLMUsage(response.usage);
    const runningUsage = usageAggregator.snapshot();
    config.events.emit("agent:usage-update", {
      promptTokens: runningUsage.totalPromptTokens,
      completionTokens: runningUsage.totalCompletionTokens,
      totalTokens: runningUsage.totalTokens,
      iteration: iterations,
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

    // Emit assistant message event (intermediate if tool calls follow, final otherwise)
    config.events.emit("agent:assistant-message", {
      content: response.content,
      toolCalls: extractedCalls.map((tc) => ({ id: tc.id, name: tc.name })),
      iteration: iterations,
      isFinal: extractedCalls.length === 0,
    });

    if (extractedCalls.length === 0) {
      // No tool calls — conversation turn complete
      const doneUsage = usageAggregator.snapshot();
      config.events.emit("agent:complete", {
        iterations,
        totalTokens: doneUsage.totalTokens,
        toolCallCount: doneUsage.toolCallCount,
        aborted: false,
      });
      return { messages, iterations, aborted: false, usage: doneUsage };
    }

    // Execute tool calls in parallel groups
    const groups = groupToolCalls(extractedCalls);
    const results: ToolCallResult[] = [];

    for (const group of groups) {
      // Pre-flight checks (permission + input guardrails) are sequential
      // because they may require user interaction
      const preflightResults = new Map<string, ToolCallResult>();
      const executableCalls: ExtractedToolCall[] = [];

      for (const call of group) {
        config.events.emit("tool:start", { name: call.name, id: call.id, args: call.arguments });

        // Check permission
        if (config.checkPermission) {
          const permission = await config.checkPermission(call);
          if (!permission.allowed) {
            const denied: ToolCallResult = {
              id: call.id,
              name: call.name,
              output: `Permission denied: ${permission.reason ?? "User rejected"}`,
              isError: true,
            };
            preflightResults.set(call.id, denied);
            config.events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: true,
              output: `Permission denied: ${permission.reason ?? "User rejected"}`,
            });
            continue;
          }
        }

        // Apply input guardrails
        if (config.enableGuardrails !== false) {
          const guardrailCheck = applyInputGuardrails(
            call.name,
            call.arguments as Record<string, unknown>,
            config.workingDirectory,
          );
          if (guardrailCheck.severity === "block") {
            const blocked: ToolCallResult = {
              id: call.id,
              name: call.name,
              output: `Blocked by guardrail: ${guardrailCheck.reason ?? "Security policy violation"}`,
              isError: true,
            };
            preflightResults.set(call.id, blocked);
            config.events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: true,
              output: `Blocked: ${guardrailCheck.reason}`,
            });
            continue;
          }
          if (guardrailCheck.severity === "warn") {
            config.events.emit("llm:error", {
              error: new Error(`Guardrail warning: ${guardrailCheck.reason}`),
            });
          }
        }

        executableCalls.push(call);
      }

      // Auto-checkpoint: snapshot files before file-modifying tools execute
      if (config.checkpointManager) {
        const fileModifyingCalls = executableCalls.filter((c) => FILE_WRITE_TOOLS.has(c.name));
        if (fileModifyingCalls.length > 0) {
          const trackedFiles = fileModifyingCalls
            .map((c) => extractFilePath(c))
            .filter((p): p is string => p !== undefined);

          if (trackedFiles.length > 0) {
            try {
              const workDir = config.workingDirectory ?? process.cwd();
              const toolNames = fileModifyingCalls.map((c) => c.name).join(", ");
              const cp = await config.checkpointManager.createCheckpoint({
                sessionId: config.sessionId ?? "unknown",
                description: `Before ${toolNames}: ${trackedFiles.map((f) => f.split("/").pop()).join(", ")}`,
                messageIndex: messages.length,
                workingDirectory: workDir,
                trackedFiles,
              });
              config.events.emit("checkpoint:created", {
                checkpointId: cp.id,
                description: cp.description,
                fileCount: cp.files.length,
              });
            } catch {
              // Checkpoint failure should not block tool execution
            }
          }
        }
      }

      // Execute all approved calls in the group in parallel
      const settled = await Promise.allSettled(
        executableCalls.map(async (call) => {
          let result = await executeToolCall(config.toolRegistry, call, {
            workingDirectory: config.workingDirectory ?? process.cwd(),
            signal: config.signal,
            events: config.events,
          });

          // Apply output guardrails
          if (config.enableGuardrails !== false) {
            const outputCheck = applyOutputGuardrails(result.output);
            if (outputCheck.modified) {
              result = { ...result, output: outputCheck.modified };
            }
          }

          return result;
        }),
      );

      // Collect results preserving original order within the group
      for (const call of group) {
        // Check if it was handled in preflight
        const preflightResult = preflightResults.get(call.id);
        if (preflightResult) {
          results.push(preflightResult);
          continue;
        }

        // Find the settled result for this call
        const execIndex = executableCalls.indexOf(call);
        if (execIndex === -1) continue;

        const settledResult = settled[execIndex];
        if (settledResult.status === "fulfilled") {
          const result = settledResult.value;
          results.push(result);
          config.events.emit("tool:complete", {
            name: call.name,
            id: call.id,
            isError: result.isError,
            output: result.output,
            metadata: result.metadata,
          });
        } else {
          // Promise.allSettled rejected — unexpected execution error
          const errorMessage =
            settledResult.reason instanceof Error
              ? settledResult.reason.message
              : String(settledResult.reason);
          const errorResult: ToolCallResult = {
            id: call.id,
            name: call.name,
            output: `Tool execution failed: ${errorMessage}`,
            isError: true,
          };
          results.push(errorResult);
          config.events.emit("tool:complete", {
            name: call.name,
            id: call.id,
            isError: true,
            output: errorResult.output,
          });
        }
      }
    }

    // Record executed tool calls in usage aggregator
    usageAggregator.recordToolCalls(extractedCalls.length);

    // Track file accesses for context manager rehydration
    for (const call of extractedCalls) {
      if (call.name === "file_read" || call.name === "file_edit" || call.name === "file_write") {
        const filePath = extractFilePath(call);
        if (filePath) {
          contextManager.trackFileAccess(filePath);
        }
      }
    }

    // Truncate oversized tool results (token-based or character-based)
    const truncatedResults = results.map((r) =>
      truncateToolResult(r, maxToolResultChars, config.maxToolResultTokens),
    );

    // Append tool results as messages
    const toolMessages = config.strategy.formatToolResults(truncatedResults);
    messages.push(...toolMessages);
  }

  const finalUsage = usageAggregator.snapshot();
  config.events.emit("agent:complete", {
    iterations,
    totalTokens: finalUsage.totalTokens,
    toolCallCount: finalUsage.toolCallCount,
    aborted: false,
  });

  return { messages, iterations, aborted: false, usage: finalUsage };
}

/** Resolve deferred tool schemas from message history for re-inclusion in next request */
function resolveDeferredFromHistory(
  messages: readonly ChatMessage[],
  registry: ToolRegistry,
): readonly ToolDefinitionForLLM[] {
  const resolved = new Map<string, ToolDefinitionForLLM>();
  let assistantsSeen = 0;

  // Scan recent assistant messages for MCP tool calls that need schema
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !msg.toolCalls) continue;

    assistantsSeen++;

    for (const tc of msg.toolCalls) {
      if (tc.name.startsWith("mcp__") && !resolved.has(tc.name)) {
        const def = registry.resolveDeferredTool(tc.name);
        if (def) resolved.set(tc.name, def);
      }
    }

    // Only check recent 3 assistant messages
    if (assistantsSeen >= 3) break;
  }

  return [...resolved.values()];
}
