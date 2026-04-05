/**
 * 스킬 컴포저 — 여러 스킬을 조합하여 순차/병렬 실행하는 파이프라인
 *
 * 스킬 컴포지션은 여러 스킬 단계(step)를 정의하고,
 * 조건부 실행, 병렬 실행, 실패 시 중단(failFast) 등의
 * 흐름 제어를 지원합니다.
 *
 * 집계 전략:
 * - merge-outputs: 모든 step의 output을 하나의 객체로 병합
 * - first-success: 첫 번째 성공한 step의 output을 반환
 * - all-must-pass: 모든 step이 성공해야 전체 성공
 */

import { type SkillManifest } from "./manifest.js";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * 스킬 실행 단계 — 컴포지션의 단일 스텝
 */
export interface SkillStep {
  /** 실행할 스킬 이름 */
  readonly skillName: string;
  /** 스킬에 전달할 입력 값 */
  readonly inputs?: Readonly<Record<string, unknown>>;
  /** 이전 step 결과 기반 실행 조건 (예: "prev.success", "prev.output.status === 'ok'") */
  readonly condition?: string;
  /** true이면 이전 step과 병렬 실행 (기본: false) */
  readonly parallel?: boolean;
  /** 개별 step 타임아웃 (ms) */
  readonly timeoutMs?: number;
}

/**
 * 스킬 컴포지션 — 여러 스킬 단계의 실행 계획
 */
export interface SkillComposition {
  /** 컴포지션 이름 */
  readonly name: string;
  /** 컴포지션 설명 */
  readonly description: string;
  /** 실행 단계 목록 (순서대로) */
  readonly steps: readonly SkillStep[];
  /** 첫 실패 시 즉시 중단 (기본: true) */
  readonly failFast?: boolean;
  /** 결과 집계 전략 (기본: 'all-must-pass') */
  readonly aggregation?: "merge-outputs" | "first-success" | "all-must-pass";
}

/**
 * 개별 step 실행 결과
 */
export interface StepResult {
  /** 실행된 스킬 이름 */
  readonly skillName: string;
  /** 성공 여부 */
  readonly success: boolean;
  /** 실행 출력 (성공 시) */
  readonly output?: unknown;
  /** 에러 메시지 (실패 시) */
  readonly error?: string;
  /** 실행 소요 시간 (ms) */
  readonly durationMs: number;
}

/**
 * 컴포지션 전체 실행 결과
 */
export interface CompositionResult {
  /** 전체 성공 여부 */
  readonly success: boolean;
  /** 완료된 step 수 */
  readonly stepsCompleted: number;
  /** 전체 step 수 */
  readonly stepsTotal: number;
  /** 개별 step 결과 목록 */
  readonly results: readonly StepResult[];
  /** 집계 전략에 따른 최종 출력 */
  readonly aggregatedOutput?: unknown;
}

/**
 * 스킬 실행 함수 타입 — 외부에서 주입하는 실제 스킬 실행 로직
 */
export type SkillExecutor = (
  skillName: string,
  inputs: Readonly<Record<string, unknown>>,
) => Promise<unknown>;

/**
 * 컴포지션 검증 결과
 */
