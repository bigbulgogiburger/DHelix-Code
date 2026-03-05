import { describe, it, expect } from "vitest";
import { TextParsingStrategy } from "../../../src/llm/strategies/text-parsing.js";
import { type ToolDefinitionForLLM } from "../../../src/llm/provider.js";

describe("TextParsingStrategy", () => {
  const strategy = new TextParsingStrategy();

  const sampleTools: ToolDefinitionForLLM[] = [
    {
      type: "function",
      function: {
        name: "file_read",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
          },
          required: ["path"],
        },
      },
    },
  ];

  describe("name", () => {
    it("should be text-parsing", () => {
      expect(strategy.name).toBe("text-parsing");
    });
  });

  describe("prepareRequest", () => {
    it("should inject tool instructions as system message", () => {
      const messages = [
        { role: "system" as const, content: "You are an assistant." },
        { role: "user" as const, content: "Read index.ts" },
      ];

      const prepared = strategy.prepareRequest(messages, sampleTools);

      // Should have one more message (tool instructions)
      expect(prepared.messages.length).toBe(3);

      // Tool instructions should be between system and user
      expect(prepared.messages[0].role).toBe("system");
      expect(prepared.messages[1].role).toBe("system");
      expect(prepared.messages[1].content).toContain("file_read");
      expect(prepared.messages[1].content).toContain("<tool_call>");
      expect(prepared.messages[2].role).toBe("user");

      // Should NOT pass tools (embedded in prompt)
      expect(prepared.tools).toBeUndefined();
    });

    it("should not inject if no tools", () => {
      const messages = [{ role: "user" as const, content: "Hello" }];
      const prepared = strategy.prepareRequest(messages, []);

      expect(prepared.messages).toEqual(messages);
    });
  });

  describe("extractToolCalls", () => {
    it("should extract a single tool call from XML", () => {
      const content = `Let me read that file for you.

<tool_call>
<name>file_read</name>
<arguments>{"path": "src/index.ts"}</arguments>
</tool_call>`;

      const calls = strategy.extractToolCalls(content, []);

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("file_read");
      expect(calls[0].arguments).toEqual({ path: "src/index.ts" });
      expect(calls[0].id).toMatch(/^tc_text_/);
    });

    it("should extract multiple tool calls", () => {
      const content = `I'll read both files.

<tool_call>
<name>file_read</name>
<arguments>{"path": "a.ts"}</arguments>
</tool_call>

<tool_call>
<name>file_read</name>
<arguments>{"path": "b.ts"}</arguments>
</tool_call>`;

      const calls = strategy.extractToolCalls(content, []);

      expect(calls).toHaveLength(2);
      expect(calls[0].arguments).toEqual({ path: "a.ts" });
      expect(calls[1].arguments).toEqual({ path: "b.ts" });
    });

    it("should return empty array when no tool calls", () => {
      const content = "I don't need to use any tools for this.";
      const calls = strategy.extractToolCalls(content, []);

      expect(calls).toHaveLength(0);
    });

    it("should handle invalid JSON arguments gracefully", () => {
      const content = `<tool_call>
<name>file_read</name>
<arguments>not valid json</arguments>
</tool_call>`;

      const calls = strategy.extractToolCalls(content, []);

      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("file_read");
      expect(calls[0].arguments).toEqual({ raw: "not valid json" });
    });
  });

  describe("formatToolResults", () => {
    it("should format results as user messages with XML", () => {
      const results = [{ id: "tc_1", output: "file content here", isError: false }];

      const messages = strategy.formatToolResults(results);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toContain("tool_result");
      expect(messages[0].content).toContain("SUCCESS");
      expect(messages[0].content).toContain("file content here");
    });

    it("should format error results correctly", () => {
      const results = [{ id: "tc_1", output: "File not found", isError: true }];

      const messages = strategy.formatToolResults(results);

      expect(messages[0].content).toContain("ERROR");
      expect(messages[0].content).toContain("File not found");
    });

    it("should handle empty results", () => {
      const messages = strategy.formatToolResults([]);
      expect(messages).toHaveLength(0);
    });
  });

  describe("stripToolCalls", () => {
    it("should remove tool call XML from content", () => {
      const content = `Here's my reasoning.

<tool_call>
<name>file_read</name>
<arguments>{"path": "a.ts"}</arguments>
</tool_call>

And some more text.`;

      const stripped = TextParsingStrategy.stripToolCalls(content);

      expect(stripped).toContain("Here's my reasoning.");
      expect(stripped).toContain("And some more text.");
      expect(stripped).not.toContain("<tool_call>");
      expect(stripped).not.toContain("file_read");
    });
  });
});
