import { describe, it, expect } from "vitest";
import { selectStrategy, forceStrategy } from "../../../src/llm/tool-call-strategy.js";
import { NativeFunctionCallingStrategy } from "../../../src/llm/strategies/native-function-calling.js";
import { TextParsingStrategy } from "../../../src/llm/strategies/text-parsing.js";
import { type ChatMessage, type ToolDefinitionForLLM } from "../../../src/llm/provider.js";

const sampleTools: ToolDefinitionForLLM[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    },
  },
];

const sampleMessages: ChatMessage[] = [
  { role: "system", content: "You are helpful." },
  { role: "user", content: "Read test.ts" },
];

describe("selectStrategy", () => {
  it("should return native strategy for GPT models", () => {
    expect(selectStrategy("gpt-4").name).toBe("native");
  });

  it("should return native strategy for Claude models", () => {
    expect(selectStrategy("claude-3-opus").name).toBe("native");
  });

  it("should return native strategy for unknown models (safe default)", () => {
    expect(selectStrategy("local-llama").name).toBe("native");
  });

  it("should return native strategy for llama3.1+ (supports tools)", () => {
    expect(selectStrategy("llama3.1").name).toBe("native");
  });

  it("should return text-parsing strategy for llama3 base (no tool support)", () => {
    expect(selectStrategy("llama3").name).toBe("text-parsing");
  });

  it("should return text-parsing strategy for deepseek-coder (no tool support)", () => {
    expect(selectStrategy("deepseek-coder").name).toBe("text-parsing");
  });
});

describe("forceStrategy", () => {
  it("should force native strategy", () => {
    expect(forceStrategy("native").name).toBe("native");
  });

  it("should force text-parsing strategy", () => {
    expect(forceStrategy("text-parsing").name).toBe("text-parsing");
  });
});

describe("NativeFunctionCallingStrategy", () => {
  const strategy = new NativeFunctionCallingStrategy();

  it("should pass messages and tools through in prepareRequest", () => {
    const prepared = strategy.prepareRequest(sampleMessages, sampleTools);
    expect(prepared.messages).toBe(sampleMessages);
    expect(prepared.tools).toBe(sampleTools);
  });

  it("should extract tool calls from toolCalls array", () => {
    const calls = strategy.extractToolCalls("", [
      { id: "tc_1", name: "read_file", arguments: '{"path":"test.ts"}' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("read_file");
    expect(calls[0].arguments).toEqual({ path: "test.ts" });
  });

  it("should handle invalid JSON arguments gracefully", () => {
    const calls = strategy.extractToolCalls("", [
      { id: "tc_1", name: "read_file", arguments: "not-json" },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].arguments).toEqual({});
  });

  it("should format tool results as tool messages", () => {
    const messages = strategy.formatToolResults([
      { id: "tc_1", output: "file content here", isError: false },
      { id: "tc_2", output: "file not found", isError: true },
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("tool");
    expect(messages[0].content).toBe("file content here");
    expect(messages[0].toolCallId).toBe("tc_1");
    expect(messages[1].content).toBe("Error: file not found");
  });
});

describe("TextParsingStrategy", () => {
  const strategy = new TextParsingStrategy();

  it("should inject tool instructions as system message", () => {
    const prepared = strategy.prepareRequest(sampleMessages, sampleTools);
    // Should have original messages + injected tool system message
    expect(prepared.messages.length).toBe(sampleMessages.length + 1);
    // The tool message should be inserted after existing system messages
    expect(prepared.messages[1].role).toBe("system");
    expect(prepared.messages[1].content).toContain("read_file");
    // Should NOT include tools in the request (embedded in prompt)
    expect(prepared.tools).toBeUndefined();
  });

  it("should return messages unchanged when no tools", () => {
    const prepared = strategy.prepareRequest(sampleMessages, []);
    expect(prepared.messages).toBe(sampleMessages);
  });

  it("should extract XML tool calls from content", () => {
    const content = `Let me read that file.
<tool_call>
<name>read_file</name>
<arguments>{"path": "test.ts"}</arguments>
</tool_call>`;

    const calls = strategy.extractToolCalls(content, []);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("read_file");
    expect(calls[0].arguments).toEqual({ path: "test.ts" });
    expect(calls[0].id).toMatch(/^tc_text_/);
  });

  it("should extract multiple tool calls", () => {
    const content = `<tool_call>
<name>read_file</name>
<arguments>{"path": "a.ts"}</arguments>
</tool_call>
<tool_call>
<name>read_file</name>
<arguments>{"path": "b.ts"}</arguments>
</tool_call>`;

    const calls = strategy.extractToolCalls(content, []);
    expect(calls).toHaveLength(2);
  });

  it("should handle invalid JSON in XML arguments", () => {
    const content = `<tool_call>
<name>read_file</name>
<arguments>not valid json</arguments>
</tool_call>`;

    const calls = strategy.extractToolCalls(content, []);
    expect(calls).toHaveLength(1);
    expect(calls[0].arguments).toEqual({ raw: "not valid json" });
  });

  it("should return empty array when no tool calls in content", () => {
    const calls = strategy.extractToolCalls("Just a regular response.", []);
    expect(calls).toHaveLength(0);
  });

  it("should format tool results as user messages with XML", () => {
    const messages = strategy.formatToolResults([
      { id: "tc_1", output: "file content", isError: false },
      { id: "tc_2", output: "error occurred", isError: true },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("tool_result");
    expect(messages[0].content).toContain("SUCCESS");
    expect(messages[0].content).toContain("ERROR");
  });

  it("should return empty array for empty results", () => {
    const messages = strategy.formatToolResults([]);
    expect(messages).toHaveLength(0);
  });

  it("should strip tool calls from content", () => {
    const content = `Some reasoning here.
<tool_call>
<name>read_file</name>
<arguments>{"path": "test.ts"}</arguments>
</tool_call>
More text.`;

    const stripped = TextParsingStrategy.stripToolCalls(content);
    expect(stripped).not.toContain("tool_call");
    expect(stripped).toContain("Some reasoning here.");
    expect(stripped).toContain("More text.");
  });
});
