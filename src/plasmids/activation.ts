/**
 * Plasmid activation store — Phase 1 Week 3.
 *
 * Persists the set of active plasmid ids under
 * `<workingDirectory>/<registryPath>/.state/active.json`.
 *
 * Invariants
 * - I-9 user-scope invariance: activation mutates only this store, never
 *   the plasmid body on disk.
 * - Atomic write (tmp + rename) so concurrent writers never observe a
 *   half-written file.
 * - All I/O async; no `any`; immutable returns (readonly arrays, spread
 *   copies for state objects).
 *
 * The store is deliberately narrow: it only knows about
 * `ActivationState`. Cycle detection + `conflicts` intersection is done
 * by the caller (`commands/plasmid/activate.ts`) because those checks
 * need access to loaded metadata, which is outside this module's scope.
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ActivationState, PlasmidId } from "./types.js";

/** Options for constructing an ActivationStore. */
export interface ActivationStoreOptions {
  /** Project root (absolute path). */
  readonly workingDirectory: string;
  /** Registry root relative to `workingDirectory` (e.g. `.dhelix/plasmids`). */
  readonly registryPath: string;
}

/** Filename under `<registryPath>/.state/` that holds the activation JSON. */
export const ACTIVATION_FILE_NAME = "active.json";

/**
 * Canonical on-disk shape — matches {@link ActivationState} in types.ts.
 * Kept as a separate internal type so the parser stays self-contained.
 */
interface PersistedActivationState {
  readonly activePlasmidIds?: readonly string[];
  readonly updatedAt?: string;
  readonly profile?: string;
}

/**
 * File-backed activation store.
 *
 * The store is safe to instantiate eagerly: it does not read the file
 * until a method is called. Directories are created on demand.
 */
export class ActivationStore {
  private readonly filePath: string;

  constructor(opts: ActivationStoreOptions) {
    this.filePath = join(
      opts.workingDirectory,
      opts.registryPath,
      ".state",
      ACTIVATION_FILE_NAME,
    );
  }

  /** Absolute path of the backing file (exposed for logging/tests). */
  get path(): string {
    return this.filePath;
  }

  /**
   * Read the current activation state. Returns an empty-but-valid state
   * when the file does not yet exist.
   */
  async read(): Promise<ActivationState> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf-8");
    } catch (err) {
      if (isNotFoundError(err)) return emptyState();
      throw err;
    }

    const trimmed = raw.trim();
    if (trimmed === "") return emptyState();

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Corrupt file → treat as empty rather than throwing, to allow
      // recovery via the next write. The store is source-of-truth, not
      // audit log.
      return emptyState();
    }

    return normalize(parsed);
  }

  /**
   * Atomically persist the supplied state. Creates parent directories if
   * missing. The on-disk object always carries the caller-supplied
   * `updatedAt`; callers that want "now" should pass `new Date().toISOString()`.
   */
  async write(state: ActivationState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const serialized = JSON.stringify(freezeState(state), null, 2) + "\n";
    const tmpPath = `${this.filePath}.tmp.${process.pid}.${Date.now()}`;
    try {
      await writeFile(tmpPath, serialized, "utf-8");
      await rename(tmpPath, this.filePath);
    } catch (err) {
      try {
        await unlink(tmpPath);
      } catch {
        /* best effort */
      }
      throw err;
    }
  }

  /**
   * Add the given ids to the active set and persist. Duplicate ids are
   * ignored (set-union semantics). Returns the new state.
   */
  async activate(ids: readonly PlasmidId[]): Promise<ActivationState> {
    const current = await this.read();
    const merged = unionIds(current.activePlasmidIds, ids);
    const next: ActivationState = {
      activePlasmidIds: merged,
      updatedAt: new Date().toISOString(),
      ...(current.profile !== undefined ? { profile: current.profile } : {}),
    };
    await this.write(next);
    return next;
  }

  /**
   * Remove the given ids from the active set and persist. Ids not
   * currently active are silently ignored. Returns the new state.
   */
  async deactivate(ids: readonly PlasmidId[]): Promise<ActivationState> {
    const current = await this.read();
    const filtered = current.activePlasmidIds.filter((id) => !ids.includes(id));
    const next: ActivationState = {
      activePlasmidIds: filtered,
      updatedAt: new Date().toISOString(),
      ...(current.profile !== undefined ? { profile: current.profile } : {}),
    };
    await this.write(next);
    return next;
  }

  /** Reset activation to empty and persist. */
  async clear(): Promise<void> {
    await this.write(emptyState());
  }
}

