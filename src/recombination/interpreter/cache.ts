/**
 * Content-addressed cache for the interpreter (Stage 2a).
 *
 * Layout (under the project working directory):
 *   .dhelix/recombination/objects/<first2>/<rest>.json
 *
 * Keys are sha256 over `${bodyFingerprint}|${INTERPRETER_VERSION}|${modelId}|${strategy}`.
 * Write is atomic: we stage to `<path>.tmp` then `rename()`. Reads never throw —
 * malformed / unreadable / aborted reads surface as a miss so the caller can
 * re-run the interpreter. The cache does NOT contain plasmid bodies (I-8),
 * only the compiled IR.
 *
 * Layer: Core (Layer 2). Uses `node:crypto`, `node:fs/promises`, `utils/path`.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getLogger } from "../../utils/logger.js";
import { RECOMBINATION_OBJECTS_DIR } from "../types.js";
import type { CompiledPlasmidIR, InterpreterStrategy } from "../types.js";

/** Bump this whenever the interpreter's prompts / normalisation change. */
export const INTERPRETER_VERSION = "1.0.0";

/** Parameters fed into the content-addressed key. */
export interface CacheKeyInput {
  readonly bodyFingerprint: string;
  readonly modelId: string;
  readonly strategy: InterpreterStrategy;
}

/**
 * Deterministic cache key. The fields are joined with `\x00` so separator
 * collisions are impossible even if a model id contains `|`.
 */
export function buildCacheKey(input: CacheKeyInput): string {
  return createHash("sha256")
    .update(input.bodyFingerprint, "utf8")
    .update("\x00", "utf8")
    .update(INTERPRETER_VERSION, "utf8")
    .update("\x00", "utf8")
    .update(input.modelId, "utf8")
    .update("\x00", "utf8")
    .update(input.strategy, "utf8")
    .digest("hex");
}

/**
 * Absolute path where the cache entry for `key` lives.
 *
 * @param workingDirectory - Project root.
 * @param key              - Hex sha256 from {@link buildCacheKey}.
 */
export function cachePathFor(workingDirectory: string, key: string): string {
  const prefix = key.slice(0, 2);
  const rest = key.slice(2);
  return join(workingDirectory, RECOMBINATION_OBJECTS_DIR, prefix, `${rest}.json`);
}

/**
 * Read a cached IR if present. Returns `null` on miss, unreadable files, or
 * malformed JSON. Aborts short-circuit to `null` (the cache is best-effort).
 * Malformed entries are logged once so we can observe cache corruption without
 * flooding logs on repeat hits.
 */
export async function readCached(
  workingDirectory: string,
  key: string,
  signal?: AbortSignal,
): Promise<CompiledPlasmidIR | null> {
  if (signal?.aborted === true) return null;
  const path = cachePathFor(workingDirectory, key);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isCompiledIR(parsed)) {
      getLogger().warn({ cachePath: path }, "interpreter cache entry malformed; treating as miss");
      return null;
    }
    return parsed;
  } catch (error) {
    getLogger().warn(
      { cachePath: path, error: error instanceof Error ? error.message : String(error) },
      "interpreter cache entry parse failed; treating as miss",
    );
    return null;
  }
}

/**
 * Write `ir` atomically to the cache. Creates parent directories if missing.
 * Aborts short-circuit silently (the next run will repopulate).
 */
export async function writeCached(
  workingDirectory: string,
  key: string,
  ir: CompiledPlasmidIR,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted === true) return;
  const path = cachePathFor(workingDirectory, key);
  const tmp = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmp, JSON.stringify(ir, null, 2), "utf8");
  await rename(tmp, path);
}

/** Minimal runtime guard — checks the IR envelope without re-running Zod. */
function isCompiledIR(value: unknown): value is CompiledPlasmidIR {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.plasmidId === "string" &&
    typeof obj.bodyFingerprint === "string" &&
    typeof obj.summary === "string" &&
    Array.isArray(obj.intents) &&
    typeof obj.cacheKey === "string"
  );
}
