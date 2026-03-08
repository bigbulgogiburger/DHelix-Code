import { describe, it, expect } from "vitest";
import {
  createStreamAccumulator,
  accumulateChunk,
  consumeStream,
  DEFAULT_MAX_BUFFER_BYTES,
} from "../../../src/llm/streaming.js";
import { type ChatChunk } from "../../../src/llm/provider.js";

describe("StreamAccumulator", () => {
  it("should create empty accumulator", () => {
    const acc = createStreamAccumulator();
    expect(acc.text).toBe("");
    expect(acc.toolCalls).toEqual([]);
    expect(acc.isComplete).toBe(false);
    expect(acc.bufferBytes).toBe(0);
  });

  it("should accumulate text deltas", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "text-delta", text: "Hello" });
    acc = accumulateChunk(acc, { type: "text-delta", text: " world" });

    expect(acc.text).toBe("Hello world");
    expect(acc.isComplete).toBe(false);
  });

  it("should handle done chunk", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "text-delta", text: "test" });
    acc = accumulateChunk(acc, { type: "done" });

    expect(acc.text).toBe("test");
    expect(acc.isComplete).toBe(true);
  });

  it("should accumulate new tool calls", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, {
      type: "tool-call-delta",
      toolCall: { id: "tc-1", name: "file_read", arguments: '{"path":' },
    });
    acc = accumulateChunk(acc, {
      type: "tool-call-delta",
      toolCall: { id: "tc-1", arguments: '"test.ts"}' },
    });

    expect(acc.toolCalls).toHaveLength(1);
    expect(acc.toolCalls[0].name).toBe("file_read");
    expect(acc.toolCalls[0].arguments).toBe('{"path":"test.ts"}');
  });
});

describe("consumeStream", () => {
  it("should consume async iterable of chunks", async () => {
    async function* generateChunks(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Hello" };
      yield { type: "text-delta", text: " world" };
      yield { type: "done" };
    }

    const result = await consumeStream(generateChunks());
    expect(result.text).toBe("Hello world");
    expect(result.isComplete).toBe(true);
  });

  it("should call onTextDelta callback", async () => {
    const deltas: string[] = [];

    async function* generateChunks(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Hello" };
      yield { type: "text-delta", text: " world" };
      yield { type: "done" };
    }

    await consumeStream(generateChunks(), {
      onTextDelta: (text) => deltas.push(text),
    });

    expect(deltas).toEqual(["Hello", " world"]);
  });

  it("should call onToolCallDelta and onComplete callbacks", async () => {
    const toolDeltas: unknown[] = [];
    let completedAcc: unknown = null;

    async function* generateChunks(): AsyncIterable<ChatChunk> {
      yield {
        type: "tool-call-delta",
        toolCall: { id: "tc-1", name: "read_file", arguments: '{"path":"x"}' },
      };
      yield { type: "done" };
    }

    await consumeStream(generateChunks(), {
      onToolCallDelta: (tc) => toolDeltas.push(tc),
      onComplete: (acc) => {
        completedAcc = acc;
      },
    });

    expect(toolDeltas).toHaveLength(1);
    expect(completedAcc).not.toBeNull();
  });
});

describe("accumulateChunk edge cases", () => {
  it("should ignore tool-call-delta without toolCall", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "tool-call-delta" });
    expect(acc.toolCalls).toEqual([]);
  });

  it("should ignore tool-call-delta without id or name for new call", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, {
      type: "tool-call-delta",
      toolCall: { arguments: "partial" },
    });
    expect(acc.toolCalls).toEqual([]);
  });

  it("should handle unknown chunk types gracefully", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "unknown-type" as ChatChunk["type"] });
    expect(acc.text).toBe("");
    expect(acc.isComplete).toBe(false);
  });

  it("should handle text-delta with undefined text", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "text-delta" });
    expect(acc.text).toBe("");
  });

  it("should handle tool-call-delta with undefined arguments on new call", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, {
      type: "tool-call-delta",
      toolCall: { id: "tc-1", name: "my_tool" },
    });
    expect(acc.toolCalls).toHaveLength(1);
    expect(acc.toolCalls[0].arguments).toBe("");
  });

  it("should handle tool-call-delta with undefined arguments on existing call", () => {
    let acc = createStreamAccumulator();
    // First: create a tool call
    acc = accumulateChunk(acc, {
      type: "tool-call-delta",
      toolCall: { id: "tc-1", name: "my_tool", arguments: '{"a":' },
    });
    // Second: append with undefined arguments
    acc = accumulateChunk(acc, {
      type: "tool-call-delta",
      toolCall: { id: "tc-1" },
    });
    expect(acc.toolCalls).toHaveLength(1);
    expect(acc.toolCalls[0].arguments).toBe('{"a":');
  });
});

