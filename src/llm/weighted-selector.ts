/**
 * Weighted Model Selection — 비용·품질·레이턴시 가중치 기반 모델 선택기
 *
 * 여러 모델의 성능 메트릭에 가중치를 적용하여 최적의 모델을 선택합니다.
 * 각 모델은 비용(cost), 품질(quality), 레이턴시(latency) 세 축으로 평가되며,
 * 사용자가 지정한 가중치에 따라 종합 점수가 계산됩니다.
 *
 * 점수 계산 공식:
 * - 비용 점수: (1 - normalizedCost) * costWeight  — 낮을수록 좋음
 * - 품질 점수: normalizedQuality * qualityWeight   — 높을수록 좋음
 * - 레이턴시 점수: (1 - normalizedLatency) * latencyWeight — 낮을수록 좋음
 */

/**
 * 모델별 가중치 설정
 */
export interface ModelWeight {
  /** 모델 ID */
  readonly modelId: string;
  /** 비용 가중치 (0–1): 높을수록 저렴한 모델을 선호 */
  readonly costWeight: number;
  /** 품질 가중치 (0–1): 높을수록 고품질 모델을 선호 */
  readonly qualityWeight: number;
  /** 레이턴시 가중치 (0–1): 높을수록 빠른 응답 모델을 선호 */
  readonly latencyWeight: number;
}

/**
 * 모델 성능 메트릭 — 실측값을 점수 계산에 사용
 */
export interface ModelMetrics {
  /** 1,000 토큰당 비용 (USD) */
  readonly costPer1kTokens: number;
  /** 품질 평점 (0–1) */
  readonly qualityRating: number;
  /** 평균 응답 지연 시간 (밀리초) */
  readonly avgLatencyMs: number;
}

/**
 * 모델 종합 점수 결과
 */
