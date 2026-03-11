import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPScopeManager } from "../../../src/mcp/scope-manager.js";
import type { MCPServerConfig } from "../../../src/mcp/types.js";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

// Import the mocked readFile
import { readFile } from "node:fs/promises";
const mockReadFile = vi.mocked(readFile);

describe("MCPScopeManager", () => {
  const workDir = "/project";

  beforeEach(() => {
    mockReadFile.mockReset();
  });

  describe("getConfigPath", () => {
    it("should return correct path for local scope", () => {
      const manager = new MCPScopeManager(workDir);
      expect(manager.getConfigPath("local")).toBe(join(workDir, ".dbcode", "mcp-local.json"));
    });

    it("should return correct path for project scope", () => {
      const manager = new MCPScopeManager(workDir);
      expect(manager.getConfigPath("project")).toBe(join(workDir, ".dbcode", "mcp.json"));
    });

    it("should return correct path for user scope", () => {
      const manager = new MCPScopeManager(workDir);
      expect(manager.getConfigPath("user")).toBe(join(homedir(), ".dbcode", "mcp-servers.json"));
    });
  });

  describe("getConfigsForScope", () => {
    it("should return empty array when config file does not exist", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file or directory"));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("local");

      expect(configs).toEqual([]);
    });

    it("should return empty array for malformed JSON", async () => {
      mockReadFile.mockResolvedValueOnce("not valid json {{{");

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("project");

      expect(configs).toEqual([]);
    });

    it("should return empty array when parsed value is null", async () => {
      mockReadFile.mockResolvedValueOnce("null");

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("user");

      expect(configs).toEqual([]);
    });

    it("should return empty array when parsed value is not an object", async () => {
      mockReadFile.mockResolvedValueOnce('"a string"');

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("user");

      expect(configs).toEqual([]);
    });

    it("should return empty array when servers key is missing", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ version: 1 }));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("local");

      expect(configs).toEqual([]);
    });

    it("should parse stdio server config correctly", async () => {
      const configFile = {
        servers: {
          "my-server": {
            transport: "stdio",
            command: "node",
            args: ["server.js"],
            env: { API_KEY: "secret" },
          },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(configFile));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("local");

      expect(configs).toHaveLength(1);
      const config = configs[0];
      expect(config.name).toBe("my-server");
      expect(config.transport).toBe("stdio");
      expect(config.command).toBe("node");
      expect(config.args).toEqual(["server.js"]);
      expect(config.env).toEqual({ API_KEY: "secret" });
      expect(config.scope).toBe("local");
    });

    it("should parse http server config correctly", async () => {
      const configFile = {
        servers: {
          "remote-server": {
            transport: "http",
            url: "http://localhost:3000/mcp",
          },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(configFile));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("project");

      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe("remote-server");
      expect(configs[0].transport).toBe("http");
      expect(configs[0].url).toBe("http://localhost:3000/mcp");
      expect(configs[0].scope).toBe("project");
    });

    it("should default transport to stdio when not specified", async () => {
      const configFile = {
        servers: {
          "default-transport": {
            command: "my-server",
          },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(configFile));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("user");

      expect(configs).toHaveLength(1);
      expect(configs[0].transport).toBe("stdio");
    });

    it("should handle multiple servers in one config file", async () => {
      const configFile = {
        servers: {
          server1: { command: "s1" },
          server2: { transport: "http" as const, url: "http://example.com" },
          server3: { transport: "sse" as const, url: "http://example.com/sse" },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(configFile));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("local");

      expect(configs).toHaveLength(3);
      expect(configs.map((c) => c.name)).toEqual(["server1", "server2", "server3"]);
    });

    it("should create copies of args and env (immutability)", async () => {
      const configFile = {
        servers: {
          "test-server": {
            command: "node",
            args: ["a", "b"],
            env: { KEY: "val" },
          },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(configFile));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("local");

      expect(configs[0].args).toEqual(["a", "b"]);
      expect(configs[0].env).toEqual({ KEY: "val" });
      // They should be copies, not the same reference
      expect(configs[0].args).not.toBe(configFile.servers["test-server"].args);
      expect(configs[0].env).not.toBe(configFile.servers["test-server"].env);
    });

    it("should handle server entries with no optional fields", async () => {
      const configFile = {
        servers: {
          "minimal-server": {},
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(configFile));

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.getConfigsForScope("local");

      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe("minimal-server");
      expect(configs[0].transport).toBe("stdio");
      expect(configs[0].command).toBeUndefined();
      expect(configs[0].args).toBeUndefined();
      expect(configs[0].url).toBeUndefined();
      expect(configs[0].env).toBeUndefined();
    });
  });

  describe("loadAllConfigs", () => {
    function setupScopeConfigs(
      local: Record<string, unknown> | null,
      project: Record<string, unknown> | null,
      user: Record<string, unknown> | null,
    ): void {
      // loadAllConfigs iterates in reverse priority: user, project, local
      // getConfigsForScope reads from the file path for each scope
      // We need to return the right config for the right file path
      mockReadFile.mockImplementation(async (path: unknown) => {
        const p = path as string;
        if (p.includes("mcp-local.json") && local) return JSON.stringify(local);
        if (
          p.includes("mcp.json") &&
          !p.includes("mcp-local") &&
          !p.includes("mcp-servers") &&
          project
        )
          return JSON.stringify(project);
        if (p.includes("mcp-servers.json") && user) return JSON.stringify(user);
        throw new Error("ENOENT");
      });
    }

    it("should merge configs from all scopes", async () => {
      setupScopeConfigs(
        { servers: { local: { command: "local-cmd" } } },
        { servers: { project: { command: "project-cmd" } } },
        { servers: { global: { command: "global-cmd" } } },
      );

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.loadAllConfigs();

      expect(configs.size).toBe(3);
      expect(configs.get("local")?.command).toBe("local-cmd");
      expect(configs.get("project")?.command).toBe("project-cmd");
      expect(configs.get("global")?.command).toBe("global-cmd");
    });

    it("should use local scope priority over project and user", async () => {
      setupScopeConfigs(
        { servers: { shared: { command: "local-version" } } },
        { servers: { shared: { command: "project-version" } } },
        { servers: { shared: { command: "user-version" } } },
      );

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.loadAllConfigs();

      expect(configs.size).toBe(1);
      const shared = configs.get("shared") as MCPServerConfig;
      expect(shared.command).toBe("local-version");
      expect(shared.scope).toBe("local");
    });

    it("should use project scope priority over user", async () => {
      setupScopeConfigs(
        null,
        { servers: { shared: { command: "project-version" } } },
        { servers: { shared: { command: "user-version" } } },
      );

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.loadAllConfigs();

      expect(configs.size).toBe(1);
      const shared = configs.get("shared") as MCPServerConfig;
      expect(shared.command).toBe("project-version");
      expect(shared.scope).toBe("project");
    });

    it("should handle all config files missing gracefully", async () => {
      setupScopeConfigs(null, null, null);

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.loadAllConfigs();

      expect(configs.size).toBe(0);
    });

    it("should handle some config files missing", async () => {
      setupScopeConfigs({ servers: { local: { command: "local-cmd" } } }, null, null);

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.loadAllConfigs();

      expect(configs.size).toBe(1);
      expect(configs.get("local")?.command).toBe("local-cmd");
    });

    it("should handle malformed JSON in one scope", async () => {
      mockReadFile.mockImplementation(async (path: unknown) => {
        const p = path as string;
        if (p.includes("mcp-local.json")) return "{{invalid json}}";
        if (p.includes("mcp.json") && !p.includes("mcp-local") && !p.includes("mcp-servers"))
          return JSON.stringify({ servers: { valid: { command: "cmd" } } });
        throw new Error("ENOENT");
      });

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.loadAllConfigs();

      // Only the valid project config should be loaded
      expect(configs.size).toBe(1);
      expect(configs.get("valid")?.command).toBe("cmd");
    });

    it("should return a Map keyed by server name", async () => {
      setupScopeConfigs(
        {
          servers: {
            alpha: { command: "a" },
            beta: { transport: "http", url: "http://localhost" },
          },
        },
        null,
        null,
      );

      const manager = new MCPScopeManager(workDir);
      const configs = await manager.loadAllConfigs();

      expect(configs).toBeInstanceOf(Map);
      expect([...configs.keys()]).toEqual(["alpha", "beta"]);
    });
  });
});
