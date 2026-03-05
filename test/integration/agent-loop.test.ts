import { describe, it, expect, vi } from "vitest";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { type LLMProvider, type ChatMessage } from "../../src/llm/provider.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { type ToolCallStrategy } from "../../src/llm/tool-call-strategy.js";
import { createEventEmitter } from "../../src/utils/events.js";
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
});