describe("consumeStream partial recovery", () => {
  it("should return partial results when stream errors after accumulating text content", async () => {
    async function* errorMidStream(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Hello " };
      yield { type: "text-delta", text: "world" };
      throw new Error("Stream connection lost");
    }

    const result = await consumeStream(errorMidStream());

    expect(result.text).toBe("Hello world");
    expect(result.partial).toBe(true);
    expect(result.isComplete).toBe(false);
  });

  it("should return partial results when stream errors after accumulating tool calls", async () => {
    async function* errorMidToolStream(): AsyncIterable<ChatChunk> {
      yield {
        type: "tool-call-delta",
        toolCall: { id: "tc-1", name: "file_read", arguments: '{"path":"test.ts"}' },
      };
      throw new Error("Stream disconnected");
    }

    const result = await consumeStream(errorMidToolStream());

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("file_read");
    expect(result.partial).toBe(true);
    expect(result.isComplete).toBe(false);
  });

  it("should rethrow error when stream fails with no accumulated content", async () => {
    async function* immediateError(): AsyncIterable<ChatChunk> {
      throw new Error("Connection refused");
    }

    await expect(consumeStream(immediateError())).rejects.toThrow("Connection refused");
  });

  it("should set partial flag correctly when stream completes normally", async () => {
    async function* normalStream(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Complete response" };
      yield { type: "done" };
    }

    const result = await consumeStream(normalStream());

    expect(result.text).toBe("Complete response");
    expect(result.isComplete).toBe(true);
    // partial should be undefined (not set) on normal completion
    expect(result.partial).toBeUndefined();
  });

  it("should return partial with both text and tool calls on mid-stream error", async () => {
    async function* mixedErrorStream(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "I will read the file" };
      yield {
        type: "tool-call-delta",
        toolCall: { id: "tc-1", name: "file_read", arguments: '{"path":' },
      };
      throw new Error("Network timeout");
    }

    const result = await consumeStream(mixedErrorStream());

    expect(result.text).toBe("I will read the file");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.partial).toBe(true);
  });

  it("should still call onTextDelta callbacks before error occurs", async () => {
    const deltas: string[] = [];

    async function* errorAfterChunks(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "first" };
      yield { type: "text-delta", text: " second" };
      throw new Error("Stream lost");
    }

    const result = await consumeStream(errorAfterChunks(), {
      onTextDelta: (text) => deltas.push(text),
    });

    expect(deltas).toEqual(["first", " second"]);
    expect(result.partial).toBe(true);
    expect(result.text).toBe("first second");
  });
});

describe("backpressure", () => {
  it("should export DEFAULT_MAX_BUFFER_BYTES as 1MB", () => {
    expect(DEFAULT_MAX_BUFFER_BYTES).toBe(1024 * 1024);
  });

  it("should track bufferBytes as text accumulates", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "text-delta", text: "Hello" });
    expect(acc.bufferBytes).toBe(5);

    acc = accumulateChunk(acc, { type: "text-delta", text: " world" });
    expect(acc.bufferBytes).toBe(11);
  });

  it("should trim text when buffer exceeds configured limit", () => {
    const smallLimit = { maxBufferBytes: 20 };
    let acc = createStreamAccumulator();

    // Add text that fits within the limit
    acc = accumulateChunk(acc, { type: "text-delta", text: "0123456789" }, smallLimit);
    expect(acc.trimmed).toBeFalsy();
    expect(acc.text).toBe("0123456789");

    // Add more text that pushes past the limit
    acc = accumulateChunk(acc, { type: "text-delta", text: "ABCDEFGHIJKLM" }, smallLimit);
    expect(acc.trimmed).toBe(true);
    // Text should be trimmed (front half removed)
    expect(acc.text.length).toBeLessThan(24);
  });

  it("should keep trimmed flag once set", () => {
    const smallLimit = { maxBufferBytes: 10 };
    let acc = createStreamAccumulator();

    acc = accumulateChunk(acc, { type: "text-delta", text: "0123456789ABC" }, smallLimit);
    expect(acc.trimmed).toBe(true);

    // Even small subsequent chunks preserve the trimmed flag
    acc = accumulateChunk(acc, { type: "text-delta", text: "x" }, smallLimit);
    expect(acc.trimmed).toBe(true);
  });

  it("should not trim when within default 1MB limit", () => {
    let acc = createStreamAccumulator();
    // Normal text well within 1MB
    const text = "a".repeat(1000);
    acc = accumulateChunk(acc, { type: "text-delta", text });
    expect(acc.trimmed).toBeFalsy();
    expect(acc.text).toBe(text);
    expect(acc.bufferBytes).toBe(1000);
  });

  it("should pass backpressure config through consumeStream", async () => {
    const smallLimit = { maxBufferBytes: 30 };

    async function* generateLargeChunks(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "A".repeat(20) };
      yield { type: "text-delta", text: "B".repeat(20) };
      yield { type: "done" };
    }

    const result = await consumeStream(generateLargeChunks(), undefined, smallLimit);
    expect(result.isComplete).toBe(true);
    expect(result.trimmed).toBe(true);
    expect(result.text.length).toBeLessThan(40);
  });

  it("should handle multi-byte characters in byte counting", () => {
    let acc = createStreamAccumulator();
    // Korean characters are 3 bytes each in UTF-8
    acc = accumulateChunk(acc, { type: "text-delta", text: "ㅎ" });
    expect(acc.bufferBytes).toBe(3);
  });
});
