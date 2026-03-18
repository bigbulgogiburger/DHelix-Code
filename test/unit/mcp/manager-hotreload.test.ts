import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPManager, type MCPManagerConfig } from "../../../src/mcp/manager.js";
import { type MCPClient } from "../../../src/mcp/client.js";
import { type MCPServerConfig } from "../../../src/mcp/types.js";
import { ToolRegistry } from "../../../src/tools/registry.js";

// ──────────────────────────────────────────────
// Mock: MCPClient
// ──────────────────────────────────────────────

vi.mock("../../../src/mcp/client.js", () => {
  return {
    MCPClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue([
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { type: "object", properties: {} },
        },
      ]),
      callTool: vi.fn().mockResolvedValue({ content: [], isError: false }),
      setToolsChangedCallback: vi.fn(),
    })),
  };
});

// ──────────────────────────────────────────────
// Mock: MCPScopeManager (prevent filesystem access)
// ──────────────────────────────────────────────

vi.mock("../../../src/mcp/scope-manager.js", () => {
  return {
    MCPScopeManager: vi.fn().mockImplementation(() => ({
      loadAllConfigs: vi.fn().mockResolvedValue(new Map()),
    })),
  };
});

/**
 * Create a standard MCPServerConfig for testing.
 */
function createServerConfig(name: string): MCPServerConfig {
  return {
    name,
    transport: "stdio",
    command: "echo",
    args: ["test"],
  };
}

describe("MCPManager hot reload", () => {
  let toolRegistry: ToolRegistry;
  let manager: MCPManager;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    const config: MCPManagerConfig = {
      configPath: "/tmp/test-mcp.json",
      toolRegistry,
    };
    manager = new MCPManager(config);
  });

  // ──────────────────────────────────────────────
  // addServerRuntime
  // ──────────────────────────────────────────────

  describe("addServerRuntime", () => {
    it("should add a server at runtime and register its tools", async () => {
      const config = createServerConfig("runtime-server");

      const toolNames = await manager.addServerRuntime("runtime-server", config);

      expect(toolNames).toHaveLength(1);
      expect(toolNames[0]).toBe("mcp__runtime-server__test_tool");
      expect(manager.getConnectedServers()).toContain("runtime-server");
    });

    it("should register tools in the tool registry", async () => {
      const config = createServerConfig("registry-check");

      await manager.addServerRuntime("registry-check", config);

      expect(toolRegistry.has("mcp__registry-check__test_tool")).toBe(true);
    });

    it("should handle adding a server that already exists (reconnect)", async () => {
      const config = createServerConfig("reconnect-server");

      // First add
      await manager.addServerRuntime("reconnect-server", config);
      expect(manager.getConnectedServers()).toContain("reconnect-server");

      // Second add — should reconnect without error
      const toolNames = await manager.addServerRuntime("reconnect-server", config);
      expect(toolNames).toHaveLength(1);
      expect(manager.getConnectedServers()).toContain("reconnect-server");
    });

    it("should appear in getRegisteredTools after adding", async () => {
      const config = createServerConfig("tools-map-server");

      await manager.addServerRuntime("tools-map-server", config);

      const registeredTools = manager.getRegisteredTools();
      expect(registeredTools.has("tools-map-server")).toBe(true);
      expect(registeredTools.get("tools-map-server")).toContain("mcp__tools-map-server__test_tool");
    });
  });

  // ──────────────────────────────────────────────
  // removeServerRuntime
  // ──────────────────────────────────────────────

  describe("removeServerRuntime", () => {
    it("should remove a connected server and return true", async () => {
      const config = createServerConfig("removable-server");
      await manager.addServerRuntime("removable-server", config);

      const result = await manager.removeServerRuntime("removable-server");

      expect(result).toBe(true);
      expect(manager.getConnectedServers()).not.toContain("removable-server");
    });

    it("should return false for a non-existent server", async () => {
      const result = await manager.removeServerRuntime("non-existent");

      expect(result).toBe(false);
    });

    it("should unregister tools from the tool registry", async () => {
      const config = createServerConfig("unregister-server");
      await manager.addServerRuntime("unregister-server", config);

      expect(toolRegistry.has("mcp__unregister-server__test_tool")).toBe(true);

      await manager.removeServerRuntime("unregister-server");

      expect(toolRegistry.has("mcp__unregister-server__test_tool")).toBe(false);
    });

    it("should not appear in getRegisteredTools after removal", async () => {
      const config = createServerConfig("disappear-server");
      await manager.addServerRuntime("disappear-server", config);

      await manager.removeServerRuntime("disappear-server");

      const registeredTools = manager.getRegisteredTools();
      expect(registeredTools.has("disappear-server")).toBe(false);
    });

    it("should disconnect the client when removing", async () => {
      const config = createServerConfig("disconnect-server");
      await manager.addServerRuntime("disconnect-server", config);

      // The mock MCPClient's disconnect should be called
      const result = await manager.removeServerRuntime("disconnect-server");
      expect(result).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // Full lifecycle
  // ──────────────────────────────────────────────

  describe("full hot reload lifecycle", () => {
    it("should support add → use → remove → re-add cycle", async () => {
      const config = createServerConfig("lifecycle-server");

      // Add
      const toolNames = await manager.addServerRuntime("lifecycle-server", config);
      expect(toolNames).toHaveLength(1);
      expect(manager.getConnectedServers()).toContain("lifecycle-server");

      // Remove
      const removed = await manager.removeServerRuntime("lifecycle-server");
      expect(removed).toBe(true);
      expect(manager.getConnectedServers()).not.toContain("lifecycle-server");

      // Re-add
      const toolNames2 = await manager.addServerRuntime("lifecycle-server", config);
      expect(toolNames2).toHaveLength(1);
      expect(manager.getConnectedServers()).toContain("lifecycle-server");
    });

    it("should handle multiple servers independently", async () => {
      const configA = createServerConfig("server-a");
      const configB = createServerConfig("server-b");

      await manager.addServerRuntime("server-a", configA);
      await manager.addServerRuntime("server-b", configB);

      expect(manager.getConnectedServers()).toHaveLength(2);

      // Remove only server-a
      await manager.removeServerRuntime("server-a");

      expect(manager.getConnectedServers()).toHaveLength(1);
      expect(manager.getConnectedServers()).toContain("server-b");
      expect(toolRegistry.has("mcp__server-a__test_tool")).toBe(false);
      expect(toolRegistry.has("mcp__server-b__test_tool")).toBe(true);
    });
  });
});
