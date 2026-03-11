/**
 * MCP Resource Manager — discovers, parses, reads, and caches resources
 * from connected MCP servers. Supports @server:resource-uri syntax for
 * injecting resource content into conversation context.
 */
import { BaseError } from "../utils/error.js";
import { type MCPClient } from "./client.js";
import { type MCPResource } from "./types.js";

/** Error thrown by the MCP resource manager */
export class MCPResourceError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_RESOURCE_ERROR", context);
  }
}

/** Resolved resource reference from @server:uri syntax */
export interface ResolvedResource {
  readonly serverName: string;
  readonly uri: string;
  readonly resource: MCPResource;
  readonly content: string;
}

/** Parsed resource mention extracted from user text */
export interface ResourceMention {
  readonly serverName: string;
  readonly uri: string;
}

/** Cached resource entry with TTL tracking */
interface CachedResource {
  readonly content: string;
  readonly timestamp: number;
}

/** Cache statistics */
export interface CacheStats {
  readonly size: number;
  readonly hits: number;
  readonly misses: number;
}

/**
 * Resource mention pattern: @server:protocol://path or @server:name
 * Matches patterns like:
 *   @myserver:file:///home/user/data.txt
 *   @db:postgres://localhost/mydb
 *   @server:my-resource-name
 *   @my-server:docs/api/reference
 */
const RESOURCE_MENTION_PATTERN = /@(\w[\w-]*):([\w+.-]+:\/\/[^\s]+|[\w./:_-]+)/g;

/**
 * Manages MCP resource discovery, reading, and caching.
 * Parses @server:resource-uri mentions from user input and resolves
 * them to resource content for injection into conversation context.
 */
export class MCPResourceManager {
  private readonly cache = new Map<string, CachedResource>();
  private readonly ttlMs: number;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Parse @server:resource references from text.
   * Returns an array of parsed mentions with server name and URI.
   */
  parseResourceMentions(text: string): readonly ResourceMention[] {
    const mentions: ResourceMention[] = [];
    const seen = new Set<string>();

    // Reset regex lastIndex since we use the global flag
    const pattern = new RegExp(RESOURCE_MENTION_PATTERN.source, "g");
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const serverName = match[1];
      const uri = match[2];
      const key = `${serverName}:${uri}`;

      // Deduplicate identical mentions
      if (!seen.has(key)) {
        seen.add(key);
        mentions.push({ serverName, uri });
      }
    }

    return mentions;
  }

  /**
   * Discover all resources from a connected MCP client.
   * Delegates to the client's listResources method.
   */
  async discoverResources(client: MCPClient, serverName: string): Promise<readonly MCPResource[]> {
    try {
      return await client.listResources();
    } catch (error) {
      throw new MCPResourceError(`Failed to discover resources from server "${serverName}"`, {
        serverName,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Read a resource by server name and URI, with caching.
   * Returns cached content if available and not expired,
   * otherwise fetches from the server and updates the cache.
   */
  async readResource(client: MCPClient, serverName: string, uri: string): Promise<string> {
    const cacheKey = this.buildCacheKey(serverName, uri);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isExpired(cached)) {
      this.cacheHits += 1;
      return cached.content;
    }

    this.cacheMisses += 1;

    try {
      const content = await client.readResource(uri);
      this.cache.set(cacheKey, {
        content,
        timestamp: Date.now(),
      });
      return content;
    } catch (error) {
      throw new MCPResourceError(`Failed to read resource "${uri}" from server "${serverName}"`, {
        serverName,
        uri,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Resolve all @server:resource mentions in text and return their content.
   * Looks up each server in the clients map, discovers resources to find
   * metadata, and reads the content. Unknown servers or resources that
   * fail to read are collected as errors but do not block other resolutions.
   */
  async resolveResourceMentions(
    text: string,
    clients: ReadonlyMap<string, MCPClient>,
  ): Promise<readonly ResolvedResource[]> {
    const mentions = this.parseResourceMentions(text);

    if (mentions.length === 0) {
      return [];
    }

    const results: ResolvedResource[] = [];

    // Resolve all mentions concurrently
    const resolutions = await Promise.allSettled(
      mentions.map(async (mention) => {
        const client = clients.get(mention.serverName);

        if (!client) {
          throw new MCPResourceError(`Unknown MCP server "${mention.serverName}"`, {
            serverName: mention.serverName,
            uri: mention.uri,
          });
        }

        // Discover resources to find metadata for this URI
        const resources = await this.discoverResources(client, mention.serverName);

        const resource = resources.find((r) => r.uri === mention.uri || r.name === mention.uri);

        if (!resource) {
          throw new MCPResourceError(
            `Resource "${mention.uri}" not found on server "${mention.serverName}"`,
            { serverName: mention.serverName, uri: mention.uri },
          );
        }

        const content = await this.readResource(client, mention.serverName, resource.uri);

        return {
          serverName: mention.serverName,
          uri: resource.uri,
          resource,
          content,
        } as const;
      }),
    );

    for (const resolution of resolutions) {
      if (resolution.status === "fulfilled") {
        results.push(resolution.value);
      }
      // Rejected resolutions are silently skipped — the caller
      // can parse mentions separately to detect which failed
    }

    return results;
  }

  /**
   * Format resolved resources for injection into conversation context.
   * Each resource is wrapped in XML-style tags with server and URI metadata.
   */
  formatResourcesForContext(resources: readonly ResolvedResource[]): string {
    if (resources.length === 0) {
      return "";
    }

    const sections = resources.map((r) => {
      const description = r.resource.description
        ? ` description="${this.escapeXmlAttr(r.resource.description)}"`
        : "";
      const mimeType = r.resource.mimeType
        ? ` mimeType="${this.escapeXmlAttr(r.resource.mimeType)}"`
        : "";

      return [
        `<resource server="${this.escapeXmlAttr(r.serverName)}" uri="${this.escapeXmlAttr(r.uri)}"${description}${mimeType}>`,
        r.content,
        "</resource>",
      ].join("\n");
    });

    return sections.join("\n\n");
  }

  /** Clear expired cache entries */
  clearExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp >= this.ttlMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /** Clear all cached resources */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /** Get cache statistics */
  getCacheStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }

  /** Build a composite cache key from server name and URI */
  private buildCacheKey(serverName: string, uri: string): string {
    return `${serverName}::${uri}`;
  }

  /** Check if a cached entry has expired */
  private isExpired(entry: CachedResource): boolean {
    return Date.now() - entry.timestamp >= this.ttlMs;
  }

  /** Escape special characters for use in XML attribute values */
  private escapeXmlAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
