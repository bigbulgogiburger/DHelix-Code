import { getEncoding } from "js-tiktoken";

let encoder: ReturnType<typeof getEncoding> | undefined;

/**
 * Get or create the tiktoken encoder instance.
 * Uses cl100k_base encoding (GPT-4, GPT-3.5-turbo).
 */
function getEncoder(): ReturnType<typeof getEncoding> {
  if (!encoder) {
    encoder = getEncoding("cl100k_base");
  }
  return encoder;
}

/**
 * Count tokens in a text string using tiktoken (accurate).
 */
export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

/**
 * Estimate token count using character-based heuristic (fast, ~10% error).
 * Useful for real-time display while streaming.
 */
export function estimateTokens(text: string): number {
  // English: ~4 chars per token; CJK/Korean: ~2 chars per token
  // Use weighted average based on character type detection
  let asciiChars = 0;
  let wideChars = 0;

  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x2e80) {
      wideChars++;
    } else {
      asciiChars++;
    }
  }

  return Math.ceil(asciiChars / 4 + wideChars / 2);
}

/**
 * Count tokens for a chat message array (includes role/formatting overhead).
 */
export function countMessageTokens(messages: readonly { role: string; content: string }[]): number {
  let total = 0;
  for (const msg of messages) {
    // Each message has ~4 tokens overhead for role/formatting
    total += 4;
    total += countTokens(msg.content);
  }
  // Final assistant priming token
  total += 2;
  return total;
}
