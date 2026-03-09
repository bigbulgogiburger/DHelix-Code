import { describe, it, expect, vi } from "vitest";
import { runAgentLoop } from "../../src/core/agent-loop.js";
import { type LLMProvider, type ChatResponse } from "../../src/llm/provider.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { TextParsingStrategy } from "../../src/llm/strategies/text-parsing.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { z } from "zod";

/**
 * Create a mock LLM provider that returns pre-defined responses sequentially.
 * Uses text-parsing strategy format (XML tool calls embedded in content).
 */
function createMockProvider(responses: Array<{ content: string }>): LLMProvider {
  let callIndex = 0;
  return {
    name: "mock-text-parsing",
    chat: vi.fn(async (): Promise<ChatResponse> => {
      const resp = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return {
        content: resp.content,
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: "stop",
      };
    }),
    stream: vi.fn(),
    countTokens: vi.fn(() => 10),
  };
}

describe("Agent Loop + Tools Integration (text-parsing strategy)", () => {
  it("should parse XML tool call from LLM text, execute file_read, and return result", async () => {
    // LLM response 1: contains an XML tool call for file_read
    // LLM response 2: final answer (no tool calls)
    const provider = createMockProvider([
      {
        content: [
          "I'll read that file for you.",
          "<tool_call>",
          "<name>file_read</name>",
          '<arguments>{"path": "/tmp/test.txt"}</arguments>',
          "</tool_call>",
        ].join("\n"),
      },
      {
        content: "The file contains: hello world",
      },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "file_read",
      description: "Read a file",
      parameterSchema: z.object({ path: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { path: string }) => ({
        output: `Contents of ${params.path}: hello world`,
        isError: false,
      }),
    });

    const strategy = new TextParsingStrategy();
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test-model",
        toolRegistry: registry,
        strategy,
        events,
      },
      [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Read the file /tmp/test.txt" },
      ],
    );

    // Should have 2 iterations: 1st with tool call, 2nd with final answer
    expect(result.iterations).toBe(2);
    expect(result.aborted).toBe(false);

    // Verify messages array contains the expected flow
    // Initial: system + user = 2 messages
    // After iter 1: + assistant (with tool call) + tool result (as user message in text-parsing) = 4
    // After iter 2: + assistant (final answer) = 5
    expect(result.messages.length).toBe(5);

    // Verify tool result is present in messages
    const toolResultMsg = result.messages.find(
      (m) => m.role === "user" && m.content.includes("tool_result"),
    );
    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg!.content).toContain("Contents of /tmp/test.txt: hello world");
    expect(toolResultMsg!.content).toContain("SUCCESS");

    // Verify final assistant message
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.role).toBe("assistant");
    expect(lastMsg.content).toContain("hello world");
  });

  it("should handle multiple tool calls in a single response", async () => {
    const provider = createMockProvider([
      {
        content: [
          "Let me read both files.",
          "<tool_call>",
          "<name>file_read</name>",
          '<arguments>{"path": "a.txt"}</arguments>',
          "</tool_call>",
          "<tool_call>",
          "<name>file_read</name>",
          '<arguments>{"path": "b.txt"}</arguments>',
          "</tool_call>",
        ].join("\n"),
      },
      {
        content: "Both files read successfully.",
      },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "file_read",
      description: "Read a file",
      parameterSchema: z.object({ path: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { path: string }) => ({
        output: `content of ${params.path}`,
        isError: false,
      }),
    });

    const strategy = new TextParsingStrategy();
    const events = createEventEmitter();

    const toolStartEvents: string[] = [];
    events.on("tool:start", ({ name }) => toolStartEvents.push(name));

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test-model",
        toolRegistry: registry,
        strategy,
        events,
      },
      [{ role: "user", content: "Read a.txt and b.txt" }],
    );

    expect(result.iterations).toBe(2);
    // Two tool:start events in the first iteration
    expect(toolStartEvents).toEqual(["file_read", "file_read"]);

    // Tool results message should contain both results
    const toolResultMsg = result.messages.find(
      (m) => m.role === "user" && m.content.includes("tool_result"),
    );
    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg!.content).toContain("content of a.txt");
    expect(toolResultMsg!.content).toContain("content of b.txt");
  });

  it("should handle unknown tool gracefully", async () => {
    const provider = createMockProvider([
      {
        content: [
          "Let me use a tool.",
          "<tool_call>",
          "<name>nonexistent_tool</name>",
          '<arguments>{"x": 1}</arguments>',
          "</tool_call>",
        ].join("\n"),
      },
      {
        content: "That tool doesn't exist, sorry.",
      },
    ]);

    const registry = new ToolRegistry();
    const strategy = new TextParsingStrategy();
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test-model",
        toolRegistry: registry,
        strategy,
        events,
      },
      [{ role: "user", content: "Do something" }],
    );

    expect(result.iterations).toBe(2);

    // Tool result should indicate unknown tool error
    const toolResultMsg = result.messages.find(
      (m) => m.role === "user" && m.content.includes("tool_result"),
    );
    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg!.content).toContain("Unknown tool: nonexistent_tool");
    expect(toolResultMsg!.content).toContain("ERROR");
  });

  it("should protect against infinite loops with maxIterations", async () => {
    // Provider always returns a tool call — should hit maxIterations
    const provider = createMockProvider([
      {
        content: [
          "Running...",
          "<tool_call>",
          "<name>echo</name>",
          '<arguments>{"text": "loop"}</arguments>',
          "</tool_call>",
        ].join("\n"),
      },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo text",
      parameterSchema: z.object({ text: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { text: string }) => ({
        output: params.text,
        isError: false,
      }),
    });

    const strategy = new TextParsingStrategy();
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test-model",
        toolRegistry: registry,
        strategy,
        events,
        maxIterations: 5,
      },
      [{ role: "user", content: "Keep going" }],
    );

    // Should stop exactly at maxIterations
    expect(result.iterations).toBe(5);
    expect(result.aborted).toBe(false);
  });

  it("should emit correct events during tool execution", async () => {
    const provider = createMockProvider([
      {
        content: [
          "Reading file.",
          "<tool_call>",
          "<name>file_read</name>",
          '<arguments>{"path": "test.txt"}</arguments>',
          "</tool_call>",
        ].join("\n"),
      },
      { content: "Done." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "file_read",
      description: "Read a file",
      parameterSchema: z.object({ path: z.string() }),
      permissionLevel: "safe",
      execute: async () => ({
        output: "file content",
        isError: false,
      }),
    });

    const strategy = new TextParsingStrategy();
    const events = createEventEmitter();

    const eventLog: string[] = [];
    events.on("agent:iteration", () => eventLog.push("agent:iteration"));
    events.on("llm:start", () => eventLog.push("llm:start"));
    events.on("llm:complete", () => eventLog.push("llm:complete"));
    events.on("tool:start", () => eventLog.push("tool:start"));
    events.on("tool:complete", () => eventLog.push("tool:complete"));

    await runAgentLoop(
      {
        client: provider,
        model: "test-model",
        toolRegistry: registry,
        strategy,
        events,
      },
      [{ role: "user", content: "Read test.txt" }],
    );

    // First iteration: agent:iteration -> llm:start -> llm:complete -> tool:start -> tool:complete
    // Second iteration: agent:iteration -> llm:start -> llm:complete
    expect(eventLog).toEqual([
      "agent:iteration",
      "llm:start",
      "llm:complete",
      "tool:start",
      "tool:complete",
      "agent:iteration",
      "llm:start",
      "llm:complete",
    ]);
  });

  it("should truncate oversized tool results", async () => {
    const provider = createMockProvider([
      {
        content: [
          "Reading big file.",
          "<tool_call>",
          "<name>file_read</name>",
          '<arguments>{"path": "big.txt"}</arguments>',
          "</tool_call>",
        ].join("\n"),
      },
      { content: "Done." },
    ]);

    const registry = new ToolRegistry();
    registry.register({
      name: "file_read",
      description: "Read a file",
      parameterSchema: z.object({ path: z.string() }),
      permissionLevel: "safe",
      execute: async () => ({
        output: "x".repeat(20_000),
        isError: false,
      }),
    });

    const strategy = new TextParsingStrategy();
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client: provider,
        model: "test-model",
        toolRegistry: registry,
        strategy,
        events,
        maxToolResultChars: 500,
      },
      [{ role: "user", content: "Read big.txt" }],
    );

    // Tool result message should be truncated
    const toolResultMsg = result.messages.find(
      (m) => m.role === "user" && m.content.includes("tool_result"),
    );
    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg!.content).toContain("truncated");
    // The raw "x" content should be cut short
    const xCount = (toolResultMsg!.content.match(/x/g) ?? []).length;
    expect(xCount).toBeLessThan(20_000);
  });
});
