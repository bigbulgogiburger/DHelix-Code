import { type ChatMessage } from "../llm/provider.js";

/**
 * JetBrains Research Observation Masking.
 * Strips re-readable tool outputs from history to save tokens.
 *
 * Masked (re-readable from environment):
 * - file_read results
 * - grep_search results
 * - glob_search results
 * - bash_exec output (read-only commands)
 *
 * Preserved (not re-readable):
 * - assistant reasoning
 * - user messages
 * - tool call records (what was called)
 * - file_edit/file_write results (mutation records)
 */

/** Tool names whose outputs are read-only and can be re-obtained from the environment */
const READ_ONLY_TOOL_NAMES = new Set([
  "file_read",
  "grep_search",
  "glob_search",
  "bash_exec",
]);

/** Content patterns that indicate a read-only bash command output */
const READ_ONLY_BASH_PATTERNS = [
  /^STDOUT:/,
  /^cat\s/,
  /^ls\s/,
  /^find\s/,
  /^head\s/,
  /^tail\s/,
  /^wc\s/,
  /^du\s/,
  /^df\s/,
  /^file\s/,
  /^stat\s/,
  /^which\s/,
  /^echo\s/,
  /^pwd$/,
  /^env$/,
  /^printenv/,
];

/** Content patterns that indicate a file_read result (line-numbered output) */
const FILE_READ_PATTERNS = [
  /^\s*\d+[│|]/,
  /^\s+\d+\t/,
];

/** Content patterns that indicate grep/glob search results */
const SEARCH_RESULT_PATTERNS = [
  /matches found/,
  /No matches/,
  /files found/,
  /No files/,
];

/** Mutation-indicating bash patterns (never mask these) */
const MUTATION_BASH_PATTERNS = [
  /^STDERR:/,
  /^Error:/,
  /\brm\s/,
  /\bmv\s/,
  /\bcp\s/,
  /\bmkdir\s/,
  /\bchmod\s/,
  /\bchown\s/,
  /\bnpm\s+(install|run|exec)/,
  /\bgit\s+(commit|push|merge|rebase|reset|checkout)/,
  /\bpip\s+install/,
];

/**
 * Placeholder message inserted when an observation is masked.
 */
function createMaskedPlaceholder(originalSize: number, toolName: string): string {
  return `[Observation masked — ${toolName} output (${originalSize} tokens). Re-read from environment if needed.]`;
}

/**
 * Attempt to detect the tool name from message metadata or content heuristics.
 */
function detectToolName(message: ChatMessage): string {
  if (message.name) return message.name;

  const content = typeof message.content === "string" ? message.content : "";

  if (
    content.startsWith("Error:") ||
    content.startsWith("STDOUT:") ||
    content.startsWith("STDERR:")
  ) {
    return "bash_exec";
  }
  for (const pattern of SEARCH_RESULT_PATTERNS) {
    if (pattern.test(content)) return "grep_search";
  }
  if (content.includes("files found") || content.includes("No files")) {
    return "glob_search";
  }
  for (const pattern of FILE_READ_PATTERNS) {
    if (pattern.test(content)) return "file_read";
  }
  return "unknown";
}

/**
 * Determine if a bash_exec output represents a read-only command.
 * Mutation outputs (errors, writes) are never masked.
 */
function isBashReadOnly(content: string): boolean {
  // If it contains mutation indicators, it's not read-only
  for (const pattern of MUTATION_BASH_PATTERNS) {
    if (pattern.test(content)) return false;
  }
  // Check for positive read-only indicators
  for (const pattern of READ_ONLY_BASH_PATTERNS) {
    if (pattern.test(content)) return true;
  }
  // Default: treat STDOUT-only results as read-only
  if (content.startsWith("STDOUT:")) return true;
  return false;
}

/**
 * Check if a ChatMessage is a read-only tool output that can be safely masked.
 *
 * Returns true for tool messages whose content can be re-obtained from the
 * environment (file reads, search results, read-only bash output).
 * Returns false for mutations, assistant messages, user messages, and errors.
 */
export function isReadOnlyToolOutput(message: ChatMessage): boolean {
  if (message.role !== "tool") return false;

  const toolName = detectToolName(message);

  // Mutation tools are never read-only
  if (toolName === "file_edit" || toolName === "file_write") return false;

  // Unknown tools are not safe to mask
  if (!READ_ONLY_TOOL_NAMES.has(toolName)) return false;

  // For bash_exec, check if it's a read-only command
  if (toolName === "bash_exec") {
    const content = typeof message.content === "string" ? message.content : "";
    return isBashReadOnly(content);
  }

  // file_read, grep_search, glob_search are always re-readable
  return true;
}

/**
 * Get the approximate token size of a message's content.
 * Uses a simple heuristic of ~4 characters per token.
 */
export function getOutputSize(message: ChatMessage): number {
  const content = typeof message.content === "string" ? message.content : "";
  return Math.ceil(content.length / 4);
}

/**
 * Apply observation masking to a message history.
 *
 * Replaces re-readable tool outputs with compact placeholders,
 * preserving the most recent N tool outputs to maintain immediate context.
 *
 * @param messages - The full message history (never mutated)
 * @param options  - Optional configuration:
 *   - keepRecentN: Number of recent tool outputs to keep unmasked (default: 3)
 *
 * @returns A new array with masked observations
 */
export function applyObservationMasking(
  messages: readonly ChatMessage[],
  options?: { readonly keepRecentN?: number },
): ChatMessage[] {
  const keepRecentN = options?.keepRecentN ?? 3;

  // Identify all tool message indices that are read-only candidates
  const readOnlyIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (isReadOnlyToolOutput(messages[i])) {
      readOnlyIndices.push(i);
    }
  }

  // Keep the last keepRecentN read-only tool outputs unmasked
  const protectedIndices = new Set(readOnlyIndices.slice(-keepRecentN));

  // Build result with masking applied to eligible, non-protected messages
  const result: ChatMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (
      readOnlyIndices.includes(i) &&
      !protectedIndices.has(i)
    ) {
      const toolName = detectToolName(msg);
      const size = getOutputSize(msg);
      result.push({
        ...msg,
        content: createMaskedPlaceholder(size, toolName),
      });
    } else {
      result.push({ ...msg });
    }
  }

  return result;
}
