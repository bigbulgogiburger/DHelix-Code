import type { ToolDefinition } from "../../tools/types.js";

/** Parsed natural language intent from a low-capability model */
export interface NaturalLanguageIntent {
  readonly toolName: string;
  readonly extractedArgs: Record<string, unknown>;
  readonly requiredParams: readonly string[];
  readonly confidence: number;
}

/** Pattern mapping: regex -> tool name + argument extractor */
interface IntentPattern {
  readonly regex: RegExp;
  readonly tool: string;
  readonly argMap: (m: RegExpMatchArray) => Record<string, unknown>;
}

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    regex: /read\s+(?:file\s+)?(.+)/i,
    tool: "file_read",
    argMap: (m: RegExpMatchArray) => ({ file_path: m[1]?.trim() }),
  },
  {
    regex: /search\s+(?:for\s+)?(.+)/i,
    tool: "grep_search",
    argMap: (m: RegExpMatchArray) => ({ pattern: m[1]?.trim() }),
  },
  {
    regex: /write\s+(?:to\s+)?(.+)/i,
    tool: "file_write",
    argMap: (m: RegExpMatchArray) => ({ file_path: m[1]?.trim() }),
  },
  {
    regex: /run\s+(.+)/i,
    tool: "bash_exec",
    argMap: (m: RegExpMatchArray) => ({ command: m[1]?.trim() }),
  },
  {
    regex: /list\s+(?:files?\s+(?:in\s+)?)?(.+)/i,
    tool: "list_dir",
    argMap: (m: RegExpMatchArray) => ({ path: m[1]?.trim() }),
  },
  {
    regex: /edit\s+(.+)/i,
    tool: "file_edit",
    argMap: (m: RegExpMatchArray) => ({ file_path: m[1]?.trim() }),
  },
  {
    regex: /find\s+(?:files?\s+)?(.+)/i,
    tool: "glob_search",
    argMap: (m: RegExpMatchArray) => ({ pattern: m[1]?.trim() }),
  },
];

/**
 * Parse natural language text into a structured tool call intent.
 * Used as a fallback for low-capability models that produce free-form text
 * instead of structured tool calls.
 *
 * Returns null if no intent could be matched.
 */
export function parseNaturalLanguageIntent(
  text: string,
  availableTools: readonly ToolDefinition[],
): NaturalLanguageIntent | null {
  const trimmed = text.trim();

  for (const p of INTENT_PATTERNS) {
    const match = trimmed.match(p.regex);
    if (match && availableTools.some((t) => t.name === p.tool)) {
      const args = p.argMap(match);
      return {
        toolName: p.tool,
        extractedArgs: args,
        requiredParams: Object.keys(args),
        confidence: 0.9,
      };
    }
  }

  return null;
}
