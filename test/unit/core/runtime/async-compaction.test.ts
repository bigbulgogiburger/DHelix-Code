/**
 * AsyncCompactionEngine 단위 테스트
 *
 * - proactive compaction 요청 (non-blocking)
 * - reactive compaction 요청 (blocking)
 * - pair integrity validation (orphaned tool_result/tool_use 제거)
 * - token budget 계산
 * - CompactionTicket 상태 전이
 *
 * @module test/unit/core/runtime/async-compaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AsyncCompactionEngine } from "../../../../src/core/runtime/async-compaction.js";
import { type ChatMessage } from "../../../../src/llm/provider.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../../../../src/llm/token-counter.js", () => ({
  countTokens: (text: string) => Math.ceil(text.length / 4),
  countMessageTokens: (msgs: readonly { role: string; content: string }[]) =>
    msgs.reduce((sum, m) => sum + Math.ceil(m.content.length / 4) + 4, 0),
}));

vi.mock("../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

/**
 * Mock ContextManager — compact() 메서드만 구현
 */
function createMockContextManager() {
  return {
    compact: vi.fn(async (messages: readonly ChatMessage[]) => {
      // 시스템 메시지 보존, 나머지 절반 제거 시뮬레이션
      const systemMsgs = messages.filter((m) => m.role === "system");
      const nonSystemMsgs = messages.filter((m) => m.role !== "system");
      const kept = nonSystemMsgs.slice(Math.floor(nonSystemMsgs.length / 2));
      const compacted = [...systemMsgs, ...kept];

      return {
        messages: compacted,
        result: {
          originalTokens: messages.length * 100,
          compactedTokens: compacted.length * 100,
          removedMessages: messages.length - compacted.length,
          summary: "LLM summarized conversation",
        },
      };
    }),
    getUsage: vi.fn(() => ({
      totalTokens: 5000,
      maxTokens: 10000,
      usageRatio: 0.5,
      messageCount: 10,
    })),
    needsCompaction: vi.fn(() => false),
  } as unknown as import("../../../../src/core/context-manager.js").ContextManager;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeMessages(count: number): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: "system", content: "You are a helpful assistant." }];

  for (let i = 0; i < count; i++) {
    msgs.push({ role: "user", content: `User message ${i}` });
    msgs.push({
      role: "assistant",
      content: `Assistant response ${i}`,
      toolCalls: [{ id: `call-${i}`, name: "file_read", arguments: "{}" }],
    });
    msgs.push({
      role: "tool",
      content: `Tool result ${i}`,
      toolCallId: `call-${i}`,
    });
  }

  return msgs;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AsyncCompactionEngine", () => {
  let engine: AsyncCompactionEngine;
  let mockContextManager: ReturnType<typeof createMockContextManager>;

  beforeEach(() => {
    mockContextManager = createMockContextManager();
    engine = new AsyncCompactionEngine({ contextManager: mockContextManager });
  });

  // ── Proactive Compaction ──────────────────────────────────────────────────

  describe("requestCompaction (proactive)", () => {
    it("proactive 요청 시 pending 티켓을 즉시 반환한다", async () => {
      const messages = makeMessages(5);
      const ticket = await engine.requestCompaction(messages, "proactive");

      expect(ticket.id).toMatch(/^compaction-/);
      expect(ticket.priority).toBe("proactive");
      expect(ticket.requestedAt).toBeGreaterThan(0);
      // 즉시 반환되므로 status는 pending일 수 있음
      expect(["pending", "resolved"]).toContain(ticket.status);
    });

    it("proactive 완료 후 getCompactedMessages()로 결과를 얻을 수 있다", async () => {
      const messages = makeMessages(5);
      await engine.requestCompaction(messages, "proactive");

      // background promise가 완료될 때까지 대기
      await vi.waitFor(() => {
        const pending = engine.getPendingTicket();
        expect(pending?.status).toBe("resolved");
      });

      const result = engine.getCompactedMessages();
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThan(messages.length);
    });

    it("결과 수령 후 상태가 초기화된다", async () => {
      const messages = makeMessages(3);
      await engine.requestCompaction(messages, "proactive");

      await vi.waitFor(() => {
        expect(engine.getPendingTicket()?.status).toBe("resolved");
      });

      // 첫 번째 호출: 결과 반환
      const result = engine.getCompactedMessages();
      expect(result).not.toBeNull();

      // 두 번째 호출: null (이미 수령됨)
      const again = engine.getCompactedMessages();
      expect(again).toBeNull();
      expect(engine.getPendingTicket()).toBeNull();
    });
  });

  // ── Reactive Compaction ───────────────────────────────────────────────────

  describe("requestCompaction (reactive)", () => {
    it("reactive 요청 시 완료된 티켓을 반환한다", async () => {
      const messages = makeMessages(5);
      const ticket = await engine.requestCompaction(messages, "reactive");

      expect(ticket.status).toBe("resolved");
      expect(ticket.priority).toBe("reactive");
      expect(ticket.resolvedAt).toBeGreaterThan(0);
      expect(ticket.result).toBeDefined();
      expect(ticket.result!.originalTokens).toBeGreaterThan(0);
      expect(ticket.result!.compactedTokens).toBeGreaterThan(0);
    });

    it("reactive 결과를 getCompactedMessages()로도 얻을 수 있다", async () => {
      const messages = makeMessages(5);
      await engine.requestCompaction(messages, "reactive");

      const result = engine.getCompactedMessages();
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThan(messages.length);
    });

    it("compact 실패 시 failed 티켓을 반환한다", async () => {
      const failingManager = createMockContextManager();
      (failingManager.compact as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("LLM unavailable"),
      );
      const failEngine = new AsyncCompactionEngine({ contextManager: failingManager });

      const messages = makeMessages(3);
      const ticket = await failEngine.requestCompaction(messages, "reactive");

      expect(ticket.status).toBe("failed");
      expect(ticket.error).toBe("LLM unavailable");
    });
  });

  // ── Pair Integrity Validation ─────────────────────────────────────────────

  describe("validatePairIntegrity", () => {
    it("정상 쌍은 모두 보존한다", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Do something" },
        {
          role: "assistant",
          content: "I will use a tool",
          toolCalls: [{ id: "tc-1", name: "file_read", arguments: '{"path":"a.ts"}' }],
        },
        { role: "tool", content: "file content", toolCallId: "tc-1" },
        { role: "assistant", content: "Done!" },
      ];

      const result = engine.validatePairIntegrity(messages);
      expect(result).toHaveLength(4);
    });

    it("orphaned tool_result (대응 tool_use 없음)을 제거한다", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Do something" },
        // tool_use가 없는 tool_result
        { role: "tool", content: "orphaned result", toolCallId: "missing-call" },
        { role: "assistant", content: "Done!" },
      ];

      const result = engine.validatePairIntegrity(messages);
      expect(result).toHaveLength(2); // user + assistant만 남음
      expect(result.every((m) => m.role !== "tool")).toBe(true);
    });

    it("orphaned tool_use의 assistant 메시지를 정리한다", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Do something" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "orphaned-use", name: "bash_exec", arguments: '{"cmd":"ls"}' }],
        },
        // 대응하는 tool_result가 없음
        { role: "user", content: "What happened?" },
      ];

      const result = engine.validatePairIntegrity(messages);
      // orphaned tool_use를 가진 빈 assistant는 제거
      expect(result).toHaveLength(2);
      expect(result.every((m) => m.role === "user")).toBe(true);
    });

    it("orphaned tool_use를 가진 assistant에 텍스트가 있으면 toolCalls만 제거한다", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Do something" },
        {
          role: "assistant",
          content: "Let me try this approach",
          toolCalls: [{ id: "orphaned-use", name: "bash_exec", arguments: '{"cmd":"ls"}' }],
        },
        { role: "user", content: "OK" },
      ];

      const result = engine.validatePairIntegrity(messages);
      expect(result).toHaveLength(3);
      const assistantMsg = result.find((m) => m.role === "assistant");
      expect(assistantMsg?.content).toBe("Let me try this approach");
      expect(assistantMsg?.toolCalls).toBeUndefined();
    });

    it("복합 시나리오: 정상 쌍 + orphaned 혼합", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Multi-tool request" },
        {
          role: "assistant",
          content: "Using multiple tools",
          toolCalls: [
            { id: "valid-1", name: "file_read", arguments: "{}" },
            { id: "orphaned-1", name: "bash_exec", arguments: "{}" },
          ],
        },
        { role: "tool", content: "file content", toolCallId: "valid-1" },
        // orphaned-1의 tool_result 없음
        { role: "tool", content: "random orphan", toolCallId: "nonexistent" },
        { role: "assistant", content: "Done" },
      ];

      const result = engine.validatePairIntegrity(messages);
      // user + assistant(valid-1만) + tool(valid-1) + assistant(Done)
      expect(result).toHaveLength(4);

      // orphaned tool_result "nonexistent" 제거됨
      expect(result.find((m) => m.toolCallId === "nonexistent")).toBeUndefined();

      // assistant의 toolCalls에서 orphaned-1 제거됨
      const assistantWithTools = result.find(
        (m) => m.role === "assistant" && m.toolCalls !== undefined,
      );
      expect(assistantWithTools?.toolCalls).toHaveLength(1);
      expect(assistantWithTools?.toolCalls![0].id).toBe("valid-1");
    });

    it("빈 메시지 배열도 처리한다", () => {
      const result = engine.validatePairIntegrity([]);
      expect(result).toHaveLength(0);
    });

    it("tool 관련 메시지가 없으면 그대로 반환한다", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const result = engine.validatePairIntegrity(messages);
      expect(result).toHaveLength(2);
    });
  });

  // ── Token Budget Computation ──────────────────────────────────────────────

  describe("computeTokenBudget", () => {
    it("토큰이 충분히 적으면 제거 대상이 없다", () => {
      // preserveMinTokens=20000, protectTokens=40000 기본값
      // 짧은 메시지 몇 개 → 전체 토큰 < minKeep(40000)
      const messages: ChatMessage[] = [
        { role: "system", content: "System" },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ];

      const budget = engine.computeTokenBudget(messages);
      expect(budget.toRemove).toHaveLength(0);
      expect(budget.toKeep).toHaveLength(3);
    });

    it("시스템 메시지는 항상 보존된다", () => {
      // 매우 큰 메시지를 만들어 minKeep을 초과하게 함
      const bigEngine = new AsyncCompactionEngine({
        contextManager: mockContextManager,
        preserveMinTokens: 100,
        protectTokens: 100,
      });

      const messages: ChatMessage[] = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "A".repeat(800) },
        { role: "assistant", content: "B".repeat(800) },
        { role: "user", content: "Latest question" },
      ];

      const budget = bigEngine.computeTokenBudget(messages);
      // 시스템 메시지는 반드시 toKeep에 포함
      expect(budget.toKeep.some((m) => m.role === "system")).toBe(true);
    });

    it("최신 메시지를 우선 보존한다 (backward scanning)", () => {
      const smallEngine = new AsyncCompactionEngine({
        contextManager: mockContextManager,
        preserveMinTokens: 50,
        protectTokens: 50,
      });

      const messages: ChatMessage[] = [
        { role: "system", content: "Sys" },
        { role: "user", content: "Old message " + "x".repeat(200) },
        { role: "assistant", content: "Old response " + "y".repeat(200) },
        { role: "user", content: "New message" },
        { role: "assistant", content: "New response" },
      ];

      const budget = smallEngine.computeTokenBudget(messages);
      // 최신 메시지(New message/New response)가 toKeep에 포함
      const keptContents = budget.toKeep.map((m) => m.content);
      expect(keptContents).toContain("New message");
      expect(keptContents).toContain("New response");
    });
  });

  // ── Ticket State Transitions ──────────────────────────────────────────────

  describe("CompactionTicket 상태 전이", () => {
    it("pending → resolved 전이", async () => {
      const messages = makeMessages(3);
      const ticket = await engine.requestCompaction(messages, "reactive");

      expect(ticket.status).toBe("resolved");
      expect(ticket.resolvedAt).toBeDefined();
      expect(ticket.result).toBeDefined();
    });

    it("pending → failed 전이", async () => {
      const failingManager = createMockContextManager();
      (failingManager.compact as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Timeout"),
      );
      const failEngine = new AsyncCompactionEngine({ contextManager: failingManager });

      const messages = makeMessages(2);
      const ticket = await failEngine.requestCompaction(messages, "reactive");

      expect(ticket.status).toBe("failed");
      expect(ticket.resolvedAt).toBeDefined();
      expect(ticket.error).toBe("Timeout");
      expect(ticket.result).toBeUndefined();
    });

    it("새 요청이 이전 pending을 대체한다", async () => {
      const messages = makeMessages(2);

      // 첫 번째 요청
      await engine.requestCompaction(messages, "reactive");
      const firstTicket = engine.getPendingTicket();

      // 두 번째 요청 — 첫 번째를 대체
      await engine.requestCompaction(messages, "reactive");
      const secondTicket = engine.getPendingTicket();

      expect(secondTicket?.id).not.toBe(firstTicket?.id);
    });
  });

  // ── Thresholds ────────────────────────────────────────────────────────────

  describe("threshold 설정", () => {
    it("기본 임계치가 올바르다", () => {
      expect(engine.getProactiveThreshold()).toBe(0.7);
      expect(engine.getReactiveThreshold()).toBe(0.85);
    });

    it("커스텀 임계치를 설정할 수 있다", () => {
      const customEngine = new AsyncCompactionEngine({
        contextManager: mockContextManager,
        proactiveThreshold: 0.6,
        reactiveThreshold: 0.9,
      });

      expect(customEngine.getProactiveThreshold()).toBe(0.6);
      expect(customEngine.getReactiveThreshold()).toBe(0.9);
    });
  });

  // ── Dispose ───────────────────────────────────────────────────────────────

  describe("dispose", () => {
    it("dispose 후 상태가 초기화된다", async () => {
      const messages = makeMessages(3);
      await engine.requestCompaction(messages, "reactive");

      engine.dispose();

      expect(engine.getPendingTicket()).toBeNull();
      expect(engine.getCompactedMessages()).toBeNull();
    });
  });
});
