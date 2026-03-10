import { join, resolve, normalize, dirname, basename, extname, relative } from "node:path";
import { isWindows } from "./platform.js";

/**
 * Normalize a path to use forward slashes consistently.
 * Ensures cross-platform compatibility (Windows backslashes → forward slashes).
 */
export function normalizePath(p: string): string {
  const normalized = normalize(p);
  return isWindows() ? normalized.replace(/\\/g, "/") : normalized;
}

/** Resolve and normalize a path */
export function resolvePath(...segments: string[]): string {
  return normalizePath(resolve(...segments));
}

/** Join and normalize path segments */
export function joinPath(...segments: string[]): string {
  return normalizePath(join(...segments));
}

/** Get the directory name of a path (normalized) */
export function dirName(p: string): string {
  return normalizePath(dirname(p));
}

/** Get the base file name */
export function baseName(p: string, ext?: string): string {
  return basename(p, ext);
}

/** Get file extension (including dot) */
export function extName(p: string): string {
  return extname(p);
}

/** Get relative path between two paths (normalized) */
export function relativePath(from: string, to: string): string {
  return normalizePath(relative(from, to));
}

/** Check if a path is absolute (recognizes both Unix and Windows formats on all platforms) */
export function isAbsolutePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/");
}

/**
 * Convert a Windows path to a Git Bash (MSYS) path.
 * Example: C:\Users\foo → /c/Users/foo
 */
export function toGitBashPath(windowsPath: string): string {
  if (!windowsPath) return windowsPath;
  const normalized = windowsPath.replace(/\\/g, "/");
  const driveMatch = normalized.match(/^([A-Za-z]):\//);
  if (driveMatch) {
    return "/" + driveMatch[1].toLowerCase() + normalized.slice(2);
  }
  return normalized;
}

/**
 * Convert a Git Bash (MSYS) path to a Windows path.
 * Example: /c/Users/foo → C:\Users\foo
 */
export function fromGitBashPath(gitBashPath: string): string {
  if (!gitBashPath) return gitBashPath;
  const match = gitBashPath.match(/^\/([a-zA-Z])\//);
  if (match) {
    return match[1].toUpperCase() + ":" + gitBashPath.slice(2).replace(/\//g, "\\");
  }
  return gitBashPath;
}

/**
 * Normalize drive letter casing to uppercase.
 * Ensures c:\foo and C:\foo are treated identically.
 */
export function normalizeDriveLetter(path: string): string {
  if (!path) return path;
  const match = path.match(/^([a-zA-Z]):/);
  if (match) {
    return path[0].toUpperCase() + path.slice(1);
  }
  return path;
}

/** Check if a path is a UNC path (\\\\server\\share or //server/share) */
export function isUNCPath(path: string): boolean {
  return /^\\\\[^\\]+\\[^\\]+/.test(path) || /^\/\/[^/]+\/[^/]+/.test(path);
}

/** Check if a path exceeds the Windows MAX_PATH limit (260 characters) */
export function isLongPath(path: string): boolean {
  return path.length > 260;
}

/**
 * Add the Windows long path prefix (\\\\?\\) if the path exceeds MAX_PATH.
 * Already-prefixed paths are returned unchanged.
 */
export function ensureLongPathSupport(path: string): string {
  if (!isLongPath(path)) return path;
  if (path.startsWith("\\\\?\\")) return path;
  return "\\\\?\\" + path;
}
