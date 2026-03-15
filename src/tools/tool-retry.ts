import { readdir, stat } from "node:fs/promises";
import { join, dirname, basename, isAbsolute, resolve } from "node:path";

/**
 * A corrected tool call with the adjusted arguments and the reason for correction.
 */
export interface CorrectedToolCall {
  readonly args: Record<string, unknown>;
  readonly reason: string;
}

/**
 * Compute the Levenshtein distance between two strings.
 * Used to find closest matching file names.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

/**
 * Attempt to find the closest matching file in a directory.
 * Returns the corrected path or null if no close match is found.
 */
async function findClosestFile(
  filePath: string,
  workingDirectory: string,
): Promise<string | null> {
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(workingDirectory, filePath);
  const dir = dirname(absolutePath);
  const target = basename(absolutePath);

  try {
    const entries = await readdir(dir);
    let bestMatch = "";
    let bestDistance = Infinity;

    for (const entry of entries) {
      const distance = levenshtein(target.toLowerCase(), entry.toLowerCase());
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = entry;
      }
    }

    // Only accept matches with distance <= 3 (typo-level corrections)
    const maxDistance = Math.max(2, Math.floor(target.length * 0.3));
    if (bestDistance <= maxDistance && bestDistance > 0 && bestMatch) {
      const correctedPath = join(dir, bestMatch);
      // Verify the match actually exists
      try {
        await stat(correctedPath);
        return correctedPath;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    // Directory doesn't exist or can't be read
    return null;
  }
}

/**
 * Attempt to repair a malformed JSON string in tool arguments.
 * Handles common issues like trailing commas, missing quotes, etc.
 */
function repairJsonArgs(args: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const repaired = { ...args };
    let modified = false;

    for (const [key, value] of Object.entries(repaired)) {
      if (typeof value === "string") {
        // Try to parse stringified JSON
        const trimmed = value.trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            repaired[key] = JSON.parse(trimmed);
            modified = true;
          } catch {
            // Try fixing common JSON issues
            const fixed = trimmed
              .replace(/,\s*([}\]])/g, "$1") // trailing commas
              .replace(/'/g, '"') // single quotes to double
              .replace(/(\w+)\s*:/g, '"$1":'); // unquoted keys
            try {
              repaired[key] = JSON.parse(fixed);
              modified = true;
            } catch {
              // Cannot repair this value
            }
          }
        }
      }
    }

    return modified ? repaired : null;
  } catch {
    return null;
  }
}

/**
 * Extract file path from tool arguments.
 */
function extractFilePath(args: Record<string, unknown>): string | undefined {
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  if (typeof args["directory"] === "string") return args["directory"];
  return undefined;
}

/**
 * Determine the path argument key used in the tool args.
 */
function getPathKey(args: Record<string, unknown>): string | undefined {
  const keys = ["file_path", "path", "filePath", "directory"];
  return keys.find((k) => typeof args[k] === "string");
}

/**
 * Attempts to correct failed tool calls based on the error type:
 *
 * - ENOENT: searches for the closest matching file path in the same directory
 * - Invalid args / JSON parse errors: attempts to repair malformed JSON in arguments
 * - Permission denied (EACCES): returns null (not auto-correctable)
 * - Unknown errors: returns null
 *
 * @param toolName - Name of the tool that failed
 * @param originalArgs - The original arguments that caused the failure
 * @param error - The error from the failed execution
 * @param workingDirectory - The current working directory
 * @returns A corrected tool call, or null if correction is not possible
 */
export async function retryWithCorrection(
  toolName: string,
  originalArgs: Record<string, unknown>,
  error: Error,
  workingDirectory: string,
): Promise<CorrectedToolCall | null> {
  const message = error.message;

  // Permission denied — not auto-correctable
  if (/EACCES|permission denied/i.test(message)) {
    return null;
  }

  // ENOENT — file not found, try to find closest match
  if (/ENOENT|no such file|not found/i.test(message)) {
    const filePath = extractFilePath(originalArgs);
    if (!filePath) return null;

    const corrected = await findClosestFile(filePath, workingDirectory);
    if (!corrected) return null;

    const pathKey = getPathKey(originalArgs);
    if (!pathKey) return null;

    return {
      args: { ...originalArgs, [pathKey]: corrected },
      reason: `File not found: "${basename(filePath)}" — corrected to closest match: "${basename(corrected)}"`,
    };
  }

  // JSON parse errors or invalid arguments
  if (/parse.*error|invalid.*json|unexpected token|invalid.*arg/i.test(message)) {
    const repaired = repairJsonArgs(originalArgs);
    if (!repaired) return null;

    return {
      args: repaired,
      reason: `Repaired malformed JSON arguments for tool "${toolName}"`,
    };
  }

  // Unknown error type — cannot auto-correct
  return null;
}
