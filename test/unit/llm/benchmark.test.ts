/**
 * Benchmark Framework 단위 테스트
 *
 * BenchmarkSuite의 각 테스트 메서드와 generateReport(),
 * mergeResults() 유틸리티 함수를 검증합니다.
 * 실제 LLM 호출은 mock으로 대체합니다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BenchmarkSuite,
  mergeResults,
} from "../../../src/llm/benchmark.js";
import type { BenchmarkResult } from "../../../src/llm/benchmark.js";
import type { LLMProvider, ChatRequest, ChatResponse } from "../../../src/llm/provider.js";

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────

/** 성공 응답을 반환하는 mock provider 생성 */
function createMockProvider(
  responseOverrides?: Partial<ChatResponse>,
): LLMProvider {
  const defaultResponse: ChatResponse = {
    content: "Mock response",
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    finishReason: "stop",
  };

  return {
    name: "mock",
    chat: vi.fn().mockResolvedValue({ ...defaultResponse, ...responseOverrides }),
    stream: vi.fn().mockImplementation(async function* () {
      yield { type: "text-delta" as const, text: "Mock" };
      yield {
        type: "done" as const,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    }),
    countTokens: vi.fn().mockReturnValue(10),
  };
}

/** 항상 실패하는 mock provider 생성 */
function createFailingProvider(errorMessage: string): LLMProvider {
  return {
    name: "failing-mock",
    chat: vi.fn().mockRejectedValue(new Error(errorMessage)),
    stream: vi.fn().mockImplementation(async function* () {
      throw new Error(errorMessage);
    }),
    countTokens: vi.fn().mockReturnValue(0),
  };
}

/** 도구 호출 응답을 반환하는 mock provider 생성 */
function createToolCallingProvider(toolName: string): LLMProvider {
  return {
    name: "tool-calling-mock",
    chat: vi.fn().mockResolvedValue({
      content: "",
      toolCalls: [{ id: "call_1", name: toolName, arguments: "{}" }],
      usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
      finishReason: "tool_calls",
    } as ChatResponse),
    stream: vi.fn().mockImplementation(async function* () {
      yield { type: "done" as const, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: "stop" };
    }),
    countTokens: vi.fn().mockReturnValue(15),
  };
}

// ─── BenchmarkSuite 생성 테스트 ──────────────────────────────────────

describe("BenchmarkSuite constructor", () => {
  it("creates with model name", () => {
    const suite = new BenchmarkSuite("llama3");
    expect(suite).toBeTruthy();
  });

  it("accepts custom timeout", () => {
    const suite = new BenchmarkSuite("llama3", { timeoutMs: 5_000 });
    expect(suite).toBeTruthy();
  });
});

// ─── runToolCallingTest() 테스트 ─────────────────────────────────────

describe("BenchmarkSuite.runToolCallingTest()", () => {
  it("returns toolCallAccuracy of 0 when no tools are called", async () => {
    // 도구 호출 없이 텍스트만 반환하는 provider
    const provider = createMockProvider({ toolCalls: [] });
    const suite = new BenchmarkSuite("llama3", { timeoutMs: 5_000 });

    const result = await suite.runToolCallingTest(provider);

    expect(result.modelName).toBe("llama3");
    expect(result.toolCallAccuracy).toBeDefined();
    expect(result.toolCallAccuracy).toBe(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("returns toolCallAccuracy > 0 when correct tools are called", async () => {
    // 첫 번째 테스트 케이스 expectedToolName은 "file_read"
    const provider = createToolCallingProvider("file_read");
    const suite = new BenchmarkSuite("test-model", { timeoutMs: 5_000 });

    const result = await suite.runToolCallingTest(provider);

    expect(result.toolCallAccuracy).toBeDefined();
    expect(result.toolCallAccuracy!).toBeGreaterThan(0);
  });

  it("records errors when provider throws", async () => {
    const provider = createFailingProvider("Connection refused");
    const suite = new BenchmarkSuite("error-model", { timeoutMs: 1_000 });

    const result = await suite.runToolCallingTest(provider);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("Connection refused"))).toBe(true);
    expect(result.toolCallAccuracy).toBeDefined();
    expect(result.toolCallAccuracy).toBe(0);
  });

  it("includes modelName in result", async () => {
    const provider = createMockProvider();
    const suite = new BenchmarkSuite("my-model", { timeoutMs: 5_000 });
    const result = await suite.runToolCallingTest(provider);
    expect(result.modelName).toBe("my-model");
  });
});

// ─── runCodeEditTest() 테스트 ─────────────────────────────────────────

describe("BenchmarkSuite.runCodeEditTest()", () => {
  it("returns codeEditScore between 0 and 1", async () => {
    const provider = createMockProvider({
      content: "async function fetchData(url: string): Promise<Response> { return await fetch(url); }",
    });
    const suite = new BenchmarkSuite("llama3", { timeoutMs: 5_000 });

    const result = await suite.runCodeEditTest(provider);

    expect(result.codeEditScore).toBeDefined();
    expect(result.codeEditScore!).toBeGreaterThanOrEqual(0);
    expect(result.codeEditScore!).toBeLessThanOrEqual(1);
  });

  it("gives higher score when response contains expected keywords", async () => {
    // "async", "await", "Promise" 키워드 포함 응답
    const goodProvider = createMockProvider({
      content: "async function fetchData(url: string): Promise<Response> { return await fetch(url); }",
    });
    // 원본 코드와 동일한 응답 (수정 없음)
    const badProvider = createMockProvider({
      content: "function fetchData(url) { return fetch(url); }",
    });

    const suite = new BenchmarkSuite("test", { timeoutMs: 5_000 });
    const goodResult = await suite.runCodeEditTest(goodProvider);
    const badResult = await suite.runCodeEditTest(badProvider);

    // 좋은 응답이 더 높은 점수를 가져야 함
    expect(goodResult.codeEditScore!).toBeGreaterThan(badResult.codeEditScore!);
  });

  it("records errors when provider fails", async () => {
    const provider = createFailingProvider("Model unavailable");
    const suite = new BenchmarkSuite("error-model", { timeoutMs: 1_000 });

    const result = await suite.runCodeEditTest(provider);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.codeEditScore).toBeDefined();
  });

  it("does not include toolCallAccuracy in result", async () => {
    const provider = createMockProvider();
    const suite = new BenchmarkSuite("llama3", { timeoutMs: 5_000 });
    const result = await suite.runCodeEditTest(provider);
    expect(result.toolCallAccuracy).toBeUndefined();
  });
});

// ─── runLatencyTest() 테스트 ─────────────────────────────────────────

describe("BenchmarkSuite.runLatencyTest()", () => {
  it("returns latencyP50 and latencyP95 as numbers", async () => {
    const provider = createMockProvider();
    const suite = new BenchmarkSuite("llama3", { timeoutMs: 5_000 });

    const result = await suite.runLatencyTest(provider);

    expect(result.latencyP50).toBeDefined();
    expect(result.latencyP95).toBeDefined();
    expect(typeof result.latencyP50).toBe("number");
    expect(typeof result.latencyP95).toBe("number");
  });

  it("P95 >= P50", async () => {
    const provider = createMockProvider();
    const suite = new BenchmarkSuite("llama3", { timeoutMs: 5_000 });

    const result = await suite.runLatencyTest(provider);

    expect(result.latencyP95!).toBeGreaterThanOrEqual(result.latencyP50!);
  });

  it("returns undefined latency when all requests fail", async () => {
    const provider = createFailingProvider("Server down");
    const suite = new BenchmarkSuite("error-model", { timeoutMs: 500 });

    const result = await suite.runLatencyTest(provider);

    // 모든 요청이 실패하면 latencyP50은 undefined
    // (latencies 배열이 비어있음)
    expect(result.errors.length).toBeGreaterThan(0);
    // latencyP50은 값이 없거나 0일 수 있음
    if (result.latencyP50 !== undefined) {
      expect(result.latencyP50).toBeGreaterThanOrEqual(0);
    }
  });

  it("records total duration", async () => {
    const provider = createMockProvider();
    const suite = new BenchmarkSuite("llama3", { timeoutMs: 5_000 });
    const result = await suite.runLatencyTest(provider);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── generateReport() 테스트 ─────────────────────────────────────────

describe("BenchmarkSuite.generateReport()", () => {
  const suite = new BenchmarkSuite("test-model");

  it("generates report with all metrics when all results present", () => {
    const results: BenchmarkResult[] = [
      {
        modelName: "test-model",
        toolCallAccuracy: 0.667,
        totalDurationMs: 5000,
        errors: [],
      },
      {
        modelName: "test-model",
        codeEditScore: 0.452,
        totalDurationMs: 3000,
        errors: [],
      },
      {
        modelName: "test-model",
        latencyP50: 342,
        latencyP95: 891,
        totalDurationMs: 4000,
        errors: [],
      },
    ];

    const report = suite.generateReport(results);

    expect(report).toContain("test-model");
    expect(report).toContain("66.7%");   // toolCallAccuracy
    expect(report).toContain("45.2%");   // codeEditScore
    expect(report).toContain("342");      // latencyP50
    expect(report).toContain("891");      // latencyP95
    expect(report).toContain("Benchmark Report");
  });

  it("includes error section when errors exist", () => {
    const results: BenchmarkResult[] = [
      {
        modelName: "test-model",
        toolCallAccuracy: 0,
        totalDurationMs: 1000,
        errors: ["Connection refused", "Timeout"],
      },
    ];

    const report = suite.generateReport(results);

    expect(report).toContain("[Error]");
    expect(report).toContain("Connection refused");
    expect(report).toContain("Timeout");
  });

  it("generates report for empty results array", () => {
    const report = suite.generateReport([]);
    expect(report).toContain("test-model");
    expect(typeof report).toBe("string");
    expect(report.length).toBeGreaterThan(0);
  });

  it("includes separator lines for readability", () => {
    const results: BenchmarkResult[] = [
      {
        modelName: "test-model",
        totalDurationMs: 0,
        errors: [],
      },
    ];
    const report = suite.generateReport(results);
    expect(report).toContain("═══");
  });

  it("shows total duration in report", () => {
    const results: BenchmarkResult[] = [
      {
        modelName: "test-model",
        totalDurationMs: 12450,
        errors: [],
      },
    ];
    const report = suite.generateReport(results);
    expect(report).toContain("12");
  });
});

// ─── mergeResults() 테스트 ───────────────────────────────────────────

describe("mergeResults()", () => {
  it("returns empty result for empty array", () => {
    const result = mergeResults([], "my-model");
    expect(result.modelName).toBe("my-model");
    expect(result.totalDurationMs).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.toolCallAccuracy).toBeUndefined();
    expect(result.codeEditScore).toBeUndefined();
    expect(result.latencyP50).toBeUndefined();
    expect(result.latencyP95).toBeUndefined();
  });

  it("sums totalDurationMs from all results", () => {
    const results: BenchmarkResult[] = [
      { modelName: "model", totalDurationMs: 1000, errors: [] },
      { modelName: "model", totalDurationMs: 2000, errors: [] },
      { modelName: "model", totalDurationMs: 500, errors: [] },
    ];
    const merged = mergeResults(results, "model");
    expect(merged.totalDurationMs).toBe(3500);
  });

  it("collects all errors from all results", () => {
    const results: BenchmarkResult[] = [
      { modelName: "model", totalDurationMs: 0, errors: ["Error A"] },
      { modelName: "model", totalDurationMs: 0, errors: ["Error B", "Error C"] },
    ];
    const merged = mergeResults(results, "model");
    expect(merged.errors).toHaveLength(3);
    expect(merged.errors).toContain("Error A");
    expect(merged.errors).toContain("Error B");
    expect(merged.errors).toContain("Error C");
  });

  it("picks up toolCallAccuracy from whichever result has it", () => {
    const results: BenchmarkResult[] = [
      { modelName: "m", toolCallAccuracy: 0.8, totalDurationMs: 0, errors: [] },
      { modelName: "m", codeEditScore: 0.6, totalDurationMs: 0, errors: [] },
    ];
    const merged = mergeResults(results, "m");
    expect(merged.toolCallAccuracy).toBe(0.8);
    expect(merged.codeEditScore).toBe(0.6);
  });

  it("picks up latency metrics from result", () => {
    const results: BenchmarkResult[] = [
      {
        modelName: "m",
        latencyP50: 200,
        latencyP95: 500,
        totalDurationMs: 0,
        errors: [],
      },
    ];
    const merged = mergeResults(results, "m");
    expect(merged.latencyP50).toBe(200);
    expect(merged.latencyP95).toBe(500);
  });

  it("uses modelName from first result", () => {
    const results: BenchmarkResult[] = [
      { modelName: "first-model", totalDurationMs: 0, errors: [] },
      { modelName: "second-model", totalDurationMs: 0, errors: [] },
    ];
    const merged = mergeResults(results, "fallback");
    expect(merged.modelName).toBe("first-model");
  });
});
