/**
 * 에이전트 루프(Agent Loop) — 핵심 실행 엔진
 *
 * ReAct(Reasoning + Acting) 패턴을 구현하는 메인 루프입니다.
 * LLM에게 질문을 보내고, 응답에서 도구 호출을 추출하여 실행한 뒤,
 * 그 결과를 다시 LLM에게 전달하는 과정을 반복합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 에이전트 루프는 AI 코딩 어시스턴트의 "두뇌"입니다
 * - 사용자 질문 → LLM 응답 → 도구 실행 → 결과 피드백 → 다시 LLM 호출... 반복
 * - 도구 호출이 없으면 LLM이 최종 답변을 완성한 것이므로 루프를 종료합니다
 * - 에러가 나면 종류에 따라 재시도(transient), 즉시 실패(permanent) 등을 결정합니다
 * - 서킷 브레이커가 무한 루프를 방지합니다
 * - 컨텍스트 매니저가 토큰 사용량을 관리합니다
 *
 * 주요 기능:
 * - LLM 호출 (스트리밍/비스트리밍)
 * - 도구 호출 병렬 실행 (읽기 도구는 항상 병렬, 같은 파일 쓰기는 순차)
 * - 권한 검사 및 보안 가드레일
 * - 자동 체크포인트 (파일 수정 전 백업)
 * - 에러 분류 및 복구 전략 적용
 * - 도구 결과 크기 제한 (토큰/문자 기반 잘라내기)
 * - 이중 모델 라우팅 (architect/editor 패턴)
 */
import { type ChatMessage } from "../llm/provider.js";
import { resetRetryState } from "./recovery-executor.js";
import { createRuntimeContext } from "./runtime/context-factory.js";
import { createPipeline } from "./runtime/pipeline.js";
import { metrics } from "../telemetry/metrics.js";
import { loadTelemetryConfig } from "../telemetry/config.js";
import { createTelemetryBridge } from "../telemetry/agent-telemetry-bridge.js";

// Re-export types from dedicated config module for backward compatibility
export { type AgentLoopConfig, type PermissionResult } from "./agent-loop-config.js";
import { type AgentLoopConfig } from "./agent-loop-config.js";

