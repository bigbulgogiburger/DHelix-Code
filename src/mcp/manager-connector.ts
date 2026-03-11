/**
 * MCP Manager Connector — orchestrates initialization of all 6 v8 MCP
 * sub-modules into the MCPManager lifecycle.
 *
 * Wires together:
 * 1. MCPResourceManager  — resource discovery & caching
 * 2. MCPPromptManager    — prompt discovery & slash command generation
 * 3. MCPToolSearch       — deferred tool loading
 * 4. MCPOAuthManager     — OAuth 2.0 token management
 * 5. MCPToolFilter       — allowlist/denylist filtering
 * 6. MCPOutputLimiter    — intelligent output truncation
 */
import { type MCPClient } from "./client.js";
import { MCPResourceManager } from "./resources.js";
import { MCPPromptManager, type PromptCapableClient } from "./prompts.js";
import { MCPToolSearch, type ToolSearchableClient } from "./tool-search.js";
import { MCPOAuthManager } from "./oauth.js";
import { MCPToolFilter } from "./tool-filter.js";
import { MCPOutputLimiter, type OutputLimitConfig } from "./output-limiter.js";
import { type MCPServerConfig, type MCPToolDefinition } from "./types.js";
import { BaseError } from "../utils/error.js";

/** MCP manager connector error */
export class MCPManagerConnectorError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_MANAGER_CONNECTOR_ERROR", context);
  }
}

/** Configuration for the MCP manager connector */
export interface MCPConnectorConfig {
  readonly enableResources?: boolean;
  readonly enablePrompts?: boolean;
  readonly enableToolSearch?: boolean;
  readonly enableOAuth?: boolean;
  readonly enableToolFilter?: boolean;
  readonly enableOutputLimiter?: boolean;
  readonly toolSearchThreshold?: number;
  readonly outputLimiterConfig?: Partial<OutputLimitConfig>;
}

/** Result of connecting a single MCP server */
export interface MCPServerConnectionResult {
  readonly serverName: string;
  readonly resourceCount: number;
  readonly promptCount: number;
  readonly toolCount: number;
  readonly deferredToolCount: number;
  readonly oauthRequired: boolean;
  readonly filteredToolCount: number;
}

/** Aggregated result of connecting all servers */
export interface MCPConnectorResult {
  readonly servers: readonly MCPServerConnectionResult[];
  readonly totalResources: number;
  readonly totalPrompts: number;
  readonly totalTools: number;
  readonly totalDeferredTools: number;
  readonly errors: readonly { readonly serverName: string; readonly error: string }[];
}

/** System prompt sections generated from MCP state */
export interface MCPSystemPromptSections {
  readonly mcpServers: string;
  readonly deferredTools: string;
  readonly resourceHints: string;
  readonly promptCommands: string;
}

/** Connector statistics */
export interface MCPConnectorStats {
  readonly resourceCacheStats: {
    readonly hits: number;
    readonly misses: number;
    readonly size: number;
  };
  readonly outputLimiterStats: {
    readonly truncatedCalls: number;
    readonly totalTokensSaved: number;
  };
  readonly toolSearchTokenEstimate: number;
  readonly connectedServers: number;
}

/** Default configuration values */
const DEFAULT_CONFIG = {
  enableResources: true,
  enablePrompts: true,
  enableToolSearch: true,
  enableOAuth: true,
  enableToolFilter: true,
  enableOutputLimiter: true,
  toolSearchThreshold: 50,
} as const;

/**
 * Orchestrates all 6 v8 MCP sub-modules for server lifecycle management.
 */
export class MCPManagerConnector {
  private readonly resourceManager: MCPResourceManager;
  private readonly promptManager: MCPPromptManager;
  private readonly toolSearch: MCPToolSearch;
  private readonly oauthManager: MCPOAuthManager;
  private readonly toolFilter: MCPToolFilter;
  private readonly outputLimiter: MCPOutputLimiter;
  private readonly enableResources: boolean;
  private readonly enablePrompts: boolean;
  private readonly enableToolSearch: boolean;
  private readonly enableOAuth: boolean;
  private readonly enableToolFilter: boolean;
  private readonly enableOutputLimiter: boolean;
  private readonly toolSearchThreshold: number;
  private readonly connectedServerNames = new Set<string>();

