import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRequest, ChatResponse, LLMProvider } from "../../../../../src/llm/provider.js";

// ---- Mock createLLMClientForModel BEFORE importing grader ------------------
const mockProviderChat = vi.fn<(req: ChatRequest) => Promise<ChatResponse>>();

vi.mock("../../../../../src/llm/client-factory.js", () => ({
  createLLMClientForModel: vi.fn(
    (): LLMProvider => ({
      name: "mock",
      chat: mockProviderChat,
      stream: vi.fn(async function* () {
        // no-op
      }),
      countTokens: () => 10,
    }),
  ),
}));

import {
  createGraderClient,
  gradeCase,
  type GraderClient,
} from "../../../../../src/skills/creator/evals/grader.js";
import type {
  EvalCase,
  GradedExpectation,
} from "../../../../../src/skills/creator/evals/types.js";

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const makeCase = (overrides: Partial<EvalCase> = {}): EvalCase => ({
  id: "case-1",
  prompt: "Write a function that adds two numbers",
  expectations: [
    "mentions a function named 'add'",
    "returns a number",
    "handles two arguments",
  ],
  trigger_only: false,
  should_trigger: true,
  ...overrides,
});

const makeGraded = (
  text: string,
  passed: boolean,
  evidence = "quoted",
  reasoning = "ok",
): GradedExpectation => ({ text, passed, evidence, reasoning });

/**
 * 시퀀스 기반 스텁 grader — 매 호출마다 `responses[i]` 를 반환.
 * 부족하면 마지막 값을 반복.
 */
function stubGraderWithSequence(
  responses: ReadonlyArray<GradedExpectation | Error>,
): GraderClient & {
  readonly calls: ReadonlyArray<{ expectation: string; prompt: string }>;
} {
  let i = 0;
  const calls: Array<{ expectation: string; prompt: string }> = [];
  return {
    calls,
    grade: vi.fn(async (args) => {
      calls.push({ expectation: args.expectation, prompt: args.prompt });
      const next = responses[Math.min(i, responses.length - 1)] ?? responses[0];
      i += 1;
      if (next instanceof Error) throw next;
      if (!next) throw new Error("no stub response configured");
      return next;
    }),
  };
}

// ---------------------------------------------------------------------------
// createGraderClient — shape only (no network)
// ---------------------------------------------------------------------------

