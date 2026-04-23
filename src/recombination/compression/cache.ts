/**
 * Content-addressed cache for compression layer outputs (P-1.13 §3.5 + §5.3).
 *
 * Layer: Core (Layer 2) — async fs only, never sync.
 *
 * Path scheme (mirrors Team 1 interpreter cache, brief §Cache):
 *
 *   `<workingDirectory>/.dhelix/recombination/objects/<first2>/<rest>.json`
 *
 * Read semantics:
 *   - miss → `undefined` (silent)
 *   - corrupt (bad JSON, wrong schema marker) → `undefined` + log-once
 *
 * Write semantics:
 *   - best-effort; disk errors are logged-once and swallowed
 *   - never blocks the main compression flow
 *
 * The cache is intentionally generic — both Layer B (`B:` prefix) and
 * Layer D (`D:` prefix) use the same store. The layer marker is part of
 * the key so collisions are impossible.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { RECOMBINATION_OBJECTS_DIR } from "../types.js";

/** Internal envelope — we stamp a version so corrupt / stale blobs are skipped. */
interface CacheEnvelope<TPayload> {
  readonly schemaVersion: 1;
  readonly writtenAt: string;
  readonly payload: TPayload;
}

/** Tracks one-time log warnings so corrupt caches don't spam. */
const warnedPaths = new Set<string>();

function oncePerPath(path: string, message: string): void {
  if (warnedPaths.has(path)) return;
  warnedPaths.add(path);
  // eslint-disable-next-line no-console -- cache diagnostics are low-priority and go to stderr
  console.warn(`[compression-cache] ${message} (${path})`);
}

/** SHA-256 hex of the joined parts — NUL-separated for unambiguous segmentation. */
export function cacheKey(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\x00"), "utf8").digest("hex");
}

/** Resolve the absolute file path for a given cache hash under a working dir. */
export function cachePath(workingDirectory: string, hash: string): string {
  const first2 = hash.slice(0, 2);
  const rest = hash.slice(2);
  return join(
    workingDirectory,
    RECOMBINATION_OBJECTS_DIR,
    first2,
    `${rest}.json`,
  );
}

/** Async cache read. Silent on miss / corrupt. */
export async function readCache<TPayload>(
  workingDirectory: string,
  hash: string,
): Promise<TPayload | undefined> {
  const path = cachePath(workingDirectory, hash);
  let raw: string;
  try {
    raw = await readFile(path, { encoding: "utf8" });
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<TPayload>;
    if (!parsed || parsed.schemaVersion !== 1) {
      oncePerPath(path, "cache envelope version mismatch");
      return undefined;
    }
    return parsed.payload;
  } catch {
    oncePerPath(path, "cache blob parse error");
    return undefined;
  }
}

/** Async cache write. Silent on failure. */
export async function writeCache<TPayload>(
  workingDirectory: string,
  hash: string,
  payload: TPayload,
): Promise<void> {
  const path = cachePath(workingDirectory, hash);
  const envelope: CacheEnvelope<TPayload> = {
    schemaVersion: 1,
    writtenAt: new Date().toISOString(),
    payload,
  };
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(envelope), { encoding: "utf8" });
  } catch {
    oncePerPath(path, "cache write failed");
  }
}

/** Test helper — reset the one-time warn set. */
export function __resetWarnedForTests(): void {
  warnedPaths.clear();
}
