/**
 * 비용 추적기 — LLM API 호출 비용과 토큰 사용량을 추적하는 모듈
 *
 * 에이전트 세션 동안 발생하는 모든 LLM 호출의 토큰 사용량과 비용을 기록합니다.
 * 모델별 가격 정보를 기반으로 자동으로 비용을 계산하며,
 * 세션 종료 시 총 비용과 모델별 사용량 분석을 제공합니다.
 *
 * 주요 기능:
 * - 토큰 사용량 기록 및 누적
 * - 모델별 가격 기반 비용 자동 계산
 * - 모델별 사용량 분석(breakdown)
 * - 세션 리셋
 */
import { type TokenUsage } from "./provider.js";
import { getModelCapabilities } from "./model-capabilities.js";

/** 모델의 토큰 가격 정보 (USD 기준, 100만 토큰당) */
export interface ModelPricing {
  /** 입력 토큰 100만개당 가격 (USD) */
  readonly inputPerMillion: number;
  /** 출력 토큰 100만개당 가격 (USD) */
  readonly outputPerMillion: number;
}

/** 하나의 토큰 사용 기록 — LLM 호출 한 번에 대한 사용량과 비용 */
export interface TokenUsageEntry {
  /** 사용된 모델 이름 (예: "gpt-4o", "claude-sonnet-4-20250514") */
  readonly model: string;
  /** 입력(프롬프트)에 사용된 토큰 수 */
  readonly promptTokens: number;
  /** 출력(응답)에 사용된 토큰 수 */
  readonly completionTokens: number;
  /** 총 토큰 수 (prompt + completion) */
  readonly totalTokens: number;
  /** 이 호출의 비용 (USD) — 모델 가격 기반 자동 계산 */
  readonly cost: number;
  /** 기록 시간 (Unix timestamp, 밀리초) */
  readonly timestamp: number;
  /** 에이전트 루프의 몇 번째 반복(iteration)에서 발생했는지 */
  readonly iteration: number;
}

/** 전체 세션의 비용 요약 — 누적된 모든 사용 기록의 집계 */
export interface CostSummary {
  /** 총 비용 (USD) */
  readonly totalCost: number;
  /** 총 토큰 수 */
  readonly totalTokens: number;
  /** 총 입력 토큰 수 */
  readonly totalPromptTokens: number;
  /** 총 출력 토큰 수 */
  readonly totalCompletionTokens: number;
  /** 모든 사용 기록의 배열 (시간순) */
  readonly entries: readonly TokenUsageEntry[];
  /** 모델별 사용량 분석 — 어떤 모델에서 얼마나 토큰/비용을 소비했는지 */
  readonly modelBreakdown: ReadonlyMap<string, { readonly tokens: number; readonly cost: number }>;
}

/**
 * 모델 이름으로 가격 정보를 조회
 *
 * model-capabilities 모듈을 단일 진실 공급원(single source of truth)으로 사용합니다.
 * 모든 가격 정보는 model-capabilities에서 중앙 관리됩니다.
 *
 * @param modelName - 모델 이름
 * @returns 해당 모델의 토큰 가격 정보
 */
export function getModelPricing(modelName: string): ModelPricing {
  const caps = getModelCapabilities(modelName);
  const p = caps.pricing;
  return {
    inputPerMillion: p.inputPerMillion,
    outputPerMillion: p.outputPerMillion,
  };
}

/**
 * 토큰 사용량과 모델 정보로 비용(USD)을 계산
 *
 * 계산식: (입력 토큰 / 100만) * 입력 단가 + (출력 토큰 / 100만) * 출력 단가
 *
 * @param model - 모델 이름
 * @param promptTokens - 입력 토큰 수
 * @param completionTokens - 출력 토큰 수
 * @returns 비용 (USD)
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = getModelPricing(model);
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

/**
 * 비용 추적기 — 에이전트 세션의 LLM 사용량과 비용을 누적 추적
 *
 * 한 번 기록된 항목은 수정할 수 없는 불변(immutable) 데이터입니다.
 * Node.js는 단일 스레드이므로 동시 접근 문제가 없습니다.
 *
 * 사용 예시:
 * ```typescript
 * const tracker = new CostTracker();
 * tracker.addFromTokenUsage("gpt-4o", usage, iteration);
 * const summary = tracker.getSummary();
 * console.log(`총 비용: $${summary.totalCost.toFixed(4)}`);
 * ```
 */
export class CostTracker {
  /** 기록된 사용 항목들 — 시간순으로 저장 */
  private readonly _entries: TokenUsageEntry[] = [];

  /**
   * 사용 기록을 추가 — 비용은 모델 가격표에서 자동 계산
   *
   * @param entry - 사용 기록 (cost와 timestamp는 자동 생성되므로 제외)
   */
  addUsage(entry: Omit<TokenUsageEntry, "cost" | "timestamp">): void {
    const cost = calculateCost(entry.model, entry.promptTokens, entry.completionTokens);
    this._entries.push({
      ...entry,
      cost,
      timestamp: Date.now(),
    });
  }

  /**
   * TokenUsage 객체에서 직접 사용 기록 추가 — 에이전트 루프 연동용 편의 메서드
   *
   * @param model - 모델 이름
   * @param usage - TokenUsage 객체 (promptTokens, completionTokens, totalTokens)
   * @param iteration - 에이전트 루프의 반복 번호
   */
  addFromTokenUsage(model: string, usage: TokenUsage, iteration: number): void {
    this.addUsage({
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      iteration,
    });
  }

  /**
   * 모든 기록의 집계 요약 반환
   *
   * 총 비용, 총 토큰 수, 모델별 사용량 분석을 포함합니다.
   *
   * @returns 비용 요약 객체
   */
  getSummary(): CostSummary {
    let totalCost = 0;
    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    // 모델별 토큰 수와 비용을 집계하는 Map
    const breakdown = new Map<string, { tokens: number; cost: number }>();

    for (const entry of this._entries) {
      totalCost += entry.cost;
      totalTokens += entry.totalTokens;
      totalPromptTokens += entry.promptTokens;
      totalCompletionTokens += entry.completionTokens;

      // 모델별 집계 — 같은 모델의 사용량을 누적
      const existing = breakdown.get(entry.model);
      if (existing) {
        existing.tokens += entry.totalTokens;
        existing.cost += entry.cost;
      } else {
        breakdown.set(entry.model, {
          tokens: entry.totalTokens,
          cost: entry.cost,
        });
      }
    }

    return {
      totalCost,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      entries: [...this._entries],       // 원본 배열의 복사본을 반환하여 불변성 보장
      modelBreakdown: breakdown,
    };
  }

  /**
   * 모든 기록을 초기화 — 새 세션 시작 시 사용
   */
  reset(): void {
    this._entries.length = 0;   // 배열을 비움 (새 배열 할당 대신 길이를 0으로)
  }

  /** 기록된 항목 수 */
  get entryCount(): number {
    return this._entries.length;
  }
}
