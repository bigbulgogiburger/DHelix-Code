/**
 * A/B Testing Infrastructure — LLM 모델 A/B 실험 관리 모듈
 *
 * 두 모델(A, B)을 일정 비율로 트래픽을 분할하여 성능을 비교합니다.
 * 실험 결과를 수집하고 통계적 유의성을 검정하여 우승 모델을 결정합니다.
 *
 * 통계 방법:
 * - erf 근사를 사용한 정규분포 기반 신뢰도 계산
 * - 샘플이 적을 때 (< 5)는 불충분 신뢰도(0.5 미만)를 반환
 */

import { randomUUID } from "crypto";

// ─── 인터페이스 정의 ────────────────────────────────────────────────

/**
 * A/B 실험 정의
 */
export interface ABExperiment {
  /** 실험 고유 ID */
  readonly id: string;
  /** 모델 A ID */
  readonly modelA: string;
  /** 모델 B ID */
  readonly modelB: string;
  /** A 모델의 트래픽 비율 (0–1) */
  readonly splitRatio: number;
  /** 추적할 메트릭 이름 목록 */
  readonly metrics: readonly string[];
  /** 실험 시작 시각 (Unix timestamp, ms) */
  readonly startedAt: number;
  /** 실험 상태 */
  readonly status: "active" | "completed";
}

/**
 * 실험의 한쪽 arm (모델 A 또는 B)의 집계 결과
 */
export interface ExperimentArm {
  /** 모델 ID */
  readonly modelId: string;
  /** 수집된 샘플 수 */
  readonly samples: number;
  /** 평균 점수 */
  readonly avgScore: number;
  /** 수집된 점수 목록 */
  readonly scores: readonly number[];
}

/**
 * A/B 실험 결과 요약
 */
export interface ABResult {
  /** 실험 ID */
  readonly experimentId: string;
  /** 모델 A 결과 */
  readonly modelA: ExperimentArm;
  /** 모델 B 결과 */
  readonly modelB: ExperimentArm;
  /** 우승 모델 ID (통계적으로 유의미할 때만 설정) */
  readonly winner?: string;
  /** 결과 신뢰도 (0–1) */
  readonly confidence: number;
}

/**
 * 실험 생성 설정 (id, startedAt, status는 자동 생성)
 */
export interface ABExperimentConfig {
  readonly modelA: string;
  readonly modelB: string;
  readonly splitRatio: number;
  readonly metrics: readonly string[];
}

// ─── 내부 타입 ──────────────────────────────────────────────────────

/** mutable 내부 arm 데이터 */
interface MutableArm {
  modelId: string;
  scores: number[];
}

/** 실험 런타임 데이터 — status는 mutable */
interface ExperimentRuntime {
  id: string;
  modelA: string;
  modelB: string;
  splitRatio: number;
  metrics: readonly string[];
  startedAt: number;
  status: "active" | "completed";
  armA: MutableArm;
  armB: MutableArm;
  assignCount: number;
}

// ─── 통계 헬퍼 ──────────────────────────────────────────────────────

/**
 * 배열의 산술 평균을 계산
 */
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * 표본 분산을 계산 (분모: n-1)
 */
function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

/**
 * 오차 함수(erf) 근사 — Abramowitz & Stegun 7.1.26
 */
function erf(x: number): number {
  const a1 = 0.254_829_592;
  const a2 = -0.284_496_736;
  const a3 = 1.421_413_741;
  const a4 = -1.453_152_027;
  const a5 = 1.061_405_429;
  const p = 0.327_591_1;

  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  return sign * (1 - poly * Math.exp(-ax * ax));
}

/**
 * 두 그룹의 점수 배열로부터 통계적 신뢰도를 계산
 *
 * Welch's t-test 근사 + 정규분포 누적분포함수(CDF) 근사를 사용합니다.
 *
 * @returns 신뢰도 (0–1). 샘플 부족(< 5) 시 낮은 값 반환.
 */
function computeConfidence(
  scoresA: readonly number[],
  scoresB: readonly number[],
): number {
  const nA = scoresA.length;
  const nB = scoresB.length;

  // 최소 샘플 기준 미달 시 낮은 신뢰도
  if (nA < 5 || nB < 5) {
    return Math.min(0.49, (nA + nB) / 20);
  }

  const mA = mean(scoresA);
  const mB = mean(scoresB);
  const vA = variance(scoresA);
  const vB = variance(scoresB);

  const se = Math.sqrt(vA / nA + vB / nB);
  if (se === 0) {
    return mA === mB ? 0.5 : 1.0;
  }

  const t = Math.abs(mA - mB) / se;
  const z = t / Math.SQRT2;
  const confidence = erf(z);

  return Math.max(0, Math.min(1, confidence));
}

// ─── ABTestManager 클래스 ────────────────────────────────────────────

/**
 * A/B 실험 매니저 — 실험 생성, 모델 할당, 결과 수집, 통계 분석을 담당
 *
 * 사용 예시:
 * ```typescript
 * const manager = new ABTestManager();
 * const exp = manager.createExperiment({
 *   modelA: "claude-opus-4",
 *   modelB: "claude-haiku-4",
 *   splitRatio: 0.5,
 *   metrics: ["latency", "quality"],
 * });
 *
 * const model = manager.assignModel(exp.id);
 * manager.recordResult(exp.id, model, 0.87);
 *
 * const result = manager.concludeExperiment(exp.id);
 * console.log(result.winner, result.confidence);
 * ```
 */
export class ABTestManager {
  /** 실험 ID → 런타임 데이터 */
  private readonly runtimes: Map<string, ExperimentRuntime> = new Map();

