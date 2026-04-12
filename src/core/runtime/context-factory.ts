/**
 * RuntimeContext 팩토리 — AgentLoopConfig에서 RuntimeContext를 생성
 *
 * agent-loop.ts의 초기화 로직을 추출하여 파이프라인에서 사용할 수 있게 합니다.
 * Phase 2 파이프라인 마이그레이션의 핵심 브리지 모듈입니다.
 *
 * @module core/runtime/context-factory
 */

import { type RuntimeContext } from "./types.js";
import { type AgentLoopConfig } from "../agent-loop-config.js";
import { type ChatMessage } from "../../llm/provider.js";
import { CircuitBreaker } from "../circuit-breaker.js";
import { ContextManager } from "../context-manager.js";
import { UsageAggregator } from "../usage-aggregator.js";
import { AGENT_LOOP } from "../../constants.js";

/**
 * AgentLoopConfig와 초기 메시지로부터 RuntimeContext를 생성합니다.
 *
 * 생성된 context는 RuntimePipeline.executeIteration()에 바로 전달할 수 있습니다.
 * 모든 필드는 안전한 기본값으로 초기화됩니다.
 *
 * @param config - 에이전트 루프 설정
 * @param initialMessages - 초기 대화 메시지 배열
 * @returns 파이프라인에서 사용할 RuntimeContext
 */
export function createRuntimeContext(
  config: AgentLoopConfig,
  initialMessages: readonly ChatMessage[],
): RuntimeContext {
  const maxIterations = config.maxIterations ?? AGENT_LOOP.maxIterations;
  const maxRetries = config.maxRetries ?? 2;
  const maxToolResultChars = config.maxToolResultChars ?? 12_000;
  const messages = [...initialMessages];

  const contextManager = new ContextManager({
    maxContextTokens: config.maxContextTokens,
    sessionId: config.sessionId,
    workingDirectory: config.workingDirectory,
    client: config.client,
    summaryModel: config.model,
    onPreCompact: () => {
      config.events.emit("context:pre-compact", { compactionNumber: 0 });
    },
  });

  const circuitBreaker = new CircuitBreaker(maxIterations);
  const usageAggregator = new UsageAggregator();

  return {
    iteration: 0,
    messages,
    managedMessages: [],
    extractedCalls: [],
    toolResults: [],
    startedAt: Date.now(),
    timings: new Map(),
    circuitBreaker,
    usageAggregator,
    signal: config.signal,
    transitionReason: "initial",
    config,
    contextManager,
    maxIterations,
    maxRetries,
    maxToolResultChars,
    events: config.events,
    strategy: config.strategy,
    toolRegistry: config.toolRegistry,
    activeClient: config.client,
    activeModel: config.model,
    toolDefs: [],
    permissionDenialCounts: new Map(),
    consecutiveEmptyResponses: 0,
    consecutiveIncompleteResponses: 0,
    lastToolCallSignature: "",
    duplicateToolCallCount: 0,
    lastCompactionIteration: -Infinity,
    dualModelRouter: config.dualModelRouter,
    shouldContinueLoop: false,
    preparedMessages: [],
    preparedTools: [],
  };
}
