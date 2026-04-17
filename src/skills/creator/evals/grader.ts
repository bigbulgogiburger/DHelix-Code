/**
 * Eval grader — LLM-as-judge 채점기
 *
 * 계획서 §9.4 참조. 한 expectation 당 한 번의 LLM 호출로 pass/fail + evidence + reasoning 생성.
 *
 * 주요 책임:
 * - `createGraderClient` — 프로젝트의 기존 `createLLMClientForModel` 팩토리를
 *   감싼 채점 전용 어댑터 생성 (기본 모델 = Claude Haiku 계열)
 * - `gradeCase` — EvalCase 의 모든 expectation 을 병렬로 채점 + expected_output_contains/excludes
 *   기반 결정론적 substring 체크를 보너스로 주입
 *
 * 설계 원칙:
 * - 새로운 HTTP 클라이언트를 만들지 않는다 — `src/llm/client-factory.ts` 의
 *   `createLLMClientForModel` 을 그대로 재사용
 * - Zod 스키마로 응답 파싱 (`gradedExpectationSchema`)
 * - 모든 async 경계에서 AbortSignal 전파
 * - 외부 입력은 `unknown` → 타입 가드 / 수동 파싱으로 안전하게 처리
 */

import { LLM_DEFAULTS } from "../../../constants.js";
import { createLLMClientForModel } from "../../../llm/client-factory.js";
import type { ChatMessage, LLMProvider } from "../../../llm/provider.js";
import {
  type EvalCase,
  type GradedExpectation,
  type Grading,
} from "./types.js";

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

/**
 * 기본 채점 모델 — Haiku 계열 (저렴하고 빠름)
 *
 * 프로젝트에 "haiku tier" 를 선택하는 단일 헬퍼가 아직 없으므로,
 * `src/subagents/spawner.ts` 의 MODEL_ALIAS_MAP 과 동일한 문자열을 사용합니다.
 * 사용자가 명시적으로 `opts.model` 을 전달하면 그 값을 우선 사용합니다.
 */
const DEFAULT_GRADER_MODEL = "claude-haiku-4-5-20251001";

/** 기본 temperature — 채점은 결정적이어야 하므로 0 */
const DEFAULT_TEMPERATURE = 0;

/** 기본 maxTokens — reasoning 1-2 문장 + evidence 인용 정도면 충분 */
const DEFAULT_MAX_TOKENS = 512;

/** 병렬 채점 기본 동시 실행 수 — Spawner resource limit 과 맞춤 */
const DEFAULT_PARALLEL = 3;

/** substring 증거 윈도우 크기 (매칭 지점 기준 좌우 포함) */
const SUBSTRING_WINDOW = 40;

// ---------------------------------------------------------------------------
// 프롬프트 템플릿
// ---------------------------------------------------------------------------

const JUDGE_SYSTEM_PROMPT = [
  "You are a strict but fair evaluator. Your job is to decide whether a single",
  "expectation is satisfied by the output of a coding assistant.",
  "",
  "Rules:",
  "- Answer ONLY with a JSON object of the form:",
  '  {"passed": <boolean>, "evidence": <string>, "reasoning": <string>}',
  "- `passed` is true iff the expectation is clearly supported by the output.",
  "- `evidence` is a short quote or paraphrase from the output (<=200 chars).",
  "- `reasoning` is 1-2 sentences explaining the verdict.",
  "- Do not include Markdown fences, commentary, or any text outside the JSON.",
].join("\n");

const buildUserPrompt = (args: {
  readonly prompt: string;
  readonly output: string;
  readonly expectation: string;
}): string =>
  [
    "# Original Prompt",
    args.prompt,
    "",
    "# Assistant Output",
    args.output,
    "",
    "# Expectation to verify",
    args.expectation,
    "",
    "Respond now with the JSON verdict.",
  ].join("\n");

// ---------------------------------------------------------------------------
// Public API — interfaces
// ---------------------------------------------------------------------------

/**
 * 채점기 클라이언트 — 한 expectation 에 대한 LLM-as-judge 판정을 제공한다.
 *
 * 구현체는 LLM 을 호출하므로 `signal` 을 반드시 존중해야 한다.
 */
export interface GraderClient {
  grade(args: {
    readonly prompt: string;
    readonly output: string;
    readonly expectation: string;
    readonly signal?: AbortSignal;
  }): Promise<GradedExpectation>;
}

/** `createGraderClient` 옵션 */
export interface CreateGraderClientOptions {
  /** 사용할 모델 식별자 (기본: Haiku 계열) */
  readonly model?: string;
  /** temperature (기본: 0) */
  readonly temperature?: number;
  /** max tokens (기본: 512) */
  readonly maxTokens?: number;
}

// ---------------------------------------------------------------------------
// createGraderClient
// ---------------------------------------------------------------------------

/**
 * 채점기 클라이언트 생성 — 프로젝트의 `createLLMClientForModel` 을 그대로 재사용한다.
 *
 * 환경변수(`LLM_DEFAULTS.baseUrl` / `*API_KEY`)로부터 base URL / key 를 읽어 단일
 * `LLMProvider` 인스턴스를 만들고, 이를 `GraderClient` 인터페이스로 감쌉니다.
 *
 * @param opts - 모델 / temperature / maxTokens 오버라이드
 * @returns `GraderClient` 인스턴스
 */
