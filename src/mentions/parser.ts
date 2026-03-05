/** Mention types */
export type MentionType = "file" | "url" | "mcp";

/** A parsed mention reference */
export interface ParsedMention {
  /** The mention type */
  readonly type: MentionType;
  /** Original raw text (e.g., "@file:src/index.ts") */
  readonly raw: string;
  /** The reference value (path, URL, or MCP resource) */
  readonly value: string;
  /** For MCP mentions: server name */
  readonly server?: string;
  /** Start index in the original string */
  readonly start: number;
  /** End index in the original string */
  readonly end: number;
}

/**
 * Pattern for @url mentions: @url:https://... or @https://...
 * Must be checked BEFORE file patterns to avoid false matches.
 */
const URL_MENTION_PATTERN = /@(?:url:)?(https?:\/\/[^\s,)}\]]+)/g;

/**
 * Pattern for @mcp mentions: @server:protocol://resource/path
 * Excludes http/https URLs (handled by URL pattern).
 */
const MCP_MENTION_PATTERN = /@(\w+):((?!https?:\/\/)\w+:\/\/[^\s,)}\]]+)/g;

/**
 * Pattern for @file mentions: @file:path/to/file or @path/to/file.ext
 * Matches: @file:src/index.ts, @src/utils/error.ts, @./relative/path.ts
 * Does NOT match URLs (those are handled by URL_MENTION_PATTERN).
 */
const FILE_MENTION_PATTERN = /@(?:file:)?(\.?[/\\]?\w[^\s,)}\]]*\.\w+)/g;

/**
 * Check if a position range overlaps with any existing mentions.
 */
function overlapsExisting(start: number, end: number, existing: readonly ParsedMention[]): boolean {
  return existing.some(
    (m) => (start >= m.start && start < m.end) || (end > m.start && end <= m.end),
  );
}

/**
 * Parse @ mentions from user input text.
 * Extracts @file, @url, and @mcp references.
 * URL and MCP patterns are matched first to prevent false file matches.
 *
 * Examples:
 *   "@file:src/index.ts" → { type: "file", value: "src/index.ts" }
 *   "@https://example.com" → { type: "url", value: "https://example.com" }
 *   "@postgres:sql://users/schema" → { type: "mcp", value: "sql://users/schema", server: "postgres" }
 */
export function parseMentions(text: string): readonly ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const seen = new Set<string>();

  // Parse URL mentions FIRST (highest priority)
  for (const match of text.matchAll(URL_MENTION_PATTERN)) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);

    mentions.push({
      type: "url",
      raw,
      value: match[1],
      start: match.index ?? 0,
      end: (match.index ?? 0) + raw.length,
    });
  }

  // Parse MCP mentions
  for (const match of text.matchAll(MCP_MENTION_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;

    if (seen.has(raw) || overlapsExisting(start, end, mentions)) continue;
    seen.add(raw);

    mentions.push({
      type: "mcp",
      raw,
      value: match[2],
      server: match[1],
      start,
      end,
    });
  }

  // Parse file mentions LAST (to avoid matching URLs)
  for (const match of text.matchAll(FILE_MENTION_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;

    // Skip if overlaps with a URL or MCP mention
    if (seen.has(raw) || overlapsExisting(start, end, mentions)) continue;
    seen.add(raw);

    // Extract path: remove @file: prefix if present
    const value = raw.startsWith("@file:") ? raw.slice(6) : raw.slice(1);

    mentions.push({
      type: "file",
      raw,
      value,
      start,
      end,
    });
  }

  // Sort by start position
  return mentions.sort((a, b) => a.start - b.start);
}

/**
 * Strip mention references from text, replacing them with just the value.
 * E.g., "@file:src/index.ts" → "src/index.ts"
 */
export function stripMentions(text: string): string {
  let result = text;
  const mentions = parseMentions(text);

  // Replace in reverse order to maintain string positions
  for (const mention of [...mentions].reverse()) {
    result = result.slice(0, mention.start) + mention.value + result.slice(mention.end);
  }

  return result;
}
