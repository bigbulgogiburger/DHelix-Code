/**
 * McpStreamHandler 단위 테스트
 *
 * 검증 범위:
 * - handleStreamResponse: 정상 스트림, 빈 스트림, 에러 중단, 청크 분할
 * - collectStream: 전체 수집, 타임아웃
 * - isStreamable: 지원/미지원 서버 판단
 * - mcpProgressToToolStreamEvent: ToolStreamEvent 변환
 * - progress 콜백 호출 검증
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  McpStreamHandler,
  McpStreamError,
  mcpProgressToToolStreamEvent,
  type McpStreamConfig,
  type McpServerInfo,
  type McpStreamProgress,
} from "../../../src/mcp/streaming.js";

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

/**
 * 배열로부터 AsyncIterable을 생성하는 헬퍼
 */
async function* fromArray<T>(items: readonly T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

/**
 * 타임아웃 후 값을 yield하는 지연 AsyncIterable 헬퍼
 */
async function* withDelay<T>(items: readonly T[], delayMs: number): AsyncGenerator<T> {
  for (const item of items) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    yield item;
  }
}

/**
 * 스트림의 모든 청크를 배열로 수집하는 헬퍼
 */
async function collectChunks(stream: AsyncGenerator<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

// ─── McpStreamError ────────────────────────────────────────────────────────────

describe("McpStreamError", () => {
  it("should extend BaseError with MCP_STREAM_ERROR code", () => {
    const error = new McpStreamError("test stream error", { serverId: "my-server" });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("test stream error");
    expect(error.code).toBe("MCP_STREAM_ERROR");
    expect(error.context).toEqual({ serverId: "my-server" });
  });

  it("should use empty context by default", () => {
    const error = new McpStreamError("error without context");
    expect(error.context).toEqual({});
  });
});

// ─── McpStreamHandler — handleStreamResponse ──────────────────────────────────

describe("McpStreamHandler.handleStreamResponse", () => {
  let handler: McpStreamHandler;

  beforeEach(() => {
    handler = new McpStreamHandler({ enabled: true });
  });

  it("should yield chunks from a normal stream of strings", async () => {
    const items = ["hello", " ", "world"];
    const chunks = await collectChunks(
      handler.handleStreamResponse(fromArray(items), "server-1", "tool_a"),
    );
    expect(chunks.join("")).toBe("hello world");
  });

  it("should yield chunks from a stream of objects (JSON serialized)", async () => {
    const items = [{ result: "ok", count: 3 }, { done: true }];
    const chunks = await collectChunks(
      handler.handleStreamResponse(fromArray(items), "server-1", "tool_b"),
    );
    const joined = chunks.join("");
    expect(joined).toContain('"result":"ok"');
    expect(joined).toContain('"done":true');
  });

  it("should return an empty stream for empty input", async () => {
    const chunks = await collectChunks(
      handler.handleStreamResponse(fromArray([]), "server-1", "tool_c"),
    );
    expect(chunks).toHaveLength(0);
  });

  it("should skip null and undefined items", async () => {
    const items: unknown[] = ["first", null, undefined, "last"];
    const chunks = await collectChunks(
      handler.handleStreamResponse(fromArray(items), "server-1", "tool_d"),
    );
    expect(chunks.join("")).toBe("firstlast");
  });

  it("should split large items into chunkSize chunks", async () => {
    const largeItem = "x".repeat(10_000);
    const smallHandler = new McpStreamHandler({ enabled: true, chunkSize: 4_096 });
    const chunks = await collectChunks(
      smallHandler.handleStreamResponse(fromArray([largeItem]), "server-1", "tool_e"),
    );

    // 10,000 bytes / 4,096 = 3 chunks (ceil)
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // All chunks combined should equal the original
    expect(chunks.join("")).toBe(largeItem);
    // No single chunk should exceed chunkSize
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4_096);
    }
  });

  it("should throw McpStreamError when stream exceeds timeoutMs", async () => {
    const fastTimeoutHandler = new McpStreamHandler({
      enabled: true,
      timeoutMs: 50, // 50ms — very short
    });

    // Items with 30ms delay each — second item will exceed timeout
    const slowStream = withDelay(["item1", "item2", "item3"], 30);

    await expect(
      collectChunks(fastTimeoutHandler.handleStreamResponse(slowStream, "server-1", "slow_tool")),
    ).rejects.toThrow(McpStreamError);
  });

  it("should include serverId and toolName in timeout error context", async () => {
    const fastTimeoutHandler = new McpStreamHandler({
      enabled: true,
      timeoutMs: 10,
    });

    const slowStream = withDelay(["item1"], 50);

    try {
      await collectChunks(
        fastTimeoutHandler.handleStreamResponse(slowStream, "test-server", "test_tool"),
      );
      expect.fail("Expected McpStreamError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(McpStreamError);
      const streamErr = err as McpStreamError;
      expect(streamErr.context).toMatchObject({
        serverId: "test-server",
        toolName: "test_tool",
      });
    }
  });

  it("should call onProgress callback after each item", async () => {
    const progressEvents: McpStreamProgress[] = [];
    const trackingHandler = new McpStreamHandler({
      enabled: true,
      onProgress: (event) => progressEvents.push(event),
    });

    const items = ["chunk1", "chunk2", "chunk3"];
    await collectChunks(trackingHandler.handleStreamResponse(fromArray(items), "srv", "t"));

    expect(progressEvents).toHaveLength(3);
    // Each subsequent event should have more bytes and chunks
    expect(progressEvents[0].chunksReceived).toBe(1);
    expect(progressEvents[1].chunksReceived).toBe(2);
    expect(progressEvents[2].chunksReceived).toBe(3);
  });

  it("should track bytesReceived in progress callback", async () => {
    const progressEvents: McpStreamProgress[] = [];
    const trackingHandler = new McpStreamHandler({
      enabled: true,
      onProgress: (event) => progressEvents.push(event),
    });

    const items = ["hello", "world"]; // 5 + 5 = 10 bytes
    await collectChunks(trackingHandler.handleStreamResponse(fromArray(items), "srv", "tool"));

    expect(progressEvents[0].bytesReceived).toBe(5);
    expect(progressEvents[1].bytesReceived).toBe(10);
  });

  it("should report correct serverId and toolName in progress", async () => {
    let lastProgress: McpStreamProgress | undefined;
    const trackingHandler = new McpStreamHandler({
      enabled: true,
      onProgress: (event) => {
        lastProgress = event;
      },
    });

    await collectChunks(
      trackingHandler.handleStreamResponse(fromArray(["data"]), "my-server", "my_tool"),
    );

    expect(lastProgress?.serverId).toBe("my-server");
    expect(lastProgress?.toolName).toBe("my_tool");
  });

  it("should use default serverId and toolName when not provided", async () => {
    let capturedProgress: McpStreamProgress | undefined;
    const trackingHandler = new McpStreamHandler({
      enabled: true,
      onProgress: (p) => {
        capturedProgress = p;
      },
    });

    await collectChunks(trackingHandler.handleStreamResponse(fromArray(["data"])));

    expect(capturedProgress?.serverId).toBe("unknown");
    expect(capturedProgress?.toolName).toBe("unknown");
  });

  it("should handle a stream that yields numeric values", async () => {
    const items = [42, 100, 0];
    const chunks = await collectChunks(
      handler.handleStreamResponse(fromArray(items), "srv", "tool"),
    );
    expect(chunks.join("")).toBe("42100" + "0");
  });
});

