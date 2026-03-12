import { BaseError } from "../utils/error.js";
import { type MCPToolDefinition } from "./types.js";

/** MCP tool search error */
export class MCPToolSearchError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_TOOL_SEARCH_ERROR", context);
  }
}

/** Deferred tool entry — name + description only, no full schema */
export interface DeferredTool {
  readonly name: string;
  readonly namespacedName: string; // mcp__server__tool
  readonly description: string;
  readonly serverName: string;
}

/** Search result with full tool definition */
export interface ToolSearchResult {
  readonly tool: MCPToolDefinition;
  readonly serverName: string;
  readonly namespacedName: string;
  readonly score: number; // relevance score 0-1
}

/** Tool-capable client interface for listing tools */
export interface ToolSearchableClient {
  listTools(): Promise<readonly MCPToolDefinition[]>;
}

/** Default maximum number of search results */
const DEFAULT_MAX_RESULTS = 5;

/** Approximate characters per token for estimation */
const CHARS_PER_TOKEN = 4;

/**
 * Compute relevance score between a query and tool name/description.
 * Returns a normalized score between 0 and 1.
 *
 * Scoring strategy:
 * - Exact name match: 1.0
 * - Name contains query: 0.7
 * - Description contains query: 0.4
 * - Word overlap: proportional bonus up to 0.3
 */
function computeRelevanceScore(query: string, name: string, description: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedName = name.toLowerCase();
  const normalizedDescription = description.toLowerCase();

  if (normalizedQuery.length === 0) {
    return 0;
  }

  // Exact name match
  if (normalizedName === normalizedQuery) {
    return 1.0;
  }

  let score = 0;

  // Name contains query
  if (normalizedName.includes(normalizedQuery)) {
    score = Math.max(score, 0.7);
  }

  // Description contains query
  if (normalizedDescription.includes(normalizedQuery)) {
    score = Math.max(score, 0.4);
  }

  // Word overlap scoring
  const queryWords = normalizedQuery.split(/[\s_-]+/).filter(Boolean);
  const nameWords = normalizedName.split(/[\s_-]+/).filter(Boolean);
  const descWords = normalizedDescription.split(/[\s_-]+/).filter(Boolean);
  const targetWords = [...nameWords, ...descWords];

  if (queryWords.length > 0) {
    const matchedWords = queryWords.filter((qw) =>
      targetWords.some((tw) => tw.includes(qw) || qw.includes(tw)),
    );
    const wordOverlapRatio = matchedWords.length / queryWords.length;
    const wordBonus = wordOverlapRatio * 0.3;
    score = Math.max(score, score + wordBonus);
  }

  // Clamp to [0, 1]
  return Math.min(1.0, score);
}

/**
 * MCP Tool Search — manages deferred tool loading for large MCP tool sets.
 *
 * When MCP servers expose many tools, loading all schemas into the LLM context
 * wastes tokens. MCPToolSearch stores only tool names and descriptions initially,
 * and provides search/resolve methods to load full schemas on demand.
 */
export class MCPToolSearch {
  private readonly deferredTools = new Map<string, DeferredTool>();
  private readonly fullToolCache = new Map<
    string,
    { readonly tool: MCPToolDefinition; readonly serverName: string }
  >();

  /**
   * Register tools from a server as deferred (name + description only).
   * Full schemas are cached for later retrieval via search/resolve.
   */
  async registerDeferredTools(
    client: ToolSearchableClient,
    serverName: string,
  ): Promise<readonly DeferredTool[]> {
    const tools = await client.listTools();
    const registered: DeferredTool[] = [];

    for (const tool of tools) {
      const namespacedName = `mcp__${serverName}__${tool.name}`;

      const deferred: DeferredTool = {
        name: tool.name,
        namespacedName,
        description: tool.description,
        serverName,
      };

      this.deferredTools.set(namespacedName, deferred);
      this.fullToolCache.set(namespacedName, {
        tool,
        serverName,
      });

      registered.push(deferred);
    }

    return registered;
  }

