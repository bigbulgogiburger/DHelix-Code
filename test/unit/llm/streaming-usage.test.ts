import { describe, it, expect } from "vitest";
import {
  createStreamAccumulator,
  accumulateChunk,
  consumeStream,
} from "../../../src/llm/streaming.js";
import { type ChatChunk } from "../../../src/llm/provider.js";

describe("StreamAccumulator usage tracking", () => {
  it("should parse usage from done chunk", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "text-delta", text: "Hello" });
    acc = accumulateChunk(acc, {
      type: "done",
      usage: { promptTokens: 100, completionTokens: 25, totalTokens: 125 },
    });

    expect(acc.isComplete).toBe(true);
    expect(acc.usage).toEqual({
      promptTokens: 100,
      completionTokens: 25,
      totalTokens: 125,
    });
  });

  it("should have undefined usage when done chunk has no usage", () => {
    let acc = createStreamAccumulator();
    acc = accumulateChunk(acc, { type: "text-delta", text: "Hello" });
    acc = accumulateChunk(acc, { type: "done" });

    expect(acc.isComplete).toBe(true);
    expect(acc.usage).toBeUndefined();
  });

  it("should have undefined usage on fresh accumulator", () => {
    const acc = createStreamAccumulator();
    expect(acc.usage).toBeUndefined();
  });
});

describe("consumeStream usage tracking", () => {
  it("should include usage in final accumulator when stream provides it", async () => {
    async function* streamWithUsage(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Response text" };
      yield {
        type: "done",
        usage: { promptTokens: 500, completionTokens: 150, totalTokens: 650 },
      };
    }

    const result = await consumeStream(streamWithUsage());

    expect(result.isComplete).toBe(true);
    expect(result.usage).toEqual({
      promptTokens: 500,
      completionTokens: 150,
      totalTokens: 650,
    });
  });

  it("should return undefined usage when stream has no usage chunk", async () => {
    async function* streamWithoutUsage(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Response text" };
      yield { type: "done" };
    }

    const result = await consumeStream(streamWithoutUsage());

    expect(result.isComplete).toBe(true);
    expect(result.usage).toBeUndefined();
  });

  it("should pass usage to onComplete callback", async () => {
    let capturedUsage: unknown = undefined;

    async function* streamWithUsage(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Hello" };
      yield {
        type: "done",
        usage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
      };
    }

    await consumeStream(streamWithUsage(), {
      onComplete: (acc) => {
        capturedUsage = acc.usage;
      },
    });

    expect(capturedUsage).toEqual({
      promptTokens: 200,
      completionTokens: 50,
      totalTokens: 250,
    });
  });

  it("should not have usage on partial recovery from stream error", async () => {
    async function* errorStream(): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "Partial" };
      throw new Error("Connection lost");
    }

    const result = await consumeStream(errorStream());

    expect(result.partial).toBe(true);
    expect(result.usage).toBeUndefined();
  });
});
