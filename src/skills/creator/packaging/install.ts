/**
 * .dskill Installer — extract/verify/install a packaged dhelix skill archive
 *
 * Security hardening (MUST):
 *   - Tar-slip prevention: every entry path is resolved relative to destDir and
 *     must not escape via `..`, absolute paths, or drive-letter prefixes.
 *   - Symlink / hardlink rejection: any tar entry with a link typeflag is
 *     refused. dhelix never stores links inside .dskill archives.
 *   - Integrity verification: manifest.sha256 is re-computed over
 *     (path + "\n" + content) pairs sorted by path, matching F1's packager.
 *   - Trust-level policy: untrusted skills cannot request exec-class tools;
 *     community skills cannot request tools outside the available registry.
 *   - Atomic extraction: archive unpacks to an os.tmpdir() staging dir first,
 *     then is moved to its final location only after all security checks pass.
 *     On any failure / abort the staging dir is recursively cleaned up.
 *
 * Archive format (must match F1's packager):
 *   gzip(tar(
 *     [manifest.json, SKILL.md, <files...>]  // USTAR, no links, no dirs
 *   ))
 *
 * Public API:
 *   - installSkill(opts): extract + verify + policy-check + install
 *   - evaluateInstallPolicy(args): pure policy check used by installSkill and
 *     callable by CLI code wanting to surface violations pre-install.
 *   - InstallError (code + message): taxonomy of failure modes.
 *
 * @see F1's `./package.js` — DskillManifest + packageSkill (sha256 scheme)
 */

import { createHash } from "node:crypto";
import * as defaultFs from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { gunzipSync } from "node:zlib";

import type { DskillManifest } from "./package.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Trust level applied to the installed skill. */
export type InstallTrustLevel = "project" | "community" | "untrusted";

/** Options for {@link installSkill}. */
export interface InstallOptions {
  /** Absolute path to the `<name>-<version>.dskill` archive. */
  readonly archivePath: string;
  /** Destination directory (usually `<cwd>/.dhelix/skills`). */
  readonly destDir: string;
  /** Trust level to assign to the extracted skill. Default `community`. */
  readonly trustLevel?: InstallTrustLevel;
  /** If true, overwrite an existing skill dir with the same name. */
  readonly force?: boolean;
  /** Re-hash + compare against manifest.sha256. Default `true`. */
  readonly verify?: boolean;
  /** Tools the current runtime exposes — used by policy eval. */
  readonly availableTools?: readonly string[];
  /** fs override for tests. */
  readonly fs?: typeof import("node:fs/promises");
  /** Abort signal — honored before major I/O steps. */
  readonly signal?: AbortSignal;
}

/** Result of a successful install. */
export interface InstallResult {
  /** Final on-disk location of the installed skill. */
  readonly skillDir: string;
  /** Parsed manifest extracted from the archive. */
  readonly manifest: DskillManifest;
  /** Extracted file paths, relative to the skill dir, in archive order. */
  readonly filesExtracted: readonly string[];
  /** Whether the recomputed sha256 matched manifest.sha256. */
  readonly verified: boolean;
}

/** Discriminant for {@link InstallError}. */
export type InstallErrorCode =
  | "ARCHIVE_NOT_FOUND"
  | "ARCHIVE_CORRUPT"
  | "TAR_SLIP_REJECTED"
  | "SYMLINK_REJECTED"
  | "NAME_COLLISION"
  | "INTEGRITY_MISMATCH"
  | "POLICY_VIOLATION"
  | "IO_ERROR"
  | "ABORTED";

/** Typed install error carrying a machine-readable code. */
export class InstallError extends Error {
  readonly code: InstallErrorCode;

