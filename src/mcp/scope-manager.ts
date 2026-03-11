import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type MCPServerConfig, type MCPTransport } from "./types.js";

/** MCP scope configuration file format */
export interface MCPScopeConfigFile {
  readonly servers?: Readonly<Record<string, MCPScopeServerEntry>>;
}

/** Server entry in scope config file */
export interface MCPScopeServerEntry {
  readonly transport?: MCPTransport;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  readonly env?: Readonly<Record<string, string>>;
}

/** Scope priority — lower index = higher priority */
const SCOPE_PRIORITY: readonly ("local" | "project" | "user")[] = ["local", "project", "user"];

/**
 * Manages MCP server configurations across three scopes:
 * - local: `.dbcode/mcp-local.json` (gitignored, developer-specific)
 * - project: `.dbcode/mcp.json` (checked in, shared with team)
 * - user: `~/.dbcode/mcp-servers.json` (global user config)
 *
 * Priority: local > project > user (same name = local wins).
 */
export class MCPScopeManager {
  constructor(private readonly workingDirectory: string) {}

  /**
   * Load MCP configs from all scopes with priority resolution.
   * Priority: local > project > user (same name = local wins).
   */
  async loadAllConfigs(): Promise<Map<string, MCPServerConfig>> {
    const merged = new Map<string, MCPServerConfig>();

    // Load in reverse priority order so higher priority overwrites
    for (const scope of [...SCOPE_PRIORITY].reverse()) {
      const configs = await this.getConfigsForScope(scope);
      for (const config of configs) {
        merged.set(config.name, config);
      }
    }

    return merged;
  }

  /**
   * Get configs for a specific scope only.
   */
  async getConfigsForScope(
    scope: "local" | "project" | "user",
  ): Promise<readonly MCPServerConfig[]> {
    const filePath = this.getConfigPath(scope);
    const parsed = await this.readConfigFile(filePath);
    if (!parsed?.servers) {
      return [];
    }

    return Object.entries(parsed.servers).map(
      ([name, entry]): MCPServerConfig => ({
        name,
        transport: entry.transport ?? "stdio",
        command: entry.command,
        args: entry.args ? [...entry.args] : undefined,
        url: entry.url,
        env: entry.env ? { ...entry.env } : undefined,
        scope,
      }),
    );
  }

  /**
   * Get the config file path for a scope.
   */
  getConfigPath(scope: "local" | "project" | "user"): string {
    switch (scope) {
      case "local":
        return join(this.workingDirectory, ".dbcode", "mcp-local.json");
      case "project":
        return join(this.workingDirectory, ".dbcode", "mcp.json");
      case "user":
        return join(homedir(), ".dbcode", "mcp-servers.json");
    }
  }

  /**
   * Read and parse a scope config file. Returns null if the file
   * does not exist or cannot be parsed.
   */
  private async readConfigFile(filePath: string): Promise<MCPScopeConfigFile | null> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      // File doesn't exist — not an error
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null) {
        return null;
      }
      return parsed as MCPScopeConfigFile;
    } catch {
      // Malformed JSON — log-worthy but not fatal
      return null;
    }
  }
}