export function createGraderClient(
  opts?: CreateGraderClientOptions,
): GraderClient {
  const model = opts?.model ?? DEFAULT_GRADER_MODEL;
  const temperature = opts?.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_TOKENS;

  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.LOCAL_API_KEY ||
    process.env.DHELIX_API_KEY ||
    "";

  const provider: LLMProvider = createLLMClientForModel({
    model,
    baseURL: LLM_DEFAULTS.baseUrl,
    apiKey,
    timeout: 120_000,
  });

  return {
    grade: async (args) =>
      gradeViaProvider({
        provider,
        model,
        temperature,
        maxTokens,
        prompt: args.prompt,
        output: args.output,
        expectation: args.expectation,
        signal: args.signal,
      }),
  };
}

// ---------------------------------------------------------------------------
// LLM 호출 + 응답 파싱 (내부)
// ---------------------------------------------------------------------------

interface ProviderGradeArgs {
  readonly provider: LLMProvider;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly prompt: string;
  readonly output: string;
  readonly expectation: string;
  readonly signal?: AbortSignal;
}

async function gradeViaProvider(args: ProviderGradeArgs): Promise<GradedExpectation> {
  if (args.signal?.aborted) {
    throw toAbortError(args.signal.reason);
  }

  const messages: readonly ChatMessage[] = [
    { role: "system", content: JUDGE_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildUserPrompt({
        prompt: args.prompt,
        output: args.output,
        expectation: args.expectation,
      }),
    },
  ];

  const response = await args.provider.chat({
    model: args.model,
    messages,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
    signal: args.signal,
  });

  return parseJudgeResponse(args.expectation, response.content);
}

/**
 * LLM 이 반환한 원시 텍스트를 `GradedExpectation` 으로 파싱.
 *
 * 유효 JSON 이 아니거나 `passed` 필드가 없으면 실패로 간주하고 그 사실을
 * `evidence` / `reasoning` 에 기록합니다.
 */
