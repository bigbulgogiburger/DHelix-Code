import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpTransport } from "../../../src/mcp/transports/http.js";
import type { MCPServerConfig, JsonRpcMessage } from "../../../src/mcp/types.js";

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

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  const defaultHeaders = { "content-type": "application/json" };
  const mergedHeaders = { ...defaultHeaders, ...headers };
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: mergedHeaders,
  });
}

describe("HTTP transport session management", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should store session ID from initialize response headers", async () => {
    const initResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: "connection-check",
      result: { protocolVersion: "2024-11-05", capabilities: {} },
    };
    mockFetch.mockResolvedValueOnce(
      jsonResponse(initResponse, 200, { "Mcp-Session-Id": "session-abc-123" }),
    );

    const transport = new HttpTransport(createConfig());
    const messageHandler = vi.fn();
    transport.onMessage(messageHandler);

    await transport.connect();

    // Send a subsequent request and verify session ID is included in headers
    const toolsResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(toolsResponse));

    transport.sendRequest(1, "tools/list", {});
    await vi.advanceTimersByTimeAsync(0);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Mcp-Session-Id"]).toBe("session-abc-123");
  });

  it("should not include session ID header when no session ID received", async () => {
    const initResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: "connection-check",
      result: { protocolVersion: "2024-11-05", capabilities: {} },
    };
    // No Mcp-Session-Id header in response
    mockFetch.mockResolvedValueOnce(jsonResponse(initResponse));

    const transport = new HttpTransport(createConfig());
    transport.onMessage(vi.fn());

    await transport.connect();

    const toolsResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(toolsResponse));

    transport.sendRequest(1, "tools/list", {});
    await vi.advanceTimersByTimeAsync(0);

    const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Mcp-Session-Id"]).toBeUndefined();
  });

  it("should update session ID from subsequent response headers", async () => {
    // Connect with initial session ID
    const initResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: "connection-check",
      result: { capabilities: {} },
    };
    mockFetch.mockResolvedValueOnce(
      jsonResponse(initResponse, 200, { "Mcp-Session-Id": "session-1" }),
    );

    const transport = new HttpTransport(createConfig());
    transport.onMessage(vi.fn());
    await transport.connect();

    // Second request returns a new session ID
    const toolsResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    };
    mockFetch.mockResolvedValueOnce(
      jsonResponse(toolsResponse, 200, { "Mcp-Session-Id": "session-2" }),
    );

    transport.sendRequest(1, "tools/list", {});
    await vi.advanceTimersByTimeAsync(0);

    // Third request should use the updated session ID
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 2, result: {} }),
    );

    transport.sendRequest(2, "resources/list", {});
    await vi.advanceTimersByTimeAsync(0);

    const [, options] = mockFetch.mock.calls[2] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Mcp-Session-Id"]).toBe("session-2");
  });

  it("should include auth token in headers when set", async () => {
    const initResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: "connection-check",
      result: { capabilities: {} },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(initResponse));

    const transport = new HttpTransport(createConfig());
    transport.onMessage(vi.fn());
    transport.setAuthToken("my-bearer-token");

    await transport.connect();

    // Verify the connect request included the auth header
    const [, connectOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    const connectHeaders = connectOptions.headers as Record<string, string>;
    expect(connectHeaders["Authorization"]).toBe("Bearer my-bearer-token");

    // Verify subsequent requests also include the auth header
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }),
    );

    transport.sendRequest(1, "tools/list", {});
    await vi.advanceTimersByTimeAsync(0);

    const [, requestOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
    const requestHeaders = requestOptions.headers as Record<string, string>;
    expect(requestHeaders["Authorization"]).toBe("Bearer my-bearer-token");
  });

  it("should not include Authorization header when no auth token set", async () => {
    const initResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: "connection-check",
      result: { capabilities: {} },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(initResponse));

    const transport = new HttpTransport(createConfig());
    transport.onMessage(vi.fn());

    await transport.connect();

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("should include both session ID and auth token when both present", async () => {
    const initResponse: JsonRpcMessage = {
      jsonrpc: "2.0",
      id: "connection-check",
      result: { capabilities: {} },
    };
    mockFetch.mockResolvedValueOnce(
      jsonResponse(initResponse, 200, { "Mcp-Session-Id": "sid-xyz" }),
    );

    const transport = new HttpTransport(createConfig());
    transport.onMessage(vi.fn());
    transport.setAuthToken("token-abc");

    await transport.connect();

    // Subsequent request should have both headers
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }),
    );

    transport.sendRequest(1, "tools/list", {});
    await vi.advanceTimersByTimeAsync(0);

    const [, options] = mockFetch.mock.calls[1] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Mcp-Session-Id"]).toBe("sid-xyz");
    expect(headers["Authorization"]).toBe("Bearer token-abc");
  });
});
