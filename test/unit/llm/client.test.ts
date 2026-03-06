import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenAI SDK before importing the client
const mockCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor() {}
    },
  };
});

// Mock token-counter to avoid tiktoken dependency
vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: (text: string) => Math.ceil(text.length / 4),
}));

import { OpenAICompatibleClient } from "../../../src/llm/client.js";
import { type ChatMessage } from "../../../src/llm/provider.js";

describe("OpenAICompatibleClient", () => {
  let client: OpenAICompatibleClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenAICompatibleClient({
      baseURL: "http://localhost:11434/v1",
      apiKey: "test-key",
      timeout: 5000,
    });
  });

  describe("chat", () => {
    it("should make a basic chat request and return formatted response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "Hello!", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const response = await client.chat({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(response.content).toBe("Hello!");
      expect(response.toolCalls).toEqual([]);
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(response.finishReason).toBe("stop");
    });

    it("should handle tool calls in response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "tc_1",
                  type: "function",
                  function: { name: "read_file", arguments: '{"path":"test.ts"}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      });

      const response = await client.chat({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Read test.ts" }],
        tools: [
          {
            type: "function",
            function: { name: "read_file", description: "Read a file", parameters: {} },
          },
        ],
        temperature: 0,
        maxTokens: 100,
      });

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls[0].name).toBe("read_file");
      expect(response.toolCalls[0].arguments).toBe('{"path":"test.ts"}');
      expect(response.finishReason).toBe("tool_calls");
    });

    it("should throw LLMError when no response choice", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      });

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("No response choice from LLM");
    });

    it("should wrap SDK errors in LLMError", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("LLM chat request failed");
    });

    it("should convert tool messages with toolCallId", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "Got it!", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      });

      const messages: ChatMessage[] = [
        { role: "user", content: "Read file" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "tc_1", name: "read_file", arguments: '{"path":"x"}' }],
        },
        { role: "tool", content: "file contents", toolCallId: "tc_1" },
      ];

      const response = await client.chat({
        model: "gpt-4o",
        messages,
        maxTokens: 100,
      });

      expect(response.content).toBe("Got it!");
      // Verify the messages were passed correctly
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].role).toBe("assistant");
      expect(callArgs.messages[1].tool_calls).toHaveLength(1);
      expect(callArgs.messages[2].role).toBe("tool");
      expect(callArgs.messages[2].tool_call_id).toBe("tc_1");
    });

    it("should convert system to developer role for o1 models", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "OK", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      await client.chat({
        model: "o1",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hi" },
        ],
        maxTokens: 100,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe("developer");
      // Should not include temperature for o1
      expect(callArgs.temperature).toBeUndefined();
    });

    it("should not include tools when model does not support them", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "OK", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      await client.chat({
        model: "deepseek-coder",
        messages: [{ role: "user", content: "Hi" }],
        tools: [
          {
            type: "function",
            function: { name: "test", description: "test", parameters: {} },
          },
        ],
        maxTokens: 100,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      // deepseek-coder does not support tools
      expect(callArgs.tools).toBeUndefined();
    });
  });

  describe("stream", () => {
    it("should yield text chunks from stream", async () => {
      const chunks = [
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: { content: " world" } }] },
        { choices: [{ delta: {} }] },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      });

      const result: string[] = [];
      for await (const chunk of client.stream({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      })) {
        if (chunk.type === "text-delta" && chunk.text) {
          result.push(chunk.text);
        }
      }

      expect(result).toEqual(["Hello", " world"]);
    });

    it("should yield tool call delta chunks", async () => {
      const chunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "tc_1",
                    function: { name: "read_file", arguments: '{"path":' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '"test.ts"}' },
                  },
                ],
              },
            },
          ],
        },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      });

      const toolDeltas: unknown[] = [];
      for await (const chunk of client.stream({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Read file" }],
        tools: [
          {
            type: "function",
            function: { name: "read_file", description: "Read", parameters: {} },
          },
        ],
        maxTokens: 100,
      })) {
        if (chunk.type === "tool-call-delta") {
          toolDeltas.push(chunk.toolCall);
        }
      }

      expect(toolDeltas).toHaveLength(2);
    });

    it("should wrap stream errors in LLMError", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Stream connection failed"));

      const streamIt = async () => {
        const chunks: unknown[] = [];
        for await (const chunk of client.stream({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        })) {
          chunks.push(chunk);
        }
        return chunks;
      };

      await expect(streamIt()).rejects.toThrow("LLM stream request failed");
    });
  });

  describe("countTokens", () => {
    it("should count tokens", () => {
      const count = client.countTokens("Hello world");
      expect(count).toBeGreaterThan(0);
    });
  });
});
