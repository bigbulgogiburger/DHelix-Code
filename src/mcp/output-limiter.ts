import { BaseError } from "../utils/error.js";

/** MCP output limiter error */
export class MCPOutputLimiterError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_OUTPUT_LIMITER_ERROR", context);
  }
}

/** Output limit configuration */
export interface OutputLimitConfig {
  /** Maximum tokens for tool output (default: 10000) */
  readonly maxTokens: number;
  /** Maximum characters (fallback when token counting unavailable, default: 40000) */
  readonly maxCharacters: number;
  /** Truncation strategy */
  readonly strategy: "head" | "tail" | "smart";
  /** Whether to include a summary of truncated content */
  readonly includeSummary: boolean;
}

/** Output limiting result */
export interface LimitedOutput {
  readonly content: string;
  readonly wasTruncated: boolean;
  readonly originalTokens: number;
  readonly resultTokens: number;
  readonly originalCharacters: number;
  readonly truncationMessage?: string;
}

/** Usage statistics */
export interface OutputLimiterStats {
  readonly totalCalls: number;
  readonly truncatedCalls: number;
  readonly totalTokensSaved: number;
  readonly averageOriginalTokens: number;
}

/** Internal mutable stats accumulator */
interface StatsAccumulator {
  totalCalls: number;
  truncatedCalls: number;
  totalTokensSaved: number;
  totalOriginalTokens: number;
}

/** Default configuration */
const DEFAULT_CONFIG: OutputLimitConfig = {
  maxTokens: 10_000,
  maxCharacters: 40_000,
  strategy: "smart",
  includeSummary: true,
};

/** Approximate characters per token ratio */
const CHARS_PER_TOKEN = 4;

/**
 * Detect whether content looks like JSON.
 * Checks for leading `{` or `[` after trimming whitespace.
 */
