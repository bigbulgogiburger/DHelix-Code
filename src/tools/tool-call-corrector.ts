import { resolve, isAbsolute } from "node:path";
import type { CapabilityTier } from "../llm/model-capabilities.js";

/**
 * Corrects common tool call errors from lower-capability models.
 * HIGH tier bypasses all corrections for zero overhead.
 */
export function correctToolCall(
  args: Record<string, unknown>,
  workingDirectory: string,
  tier: CapabilityTier,
): Record<string, unknown> {
  if (tier === "high") return args;

  const corrected = { ...args };

  // 1. Relative path → absolute path
  for (const [key, value] of Object.entries(corrected)) {
    if (typeof value === "string" && isPathKey(key) && !isAbsolute(value)) {
      corrected[key] = resolve(workingDirectory, value);
    }
  }

  // 2. Type coercion ("true"→true, "false"→false, "123"→123)
  for (const [key, value] of Object.entries(corrected)) {
    if (value === "true") corrected[key] = true;
    else if (value === "false") corrected[key] = false;
    else if (typeof value === "string" && /^\d+$/.test(value) && isNumericKey(key)) {
      corrected[key] = parseInt(value, 10);
    }
  }

  return corrected;
}

function isPathKey(key: string): boolean {
  const pathKeys = ["file_path", "path", "directory", "dir", "filepath", "filename"];
  return pathKeys.includes(key.toLowerCase());
}

function isNumericKey(key: string): boolean {
  const numKeys = ["limit", "offset", "timeout", "line", "count", "depth"];
  return numKeys.includes(key.toLowerCase());
}