describe("createGraderClient", () => {
  beforeEach(() => {
    mockProviderChat.mockReset();
  });

  it("returns an object exposing a grade() method", () => {
    const client = createGraderClient();
    expect(client).toBeDefined();
    expect(typeof client.grade).toBe("function");
  });

  it("accepts custom options without throwing", () => {
    const client = createGraderClient({
      model: "claude-haiku-4-5-20251001",
      temperature: 0,
      maxTokens: 256,
    });
    expect(typeof client.grade).toBe("function");
  });

  const makeChatResponse = (content: string): ChatResponse => ({
    content,
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: "stop",
  });

  it("parses a well-formed JSON verdict from the LLM", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse(
        '{"passed": true, "evidence": "function add exists", "reasoning": "clearly defined"}',
      ),
    );
    const client = createGraderClient({ model: "claude-haiku-4-5-20251001" });
    const result = await client.grade({
      prompt: "write add fn",
      output: "function add(a,b){return a+b}",
      expectation: "defines add",
    });
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain("function add");
    expect(result.reasoning).toContain("clearly");
    expect(result.text).toBe("defines add");
  });

  it("extracts JSON from inside a ```json code fence", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse(
        'Here is my verdict:\n```json\n{"passed": false, "evidence": "no fn", "reasoning": "missing"}\n```\nDone.',
      ),
    );
    const client = createGraderClient();
    const result = await client.grade({
      prompt: "p",
      output: "o",
      expectation: "E",
    });
    expect(result.passed).toBe(false);
    expect(result.evidence).toBe("no fn");
  });

  it("falls back to first-brace extraction when no code fence is present", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse(
        'I think: {"passed": true, "evidence": "ok", "reasoning": "reason"} trailing junk',
      ),
    );
    const client = createGraderClient();
    const result = await client.grade({
      prompt: "p",
      output: "o",
      expectation: "E",
    });
    expect(result.passed).toBe(true);
    expect(result.evidence).toBe("ok");
  });

  it("treats a response with no JSON at all as failed", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse("I think it passed, honestly."),
    );
    const client = createGraderClient();
    const result = await client.grade({
      prompt: "p",
      output: "o",
      expectation: "E",
    });
    expect(result.passed).toBe(false);
    expect(result.evidence).toBe("grader returned non-JSON");
    expect(result.reasoning).toContain("could not be parsed");
  });

  it("treats malformed JSON (syntax error) as failed with JSON.parse reason", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse('{"passed": true, "evidence": "ok", broken'),
    );
    const client = createGraderClient();
    const result = await client.grade({
      prompt: "p",
      output: "o",
      expectation: "E",
    });
    expect(result.passed).toBe(false);
    expect(result.reasoning.toLowerCase()).toMatch(/json\.parse|could not be parsed/);
  });

  it("treats a JSON array (non-object) as failed", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse('["passed", true]'),
    );
    const client = createGraderClient();
    const result = await client.grade({
      prompt: "p",
      output: "o",
      expectation: "E",
    });
    // The array still begins with '[' so first-brace extraction finds nothing —
    // it may be treated as non-JSON OR as parsed non-object. Either branch
    // leaves passed=false, which is what we assert.
    expect(result.passed).toBe(false);
  });

  it("treats a JSON object missing `passed` as failed with explanatory reasoning", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse('{"evidence": "some evidence", "reasoning": "no verdict"}'),
    );
    const client = createGraderClient();
    const result = await client.grade({
      prompt: "p",
      output: "o",
      expectation: "E",
    });
    expect(result.passed).toBe(false);
    expect(result.reasoning).toBeTruthy();
  });

  it("rejects when AbortSignal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort(new Error("cancelled"));
    const client = createGraderClient();
    await expect(
      client.grade({
        prompt: "p",
        output: "o",
        expectation: "E",
        signal: ctrl.signal,
      }),
    ).rejects.toThrow();
    expect(mockProviderChat).not.toHaveBeenCalled();
  });

  it("propagates signal + model + temperature to provider.chat()", async () => {
    mockProviderChat.mockResolvedValueOnce(
      makeChatResponse('{"passed": true, "evidence": "e", "reasoning": "r"}'),
    );
    const client = createGraderClient({
      model: "claude-haiku-4-5-20251001",
      temperature: 0,
      maxTokens: 256,
    });
    const ctrl = new AbortController();
    await client.grade({
      prompt: "p",
      output: "o",
      expectation: "E",
      signal: ctrl.signal,
    });
    expect(mockProviderChat).toHaveBeenCalledTimes(1);
    const req = mockProviderChat.mock.calls[0]![0];
    expect(req.model).toBe("claude-haiku-4-5-20251001");
    expect(req.temperature).toBe(0);
    expect(req.maxTokens).toBe(256);
    expect(req.signal).toBe(ctrl.signal);
    expect(req.messages).toHaveLength(2);
    expect(req.messages[0]!.role).toBe("system");
    expect(req.messages[1]!.role).toBe("user");
    expect(req.messages[1]!.content).toContain("E");
  });
});

// ---------------------------------------------------------------------------
// gradeCase — happy path
// ---------------------------------------------------------------------------

