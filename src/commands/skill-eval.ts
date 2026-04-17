/**
 * /skill-eval 명령어 핸들러 — dhelix 스킬의 eval harness 실행
 *
 * 동작 개요:
 *   1. `<workingDirectory>/.dhelix/skills/<name>/evals/evals.json` 로드 + 스키마 검증
 *   2. `SKILL.md` 본문 로드 + frontmatter 제거 (with-skill config 에 주입)
 *   3. `with_skill` + (옵션) `baseline` 구성으로 `runEvals` 실행
 *   4. 각 RawRunResult 를 workspace 에 영속화 (`persistRunResult`)
 *   5. `computeBenchmark` → `writeBenchmark` → `appendHistory` 기록
 *   6. 사람이 읽기 쉬운 요약 반환
 *
 * 의존성 주입(DI): `createSkillEvalCommand({ runEvals, createGraderClient,
 * createProductionSpawn, fs, now })` 로 테스트 가능. 기본 구현은 real modules.
 *
 * @see src/skills/creator/evals/types.ts — EvalsFile, RawRunResult 스키마
 * @see src/skills/creator/evals/workspace.ts — 디스크 레이아웃
 * @see src/skills/creator/evals/aggregator.ts — benchmark 계산 + 분류
 * @see src/skills/creator/evals/runner.ts — 서브에이전트 병렬 실행
 */

import { createHash } from "node:crypto";
import * as defaultFs from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME } from "../constants.js";
import { type CommandContext, type CommandResult, type SlashCommand } from "./registry.js";
import {
  computeBenchmark,
  classifyBenchmark,
} from "../skills/creator/evals/aggregator.js";
import {
  type RawRunResult,
  type EvalConfig,
  type EvalsFile,
  type Grading,
  evalsFileSchema,
} from "../skills/creator/evals/types.js";
import {
  runEvals as defaultRunEvals,
  createProductionSpawn as defaultCreateProductionSpawn,
  type RunnerDeps,
  type RunEvalsOptions,
} from "../skills/creator/evals/runner.js";
import {
  appendHistory,
  createIteration,
  getIterationDir,
  nextIterationNumber,
  persistRunResult,
  writeBenchmark,
} from "../skills/creator/evals/workspace.js";

/**
 * kebab-case 스킬 이름 유효성 검증 — scaffoldSkill 과 동일 규약
 */
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * Grader 클라이언트 팩토리 시그니처 — D3 가 제공 (D4 에서는 동적 로드)
 *
 * 반환값은 `RunnerDeps["gradeCase"]` 와 구조적으로 동일한 함수여야 한다.
 * 생성 단계에서 throw 하면 runner 는 grader 없이 진행.
 */
type GraderClientFactory = () => RunnerDeps["gradeCase"];

/**
 * 주입 가능한 의존성 — 테스트 용이성을 위한 DI 경계
 */
export interface SkillEvalDeps {
  readonly runEvals: (
    evalsFile: EvalsFile,
    configs: readonly EvalConfig[],
    runnerDeps: RunnerDeps,
    opts?: RunEvalsOptions,
  ) => Promise<readonly RawRunResult[]>;
  readonly createGraderClient: GraderClientFactory;
  readonly createProductionSpawn: () => RunnerDeps["spawn"] | null;
  readonly fs: {
    readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  };
  readonly now: () => Date;
}

/**
 * Grader 모듈을 동적으로 로드 — 모듈이 없거나 설정 불가 시 throw 하여
 * 상위에서 grader 없이 진행하도록 폴백
 */
const defaultCreateGraderClient: GraderClientFactory = () => {
  // Use require-style dynamic resolution to avoid hard compile-time dep on an
  // optional module. The grader module is owned by D3 and may not exist yet.
  // We synchronously probe via a thrown error — caller handles the catch.
  throw new Error(
    "grader module not wired: createGraderClient default stub — inject a real factory via createSkillEvalCommand.",
  );
};

/**
 * 프로덕션 기본 의존성 — 일반 실행 경로에서 사용
 */
const productionDeps: SkillEvalDeps = {
  runEvals: defaultRunEvals,
  createGraderClient: defaultCreateGraderClient,
  createProductionSpawn: defaultCreateProductionSpawn,
  fs: {
    readFile: (path, encoding) => defaultFs.readFile(path, encoding),
  },
  now: () => new Date(),
};

/**
 * 파싱 결과 — args 문자열 → 구조화된 옵션
 */
interface ParsedArgs {
  readonly name: string | undefined;
  readonly parallel: number;
  readonly includeBaseline: boolean;
  readonly parseError: string | undefined;
}

/**
 * args 문자열을 토큰화하여 스킬 이름, --parallel N, --baseline/--no-baseline 을 추출
 */
