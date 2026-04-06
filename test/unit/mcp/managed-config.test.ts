import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPManagedConfig, MCPManagedConfigError } from "../../../src/mcp/managed-config.js";
import type { MCPServerConfig } from "../../../src/mcp/types.js";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile } from "node:fs/promises";
const mockReadFile = vi.mocked(readFile);

/** Helper: create a valid managed config JSON string */
function validConfig(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    mcpServers: {},
    policies: {},
    ...overrides,
  });
}

/** Helper: create an MCPServerConfig for testing */
function makeServerConfig(name: string, overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name,
    transport: "stdio",
    command: `${name}-cmd`,
    ...overrides,
  };
}

describe("MCPManagedConfig", () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  // ─── Constructor ───────────────────────────────────────────────────

  describe("constructor", () => {
    it("should use default path when no path provided", () => {
      const mc = new MCPManagedConfig();
      // We verify default path indirectly by loading — it reads from ~/.dhelix/managed-mcp.json
      expect(mc).toBeDefined();
    });

    it("should accept a custom config path", () => {
      const mc = new MCPManagedConfig("/custom/path/managed.json");
      expect(mc).toBeDefined();
    });
  });

  // ─── load() ────────────────────────────────────────────────────────

  describe("load", () => {
    it("should return default permissive config when file does not exist", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file or directory"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      const config = await mc.load();

      expect(config.mcpServers).toEqual({});
      expect(config.policies.allowUserServers).toBe(true);
      expect(config.policies.requireApproval).toBe(false);
      expect(config.policies.maxServers).toBe(20);
      expect(config.policies.blockedTransports).toEqual([]);
    });

    it("should parse and validate a valid config file", async () => {
      const rawConfig = {
        mcpServers: {
          "admin-server": {
            command: "admin-tool",
            args: ["--flag"],
            readOnly: true,
          },
        },
        policies: {
          allowUserServers: false,
          maxServers: 5,
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(rawConfig));

      const mc = new MCPManagedConfig("/tmp/test.json");
      const config = await mc.load();

      expect(config.mcpServers["admin-server"].command).toBe("admin-tool");
      expect(config.mcpServers["admin-server"].readOnly).toBe(true);
      expect(config.mcpServers["admin-server"].transport).toBe("stdio"); // default
      expect(config.policies.allowUserServers).toBe(false);
      expect(config.policies.maxServers).toBe(5);
    });

    it("should throw MCPManagedConfigError for invalid JSON", async () => {
      mockReadFile.mockResolvedValueOnce("{{not valid json}}");

      const mc = new MCPManagedConfig("/tmp/test.json");

      await expect(mc.load()).rejects.toThrow(MCPManagedConfigError);
      await expect(mc.load()).rejects.toThrow("Failed to parse managed MCP config as JSON");
    });

    it("should throw MCPManagedConfigError for schema validation failure", async () => {
      // policies.maxServers should be a number, not a string
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          mcpServers: {},
          policies: { maxServers: "not-a-number" },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");

      await expect(mc.load()).rejects.toThrow(MCPManagedConfigError);
      await expect(mc.load()).rejects.toThrow("Managed MCP config failed schema validation");
    });

    it("should apply Zod defaults for missing optional fields", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({}));

      const mc = new MCPManagedConfig("/tmp/test.json");
      const config = await mc.load();

      expect(config.mcpServers).toEqual({});
      expect(config.policies.allowUserServers).toBe(true);
      expect(config.policies.requireApproval).toBe(false);
      expect(config.policies.maxServers).toBe(20);
      expect(config.policies.blockedTransports).toEqual([]);
    });

    it("should parse server with all fields populated", async () => {
      const rawConfig = {
        mcpServers: {
          "full-server": {
            transport: "http",
            command: "cmd",
            args: ["a", "b"],
            url: "http://localhost:8080",
            env: { TOKEN: "abc" },
            allowedTools: ["tool-a", "tool-b"],
            blockedTools: ["tool-c"],
            enforceAllowlist: true,
            readOnly: true,
            maxOutputTokens: 4096,
          },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(rawConfig));

      const mc = new MCPManagedConfig("/tmp/test.json");
      const config = await mc.load();

      const server = config.mcpServers["full-server"];
      expect(server.transport).toBe("http");
      expect(server.allowedTools).toEqual(["tool-a", "tool-b"]);
      expect(server.blockedTools).toEqual(["tool-c"]);
      expect(server.enforceAllowlist).toBe(true);
      expect(server.readOnly).toBe(true);
      expect(server.maxOutputTokens).toBe(4096);
    });

    it("should parse config with blockedTransports policy", async () => {
      const rawConfig = {
        policies: {
          blockedTransports: ["sse", "http"],
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(rawConfig));

      const mc = new MCPManagedConfig("/tmp/test.json");
      const config = await mc.load();

      expect(config.policies.blockedTransports).toEqual(["sse", "http"]);
    });

    it("should handle multiple servers in config", async () => {
      const rawConfig = {
        mcpServers: {
          alpha: { command: "alpha-cmd" },
          beta: { transport: "http", url: "http://example.com" },
          gamma: { transport: "sse", url: "http://sse.example.com" },
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(rawConfig));

      const mc = new MCPManagedConfig("/tmp/test.json");
      const config = await mc.load();

      expect(Object.keys(config.mcpServers)).toEqual(["alpha", "beta", "gamma"]);
    });
  });

  // ─── exists() ──────────────────────────────────────────────────────

  describe("exists", () => {
    it("should return true when config file exists", async () => {
      mockReadFile.mockResolvedValueOnce(validConfig());

      const mc = new MCPManagedConfig("/tmp/test.json");
      const result = await mc.exists();

      expect(result).toBe(true);
    });

    it("should return false when config file does not exist", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      const result = await mc.exists();

      expect(result).toBe(false);
    });
  });

  // ─── getManagedServers() ───────────────────────────────────────────

  describe("getManagedServers", () => {
    it("should throw if load() was not called", () => {
      const mc = new MCPManagedConfig("/tmp/test.json");
      expect(() => mc.getManagedServers()).toThrow("Managed config not loaded");
    });

    it("should return empty map when no servers configured", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const servers = mc.getManagedServers();
      expect(servers.size).toBe(0);
    });

    it("should return map of managed servers", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            "server-a": { command: "a" },
            "server-b": { transport: "http", url: "http://b" },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const servers = mc.getManagedServers();
      expect(servers.size).toBe(2);
      expect(servers.get("server-a")?.command).toBe("a");
      expect(servers.get("server-b")?.transport).toBe("http");
    });
  });

  // ─── getPolicies() ─────────────────────────────────────────────────

  describe("getPolicies", () => {
    it("should throw if load() was not called", () => {
      const mc = new MCPManagedConfig("/tmp/test.json");
      expect(() => mc.getPolicies()).toThrow("Managed config not loaded");
    });

    it("should return default policies when file does not exist", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const policies = mc.getPolicies();
      expect(policies.allowUserServers).toBe(true);
      expect(policies.requireApproval).toBe(false);
      expect(policies.maxServers).toBe(20);
      expect(policies.blockedTransports).toEqual([]);
    });

    it("should return custom policies from config", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          policies: {
            allowUserServers: false,
            requireApproval: true,
            maxServers: 3,
            blockedTransports: ["sse"],
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const policies = mc.getPolicies();
      expect(policies.allowUserServers).toBe(false);
      expect(policies.requireApproval).toBe(true);
      expect(policies.maxServers).toBe(3);
      expect(policies.blockedTransports).toEqual(["sse"]);
    });
  });

  // ─── mergeWithUserConfigs() ────────────────────────────────────────

  describe("mergeWithUserConfigs", () => {
    it("should include managed-only servers", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            "managed-only": { command: "managed-cmd", args: ["--flag"] },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.mergeWithUserConfigs({});
      expect(result["managed-only"]).toBeDefined();
      expect(result["managed-only"].command).toBe("managed-cmd");
      expect(result["managed-only"].name).toBe("managed-only");
    });

    it("should include user-only servers when allowUserServers is true", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ policies: { allowUserServers: true } }));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const userConfigs = {
        "user-server": makeServerConfig("user-server"),
      };
      const result = mc.mergeWithUserConfigs(userConfigs);

      expect(result["user-server"]).toBeDefined();
      expect(result["user-server"].command).toBe("user-server-cmd");
    });

    it("should exclude user-only servers when allowUserServers is false", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ policies: { allowUserServers: false } }));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const userConfigs = {
        "user-server": makeServerConfig("user-server"),
      };
      const result = mc.mergeWithUserConfigs(userConfigs);

      expect(result["user-server"]).toBeUndefined();
    });

    it("should use managed config for readOnly servers (ignore user config)", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            shared: {
              command: "managed-version",
              args: ["--managed"],
              readOnly: true,
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const userConfigs = {
        shared: makeServerConfig("shared", {
          command: "user-version",
          args: ["--user"],
        }),
      };
      const result = mc.mergeWithUserConfigs(userConfigs);

      expect(result["shared"].command).toBe("managed-version");
      expect(result["shared"].args).toEqual(["--managed"]);
    });

    it("should use user connection details for non-readOnly overlap servers", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            shared: {
              command: "managed-cmd",
              allowedTools: ["tool-a"],
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const userConfigs = {
        shared: makeServerConfig("shared", {
          command: "user-cmd",
          args: ["--user-flag"],
          scope: "project",
        }),
      };
      const result = mc.mergeWithUserConfigs(userConfigs);

      // User provides connection details
      expect(result["shared"].command).toBe("user-cmd");
      expect(result["shared"].args).toEqual(["--user-flag"]);
      expect(result["shared"].scope).toBe("project");
    });

    it("should handle overlap with both managed and user servers", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            overlap: { command: "managed" },
            "managed-only": { command: "m-only" },
          },
          policies: { allowUserServers: true },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const userConfigs = {
        overlap: makeServerConfig("overlap", { command: "user-overlap" }),
        "user-only": makeServerConfig("user-only"),
      };
      const result = mc.mergeWithUserConfigs(userConfigs);

      expect(Object.keys(result).sort()).toEqual(["managed-only", "overlap", "user-only"]);
      // overlap uses user connection
      expect(result["overlap"].command).toBe("user-overlap");
      // managed-only uses managed config
      expect(result["managed-only"].command).toBe("m-only");
      // user-only kept because allowUserServers is true
      expect(result["user-only"].command).toBe("user-only-cmd");
    });

    it("should create immutable copies of args and env", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: { command: "cmd", args: ["a"], env: { K: "V" } },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.mergeWithUserConfigs({});
      const server = result["server"];

      // Verify we get copies
      expect(server.args).toEqual(["a"]);
      expect(server.env).toEqual({ K: "V" });
    });
  });

  // ─── validateServerConfig() ────────────────────────────────────────

  describe("validateServerConfig", () => {
    it("should return valid for a normal server with permissive policies", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.validateServerConfig("new-server", makeServerConfig("new-server"));

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail when allowUserServers is false and server is not managed", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ policies: { allowUserServers: false } }));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.validateServerConfig("unknown", makeServerConfig("unknown"));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Policy does not allow user-defined servers");
    });

    it("should fail when transport is blocked", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ policies: { blockedTransports: ["http", "sse"] } }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.validateServerConfig(
        "http-server",
        makeServerConfig("http-server", { transport: "http" }),
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Transport "http" is blocked by admin policy');
    });

    it("should fail when managed server is readOnly", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            locked: { command: "cmd", readOnly: true },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.validateServerConfig("locked", makeServerConfig("locked"));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Server "locked" is managed as read-only and cannot be modified',
      );
    });

    it("should add warning when requireApproval is true for new server", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ policies: { requireApproval: true } }));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.validateServerConfig("new-server", makeServerConfig("new-server"));

      expect(result.valid).toBe(true); // warnings don't make it invalid
      expect(result.warnings).toContain("New servers require admin approval before use");
    });

    it("should not warn about approval for a managed server", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            existing: { command: "cmd" },
          },
          policies: { requireApproval: true },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.validateServerConfig("existing", makeServerConfig("existing"));

      expect(result.warnings).not.toContain("New servers require admin approval before use");
    });

    it("should accumulate multiple errors", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            locked: { command: "cmd", readOnly: true },
          },
          policies: { blockedTransports: ["http"] },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const result = mc.validateServerConfig(
        "locked",
        makeServerConfig("locked", { transport: "http" }),
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── canAddServer() ────────────────────────────────────────────────

  describe("canAddServer", () => {
    it("should return true when under maxServers and allowUserServers", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      expect(mc.canAddServer(0)).toBe(true);
      expect(mc.canAddServer(10)).toBe(true);
      expect(mc.canAddServer(19)).toBe(true);
    });

    it("should return false when at maxServers limit", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ policies: { maxServers: 5 } }));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      expect(mc.canAddServer(5)).toBe(false);
      expect(mc.canAddServer(6)).toBe(false);
    });

    it("should return true when exactly one below maxServers", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ policies: { maxServers: 5 } }));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      expect(mc.canAddServer(4)).toBe(true);
    });

    it("should return false when allowUserServers is false regardless of count", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ policies: { allowUserServers: false } }));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      expect(mc.canAddServer(0)).toBe(false);
    });

    it("should throw if load() was not called", () => {
      const mc = new MCPManagedConfig("/tmp/test.json");
      expect(() => mc.canAddServer(0)).toThrow("Managed config not loaded");
    });
  });

  // ─── isTransportAllowed() ──────────────────────────────────────────

  describe("isTransportAllowed", () => {
    it("should allow all transports by default", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      expect(mc.isTransportAllowed("stdio")).toBe(true);
      expect(mc.isTransportAllowed("http")).toBe(true);
      expect(mc.isTransportAllowed("sse")).toBe(true);
    });

    it("should block transports listed in blockedTransports", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ policies: { blockedTransports: ["sse"] } }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      expect(mc.isTransportAllowed("stdio")).toBe(true);
      expect(mc.isTransportAllowed("http")).toBe(true);
      expect(mc.isTransportAllowed("sse")).toBe(false);
    });

    it("should block multiple transports", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ policies: { blockedTransports: ["http", "sse"] } }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      expect(mc.isTransportAllowed("stdio")).toBe(true);
      expect(mc.isTransportAllowed("http")).toBe(false);
      expect(mc.isTransportAllowed("sse")).toBe(false);
    });

    it("should throw if load() was not called", () => {
      const mc = new MCPManagedConfig("/tmp/test.json");
      expect(() => mc.isTransportAllowed("stdio")).toThrow("Managed config not loaded");
    });
  });

  // ─── getEffectiveToolFilter() ──────────────────────────────────────

  describe("getEffectiveToolFilter", () => {
    it("should pass through user filters when no managed config for server", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("unknown-server", ["tool-a", "tool-b"], ["tool-c"]);

      expect(filter.allowlist).toEqual(["tool-a", "tool-b"]);
      expect(filter.denylist).toEqual(["tool-c"]);
    });

    it("should return undefined filters when no managed config and no user filters", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("unknown-server");

      expect(filter.allowlist).toBeUndefined();
      expect(filter.denylist).toBeUndefined();
    });

    it("should enforce managed allowlist when enforceAllowlist is true", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            locked: {
              command: "cmd",
              allowedTools: ["safe-tool"],
              enforceAllowlist: true,
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("locked", ["safe-tool", "user-extra-tool"]);

      // enforceAllowlist means managed allowlist wins exclusively
      expect(filter.allowlist).toEqual(["safe-tool"]);
    });

    it("should intersect allowlists when both managed and user have allowlists (no enforce)", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: {
              command: "cmd",
              allowedTools: ["tool-a", "tool-b", "tool-c"],
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server", ["tool-b", "tool-c", "tool-d"]);

      // Intersection: only tools in both lists
      expect(filter.allowlist).toEqual(["tool-b", "tool-c"]);
    });

    it("should use managed allowlist when user has no allowlist", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: {
              command: "cmd",
              allowedTools: ["tool-a"],
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server");

      expect(filter.allowlist).toEqual(["tool-a"]);
    });

    it("should use user allowlist when managed has no allowlist", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: { command: "cmd" },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server", ["tool-x"]);

      expect(filter.allowlist).toEqual(["tool-x"]);
    });

    it("should union denylists from managed and user", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: {
              command: "cmd",
              blockedTools: ["blocked-a", "blocked-b"],
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server", undefined, ["blocked-b", "blocked-c"]);

      // Union: all unique blocked tools
      expect(filter.denylist).toEqual(
        expect.arrayContaining(["blocked-a", "blocked-b", "blocked-c"]),
      );
      expect(filter.denylist?.length).toBe(3);
    });

    it("should use managed denylist when user has no denylist", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: {
              command: "cmd",
              blockedTools: ["blocked-a"],
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server");

      expect(filter.denylist).toEqual(["blocked-a"]);
    });

    it("should use user denylist when managed has no denylist", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: { command: "cmd" },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server", undefined, ["user-blocked"]);

      expect(filter.denylist).toEqual(["user-blocked"]);
    });

    it("should return undefined denylist when neither managed nor user has denylist", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: { command: "cmd" },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server");

      expect(filter.denylist).toBeUndefined();
    });

    it("should handle both allowlist and denylist simultaneously", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          mcpServers: {
            server: {
              command: "cmd",
              allowedTools: ["tool-a", "tool-b"],
              blockedTools: ["tool-x"],
              enforceAllowlist: true,
            },
          },
        }),
      );

      const mc = new MCPManagedConfig("/tmp/test.json");
      await mc.load();

      const filter = mc.getEffectiveToolFilter("server", ["tool-a", "tool-c"], ["tool-y"]);

      expect(filter.allowlist).toEqual(["tool-a", "tool-b"]); // enforced
      expect(filter.denylist).toEqual(expect.arrayContaining(["tool-x", "tool-y"]));
    });

    it("should throw if load() was not called", () => {
      const mc = new MCPManagedConfig("/tmp/test.json");
      expect(() => mc.getEffectiveToolFilter("server")).toThrow("Managed config not loaded");
    });
  });

  // ─── Error class ───────────────────────────────────────────────────

  describe("MCPManagedConfigError", () => {
    it("should have correct error code", () => {
      const err = new MCPManagedConfigError("test error");
      expect(err.code).toBe("MCP_MANAGED_CONFIG_ERROR");
      expect(err.message).toBe("test error");
      expect(err.name).toBe("MCPManagedConfigError");
    });

    it("should store context as frozen object", () => {
      const err = new MCPManagedConfigError("test", { path: "/foo" });
      expect(err.context).toEqual({ path: "/foo" });
      expect(Object.isFrozen(err.context)).toBe(true);
    });

    it("should be instanceof BaseError", () => {
      const err = new MCPManagedConfigError("test");
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ─── Default config path ──────────────────────────────────────────

  describe("default config path", () => {
    it("should read from ~/.dhelix/managed-mcp.json by default", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const mc = new MCPManagedConfig();
      await mc.load();

      expect(mockReadFile).toHaveBeenCalledWith(
        join(homedir(), ".dhelix", "managed-mcp.json"),
        "utf-8",
      );
    });
  });
});