// ─── McpStreamHandler — collectStream ─────────────────────────────────────────

describe("McpStreamHandler.collectStream", () => {
  let handler: McpStreamHandler;

  beforeEach(() => {
    handler = new McpStreamHandler({ enabled: true });
  });

  it("should collect all chunks into a single string", async () => {
    const stream = fromArray(["hello", " ", "world"]);
    const result = await handler.collectStream(stream);
    expect(result).toBe("hello world");
  });

  it("should return empty string for empty stream", async () => {
    const result = await handler.collectStream(fromArray([]));
    expect(result).toBe("");
  });

  it("should concatenate chunks without separator", async () => {
    const chunks = ["abc", "def", "ghi"];
    const result = await handler.collectStream(fromArray(chunks));
    expect(result).toBe("abcdefghi");
  });

  it("should collect the output of handleStreamResponse", async () => {
    const items = ["part1", "part2", "part3"];
    const stream = handler.handleStreamResponse(fromArray(items), "srv", "tool");
    const result = await handler.collectStream(stream);
    expect(result).toBe("part1part2part3");
  });

  it("should collect large streamed content correctly", async () => {
    const largeContent = "z".repeat(50_000);
    const smallHandler = new McpStreamHandler({ enabled: true, chunkSize: 1_000 });
    const stream = smallHandler.handleStreamResponse(fromArray([largeContent]), "srv", "tool");
    const result = await handler.collectStream(stream);
    expect(result).toBe(largeContent);
    expect(result.length).toBe(50_000);
  });

  it("should propagate errors from the stream", async () => {
    async function* errorStream(): AsyncGenerator<string> {
      yield "first";
      throw new McpStreamError("Simulated stream error");
    }

    await expect(handler.collectStream(errorStream())).rejects.toThrow(McpStreamError);
  });
});