  /**
   * 새 A/B 실험을 생성
   *
   * @param config - 실험 설정 (모델 A/B, 비율, 메트릭)
   * @returns 생성된 ABExperiment (id, startedAt 자동 생성)
   * @throws Error - splitRatio가 0–1 범위를 벗어난 경우
   */
  createExperiment(config: ABExperimentConfig): ABExperiment {
    if (config.splitRatio < 0 || config.splitRatio > 1) {
      throw new Error(`splitRatio must be between 0 and 1, got ${config.splitRatio}`);
    }

    const id = randomUUID();
    const startedAt = Date.now();

    const runtime: ExperimentRuntime = {
      id,
      modelA: config.modelA,
      modelB: config.modelB,
      splitRatio: config.splitRatio,
      metrics: config.metrics,
      startedAt,
      status: "active",
      armA: { modelId: config.modelA, scores: [] },
      armB: { modelId: config.modelB, scores: [] },
      assignCount: 0,
    };

    this.runtimes.set(id, runtime);

    return this.runtimeToExperiment(runtime);
  }

  /**
   * 실험에 모델을 할당 — splitRatio 기반 확률적 할당
   *
   * @param experimentId - 실험 ID
   * @returns 할당된 모델 ID (modelA 또는 modelB)
   * @throws Error - 존재하지 않거나 완료된 실험인 경우
   */
  assignModel(experimentId: string): string {
    const runtime = this.getActiveRuntime(experimentId);
    runtime.assignCount++;
    const roll = Math.random();
    return roll < runtime.splitRatio ? runtime.modelA : runtime.modelB;
  }

  /**
   * 실험 결과를 기록
   *
   * @param experimentId - 실험 ID
   * @param modelId - 결과를 기록할 모델 ID (modelA 또는 modelB와 일치해야 함)
   * @param score - 점수 (임의 척도, 일관성만 유지하면 됨)
   * @throws Error - 유효하지 않은 실험 또는 모델 ID인 경우
   */
  recordResult(experimentId: string, modelId: string, score: number): void {
    const runtime = this.getActiveRuntime(experimentId);

    if (modelId === runtime.modelA) {
      runtime.armA.scores.push(score);
    } else if (modelId === runtime.modelB) {
      runtime.armB.scores.push(score);
    } else {
      throw new Error(
        `Model "${modelId}" is not part of experiment "${experimentId}". ` +
          `Expected "${runtime.modelA}" or "${runtime.modelB}".`,
      );
    }
  }

  /**
   * 현재 실험 결과를 조회 (실험을 종료하지 않음)
   *
   * @param experimentId - 실험 ID
   * @returns 현재까지의 ABResult
   * @throws Error - 존재하지 않는 실험 ID인 경우
   */
  getResults(experimentId: string): ABResult {
    const runtime = this.runtimes.get(experimentId);
    if (!runtime) {
      throw new Error(`Experiment "${experimentId}" not found`);
    }
    return this.buildResult(runtime);
  }

  /**
   * 등록된 모든 실험 목록을 반환
   *
   * @returns 읽기 전용 ABExperiment 배열
   */
  listExperiments(): readonly ABExperiment[] {
    return [...this.runtimes.values()].map((r) => this.runtimeToExperiment(r));
  }

  /**
   * 실험을 종료하고 최종 결과를 반환
   *
   * 신뢰도가 0.95 이상이면 winner를 결정합니다.
   *
   * @param experimentId - 종료할 실험 ID
   * @returns 최종 ABResult
   * @throws Error - 이미 완료된 실험인 경우
   */
  concludeExperiment(experimentId: string): ABResult {
    const runtime = this.getActiveRuntime(experimentId);
    runtime.status = "completed";
    return this.buildResult(runtime);
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────

  /**
   * 활성 실험의 런타임을 가져옴
   *
   * @throws Error - 존재하지 않거나 완료된 실험인 경우
   */
  private getActiveRuntime(experimentId: string): ExperimentRuntime {
    const runtime = this.runtimes.get(experimentId);
    if (!runtime) {
      throw new Error(`Experiment "${experimentId}" not found`);
    }
    if (runtime.status === "completed") {
      throw new Error(`Experiment "${experimentId}" is already completed`);
    }
    return runtime;
  }

  /**
   * 런타임으로부터 ABExperiment 뷰를 생성 (immutable)
   */
  private runtimeToExperiment(runtime: ExperimentRuntime): ABExperiment {
    return {
      id: runtime.id,
      modelA: runtime.modelA,
      modelB: runtime.modelB,
      splitRatio: runtime.splitRatio,
      metrics: runtime.metrics,
      startedAt: runtime.startedAt,
      status: runtime.status,
    };
  }

  /**
   * 런타임 데이터로부터 ABResult를 빌드
   */
  private buildResult(runtime: ExperimentRuntime): ABResult {
    const scoresA = runtime.armA.scores as readonly number[];
    const scoresB = runtime.armB.scores as readonly number[];

    const avgA = mean(scoresA);
    const avgB = mean(scoresB);
    const confidence = computeConfidence(scoresA, scoresB);

    // 신뢰도 95% 이상일 때만 우승자 결정
    let winner: string | undefined;
    if (confidence >= 0.95) {
      winner = avgA >= avgB ? runtime.armA.modelId : runtime.armB.modelId;
    }

    return {
      experimentId: runtime.id,
      modelA: {
        modelId: runtime.armA.modelId,
        samples: scoresA.length,
        avgScore: avgA,
        scores: scoresA,
      },
      modelB: {
        modelId: runtime.armB.modelId,
        samples: scoresB.length,
        avgScore: avgB,
        scores: scoresB,
      },
      winner,
      confidence,
    };
  }
}
