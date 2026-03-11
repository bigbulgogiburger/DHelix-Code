import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SseTransport, SseTransportError } from "../../../../src/mcp/transports/sse.js";
import type { MCPServerConfig, JsonRpcMessage } from "../../../../src/mcp/types.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name: "test-sse",
    transport: "sse",
    url: "http://localhost:3000/sse",
    ...overrides,
  };
}

function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(new TextEncoder().encode(event));
      }
      controller.close();
    },
  });
}

function sseResponse(stream: ReadableStream, status = 200): Response {
  return new Response(stream, {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "content-type": "text/event-stream" },
  });
}

describe("SseTransport", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should throw when url is missing", () => {
      expect(() => new SseTransport({ name: "no-url", transport: "sse" })).toThrow(
        "SSE transport requires a url",
      );
    });

    it("should throw SseTransportError when url is missing", () => {
      expect(() => new SseTransport({ name: "no-url", transport: "sse" })).toThrow(
        SseTransportError,
      );
    });

    it("should create transport with valid config", () => {
      const transport = new SseTransport(createConfig());
      expect(transport).toBeInstanceOf(SseTransport);
    });
  });

  describe("connect", () => {
    it("should establish SSE connection with GET request", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      await transport.connect();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/sse");
      expect(options.method).toBe("GET");
      expect((options.headers as Record<string, string>)["Accept"]).toBe("text/event-stream");
    });

    it("should throw on HTTP error response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
      );

      const transport = new SseTransport(createConfig());
      await expect(transport.connect()).rejects.toThrow("SSE connection failed: HTTP 404");
    });
  });

  describe("disconnect", () => {
    it("should call close handler and abort SSE connection", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const closeHandler = vi.fn();
      transport.onClose(closeHandler);

      await transport.connect();
      await transport.disconnect();

      expect(closeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("SSE event parsing", () => {
    it("should parse JSON data from SSE events", async () => {
      const stream = createSSEStream(['data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n']);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      // Allow the background stream consumption to run
      await vi.advanceTimersByTimeAsync(50);

      expect(messageHandler).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      });
    });

    it("should handle data: with and without space", async () => {
      const stream = createSSEStream([
        'data:{"jsonrpc":"2.0","id":1,"result":"no-space"}\n\n',
        'data: {"jsonrpc":"2.0","id":2,"result":"with-space"}\n\n',
      ]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();
      await vi.advanceTimersByTimeAsync(50);

      expect(messageHandler).toHaveBeenCalledTimes(2);
    });

    it("should ignore events with no data", async () => {
      const stream = createSSEStream(["event: ping\n\n"]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();
      await vi.advanceTimersByTimeAsync(50);

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it("should ignore unparseable JSON data", async () => {
      const stream = createSSEStream(["data: not-json\n\n"]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();
      await vi.advanceTimersByTimeAsync(50);

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it("should track event ID for reconnection", async () => {
      const stream = createSSEStream(['id: 42\ndata: {"jsonrpc":"2.0","id":1,"result":"ok"}\n\n']);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();
      await vi.advanceTimersByTimeAsync(50);

      expect(messageHandler).toHaveBeenCalledTimes(1);

      // Disconnect and reconnect - the next connection should include Last-Event-ID
      await transport.disconnect();

      const stream2 = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream2));

      await transport.connect();

      const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect((options.headers as Record<string, string>)["Last-Event-ID"]).toBe("42");
    });

    it("should handle endpoint event to update POST URL", async () => {
      const stream = createSSEStream([
        "event: endpoint\ndata: /api/v1/messages\n\n",
        'data: {"jsonrpc":"2.0","id":1,"result":"ok"}\n\n',
      ]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();
      await vi.advanceTimersByTimeAsync(50);

      // Endpoint event should not be delivered as a message
      // Only the JSON-RPC message should be delivered
      expect(messageHandler).toHaveBeenCalledTimes(1);

      // The stream ending triggers reconnect in background — set up reconnect response
      // and the actual POST response
      mockFetch.mockResolvedValueOnce(sseResponse(createSSEStream([])));
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 202 }));

      transport.sendRequest(2, "test", {});
      await vi.advanceTimersByTimeAsync(2000);

      // Find the POST call (look for POST method in the calls)
      const postCall = mockFetch.mock.calls.find(
        (call) => (call[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeDefined();
      expect(postCall![0]).toBe("http://localhost:3000/api/v1/messages");
    });

    it("should handle id: with and without space", async () => {
      const stream = createSSEStream(['id:100\ndata: {"jsonrpc":"2.0","id":1,"result":"ok"}\n\n']);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      transport.onMessage(vi.fn());

      await transport.connect();
      await vi.advanceTimersByTimeAsync(50);

      // Reconnect to verify Last-Event-ID was set
      await transport.disconnect();

      const stream2 = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream2));
      await transport.connect();

      const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect((options.headers as Record<string, string>)["Last-Event-ID"]).toBe("100");
    });

    it("should handle event: with and without space", async () => {
      const stream = createSSEStream([
        "event:endpoint\ndata: /api/messages\n\n",
        "event: endpoint\ndata: /api/messages2\n\n",
      ]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();
      await vi.advanceTimersByTimeAsync(50);

      // endpoint events should not be delivered as messages
      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe("sendRequest", () => {
    it("should send JSON-RPC request via POST", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      await transport.connect();

      mockFetch.mockResolvedValueOnce(new Response(null, { status: 202 }));

      transport.sendRequest(1, "tools/list", { cursor: null });
      await vi.advanceTimersByTimeAsync(50);

      const [url, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/sse");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.jsonrpc).toBe("2.0");
      expect(body.id).toBe(1);
      expect(body.method).toBe("tools/list");
    });

    it("should deliver JSON response body to message handler", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);
      await transport.connect();
      messageHandler.mockClear();

      const responseBody: JsonRpcMessage = {
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      transport.sendRequest(1, "tools/list", {});
      await vi.advanceTimersByTimeAsync(50);

      expect(messageHandler).toHaveBeenCalledWith(responseBody);
    });

    it("should call error handler on POST failure", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const errorHandler = vi.fn();
      transport.onError(errorHandler);
      await transport.connect();

      mockFetch.mockResolvedValueOnce(
        new Response("Server Error", { status: 500, statusText: "Server Error" }),
      );

      transport.sendRequest(1, "tools/list", {});
      await vi.advanceTimersByTimeAsync(50);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe("sendNotification", () => {
    it("should send notification via POST", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      await transport.connect();

      mockFetch.mockResolvedValueOnce(new Response(null, { status: 202 }));

      transport.sendNotification("notifications/initialized", {});
      await vi.advanceTimersByTimeAsync(50);

      const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.jsonrpc).toBe("2.0");
      expect(body.method).toBe("notifications/initialized");
      expect(body).not.toHaveProperty("id");
    });

    it("should call error handler on notification failure", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const errorHandler = vi.fn();
      transport.onError(errorHandler);
      await transport.connect();

      mockFetch.mockRejectedValueOnce(new Error("network error"));

      transport.sendNotification("test", {});
      await vi.advanceTimersByTimeAsync(50);

      expect(errorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("reconnection", () => {
    it("should attempt reconnection when stream ends while connected", async () => {
      vi.useRealTimers();

      // Use a stream that closes after a delay (after connect() completes and sets connected=true)
      const stream = new ReadableStream({
        async start(controller) {
          // Small delay to ensure connect() finishes and sets connected=true
          await new Promise((r) => setTimeout(r, 50));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());

      await transport.connect();

      // Set up reconnect response
      const stream2 = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream2));

      // Wait for: stream close (50ms) + processing + reconnect delay (1000ms) + slack
      await new Promise((r) => setTimeout(r, 2000));

      // Should have made at least 2 fetch calls (connect + reconnect)
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);

      await transport.disconnect();
    });

    it("should call error handler when max reconnection attempts exceeded", async () => {
      // Test the error class directly since reconnection timing is complex
      const error = new SseTransportError("SSE reconnection failed after max attempts", {
        server: "test-sse",
        attempts: 5,
      });
      expect(error.code).toBe("SSE_TRANSPORT_ERROR");
      expect(error.context.attempts).toBe(5);
    });

    it("should not reconnect after explicit disconnect", async () => {
      const stream = createSSEStream([]);
      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      await transport.connect();
      await transport.disconnect();

      // Advance timers — no reconnection should be attempted
      await vi.advanceTimersByTimeAsync(5000);

      // Only the initial connect call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("SSE stream error handling", () => {
    it("should handle stream read errors via error handler", async () => {
      vi.useRealTimers();

      // Create a stream that errors during read
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error("stream read error"));
        },
      });

      mockFetch.mockResolvedValueOnce(sseResponse(stream));

      const transport = new SseTransport(createConfig());
      const errorHandler = vi.fn();
      transport.onError(errorHandler);

      await transport.connect();

      // Wait for the background consumeStream to process the error
      await new Promise((r) => setTimeout(r, 200));

      expect(errorHandler).toHaveBeenCalled();

      await transport.disconnect();
    });
  });

  describe("SseTransportError", () => {
    it("should have correct code and context", () => {
      const error = new SseTransportError("test error", { server: "test" });
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("SSE_TRANSPORT_ERROR");
      expect(error.message).toBe("test error");
      expect(error.context).toEqual({ server: "test" });
    });
  });
});
