import { describe, it, expect, vi } from "vitest";
import { createTransport, type MCPTransportLayer } from "../../../../src/mcp/transports/base.js";
import { StdioTransport } from "../../../../src/mcp/transports/stdio.js";
import { HttpTransport } from "../../../../src/mcp/transports/http.js";
import { SseTransport } from "../../../../src/mcp/transports/sse.js";

// Mock child_process to avoid actual spawns when StdioTransport is instantiated
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

describe("createTransport", () => {
  it("should create a StdioTransport for stdio config", () => {
    const transport = createTransport({
      name: "test-stdio",
      transport: "stdio",
      command: "echo",
    });

    expect(transport).toBeInstanceOf(StdioTransport);
  });

  it("should create an HttpTransport for http config", () => {
    const transport = createTransport({
      name: "test-http",
      transport: "http",
      url: "http://localhost:3000/mcp",
    });

    expect(transport).toBeInstanceOf(HttpTransport);
  });

  it("should create an SseTransport for sse config", () => {
    const transport = createTransport({
      name: "test-sse",
      transport: "sse",
      url: "http://localhost:3000/sse",
    });

    expect(transport).toBeInstanceOf(SseTransport);
  });

  it("should throw for unknown transport type", () => {
    expect(() =>
      createTransport({
        name: "test-unknown",
        transport: "websocket" as "stdio",
      }),
    ).toThrow("Unknown transport type: websocket");
  });

  it("should return objects implementing MCPTransportLayer interface", () => {
    const transport = createTransport({
      name: "test-http",
      transport: "http",
      url: "http://localhost:3000",
    });

    // Verify all interface methods exist
    const layer = transport as MCPTransportLayer;
    expect(typeof layer.connect).toBe("function");
    expect(typeof layer.disconnect).toBe("function");
    expect(typeof layer.sendRequest).toBe("function");
    expect(typeof layer.sendNotification).toBe("function");
    expect(typeof layer.onMessage).toBe("function");
    expect(typeof layer.onError).toBe("function");
    expect(typeof layer.onClose).toBe("function");
  });
});
