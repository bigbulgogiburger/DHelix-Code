/**
 * Plasmid Runtime Guard (Layer A — pure function, no I/O).
 *
 * I-8 Compile-Runtime Hermeticity: plasmid bodies must never flow into the
 * agent's runtime context. This module provides the canonical path matcher
 * and tool-call path extractor used by Layer B (preflight) and future layers.
 *
 * Scope (what is "plasmid internals"):
 *   1. any path canonicalizing under `.dhelix/plasmids/**`
 *   2. any path canonicalizing under `.dhelix/plasmids/.drafts/**`
 *   3. reserved filenames `metadata.yaml` / `metadata.yml` / `body.md`
 *      when their parent directory chain contains `.dhelix/plasmids`
 *
 * Canonicalization rules (applied in order):
 *   - percent-decode once (`%2E%2E` → `..`, `%2F` → `/`)
 *   - strip `file://` scheme if present
 *   - POSIX-normalize separators (`\\` → `/`)
 *   - resolve against `workingDirectory` with `node:path.resolve`
 *   - lower-case for case-insensitive compare (HFS+/NTFS safety)
 *
 * NOTE: This file is deliberately Leaf-layer — no imports from `cli/`,
 * no async I/O, no telemetry side-effects. Callers decide what to do on hit.
 *
 * @module plasmids/runtime-guard
 */

import { resolve as pathResolve } from "node:path";

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Canonical-path regex list. All patterns are case-insensitive (`/i`)
 * because macOS HFS+/APFS default and Windows NTFS are case-insensitive;
 * refusing `.DHelix/Plasmids/...` and `.dhelix/plasmids/...` uniformly
 * is the only safe posture.
 *
 * Patterns are ordered from most-specific to most-general so the
 * reported `matchedPattern` is informative. `isPathBlocked` stops at first hit.
 */
export const RUNTIME_BLOCKED_PATTERNS: readonly RegExp[] = [
  // .dhelix/plasmids/.drafts/** — draft workspace
  /[\\/]\.dhelix[\\/]plasmids[\\/]\.drafts([\\/]|$)/i,
  // .dhelix/plasmids/** — main plasmid source tree (both unix and windows seps)
  /[\\/]\.dhelix[\\/]plasmids([\\/]|$)/i,
  // Reserved filenames — only block when under .dhelix/plasmids context.
  // (This is enforced by the combined check below; listed here for telemetry clarity.)
  /[\\/]\.dhelix[\\/]plasmids[\\/].*[\\/](?:metadata\.ya?ml|body\.md)$/i,
  // Phase 3 — recombination system boundary (transcripts, refs, objects,
  // audit + validation ledgers). Runtime agents must not read these: refs
  // would leak plasmid ids and validation jsonl lines can carry plasmid
  // identifiers and override reasons. Entire `.dhelix/recombination/` tree
  // is off-limits at runtime (I-8 defense-in-depth).
  /[\\/]\.dhelix[\\/]recombination([\\/]|$)/i,
] as const;

/**
 * Reserved filenames that may NOT appear anywhere inside a plasmid directory.
 * Used by the "parent-dir contains `.dhelix/plasmids`" guard path.
 */
const RESERVED_FILENAMES: readonly RegExp[] = [
  /[\\/](?:metadata\.ya?ml|body\.md)$/i,
] as const;

/** Regex to detect `.dhelix/plasmids` anywhere in a path prefix chain. */
const PLASMID_DIR_ANCHOR = /[\\/]\.dhelix[\\/]plasmids([\\/]|$)/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockedMatch {
  /** Canonicalized (resolved + lower-cased) path that matched. */
  readonly path: string;
  /** String form of the regex that caught it (for telemetry). */
  readonly pattern: string;
}

export interface ExtractedPath {
  /** Raw argument value as it arrived in the tool call. */
  readonly value: string;
  /**
   * Which argument key produced this path — e.g. `"path"`, `"file_path"`,
   * `"pattern"`, or `"command#cat"` for bash token extraction where the
   * suffix is the utility (`cat`, `rg`, `grep`, etc.) that referenced it.
   */
  readonly argKey: string;
}

// ---------------------------------------------------------------------------
// Canonicalization
// ---------------------------------------------------------------------------