// ─── McpStreamHandler — isStreamable ──────────────────────────────────────────

describe("McpStreamHandler.isStreamable", () => {
  it("should return true for sse transport", () => {
    const handler = new McpStreamHandler({ enabled: true });
    const server: McpServerInfo = { name: "sse-server", transport: "sse" };
    expect(handler.isStreamable(server)).toBe(true);
  });

  it("should return true for http transport", () => {
    const handler = new McpStreamHandler({ enabled: true });
    const server: McpServerInfo = { name: "http-server", transport: "http" };
    expect(handler.isStreamable(server)).toBe(true);
  });

  it("should return false for stdio transport", () => {
    const handler = new McpStreamHandler({ enabled: true });
    const server: McpServerInfo = { name: "stdio-server", transport: "stdio" };
    expect(handler.isStreamable(server)).toBe(false);
  });

  it("should return false when handler is disabled regardless of transport", () => {
    const handler = new McpStreamHandler({ enabled: false });

    expect(handler.isStreamable({ name: "s", transport: "sse" })).toBe(false);
    expect(handler.isStreamable({ name: "s", transport: "http" })).toBe(false);
    expect(handler.isStreamable({ name: "s", transport: "stdio" })).toBe(false);
  });

  it("should respect streamingEnabled override when true on stdio", () => {
    const handler = new McpStreamHandler({ enabled: true });
    const server: McpServerInfo = {
      name: "custom-server",
      transport: "stdio",
      streamingEnabled: true,
    };
    expect(handler.isStreamable(server)).toBe(true);
  });

  it("should respect streamingEnabled override when false on sse", () => {
    const handler = new McpStreamHandler({ enabled: true });
    const server: McpServerInfo = {
      name: "sse-server",
      transport: "sse",
      streamingEnabled: false,
    };
    expect(handler.isStreamable(server)).toBe(false);
  });

  it("should return false when handler disabled even with streamingEnabled: true", () => {
    const handler = new McpStreamHandler({ enabled: false });
    const server: McpServerInfo = {
      name: "srv",
      transport: "sse",
      streamingEnabled: true,
    };
    // Handler disabled takes priority over per-server override
    expect(handler.isStreamable(server)).toBe(false);
  });
});

// ─── McpStreamHandler — 생성자 기본값 ────────────────────────────────────────

describe("McpStreamHandler constructor defaults", () => {
  it("should use default chunkSize of 4096 when not specified", async () => {
    const handler = new McpStreamHandler({ enabled: true });
    const largeItem = "a".repeat(8_192); // 2x default chunk size
    const chunks = await collectChunks(
      handler.handleStreamResponse(fromArray([largeItem]), "srv", "tool"),
    );
    // Should be split into at least 2 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("should use config when provided", () => {
    const config: McpStreamConfig = {
      enabled: true,
      chunkSize: 1_024,
      timeoutMs: 5_000,
    };
    // No throw = config accepted correctly
    expect(() => new McpStreamHandler(config)).not.toThrow();
  });

  it("should create handler with no config (all defaults)", () => {
    expect(() => new McpStreamHandler()).not.toThrow();
  });
});

// ─── mcpProgressToToolStreamEvent ────────────────────────────────────────────