function parseArgs(raw: string): ParsedArgs {
  const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);

  let name: string | undefined;
  let parallel = 3;
  let includeBaseline = true;
  let parseError: string | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;

    if (token === "--parallel") {
      const next = tokens[i + 1];
      if (!next) {
        parseError = "--parallel requires a positive integer argument.";
        break;
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        parseError = `--parallel value '${next}' is not a positive integer.`;
        break;
      }
      parallel = parsed;
      i += 1;
      continue;
    }

    if (token === "--baseline") {
      includeBaseline = true;
      continue;
    }

    if (token === "--no-baseline") {
      includeBaseline = false;
      continue;
    }

    if (token.startsWith("--")) {
      parseError = `Unknown flag: ${token}`;
      break;
    }

    if (name === undefined) {
      name = token;
    }
  }

  return { name, parallel, includeBaseline, parseError };
}

/**
 * YAML frontmatter 제거 — `---\n...\n---\n` 을 본문 시작에서 잘라냄
 */
function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) return content;
  return content.slice(match[0].length);
}

/**
 * Short SHA256 hash — skill body 버전 추적 (history.json)
 *
 * 전체 해시의 prefix 12자만 사용하여 가독성을 확보한다.
 */
function shortHash(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

/**
 * 숫자를 퍼센트 문자열로 — "0.873" → "87.3%"
 */
function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * stddev 표시용 — "±7.1%" 형태
 */
function formatStddev(value: number): string {
  return `±${(value * 100).toFixed(1)}%`;
}

/**
 * Delta 표시 — +5%↑ / -5%↓ / ~tie
 */
function formatDelta(delta: number): string {
  const pct = delta * 100;
  if (delta >= 0.05) return `[PASS] +${pct.toFixed(1)}%`;
  if (delta <= -0.05) return `[FAIL] ${pct.toFixed(1)}%`;
  return `[TIE] ${pct.toFixed(1)}%`;
}

/**
 * 결과 배열 내에서 특정 configName 의 pass_rate / duration 통계를 찾아 요약 줄을 생성
 */
function summarizeConfigLine(
  results: readonly RawRunResult[],
  configName: string,
): string | undefined {
  const subset = results.filter((r) => r.configName === configName);
  if (subset.length === 0) return undefined;

  const passRates = subset.map((r) => {
    if (!r.grading) return 0;
    const total = r.grading.expectations.length;
    if (total === 0) return 0;
    return r.grading.expectations.filter((e) => e.passed).length / total;
  });
  const durations = subset.map((r) => r.timing.executor_duration_ms);

  const mean = passRates.reduce((a, b) => a + b, 0) / passRates.length;
  const variance =
    passRates.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / passRates.length;
  const stddev = Math.sqrt(variance);
  const meanDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  return `  ${configName}: pass_rate ${formatPct(mean)} ${formatStddev(stddev)} (mean duration ${meanDuration.toFixed(0)}ms, n=${String(subset.length)})`;
}

/**
 * Benchmark 의 delta 필드를 사람이 읽을 수 있는 문자열로 변환
 */
function formatDeltaLine(delta: { readonly pass_rate: number; readonly duration_ms: number } | undefined): string | undefined {
  if (!delta) return undefined;
  return `  delta: pass_rate ${formatDelta(delta.pass_rate)}  duration ${delta.duration_ms >= 0 ? "+" : ""}${delta.duration_ms.toFixed(0)}ms`;
}

/**
 * /skill-eval 커맨드를 DI 주입 팩토리로 생성
 *
 * 테스트에서 runEvals / createGraderClient / createProductionSpawn / fs / now
 * 를 교체 가능. 기본값은 프로덕션 실제 구현을 바인딩.
 *
 * @param overrides - 선택적으로 교체할 의존성
 * @returns SlashCommand 객체
 */
export function createSkillEvalCommand(
  overrides: Partial<SkillEvalDeps> = {},
): SlashCommand {
  const deps: SkillEvalDeps = {
    ...productionDeps,
    ...overrides,
  };

  return {
    name: "skill-eval",
    description:
      "Run evals for a dhelix skill: parallel with-skill vs baseline subagents, grade per expectation, produce benchmark.json + history. Use when the user says 'eval skill X', 'run evals', '스킬 평가', 'check skill quality'.",
    usage: "/skill-eval <skill-name> [--parallel N] [--baseline]",
    execute: async (args: string, ctx: CommandContext): Promise<CommandResult> => {
      try {
        const parsed = parseArgs(args);

        if (parsed.parseError) {
          return { output: parsed.parseError, success: false };
        }

        if (!parsed.name || parsed.name.length === 0) {
          return {
            output:
              "skill name is required. Usage: /skill-eval <skill-name> [--parallel N] [--baseline|--no-baseline]",
            success: false,
          };
        }

        if (!KEBAB_CASE_REGEX.test(parsed.name)) {
          return {
            output: `INVALID_NAME: '${parsed.name}' is not a valid kebab-case skill name. Use lowercase letters, digits, and hyphens (must start with a letter).`,
            success: false,
          };
        }

        const skillDir = join(
          ctx.workingDirectory,
          `.${APP_NAME}`,
          "skills",
          parsed.name,
        );
        const evalsPath = join(skillDir, "evals", "evals.json");
        const skillMdPath = join(skillDir, "SKILL.md");

        // --- Load evals.json -----------------------------------------------
        let evalsRaw: string;
        try {
          evalsRaw = await deps.fs.readFile(evalsPath, "utf8");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            output: `evals.json not found or unreadable at ${evalsPath}: ${msg}`,
            success: false,
          };
        }

        let evalsParsed: unknown;
        try {
          evalsParsed = JSON.parse(evalsRaw);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            output: `evals.json is not valid JSON: ${msg}`,
            success: false,
          };
        }

        const schemaResult = evalsFileSchema.safeParse(evalsParsed);
        if (!schemaResult.success) {
          const issues = schemaResult.error.issues
            .slice(0, 5)
            .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("\n");
          return {
            output: `evals.json failed schema validation:\n${issues}`,
            success: false,
          };
        }
        const evalsFile = schemaResult.data;

        // --- Load SKILL.md body (strip frontmatter) ------------------------
        let skillBody = "";
        try {
          const raw = await deps.fs.readFile(skillMdPath, "utf8");
          skillBody = stripFrontmatter(raw).trim();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            output: `SKILL.md not found or unreadable at ${skillMdPath}: ${msg}`,
            success: false,
          };
        }

        // --- Build configs -------------------------------------------------
        const configs: readonly EvalConfig[] = parsed.includeBaseline
          ? [
              { name: "with_skill", withSkill: true },
              { name: "baseline", withSkill: false },
            ]
          : [{ name: "with_skill", withSkill: true }];

        // --- Resolve spawn + grader ---------------------------------------
        const spawn = deps.createProductionSpawn();
        if (!spawn) {
          return {
            output:
              "subagent spawner unavailable — /skill-eval requires a production spawner bound to an LLM client + tool registry. See RunnerDeps.spawn in src/skills/creator/evals/runner.ts for the wiring contract.",
            success: false,
          };
        }

        let gradeCase: RunnerDeps["gradeCase"];
        try {
          gradeCase = deps.createGraderClient();
        } catch {
          // Grader not configured — proceed without; runs still persist but
          // RawRunResult.grading will be absent (benchmark pass_rate = 0).
          gradeCase = undefined;
        }

        const runnerDeps: RunnerDeps = gradeCase ? { spawn, gradeCase } : { spawn };

        // --- Compute iteration + create dirs -------------------------------
        const iteration = await nextIterationNumber(skillDir);
        const caseIds = evalsFile.cases.map((c) => c.id);
        const configNames = configs.map((c) => c.name);
        await createIteration(skillDir, iteration, caseIds, configNames);

        // --- Execute runs --------------------------------------------------
        const runOpts: RunEvalsOptions = {
          maxConcurrency: parsed.parallel,
          skillBody,
          ...(ctx as { readonly abortSignal?: AbortSignal }).abortSignal
            ? { signal: (ctx as { readonly abortSignal?: AbortSignal }).abortSignal }
            : {},
        };
        const results = await deps.runEvals(evalsFile, configs, runnerDeps, runOpts);

        // --- Persist each run ---------------------------------------------
        for (const result of results) {
          await persistRunResult(skillDir, iteration, result);
        }

        // --- Compute benchmark + persist ----------------------------------
        const benchmark = computeBenchmark(evalsFile.skill_name, iteration, results);
        const benchmarkPath = await writeBenchmark(skillDir, benchmark);

        // --- History entry -------------------------------------------------
        const gradingResult = classifyBenchmark(benchmark);
        const withSkillSummary = benchmark.configs["with_skill"];
        const expectationPassRate = withSkillSummary
          ? withSkillSummary.summary.pass_rate.mean
          : 0;

        await appendHistory(skillDir, {
          version: iteration,
          parent_version: iteration > 0 ? iteration - 1 : null,
          description: `iteration ${String(iteration)} of ${evalsFile.skill_name}`,
          skill_md_hash: shortHash(skillBody),
          expectation_pass_rate: expectationPassRate,
          grading_result: gradingResult,
          created_at: deps.now().toISOString(),
        });

        // --- Build summary output -----------------------------------------
        const lines: string[] = [];
        lines.push(
          `skill '${evalsFile.skill_name}' — iteration ${String(iteration)}`,
        );
        for (const cfg of configs) {
          const line = summarizeConfigLine(results, cfg.name);
          if (line) lines.push(line);
        }
        const deltaLine = formatDeltaLine(benchmark.delta);
        if (deltaLine) lines.push(deltaLine);
        lines.push("");
        lines.push(`benchmark: ${benchmarkPath}`);
        lines.push(`iteration dir: ${getIterationDir(skillDir, iteration)}`);
        if (!gradeCase) {
          lines.push(
            "note: grader unavailable — pass_rate reflects absent grading (0.0).",
          );
        }

        return {
          output: lines.join("\n"),
          success: true,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          output: `/skill-eval failed: ${msg}`,
          success: false,
        };
      }
    },
  };
}

/** 빌트인 레지스트리 등록용 기본 인스턴스 — 프로덕션 의존성을 사용 */
export const skillEvalCommand: SlashCommand = createSkillEvalCommand();

/**
 * 테스트 편의용 재노출 — grader/runner 가 소비하는 Grading 타입
 * (직접 import 해도 동일하나 문서 목적상 barrel 형태로 유지)
 */
export type { Grading };
