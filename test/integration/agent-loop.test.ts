import { describe, it, expect, vi } from "vitest";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { type LLMProvider, type ChatMessage } from "../../src/llm/provider.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { type ToolCallStrategy } from "../../src/llm/tool-call-strategy.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { LLMError } from "../../src/utils/error.js";
import { z } from "zod";

/** Create a mock LLM provider */
function createMockProvider(
  responses: Array<{
    content: string;
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }>,
): LLMProvider {
  let callIndex = 0;
  return {
    name: "mock",
    chat: vi.fn(async () => {
      const resp = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return {
        content: resp.content,
        toolCalls: resp.toolCalls ?? [],
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      };
    }),
    stream: vi.fn(),
    countTokens: vi.fn(() => 10),
  };
}

/** Create a mock strategy */
function createMockStrategy(): ToolCallStrategy {
  return {
    name: "native",
    prepareRequest: (messages, tools) => ({
      messages,
      tools: tools.map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: {} },
      })),
    }),
    extractToolCalls: (_content, toolCalls) =>
      (toolCalls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      })),
    formatToolResults: (results) =>
      results.map((r) => ({
        role: "tool" as const,
        content: r.output,
        toolCallId: r.id,
      })),
  };
}

describe("Agent Loop Integration", () => {
  it("should complete when LLM returns no tool calls", async () => {
    const provider = createMockProvider([{ content: "Hello! How can I help you?" }]);
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: new ToolRegistry(),
        strategy: createMockStrategy(),
        events,
      },
      [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ],
    );

    expect(result.iterations).toBe(1);
    expect(result.aborted).toBe(false);
    expect(result.messages.length).toBeGreaterThan(2);
  });

  it("should execute tool calls and loop", async () => {
    const provider = createMockProvider([
      {
        content: "Let me read that file.",
        toolCalls: [{ id: "tc1", name: "echo_tool", arguments: { text: "hello" } }],
      },
      { content: "The file says hello." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo_tool",
      description: "Echo text",
      parameterSchema: z.object({ text: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { text: string }) => ({
        output: params.text,
        isError: false,
      }),
    });

    const events = createEventEmitter();
    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: registry,
        strategy: createMockStrategy(),
        events,
      },
      [{ role: "user", content: "Echo hello" }],
    );

    expect(result.iterations).toBe(2);
    expect(result.aborted).toBe(false);
  });

  it("should respect maxIterations", async () => {
    // Provider always returns tool calls — should hit iteration limit
    const provider = createMockProvider([
      {
        content: "Running tool...",
        toolCalls: [{ id: "tc1", name: "echo_tool", arguments: { text: "loop" } }],
      },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo_tool",
      description: "Echo text",
      parameterSchema: z.object({ text: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { text: string }) => ({
        output: params.text,
        isError: false,
      }),
    });

    const events = createEventEmitter();
    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: registry,
        strategy: createMockStrategy(),
        events,
        maxIterations: 3,
      },
      [{ role: "user", content: "Loop" }],
    );

    expect(result.iterations).toBe(3);
  });

  it("should handle abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const provider = createMockProvider([{ content: "test" }]);
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: new ToolRegistry(),
        strategy: createMockStrategy(),
        events,
        signal: controller.signal,
      },
      [{ role: "user", content: "test" }],
    );

    expect(result.aborted).toBe(true);
    expect(result.iterations).toBe(0);
  });

  it("should check permissions and deny tool calls", async () => {
    const provider = createMockProvider([
      {
        content: "Let me execute that.",
        toolCalls: [{ id: "tc1", name: "echo_tool", arguments: { text: "hello" } }],
      },
      { content: "Permission denied, I cannot proceed." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo_tool",
      description: "Echo text",
      parameterSchema: z.object({ text: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { text: string }) => ({
        output: params.text,
        isError: false,
      }),
    });

    const events = createEventEmitter();
    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: registry,
        strategy: createMockStrategy(),
        events,
        checkPermission: async () => ({
          allowed: false,
          reason: "Denied for testing",
        }),
      },
      [{ role: "user", content: "Echo hello" }],
    );

    // Should still complete (tool denied, result appended, next iteration has no calls)
    expect(result.iterations).toBe(2);
  });

  it("should use default rejection message when reason is undefined", async () => {
    const provider = createMockProvider([
      {
        content: "Running tool.",
        toolCalls: [{ id: "tc1", name: "echo_tool", arguments: { text: "hello" } }],
      },
      { content: "OK, permission denied." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo_tool",
      description: "Echo text",
      parameterSchema: z.object({ text: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { text: string }) => ({
        output: params.text,
        isError: false,
      }),
    });

    const events = createEventEmitter();
    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: registry,
        strategy: createMockStrategy(),
        events,
        checkPermission: async () => ({
          allowed: false,
        }),
      },
      [{ role: "user", content: "Echo hello" }],
    );

    expect(result.iterations).toBe(2);
    // Verify the "User rejected" default was used in the tool result
    const toolMsg = result.messages.find(
      (m) => m.role === "tool" && m.content.includes("User rejected"),
    );
    expect(toolMsg).toBeDefined();
  });

  it("should retry transient errors and succeed", async () => {
    let callCount = 0;
    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("500 internal server error");
        }
        return {
          content: "Recovered!",
          toolCalls: [],
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        };
      }),
      stream: vi.fn(),
      countTokens: vi.fn(() => 10),
    };

    const events = createEventEmitter();
    const errorEvents: unknown[] = [];
    events.on("llm:error", (data) => errorEvents.push(data));

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: new ToolRegistry(),
        strategy: createMockStrategy(),
        events,
        maxRetries: 2,
      },
      [{ role: "user", content: "test" }],
    );

    expect(result.iterations).toBe(1);
    expect(result.aborted).toBe(false);
    expect(callCount).toBe(2);
    expect(errorEvents.length).toBe(1);
  });

  it("should throw after transient retries exhausted", async () => {
    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn(async () => {
        throw new Error("502 bad gateway");
      }),
      stream: vi.fn(),
      countTokens: vi.fn(() => 10),
    };

    const events = createEventEmitter();

    await expect(
      runAgentLoop(
        {
          client: provider,
          model: "test",
          toolRegistry: new ToolRegistry(),
          strategy: createMockStrategy(),
          events,
          maxRetries: 1,
        },
        [{ role: "user", content: "test" }],
      ),
    ).rejects.toThrow("LLM call failed after retries");

    // Should have been called maxRetries + 1 times
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });

  it("should throw immediately on permanent errors", async () => {
    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn(async () => {
        throw new Error("invalid model configuration");
      }),
      stream: vi.fn(),
      countTokens: vi.fn(() => 10),
    };

    const events = createEventEmitter();

    await expect(
      runAgentLoop(
        {
          client: provider,
          model: "test",
          toolRegistry: new ToolRegistry(),
          strategy: createMockStrategy(),
          events,
          maxRetries: 3,
        },
        [{ role: "user", content: "test" }],
      ),
    ).rejects.toThrow("invalid model configuration");

    // Should only be called once — permanent errors don't retry
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it("should use streaming mode when useStreaming is enabled", async () => {
    const events = createEventEmitter();
    const textDeltas: string[] = [];
    events.on("llm:text-delta", ({ text }) => textDeltas.push(text));

    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn(),
      stream: vi.fn(async function* () {
        yield { type: "text-delta" as const, text: "Hello " };
        yield { type: "text-delta" as const, text: "world!" };
        yield {
          type: "done" as const,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }),
      countTokens: vi.fn(() => 10),
    };

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: new ToolRegistry(),
        strategy: createMockStrategy(),
        events,
        useStreaming: true,
      },
      [{ role: "user", content: "test" }],
    );

    expect(result.iterations).toBe(1);
    expect(textDeltas).toEqual(["Hello ", "world!"]);
    // chat() should NOT have been called
    expect(provider.chat).not.toHaveBeenCalled();
    // stream() should have been called
    expect(provider.stream).toHaveBeenCalledTimes(1);
    // Final message should have the accumulated text
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.content).toBe("Hello world!");
  });

  it("should emit events during execution", async () => {
    const provider = createMockProvider([{ content: "Done." }]);
    const events = createEventEmitter();

    const emittedEvents: string[] = [];
    events.on("agent:iteration", () => emittedEvents.push("iteration"));
    events.on("llm:start", () => emittedEvents.push("llm:start"));
    events.on("llm:complete", () => emittedEvents.push("llm:complete"));

    await runAgentLoop(
      {
        client: provider,
        model: "test",
        toolRegistry: new ToolRegistry(),
        strategy: createMockStrategy(),
        events,
      },
      [{ role: "user", content: "test" }],
    );

    expect(emittedEvents).toContain("iteration");
    expect(emittedEvents).toContain("llm:start");
    expect(emittedEvents).toContain("llm:complete");
  });

  it("should re-throw LLMError directly when retries exhausted", async () => {
    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn(async () => {
        throw new LLMError("Rate limit exceeded", { status: 429 });
      }),
      stream: vi.fn(),
      countTokens: vi.fn(() => 10),
    };

    const events = createEventEmitter();

    await expect(
      runAgentLoop(
        {
          client: provider,
          model: "test",
          toolRegistry: new ToolRegistry(),
          strategy: createMockStrategy(),
          events,
          maxRetries: 1,
        },
        [{ role: "user", content: "test" }],
      ),
    ).rejects.toThrow("Rate limit exceeded");

    // Verify the thrown error is actually a LLMError instance
    try {
      await runAgentLoop(
        {
          client: provider,
          model: "test",
          toolRegistry: new ToolRegistry(),
          strategy: createMockStrategy(),
          events,
          maxRetries: 0,
        },
        [{ role: "user", content: "test" }],
      );
    } catch (error) {
      expect(error).toBeInstanceOf(LLMError);
      expect((error as LLMError).message).toBe("Rate limit exceeded");
    }
  });

  it("should abort immediately if signal already aborted before retry delay", async () => {
    const controller = new AbortController();
    let callCount = 0;

    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn(async () => {
        callCount++;
        // Abort synchronously so signal is already aborted when waitWithAbort starts
        controller.abort();
        throw new Error("500 server error");
      }),
      stream: vi.fn(),
      countTokens: vi.fn(() => 10),
    };

    const events = createEventEmitter();

    await expect(
      runAgentLoop(
        {
          client: provider,
          model: "test",
          toolRegistry: new ToolRegistry(),
          strategy: createMockStrategy(),
          events,
          maxRetries: 3,
          signal: controller.signal,
        },
        [{ role: "user", content: "test" }],
      ),
    ).rejects.toThrow("Aborted");

    expect(callCount).toBe(1);
  });

  it("should abort during retry delay", async () => {
    const controller = new AbortController();
    let callCount = 0;

    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // After first call fails, abort during the retry delay
          setTimeout(() => controller.abort(), 50);
          throw new Error("500 server error");
        }
        return {
          content: "Should not reach here",
          toolCalls: [],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        };
      }),
      stream: vi.fn(),
      countTokens: vi.fn(() => 10),
    };

    const events = createEventEmitter();

    await expect(
      runAgentLoop(
        {
          client: provider,
          model: "test",
          toolRegistry: new ToolRegistry(),
          strategy: createMockStrategy(),
          events,
          maxRetries: 3,
          signal: controller.signal,
        },
        [{ role: "user", content: "test" }],
      ),
    ).rejects.toThrow("Aborted");

    // Only the first attempt should have been made before abort
    expect(callCount).toBe(1);
  });
});
