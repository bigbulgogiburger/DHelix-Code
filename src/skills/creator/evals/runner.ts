/**
 * Eval runner — runs every case × every config in a concurrency-limited
 * fashion via an injectable subagent spawner.
 *
 * 설계 원칙:
 * - 순수 조합 계층: 실제 서브에이전트 실행은 `deps.spawn` 주입으로 위임.
 *   테스트에서는 stub, 프로덕션에서는 `src/subagents/spawner.ts` 래퍼를 주입.
 * - I/O 없음: 디스크 쓰기는 caller(workspace.persistRunResult)가 담당.
 * - AbortSignal 전파: 각 spawn 호출에 signal 을 넘기고, signal.abort() 시
 *   pending task 는 즉시 거절(reject).
 * - 결과 순서 보존: (case, config) 입력 순서 그대로 반환.
 */

import type {
  EvalCase,
  EvalConfig,
  EvalsFile,
  Grading,
  Metrics,
  RawRunResult,
  Timing,
} from "./types.js";

// ---------------------------------------------------------------------------
// 주입 가능 의존성 (RunnerDeps) + 옵션
// ---------------------------------------------------------------------------

/**
 * Subagent spawner + 선택적 grader — runner 가 필요로 하는 모든 외부 의존성
 *
 * 프로덕션에서는 `createProductionSpawn()` 또는 caller 의 래퍼,
 * 테스트에서는 hand-rolled stub 을 주입한다.
 */
export interface RunnerDeps {
  /**
   * 단일 서브에이전트 실행.
   * 반환 객체에 `durationMs` 가 있으면 runner 는 이를 우선 사용.
   */
  readonly spawn: (args: {
    readonly prompt: string;
    readonly systemPromptAddition?: string;
    readonly allowedTools?: readonly string[];
    readonly model?: string;
    readonly signal?: AbortSignal;
  }) => Promise<{
    readonly output: string;
    readonly transcript: string;
    readonly durationMs: number;
    readonly metrics?: {
      readonly toolCallsByType?: Readonly<Record<string, number>>;
      readonly totalSteps?: number;
      readonly filesCreated?: readonly string[];
      readonly errors?: readonly string[];
    };
  }>;

  /**
   * 선택적 grader. 없으면 RawRunResult.grading 은 undefined.
   * 던지면 runner 가 `[grader-error] <msg>` 로 단일 실패 expectation 을 가진
   * Grading 을 합성하여 passed=false 보장.
   */
  readonly gradeCase?: (args: {
    readonly caseData: EvalCase;
    readonly output: string;
    readonly signal?: AbortSignal;
  }) => Promise<Grading>;
}

/**
 * runEvals 옵션
 */
export interface RunEvalsOptions {
  /** 동시 실행 상한 (기본 3) */
  readonly maxConcurrency?: number;
  /** withSkill=true 인 config 에 주입할 SKILL.md 본문 */
  readonly skillBody?: string;
  /** 외부 취소 signal — 전체 배치에 전파 */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// 내부 유틸리티
// ---------------------------------------------------------------------------

/**
 * 간단한 concurrency pool — 제한된 수의 태스크만 동시에 실행한다.
 *
 * 입력 순서를 보존한 결과 배열을 반환한다.
 * signal.abort() 이 발생하면 아직 시작하지 않은 태스크는 reject 되고,
 * 이미 실행 중인 태스크는 자신에게 전파된 signal 을 통해 조기 종료한다.
 */
async function runWithConcurrency<T>(
  tasks: readonly ((signal?: AbortSignal) => Promise<T>)[],
  limit: number,
  signal?: AbortSignal,
): Promise<readonly T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let next = 0;
  const cap = Math.max(1, Math.floor(limit));

  // 시작 전에 이미 abort 되어 있으면 즉시 거절
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("aborted");
  }

  const worker = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error("aborted");
      }
      const index = next;
      next += 1;
      if (index >= tasks.length) return;

      const task = tasks[index];
      if (!task) return;
      results[index] = await task(signal);
    }
  };

  const workerCount = Math.min(cap, tasks.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) workers.push(worker());
  await Promise.all(workers);
  return results;
}

/**
 * spawner 반환 metrics (optional, camelCase) → Metrics schema (snake_case) 변환
 *
 * 누락된 필드는 기본값 채움. output/transcript 문자 길이는 상위에서 주입.
 */
function normalizeMetrics(
  raw: NonNullable<Awaited<ReturnType<RunnerDeps["spawn"]>>["metrics"]> | undefined,
  outputChars: number,
  transcriptChars: number,
): Metrics {
  return {
    tool_calls_by_type: { ...(raw?.toolCallsByType ?? {}) },
    total_steps: raw?.totalSteps ?? 0,
    files_created: [...(raw?.filesCreated ?? [])],
    errors: [...(raw?.errors ?? [])],
    output_chars: outputChars,
    transcript_chars: transcriptChars,
  };
}

/**
 * grader 가 throw 한 경우 합성하는 Grading — passed=false 보장
 */