function looksLikeJson(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * Detect whether content looks like markdown.
 * Checks for heading markers or common markdown patterns.
 */
function looksLikeMarkdown(content: string): boolean {
  const lines = content.split("\n").slice(0, 20);
  return lines.some(
    (line) =>
      /^#{1,6}\s/.test(line) ||
      /^\*{3,}$/.test(line.trim()) ||
      /^-{3,}$/.test(line.trim()) ||
      /^```/.test(line.trim()),
  );
}

/**
 * MCP Output Limiter — provides configurable, intelligent output truncation
 * for MCP tool results. Supports per-server configuration, multiple truncation
 * strategies, and usage statistics tracking.
 */
export class MCPOutputLimiter {
  private readonly config: OutputLimitConfig;
  private readonly serverConfigs: ReadonlyMap<string, OutputLimitConfig>;
  private readonly mutableServerConfigs = new Map<string, OutputLimitConfig>();
  private stats: StatsAccumulator = {
    totalCalls: 0,
    truncatedCalls: 0,
    totalTokensSaved: 0,
    totalOriginalTokens: 0,
  };

  constructor(config?: Partial<OutputLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.serverConfigs = this.mutableServerConfigs;
  }

  /** Set per-server output limit configuration */
  setServerLimit(serverName: string, config: Partial<OutputLimitConfig>): void {
    const effective = { ...this.config, ...config };
    this.mutableServerConfigs.set(serverName, effective);
  }

  /** Get effective config for a server (server-specific overrides global) */
  getEffectiveConfig(serverName: string): OutputLimitConfig {
    return this.serverConfigs.get(serverName) ?? this.config;
  }

  /** Estimate token count using 4 chars per token approximation */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Limit output content based on configuration.
   * Returns the (possibly truncated) content along with metadata.
   */
  limitOutput(content: string, serverName?: string): LimitedOutput {
    const effectiveConfig = serverName ? this.getEffectiveConfig(serverName) : this.config;

    const originalTokens = this.estimateTokens(content);
    const originalCharacters = content.length;

    // Update stats
    this.stats = {
      ...this.stats,
      totalCalls: this.stats.totalCalls + 1,
      totalOriginalTokens: this.stats.totalOriginalTokens + originalTokens,
    };

    // Check if content is within limits
    if (
      originalTokens <= effectiveConfig.maxTokens &&
      originalCharacters <= effectiveConfig.maxCharacters
    ) {
      return {
        content,
        wasTruncated: false,
        originalTokens,
        resultTokens: originalTokens,
        originalCharacters,
      };
    }

    // Calculate target character limit from token limit
    const maxCharsFromTokens = effectiveConfig.maxTokens * CHARS_PER_TOKEN;
    const maxChars = Math.min(maxCharsFromTokens, effectiveConfig.maxCharacters);

    // Apply truncation strategy
    let truncatedContent: string;
    let truncationMessage: string | undefined;

    switch (effectiveConfig.strategy) {
      case "smart": {
        const result = this.smartTruncate(content, maxChars);
        truncatedContent = result.truncated;
        truncationMessage = effectiveConfig.includeSummary ? result.summary : undefined;
        break;
      }
      case "tail": {
        truncatedContent = this.tailTruncate(content, maxChars);
        truncationMessage = effectiveConfig.includeSummary
          ? `[Truncated: kept last ${this.estimateTokens(truncatedContent)} of ${originalTokens} tokens]`
          : undefined;
        break;
      }
      case "head":
      default: {
        truncatedContent = this.headTruncate(content, maxChars);
        truncationMessage = effectiveConfig.includeSummary
          ? `[Truncated: kept first ${this.estimateTokens(truncatedContent)} of ${originalTokens} tokens]`
          : undefined;
        break;
      }
    }

    // Append truncation message if present
    const finalContent = truncationMessage
      ? `${truncatedContent}\n\n${truncationMessage}`
      : truncatedContent;

    const resultTokens = this.estimateTokens(finalContent);
    const tokensSaved = originalTokens - resultTokens;

    // Update truncation stats
    this.stats = {
      ...this.stats,
      truncatedCalls: this.stats.truncatedCalls + 1,
      totalTokensSaved: this.stats.totalTokensSaved + tokensSaved,
    };

    return {
      content: finalContent,
      wasTruncated: true,
      originalTokens,
      resultTokens,
      originalCharacters,
      truncationMessage,
    };
  }

  /**
   * Smart truncation: detect content type and preserve structure.
   * - JSON: preserve top-level keys, truncate nested values
   * - Markdown: preserve headings, truncate body sections
   * - Plain text: truncate at paragraph boundary
   */
  smartTruncate(
    content: string,
    maxChars: number,
  ): { readonly truncated: string; readonly summary: string } {
    if (content.length <= maxChars) {
      return { truncated: content, summary: "" };
    }

    const originalTokens = this.estimateTokens(content);

    if (looksLikeJson(content)) {
      return this.smartTruncateJson(content, maxChars, originalTokens);
    }

    if (looksLikeMarkdown(content)) {
      return this.smartTruncateMarkdown(content, maxChars, originalTokens);
    }

    return this.smartTruncatePlainText(content, maxChars, originalTokens);
  }

  /** Head truncation: keep the beginning of content */
  headTruncate(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }
    return content.slice(0, maxChars);
  }

  /** Tail truncation: keep the end of content */
  tailTruncate(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }
    return content.slice(-maxChars);
  }

  /** Get usage statistics (immutable snapshot) */
  getStats(): OutputLimiterStats {
    const averageOriginalTokens =
      this.stats.totalCalls > 0
        ? Math.round(this.stats.totalOriginalTokens / this.stats.totalCalls)
        : 0;

    return {
      totalCalls: this.stats.totalCalls,
      truncatedCalls: this.stats.truncatedCalls,
      totalTokensSaved: this.stats.totalTokensSaved,
      averageOriginalTokens,
    };
  }

  /** Reset all statistics */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      truncatedCalls: 0,
      totalTokensSaved: 0,
      totalOriginalTokens: 0,
    };
  }

  /** Smart truncation for JSON content */
  private smartTruncateJson(
    content: string,
    maxChars: number,
    originalTokens: number,
  ): { readonly truncated: string; readonly summary: string } {
    try {
      const parsed = JSON.parse(content) as unknown;

      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const keys = Object.keys(obj);
        const result: Record<string, unknown> = {};
        let currentJson = "{}";

        for (const key of keys) {
          const candidate = { ...result, [key]: obj[key] };
          const candidateJson = JSON.stringify(candidate, null, 2);

          if (candidateJson.length > maxChars) {
            // Try adding key with a placeholder
            const placeholder = { ...result, [key]: "[truncated]" };
            const placeholderJson = JSON.stringify(placeholder, null, 2);
            if (placeholderJson.length <= maxChars) {
              currentJson = placeholderJson;
            }
            break;
          }

          result[key] = obj[key];
          currentJson = candidateJson;
        }

        const keptKeys = Object.keys(result).length;
        const resultTokens = this.estimateTokens(currentJson);
        const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${keptKeys}/${keys.length} top-level keys.]`;
        return { truncated: currentJson, summary };
      }

      if (Array.isArray(parsed)) {
        const result: unknown[] = [];
        let currentJson = "[]";

        for (const item of parsed) {
          const candidate = [...result, item];
          const candidateJson = JSON.stringify(candidate, null, 2);

          if (candidateJson.length > maxChars) {
            break;
          }

          result.push(item);
          currentJson = candidateJson;
        }

        const resultTokens = this.estimateTokens(currentJson);
        const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${result.length}/${parsed.length} array items.]`;
        return { truncated: currentJson, summary };
      }
    } catch {
      // Not valid JSON despite looking like it; fall through to plain text
    }

    return this.smartTruncatePlainText(content, maxChars, originalTokens);
  }

  /** Smart truncation for markdown content */
  private smartTruncateMarkdown(
    content: string,
    maxChars: number,
    originalTokens: number,
  ): { readonly truncated: string; readonly summary: string } {
    const sections = content.split(/(?=^#{1,6}\s)/m);
    const result: string[] = [];
    let currentLength = 0;
    let keptSections = 0;

    for (const section of sections) {
      if (currentLength + section.length > maxChars && result.length > 0) {
        break;
      }
      result.push(section);
      currentLength += section.length;
      keptSections++;
    }

    const truncated = result.join("");
    const resultTokens = this.estimateTokens(truncated);
    const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${keptSections}/${sections.length} sections.]`;
    return { truncated, summary };
  }

  /** Smart truncation for plain text content */
  private smartTruncatePlainText(
    content: string,
    maxChars: number,
    originalTokens: number,
  ): { readonly truncated: string; readonly summary: string } {
    // Try to truncate at a paragraph boundary
    const paragraphs = content.split(/\n\n+/);
    const result: string[] = [];
    let currentLength = 0;

    for (const paragraph of paragraphs) {
      // Account for the double newline separator between paragraphs
      const addedLength = result.length > 0 ? paragraph.length + 2 : paragraph.length;

      if (currentLength + addedLength > maxChars && result.length > 0) {
        break;
      }

      result.push(paragraph);
      currentLength += addedLength;
    }

    const truncated = result.join("\n\n");
    const totalLines = content.split("\n").length;
    const keptLines = truncated.split("\n").length;
    const resultTokens = this.estimateTokens(truncated);
    const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${keptLines}/${totalLines} lines.]`;
    return { truncated, summary };
  }
}