  /**
   * Search deferred tools by query string.
   * Supports two query forms:
   * - "select:Name1,Name2" — exact name match (delegates to resolveByNames)
   * - Free text — fuzzy matching on name + description
   *
   * Results are sorted by relevance score (descending).
   */
  search(query: string, maxResults: number = DEFAULT_MAX_RESULTS): readonly ToolSearchResult[] {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      return [];
    }

    // Handle "select:Name1,Name2" syntax
    if (trimmed.startsWith("select:")) {
      const namesStr = trimmed.slice("select:".length);
      const names = namesStr
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      return this.resolveByNames(names);
    }

    // Free-text search with relevance scoring
    const results: ToolSearchResult[] = [];

    for (const [namespacedName, deferred] of this.deferredTools) {
      const score = computeRelevanceScore(trimmed, deferred.name, deferred.description);

      if (score > 0) {
        const cached = this.fullToolCache.get(namespacedName);
        if (cached) {
          results.push({
            tool: cached.tool,
            serverName: cached.serverName,
            namespacedName,
            score,
          });
        }
      }
    }

    // Sort by score descending, then by name for stability
    const sorted = [...results].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.namespacedName.localeCompare(b.namespacedName);
    });

    return sorted.slice(0, maxResults);
  }

  /**
   * Get a specific tool's full definition by namespaced name.
   * Returns undefined if the tool is not found.
   */
  getToolDefinition(namespacedName: string): ToolSearchResult | undefined {
    const cached = this.fullToolCache.get(namespacedName);
    if (!cached) {
      return undefined;
    }

    return {
      tool: cached.tool,
      serverName: cached.serverName,
      namespacedName,
      score: 1.0,
    };
  }

  /**
   * Resolve tool definitions by exact name match.
   * Accepts both plain tool names and namespaced names (mcp__server__tool).
   * Unknown names are silently skipped.
   */
  resolveByNames(names: readonly string[]): readonly ToolSearchResult[] {
    const results: ToolSearchResult[] = [];

    for (const name of names) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        continue;
      }

      // Try direct namespaced lookup first
      const directMatch = this.fullToolCache.get(trimmedName);
      if (directMatch) {
        results.push({
          tool: directMatch.tool,
          serverName: directMatch.serverName,
          namespacedName: trimmedName,
          score: 1.0,
        });
        continue;
      }

      // Search by plain tool name across all servers
      for (const [namespacedName, deferred] of this.deferredTools) {
        if (deferred.name === trimmedName) {
          const cached = this.fullToolCache.get(namespacedName);
          if (cached) {
            results.push({
              tool: cached.tool,
              serverName: cached.serverName,
              namespacedName,
              score: 1.0,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Generate a summary of all deferred tools for system prompt injection.
   * Format: markdown list with tool names and descriptions.
   */
  generateDeferredToolsSummary(): string {
    if (this.deferredTools.size === 0) {
      return "";
    }

    const lines: string[] = ["<available-deferred-tools>"];

    // Group by server for readability
    const byServer = new Map<string, DeferredTool[]>();
    for (const deferred of this.deferredTools.values()) {
      const existing = byServer.get(deferred.serverName) ?? [];
      byServer.set(deferred.serverName, [...existing, deferred]);
    }

    for (const [, tools] of byServer) {
      for (const tool of tools) {
        lines.push(tool.namespacedName);
      }
    }

    lines.push("</available-deferred-tools>");

    return lines.join("\n");
  }

  /**
   * Calculate rough token estimate for all deferred tool summaries.
   * Uses approximation: 4 characters per token.
   */
  estimateTokens(): number {
    const summary = this.generateDeferredToolsSummary();
    return Math.ceil(summary.length / CHARS_PER_TOKEN);
  }

  /** Get total number of deferred tools */
  get size(): number {
    return this.deferredTools.size;
  }

  /** Check if a tool exists in the deferred set */
  has(namespacedName: string): boolean {
    return this.deferredTools.has(namespacedName);
  }

  /** Clear all deferred tools and cached schemas */
  clear(): void {
    this.deferredTools.clear();
    this.fullToolCache.clear();
  }
}
