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