  constructor(config?: MCPConnectorConfig) {
    this.enableResources = config?.enableResources ?? DEFAULT_CONFIG.enableResources;
    this.enablePrompts = config?.enablePrompts ?? DEFAULT_CONFIG.enablePrompts;
    this.enableToolSearch = config?.enableToolSearch ?? DEFAULT_CONFIG.enableToolSearch;
    this.enableOAuth = config?.enableOAuth ?? DEFAULT_CONFIG.enableOAuth;
    this.enableToolFilter = config?.enableToolFilter ?? DEFAULT_CONFIG.enableToolFilter;
    this.enableOutputLimiter = config?.enableOutputLimiter ?? DEFAULT_CONFIG.enableOutputLimiter;
    this.toolSearchThreshold = config?.toolSearchThreshold ?? DEFAULT_CONFIG.toolSearchThreshold;

    this.resourceManager = new MCPResourceManager();
    this.promptManager = new MCPPromptManager();
    this.toolSearch = new MCPToolSearch();
    this.oauthManager = new MCPOAuthManager();
    this.toolFilter = new MCPToolFilter();
    this.outputLimiter = new MCPOutputLimiter(config?.outputLimiterConfig);
  }

  /**
   * Connect all sub-modules for a single server after MCPClient is connected.
   */
  async connectServer(
    client: MCPClient,
    serverName: string,
    _serverConfig: MCPServerConfig,
  ): Promise<MCPServerConnectionResult> {
    // Step 1: Handle OAuth — try to load a saved token
    let oauthRequired = false;
    if (this.enableOAuth) {
      try {
        const token = await this.oauthManager.loadToken(serverName);
        oauthRequired = token !== null;
      } catch {
        // OAuth not configured for this server — skip
      }
    }

    // Step 2: Discover tools and apply filter
    let tools: readonly MCPToolDefinition[] = [];
    let filteredToolCount = 0;
    try {
      tools = await client.listTools();
    } catch (error) {
      throw new MCPManagerConnectorError("Failed to list tools", {
        serverName,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    if (this.enableToolFilter) {
      const originalCount = tools.length;
      tools = this.toolFilter.filterTools(serverName, tools);
      filteredToolCount = originalCount - tools.length;
    }

    // Step 3: Determine if tools should be deferred (above threshold)
    let deferredToolCount = 0;
    if (this.enableToolSearch && tools.length > this.toolSearchThreshold) {
      // Create a ToolSearchableClient adapter from the tools we already have
      const toolSearchClient: ToolSearchableClient = {
        listTools: () => Promise.resolve(tools),
      };
      const deferred = await this.toolSearch.registerDeferredTools(toolSearchClient, serverName);
      deferredToolCount = deferred.length;
    }

    // Step 4: Discover resources
    let resourceCount = 0;
    if (this.enableResources) {
      try {
        const resources = await this.resourceManager.discoverResources(client, serverName);
        resourceCount = resources.length;
      } catch {
        // Resource discovery failure is non-fatal
      }
    }

    // Step 5: Discover prompts (only if client supports prompts)
    let promptCount = 0;
    if (this.enablePrompts && isPromptCapable(client)) {
      try {
        const prompts = await this.promptManager.discoverPrompts(client, serverName);
        promptCount = prompts.length;
      } catch {
        // Prompt discovery failure is non-fatal
      }
    }

    // Step 6: Configure output limiter per server
    if (this.enableOutputLimiter) {
      this.outputLimiter.setServerLimit(serverName, {});
    }

    this.connectedServerNames.add(serverName);

    return {
      serverName,
      resourceCount,
      promptCount,
      toolCount: tools.length,
      deferredToolCount,
      oauthRequired,
      filteredToolCount,
    };
  }

  /**
   * Connect all configured servers (called after MCPManager.connectAll).
   * Handles partial failures gracefully.
   */
  async connectAllServers(
    clients: ReadonlyMap<string, MCPClient>,
    configs: Record<string, MCPServerConfig>,
  ): Promise<MCPConnectorResult> {
    const results: MCPServerConnectionResult[] = [];
    const errors: { readonly serverName: string; readonly error: string }[] = [];

    const entries = [...clients.entries()];
    const settled = await Promise.allSettled(
      entries.map(async ([serverName, client]) => {
        const config = configs[serverName];
        if (!config) {
          throw new MCPManagerConnectorError("Missing server configuration", { serverName });
        }
        return this.connectServer(client, serverName, config);
      }),
    );

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        errors.push({
          serverName: entries[i][0],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return {
      servers: results,
      totalResources: results.reduce((sum, r) => sum + r.resourceCount, 0),
      totalPrompts: results.reduce((sum, r) => sum + r.promptCount, 0),
      totalTools: results.reduce((sum, r) => sum + r.toolCount, 0),
      totalDeferredTools: results.reduce((sum, r) => sum + r.deferredToolCount, 0),
      errors,
    };
  }

  /**
   * Disconnect and cleanup all sub-modules.
   */
  async disconnectAll(): Promise<void> {
    this.resourceManager.clearCache();
    this.promptManager.clear();
    this.toolSearch.clear();
    this.toolFilter.clear();
    this.connectedServerNames.clear();
  }

  /** Get the resource manager for @mention resolution */
  getResourceManager(): MCPResourceManager {
    return this.resourceManager;
  }

  /** Get the prompt manager for slash command generation */
  getPromptManager(): MCPPromptManager {
    return this.promptManager;
  }

  /** Get the tool search for deferred tool resolution */
  getToolSearch(): MCPToolSearch {
    return this.toolSearch;
  }

  /** Get the OAuth manager for token management */
  getOAuthManager(): MCPOAuthManager {
    return this.oauthManager;
  }

  /** Get the tool filter for allowlist/denylist */
  getToolFilter(): MCPToolFilter {
    return this.toolFilter;
  }

  /** Get the output limiter for truncation */
  getOutputLimiter(): MCPOutputLimiter {
    return this.outputLimiter;
  }

  /**
   * Limit output from MCP tool execution.
   * Returns the truncated content string.
   */
  limitToolOutput(content: string, serverName?: string): string {
    if (!this.enableOutputLimiter) {
      return content;
    }
    const result = this.outputLimiter.limitOutput(content, serverName);
    return result.content;
  }

  /**
   * Generate system prompt sections for MCP.
   */
  generateSystemPromptSections(): MCPSystemPromptSections {
    return {
      mcpServers: this.buildMcpServersSection(),
      deferredTools: this.buildDeferredToolsSection(),
      resourceHints: "",
      promptCommands: this.buildPromptCommandsSection(),
    };
  }

  /**
   * Get connection statistics.
   */
  getStats(): MCPConnectorStats {
    const cacheStats = this.resourceManager.getCacheStats();
    const limiterStats = this.outputLimiter.getStats();

    return {
      resourceCacheStats: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        size: cacheStats.size,
      },
      outputLimiterStats: {
        truncatedCalls: limiterStats.truncatedCalls,
        totalTokensSaved: limiterStats.totalTokensSaved,
      },
      toolSearchTokenEstimate: this.toolSearch.estimateTokens(),
      connectedServers: this.connectedServerNames.size,
    };
  }

  private buildMcpServersSection(): string {
    if (this.connectedServerNames.size === 0) {
      return "";
    }

    const lines: string[] = [];
    for (const serverName of this.connectedServerNames) {
      lines.push(`Server: ${serverName}`);
    }
    return lines.join("\n");
  }

  private buildDeferredToolsSection(): string {
    return this.toolSearch.generateDeferredToolsSummary();
  }

  private buildPromptCommandsSection(): string {
    const allPrompts = this.promptManager.getAllPrompts();
    if (allPrompts.size === 0) {
      return "";
    }

    const lines: string[] = ["Available MCP prompts:"];
    for (const [namespacedName, stored] of allPrompts) {
      const desc = stored.prompt.description ? ` — ${stored.prompt.description}` : "";
      lines.push(`  /${namespacedName}${desc}`);
    }
    return lines.join("\n");
  }
}

/**
 * Type guard to check if an MCPClient supports prompt operations.
 */
function isPromptCapable(client: unknown): client is PromptCapableClient {
  return (
    typeof client === "object" &&
    client !== null &&
    "listPrompts" in client &&
    "getPrompt" in client &&
    typeof (client as Record<string, unknown>).listPrompts === "function" &&
    typeof (client as Record<string, unknown>).getPrompt === "function"
  );
}
