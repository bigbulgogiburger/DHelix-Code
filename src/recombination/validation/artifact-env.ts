/**
 * Copy-on-write workspace builder (P-1.17 §Q1).
 *
 * Team 2 — Phase 3. Builds an isolated `${TMPDIR}/dhelix-val-<txid>/`
 * containing:
 *   - Symlink tree of `.dhelix/{agents,skills,commands,hooks,rules}/`
 *     (posix) or copy-fallback (windows / cross-device)
 *   - Copy of `.dhelix/prompt-sections/generated/*.md` (read by runtime)
 *   - Copy of `DHELIX.md`
 *   - Empty mutable scratch dir the case-runner can write into
 *
 * Ensures validation never mutates real project state (I-8). `cleanup()`
 * recursively removes the workspace — callers MUST invoke it in a finally.
 *
 * Layer: Core. Heavy I/O; async.
 */
import type { BuildArtifactEnvFn } from "../types.js";

export const buildArtifactEnv: BuildArtifactEnvFn = async () => {
  throw new Error("TODO Phase 3 Team 2: buildArtifactEnv");
};
