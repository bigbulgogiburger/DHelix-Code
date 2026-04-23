/**
 * Integration stub — Team 1 owns the final `src/plasmids/loader.ts`.
 *
 * This stub exists only so Team 3's /plasmid commands can typecheck in an
 * isolated worktree. The integration step will replace this import path
 * with the real loader module. The shape below mirrors the public
 * surface Team 3 depends on (LoaderOptions / LoadResult).
 *
 * DO NOT import this file from production code other than via
 * `src/commands/plasmid/deps.ts` default factory. Tests MUST inject
 * their own loader via `CommandDeps`.
 */
import type { LoadResult, PlasmidScope } from "../types.js";

/** Loader input surface — mirrors Team 1's planned signature. */
export interface LoaderOptions {
  readonly workingDirectory: string;
  readonly registryPath: string;
  readonly sharedRegistryPath?: string;
  readonly draftsPath?: string;
  readonly scopes?: readonly PlasmidScope[];
  readonly signal?: AbortSignal;
}

/**
 * Stub loader — returns an empty load result.
 *
 * Replaced at integration by the real implementation in
 * `src/plasmids/loader.ts` (Team 1).
 */
export async function loadPlasmids(_opts: LoaderOptions): Promise<LoadResult> {
  return {
    loaded: [],
    failed: [],
  };
}
