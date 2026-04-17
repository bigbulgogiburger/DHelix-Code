/**
 * Eval harness 타입 — Claude Code skill-creator v2.0 스키마와 상위 호환
 *
 * 계획서 §12 참조. 모든 스키마는 Zod 런타임 검증 + 정적 타입 추론 지원.
 *
 * Glossary:
 * - EvalCase: 하나의 테스트 케이스 (prompt + expectations)
 * - Grading: 한 case에 대한 채점 결과 (pass/fail + evidence)
 * - Metrics: 실행기 메트릭 (tool call 수, 생성 파일, step 수)
 * - Timing: wall-clock + 토큰 수
 * - Benchmark: 여러 config(with_skill / baseline) 의 통계 비교
 * - History: iteration 간 개선 추적
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// EvalCase — 단일 테스트 케이스
// ---------------------------------------------------------------------------

/**
 * 단일 평가 케이스 — 프롬프트 + 검증 기대치
 *
 * dhelix 확장 필드:
 * - trigger_only / should_trigger: description optimizer (P3) 용
 * - tags: 필터링
 * - expected_output_contains/excludes: substring 힌트 (P2 grader 용)
 */
export const evalCaseSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  files: z.array(z.string()).optional(),
  expectations: z.array(z.string().min(1)).min(1),
  expected_output_contains: z.array(z.string()).optional(),
  expected_output_excludes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  trigger_only: z.boolean().default(false),
  should_trigger: z.boolean().default(true),
});

export type EvalCase = z.infer<typeof evalCaseSchema>;

/**
 * evals.json 파일 스키마 — skill_name + cases 배열
 */
export const evalsFileSchema = z.object({
  skill_name: z.string().min(1),
  version: z.number().int().positive().default(1),
  cases: z.array(evalCaseSchema).min(1),
});

export type EvalsFile = z.infer<typeof evalsFileSchema>;

// ---------------------------------------------------------------------------
// Grading — 한 case에 대한 채점 결과
// ---------------------------------------------------------------------------

/**
 * 단일 expectation 의 채점 결과
 */
export const gradedExpectationSchema = z.object({
  text: z.string(),
  passed: z.boolean(),
  evidence: z.string(),
  reasoning: z.string().optional(),
});

export type GradedExpectation = z.infer<typeof gradedExpectationSchema>;

/**
 * 하나의 case 에 대한 종합 채점 결과
 */
export const gradingSchema = z.object({
  case_id: z.string().min(1),
  expectations: z.array(gradedExpectationSchema),
  claims_extracted: z.array(z.string()).optional(),
  improvement_suggestions: z.array(z.string()).optional(),
});

export type Grading = z.infer<typeof gradingSchema>;

// ---------------------------------------------------------------------------
// Metrics / Timing — 실행기 메트릭
// ---------------------------------------------------------------------------

/** 실행기 메트릭 (Claude Code metrics.json 과 호환) */
export const metricsSchema = z.object({
  tool_calls_by_type: z.record(z.string(), z.number().int().nonnegative()).default({}),
  total_steps: z.number().int().nonnegative().default(0),
  files_created: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  output_chars: z.number().int().nonnegative().default(0),
  transcript_chars: z.number().int().nonnegative().default(0),
});

export type Metrics = z.infer<typeof metricsSchema>;

/** Wall-clock 타이밍 + 토큰 수 */
export const timingSchema = z.object({
  executor_duration_ms: z.number().nonnegative(),
  executor_tokens: z
    .object({
      input: z.number().int().nonnegative(),
      output: z.number().int().nonnegative(),
    })
    .optional(),
  grader_duration_ms: z.number().nonnegative().optional(),
  grader_tokens: z
    .object({
      input: z.number().int().nonnegative(),
      output: z.number().int().nonnegative(),
    })
    .optional(),
});

export type Timing = z.infer<typeof timingSchema>;

// ---------------------------------------------------------------------------
// Benchmark — 여러 config 통계 비교
// ---------------------------------------------------------------------------

/** 단일 run 요약 (case 단위) */
export const runSummarySchema = z.object({
  run_id: z.string(),
  pass_rate: z.number().min(0).max(1),
  duration_ms: z.number().nonnegative(),
});

export type RunSummary = z.infer<typeof runSummarySchema>;

/** 통계 스칼라 */
export const statSchema = z.object({
  mean: z.number(),
  stddev: z.number().nonnegative(),
  min: z.number(),
  max: z.number(),
});

export type Stat = z.infer<typeof statSchema>;

/** Config 별 집계 (with_skill, baseline) */
export const configSummarySchema = z.object({
  runs: z.array(runSummarySchema),
  summary: z.object({
    pass_rate: statSchema,
    duration_ms: statSchema,
  }),
});

export type ConfigSummary = z.infer<typeof configSummarySchema>;

/** Iteration 전체의 benchmark 결과 */
export const benchmarkSchema = z.object({
  skill_name: z.string().min(1),
  iteration: z.number().int().nonnegative(),
  configs: z.record(z.string(), configSummarySchema),
  delta: z
    .object({
      pass_rate: z.number(),
      duration_ms: z.number(),
    })
    .optional(),
});

export type Benchmark = z.infer<typeof benchmarkSchema>;

// ---------------------------------------------------------------------------
// History — iteration 간 개선 추적
// ---------------------------------------------------------------------------

export const historyEntrySchema = z.object({
  version: z.number().int().nonnegative(),
  parent_version: z.number().int().nullable(),
  description: z.string(),
  skill_md_hash: z.string(),
  expectation_pass_rate: z.number().min(0).max(1),
  grading_result: z.enum(["baseline", "won", "lost", "tie"]),
  created_at: z.string(),
});

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const historySchema = z.object({
  skill_name: z.string().min(1),
  entries: z.array(historyEntrySchema),
});

export type History = z.infer<typeof historySchema>;

// ---------------------------------------------------------------------------
// Eval 실행 결과 (runner → aggregator 전달)
// ---------------------------------------------------------------------------

/**
 * Runner 가 단일 case 실행 후 내보내는 원시 결과
 *
 * 이 구조체는 디스크에도 저장되지만 주로 메모리 전달용.
 * aggregator 는 여러 RawRunResult 를 모아 Benchmark 를 생성한다.
 */
export interface RawRunResult {
  readonly caseId: string;
  readonly configName: string; // "with_skill" | "baseline" | ...
  readonly runId: string; // e.g. "iteration-1/eval-e1/with-skill"
  readonly output: string;
  readonly transcript: string;
  readonly metrics: Metrics;
  readonly timing: Timing;
  readonly grading?: Grading;
}

/**
 * 실행 설정 — runner 에 전달
 */
export interface EvalConfig {
  readonly name: string;
  readonly withSkill: boolean;
  readonly model?: string;
}
