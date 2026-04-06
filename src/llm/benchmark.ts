/**
 * Local Model Benchmark Framework — 로컬 LLM 성능 측정 도구
 *
 * 로컬에서 실행 중인 LLM 모델의 성능을 다양한 측면에서 측정합니다:
 * - Tool Calling 정확도: 간단한 도구 호출 성공률
 * - Code Edit 점수: 코드 수정 정확도 (정규화 편집 거리 기반)
 * - Latency: 응답 시간 (P50, P95 백분위수)
 *
 * 이 모듈은 `src/core/`, `src/tools/` 등 상위 레이어에 의존하지 않고
 * `src/llm/` 레이어 내에서만 동작합니다.
 *
 * @example
 * ```typescript
 * const provider = new LocalModelProvider({ serverType: "ollama" });
 * const suite = new BenchmarkSuite("llama3");
 * const toolResult = await suite.runToolCallingTest(provider);
 * const codeResult = await suite.runCodeEditTest(provider);
 * const latencyResult = await suite.runLatencyTest(provider);
 * const report = suite.generateReport([toolResult, codeResult, latencyResult]);
 * console.log(report);
 * ```
 */
import type { LLMProvider } from "./provider.js";

// ─── 벤치마크 결과 인터페이스 ────────────────────────────────────────

/**
 * 단일 벤치마크 테스트 결과
 *
 * 모델의 특정 능력(도구 호출, 코드 편집, 응답 속도)을 측정한 결과를 담습니다.
 */
export interface BenchmarkResult {
  /** 테스트된 모델 이름 */
  readonly modelName: string;
  /** 도구 호출 성공률 (0~1, 선택적 — runToolCallingTest 결과) */
  readonly toolCallAccuracy?: number;
  /** 코드 편집 정확도 점수 (0~1, 선택적 — runCodeEditTest 결과) */
  readonly codeEditScore?: number;
  /** 응답 시간 중앙값 ms (선택적 — runLatencyTest 결과) */
  readonly latencyP50?: number;
  /** 응답 시간 95번째 백분위수 ms (선택적 — runLatencyTest 결과) */
  readonly latencyP95?: number;
  /** 총 벤치마크 소요 시간 ms */
  readonly totalDurationMs: number;
  /** 테스트에서 발생한 에러 목록 */
  readonly errors: readonly string[];
}

/**
 * 도구 호출 테스트 케이스
 */
interface ToolCallTestCase {
  readonly prompt: string;
  readonly expectedToolName: string;
  readonly description: string;
}

/**
 * 코드 편집 테스트 케이스
 */
interface CodeEditTestCase {
  readonly prompt: string;
  readonly originalCode: string;
  readonly expectedKeywords: readonly string[];
  readonly description: string;
}

// ─── 벤치마크 상수 ───────────────────────────────────────────────────

/** 도구 호출 테스트 케이스 목록 */
const TOOL_CALL_TEST_CASES: readonly ToolCallTestCase[] = [
  {
    prompt: "Please read the file at path '/etc/hosts' and show me its contents.",
    expectedToolName: "file_read",
    description: "File read tool call",
  },
  {
    prompt: "Search for the string 'TODO' in all TypeScript files recursively.",
    expectedToolName: "grep_search",
    description: "Grep search tool call",
  },
  {
    prompt: "List all files in the current directory.",
    expectedToolName: "list_dir",
    description: "List directory tool call",
  },
];

/** 코드 편집 테스트 케이스 목록 */
const CODE_EDIT_TEST_CASES: readonly CodeEditTestCase[] = [
  {
    prompt: "Add a TypeScript type annotation to this function: function add(a, b) { return a + b; }",
    originalCode: "function add(a, b) { return a + b; }",
    expectedKeywords: ["number", ":", "=>"],
    description: "Add TypeScript type annotations",
  },
  {
    prompt: "Convert this to an async function: function fetchData(url) { return fetch(url); }",
    originalCode: "function fetchData(url) { return fetch(url); }",
    expectedKeywords: ["async", "await", "Promise"],
    description: "Convert to async function",
  },
  {
    prompt: "Add error handling to: function divide(a, b) { return a / b; }",
    originalCode: "function divide(a, b) { return a / b; }",
    expectedKeywords: ["if", "throw", "Error"],
    description: "Add error handling",
  },
];