describe("mcpProgressToToolStreamEvent", () => {
  const progress: McpStreamProgress = {
    serverId: "my-server",
    toolName: "my_tool",
    bytesReceived: 1_024,
    chunksReceived: 5,
    elapsedMs: 200,
  };

  it("should return a ToolStreamEvent with type=progress", () => {
    const event = mcpProgressToToolStreamEvent(progress, "call-abc");
    expect(event.type).toBe("progress");
  });

  it("should use the provided toolCallId", () => {
    const event = mcpProgressToToolStreamEvent(progress, "call-xyz-123");
    expect(event.toolCallId).toBe("call-xyz-123");
  });

  it("should use toolName from progress", () => {
    const event = mcpProgressToToolStreamEvent(progress, "id");
    expect(event.toolName).toBe("my_tool");
  });

  it("should include serverId and chunk count in data message", () => {
    const event = mcpProgressToToolStreamEvent(progress, "id");
    expect(event.data).toContain("my-server");
    expect(event.data).toContain("5");
    expect(event.data).toContain("1024");
  });

  it("should include bytesReceived in metadata.bytesProcessed", () => {
    const event = mcpProgressToToolStreamEvent(progress, "id");
    expect(event.metadata?.bytesProcessed).toBe(1_024);
  });

  it("should include elapsedMs in metadata", () => {
    const event = mcpProgressToToolStreamEvent(progress, "id");
    expect(event.metadata?.elapsedMs).toBe(200);
  });

  it("should produce a complete ToolStreamEvent shape", () => {
    const event = mcpProgressToToolStreamEvent(progress, "call-1");
    expect(event).toMatchObject({
      type: "progress",
      toolCallId: "call-1",
      toolName: "my_tool",
    });
    expect(typeof event.data).toBe("string");
    expect(event.data.length).toBeGreaterThan(0);
  });

  it("should handle zero bytes and chunks", () => {
    const emptyProgress: McpStreamProgress = {
      serverId: "empty-server",
      toolName: "empty_tool",
      bytesReceived: 0,
      chunksReceived: 0,
      elapsedMs: 0,
    };
    const event = mcpProgressToToolStreamEvent(emptyProgress, "id");
    expect(event.type).toBe("progress");
    expect(event.metadata?.bytesProcessed).toBe(0);
  });
});

// ─── 통합 시나리오 ─────────────────────────────────────────────────────────────

describe("McpStreamHandler integration", () => {
  it("should handle a full streaming workflow with progress tracking", async () => {
    const progressLog: McpStreamProgress[] = [];

    const handler = new McpStreamHandler({
      enabled: true,
      chunkSize: 10,
      onProgress: (p) => progressLog.push(p),
    });

    const serverPayloads = [
      { type: "partial", data: "Hello" },
      { type: "partial", data: ", World" },
      { type: "complete", data: "!" },
    ];

    const stream = handler.handleStreamResponse(
      fromArray(serverPayloads),
      "integration-server",
      "greet_tool",
    );
    const result = await handler.collectStream(stream);

    // All JSON strings should be present in the result
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    expect(result).toContain("complete");

    // Progress should have been called for each item
    expect(progressLog).toHaveLength(3);
    expect(progressLog[2].chunksReceived).toBe(3);
    expect(progressLog[2].serverId).toBe("integration-server");

    // Progress events should convert to ToolStreamEvents
    const toolEvent = mcpProgressToToolStreamEvent(progressLog[2], "call-42");
    expect(toolEvent.type).toBe("progress");
    expect(toolEvent.toolName).toBe("greet_tool");
    expect(toolEvent.toolCallId).toBe("call-42");
  });

  it("should handle isStreamable check before streaming", async () => {
    const handler = new McpStreamHandler({ enabled: true });

    const sseServer: McpServerInfo = { name: "sse", transport: "sse" };
    const stdioServer: McpServerInfo = { name: "stdio", transport: "stdio" };

    expect(handler.isStreamable(sseServer)).toBe(true);
    expect(handler.isStreamable(stdioServer)).toBe(false);

    // Only stream if streamable
    if (handler.isStreamable(sseServer)) {
      const result = await handler.collectStream(
        handler.handleStreamResponse(fromArray(["streamed"]), "sse", "tool"),
      );
      expect(result).toBe("streamed");
    }
  });

  it("should use vi.fn() spy to verify onProgress is called", async () => {
    const onProgress = vi.fn();
    const handler = new McpStreamHandler({ enabled: true, onProgress });

    await collectChunks(
      handler.handleStreamResponse(fromArray(["a", "b", "c"]), "srv", "tool"),
    );

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining<Partial<McpStreamProgress>>({
        chunksReceived: 1,
        serverId: "srv",
        toolName: "tool",
      }),
    );
  });
});
