/**
 * RuntimeContext factory -- creates a RuntimeContext from AgentLoopConfig.
 *
 * This is the compatibility bridge for gradual migration from
 * the monolithic agent-loop to the 9-stage RuntimePipeline.
 *
 * Phase 1: agent-loop can create a RuntimeContext and invoke individual
 * pipeline stages without adopting the full pipeline orchestrator.
 *
 * @module core/runtime/context-factory
 */

import { type RuntimeContext, type TransitionReason } from "./types.js";
import { type AgentLoopConfig } from "../agent-loop.js";
import { type ChatMessage, type LLMProvider } from "../../llm/provider.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { ContextManager } from "../context-manager.js";
import { AGENT_LOOP } from "../../constants.js";

/**
 * Options for creating a RuntimeContext from existing agent-loop state.
 */
export interface CreateContextOptions {
  /** The original AgentLoopConfig from the agent loop */
  readonly config: AgentLoopConfig;
  /** Current conversation messages */
  readonly messages: ChatMessage[];
  /** The active LLM provider instance */
  readonly activeClient: LLMProvider;
  /** The active model name */
  readonly activeModel: string;
}

/**
 * Create a RuntimeContext compatible with the 9-stage pipeline.
 *
 * This factory bridges the gap between the legacy AgentLoopConfig
 * and the new RuntimeContext interface. All fields are initialized
 * to safe defaults so individual stages can be invoked immediately.
 */
export function createRuntimeContext(options: CreateContextOptions): RuntimeContext {
  const { config, messages, activeClient, activeModel } = options;
  const maxIterations = config.maxIterations ?? AGENT_LOOP.maxIterations;

  return {
    iteration: 0,
    messages,
    managedMessages: [],
    response: undefined,
    extractedCalls: [],
    toolResults: [],
    startedAt: Date.now(),
    timings: new Map(),
    circuitBreaker: new CircuitBreaker(maxIterations),
    usageAggregator: {
      recordLLMUsage: () => {},
      recordToolCalls: () => {},
      recordRetry: () => {},
      snapshot: () => ({
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        iterationCount: 0,
        toolCallCount: 0,
        retriedCount: 0,
      }),
    },
    signal: config.signal,
    transitionReason: "initial" as TransitionReason,
    config,
    contextManager: new ContextManager({
      maxContextTokens: config.maxContextTokens ?? 128_000,
      workingDirectory: config.workingDirectory,
      client: config.client,
      sessionId: config.sessionId,
    }),
    maxIterations,
    maxRetries: config.maxRetries ?? 2,
    maxToolResultChars: config.maxToolResultChars ?? 12_000,
    events: config.events,
    strategy: config.strategy,
    toolRegistry: config.toolRegistry,
    activeClient,
    activeModel,
    toolDefs: [],
    permissionDenialCounts: new Map(),
    consecutiveEmptyResponses: 0,
    consecutiveIncompleteResponses: 0,
    lastToolCallSignature: "",
    duplicateToolCallCount: 0,
    lastCompactionIteration: -1,
    dualModelRouter: config.dualModelRouter,
    shouldContinueLoop: false,
    preparedMessages: [],
    preparedTools: [],
  };
}
