import { describe, it, expect } from "vitest";
import { NativeFunctionCallingStrategy } from "../../../src/llm/strategies/native-function-calling.js";

describe("NativeFunctionCallingStrategy", () => {
  const strategy = new NativeFunctionCallingStrategy();

  it("should have name 'native'", () => {
    expect(strategy.name).toBe("native");
  });

  describe("prepareRequest", () => {
    it("should pass through messages and tools", () => {
      const messages = [{ role: "user" as const, content: "test" }];
      const tools = [
        {
          type: "function" as const,
          function: { name: "test", description: "test", parameters: {} },
        },
      ];
      const result = strategy.prepareRequest(messages, tools);
      expect(result.messages).toBe(messages);
      expect(result.tools).toBe(tools);
    });
  });

  describe("extractToolCalls", () => {
    it("should extract tool calls from toolCalls array", () => {
      const toolCalls = [{ id: "tc1", name: "file_read", arguments: '{"path":"test.ts"}' }];
      const result = strategy.extractToolCalls("", toolCalls);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("file_read");
      expect(result[0].arguments).toEqual({ path: "test.ts" });
    });

    it("should handle invalid JSON in arguments", () => {
      const toolCalls = [{ id: "tc1", name: "test", arguments: "not json" }];
      const result = strategy.extractToolCalls("", toolCalls);
      expect(result[0].arguments).toEqual({});
    });

    it("should handle empty tool calls", () => {
      const result = strategy.extractToolCalls("", []);
      expect(result).toHaveLength(0);
    });
  });

  describe("formatToolResults", () => {
    it("should format successful results", () => {
      const results = [{ id: "tc1", output: "file contents", isError: false }];
      const messages = strategy.formatToolResults(results);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("tool");
      expect(messages[0].content).toBe("file contents");
    });

    it("should prefix error results", () => {
      const results = [{ id: "tc1", output: "file not found", isError: true }];
      const messages = strategy.formatToolResults(results);
      expect(messages[0].content).toBe("Error: file not found");
    });
  });
});