const trace = (tag: string, msg: string) => {
  if (process.env.DHELIX_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

// AggregatedUsage and UsageAggregator — extracted to dedicated module for reuse by context-factory
import { type AggregatedUsage } from "./usage-aggregator.js";
export { type AggregatedUsage, UsageAggregator } from "./usage-aggregator.js";

/**
 * 에이전트 루프 실행 결과
 *
 * @property messages - 전체 대화 메시지 배열 (입력 + 생성된 메시지 포함)
 * @property iterations - 실행된 반복 횟수
 * @property aborted - 사용자에 의해 중단되었는지 여부
 * @property usage - 토큰 사용량 통계
 */
export interface AgentLoopResult {
  readonly messages: readonly ChatMessage[];
  readonly iterations: number;
  readonly aborted: boolean;
  readonly usage?: AggregatedUsage;
}

// classifyLLMError and waitWithAbort — imported from ./error-classification.js (deduplicated)

// Re-export shared tool-call utilities for backward compatibility
export {
  filterValidToolCalls,
  groupToolCalls,
  extractFilePath,
  FILE_WRITE_TOOLS,
} from "./tool-call-utils.js";

// Note: truncateToolResult removed — ToolPipeline postprocess now handles output truncation

/**
 * ReAct 에이전트 루프를 실행합니다.
 *
 * 반복 흐름: LLM 호출 → 도구 호출 추출 → 권한 확인 → 도구 실행 → 결과 추가 → 반복
 *
 * 종료 조건:
 * - 도구 호출이 없으면 (LLM이 최종 답변을 완성했으므로)
 * - 최대 반복 횟수에 도달하면
 * - 사용자가 중단(abort)하면
 * - 서킷 브레이커가 열리면 (무한 루프 감지)
 *
 * 에러 복구: 분류-재시도-폴백 패턴
 * - 일시적(transient) 에러: 지수 백오프로 재시도
 * - 과부하(overload) 에러: 즉시 전파 (클라이언트가 이미 재시도함)
 * - 영구적(permanent) 에러: 즉시 실패
 *
 * @param config - 에이전트 루프 설정
 * @param initialMessages - 초기 메시지 배열 (시스템 프롬프트 + 사용자 메시지)
 * @returns 루프 실행 결과 (전체 메시지, 반복 횟수, 토큰 사용량 등)
 */
export async function runAgentLoop(
  config: AgentLoopConfig,
  initialMessages: readonly ChatMessage[],
): Promise<AgentLoopResult> {
  resetRetryState();

  const ctx = createRuntimeContext(config, initialMessages);
  const pipeline = createPipeline({});

  // Telemetry bridge — connects event system to MetricsCollector
  const telemetryConfig = loadTelemetryConfig();
  const telemetryBridge = createTelemetryBridge(config.events, {
    metricsCollector: metrics,
    enabled: telemetryConfig.enabled,
  });

  try {
    while (ctx.iteration < ctx.maxIterations && ctx.circuitBreaker.shouldContinue()) {
      if (config.signal?.aborted) {
        const usage = ctx.usageAggregator.snapshot();
        config.events.emit("agent:complete", {
          iterations: ctx.iteration,
          totalTokens: usage.totalTokens,
          toolCallCount: usage.toolCallCount,
          aborted: true,
          reason: "aborted",
        });
        trace("agent-loop", `Loop complete: reason=aborted, iterations=${ctx.iteration}`);
        return { messages: ctx.messages, iterations: ctx.iteration, aborted: true, usage };
      }

      ctx.iteration++;
      config.events.emit("agent:iteration", { iteration: ctx.iteration });
      trace("agent-loop", `--- Iteration ${ctx.iteration} start ---`);

      const outcome = await pipeline.executeIteration(ctx);

      switch (outcome.action) {
        case "continue":
          continue; // Next iteration
        case "complete": {
          const usage = ctx.usageAggregator.snapshot();
          config.events.emit("agent:complete", {
            iterations: ctx.iteration,
            totalTokens: usage.totalTokens,
            toolCallCount: usage.toolCallCount,
            aborted: false,
            reason: "completed",
          });
          trace(
            "agent-loop",
            `Loop complete: reason=no-tool-calls, iterations=${ctx.iteration}, aborted=false`,
          );
          return { messages: ctx.messages, iterations: ctx.iteration, aborted: false, usage };
        }
        case "abort": {
          const usage = ctx.usageAggregator.snapshot();
          config.events.emit("agent:complete", {
            iterations: ctx.iteration,
            totalTokens: usage.totalTokens,
            toolCallCount: usage.toolCallCount,
            aborted: true,
            reason: "aborted",
          });
          trace("agent-loop", `Loop complete: reason=aborted, iterations=${ctx.iteration}`);
          return { messages: ctx.messages, iterations: ctx.iteration, aborted: true, usage };
        }
        case "error":
          throw outcome.error;
      }
    }

    // Max iterations or circuit breaker
    const finalUsage = ctx.usageAggregator.snapshot();
    const reason = ctx.circuitBreaker.shouldContinue() ? "max-iterations" : "circuit-breaker";
    config.events.emit("agent:complete", {
      iterations: ctx.iteration,
      totalTokens: finalUsage.totalTokens,
      toolCallCount: finalUsage.toolCallCount,
      aborted: false,
      reason,
    });
    trace("agent-loop", `Loop complete: reason=${reason}, iterations=${ctx.iteration}`);

    return { messages: ctx.messages, iterations: ctx.iteration, aborted: false, usage: finalUsage };
  } finally {
    telemetryBridge.dispose();
  }
}

// resolveDeferredFromHistory — moved to runtime/stages/resolve-tools.ts