describe("gradeCase (with stubbed GraderClient)", () => {
  it("returns Grading with all passed when every expectation passes", async () => {
    const caseData = makeCase();
    const grader = stubGraderWithSequence([
      makeGraded(caseData.expectations[0]!, true),
      makeGraded(caseData.expectations[1]!, true),
      makeGraded(caseData.expectations[2]!, true),
    ]);

    const grading = await gradeCase({
      caseData,
      output: "function add(a, b) { return a + b; }",
      grader,
    });

    expect(grading.case_id).toBe("case-1");
    expect(grading.expectations).toHaveLength(3);
    expect(grading.expectations.every((e) => e.passed)).toBe(true);
  });

  it("preserves expectation order and passed flags for mixed results", async () => {
    const caseData = makeCase({
      expectations: ["E0", "E1", "E2", "E3"],
    });
    const grader = stubGraderWithSequence([
      makeGraded("E0", true),
      makeGraded("E1", false, "", "missing"),
      makeGraded("E2", true),
      makeGraded("E3", false, "", "incorrect"),
    ]);

    const grading = await gradeCase({
      caseData,
      output: "some output",
      grader,
    });

    expect(grading.expectations.map((e) => e.text)).toEqual([
      "E0",
      "E1",
      "E2",
      "E3",
    ]);
    expect(grading.expectations.map((e) => e.passed)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it("marks expectation as failed when grader throws, with error in evidence", async () => {
    const caseData = makeCase({ expectations: ["E0", "E1"] });
    const grader = stubGraderWithSequence([
      makeGraded("E0", true),
      new Error("LLM upstream 500"),
    ]);

    const grading = await gradeCase({
      caseData,
      output: "output",
      grader,
    });

    expect(grading.expectations).toHaveLength(2);
    expect(grading.expectations[0]!.passed).toBe(true);
    const failed = grading.expectations[1]!;
    expect(failed.passed).toBe(false);
    expect(failed.evidence).toContain("LLM upstream 500");
    expect(failed.reasoning).toContain("LLM upstream 500");
  });

  it("treats malformed grader verdicts as failed with explanatory reasoning", async () => {
    // Grader returns a GradedExpectation that was itself produced by the
    // internal JSON parser in the non-JSON branch. We simulate that by having
    // our stub return the exact shape the real parser would emit.
    const caseData = makeCase({ expectations: ["E0"] });
    const malformed: GradedExpectation = {
      text: "E0",
      passed: false,
      evidence: "grader returned non-JSON",
      reasoning: "raw response could not be parsed as JSON: I think it passed.",
    };
    const grader = stubGraderWithSequence([malformed]);

    const grading = await gradeCase({
      caseData,
      output: "output",
      grader,
    });

    expect(grading.expectations).toHaveLength(1);
    const only = grading.expectations[0]!;
    expect(only.passed).toBe(false);
    expect(only.evidence).toContain("non-JSON");
    expect(only.reasoning).toContain("could not be parsed");
  });

  // ---- Deterministic substring augmentation ---------------------------------

  it("emits a passed [substring-contains] expectation when substring is present", async () => {
    const caseData = makeCase({
      expectations: ["E0"],
      expected_output_contains: ["function add"],
    });
    const grader = stubGraderWithSequence([makeGraded("E0", true)]);

    const output = "Here is the code: function add(a, b) { return a + b; }";
    const grading = await gradeCase({ caseData, output, grader });

    expect(grading.expectations).toHaveLength(2);
    const sub = grading.expectations.find((e) =>
      e.text.startsWith("[substring-contains]"),
    );
    expect(sub).toBeDefined();
    expect(sub!.passed).toBe(true);
    expect(sub!.evidence).toContain("function add");
    expect(sub!.evidence.length).toBeLessThanOrEqual(40);
  });

  it("emits a FAILED [substring-excludes] expectation when forbidden substring is found", async () => {
    const caseData = makeCase({
      expectations: ["E0"],
      expected_output_excludes: ["TODO"],
    });
    const grader = stubGraderWithSequence([makeGraded("E0", true)]);

    const output = "function add(a,b) { /* TODO: handle NaN */ return a + b }";
    const grading = await gradeCase({ caseData, output, grader });

    expect(grading.expectations).toHaveLength(2);
    const sub = grading.expectations.find((e) =>
      e.text.startsWith("[substring-excludes]"),
    );
    expect(sub).toBeDefined();
    expect(sub!.passed).toBe(false);
    expect(sub!.evidence).toContain("TODO");
  });

  it("emits a passed [substring-excludes] when forbidden substring is correctly absent", async () => {
    const caseData = makeCase({
      expectations: ["E0"],
      expected_output_excludes: ["TODO"],
    });
    const grader = stubGraderWithSequence([makeGraded("E0", true)]);

    const output = "function add(a,b) { return a + b }";
    const grading = await gradeCase({ caseData, output, grader });

    const sub = grading.expectations.find((e) =>
      e.text.startsWith("[substring-excludes]"),
    );
    expect(sub).toBeDefined();
    expect(sub!.passed).toBe(true);
  });

  // ---- Abort semantics ------------------------------------------------------

  it("rejects synchronously-aborted signal before calling the grader", async () => {
    const caseData = makeCase({ expectations: ["E0"] });
    const grader: GraderClient = {
      grade: vi.fn(async () => makeGraded("E0", true)),
    };
    const ctrl = new AbortController();
    ctrl.abort(new Error("user cancelled"));

    await expect(
      gradeCase({ caseData, output: "x", grader, signal: ctrl.signal }),
    ).rejects.toThrow();
    expect(grader.grade).not.toHaveBeenCalled();
  });

  it("rejects when signal is aborted mid-flight", async () => {
    const caseData = makeCase({ expectations: ["E0", "E1", "E2", "E3"] });
    const ctrl = new AbortController();

    const grader: GraderClient = {
      grade: vi.fn(async (args) => {
        // Abort after the first call, then subsequent slots should detect it.
        ctrl.abort(new Error("aborted mid-flight"));
        // Cooperate with abort: emulate the provider throwing on aborted signal.
        if (args.signal?.aborted) {
          const err = new Error("aborted");
          err.name = "AbortError";
          throw err;
        }
        return makeGraded(args.expectation, true);
      }),
    };

    await expect(
      gradeCase({
        caseData,
        output: "x",
        grader,
        signal: ctrl.signal,
        parallel: 1,
      }),
    ).rejects.toThrow();
  });

  // ---- Concurrency limit ----------------------------------------------------

  it("respects the `parallel` concurrency limit", async () => {
    const caseData = makeCase({
      expectations: Array.from({ length: 10 }, (_, i) => `E${String(i)}`),
    });

    let inFlight = 0;
    let observedMax = 0;

    const grader: GraderClient = {
      grade: vi.fn(async (args) => {
        inFlight += 1;
        if (inFlight > observedMax) observedMax = inFlight;
        // Simulate async work with microtask chain + timer.
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return makeGraded(args.expectation, true);
      }),
    };

    const parallel = 3;
    const grading = await gradeCase({
      caseData,
      output: "x",
      grader,
      parallel,
    });

    expect(grading.expectations).toHaveLength(10);
    expect(observedMax).toBeGreaterThan(0);
    expect(observedMax).toBeLessThanOrEqual(parallel);
  });

  it("emits a failed [substring-contains] when needle is absent", async () => {
    const caseData = makeCase({
      expectations: ["E0"],
      expected_output_contains: ["function subtract"],
    });
    const grader = stubGraderWithSequence([makeGraded("E0", true)]);
    const output = "function add(a,b) { return a + b }";
    const grading = await gradeCase({ caseData, output, grader });
    const sub = grading.expectations.find((e) =>
      e.text.startsWith("[substring-contains]"),
    );
    expect(sub).toBeDefined();
    expect(sub!.passed).toBe(false);
    expect(sub!.evidence).toBe("");
    expect(sub!.reasoning).toContain("not found");
  });

  it("truncates very long grader error messages in evidence", async () => {
    const longMsg = "E".repeat(500);
    const caseData = makeCase({ expectations: ["E0"] });
    const grader = stubGraderWithSequence([new Error(longMsg)]);
    const grading = await gradeCase({ caseData, output: "x", grader });
    const only = grading.expectations[0]!;
    expect(only.passed).toBe(false);
    expect(only.evidence.length).toBeLessThanOrEqual(180);
    expect(only.evidence.endsWith("...")).toBe(true);
  });

  it("handles empty expected_output_contains / excludes arrays as no-ops", async () => {
    const caseData = makeCase({
      expectations: ["E0"],
      expected_output_contains: [],
      expected_output_excludes: [],
    });
    const grader = stubGraderWithSequence([makeGraded("E0", true)]);
    const grading = await gradeCase({ caseData, output: "x", grader });
    expect(grading.expectations).toHaveLength(1);
  });
});