/**
 * Detect `extends` chain cycles across the requested set of ids.
 *
 * The graph is the union of `already-active` + `newly-requested`. A
 * cycle is any path that revisits a node. This is O(V+E) and safe for
 * the plasmid-sized graphs we expect (<1k nodes per project).
 *
 * Returns the cycle (ordered ids closing the loop) if found.
 */
export function detectExtendsCycle(
  graph: ReadonlyMap<PlasmidId, PlasmidId | undefined>,
): readonly PlasmidId[] | null {
  const WHITE = 0; // unvisited
  const GRAY = 1; // on current DFS stack
  const BLACK = 2; // fully explored
  const color = new Map<PlasmidId, number>();
  const parent = new Map<PlasmidId, PlasmidId>();

  for (const start of graph.keys()) {
    if (color.get(start) !== undefined) continue;
    const stack: PlasmidId[] = [start];
    while (stack.length > 0) {
      const node = stack[stack.length - 1] as PlasmidId;
      const state = color.get(node) ?? WHITE;
      if (state === WHITE) {
        color.set(node, GRAY);
      }
      const parentExt = graph.get(node);
      if (parentExt !== undefined && (color.get(parentExt) ?? WHITE) === WHITE) {
        parent.set(parentExt, node);
        stack.push(parentExt);
        continue;
      }
      if (parentExt !== undefined && color.get(parentExt) === GRAY) {
        // Cycle — reconstruct path from `parentExt` back to itself.
        const cycle: PlasmidId[] = [parentExt];
        let cur: PlasmidId | undefined = node;
        while (cur !== undefined && cur !== parentExt) {
          cycle.push(cur);
          cur = parent.get(cur);
        }
        cycle.push(parentExt);
        return cycle.reverse();
      }
      color.set(node, BLACK);
      stack.pop();
    }
  }
  return null;
}

/** Return ids in `a` that are also in `b` (set intersection, order of `a`). */
export function intersectIds(
  a: readonly PlasmidId[],
  b: readonly PlasmidId[],
): readonly PlasmidId[] {
  if (a.length === 0 || b.length === 0) return [];
  const bSet = new Set<string>(b);
  return a.filter((id) => bSet.has(id));
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────

function emptyState(): ActivationState {
  return {
    activePlasmidIds: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function freezeState(state: ActivationState): PersistedActivationState {
  return {
    activePlasmidIds: [...state.activePlasmidIds],
    updatedAt: state.updatedAt,
    ...(state.profile !== undefined ? { profile: state.profile } : {}),
  };
}

function normalize(raw: unknown): ActivationState {
  if (!isObject(raw)) return emptyState();
  const ids = raw.activePlasmidIds;
  const active: readonly PlasmidId[] = Array.isArray(ids)
    ? ids.filter((v): v is string => typeof v === "string").map(toBrandedId)
    : [];
  const updatedAt =
    typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString();
  const profile = typeof raw.profile === "string" ? raw.profile : undefined;
  return {
    activePlasmidIds: active,
    updatedAt,
    ...(profile !== undefined ? { profile } : {}),
  };
}

function unionIds(
  a: readonly PlasmidId[],
  b: readonly PlasmidId[],
): readonly PlasmidId[] {
  const seen = new Set<string>();
  const out: PlasmidId[] = [];
  for (const id of [...a, ...b]) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFoundError(err: unknown): boolean {
  return isObject(err) && (err as { code?: string }).code === "ENOENT";
}

/** Narrow `string` to `PlasmidId` — the branded tag carries no runtime cost. */
function toBrandedId(s: string): PlasmidId {
  return s as PlasmidId;
}

/** Public helper — idempotent cast for callers holding raw strings. */
export function asPlasmidId(s: string): PlasmidId {
  return s as PlasmidId;
}