  constructor(code: InstallErrorCode, message: string) {
    super(message);
    this.name = "InstallError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/**
 * Tools that must never be granted to `untrusted` skills regardless of
 * availability. Tokens are matched case-insensitively as substrings.
 */
const UNTRUSTED_DENY_LIST: readonly string[] = [
  "execute_bash",
  "write_file",
  "exec",
];

/**
 * Evaluate trust-level policy against the manifest's requested tools.
 *
 * @returns list of human-readable violation messages (empty = allowed).
 */
export function evaluateInstallPolicy(args: {
  readonly manifest: DskillManifest;
  readonly trustLevel: InstallTrustLevel | undefined;
  readonly availableTools: readonly string[];
}): readonly string[] {
  const { manifest, trustLevel, availableTools } = args;
  const trust: InstallTrustLevel = trustLevel ?? "community";

  // project-level (or any non-community/untrusted) skills are unrestricted.
  if (trust === "project") return [];

  const requested = readRequestedTools(manifest);
  const violations: string[] = [];

  if (trust === "untrusted") {
    for (const tool of requested) {
      const lower = tool.toLowerCase();
      for (const denied of UNTRUSTED_DENY_LIST) {
        if (lower.includes(denied)) {
          violations.push(
            `untrusted skill cannot request tool '${tool}' (matches deny-list entry '${denied}')`,
          );
          break;
        }
      }
    }
    return violations;
  }

  // community: every requested tool must exist in availableTools.
  const available = new Set(availableTools);
  for (const tool of requested) {
    if (!available.has(tool)) {
      violations.push(
        `community skill requests tool '${tool}' not present in available tool registry`,
      );
    }
  }
  return violations;
}

/**
 * Best-effort read of `requires.tools` from a manifest. F1's {@link DskillManifest}
 * is a denormalized projection of {@link SkillManifest}; we support both a
 * top-level `tools` field and the nested `requires.tools` path.
 */
function readRequestedTools(manifest: DskillManifest): readonly string[] {
  const m = manifest as unknown as {
    readonly tools?: readonly string[];
    readonly requires?: { readonly tools?: readonly string[] };
  };
  if (Array.isArray(m.tools)) return m.tools;
  if (m.requires && Array.isArray(m.requires.tools)) return m.requires.tools;
  return [];
}

// ---------------------------------------------------------------------------
// Tar reader (USTAR subset — no links, no directories)
// ---------------------------------------------------------------------------

/** Parsed tar entry. */
interface TarEntry {
  readonly name: string;
  readonly type: "file" | "directory" | "link" | "symlink" | "other";
  readonly content: Buffer;
}

/** 512-byte tar header block size. */
const TAR_BLOCK_SIZE = 512;

/**
 * Parse a USTAR buffer into entries. Throws on corrupt headers.
 *
 * Supports: regular files (typeflag '0' or '\0'), directory ('5').
 * Rejects early: symlink ('2'), hardlink ('1'), everything else is tagged
 * "other" so the caller can decide.
 */
function parseTar(buf: Buffer): readonly TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + TAR_BLOCK_SIZE <= buf.length) {
    const header = buf.subarray(offset, offset + TAR_BLOCK_SIZE);
    // Two consecutive zero blocks = archive end.
    if (header.every((b) => b === 0)) {
      break;
    }

    const name = readCString(header, 0, 100);
    const sizeField = readCString(header, 124, 12).trim();
    const size = sizeField === "" ? 0 : Number.parseInt(sizeField, 8);
    if (!Number.isFinite(size) || size < 0) {
      throw new InstallError(
        "ARCHIVE_CORRUPT",
        `invalid tar size field '${sizeField}' at offset ${String(offset)}`,
      );
    }
    const typeFlag = String.fromCharCode(header[156] ?? 0);
    const prefix = readCString(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;

    offset += TAR_BLOCK_SIZE;
    const content = buf.subarray(offset, offset + size);
    offset += Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;

    const type =
      typeFlag === "0" || typeFlag === "\0"
        ? "file"
        : typeFlag === "5"
          ? "directory"
          : typeFlag === "1"
            ? "link"
            : typeFlag === "2"
              ? "symlink"
              : "other";

    entries.push({ name: fullName, type, content: Buffer.from(content) });
  }

  return entries;
}

/** Read NUL-terminated C string from a tar header field. */
function readCString(buf: Buffer, offset: number, length: number): string {
  const slice = buf.subarray(offset, offset + length);
  const nul = slice.indexOf(0);
  const end = nul === -1 ? slice.length : nul;
  return slice.subarray(0, end).toString("utf8");
}

/**
 * Decompress if gzipped (magic `1f 8b`), else return as-is. Keeps callers
 * agnostic of whether F1 chose `.tar` or `.tar.gz`.
 */
function maybeGunzip(buf: Buffer): Buffer {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      return gunzipSync(buf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InstallError("ARCHIVE_CORRUPT", `gunzip failed: ${msg}`);
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/**
 * Reject any entry whose resolved target escapes `destDir`. Guards against
 * tar-slip (`../../etc/passwd`), absolute paths, drive-letter prefixes, and
 * normalized-but-still-escaping paths.
 */
function assertSafeEntryPath(destDir: string, entryName: string): void {
  if (entryName.length === 0) {
    throw new InstallError("TAR_SLIP_REJECTED", "entry has empty name");
  }
  if (isAbsolute(entryName)) {
    throw new InstallError(
      "TAR_SLIP_REJECTED",
      `entry '${entryName}' uses absolute path`,
    );
  }
  // Defensive: reject any segment that is '..' — before resolving, so a
  // hand-crafted archive with `../evil.sh` is refused even on platforms that
  // normalize differently.
  const parts = entryName.split(/[\\/]/);
  if (parts.includes("..")) {
    throw new InstallError(
      "TAR_SLIP_REJECTED",
      `entry '${entryName}' contains '..' segment`,
    );
  }

  const target = resolve(destDir, entryName);
  const rel = relative(destDir, target);
  if (
    rel.startsWith("..") ||
    isAbsolute(rel) ||
    rel.split(/[\\/]/).includes("..")
  ) {
    throw new InstallError(
      "TAR_SLIP_REJECTED",
      `entry '${entryName}' escapes destination directory`,
    );
  }
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

/**
 * Compute sha256 over entries sorted by path (localeCompare). Must match F1's
 * packager byte-for-byte. Layout per entry:
 *   hash.update(relPath)
 *   hash.update(new Uint8Array([0]))   // single NUL byte
 *   hash.update(bytes)
 *   hash.update(new Uint8Array([0]))
 *
 * F1 hashes only the *original* (non-manifest) files — manifest.json is
 * generated *after* and is NOT part of the hash.
 */
function computeIntegrityHash(
  entries: readonly { readonly name: string; readonly content: Buffer }[],
): string {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const hash = createHash("sha256");
  const zero = new Uint8Array([0]);
  for (const { name, content } of sorted) {
    hash.update(name);
    hash.update(zero);
    hash.update(content);
    hash.update(zero);
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * Install a `.dskill` archive.
 *
 * Steps:
 *   1. Read archive bytes.
 *   2. Decompress (if gzipped) + parse USTAR entries.
 *   3. Early reject on symlink/hardlink + tar-slip per entry.
 *   4. Locate `manifest.json`, parse, verify sha256 over non-manifest files.
 *   5. Evaluate trust-level policy.
 *   6. Extract to staging dir under os.tmpdir().
 *   7. Check name collision; respect `force`.
 *   8. Atomically move staging → final destination.
 */
export async function installSkill(opts: InstallOptions): Promise<InstallResult> {
  const fs = opts.fs ?? defaultFs;
  const verify = opts.verify ?? true;
  const trustLevel: InstallTrustLevel = opts.trustLevel ?? "community";
  const signal = opts.signal;

  throwIfAborted(signal);

  // --- 1. Read archive ---
  let archiveBuf: Buffer;
  try {
    const data = await fs.readFile(opts.archivePath);
    archiveBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      throw new InstallError(
        "ARCHIVE_NOT_FOUND",
        `archive not found at ${opts.archivePath}`,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new InstallError("IO_ERROR", `failed to read archive: ${msg}`);
  }

  throwIfAborted(signal);

  // --- 2. Decompress + parse ---
  const tarBuf = maybeGunzip(archiveBuf);
  let rawEntries: readonly TarEntry[];
  try {
    rawEntries = parseTar(tarBuf);
  } catch (err) {
    if (err instanceof InstallError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new InstallError("ARCHIVE_CORRUPT", `tar parse failed: ${msg}`);
  }

  // --- 3. Validate entries (security) ---
  const fileEntries: TarEntry[] = [];
  for (const entry of rawEntries) {
    if (entry.type === "symlink" || entry.type === "link") {
      throw new InstallError(
        "SYMLINK_REJECTED",
        `entry '${entry.name}' is a symlink or hardlink`,
      );
    }
    if (entry.type === "directory") {
      // Directories are implicit; still validate path.
      assertSafeEntryPath(opts.destDir, entry.name);
      continue;
    }
    if (entry.type === "other") {
      throw new InstallError(
        "ARCHIVE_CORRUPT",
        `entry '${entry.name}' has unsupported tar typeflag`,
      );
    }
    assertSafeEntryPath(opts.destDir, entry.name);
    fileEntries.push(entry);
  }

  // --- 4. Locate + parse manifest.json ---
  const manifestEntry = fileEntries.find((e) => e.name === "manifest.json");
  if (!manifestEntry) {
    throw new InstallError("ARCHIVE_CORRUPT", "archive is missing manifest.json");
  }
  let manifest: DskillManifest;
  try {
    manifest = JSON.parse(manifestEntry.content.toString("utf8")) as DskillManifest;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new InstallError(
      "ARCHIVE_CORRUPT",
      `manifest.json is not valid JSON: ${msg}`,
    );
  }

  const manifestName = (manifest as unknown as { readonly name?: unknown }).name;
  if (typeof manifestName !== "string" || manifestName.length === 0) {
    throw new InstallError(
      "ARCHIVE_CORRUPT",
      "manifest.json is missing required 'name' field",
    );
  }

  // --- Verify integrity over non-manifest files ---
  const hashableEntries = fileEntries.filter((e) => e.name !== "manifest.json");
  let verified = false;
  if (verify) {
    const expected = (manifest as unknown as { readonly sha256?: unknown }).sha256;
    if (typeof expected !== "string" || expected.length === 0) {
      throw new InstallError(
        "INTEGRITY_MISMATCH",
        "manifest.sha256 missing — cannot verify archive integrity",
      );
    }
    const actual = computeIntegrityHash(hashableEntries);
    if (actual !== expected) {
      throw new InstallError(
        "INTEGRITY_MISMATCH",
        `sha256 mismatch — expected ${expected}, computed ${actual}`,
      );
    }
    verified = true;
  }

  // --- 5. Policy ---
  const violations = evaluateInstallPolicy({
    manifest,
    trustLevel,
    availableTools: opts.availableTools ?? [],
  });
  if (violations.length > 0) {
    throw new InstallError(
      "POLICY_VIOLATION",
      `trust-level '${trustLevel}' policy violations:\n  - ${violations.join("\n  - ")}`,
    );
  }

  // --- 6. Staging extraction ---
  const stagingDir = await fs.mkdtemp(join(tmpdir(), "dhelix-skill-install-"));
  const filesExtracted: string[] = [];
  try {
    throwIfAborted(signal);

    for (const entry of fileEntries) {
      throwIfAborted(signal);
      const stagingTarget = join(stagingDir, entry.name);
      await fs.mkdir(dirname(stagingTarget), { recursive: true });
      await fs.writeFile(stagingTarget, entry.content);
      if (entry.name !== "manifest.json") {
        filesExtracted.push(entry.name);
      }
    }

    // --- 7. Name collision ---
    const finalDir = join(opts.destDir, manifestName);
    const skillMdPath = join(finalDir, "SKILL.md");
    const exists = await pathExists(fs, skillMdPath);
    if (exists && !opts.force) {
      throw new InstallError(
        "NAME_COLLISION",
        `skill '${manifestName}' already exists at ${finalDir} (pass force:true to overwrite)`,
      );
    }

    throwIfAborted(signal);

    // --- 8. Atomic(-ish) move: clear destination then rename ---
    if (exists) {
      await fs.rm(finalDir, { recursive: true, force: true });
    }
    await fs.mkdir(opts.destDir, { recursive: true });
    try {
      await fs.rename(stagingDir, finalDir);
    } catch (err) {
      // Cross-device? Fall back to recursive copy + cleanup.
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EXDEV") {
        await copyDirRecursive(fs, stagingDir, finalDir);
        await fs.rm(stagingDir, { recursive: true, force: true });
      } else {
        throw err;
      }
    }

    return {
      skillDir: finalDir,
      manifest,
      filesExtracted,
      verified,
    };
  } catch (err) {
    // Best-effort staging cleanup. Swallow secondary errors so the original
    // failure surfaces to the caller.
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    if (err instanceof InstallError) throw err;
    if (isAbortError(err)) {
      throw new InstallError("ABORTED", "install aborted");
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new InstallError("IO_ERROR", `install failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new InstallError("ABORTED", "install aborted before completion");
  }
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { readonly name?: unknown }).name;
  const code = (err as { readonly code?: unknown }).code;
  return name === "AbortError" || code === "ABORT_ERR";
}

async function pathExists(
  fs: typeof import("node:fs/promises"),
  path: string,
): Promise<boolean> {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyDirRecursive(
  fs: typeof import("node:fs/promises"),
  src: string,
  dst: string,
): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(fs, srcPath, dstPath);
    } else if (entry.isFile()) {
      const data = await fs.readFile(srcPath);
      await fs.writeFile(dstPath, data);
    }
    // Symlinks should not appear in staging; if they do, skip defensively.
  }
}

// Silence unused-import lint when path `sep` is only used in type-narrowing.
void sep;
