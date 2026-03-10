import { resolve } from "node:path";
import { lstatSync, realpathSync } from "node:fs";
import { normalizePath } from "../utils/path.js";

export interface PathFilterResult {
  readonly safe: boolean;
  readonly reason?: string;
}

/**
 * Sensitive directories relative to the user's home directory.
 * Paths are normalized with forward slashes for cross-platform matching.
 */
const SENSITIVE_HOME_PATHS: readonly string[] = [
  "/.ssh",
  "/.gnupg",
  "/.gpg",
  "/.aws/credentials",
  "/.azure/credentials",
  "/.config/gcloud",
  "/.docker/config.json",
  "/.npmrc",
  "/.pypirc",
  "/.netrc",
  "/.kube/config",
  "/.env",
];

const SENSITIVE_SYSTEM_PATHS: readonly string[] = [
  "/etc/shadow",
  "/etc/passwd",
  "/etc/sudoers",
  "/etc/master.passwd",
  "/private/etc/shadow",
  "/private/etc/master.passwd",
];

/**
 * Check whether a file path is safe to access given the working directory.
 *
 * Detects:
 * - Path traversal via `../` sequences that escape the working directory
 * - Absolute paths to sensitive directories (~/.ssh, ~/.gnupg, etc.)
 * - Absolute paths to sensitive system files (/etc/shadow, etc.)
 * - Symlink escape attempts (symlink resolves to a sensitive path)
 */
export function checkPath(path: string, workingDirectory: string): PathFilterResult {
  const normalizedWorkDir = normalizePath(resolve(workingDirectory));

  // Detect path traversal sequences that escape the working directory
  const normalizedInput = normalizePath(path);
  if (normalizedInput.includes("../") || normalizedInput.includes("/..")) {
    const resolved = normalizePath(resolve(workingDirectory, path));
    if (!resolved.startsWith(normalizedWorkDir + "/") && resolved !== normalizedWorkDir) {
      return {
        safe: false,
        reason: `Path traversal detected: "${path}" resolves outside working directory`,
      };
    }
  }

  // Resolve to an absolute path
  const resolvedPath = normalizePath(resolve(workingDirectory, path));

  // Check against sensitive system paths
  for (const sensitive of SENSITIVE_SYSTEM_PATHS) {
    if (resolvedPath === sensitive || resolvedPath.startsWith(sensitive + "/")) {
      return {
        safe: false,
        reason: `Access to sensitive system file blocked: ${sensitive}`,
      };
    }
  }

  // Check against sensitive home-relative paths
  const sensitiveMatch = checkSensitivePath(resolvedPath);
  if (sensitiveMatch) {
    return {
      safe: false,
      reason: sensitiveMatch,
    };
  }

  // Detect symlink escape: if the path exists as a symlink, check where it really points
  try {
    const stat = lstatSync(resolvedPath);
    if (stat.isSymbolicLink()) {
      const realPath = normalizePath(realpathSync(resolvedPath));

      // Check the real path against sensitive system paths
      for (const sensitive of SENSITIVE_SYSTEM_PATHS) {
        if (realPath === sensitive || realPath.startsWith(sensitive + "/")) {
          return {
            safe: false,
            reason: `Symlink escape detected: "${path}" resolves to sensitive system file ${sensitive}`,
          };
        }
      }

      // Check the real path against sensitive home paths
      const symlinkSensitiveMatch = checkSensitivePath(realPath);
      if (symlinkSensitiveMatch) {
        return {
          safe: false,
          reason: `Symlink escape detected: "${path}" points to "${realPath}" — ${symlinkSensitiveMatch}`,
        };
      }
    }
  } catch {
    // File doesn't exist yet or not accessible — skip symlink check
  }

  return { safe: true };
}

/**
 * Check if a resolved path matches a known sensitive home directory.
 * Returns a reason string if matched, or undefined if safe.
 */
function checkSensitivePath(resolvedPath: string): string | undefined {
  const homeDir = normalizePath(
    process.env["HOME"] ?? process.env["USERPROFILE"] ?? "",
  );
  if (!homeDir) {
    return undefined;
  }

  for (const sensitive of SENSITIVE_HOME_PATHS) {
    const fullSensitivePath = homeDir + sensitive;
    if (
      resolvedPath === fullSensitivePath ||
      resolvedPath.startsWith(fullSensitivePath + "/")
    ) {
      return `Access to sensitive path blocked: ~${sensitive}`;
    }
  }

  return undefined;
}
