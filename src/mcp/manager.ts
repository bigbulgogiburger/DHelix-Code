import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { MCPClient } from "./client.js";
import { MCPToolBridge } from "./tool-bridge.js";
import { type MCPServerConfig } from "./types.js";
import { type ToolRegistry } from "../tools/registry.js";
import { BaseError } from "../utils/error.js";

/** MCP manager error */
export class MCPManagerError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_MANAGER_ERROR", context);
  }
}

/** Default config path: ~/.dbcode/mcp.json */
const DEFAULT_CONFIG_PATH = join(homedir(), ".dbcode", "mcp.json");

export interface MCPManagerConfig {
  readonly configPath?: string;
  readonly toolRegistry: ToolRegistry;
}

export interface ConnectAllResult {
  readonly connected: string[];
  readonly failed: Array<{ readonly name: string; readonly error: string }>;
}

/**
 * MCP server lifecycle manager.
 * Loads configuration, manages connections, and bridges tools into the registry.
 */
export class MCPManager {
  private readonly clients = new Map<string, MCPClient>();
  private readonly bridge: MCPToolBridge;
  private readonly configPath: string;

  constructor(config: MCPManagerConfig) {
    this.configPath = config.configPath ?? DEFAULT_CONFIG_PATH;
    this.bridge = new MCPToolBridge(config.toolRegistry);
  }

  /** Load MCP server configuration from the config file */
  async loadConfig(): Promise<Record<string, MCPServerConfig>> {
    let raw: string;
    try {
      raw = await readFile(this.configPath, "utf-8");
    } catch {
      // File doesn't exist — not an error, just no servers configured
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      const servers = parsed.mcpServers ?? {};
      const result: Record<string, MCPServerConfig> = {};

      for (const [name, value] of Object.entries(servers)) {
        const cfg = value as Record<string, unknown>;
        result[name] = {
          name,
          transport: (cfg.transport as MCPServerConfig["transport"]) ?? "stdio",
          command: cfg.command as string | undefined,
          args: cfg.args as string[] | undefined,
          url: cfg.url as string | undefined,
          env: cfg.env as Record<string, string> | undefined,
          scope: cfg.scope as MCPServerConfig["scope"],
        };
      }

      return result;
    } catch (error) {
      throw new MCPManagerError("Failed to parse MCP config file", {
        path: this.configPath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Connect to all configured MCP servers in parallel and register their tools */
  async connectAll(): Promise<ConnectAllResult> {
    const serverConfigs = await this.loadConfig();
    const entries = Object.entries(serverConfigs);

    if (entries.length === 0) {
      return { connected: [], failed: [] };
    }

    const results = await Promise.allSettled(
      entries.map(async ([name, config]) => {
        await this.connectServer(name, config);
        return name;
      }),
    );

    const connected: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        connected.push(result.value);
      } else {
        failed.push({
          name: entries[i][0],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return { connected, failed };
  }

  /** Connect to a specific MCP server and register its tools */
  async connectServer(name: string, config: MCPServerConfig): Promise<readonly string[]> {
    // Disconnect existing client if reconnecting
    const existing = this.clients.get(name);
    if (existing) {
      await existing.disconnect();
    }

    const client = new MCPClient(config);
    await client.connect();
    this.clients.set(name, client);

    const toolNames = await this.bridge.registerTools(client, name);
    return toolNames;
  }

  /** Disconnect all connected MCP servers */
  async disconnectAll(): Promise<void> {
    const disconnects = [...this.clients.values()].map((client) => client.disconnect());
    await Promise.allSettled(disconnects);
    this.clients.clear();
  }

  /** Get a map of server names to their registered tool names */
  getRegisteredTools(): ReadonlyMap<string, readonly string[]> {
    const result = new Map<string, readonly string[]>();
    for (const name of this.clients.keys()) {
      result.set(name, this.bridge.getServerTools(name));
    }
    return result;
  }

  /** Get names of all connected servers */
  getConnectedServers(): readonly string[] {
    return [...this.clients.keys()];
  }
}
