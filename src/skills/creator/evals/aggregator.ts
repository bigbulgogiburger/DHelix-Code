/**
 * Eval aggregator — 여러 RawRunResult 를 모아 Benchmark 통계를 생성
 *
 * 순수 함수: I/O 없음, 테스트 용이.
 *
 * 계획서 §9.5 benchmark.json 예시 참조.
 */

import {
  type Benchmark,
  type ConfigSummary,
  type Grading,
  type RawRunResult,
  type RunSummary,
  type Stat,
} from "./types.js";

/**
 * grading 에서 pass rate 계산 — expectations 중 passed=true 비율
 *
 * grading 이 없으면 0 을 반환 (실행은 됐으나 채점 안 된 경우).
 */
export function passRateFromGrading(grading: Grading | undefined): number {
  if (!grading) return 0;
  const total = grading.expectations.length;
  if (total === 0) return 0;
  const pass = grading.expectations.filter((e) => e.passed).length;
  return pass / total;
}

/**
 * 숫자 배열의 mean/stddev/min/max 를 계산
 *
 * 빈 배열은 모두 0 반환 (NaN 방지).
 * stddev 는 표본 분산이 아닌 **모분산** 기반 (population stddev) — run 집합은 전수이므로.
 */
export function computeStat(values: readonly number[]): Stat {
  if (values.length === 0) {
    return { mean: 0, stddev: 0, min: 0, max: 0 };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  const stddev = Math.sqrt(variance);
  let min = values[0] ?? 0;
  let max = values[0] ?? 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { mean, stddev, min, max };
}

/**
 * 한 config 의 RawRunResult 목록 → ConfigSummary 변환
 */
export function summarizeConfig(results: readonly RawRunResult[]): ConfigSummary {
  const runs: readonly RunSummary[] = results.map((r) => ({
    run_id: r.runId,
    pass_rate: passRateFromGrading(r.grading),
    duration_ms: r.timing.executor_duration_ms,
  }));

  const passRates = runs.map((r) => r.pass_rate);
  const durations = runs.map((r) => r.duration_ms);

  // Zod 추론 타입은 mutable RunSummary[] 이므로 readonly readonly 입력을 복사.
  return {
    runs: [...runs],
    summary: {
      pass_rate: computeStat(passRates),
      duration_ms: computeStat(durations),
    },
  };
}

/**
 * 여러 RawRunResult 를 configName 으로 그룹핑
 */
function groupByConfig(
  results: readonly RawRunResult[],
): Readonly<Record<string, readonly RawRunResult[]>> {
  const out: Record<string, RawRunResult[]> = {};
  for (const r of results) {
    const bucket = out[r.configName];
    if (bucket) bucket.push(r);
    else out[r.configName] = [r];
  }
  // 독자에게 readonly 로 노출
  const sealed: Record<string, readonly RawRunResult[]> = {};
  for (const [k, v] of Object.entries(out)) sealed[k] = v;
  return sealed;
}

/**
 * Benchmark 계산 — 여러 config 비교, 선택적으로 with_skill vs baseline delta
 *
 * @param skillName - 스킬 이름 (benchmark.skill_name 필드)
 * @param iteration - iteration 번호
 * @param results - 모든 run 결과 (여러 config 섞인 채로 전달 가능)
 * @returns Benchmark 객체 (디스크에 저장할 직렬화 대상)
 */
export function computeBenchmark(
  skillName: string,
  iteration: number,
  results: readonly RawRunResult[],
): Benchmark {
  const grouped = groupByConfig(results);
  const configs: Record<string, ConfigSummary> = {};
  for (const [name, bucket] of Object.entries(grouped)) {
    configs[name] = summarizeConfig(bucket);
  }

  const withSkill = configs["with_skill"];
  const baseline = configs["baseline"];
  const delta =
    withSkill && baseline
      ? {
          pass_rate: withSkill.summary.pass_rate.mean - baseline.summary.pass_rate.mean,
          duration_ms:
            withSkill.summary.duration_ms.mean - baseline.summary.duration_ms.mean,
        }
      : undefined;

  return {
    skill_name: skillName,
    iteration,
    configs,
    ...(delta ? { delta } : {}),
  };
}

/**
 * Benchmark 결과의 "승패" 판정 (history.grading_result 필드용)
 *
 * 규칙:
 * - with_skill 이 baseline 대비 +5% 이상 pass_rate 상승 → "won"
 * - with_skill 이 baseline 대비 -5% 이상 하락 → "lost"
 * - 그 외 → "tie"
 * - baseline 이 없으면 "baseline" (최초 iteration)
 */
export function classifyBenchmark(
  benchmark: Benchmark,
): "baseline" | "won" | "lost" | "tie" {
  const withSkill = benchmark.configs["with_skill"];
  const baseline = benchmark.configs["baseline"];
  if (!baseline) return "baseline";
  if (!withSkill) return "lost"; // with_skill 없으면 승리 불가

  const delta = withSkill.summary.pass_rate.mean - baseline.summary.pass_rate.mean;
  if (delta >= 0.05) return "won";
  if (delta <= -0.05) return "lost";
  return "tie";
}