/** 응답 지연 측정용 단순 프롬프트 목록 */
const LATENCY_TEST_PROMPTS: readonly string[] = [
  "Say 'hello' in one word.",
  "What is 2 + 2?",
  "Name one color.",
  "Complete: The sky is",
  "Say 'done' to confirm.",
];

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────

/**
 * 두 문자열의 Levenshtein 편집 거리를 계산
 *
 * @param a - 첫 번째 문자열
 * @param b - 두 번째 문자열
 * @returns 편집 거리 (변환에 필요한 최소 연산 수)
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // dp[i][j] = a[0..i]와 b[0..j] 사이의 편집 거리
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(
          dp[i - 1]![j]!,   // 삭제
          dp[i]![j - 1]!,   // 삽입
          dp[i - 1]![j - 1]!, // 대체
        );
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * 두 문자열의 정규화된 유사도 점수를 계산 (0~1)
 *
 * 1이면 완전히 동일, 0이면 완전히 다름
 *
 * @param a - 첫 번째 문자열
 * @param b - 두 번째 문자열
 * @returns 유사도 점수 (0~1)
 */
function normalizedSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

/**
 * 백분위수 값을 계산
 *
 * @param sortedValues - 오름차순 정렬된 숫자 배열
 * @param percentile - 백분위수 (0~100)
 * @returns 해당 백분위수 값
 */
function percentile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(idx, sortedValues.length - 1))] ?? 0;
}

// ─── BenchmarkSuite 클래스 ───────────────────────────────────────────

/**
 * 로컬 LLM 벤치마크 실행기 — 모델의 다양한 성능 지표를 측정합니다
 *
 * 각 테스트는 독립적으로 실행할 수 있으며,
 * generateReport()로 모든 결과를 요약 테이블로 출력할 수 있습니다.
 *
 * @example
 * ```typescript
 * const suite = new BenchmarkSuite("llama3", { timeoutMs: 30_000 });
 * const result = await suite.runLatencyTest(provider);
 * console.log(suite.generateReport([result]));
 * ```
 */
export class BenchmarkSuite {
  private readonly modelName: string;
  private readonly timeoutMs: number;

  /**
   * @param modelName - 벤치마크할 모델 이름
   * @param options - 벤치마크 옵션
   * @param options.timeoutMs - 단일 요청 타임아웃 (기본값: 60초)
   */
  constructor(
    modelName: string,
    options?: {
      readonly timeoutMs?: number;
    },
  ) {
    this.modelName = modelName;
    this.timeoutMs = options?.timeoutMs ?? 60_000;
  }

  /**
   * 도구 호출 성공률 테스트
   *
   * 미리 정의된 도구 호출 시나리오를 실행하고,
   * 모델이 올바른 도구를 선택하는지 확인합니다.
   *
   * @param provider - 테스트할 LLM 프로바이더
   * @returns 도구 호출 정확도가 포함된 BenchmarkResult
   */
  async runToolCallingTest(provider: LLMProvider): Promise<BenchmarkResult> {
    const start = Date.now();
    const errors: string[] = [];
    let successCount = 0;
    const totalCases = TOOL_CALL_TEST_CASES.length;

    for (const testCase of TOOL_CALL_TEST_CASES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await provider.chat({
            model: this.modelName,
            messages: [{ role: "user", content: testCase.prompt }],
            tools: [
              {
                type: "function",
                function: {
                  name: "file_read",
                  description: "Read a file from the filesystem",
                  parameters: {
                    type: "object",
                    properties: {
                      path: { type: "string", description: "File path to read" },
                    },
                    required: ["path"],
                  },
                },
              },
              {
                type: "function",
                function: {
                  name: "grep_search",
                  description: "Search for patterns in files",
                  parameters: {
                    type: "object",
                    properties: {
                      pattern: { type: "string", description: "Search pattern" },
                      glob: { type: "string", description: "File glob pattern" },
                    },
                    required: ["pattern"],
                  },
                },
              },
              {
                type: "function",
                function: {
                  name: "list_dir",
                  description: "List files in a directory",
                  parameters: {
                    type: "object",
                    properties: {
                      path: { type: "string", description: "Directory path" },
                    },
                    required: ["path"],
                  },
                },
              },
            ],
            signal: controller.signal,
          });

          // 도구 호출이 있고 올바른 도구를 선택했는지 확인
          const calledTool = response.toolCalls[0]?.name;
          if (calledTool === testCase.expectedToolName) {
            successCount++;
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`[${testCase.description}] ${message}`);
      }
    }

