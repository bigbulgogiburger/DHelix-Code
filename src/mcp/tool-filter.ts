/**
 * Per-server tool allowlist/denylist filtering for MCP servers.
 * Controls which tools from each MCP server are exposed to the agent.
 */
import { BaseError } from "../utils/error.js";
import { type MCPToolDefinition } from "./types.js";

/** Tool filter error */
export class MCPToolFilterError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_TOOL_FILTER_ERROR", context);
  }
}

/** Per-server tool filter configuration */
export interface MCPToolFilterConfig {
  readonly allowlist?: readonly string[];
  readonly denylist?: readonly string[];
}

/**
 * Filters MCP tools on a per-server basis using allowlist/denylist rules.
 *
 * Resolution order:
 * 1. If allowlist is set, only tools in the allowlist pass through.
 * 2. If denylist is set, tools in the denylist are excluded.
 * 3. If both are set, allowlist is applied first, then denylist.
 * 4. If neither is set, all tools pass through.
 */
export class MCPToolFilter {
  private readonly filters = new Map<string, MCPToolFilterConfig>();

  /** Set filter config for a server */
  setFilter(serverName: string, config: MCPToolFilterConfig): void {
    this.validateConfig(serverName, config);
    this.filters.set(serverName, config);
  }

  /** Get filter config for a server */
  getFilter(serverName: string): MCPToolFilterConfig | undefined {
    return this.filters.get(serverName);
  }

  /**
   * Apply filters to a list of tools from a server.
   * Returns a new array containing only the allowed tools.
   */
  filterTools(
    serverName: string,
    tools: readonly MCPToolDefinition[],
  ): readonly MCPToolDefinition[] {
    const config = this.filters.get(serverName);
    if (!config) {
      return tools;
    }

    let filtered = [...tools];

    // Step 1: Apply allowlist (if present, only keep matching tools)
    if (config.allowlist && config.allowlist.length > 0) {
      const allowSet = new Set(config.allowlist);
      filtered = filtered.filter((tool) => allowSet.has(tool.name));
    }

    // Step 2: Apply denylist (remove matching tools)
    if (config.denylist && config.denylist.length > 0) {
      const denySet = new Set(config.denylist);
      filtered = filtered.filter((tool) => !denySet.has(tool.name));
    }

    return filtered;
  }

  /** Check if a specific tool is allowed for a server */
  isToolAllowed(serverName: string, toolName: string): boolean {
    const config = this.filters.get(serverName);
    if (!config) {
      return true;
    }

    // If allowlist exists and tool is not in it, deny
    if (config.allowlist && config.allowlist.length > 0) {
      if (!config.allowlist.includes(toolName)) {
        return false;
      }
    }

    // If denylist exists and tool is in it, deny
    if (config.denylist && config.denylist.length > 0) {
      if (config.denylist.includes(toolName)) {
        return false;
      }
    }

    return true;
  }

  /** Remove filter for a server */
  removeFilter(serverName: string): void {
    this.filters.delete(serverName);
  }

  /** Clear all filters */
  clear(): void {
    this.filters.clear();
  }

  /**
   * Load filters from MCP server configuration.
   * Each server entry may include allowedTools and/or blockedTools arrays.
   */
  loadFromConfig(
    config: Readonly<
      Record<string, { allowedTools?: readonly string[]; blockedTools?: readonly string[] }>
    >,
  ): void {
    for (const [serverName, serverConfig] of Object.entries(config)) {
      const filterConfig: MCPToolFilterConfig = {
        ...(serverConfig.allowedTools ? { allowlist: [...serverConfig.allowedTools] } : {}),
        ...(serverConfig.blockedTools ? { denylist: [...serverConfig.blockedTools] } : {}),
      };

      // Only set filter if there's something to filter
      if (filterConfig.allowlist || filterConfig.denylist) {
        this.setFilter(serverName, filterConfig);
      }
    }
  }

  /** Validate filter config for conflicting entries */
  private validateConfig(serverName: string, config: MCPToolFilterConfig): void {
    if (config.allowlist && config.denylist) {
      const overlap = config.allowlist.filter((name) => config.denylist!.includes(name));
      if (overlap.length > 0) {
        throw new MCPToolFilterError(
          `Tool names appear in both allowlist and denylist for server "${serverName}"`,
          { serverName, overlapping: overlap },
        );
      }
    }
  }
}
