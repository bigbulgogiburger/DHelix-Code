import { describe, it, expect } from "vitest";
import { MCPClient, MCPClientError } from "../../../src/mcp/client.js";

describe("MCPClient", () => {
  it("should start in disconnected state", () => {
    const client = new MCPClient({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    expect(client.getState()).toBe("disconnected");
    expect(client.getCapabilities()).toBeNull();
  });

  it("should throw for unsupported transport", async () => {
    const client = new MCPClient({
      name: "test",
      transport: "sse",
    });
    await expect(client.connect()).rejects.toThrow('Transport "sse" not yet supported');
  });

  it("should throw for stdio without command", async () => {
    const client = new MCPClient({
      name: "test",
      transport: "stdio",
    });
    await expect(client.connect()).rejects.toThrow("requires a command");
  });

  it("should throw when calling tools while disconnected", async () => {
    const client = new MCPClient({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    await expect(client.listTools()).rejects.toThrow("Not connected");
    await expect(client.callTool("test", {})).rejects.toThrow("Not connected");
    await expect(client.listResources()).rejects.toThrow("Not connected");
    await expect(client.readResource("test://foo")).rejects.toThrow("Not connected");
  });

  it("should be idempotent on disconnect when already disconnected", async () => {
    const client = new MCPClient({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    // Should not throw
    await client.disconnect();
    expect(client.getState()).toBe("disconnected");
  });

  it("should set tools changed callback", () => {
    const client = new MCPClient({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    const callback = () => {};
    // Should not throw
    client.setToolsChangedCallback(callback);
  });
});

describe("MCPClientError", () => {
  it("should be an instance of Error with proper code", () => {
    const error = new MCPClientError("test error", { server: "test" });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("MCP_CLIENT_ERROR");
    expect(error.message).toBe("test error");
    expect(error.context).toEqual({ server: "test" });
  });
});
