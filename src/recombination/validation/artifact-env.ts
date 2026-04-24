/**
 * Copy-on-write workspace builder (P-1.17 §Q1, §5).
 *
 * Team 2 — Phase 3. Builds an isolated `${TMPDIR}/dhelix-val-<txid>-<rnd>/`
 * that mirrors only the runtime-readable artifacts from the project:
 *
 *   - `.dhelix/{agents,skills,commands,hooks,rules}/` — symlinked on posix,
 *     deep-copied on windows (cross-device safe)
 *   - `.dhelix/prompt-sections/generated/*.md` — always copied (the runtime
 *     may mutate these during a case; symlinks would leak mutations back
 *     into the source project)
 *   - `DHELIX.md` — always copied
 *   - empty `scratch/` — the case-runner's cwd, freely mutable
 *
 * I-8: plasmid bodies (`.dhelix/plasmids/`) and compile artefacts
 * (`.dhelix/recombination/`) MUST NOT be mirrored. They belong to the
 * compile boundary, not the runtime. The loop below asserts their names
 * are not among the mirrored directories; see `FORBIDDEN_DIRS`.
 *
 * `cleanup()` recursively removes the workspace root. Idempotent — a
 * second call after the directory was already removed is a no-op.
 *
 * Layer: Core. Heavy I/O; async.
 */
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";

import type { ArtifactEnv, BuildArtifactEnvFn } from "../types.js";

/** Artifact dirs that are mirrored (by symlink on posix, by copy on win32). */
const MIRRORED_ARTIFACT_DIRS: readonly string[] = [
  ".dhelix/agents",
  ".dhelix/skills",
  ".dhelix/commands",
  ".dhelix/hooks",
  ".dhelix/rules",
];

/** Directories that the I-8 boundary forbids mirroring into the runtime. */
const FORBIDDEN_DIRS: readonly string[] = [
  ".dhelix/plasmids",
  ".dhelix/recombination",
];

/** `.dhelix/prompt-sections/generated/` — md files copied (never symlinked). */
const PROMPT_SECTIONS_REL = ".dhelix/prompt-sections/generated";

/** Top-level constitution file — always copied. */
const CONSTITUTION_REL = "DHELIX.md";

/** Replace anything that's not alnum / dash / underscore with `-`. */
function sanitizeSegment(input: string): string {
  const trimmed = input.trim();
  const replaced = trimmed.replace(/[^A-Za-z0-9_-]+/g, "-");
  // Collapse runs of `-` and strip leading/trailing.
  const collapsed = replaced.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return collapsed || "tx";
}

/** Check whether a filesystem entry exists. Swallows ENOENT. */
async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.lstat(target);
    return true;
  } catch (err) {
    if (isEnoent(err)) return false;
    throw err;
  }
}

function isEnoent(err: unknown): boolean {
  return (
    err instanceof Error &&
    typeof (err as NodeJS.ErrnoException).code === "string" &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function ensureNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error("aborted");
  }
}

/** Recursively copy a directory tree. */
async function copyTree(
  src: string,
  dest: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  ensureNotAborted(signal);
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    ensureNotAborted(signal);
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      // Preserve symlinks verbatim — the runtime shouldn't follow them
      // outside the workspace, but we don't dereference here either.
      const linkTarget = await fs.readlink(from);
      await fs.symlink(linkTarget, to);
    } else if (entry.isDirectory()) {
      await copyTree(from, to, signal);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
    // Other special types (fifo, socket) are skipped silently.
  }
}

export const buildArtifactEnv: BuildArtifactEnvFn = async ({
  workingDirectory,
  transcriptId,
  signal,
}) => {
  ensureNotAborted(signal);

  // I-8 self-check: the mirrored list must not overlap with forbidden.
  for (const forbidden of FORBIDDEN_DIRS) {
    if (MIRRORED_ARTIFACT_DIRS.includes(forbidden)) {
      throw new Error(
        `I-8 boundary violation: ${forbidden} must never be mirrored into the CoW workspace`,
      );
    }
  }

  const mode: ArtifactEnv["mode"] =
    process.platform === "win32" ? "copy" : "symlink";
  const rand = randomBytes(3).toString("hex"); // 6 hex chars
  const workspaceRoot = path.join(
    os.tmpdir(),
    `dhelix-val-${sanitizeSegment(transcriptId)}-${rand}`,
  );

  await fs.mkdir(workspaceRoot, { recursive: true });

  try {
    // 1. Mirror artifact dirs (symlink on posix, deep-copy on win32).
    for (const relDir of MIRRORED_ARTIFACT_DIRS) {
      ensureNotAborted(signal);
      const sourceDir = path.join(workingDirectory, relDir);
      const exists = await pathExists(sourceDir);
      if (!exists) continue; // lenient — artifact dir may be empty
      const destDir = path.join(workspaceRoot, relDir);
      await fs.mkdir(path.dirname(destDir), { recursive: true });
      if (mode === "symlink") {
        await fs.symlink(sourceDir, destDir, "dir");
      } else {
        await copyTree(sourceDir, destDir, signal);
      }
    }

    // 2. Copy prompt-sections/generated/*.md — always copy (may mutate).
    const promptSrc = path.join(workingDirectory, PROMPT_SECTIONS_REL);
    if (await pathExists(promptSrc)) {
      const promptDest = path.join(workspaceRoot, PROMPT_SECTIONS_REL);
      await fs.mkdir(promptDest, { recursive: true });
      const entries = await fs.readdir(promptSrc, { withFileTypes: true });
      for (const entry of entries) {
        ensureNotAborted(signal);
        if (!entry.isFile()) continue;
        if (!entry.name.toLowerCase().endsWith(".md")) continue;
        await fs.copyFile(
          path.join(promptSrc, entry.name),
          path.join(promptDest, entry.name),
        );
      }
    }

    // 3. Copy DHELIX.md if it exists.
    const dhelixSrc = path.join(workingDirectory, CONSTITUTION_REL);
    if (await pathExists(dhelixSrc)) {
      await fs.copyFile(dhelixSrc, path.join(workspaceRoot, CONSTITUTION_REL));
    }

    // 4. Empty scratch/ — the case runner's cwd.
    await fs.mkdir(path.join(workspaceRoot, "scratch"), { recursive: true });
  } catch (err) {
    // Best-effort unwind so we don't leave orphaned tmp dirs on failure.
    await fs
      .rm(workspaceRoot, { recursive: true, force: true })
      .catch(() => {
        /* swallow — original error is more useful */
      });
    throw err;
  }

  const cleanup = async (): Promise<void> => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  };

  return { workspaceRoot, cleanup, mode };
};