/**
 * Safely percent-decode a value *once*. `decodeURIComponent` may throw on
 * malformed input; we swallow errors and fall back to the original string
 * because a malformed path cannot be a legitimate access anyway.
 */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Canonicalize a raw path-like string for matching:
 *   1. strip `file://` prefix
 *   2. percent-decode once
 *   3. POSIX-normalize separators
 *   4. resolve against cwd (handles `..` traversals completely)
 *   5. lower-case for case-insensitive compare
 *
 * The returned string is stable across macOS / Linux / Windows inputs.
 */
function canonicalize(value: string, workingDirectory: string): string {
  let raw = value.trim();
  if (raw.startsWith("file://")) {
    raw = raw.slice("file://".length);
  }
  raw = safeDecode(raw);
  // POSIX-normalize: convert backslashes so `node:path.resolve` on POSIX
  // doesn't treat `.dhelix\plasmids\foo` as a single opaque filename.
  const posixForm = raw.replace(/\\/g, "/");
  const absolute = pathResolve(workingDirectory, posixForm);
  return absolute.toLowerCase();
}

// ---------------------------------------------------------------------------
// Public API — Layer A
// ---------------------------------------------------------------------------

/**
 * Classify a single path-like value.
 *
 * @param path              raw argument value (may be relative, URL-encoded, backslash, traversal)
 * @param workingDirectory  absolute cwd to resolve relative values against
 * @returns                 `BlockedMatch` if the canonical form hits any
 *                          blocklist pattern, otherwise `null`.
 *
 * Pure function: no I/O, no side effects. Safe to call from any layer.
 */
