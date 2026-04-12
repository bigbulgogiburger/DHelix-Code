/**
 * Runtime Pipeline 타입 정의
 *
 * agent-loop의 파이프라인 분해에 필요한 모든 공유 타입을 정의합니다.
 * RuntimeContext는 stage 간 공유 상태, IterationOutcome은 반복 결과,
 * RuntimeStage는 각 stage의 제네릭 인터페이스입니다.
 *
 * @module core/runtime/types
 */

import { type ChatMessage, type ChatResponse, type LLMProvider } from "../../llm/provider.js";
import { type ToolCallStrategy } from "../../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../../tools/registry.js";
import {
  type ExtractedToolCall,
  type ToolCallResult,
  type ToolDefinitionForLLM,
} from "../../tools/types.js";
import { type AppEventEmitter } from "../../utils/events.js";
import { type CircuitBreaker } from "../circuit-breaker.js";
import { type ContextManager } from "../context-manager.js";
import { type DualModelRouter } from "../../llm/dual-model-router.js";
import { type AgentLoopConfig } from "../agent-loop-config.js";
import { type AggregatedUsage } from "../usage-aggregator.js";

/**
 * Stage 고유 이름 — metrics, logging, hooks에서 stage를 식별하는 데 사용됩니다.
 */
export type StageName =
  | "prepare-context"
  | "compact-context"
  | "resolve-tools"
  | "sample-llm"
  | "extract-calls"
  | "preflight-policy"
  | "execute-tools"
  | "persist-results"
  | "evaluate-continuation";

/**
 * Iteration이 시작되는 이유 — 다음 반복의 동기를 추적합니다.
 */
export type TransitionReason =
  | "initial"
  | "tool-results"
  | "recovery"
  | "compaction-retry"
  | "user-input"
  | "continuation";

/**
 * Iteration 결과 — 다음 행동을 결정합니다.
 *
 * - continue: 도구 결과 등으로 인해 다음 iteration 진행
 * - complete: LLM이 최종 답변 완성, 루프 종료
 * - abort: 사용자 중단 또는 시그널
 * - error: 복구 불가능한 에러 발생
 */
export type IterationOutcome =
  | { readonly action: "continue"; readonly reason: TransitionReason }
  | { readonly action: "complete" }
  | { readonly action: "abort" }
  | { readonly action: "error"; readonly error: unknown };

/**
 * Pipeline hook points — stage 실행 전후에 커스텀 로직을 삽입할 수 있습니다.
 */
export interface PipelineHooks {
  readonly onBeforeStage?: (stage: StageName, ctx: RuntimeContext) => Promise<void>;
  readonly onAfterStage?: (stage: StageName, ctx: RuntimeContext) => Promise<void>;
  readonly onIterationStart?: (ctx: RuntimeContext) => Promise<void>;
  readonly onIterationEnd?: (outcome: IterationOutcome, ctx: RuntimeContext) => Promise<void>;
}

/**
 * Runtime stage — agent loop의 하나의 처리 단계.
 *
 * 모든 stage는 동일한 인터페이스를 구현하며,
 * pipeline orchestrator가 순서대로 실행합니다.
 * stage는 ctx를 직접 변경(mutate)하여 다음 stage에 데이터를 전달합니다.
 */
export interface RuntimeStage {
  /** Stage 고유 이름 */
  readonly name: StageName;

  /** Stage 실행. context를 변경하여 결과를 전달합니다. */
  execute(ctx: RuntimeContext): Promise<void>;
}

/**
 * Runtime context — stage 간 공유되는 상태.
 *
 * 각 iteration마다 새로 생성되지 않고, 루프 전체에서 공유됩니다.
 * stage들이 이 context를 변경하여 다음 stage에 데이터를 전달합니다.
 */
export interface RuntimeContext {
  /** 현재 반복 번호 */
  iteration: number;

  /** 전체 대화 메시지 (mutable for tool result append) */
  messages: ChatMessage[];

  /** 이번 iteration에서 관리된 메시지 (compaction/masking 적용 후) */
  managedMessages: ChatMessage[];

  /** LLM 응답 (sample stage 이후 설정) */
  response?: ChatResponse;

  /** 추출된 도구 호출 (extract stage 이후 설정) */
  extractedCalls: readonly ExtractedToolCall[];

  /** 도구 실행 결과 (execute stage 이후 설정) */
  toolResults: readonly ToolCallResult[];

  /** 이번 iteration의 시작 시각 */
  readonly startedAt: number;

  /** Stage별 timing metrics */
  readonly timings: Map<StageName, number>;

  /** Circuit breaker 참조 */
  readonly circuitBreaker: CircuitBreaker;

  /** Usage aggregator 참조 */
  readonly usageAggregator: UsageAggregatorInterface;

  /** Abort signal */
  readonly signal?: AbortSignal;

  /** 현재 transition reason */
  transitionReason: TransitionReason;

  /** AgentLoopConfig 원본 참조 */
  readonly config: AgentLoopConfig;

  /** Context manager 참조 */
  readonly contextManager: ContextManager;

  /** 최대 반복 횟수 */
  readonly maxIterations: number;

  /** LLM 최대 재시도 횟수 */
  readonly maxRetries: number;

  /** 도구 결과 최대 문자 수 */
  readonly maxToolResultChars: number;

  /** 이벤트 이미터 참조 */
  readonly events: AppEventEmitter;

  /** Tool call strategy 참조 */
  readonly strategy: ToolCallStrategy;

  /** Tool registry 참조 */
  readonly toolRegistry: ToolRegistry;

  /** 현재 활성 LLM 클라이언트 (dual-model routing에 의해 변경 가능) */
  activeClient: LLMProvider;

  /** 현재 활성 모델명 */
  activeModel: string;

  /** Resolved tool definitions for this iteration */
  toolDefs: readonly ToolDefinitionForLLM[];

  /** Permission denial 카운터 (tool name → count) */
  readonly permissionDenialCounts: Map<string, number>;

  /** 빈 응답 연속 횟수 */
  consecutiveEmptyResponses: number;

  /** Incomplete 응답 연속 횟수 */
  consecutiveIncompleteResponses: number;

  /** 중복 도구 호출 감지용 시그니처 */
  lastToolCallSignature: string;

  /** 중복 도구 호출 횟수 */
  duplicateToolCallCount: number;

  /** 마지막 컴팩션이 발생한 iteration 번호 */
  lastCompactionIteration: number;

  /** Dual-model router (optional) */
  readonly dualModelRouter?: DualModelRouter;

  /** 이 iteration에서 early-return 해야 하는지 (continue 시맨틱) */
  shouldContinueLoop: boolean;

  /** Prepared request messages (resolve-tools에서 설정) */
  preparedMessages: readonly ChatMessage[];

  /** Prepared request tools (resolve-tools에서 설정) */
  preparedTools: readonly ToolDefinitionForLLM[];
}

/**
 * UsageAggregator 인터페이스 — 토큰 사용량 추적
 */
export interface UsageAggregatorInterface {
  recordLLMUsage(usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  }): void;
  recordToolCalls(count: number): void;
  recordRetry(): void;
  snapshot(): AggregatedUsage;
}
