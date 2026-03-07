import { describe, it, expect, vi } from "vitest";
import { ContextManager } from "../../../src/core/context-manager.js";
import type { ChatMessage, ChatResponse, LLMProvider } from "../../../src/llm/provider.js";

/** Create a message with predictable content */
function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

/** Create multiple user-assistant pairs */
function createTurns(count: number, contentSize = 100): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(msg("user", `User message ${i}: ${"x".repeat(contentSize)}`));
    messages.push(msg("assistant", `Assistant response ${i}: ${"y".repeat(contentSize)}`));
  }
  return messages;
}

/** Create a mock LLMProvider */
function createMockProvider(summaryResponse = "LLM summary of conversation."): LLMProvider {
  return {
    name: "mock-provider",
    chat: vi.fn().mockResolvedValue({
      content: summaryResponse,
      toolCalls: [],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      finishReason: "stop",
    } satisfies ChatResponse),
    stream: vi.fn(),
    countTokens: vi.fn().mockReturnValue(10),
  };
}

describe("ContextManager LLM Compaction", () => {
  it("should use LLM summarization when client is provided", async () => {
    const mockProvider = createMockProvider("LLM-generated summary with key details.");
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      client: mockProvider,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted, result } = await manager.compact(messages);

    // LLM chat should have been called
    expect(mockProvider.chat).toHaveBeenCalledOnce();

    // Summary should contain the LLM response
    expect(result.summary).toBe("LLM-generated summary with key details.");

    // Summary message should be present in compacted messages
    const summaryMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Conversation summary]"),
    );
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg!.content).toContain("LLM-generated summary with key details.");
  });

  it("should fall back to local summarization when LLM call fails", async () => {
    const mockProvider = createMockProvider();
    (mockProvider.chat as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("LLM API error"),
    );

    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      client: mockProvider,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { result } = await manager.compact(messages);

    // LLM was called but failed
    expect(mockProvider.chat).toHaveBeenCalledOnce();

    // Should fall back to local summary (contains "Summarized X conversation turns")
    expect(result.summary).toContain("Summarized");
    expect(result.summary).toContain("conversation turns");
  });

  it("should use local summarization when no client is provided", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      // No client provided
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { result } = await manager.compact(messages);

    // Should use local summary format
    expect(result.summary).toContain("Summarized");
    expect(result.summary).toContain("conversation turns");
  });

  it("should pass focusTopic to LLM summarization prompt", async () => {
    const mockProvider = createMockProvider("Summary focused on auth.");
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      client: mockProvider,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    await manager.compact(messages, "authentication");

    // Verify the LLM was called with a system prompt mentioning the focus topic
    const chatCall = (mockProvider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const systemContent = chatCall.messages[0].content as string;
    expect(systemContent).toContain("authentication");
  });

  it("should pass summaryModel to LLM chat request", async () => {
    const mockProvider = createMockProvider();
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      client: mockProvider,
      summaryModel: "gpt-4o-mini",
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    await manager.compact(messages);

    const chatCall = (mockProvider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(chatCall.model).toBe("gpt-4o-mini");
  });

  it("should use 'default' model when summaryModel is not specified", async () => {
    const mockProvider = createMockProvider();
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      client: mockProvider,
      // No summaryModel
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    await manager.compact(messages);

    const chatCall = (mockProvider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(chatCall.model).toBe("default");
  });

  it("should send conversation turn content to LLM", async () => {
    const mockProvider = createMockProvider();
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      client: mockProvider,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    await manager.compact(messages);

    const chatCall = (mockProvider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const userContent = chatCall.messages[1].content as string;

    // Should contain turn markers
    expect(userContent).toContain("--- Turn 1 ---");
    // Should contain user/assistant role labels
    expect(userContent).toContain("[User]:");
    expect(userContent).toContain("[Assistant]:");
  });

  it("should set maxTokens on LLM request", async () => {
    const mockProvider = createMockProvider();
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      client: mockProvider,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    await manager.compact(messages);

    const chatCall = (mockProvider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(chatCall.maxTokens).toBe(1024);
  });

  it("should not call LLM when turns are fewer than preserveRecentTurns", async () => {
    const mockProvider = createMockProvider();
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.1,
      preserveRecentTurns: 5,
      client: mockProvider,
    });

    // Only 3 turns — fewer than preserveRecentTurns (5)
    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(3, 50)];
    await manager.compact(messages);

    // LLM should NOT be called (goes through truncate-only path)
    expect(mockProvider.chat).not.toHaveBeenCalled();
  });
});