function parseJudgeResponse(
  expectation: string,
  raw: string,
): GradedExpectation {
  const extracted = extractJsonObject(raw);
  if (!extracted) {
    return {
      text: expectation,
      passed: false,
      evidence: "grader returned non-JSON",
      reasoning: `raw response could not be parsed as JSON: ${truncate(raw, 160)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch (err) {
    return {
      text: expectation,
      passed: false,
      evidence: "grader returned non-JSON",
      reasoning: `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!isRecord(parsed)) {
    return {
      text: expectation,
      passed: false,
      evidence: "grader returned non-JSON",
      reasoning: "parsed value was not a JSON object",
    };
  }

  const passed = parsed["passed"];
  if (typeof passed !== "boolean") {
    return {
      text: expectation,
      passed: false,
      evidence:
        typeof parsed["evidence"] === "string" ? parsed["evidence"] : "missing `passed` field",
      reasoning:
        typeof parsed["reasoning"] === "string"
          ? parsed["reasoning"]
          : "grader response missing boolean `passed` field",
    };
  }

  const evidenceVal = parsed["evidence"];
  const reasoningVal = parsed["reasoning"];

  return {
    text: expectation,
    passed,
    evidence: typeof evidenceVal === "string" ? evidenceVal : "",
    reasoning: typeof reasoningVal === "string" ? reasoningVal : "",
  };
}

/**
 * 응답 문자열에서 첫 번째 JSON 객체를 추출 — 코드펜스 / 앞뒤 잡음 허용.
 *
 * 전략:
 * 1. ```json ... ``` 펜스가 있으면 그 내부를 우선 채택
 * 2. 없으면 첫 `{` 부터 마지막 `}` 까지 잘라서 반환
 * 3. 둘 다 없으면 undefined
 */
function extractJsonObject(raw: string): string | undefined {
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenceMatch && fenceMatch[1]) {
    const inside = fenceMatch[1].trim();
    if (inside.startsWith("{") && inside.endsWith("}")) {
      return inside;
    }
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return undefined;
  return raw.slice(first, last + 1).trim();
}

// ---------------------------------------------------------------------------
// gradeCase — EvalCase 전체 채점
// ---------------------------------------------------------------------------

/**
 * 하나의 EvalCase 에 대해 모든 expectation 을 병렬(최대 `parallel` 개) 로 채점한다.
 *
 * - LLM 채점 실패(예외) 는 해당 expectation 을 `passed=false` + evidence=에러 메시지로 기록
 * - `expected_output_contains` / `expected_output_excludes` 가 있으면 결정론적 substring
 *   채점을 **추가** expectation 으로 append (LLM 호출 없음)
 * - signal 이 이미 aborted 거나 채점 중 abort 되면 AbortError 로 reject
 *
 * 반환값은 `types.ts` 의 `gradingSchema` 를 만족한다.
 */
export async function gradeCase(args: {
  readonly caseData: EvalCase;
  readonly output: string;
  readonly grader: GraderClient;
  readonly signal?: AbortSignal;
  readonly parallel?: number;
}): Promise<Grading> {
  const { caseData, output, grader } = args;
  const signal = args.signal;
  const parallel = Math.max(1, args.parallel ?? DEFAULT_PARALLEL);

  if (signal?.aborted) {
    throw toAbortError(signal.reason);
  }

  const expectations = caseData.expectations;
  // 인덱스-보존 병렬 실행 (Promise.all 의 순서를 그대로 사용)
  const llmGraded: GradedExpectation[] = new Array<GradedExpectation>(expectations.length);

  await runWithConcurrency(expectations.length, parallel, async (idx) => {
    if (signal?.aborted) {
      throw toAbortError(signal.reason);
    }
    const expectation = expectations[idx];
    if (expectation === undefined) {
      // 인덱스 가드 — 사실상 unreachable 이지만 noUncheckedIndexedAccess 대응
      llmGraded[idx] = {
        text: "",
        passed: false,
        evidence: "internal: missing expectation",
        reasoning: "array bounds violation",
      };
      return;
    }
    try {
      const result = await grader.grade({
        prompt: caseData.prompt,
        output,
        expectation,
        signal,
      });
      llmGraded[idx] = result;
    } catch (err) {
      if (isAbortError(err)) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      llmGraded[idx] = {
        text: expectation,
        passed: false,
        evidence: `grader error: ${truncate(message, 160)}`,
        reasoning: `grader threw: ${message}`,
      };
    }
  });

  // 결정론적 substring 채점 (보너스)
  const substringGraded: GradedExpectation[] = [
    ...buildContainsChecks(output, caseData.expected_output_contains),
    ...buildExcludesChecks(output, caseData.expected_output_excludes),
  ];

  return {
    case_id: caseData.id,
    expectations: [...llmGraded, ...substringGraded],
  };
}

// ---------------------------------------------------------------------------
// 결정론적 substring 채점
// ---------------------------------------------------------------------------

function buildContainsChecks(
  output: string,
  needles: readonly string[] | undefined,
): GradedExpectation[] {
  if (!needles || needles.length === 0) return [];
  return needles.map((needle) => {
    const idx = output.indexOf(needle);
    const passed = idx !== -1;
    return {
      text: `[substring-contains] ${needle}`,
      passed,
      evidence: passed ? extractWindow(output, idx, needle.length) : "",
      reasoning: passed
        ? "substring found in output"
        : "substring not found in output",
    };
  });
}

function buildExcludesChecks(
  output: string,
  needles: readonly string[] | undefined,
): GradedExpectation[] {
  if (!needles || needles.length === 0) return [];
  return needles.map((needle) => {
    const idx = output.indexOf(needle);
    const found = idx !== -1;
    const passed = !found;
    return {
      text: `[substring-excludes] ${needle}`,
      passed,
      evidence: found ? extractWindow(output, idx, needle.length) : "",
      reasoning: found
        ? "forbidden substring found in output"
        : "forbidden substring correctly absent",
    };
  });
}

/**
 * 매칭 지점 주변 ~40 글자 윈도우 추출 — 증거 인용용.
 */
function extractWindow(source: string, matchStart: number, matchLen: number): string {
  const half = Math.max(0, Math.floor((SUBSTRING_WINDOW - matchLen) / 2));
  const start = Math.max(0, matchStart - half);
  const end = Math.min(source.length, matchStart + matchLen + half);
  return source.slice(start, end);
}

// ---------------------------------------------------------------------------
// 동시성 풀 — p-limit 없이 수동 구현
// ---------------------------------------------------------------------------

/**
 * `count` 개의 작업 슬롯(0..count-1)을 `limit` 개 동시 실행으로 처리한다.
 *
 * 하나라도 reject 하면 나머지 작업을 기다린 뒤 첫 에러로 reject.
 * (Promise.all 과 유사한 의미, 다만 실행 중인 나머지는 cancellation 받지 못함 —
 *  signal 을 통해 전파됨)
 */
async function runWithConcurrency(
  count: number,
  limit: number,
  worker: (index: number) => Promise<void>,
): Promise<void> {
  if (count === 0) return;
  const effectiveLimit = Math.min(limit, count);
  let nextIndex = 0;
  let firstError: unknown;

  const launchSlot = async (): Promise<void> => {
    while (true) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= count) return;
      try {
        await worker(idx);
      } catch (err) {
        if (firstError === undefined) firstError = err;
        // 계속 진행하여 다른 슬롯의 결과를 기다림 — 메모리 누수 방지.
        // 최종에 firstError 를 throw.
      }
    }
  };

  const slots: Promise<void>[] = [];
  for (let i = 0; i < effectiveLimit; i += 1) {
    slots.push(launchSlot());
  }
  await Promise.all(slots);
  if (firstError !== undefined) throw firstError;
}

// ---------------------------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 3)}...`;
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || (err as Error & { code?: string }).code === "ABORT_ERR")
  );
}

function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  const err = new Error(typeof reason === "string" ? reason : "Aborted");
  err.name = "AbortError";
  return err;
}