export interface CompositionValidation {
  /** 유효 여부 */
  readonly valid: boolean;
  /** 에러 메시지 목록 (검증 실패 시) */
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Condition Evaluator
// ---------------------------------------------------------------------------

/**
 * 이전 step 결과를 기반으로 조건 표현식을 평가
 *
 * 지원하는 표현식:
 * - "prev.success" → 이전 step의 success 값
 * - "prev.output.key" → 이전 step output의 특정 키 값
 * - "prev.output.key === 'value'" → 동등 비교
 *
 * 보안: eval() 대신 안전한 프로퍼티 접근만 허용합니다.
 *
 * @param condition - 조건 표현식 문자열
 * @param prev - 이전 step 실행 결과 (없으면 undefined)
 * @returns 조건 평가 결과 (truthy/falsy)
 */
export function evaluateCondition(
  condition: string,
  prev: StepResult | undefined,
): boolean {
  if (!prev) return false;

  const trimmed = condition.trim();

  // 동등 비교: "prev.output.x === 'value'" 또는 "prev.success === true"
  const eqMatch = trimmed.match(/^(.+?)\s*===\s*(.+)$/);
  if (eqMatch) {
    const left = resolveConditionPath(eqMatch[1].trim(), prev);
    const right = parseConditionLiteral(eqMatch[2].trim());
    return left === right;
  }

  // 단순 경로 접근: "prev.success", "prev.output.key"
  const value = resolveConditionPath(trimmed, prev);
  return Boolean(value);
}

/**
 * 조건 표현식의 점(.) 경로를 실제 값으로 해석
 *
 * @param path - "prev.success" 또는 "prev.output.key" 형식의 경로
 * @param prev - 이전 step 결과
 * @returns 해석된 값
 */
function resolveConditionPath(path: string, prev: StepResult): unknown {
  // "prev." 접두사 제거
  const stripped = path.startsWith("prev.") ? path.slice(5) : path;
  const parts = stripped.split(".");

  let current: unknown = prev;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 조건 리터럴 문자열을 JS 값으로 파싱
 *
 * @param literal - "'ok'", "true", "42" 등
 * @returns 파싱된 JS 값
 */
function parseConditionLiteral(literal: string): unknown {
  if (literal === "true") return true;
  if (literal === "false") return false;
  if (literal === "null") return null;
  if (literal === "undefined") return undefined;
  // 따옴표 문자열
  if (
    (literal.startsWith("'") && literal.endsWith("'")) ||
    (literal.startsWith('"') && literal.endsWith('"'))
  ) {
    return literal.slice(1, -1);
  }
  // 숫자
  const num = Number(literal);
  if (!Number.isNaN(num)) return num;
  return literal;
}

// ---------------------------------------------------------------------------
// SkillComposer
// ---------------------------------------------------------------------------

/**
 * SkillComposer — 여러 스킬을 조합하여 실행하는 오케스트레이터
 *
 * 사용법:
 * ```ts
 * const composer = new SkillComposer(name => skillManager.get(name)?.frontmatter);
 * const validation = composer.validate(composition);
 * if (validation.valid) {
 *   const result = await composer.execute(composition, executor);
 * }
 * ```
 */
export class SkillComposer {
  /**
   * @param skillResolver - 스킬 이름으로 매니페스트를 조회하는 함수
   */
  constructor(
    private readonly skillResolver: (name: string) => SkillManifest | undefined,
  ) {}

  /**
   * 컴포지션의 유효성을 검증
   *
   * 검사 항목:
   * - 최소 1개 step 필요
   * - 참조된 스킬이 모두 존재하는지
   * - 순환 의존(자기 참조) 검사
   *
   * @param composition - 검증할 컴포지션 정의
   * @returns 검증 결과 (에러가 있으면 errors 배열에 포함)
   */
  validate(composition: SkillComposition): CompositionValidation {
    const errors: string[] = [];

    if (composition.steps.length === 0) {
      errors.push("Composition must have at least one step");
    }

    const seen = new Set<string>();
    for (const step of composition.steps) {
      // 존재하지 않는 스킬 참조 검사
      const manifest = this.skillResolver(step.skillName);
      if (!manifest) {
        errors.push(`Skill not found: "${step.skillName}"`);
      }

      // 같은 스킬의 중복 참조는 허용하되 기록
      seen.add(step.skillName);
    }

    // 순환 참조: 컴포지션 이름과 동일한 스킬을 step에서 참조하면 순환
    if (seen.has(composition.name)) {
      errors.push(
        `Circular reference: composition "${composition.name}" references itself as a step`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 컴포지션을 실행
   *
   * 실행 흐름:
   * 1. sequential steps: 순서대로 실행, 이전 결과를 다음 step에 전달
   * 2. parallel steps: 연속된 parallel=true steps를 Promise.allSettled로 병렬 실행
   * 3. condition: 이전 step 결과를 기반으로 조건 평가, false면 skip
   * 4. failFast: true이면 첫 실패 시 즉시 중단
   * 5. timeoutMs: 개별 step에 타임아웃 적용
   *
   * @param composition - 실행할 컴포지션 정의
   * @param executor - 스킬 실행 함수 (외부 주입)
   * @returns 컴포지션 실행 결과
   */
  async execute(
    composition: SkillComposition,
    executor: SkillExecutor,
  ): Promise<CompositionResult> {
    const { steps, failFast = true, aggregation = "all-must-pass" } = composition;
    const results: StepResult[] = [];
    let prevResult: StepResult | undefined;

    // step들을 sequential/parallel 그룹으로 분할
    const groups = groupSteps(steps);

    for (const group of groups) {
      if (group.parallel) {
        // 병렬 실행 그룹
        const parallelResults = await Promise.allSettled(
          group.steps.map((step) =>
            this.executeStep(step, executor, prevResult),
          ),
        );

        for (const settled of parallelResults) {
          const stepResult =
            settled.status === "fulfilled"
              ? settled.value
              : createErrorResult(
                  group.steps[0].skillName,
                  settled.reason instanceof Error
                    ? settled.reason.message
                    : String(settled.reason),
                );
          results.push(stepResult);
          prevResult = stepResult;

          if (failFast && !stepResult.success) {
            return buildCompositionResult(results, steps.length, aggregation);
          }
        }
      } else {
        // 순차 실행
        for (const step of group.steps) {
          const stepResult = await this.executeStep(step, executor, prevResult);
          results.push(stepResult);
          prevResult = stepResult;

          if (failFast && !stepResult.success) {
            return buildCompositionResult(results, steps.length, aggregation);
          }
        }
      }
    }

    return buildCompositionResult(results, steps.length, aggregation);
  }

  /**
   * 단일 step을 실행
   *
   * @param step - 실행할 step
   * @param executor - 스킬 실행 함수
   * @param prev - 이전 step 결과 (condition 평가용)
   * @returns step 실행 결과
   */
  private async executeStep(
    step: SkillStep,
    executor: SkillExecutor,
    prev: StepResult | undefined,
  ): Promise<StepResult> {
    const start = Date.now();

    // 조건 평가 — false이면 skip
    if (step.condition) {
      const conditionMet = evaluateCondition(step.condition, prev);
      if (!conditionMet) {
        return {
          skillName: step.skillName,
          success: true,
          output: undefined,
          durationMs: Date.now() - start,
        };
      }
    }

    try {
      const executionPromise = executor(step.skillName, step.inputs ?? {});

      // 타임아웃 적용
      const output = step.timeoutMs
        ? await withTimeout(executionPromise, step.timeoutMs)
        : await executionPromise;

      return {
        skillName: step.skillName,
        success: true,
        output,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        skillName: step.skillName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** step 그룹 — 순차 또는 병렬 */
interface StepGroup {
  readonly parallel: boolean;
  readonly steps: readonly SkillStep[];
}

/**
 * step 목록을 sequential/parallel 그룹으로 분할
 *
 * 연속된 parallel=true step들은 하나의 병렬 그룹으로 묶습니다.
 * parallel=false(기본) step은 개별 순차 그룹입니다.
 *
 * @param steps - step 목록
 * @returns 그룹 배열
 */
function groupSteps(steps: readonly SkillStep[]): readonly StepGroup[] {
  const groups: StepGroup[] = [];
  let currentParallel: SkillStep[] = [];

  for (const step of steps) {
    if (step.parallel) {
      currentParallel.push(step);
    } else {
      // 현재 쌓인 병렬 그룹을 flush
      if (currentParallel.length > 0) {
        groups.push({ parallel: true, steps: currentParallel });
        currentParallel = [];
      }
      groups.push({ parallel: false, steps: [step] });
    }
  }

  // 남은 병렬 그룹 flush
  if (currentParallel.length > 0) {
    groups.push({ parallel: true, steps: currentParallel });
  }

  return groups;
}

/**
 * Promise에 타임아웃을 적용
 *
 * @param promise - 실행할 Promise
 * @param ms - 타임아웃 (ms)
 * @returns 타임아웃 내 완료된 결과
 * @throws Error - 타임아웃 초과 시
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * 에러 StepResult를 생성하는 헬퍼
 */
function createErrorResult(skillName: string, error: string): StepResult {
  return {
    skillName,
    success: false,
    error,
    durationMs: 0,
  };
}

/**
 * 개별 step 결과들을 집계하여 CompositionResult를 생성
 *
 * @param results - 개별 step 결과 목록
 * @param totalSteps - 전체 step 수
 * @param aggregation - 집계 전략
 * @returns 최종 컴포지션 결과
 */
function buildCompositionResult(
  results: readonly StepResult[],
  totalSteps: number,
  aggregation: "merge-outputs" | "first-success" | "all-must-pass",
): CompositionResult {
  const completed = results.length;

  let success: boolean;
  let aggregatedOutput: unknown;

  switch (aggregation) {
    case "merge-outputs": {
      // 모든 step의 output을 하나의 객체로 병합
      success = results.some((r) => r.success);
      const merged: Record<string, unknown> = {};
      for (const r of results) {
        if (r.output !== undefined) {
          merged[r.skillName] = r.output;
        }
      }
      aggregatedOutput = merged;
      break;
    }
    case "first-success": {
      // 첫 번째 성공한 step의 output
      const first = results.find((r) => r.success);
      success = first !== undefined;
      aggregatedOutput = first?.output;
      break;
    }
    case "all-must-pass":
    default: {
      // 모든 step이 성공해야 전체 성공
      success = results.length === totalSteps && results.every((r) => r.success);
      aggregatedOutput = undefined;
      break;
    }
  }

  return {
    success,
    stepsCompleted: completed,
    stepsTotal: totalSteps,
    results,
    aggregatedOutput,
  };
}