    return {
      modelName: this.modelName,
      toolCallAccuracy: totalCases > 0 ? successCount / totalCases : 0,
      totalDurationMs: Date.now() - start,
      errors,
    };
  }

  /**
   * 코드 편집 정확도 테스트
   *
   * 코드 수정 지시를 주고 응답에 예상 키워드가 포함되어 있는지 확인합니다.
   * 정규화된 키워드 매칭 비율로 점수를 계산합니다.
   *
   * @param provider - 테스트할 LLM 프로바이더
   * @returns 코드 편집 점수가 포함된 BenchmarkResult
   */
  async runCodeEditTest(provider: LLMProvider): Promise<BenchmarkResult> {
    const start = Date.now();
    const errors: string[] = [];
    const caseScores: number[] = [];

    for (const testCase of CODE_EDIT_TEST_CASES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await provider.chat({
            model: this.modelName,
            messages: [
              {
                role: "system",
                content: "You are a code editing assistant. Respond with only the modified code, no explanations.",
              },
              {
                role: "user",
                content: `${testCase.prompt}\n\nOriginal code:\n\`\`\`\n${testCase.originalCode}\n\`\`\``,
              },
            ],
            temperature: 0,
            signal: controller.signal,
          });

          const responseText = response.content.toLowerCase();
          const matchedKeywords = testCase.expectedKeywords.filter((kw) =>
            responseText.includes(kw.toLowerCase()),
          );
          const keywordScore = matchedKeywords.length / testCase.expectedKeywords.length;

          // 응답이 원본 코드와 다른지 확인 (실제 수정이 이루어졌는지)
          const similarityToOriginal = normalizedSimilarity(
            response.content.trim(),
            testCase.originalCode.trim(),
          );
          const editScore = keywordScore * (1 - Math.max(0, similarityToOriginal - 0.5));

          caseScores.push(Math.min(1, Math.max(0, editScore)));
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`[${testCase.description}] ${message}`);
        caseScores.push(0);
      }
    }

    const avgScore =
      caseScores.length > 0
        ? caseScores.reduce((sum, s) => sum + s, 0) / caseScores.length
        : 0;

    return {
      modelName: this.modelName,
      codeEditScore: avgScore,
      totalDurationMs: Date.now() - start,
      errors,
    };
  }

  /**
   * 응답 지연 시간 테스트
   *
   * 간단한 프롬프트 여러 개를 전송하고 응답 시간을 측정합니다.
   * P50(중앙값)과 P95(95번째 백분위수)를 계산합니다.
   *
   * @param provider - 테스트할 LLM 프로바이더
   * @returns 지연 시간 통계가 포함된 BenchmarkResult
   */
  async runLatencyTest(provider: LLMProvider): Promise<BenchmarkResult> {
    const start = Date.now();
    const errors: string[] = [];
    const latencies: number[] = [];

    for (const prompt of LATENCY_TEST_PROMPTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const requestStart = Date.now();
          await provider.chat({
            model: this.modelName,
            messages: [{ role: "user", content: prompt }],
            maxTokens: 16,
            temperature: 0,
            signal: controller.signal,
          });
          latencies.push(Date.now() - requestStart);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`[Latency test] ${message}`);
      }
    }

    const sorted = [...latencies].sort((a, b) => a - b);

    return {
      modelName: this.modelName,
      latencyP50: sorted.length > 0 ? percentile(sorted, 50) : undefined,
      latencyP95: sorted.length > 0 ? percentile(sorted, 95) : undefined,
      totalDurationMs: Date.now() - start,
      errors,
    };
  }

  /**
   * 벤치마크 결과 요약 리포트 생성
   *
   * 여러 BenchmarkResult를 합쳐서 사람이 읽기 쉬운 테이블 형식으로 출력합니다.
   * 각 메트릭은 퍼센트 또는 ms 단위로 포맷됩니다.
   *
   * @param results - 합칠 BenchmarkResult 배열
   * @returns 리포트 문자열 (콘솔 출력용)
   *
   * @example 출력 형식:
   * ```
   * ═══════════════════════════════════════════════
   * Benchmark Report: llama3
   * ═══════════════════════════════════════════════
   * Model           : llama3
   * Tool Accuracy   : 66.7%
   * Code Edit Score : 45.2%
   * Latency P50     : 342 ms
   * Latency P95     : 891 ms
   * Total Duration  : 12,450 ms
   * Errors          : 1
   * ───────────────────────────────────────────────
   * [Error] Request timeout
   * ═══════════════════════════════════════════════
   * ```
   */
  generateReport(results: readonly BenchmarkResult[]): string {
    // 여러 결과를 병합
    const merged = mergeResults(results, this.modelName);

    const lines: string[] = [
      "═══════════════════════════════════════════════",
      `Benchmark Report: ${merged.modelName}`,
      "═══════════════════════════════════════════════",
      `${"Model".padEnd(16)}: ${merged.modelName}`,
    ];

    if (merged.toolCallAccuracy !== undefined) {
      lines.push(
        `${"Tool Accuracy".padEnd(16)}: ${(merged.toolCallAccuracy * 100).toFixed(1)}%`,
      );
    }

    if (merged.codeEditScore !== undefined) {
      lines.push(
        `${"Code Edit Score".padEnd(16)}: ${(merged.codeEditScore * 100).toFixed(1)}%`,
      );
    }

    if (merged.latencyP50 !== undefined) {
      lines.push(`${"Latency P50".padEnd(16)}: ${merged.latencyP50.toFixed(0)} ms`);
    }

    if (merged.latencyP95 !== undefined) {
      lines.push(`${"Latency P95".padEnd(16)}: ${merged.latencyP95.toFixed(0)} ms`);
    }

    lines.push(
      `${"Total Duration".padEnd(16)}: ${merged.totalDurationMs.toLocaleString()} ms`,
    );
    lines.push(`${"Errors".padEnd(16)}: ${merged.errors.length}`);

    if (merged.errors.length > 0) {
      lines.push("───────────────────────────────────────────────");
      for (const err of merged.errors) {
        lines.push(`[Error] ${err}`);
      }
    }

    lines.push("═══════════════════════════════════════════════");

    return lines.join("\n");
  }
}

