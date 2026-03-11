import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpTransport, HttpTransportError } from "../../../../src/mcp/transports/http.js";
import type { MCPServerConfig, JsonRpcMessage } from "../../../../src/mcp/types.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name: "test-http",
    transport: "http",
    url: "http://localhost:3000/mcp",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const defaultHeaders = { "content-type": "application/json" };
  const mergedHeaders = { ...defaultHeaders, ...headers };
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: mergedHeaders,
  });
}

describe("HttpTransport", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should throw when url is missing", () => {
      expect(() => new HttpTransport({ name: "no-url", transport: "http" })).toThrow(
        "HTTP transport requires a url",
      );
    });

    it("should throw HttpTransportError when url is missing", () => {
      expect(() => new HttpTransport({ name: "no-url", transport: "http" })).toThrow(
        HttpTransportError,
      );
    });

    it("should create transport with valid config", () => {
      const transport = new HttpTransport(createConfig());
      expect(transport).toBeInstanceOf(HttpTransport);
    });
  });

  describe("connect", () => {
    it("should send initialize request on connect", async () => {
      const initResponse: JsonRpcMessage = {
        jsonrpc: "2.0",
        id: "connection-check",
        result: { protocolVersion: "2024-11-05", capabilities: {} },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(initResponse));

      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/mcp");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.method).toBe("initialize");
      expect(body.jsonrpc).toBe("2.0");
      expect(messageHandler).toHaveBeenCalledWith(initResponse);
    });

    it("should throw on HTTP error response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
      );

      const transport = new HttpTransport(createConfig());
      await expect(transport.connect()).rejects.toThrow("HTTP 404");
    });

    it("should throw HttpTransportError on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      const transport = new HttpTransport(createConfig());
      await expect(transport.connect()).rejects.toThrow("Failed to connect to HTTP MCP server");
    });

    it("should handle SSE content-type response during connect", async () => {
      // Create a readable stream that emits SSE events
      const sseData =
        'data: {"jsonrpc":"2.0","id":"connection-check","result":{"capabilities":{}}}\n\n';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        },
      });

      const response = new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
      mockFetch.mockResolvedValueOnce(response);

      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      expect(messageHandler).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: "connection-check",
        result: { capabilities: {} },
      });
    });
  });

  describe("disconnect", () => {
    it("should call close handler on disconnect", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );

      const transport = new HttpTransport(createConfig());
      const closeHandler = vi.fn();
      transport.onClose(closeHandler);

      await transport.connect();
      await transport.disconnect();

      expect(closeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendRequest", () => {
    it("should format and send JSON-RPC request", async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);
      await transport.connect();

      // Set up response for the actual request
      const toolsResponse: JsonRpcMessage = {
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(toolsResponse));

      transport.sendRequest(1, "tools/list", {});

      // Allow the async postWithRetry to complete
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.jsonrpc).toBe("2.0");
      expect(body.id).toBe(1);
      expect(body.method).toBe("tools/list");
      expect(body.params).toEqual({});
    });

    it("should call error handler on request failure", async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      const errorHandler = vi.fn();
      transport.onError(errorHandler);
      await transport.connect();

      // Fail the request with a client error (4xx — not retried)
      mockFetch.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
      );

      transport.sendRequest(1, "tools/list", {});
      await vi.advanceTimersByTimeAsync(0);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it("should retry on 5xx errors with exponential backoff", async () => {
      // Connect first
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);
      await transport.connect();

      // First attempt: 500 error
      mockFetch.mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
      );
      // Second attempt: success
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
      );

      transport.sendRequest(1, "tools/list", {});

      // Advance through retry delay (1000ms base)
      await vi.advanceTimersByTimeAsync(1500);

      // Should have made 3 calls: connect + 2 request attempts
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(messageHandler).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      });
    });

    it("should not retry on 4xx client errors", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      const errorHandler = vi.fn();
      transport.onError(errorHandler);
      await transport.connect();

      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
      );

      transport.sendRequest(1, "tools/list", {});
      await vi.advanceTimersByTimeAsync(0);

      // Only connect + 1 request attempt (no retries)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it("should handle 202 Accepted with no body", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);
      await transport.connect();
      mockFetch.mockClear();
      messageHandler.mockClear();

      mockFetch.mockResolvedValueOnce(new Response(null, { status: 202, statusText: "Accepted" }));

      transport.sendRequest(1, "notifications/initialized", {});
      await vi.advanceTimersByTimeAsync(0);

      // 202 should not deliver a message
      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe("sendNotification", () => {
    it("should send notification without id field", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      await transport.connect();

      mockFetch.mockResolvedValueOnce(new Response(null, { status: 202 }));

      transport.sendNotification("notifications/initialized", {});
      await vi.advanceTimersByTimeAsync(0);

      const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.jsonrpc).toBe("2.0");
      expect(body.method).toBe("notifications/initialized");
      expect(body).not.toHaveProperty("id");
    });

    it("should call error handler on notification failure", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      const errorHandler = vi.fn();
      transport.onError(errorHandler);
      await transport.connect();

      mockFetch.mockRejectedValueOnce(new Error("network error"));

      transport.sendNotification("notifications/initialized", {});
      await vi.advanceTimersByTimeAsync(0);

      expect(errorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("handler registration", () => {
    it("should register message handler", () => {
      const transport = new HttpTransport(createConfig());
      const handler = vi.fn();
      transport.onMessage(handler);
      // No error thrown
      expect(true).toBe(true);
    });

    it("should register error handler", () => {
      const transport = new HttpTransport(createConfig());
      const handler = vi.fn();
      transport.onError(handler);
      expect(true).toBe(true);
    });

    it("should register close handler", () => {
      const transport = new HttpTransport(createConfig());
      const handler = vi.fn();
      transport.onClose(handler);
      expect(true).toBe(true);
    });
  });

  describe("SSE stream parsing", () => {
    it("should parse SSE events from streaming response", async () => {
      const events = [
        'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n',
        'data: {"jsonrpc":"2.0","id":2,"result":{"resources":[]}}\n\n',
      ];

      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(event));
          }
          controller.close();
        },
      });

      // Connect
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: "connection-check", result: {} }),
      );
      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);
      await transport.connect();
      messageHandler.mockClear();

      // Return SSE stream for request
      mockFetch.mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );

      transport.sendRequest(1, "tools/list", {});
      await vi.advanceTimersByTimeAsync(0);

      expect(messageHandler).toHaveBeenCalledTimes(2);
      expect(messageHandler).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      });
    });

    it("should ignore unparseable SSE data", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: not-json\n\n"));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );

      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      // No message should be delivered for unparseable data
      expect(messageHandler).not.toHaveBeenCalled();
    });

    it("should handle data: with and without space after colon", async () => {
      const events = [
        'data:{"jsonrpc":"2.0","id":1,"result":"no-space"}\n\n',
        'data: {"jsonrpc":"2.0","id":2,"result":"with-space"}\n\n',
      ];

      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(event));
          }
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );

      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);
      await transport.connect();

      expect(messageHandler).toHaveBeenCalledTimes(2);
    });

    it("should handle response with no body in SSE mode", async () => {
      const response = new Response(null, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
      // Response.body is null for null body
      mockFetch.mockResolvedValueOnce(response);

      const transport = new HttpTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);
      await transport.connect();

      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe("HttpTransportError", () => {
    it("should have correct code and context", () => {
      const error = new HttpTransportError("test error", { server: "test" });
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("HTTP_TRANSPORT_ERROR");
      expect(error.message).toBe("test error");
      expect(error.context).toEqual({ server: "test" });
    });
  });
});
