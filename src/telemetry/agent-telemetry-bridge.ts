/**
 * Agent Telemetry Bridge — AppEventEmitter의 이벤트를 MetricsCollector에 연결
 *
 * agent-loop의 이벤트 시스템(llm:*, tool:*, agent:*)을 구독하여
 * 텔레메트리 MetricsCollector에 카운터/히스토그램 메트릭을 자동 기록합니다.
 *
 * 설계 원칙:
 * - stage 코드를 직접 수정하지 않고, 이벤트 구독으로 텔레메트리를 연결
 * - config 기반 조건부 활성화 (telemetry.enabled)
 * - dispose 패턴으로 리스너 정리 보장
 *
 * @module telemetry/agent-telemetry-bridge
 */

import { type AppEventEmitter } from "../utils/events.js";
import { type MetricsCollector, COUNTERS, HISTOGRAMS } from "./metrics.js";

/**
 * 텔레메트리 브리지 설정
 */
export interface TelemetryBridgeConfig {
  /** 텔레메트리 수집기 */
  readonly metricsCollector: MetricsCollector;
  /** 활성화 여부 (false이면 리스너를 등록하지 않음) */
  readonly enabled: boolean;
}

/**
 * 텔레메트리 브리지 — dispose()로 리스너를 정리합니다.
 */
export interface TelemetryBridge {
  /** 등록된 모든 이벤트 리스너를 제거합니다 */
  dispose(): void;
}

/**
 * AppEventEmitter에 텔레메트리 리스너를 등록하고,
 * MetricsCollector에 메트릭을 자동 기록합니다.
 *
 * 기록되는 메트릭:
 * - COUNTERS.tokensUsed: LLM 토큰 사용량 (input/output)
 * - COUNTERS.toolInvocations: 도구 호출 횟수 및 상태 (success/error)
 * - HISTOGRAMS.toolDuration: 도구 실행 시간
 * - HISTOGRAMS.llmLatency: LLM 호출 지연 시간
 *
 * @param events - 앱 이벤트 이미터
 * @param config - 텔레메트리 브리지 설정
 * @returns dispose 가능한 브리지 인스턴스
 */
export function createTelemetryBridge(
  events: AppEventEmitter,
  config: TelemetryBridgeConfig,
): TelemetryBridge {
  if (!config.enabled) {
    return { dispose: () => {} };
  }

  const { metricsCollector } = config;

  /** 도구 시작 시각을 기록 (도구 실행 시간 계산용) */
  const toolStartTimes = new Map<string, number>();

  /** LLM 호출 시작 시각 (LLM 지연 시간 계산용) */
  let llmStartTime = 0;

  // --- LLM 메트릭 ---

  const onLLMStart = () => {
    llmStartTime = performance.now();
  };

  const onLLMUsage = (data: {
    usage: {
      readonly promptTokens: number;
      readonly completionTokens: number;
      readonly totalTokens: number;
    };
    model: string;
  }) => {
    metricsCollector.increment(COUNTERS.tokensUsed, data.usage.promptTokens, {
      type: "input",
      model: data.model,
    });
    metricsCollector.increment(COUNTERS.tokensUsed, data.usage.completionTokens, {
      type: "output",
      model: data.model,
    });
  };

  const onLLMComplete = () => {
    if (llmStartTime > 0) {
      const elapsed = performance.now() - llmStartTime;
      metricsCollector.observe(HISTOGRAMS.llmLatency, elapsed, {});
      llmStartTime = 0;
    }
  };

  const onLLMError = () => {
    metricsCollector.increment(COUNTERS.errors, 1, { category: "llm" });
  };

  // --- Tool 메트릭 ---

  const onToolStart = (data: { name: string; id: string }) => {
    toolStartTimes.set(data.id, performance.now());
  };

  const onToolComplete = (data: { name: string; id: string; isError?: boolean }) => {
    const startTime = toolStartTimes.get(data.id);
    if (startTime !== undefined) {
      const elapsed = performance.now() - startTime;
      metricsCollector.observe(HISTOGRAMS.toolDuration, elapsed, { tool: data.name });
      toolStartTimes.delete(data.id);
    }

    const status = data.isError ? "error" : "success";
    metricsCollector.increment(COUNTERS.toolInvocations, 1, { tool: data.name, status });
  };

  // --- 이벤트 리스너 등록 ---

  events.on("llm:start", onLLMStart);
  events.on("llm:usage", onLLMUsage);
  events.on("llm:complete", onLLMComplete);
  events.on("llm:error", onLLMError);
  events.on("tool:start", onToolStart);
  events.on("tool:complete", onToolComplete);

  return {
    dispose() {
      events.off("llm:start", onLLMStart);
      events.off("llm:usage", onLLMUsage);
      events.off("llm:complete", onLLMComplete);
      events.off("llm:error", onLLMError);
      events.off("tool:start", onToolStart);
      events.off("tool:complete", onToolComplete);
      toolStartTimes.clear();
    },
  };
}
