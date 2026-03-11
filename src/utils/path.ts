import { join, resolve, normalize, dirname, basename, extname, relative } from "node:path";
import { isWindows } from "./platform.js";

/**
 * Normalize a path to use forward slashes consistently.
 * Ensures cross-platform compatibility (Windows backslashes -> forward slashes).
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
 * Convert a Git Bash path to a Windows path.
 * Example: /c/Users/name/file.txt -> C:\Users\name\file.txt
 * Passes through paths that are not in Git Bash format.
 */
export function gitBashToWindows(p: string): string {
  // Match /c/... or /d/... (single drive letter after leading slash)
  const match = p.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (!match) return p;
  const driveLetter = match[1].toUpperCase();
  const rest = match[2] ?? "";
  return `${driveLetter}:${rest.replace(/\//g, "\\")}`;
}

/**
 * Convert a Windows path to a Git Bash path.
 * Example: C:\Users\name\file.txt -> /c/Users/name/file.txt
 * Passes through paths that are not in Windows format.
 */
export function windowsToGitBash(p: string): string {
  // Match C:\... or C:/...
  const match = p.match(/^([a-zA-Z]):[/\\](.*)$/);
  if (!match) return p;
  const driveLetter = match[1].toLowerCase();
  const rest = match[2] ?? "";
  const normalized = rest.replace(/\\/g, "/");
  return `/${driveLetter}/${normalized}`;
}

/** Alias for windowsToGitBash for backward compatibility */
export const toGitBashPath = windowsToGitBash;

/** Alias for gitBashToWindows for backward compatibility */
export const fromGitBashPath = gitBashToWindows;

/**
 * Expand Windows environment variables in a path.
 * Example: %USERPROFILE%\Documents -> C:\Users\name\Documents
 * Unresolved variables are left as-is.
 */
export function expandWindowsEnvVars(p: string): string {
  return p.replace(/%([^%]+)%/g, (_match, varName: string) => {
    const value = process.env[varName];
    return value ?? `%${varName}%`;
  });
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

/**
 * Check if a path is a UNC (Universal Naming Convention) path.
 * UNC paths start with \\ or //.
 * Example: \\server\share\folder
 */
export function isUNCPath(p: string): boolean {
  return /^\\\\[^\\]+\\[^\\]+/.test(p) || /^\/\/[^/]+\/[^/]+/.test(p);
}

/**
 * Normalize a UNC path by ensuring consistent forward slashes
 * and removing trailing slashes.
 * Example: \\server\share\folder\ -> //server/share/folder
 */
export function normalizeUNCPath(p: string): string {
  if (!isUNCPath(p)) return p;
  // Convert all backslashes to forward slashes, collapse duplicates (except leading //),
  // and remove trailing slash
  const normalized = p.replace(/\\/g, "/");
  // Preserve the leading // but collapse any extra slashes in the rest
  const withoutPrefix = normalized.slice(2).replace(/\/+/g, "/");
  const result = `//${withoutPrefix}`;
  // Remove trailing slash (but don't reduce to just "//")
  return result.length > 2 && result.endsWith("/") ? result.slice(0, -1) : result;
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