export interface ModelScore {
  /** 모델 ID */
  readonly modelId: string;
  /** 종합 점수 (0–1) */
  readonly score: number;
  /** 항목별 점수 상세 */
  readonly breakdown: {
    readonly cost: number;
    readonly quality: number;
    readonly latency: number;
  };
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────

/**
 * 값을 [0, 1] 범위로 정규화
 *
 * min == max 인 경우 0.5를 반환합니다 (모든 값이 동일할 때 중립).
 */
function normalize(value: number, min: number, max: number): number {
  if (min === max) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * 가중치 배열의 합이 0인지 확인
 */
function totalWeight(w: ModelWeight): number {
  return w.costWeight + w.qualityWeight + w.latencyWeight;
}

// ─── WeightedModelSelector 클래스 ───────────────────────────────────

/**
 * 가중치 기반 모델 선택기
 *
 * 사용 예시:
 * ```typescript
 * const selector = new WeightedModelSelector([
 *   { modelId: "claude-opus-4", costWeight: 0.1, qualityWeight: 0.8, latencyWeight: 0.1 },
 *   { modelId: "claude-haiku-4", costWeight: 0.7, qualityWeight: 0.2, latencyWeight: 0.1 },
 * ]);
 *
 * const metrics = [
 *   { costPer1kTokens: 0.015, qualityRating: 0.95, avgLatencyMs: 800 },
 *   { costPer1kTokens: 0.0008, qualityRating: 0.7, avgLatencyMs: 200 },
 * ];
 *
 * const best = selector.selectBest(["claude-opus-4", "claude-haiku-4"], metrics);
 * ```
 */
export class WeightedModelSelector {
  /** 모델 ID → ModelWeight 매핑 */
  private weights: Map<string, ModelWeight>;

  /**
   * @param models - 초기 모델 가중치 목록
   */
  constructor(models: readonly ModelWeight[]) {
    this.weights = new Map(models.map((m) => [m.modelId, m]));
  }

  /**
   * 특정 모델의 종합 점수를 계산
   *
   * 다른 후보 모델과 비교하여 상대적 점수를 반환하려면 selectBest()를 사용하세요.
   * 이 메서드는 단일 모델의 절대 점수를 메트릭과 가중치로만 계산합니다.
   *
   * @param modelId - 점수를 계산할 모델 ID
   * @param metrics - 해당 모델의 성능 메트릭
   * @returns 모델 점수 (가중치 적용, 정규화 없음)
   * @throws Error - 등록되지 않은 모델 ID인 경우
   */
  score(modelId: string, metrics: ModelMetrics): ModelScore {
    const w = this.weights.get(modelId);
    if (!w) {
      throw new Error(`Model "${modelId}" is not registered in WeightedModelSelector`);
    }

    const total = totalWeight(w);
    if (total === 0) {
      return {
        modelId,
        score: 0,
        breakdown: { cost: 0, quality: 0, latency: 0 },
      };
    }

    // 비용·레이턴시는 낮을수록 좋으므로 반전, 품질은 높을수록 좋음
    // 메트릭 값은 단일 모델이므로 0~1 정규화는 metrics 값 자체를 활용
    const costScore = Math.max(0, 1 - metrics.costPer1kTokens) * w.costWeight;
    const qualityScore = Math.max(0, Math.min(1, metrics.qualityRating)) * w.qualityWeight;
    // 레이턴시: 1000ms 기준으로 정규화 (최대 5000ms 가정)
    const latencyNorm = Math.max(0, Math.min(1, metrics.avgLatencyMs / 5000));
    const latencyScore = (1 - latencyNorm) * w.latencyWeight;

    const rawScore = costScore + qualityScore + latencyScore;
    const normalizedScore = rawScore / total;

    return {
      modelId,
      score: Math.max(0, Math.min(1, normalizedScore)),
      breakdown: {
        cost: costScore,
        quality: qualityScore,
        latency: latencyScore,
      },
    };
  }

  /**
   * 후보 모델 목록에서 최고 점수 모델을 선택
   *
   * 각 후보의 메트릭을 0–1로 정규화한 뒤 가중합으로 비교합니다.
   * candidates[i]와 metrics[i]는 1:1 대응해야 합니다.
   *
   * @param candidates - 후보 모델 ID 배열
   * @param metrics - 각 후보의 성능 메트릭 배열 (candidates와 동일 순서)
   * @returns 가장 높은 점수를 받은 ModelScore
   * @throws Error - candidates가 비어 있는 경우
   */
  selectBest(candidates: readonly string[], metrics: readonly ModelMetrics[]): ModelScore {
    if (candidates.length === 0) {
      throw new Error("candidates must not be empty");
    }
    if (candidates.length !== metrics.length) {
      throw new Error("candidates and metrics arrays must have the same length");
    }

    // 정규화를 위한 범위 계산
    const costs = metrics.map((m) => m.costPer1kTokens);
    const qualities = metrics.map((m) => m.qualityRating);
    const latencies = metrics.map((m) => m.avgLatencyMs);

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const minQuality = Math.min(...qualities);
    const maxQuality = Math.max(...qualities);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    let bestScore: ModelScore | undefined;

    for (let i = 0; i < candidates.length; i++) {
      const modelId = candidates[i]!;
      const m = metrics[i]!;
      const w = this.weights.get(modelId);

      if (!w) continue; // 등록되지 않은 모델은 건너뜀

      const total = totalWeight(w);
      if (total === 0) continue;

      const normCost = normalize(m.costPer1kTokens, minCost, maxCost);
      const normQuality = normalize(m.qualityRating, minQuality, maxQuality);
      const normLatency = normalize(m.avgLatencyMs, minLatency, maxLatency);

      // 비용·레이턴시는 낮을수록 유리 → 반전
      const costScore = (1 - normCost) * w.costWeight;
      const qualityScore = normQuality * w.qualityWeight;
      const latencyScore = (1 - normLatency) * w.latencyWeight;

      const rawScore = (costScore + qualityScore + latencyScore) / total;

      const candidate: ModelScore = {
        modelId,
        score: Math.max(0, Math.min(1, rawScore)),
        breakdown: {
          cost: costScore,
          quality: qualityScore,
          latency: latencyScore,
        },
      };

      if (!bestScore || candidate.score > bestScore.score) {
        bestScore = candidate;
      }
    }

    if (!bestScore) {
      // 등록된 모델이 없으면 첫 번째 후보를 기본값으로 반환
      return {
        modelId: candidates[0]!,
        score: 0,
        breakdown: { cost: 0, quality: 0, latency: 0 },
      };
    }

    return bestScore;
  }

  /**
   * 특정 모델의 가중치를 업데이트
   *
   * @param weights - 업데이트할 ModelWeight (modelId로 식별)
   * @throws Error - 등록되지 않은 모델 ID인 경우
   */
  rebalance(weights: ModelWeight): void {
    if (!this.weights.has(weights.modelId)) {
      throw new Error(`Model "${weights.modelId}" is not registered. Use constructor to add new models.`);
    }
    this.weights.set(weights.modelId, weights);
  }

  /**
   * 등록된 모든 모델의 가중치 목록을 반환
   *
   * @returns 읽기 전용 ModelWeight 배열
   */
  listWeights(): readonly ModelWeight[] {
    return [...this.weights.values()];
  }

  /**
   * 특정 모델의 가중치를 반환
   *
   * @param modelId - 조회할 모델 ID
   * @returns ModelWeight 또는 undefined
   */
  getWeight(modelId: string): ModelWeight | undefined {
    return this.weights.get(modelId);
  }
}
