import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { BaseError } from "../utils/error.js";
import { type ParsedMention } from "./parser.js";

/** Mention resolution error */
export class MentionResolveError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MENTION_RESOLVE_ERROR", context);
  }
}

/** Resolved mention with loaded content */
export interface ResolvedMention {
  /** The original parsed mention */
  readonly mention: ParsedMention;
  /** Resolved content (file content, URL body, MCP resource) */
  readonly content: string;
  /** Whether resolution was successful */
  readonly success: boolean;
  /** Error message if resolution failed */
  readonly error?: string;
}

/**
 * Resolve a @file mention by reading the file content.
 */
async function resolveFileMention(
  mention: ParsedMention,
  workingDirectory: string,
): Promise<ResolvedMention> {
  try {
    const filePath = isAbsolute(mention.value)
      ? mention.value
      : resolve(workingDirectory, mention.value);

    const content = await readFile(filePath, "utf-8");
    return {
      mention,
      content: `--- ${mention.value} ---\n${content}`,
      success: true,
    };
  } catch (error) {
    return {
      mention,
      content: "",
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Resolve a @url mention by fetching the URL content.
 */
async function resolveUrlMention(mention: ParsedMention): Promise<ResolvedMention> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(mention.value, {
      signal: controller.signal,
      headers: { "User-Agent": "dbcode/0.1.0" },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        mention,
        content: "",
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const text = await response.text();
    // Truncate very large responses
    const maxLength = 50_000;
    const truncated = text.length > maxLength ? text.slice(0, maxLength) + "\n[truncated]" : text;

    return {
      mention,
      content: `--- ${mention.value} ---\n${truncated}`,
      success: true,
    };
  } catch (error) {
    return {
      mention,
      content: "",
      success: false,
      error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Resolve a @mcp mention.
 * MCP resolution requires an active MCP client connection, which is passed in
 * via the resolver function parameter.
 */
async function resolveMcpMention(
  mention: ParsedMention,
  mcpResolver?: (server: string, uri: string) => Promise<string>,
): Promise<ResolvedMention> {
  if (!mcpResolver || !mention.server) {
    return {
      mention,
      content: "",
      success: false,
      error: "MCP resolution not available",
    };
  }

  try {
    const content = await mcpResolver(mention.server, mention.value);
    return {
      mention,
      content: `--- @${mention.server}:${mention.value} ---\n${content}`,
      success: true,
    };
  } catch (error) {
    return {
      mention,
      content: "",
      success: false,
      error: `MCP resolve failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Options for mention resolution */
export interface MentionResolverOptions {
  /** Working directory for file resolution */
  readonly workingDirectory: string;
  /** Optional MCP resource resolver function */
  readonly mcpResolver?: (server: string, uri: string) => Promise<string>;
}

/**
 * Resolve all mentions in parallel and return their content.
 * Failed resolutions include error information but don't throw.
 */
export async function resolveMentions(
  mentions: readonly ParsedMention[],
  options: MentionResolverOptions,
): Promise<readonly ResolvedMention[]> {
  const promises = mentions.map((mention) => {
    switch (mention.type) {
      case "file":
        return resolveFileMention(mention, options.workingDirectory);
      case "url":
        return resolveUrlMention(mention);
      case "mcp":
        return resolveMcpMention(mention, options.mcpResolver);
    }
  });

  return Promise.all(promises);
}

/**
 * Build context injection string from resolved mentions.
 * Combines all successful resolutions into a single context block.
 */
export function buildMentionContext(resolved: readonly ResolvedMention[]): string {
  const successful = resolved.filter((r) => r.success);
  if (successful.length === 0) return "";

  const parts = successful.map((r) => r.content);
  return `<referenced-content>\n${parts.join("\n\n")}\n</referenced-content>`;
}
