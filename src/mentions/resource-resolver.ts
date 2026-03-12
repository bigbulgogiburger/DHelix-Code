import { type MCPResourceManager, type ResourceMention } from "../mcp/resources.js";
import { type MCPClient } from "../mcp/client.js";
import { type MCPResource } from "../mcp/types.js";
import { BaseError } from "../utils/error.js";

/** Resource resolver error */
export class ResourceResolverError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "RESOURCE_RESOLVER_ERROR", context);
  }
}

/** Represents a resolved resource ready for context injection */
export interface ResolvedResourceContext {
  readonly serverName: string;
  readonly resourceUri: string;
  readonly content: string;
  readonly mimeType?: string;
  readonly truncated: boolean;
  readonly originalLength: number;
}

/** Autocomplete suggestion for @server:resource mentions */
export interface ResourceSuggestion {
  readonly display: string;
  readonly insert: string;
  readonly description: string;
  readonly serverName: string;
  readonly uri: string;
}

/** Result of resolving all resource mentions in a text */
export interface ResourceResolutionResult {
  readonly resolvedResources: readonly ResolvedResourceContext[];
  readonly failedResources: readonly { readonly mention: string; readonly error: string }[];
  readonly contextXml: string;
  readonly strippedText: string;
  readonly totalTokensEstimate: number;
}

/** Configuration for MCPResourceResolver */
export interface ResourceResolverConfig {
  readonly resourceManager: MCPResourceManager;
  readonly clients: Map<string, MCPClient>;
  readonly maxContentLength?: number;
}

/** Default max content length per resource (50,000 chars) */
const DEFAULT_MAX_CONTENT_LENGTH = 50_000;

/**
 * Resource mention pattern for text replacement.
 * Matches @server:protocol://path or @server:name patterns.
 */
const RESOURCE_MENTION_REPLACE_PATTERN = /@(\w[\w-]*):([\w+.-]+:\/\/[^\s]+|[\w./:_-]+)/g;

/**
 * Integrates the MCPResourceManager with the @mention system.
 * Resolves @server:resource mentions in user input, fetches resource content,
 * and formats it for context injection.
 */
export class MCPResourceResolver {
  private readonly resourceManager: MCPResourceManager;
  private clients: Map<string, MCPClient>;
  private readonly resourceCache: Map<string, readonly ResourceSuggestion[]>;
  private readonly maxContentLength: number;

  constructor(config: ResourceResolverConfig) {
    this.resourceManager = config.resourceManager;
    this.clients = new Map(config.clients);
    this.resourceCache = new Map();
    this.maxContentLength = config.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;
  }

  /**
   * Parse @server:resource mentions from user input text.
   * Delegates to MCPResourceManager.parseResourceMentions().
   */
  parseMentions(text: string): readonly ResourceMention[] {
    return this.resourceManager.parseResourceMentions(text);
  }

