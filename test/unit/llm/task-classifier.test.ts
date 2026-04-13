import { describe, it, expect } from "vitest";
import { TaskClassifier, type ClassificationContext } from "../../../src/llm/task-classifier.js";
import type { ChatMessage } from "../../../src/llm/provider.js";

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

function makeAssistantMessage(content: string): ChatMessage {
  return { role: "assistant", content };
}

function makeUserMessage(content: string): ChatMessage {
  return { role: "user", content };
}

describe("TaskClassifier", () => {
  const classifier = new TaskClassifier();

  describe("first message (no history)", () => {
    it("should classify as plan with confidence 0.8", () => {
      const result = classifier.classify(makeContext({ currentMessage: "hello" }));
      expect(result.phase).toBe("plan");
      expect(result.confidence).toBe(0.8);
      expect(result.suggestedModel).toBe("architect");
    });
  });

  describe("plan keywords (Korean)", () => {
    it.each(["계획", "설계", "분석", "리뷰", "아키텍처", "전략", "제안"])(
      "should classify '%s' as plan",
      (keyword) => {
        const result = classifier.classify(
          makeContext({
            currentMessage: `${keyword}을 세워줘`,
            recentHistory: [makeUserMessage("이전 메시지")],
          }),
        );
        expect(result.phase).toBe("plan");
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      },
    );
  });

  describe("plan keywords (English)", () => {
    it.each([
      "plan",
      "design",
      "analyze",
      "analyse",
      "review",
      "architecture",
      "strategy",
      "approach",
      "proposal",
      "rfc",
    ])("should classify '%s' as plan", (keyword) => {
      const result = classifier.classify(
        makeContext({
          currentMessage: `Let's ${keyword} the module`,
          recentHistory: [makeUserMessage("previous message")],
        }),
      );
      expect(result.phase).toBe("plan");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("execute keywords (Korean)", () => {
    it.each(["구현", "코드", "작성", "수정", "만들어", "추가", "생성"])(
      "should classify '%s' as execute",
      (keyword) => {
        const result = classifier.classify(
          makeContext({
            currentMessage: `${keyword}해줘`,
            recentHistory: [makeUserMessage("이전 메시지")],
          }),
        );
        expect(result.phase).toBe("execute");
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      },
    );
  });

  describe("execute keywords (English)", () => {
    it.each(["implement", "code", "write", "fix", "create", "build", "add", "modify"])(
      "should classify '%s' as execute",
      (keyword) => {
        const result = classifier.classify(
          makeContext({
            currentMessage: `Please ${keyword} the feature`,
            recentHistory: [makeUserMessage("previous message")],
          }),
        );
        expect(result.phase).toBe("execute");
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      },
    );
  });

  describe("review keywords (Korean)", () => {
    it.each(["확인", "검토", "테스트", "점검", "검증"])(
      "should classify '%s' as review",
      (keyword) => {
        const result = classifier.classify(
          makeContext({
            currentMessage: `${keyword}해줘`,
            recentHistory: [makeUserMessage("이전 메시지")],
          }),
        );
        expect(result.phase).toBe("review");
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      },
    );
  });

  describe("review keywords (English)", () => {
    it.each(["check", "verify", "test", "validate", "inspect", "audit"])(
      "should classify '%s' as review",
      (keyword) => {
        const result = classifier.classify(
          makeContext({
            currentMessage: `Please ${keyword} the results`,
            recentHistory: [makeUserMessage("previous message")],
          }),
        );
        expect(result.phase).toBe("review");
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      },
    );
  });

  describe("proceed after plan", () => {
    const planHistory: readonly ChatMessage[] = [
      makeUserMessage("계획 세워줘"),
      makeAssistantMessage("계획은 다음과 같습니다: step 1, step 2, step 3"),
    ];

    it.each(["진행해줘", "진행", "시작해줘", "go ahead", "proceed", "start", "do it"])(
      "should classify '%s' after plan as execute with 0.9",
      (keyword) => {
        const result = classifier.classify(
          makeContext({
            currentMessage: keyword,
            recentHistory: planHistory,
          }),
        );
        expect(result.phase).toBe("execute");
        expect(result.confidence).toBe(0.9);
      },
    );
  });

  describe("tool call signals", () => {
    it("should classify as execute after file_write tool call", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "다음 파일도 처리해줘",
          recentHistory: [makeUserMessage("이전 메시지")],
          pendingToolCalls: ["file_write"],
        }),
      );
      expect(result.phase).toBe("execute");
      expect(result.confidence).toBe(0.7);
    });

    it("should classify as execute after file_edit tool call", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "계속 진행",
          recentHistory: [makeUserMessage("이전 메시지")],
          pendingToolCalls: ["file_edit"],
        }),
      );
      expect(result.phase).toBe("execute");
      expect(result.confidence).toBe(0.7);
    });

    it("should classify as execute after bash_exec tool call", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "다른 명령도 실행해줘",
          recentHistory: [makeUserMessage("이전 메시지")],
          pendingToolCalls: ["bash_exec"],
        }),
      );
      expect(result.phase).toBe("execute");
      expect(result.confidence).toBe(0.7);
    });
  });

  describe("file changes count", () => {
    it("should suggest review when 10+ files changed", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "어떻게 됐어?",
          recentHistory: [makeUserMessage("이전 메시지")],
          fileChangesCount: 15,
        }),
      );
      expect(result.phase).toBe("review");
      expect(result.confidence).toBe(0.5);
    });

    it("should not suggest review for fewer than 10 changes", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "어떻게 됐어?",
          recentHistory: [makeUserMessage("이전 메시지")],
          fileChangesCount: 5,
        }),
      );
      // With no keywords and no signals, should default to execute
      expect(result.phase).toBe("execute");
    });
  });

  describe("confidence threshold / fallback", () => {
    it("should return low confidence and architect model when no signals match", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "어떻게 됐어?",
          recentHistory: [makeUserMessage("이전 메시지")],
        }),
      );
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.suggestedModel).toBe("architect");
    });
  });

  describe("signal priority", () => {
    it("should prefer proceed-after-plan (0.9) over execute keyword (0.6)", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "코드 구현을 진행해줘",
          recentHistory: [
            makeUserMessage("계획 세워줘"),
            makeAssistantMessage("plan: step 1, step 2"),
          ],
        }),
      );
      expect(result.phase).toBe("execute");
      expect(result.confidence).toBe(0.9);
    });

    it("should prefer first-message plan (0.8) over execute keywords", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "이 기능을 구현해줘",
          recentHistory: [],
        }),
      );
      expect(result.phase).toBe("plan");
      expect(result.confidence).toBe(0.8);
    });
  });

  describe("suggested model mapping", () => {
    it("should suggest architect for plan phase", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "설계해줘",
          recentHistory: [makeUserMessage("이전")],
        }),
      );
      expect(result.suggestedModel).toBe("architect");
    });

    it("should suggest editor for execute phase", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "구현해줘",
          recentHistory: [makeUserMessage("이전")],
        }),
      );
      expect(result.suggestedModel).toBe("editor");
    });

    it("should suggest architect for review phase", () => {
      const result = classifier.classify(
        makeContext({
          currentMessage: "검토해줘",
          recentHistory: [makeUserMessage("이전")],
        }),
      );
      expect(result.suggestedModel).toBe("architect");
    });
  });
});