export function isPathBlocked(path: string, workingDirectory: string): BlockedMatch | null {
  if (typeof path !== "string" || path.length === 0) {
    return null;
  }

  const canonical = canonicalize(path, workingDirectory);

  // Primary patterns — direct `.dhelix/plasmids/**` hits (incl. drafts).
  for (const pattern of RUNTIME_BLOCKED_PATTERNS) {
    if (pattern.test(canonical)) {
      return { path: canonical, pattern: pattern.source };
    }
  }

  // Secondary: reserved filename under plasmid directory.
  // (Catches `.dhelix/plasmids/foo/metadata.yaml` even if primary regexes missed.)
  if (PLASMID_DIR_ANCHOR.test(canonical)) {
    for (const rf of RESERVED_FILENAMES) {
      if (rf.test(canonical)) {
        return { path: canonical, pattern: rf.source };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tool-argument extraction
// ---------------------------------------------------------------------------

/**
 * Known path-bearing argument keys across the built-in tool surface.
 * Covered tools per mission scope: file_read / file_write / file_edit /
 * glob_search / grep_search / list_dir / bash_exec / mkdir / safe_rename /
 * apply_patch / batch_file_ops / find_references / find_dependencies /
 * symbol_search / code_outline.
 *
 * Tools that don't appear here are handled by the per-tool switch below;
 * anything further is skipped cleanly (empty extraction).
 */
const PATH_ARG_KEYS: readonly string[] = [
  "path",
  "file_path",
  "filePath",
  "file",
  "target_path",
  "targetPath",
  "destination",
  "dest",
  "source",
  "src",
  "from",
  "to",
  "directory",
  "dir",
  "cwd",
  "root",
  "rootPath",
  "pattern", // glob_search — the pattern itself is a path-like glob
  "glob",
  "paths", // batch_file_ops — array form handled separately
] as const;

const BASH_READ_COMMANDS: ReadonlySet<string> = new Set([
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "rg",
  "grep",
  "egrep",
  "fgrep",
  "find",
  "fd",
  "ls",
  "cp",
  "mv",
  "rm",
  "bat",
  "xxd",
  "od",
  "awk",
  "sed",
  "nl",
  "wc",
  "file",
  "stat",
  "open",
  "tee",
  "dd",
]);

/**
 * Heuristic: does a bash token *look* like a path?
 *  - contains a `/` (`.dhelix/plasmids/...`)
 *  - starts with `.` (`./x`, `../x`, `.dhelix/...`)
 *  - starts with `~` (home-dir reference)
 *  - contains `\\` (Windows path)
 */
function tokenLooksLikePath(token: string): boolean {
  if (token.length === 0) return false;
  if (token.includes("/") || token.includes("\\")) return true;
  if (token.startsWith(".") || token.startsWith("~")) return true;
  return false;
}

/**
 * Strip shell quoting from a token for matching. Agents frequently emit
 * `"path"` or `'path'` literally; we normalize before the path check.
 */
function stripQuotes(token: string): string {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return token.slice(1, -1);
    }
  }
  return token;
}

/**
 * Extract path-like tokens from a bash `command` string.
 *
 * Strategy:
 *  1. split on whitespace (best-effort; we don't implement a full shell lexer)
 *  2. if the first non-flag token is a known read-utility, scan every
 *     subsequent non-flag token
 *  3. otherwise still scan every token — over-inclusion is safe because
 *     `isPathBlocked` filters false positives
 *  4. also inspect the full command string for an embedded plasmid path
 *     substring so that `rg 'secret' .dhelix/plasmids` and
 *     `FILE=.dhelix/plasmids/x cat $FILE` both surface hits
 */
function extractFromBashCommand(command: string): readonly ExtractedPath[] {
  const out: ExtractedPath[] = [];
  if (typeof command !== "string" || command.length === 0) return out;

  // Split by any whitespace; shell operators stay attached but that's OK
  // because `isPathBlocked` operates on the canonicalized form.
  const rawTokens = command.split(/\s+/).filter((t) => t.length > 0);
  const tokens = rawTokens.map(stripQuotes);

  // Identify the leading utility (skip env-var assignments like FOO=bar).
  let utility = "";
  for (const tok of tokens) {
    if (tok.includes("=") && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) continue;
    utility = tok;
    break;
  }

  const isReadCommand = BASH_READ_COMMANDS.has(utility);
  const argKeySuffix = isReadCommand ? `command#${utility}` : "command";

  for (const tok of tokens) {
    // Skip flags and the utility itself.
    if (tok === utility) continue;
    if (tok.startsWith("-")) continue;
    if (tok.includes("=") && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) {
      // Also inspect the RHS of `VAR=/path`.
      const rhs = tok.slice(tok.indexOf("=") + 1);
      if (tokenLooksLikePath(rhs)) {
        out.push({ value: rhs, argKey: argKeySuffix });
      }
      continue;
    }
    if (tokenLooksLikePath(tok)) {
      out.push({ value: tok, argKey: argKeySuffix });
    }
  }

  // Defense-in-depth: if the literal substring `.dhelix/plasmids` appears
  // anywhere (e.g. inside a quoted-string pipeline), add it as a synthetic
  // value. This catches `bash -c "echo x | cat .dhelix/plasmids/y"` where
  // quoting would otherwise keep the path glued to neighbors.
  if (/\.dhelix[\\/]plasmids/i.test(command)) {
    const match = command.match(/[\w./\\~-]*\.dhelix[\\/]plasmids[\w./\\-]*/i);
    if (match && match[0]) {
      out.push({ value: match[0], argKey: `${argKeySuffix}#substr` });
    }
  }

  return out;
}

/**
 * Extract every path-like argument from a single tool call so that the
 * caller can run each through `isPathBlocked`.
 *
 * Tool-specific handling:
 *   - `bash_exec` / `bash`: parse `command` string via `extractFromBashCommand`
 *   - `batch_file_ops`: each entry in `operations[]` may carry `path`
 *   - generic: enumerate every value in `PATH_ARG_KEYS` that is a string
 *     or string array
 *
 * Unknown or pathless tools yield `[]` — safe skip.
 */
export function extractPathsFromToolCall(
  call: { name: string; arguments: Record<string, unknown> },
  _workingDirectory: string,
): readonly ExtractedPath[] {
  const out: ExtractedPath[] = [];
  const args = call.arguments ?? {};

  // bash_exec / bash — command-string parsing
  if (call.name === "bash_exec" || call.name === "bash") {
    const cmd = args["command"];
    if (typeof cmd === "string") {
      out.push(...extractFromBashCommand(cmd));
    }
    return out;
  }

  // batch_file_ops — operations[] may contain path arguments
  if (call.name === "batch_file_ops") {
    const ops = args["operations"];
    if (Array.isArray(ops)) {
      ops.forEach((op, idx) => {
        if (op && typeof op === "object") {
          const rec = op as Record<string, unknown>;
          for (const key of PATH_ARG_KEYS) {
            const v = rec[key];
            if (typeof v === "string") {
              out.push({ value: v, argKey: `operations[${idx}].${key}` });
            }
          }
        }
      });
    }
    // Fall through so that top-level path-like keys (rare) still get picked up.
  }

  // Generic: walk every known path-bearing key.
  for (const key of PATH_ARG_KEYS) {
    const v = args[key];
    if (typeof v === "string") {
      out.push({ value: v, argKey: key });
    } else if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (typeof item === "string") {
          out.push({ value: item, argKey: `${key}[${idx}]` });
        }
      });
    }
  }

  return out;
}
