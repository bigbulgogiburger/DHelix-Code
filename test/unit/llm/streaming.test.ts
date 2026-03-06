import { describe, it, expect } from "vitest";
import {
  createStreamAccumulator,
  accumulateChunk,
  consumeStream,
} from "../../../src/llm/streaming.js";
import { type ChatChunk } from "../../../src/llm/provider.js";

describe("StreamAccumulator", () => {
  it("should create empty accumulator", () => {
    const acc = createStreamAccumulator();
    expect(acc.text).toBe("");
    expect(acc.toolCalls).toEqual([]);
    expect(acc.isComplete).toBe(false);
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
