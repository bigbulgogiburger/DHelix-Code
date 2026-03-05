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
});