function buildGraderErrorGrading(caseId: string, message: string): Grading {
  return {
    case_id: caseId,
    expectations: [
      {
        text: `[grader-error] ${message}`,
        passed: false,
        evidence: "",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 모든 (case × config) 조합을 실행하고 RawRunResult 배열을 반환.
 *
 * - runId 포맷: `eval-<caseId>/<configName>` (iteration prefix 없음 — workspace 레이어가 관리)
 * - withSkill=true 인 config 에만 `skillBody` 가 `systemPromptAddition` 으로 주입됨.
 * - 결과 순서는 입력 (cases × configs) 순서를 보존.
 * - 디스크에 저장하지 않음 — caller 가 workspace.persistRunResult 로 영속화.
 */
export async function runEvals(
  evalsFile: EvalsFile,
  configs: readonly EvalConfig[],
  deps: RunnerDeps,
  opts?: RunEvalsOptions,
): Promise<readonly RawRunResult[]> {
  const maxConcurrency = opts?.maxConcurrency ?? 3;
  const skillBody = opts?.skillBody;
  const outerSignal = opts?.signal;

  // (case, config) 조합 리스트 — 순서: case 바깥, config 안쪽
  const pairs: readonly { readonly caseData: EvalCase; readonly config: EvalConfig }[] =
    evalsFile.cases.flatMap((caseData) =>
      configs.map((config) => ({ caseData, config })),
    );

  // 각 pair 를 실행하는 태스크 팩토리 — signal 은 worker 에서 주입
  const tasks = pairs.map(({ caseData, config }) => {
    return async (taskSignal?: AbortSignal): Promise<RawRunResult> => {
      const effectiveSignal = taskSignal ?? outerSignal;

      const systemPromptAddition = config.withSkill ? skillBody : undefined;

      const spawnArgs: Parameters<RunnerDeps["spawn"]>[0] = {
        prompt: caseData.prompt,
        ...(systemPromptAddition !== undefined ? { systemPromptAddition } : {}),
        ...(config.model !== undefined ? { model: config.model } : {}),
        ...(effectiveSignal ? { signal: effectiveSignal } : {}),
      };

      // wall-clock timing (fallback if spawner didn't report durationMs)
      const startedAt = Date.now();
      const spawnResult = await deps.spawn(spawnArgs);
      const wallMs = Date.now() - startedAt;

      // Prefer spawner's own durationMs when provided (non-negative)
      const executorDurationMs =
        typeof spawnResult.durationMs === "number" && spawnResult.durationMs >= 0
          ? spawnResult.durationMs
          : wallMs;

      const metrics = normalizeMetrics(
        spawnResult.metrics,
        spawnResult.output.length,
        spawnResult.transcript.length,
      );

      const timing: Timing = {
        executor_duration_ms: executorDurationMs,
      };

      // grading 단계 (선택적)
      let grading: Grading | undefined;
      if (deps.gradeCase) {
        try {
          const gradeSignalArg: { readonly signal?: AbortSignal } = effectiveSignal
            ? { signal: effectiveSignal }
            : {};
          grading = await deps.gradeCase({
            caseData,
            output: spawnResult.output,
            ...gradeSignalArg,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          grading = buildGraderErrorGrading(caseData.id, msg);
        }
      }

      const runResult: RawRunResult = {
        caseId: caseData.id,
        configName: config.name,
        runId: `eval-${caseData.id}/${config.name}`,
        output: spawnResult.output,
        transcript: spawnResult.transcript,
        metrics,
        timing,
        ...(grading ? { grading } : {}),
      };
      return runResult;
    };
  });

  return runWithConcurrency(tasks, maxConcurrency, outerSignal);
}

/**
 * 프로덕션용 spawn 어댑터.
 *
 * **현재 상태: `null` 반환 (intentionally not wired).**
 *
 * 이유:
 * - `src/subagents/spawner.ts` 의 `spawnSubagent` 는 `client: LLMProvider`,
 *   `strategy: ToolCallStrategy`, `toolRegistry: ToolRegistry` 등 무거운
 *   런타임 의존성을 요구한다. 이들은 bootstrap 단계에서만 구성 가능하며
 *   skills/creator/evals 내부에서 안전하게 조립할 수 없다 (layer violation).
 * - `RunnerDeps.spawn` 은 `prompt + systemPromptAddition + allowedTools +
 *   model + signal` 만 받는 얕은 인터페이스로, `spawnSubagent` 와 직접 호환되지
 *   않는다.
 *
 * 따라서 `/skill-eval` 명령 (D4) 레벨에서 bootstrap 된 client/strategy/
 * toolRegistry 를 capture 한 closure 를 구성해 `RunnerDeps.spawn` 을 직접
 * 조립하는 것이 올바른 배선이다. 해당 구현 예시(의사 코드):
 *
 * ```ts
 * const spawn: RunnerDeps["spawn"] = async ({ prompt, systemPromptAddition,
 *   allowedTools, model, signal }) => {
 *   const started = Date.now();
 *   const res = await spawnSubagent({
 *     type: "general",
 *     prompt,
 *     client, model: model ?? defaultModel, strategy, toolRegistry,
 *     allowedTools,
 *     signal,
 *     // agentDefinition.systemPrompt 로 skill body 주입
 *     agentDefinition: systemPromptAddition
 *       ? { name: "eval-skill", description: "", systemPrompt:
 *           systemPromptAddition, tools: allowedTools ?? [],
 *           model: "inherit", permissionMode: "default" }
 *       : undefined,
 *   });
 *   return {
 *     output: res.response,
 *     transcript: JSON.stringify(res.messages),
 *     durationMs: Date.now() - started,
 *   };
 * };
 * ```
 *
 * TODO(D4): `/skill-eval` 명령에서 위 패턴으로 `RunnerDeps.spawn` 을 직접
 * 조립하고, createProductionSpawn 은 유지보수상 제거하거나 여기서 factory
 * 형태로 확장 (e.g. `createProductionSpawn(deps: {client,strategy,
 * toolRegistry,defaultModel})`) 하는 것을 권장.
 */
export function createProductionSpawn(): RunnerDeps["spawn"] | null {
  return null;
}
