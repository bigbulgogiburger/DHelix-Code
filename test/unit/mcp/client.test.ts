import { describe, it, expect, afterEach } from "vitest";
import { MCPClient, MCPClientError } from "../../../src/mcp/client.js";
import { join } from "node:path";

const mockServerPath = join(process.cwd(), "test", "fixtures", "mock-mcp-server.mjs");

describe("MCPClient", () => {
  let client: MCPClient | null = null;

  afterEach(async () => {
    if (client) {
      try {
        await client.disconnect();
      } catch {
        /* ignore */
      }
      client = null;
    }
  });

  it("should start in disconnected state", () => {
    client = new MCPClient({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    expect(client.getState()).toBe("disconnected");
    expect(client.getCapabilities()).toBeNull();
  });

  it("should throw for unsupported transport", async () => {
    client = new MCPClient({
      name: "test",
      transport: "sse",
    });
    await expect(client.connect()).rejects.toThrow('Transport "sse" not yet supported');
  });

  it("should throw for stdio without command", async () => {
    client = new MCPClient({
      name: "test",
      transport: "stdio",
    });
    await expect(client.connect()).rejects.toThrow("requires a command");
  });

  it("should throw when calling tools while disconnected", async () => {
    client = new MCPClient({
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
    client = new MCPClient({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    await client.disconnect();
    expect(client.getState()).toBe("disconnected");
  });

  it("should set tools changed callback", () => {
    client = new MCPClient({
      name: "test",
      transport: "stdio",
      command: "echo",
    });
    const callback = () => {};
    client.setToolsChangedCallback(callback);
  });

  it("should connect to a mock MCP server", async () => {
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
    });

    await client.connect();
    expect(client.getState()).toBe("connected");
    expect(client.getCapabilities()).toEqual({
      tools: { listChanged: true },
    });
  }, 10000);

  it("should be idempotent on connect when already connected", async () => {
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
    });

    await client.connect();
    // Calling connect again should not throw
    await client.connect();
    expect(client.getState()).toBe("connected");
  }, 10000);

  it("should list tools from mock server", async () => {
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
    });

    await client.connect();
    const tools = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("echo");
    expect(tools[0].description).toBe("Echo a message");
  }, 10000);

  it("should call a tool on mock server", async () => {
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
    });

    await client.connect();
    const result = await client.callTool("echo", { message: "hello" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe("Echo: hello");
  }, 10000);

  it("should list resources from mock server", async () => {
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
    });

    await client.connect();
    const resources = await client.listResources();
    expect(resources).toHaveLength(1);
    expect(resources[0].uri).toBe("test://hello");
    expect(resources[0].name).toBe("hello");
  }, 10000);

  it("should read a resource from mock server", async () => {
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
    });

    await client.connect();
    const content = await client.readResource("test://hello");
    expect(content).toContain("Resource content for test://hello");
  }, 10000);

  it("should disconnect from mock server", async () => {
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
    });

    await client.connect();
    expect(client.getState()).toBe("connected");

    await client.disconnect();
    expect(client.getState()).toBe("disconnected");
  }, 10000);

  it("should handle connect failure with non-existent command", async () => {
    client = new MCPClient({
      name: "bad-server",
      transport: "stdio",
      command: "nonexistent-command-xyz-123",
    });

    await expect(client.connect()).rejects.toThrow();
    expect(client.getState()).toBe("error");
  }, 10000);

  it("should resolve env vars in config", async () => {
    process.env.TEST_MCP_VAR = "resolved-value";
    client = new MCPClient({
      name: "mock-server",
      transport: "stdio",
      command: "node",
      args: [mockServerPath],
      env: {
        CUSTOM_VAR: "${TEST_MCP_VAR}",
        WITH_DEFAULT: "${NONEXISTENT_VAR:-default-val}",
      },
    });

    await client.connect();
    expect(client.getState()).toBe("connected");
    delete process.env.TEST_MCP_VAR;
  }, 10000);
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
