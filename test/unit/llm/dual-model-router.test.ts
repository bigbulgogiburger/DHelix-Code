import { describe, it, expect, vi } from "vitest";
import { DualModelRouter, detectPhase, type DualModelConfig } from "../../../src/llm/dual-model-router.js";
import type { ClassificationContext } from "../../../src/llm/task-classifier.js";
import type { LLMProvider } from "../../../src/llm/provider.js";

function mockProvider(name: string): LLMProvider {
  return {
    name,
    chat: vi.fn(async () => ({
      content: `Response from ${name}`,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    })),
    stream: vi.fn(async function* () {
      yield { type: "text-delta" as const, text: "chunk" };
    }),
    countTokens: vi.fn(() => 10),
  };
}

function makeConfig(strategy: DualModelConfig["routingStrategy"] = "auto"): DualModelConfig {
  return {
    architectModel: "claude-opus",
    editorModel: "claude-sonnet",
    routingStrategy: strategy,
  };
}

function makeContext(overrides: Partial<ClassificationContext> = {}): ClassificationContext {
  return {
    currentMessage: "",
    recentHistory: [],
    pendingToolCalls: [],
    sessionPhase: "mid",
    fileChangesCount: 0,
    ...overrides,
  };
}

describe("DualModelRouter", () => {
  describe("existing behavior (setPhase / getClientForPhase)", () => {
    it("should default to execute phase", () => {
      const router = new DualModelRouter(makeConfig(), mockProvider("architect"), mockProvider("editor"));
      expect(router.getPhase()).toBe("execute");
    });

    it("should return editor client for execute phase", () => {
      const editor = mockProvider("editor");
      const router = new DualModelRouter(makeConfig(), mockProvider("architect"), editor);
      const result = router.getClientForPhase("execute");
      expect(result.role).toBe("editor");
      expect(result.model).toBe("claude-sonnet");
      expect(result.client).toBe(editor);
    });

    it("should return architect client for plan phase", () => {
      const architect = mockProvider("architect");
      const router = new DualModelRouter(makeConfig(), architect, mockProvider("editor"));
      const result = router.getClientForPhase("plan");
      expect(result.role).toBe("architect");
      expect(result.model).toBe("claude-opus");
      expect(result.client).toBe(architect);
    });

    it("should return architect client for review phase", () => {
      const architect = mockProvider("architect");
      const router = new DualModelRouter(makeConfig(), architect, mockProvider("editor"));
      const result = router.getClientForPhase("review");
      expect(result.role).toBe("architect");
      expect(result.model).toBe("claude-opus");
    });
  });

  describe("selectModel (TaskClassifier integration)", () => {
    it("should select architect for first message (plan, confidence 0.8)", () => {
      const architect = mockProvider("architect");
      const router = new DualModelRouter(makeConfig(), architect, mockProvider("editor"));

      const result = router.selectModel(makeContext({ currentMessage: "hello" }));

      expect(result.classification.phase).toBe("plan");
      expect(result.classification.confidence).toBe(0.8);
      expect(result.role).toBe("architect");
      expect(result.model).toBe("claude-opus");
      expect(router.getPhase()).toBe("plan");
    });

    it("should select editor for execute keywords with sufficient confidence", () => {
      const editor = mockProvider("editor");
      const router = new DualModelRouter(makeConfig(), mockProvider("architect"), editor);

      const result = router.selectModel(
        makeContext({
          currentMessage: "구현해줘",
          recentHistory: [{ role: "user", content: "이전" }],
        }),
      );

      expect(result.classification.phase).toBe("execute");
      expect(result.classification.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.role).toBe("editor");
      expect(result.model).toBe("claude-sonnet");
    });

    it("should fallback to architect when confidence < 0.6", () => {
      const architect = mockProvider("architect");
      const router = new DualModelRouter(makeConfig(), architect, mockProvider("editor"));

      // Message with no keywords and some history → low confidence
      const result = router.selectModel(
        makeContext({
          currentMessage: "어떻게 됐어?",
          recentHistory: [{ role: "user", content: "이전" }],
        }),
      );

      expect(result.classification.confidence).toBeLessThan(0.6);
      expect(result.role).toBe("architect");
      expect(result.model).toBe("claude-opus");
    });

    it("should store last classification for debugging", () => {
      const router = new DualModelRouter(makeConfig(), mockProvider("architect"), mockProvider("editor"));

      expect(router.getLastClassification()).toBeUndefined();

      router.selectModel(makeContext({ currentMessage: "설계해줘", recentHistory: [{ role: "user", content: "이전" }] }));

      const last = router.getLastClassification();
      expect(last).toBeDefined();
      expect(last!.phase).toBe("plan");
    });

    it("should update currentPhase after selectModel", () => {
      const router = new DualModelRouter(makeConfig(), mockProvider("architect"), mockProvider("editor"));

      router.selectModel(
        makeContext({
          currentMessage: "검토해줘",
          recentHistory: [{ role: "user", content: "이전" }],
        }),
      );

      expect(router.getPhase()).toBe("review");
    });
  });

  describe("detectPhase (backward compatibility)", () => {
    it("should return plan for plan keywords", () => {
      const result = detectPhase([{ role: "user", content: "설계해줘" }]);
      expect(result).toBe("plan");
    });

    it("should return execute for execute keywords", () => {
      const result = detectPhase([
        { role: "user", content: "이전 대화" },
        { role: "assistant", content: "응답" },
        { role: "user", content: "코드 구현해줘" },
      ]);
      expect(result).toBe("execute");
    });

    it("should return execute when no user messages", () => {
      const result = detectPhase([{ role: "system", content: "system prompt" }]);
      expect(result).toBe("execute");
    });

    it("should return review for review keywords", () => {
      const result = detectPhase([
        { role: "user", content: "이전" },
        { role: "assistant", content: "응답" },
        { role: "user", content: "테스트 검증해줘" },
      ]);
      expect(result).toBe("review");
    });

    it("should use last user message for detection", () => {
      const result = detectPhase([
        { role: "user", content: "구현해줘" },
        { role: "assistant", content: "done" },
        { role: "user", content: "이제 리뷰해줘" },
      ]);
      expect(result).toBe("plan"); // "리뷰" matches plan keywords
    });
  });
});