  /**
   * Resolve all resource mentions in text and return formatted context.
   * Fetches each resource, truncates if needed, and builds XML context.
   */
  async resolveAll(text: string): Promise<ResourceResolutionResult> {
    const mentions = this.parseMentions(text);

    if (mentions.length === 0) {
      return {
        resolvedResources: [],
        failedResources: [],
        contextXml: "",
        strippedText: text,
        totalTokensEstimate: 0,
      };
    }

    const resolvedResources: ResolvedResourceContext[] = [];
    const failedResources: { readonly mention: string; readonly error: string }[] = [];

    const results = await Promise.allSettled(
      mentions.map(async (mention) => {
        const client = this.clients.get(mention.serverName);
        if (!client) {
          throw new ResourceResolverError(`Server "${mention.serverName}" is not connected`, {
            serverName: mention.serverName,
          });
        }

        const content = await this.resourceManager.readResource(
          client,
          mention.serverName,
          mention.uri,
        );

        return { mention, content };
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const mention = mentions[i];

      if (result.status === "fulfilled") {
        const { content } = result.value;
        const originalLength = content.length;
        const truncated = originalLength > this.maxContentLength;
        const finalContent = truncated
          ? content.slice(0, this.maxContentLength) + "\n[truncated]"
          : content;

        resolvedResources.push({
          serverName: mention.serverName,
          resourceUri: mention.uri,
          content: finalContent,
          truncated,
          originalLength,
        });
      } else {
        const error =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        failedResources.push({
          mention: `@${mention.serverName}:${mention.uri}`,
          error,
        });
      }
    }

    const contextXml = this.buildContextXml(resolvedResources);
    const strippedText = this.stripMentions(text);
    const totalTokensEstimate = this.estimateTokens(contextXml);

    return {
      resolvedResources,
      failedResources,
      contextXml,
      strippedText,
      totalTokensEstimate,
    };
  }

  /**
   * Get autocomplete suggestions for partial @server:res input.
   * - Just "@" returns all server names
   * - "@server:" returns all resources for that server
   * - "@server:partial" returns filtered resources matching the prefix
   */
  async getSuggestions(partial: string): Promise<readonly ResourceSuggestion[]> {
    const atIndex = partial.lastIndexOf("@");
    if (atIndex === -1) return [];

    const afterAt = partial.slice(atIndex + 1);

    // If no colon yet, suggest server names
    const colonIndex = afterAt.indexOf(":");
    if (colonIndex === -1) {
      return this.getServerSuggestions(afterAt);
    }

    // Has colon — extract server name and resource prefix
    const serverName = afterAt.slice(0, colonIndex);
    const resourcePrefix = afterAt.slice(colonIndex + 1);

    const resources = await this.getOrRefreshServerResources(serverName);

    if (resourcePrefix.length === 0) {
      return resources;
    }

    return resources.filter(
      (r) =>
        r.uri.toLowerCase().includes(resourcePrefix.toLowerCase()) ||
        r.display.toLowerCase().includes(resourcePrefix.toLowerCase()),
    );
  }

  /**
   * Refresh resource catalog from all connected servers.
   */
  async refreshCatalog(): Promise<void> {
    this.resourceCache.clear();

    const refreshPromises = [...this.clients.entries()].map(async ([serverName, client]) => {
      try {
        const resources = await this.resourceManager.discoverResources(client, serverName);
        const suggestions = this.buildSuggestionsFromResources(serverName, resources);
        this.resourceCache.set(serverName, suggestions);
      } catch {
        this.resourceCache.set(serverName, []);
      }
    });

    await Promise.allSettled(refreshPromises);
  }

  /** Check if text contains any resource mentions */
  hasMentions(text: string): boolean {
    return this.parseMentions(text).length > 0;
  }

  /**
   * Strip resource mentions from text, replacing with summary placeholders.
   * E.g., "@server:protocol://path" → "[resource: server/protocol://path]"
   */
  stripMentions(text: string): string {
    return text.replace(
      RESOURCE_MENTION_REPLACE_PATTERN,
      (_match, serverName: string, uri: string) => `[resource: ${serverName}/${uri}]`,
    );
  }

  /**
   * Update connected clients when servers connect or disconnect.
   */
  updateClients(clients: Map<string, MCPClient>): void {
    this.clients = new Map(clients);

    for (const cachedServer of this.resourceCache.keys()) {
      if (!this.clients.has(cachedServer)) {
        this.resourceCache.delete(cachedServer);
      }
    }
  }

  /** Get available server names for autocomplete */
  getAvailableServers(): readonly string[] {
    return [...this.clients.keys()];
  }

  /** Get cached resource suggestions for a specific server */
  getServerResources(serverName: string): readonly ResourceSuggestion[] {
    return this.resourceCache.get(serverName) ?? [];
  }

  /** Build XML context from resolved resources for system prompt injection */
  private buildContextXml(resources: readonly ResolvedResourceContext[]): string {
    if (resources.length === 0) return "";

    const parts = resources.map(
      (r) =>
        `<resource server="${r.serverName}" uri="${r.resourceUri}">\n${r.content}\n</resource>`,
    );

    return `<mcp-resources>\n${parts.join("\n\n")}\n</mcp-resources>`;
  }

  /** Estimate token count from text length (1 token ≈ 4 chars) */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Build server name suggestions from connected clients */
  private getServerSuggestions(prefix: string): readonly ResourceSuggestion[] {
    const servers = this.getAvailableServers();
    const filtered =
      prefix.length === 0
        ? servers
        : servers.filter((s) => s.toLowerCase().startsWith(prefix.toLowerCase()));

    return filtered.map((serverName) => ({
      display: `@${serverName}:`,
      insert: `@${serverName}:`,
      description: `MCP server: ${serverName}`,
      serverName,
      uri: "",
    }));
  }

  /** Get or refresh cached resources for a server */
  private async getOrRefreshServerResources(
    serverName: string,
  ): Promise<readonly ResourceSuggestion[]> {
    const cached = this.resourceCache.get(serverName);
    if (cached) return cached;

    const client = this.clients.get(serverName);
    if (!client) return [];

    try {
      const resources = await this.resourceManager.discoverResources(client, serverName);
      const suggestions = this.buildSuggestionsFromResources(serverName, resources);
      this.resourceCache.set(serverName, suggestions);
      return suggestions;
    } catch {
      return [];
    }
  }

  /** Convert MCPResource list to ResourceSuggestion list */
  private buildSuggestionsFromResources(
    serverName: string,
    resources: readonly MCPResource[],
  ): readonly ResourceSuggestion[] {
    return resources.map((resource) => ({
      display: `@${serverName}:${resource.uri}`,
      insert: `@${serverName}:${resource.uri}`,
      description: resource.description ?? resource.name,
      serverName,
      uri: resource.uri,
    }));
  }
}

// Re-export for convenience
export type { ResourceMention } from "../mcp/resources.js";