// ─── 결과 병합 헬퍼 ──────────────────────────────────────────────────

/**
 * 여러 BenchmarkResult를 하나로 병합
 *
 * 각 결과에서 정의된 필드만 사용하며,
 * 중복 필드가 있으면 마지막 값을 사용합니다.
 *
 * @param results - 병합할 결과 배열
 * @param modelName - 모델 이름 (폴백용)
 * @returns 병합된 BenchmarkResult
 */
export function mergeResults(
  results: readonly BenchmarkResult[],
  modelName: string,
): BenchmarkResult {
  if (results.length === 0) {
    return {
      modelName,
      totalDurationMs: 0,
      errors: [],
    };
  }

  let toolCallAccuracy: number | undefined;
  let codeEditScore: number | undefined;
  let latencyP50: number | undefined;
  let latencyP95: number | undefined;
  let totalDurationMs = 0;
  const allErrors: string[] = [];

  for (const result of results) {
    if (result.toolCallAccuracy !== undefined) {
      toolCallAccuracy = result.toolCallAccuracy;
    }
    if (result.codeEditScore !== undefined) {
      codeEditScore = result.codeEditScore;
    }
    if (result.latencyP50 !== undefined) {
      latencyP50 = result.latencyP50;
    }
    if (result.latencyP95 !== undefined) {
      latencyP95 = result.latencyP95;
    }
    totalDurationMs += result.totalDurationMs;
    allErrors.push(...result.errors);
  }

  return {
    modelName: results[0]?.modelName ?? modelName,
    toolCallAccuracy,
    codeEditScore,
    latencyP50,
    latencyP95,
    totalDurationMs,
    errors: allErrors,
  };
}
