/**
 * Shared fixtures for /plasmid command unit tests.
 *
 * `fakeLoader(plasmids)` returns a `LoadPlasmidsFn` stub.
 * `fakeDeps(...)` builds a `CommandDeps` with the injectable loader
 * and an in-memory activation store.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  LoadedPlasmid,
  LoadFailure,
  LoadResult,
  PlasmidId,
  PlasmidMetadata,
  PlasmidPrivacy,
  PlasmidScope,
  PlasmidTier,
} from "../../../../src/plasmids/types.js";
import { ActivationStore } from "../../../../src/plasmids/activation.js";
import type { CommandDeps } from "../../../../src/commands/plasmid/deps.js";
import type { CommandContext } from "../../../../src/commands/registry.js";

export function makeMetadata(overrides: Partial<PlasmidMetadata> = {}): PlasmidMetadata {
  const id = (overrides.id ?? "alpha") as PlasmidId;
  return {
    id,
    name: overrides.name ?? String(id),
    description: overrides.description ?? "test plasmid",
    version: overrides.version ?? "0.1.0",
    tier: overrides.tier ?? ("L2" as PlasmidTier),
    scope: overrides.scope ?? ("local" as PlasmidScope),
    privacy: overrides.privacy ?? ("cloud-ok" as PlasmidPrivacy),
    created: overrides.created ?? "2026-04-01T00:00:00Z",
    updated: overrides.updated ?? "2026-04-01T00:00:00Z",
    ...(overrides.author !== undefined ? { author: overrides.author } : {}),
    ...(overrides.tags !== undefined ? { tags: overrides.tags } : {}),
    ...(overrides.requires !== undefined ? { requires: overrides.requires } : {}),
    ...(overrides.conflicts !== undefined ? { conflicts: overrides.conflicts } : {}),
    ...(overrides.extends !== undefined ? { extends: overrides.extends } : {}),
    ...(overrides.foundational !== undefined
      ? { foundational: overrides.foundational }
      : {}),
    ...(overrides.template !== undefined ? { template: overrides.template } : {}),
  };
}

export function makeLoaded(
  metadata: PlasmidMetadata,
  overrides: Partial<LoadedPlasmid> = {},
): LoadedPlasmid {
  return {
    metadata,
    body: overrides.body ?? "# Body\n\nHello.\n",
    bodyFingerprint: (overrides.bodyFingerprint ??
      ("fp-" + metadata.id)) as LoadedPlasmid["bodyFingerprint"],
    evalCases: overrides.evalCases ?? [],
    sourcePath: overrides.sourcePath ?? `/fake/${metadata.id}/body.md`,
    metadataPath: overrides.metadataPath ?? `/fake/${metadata.id}/metadata.yaml`,
    scopeOrigin: overrides.scopeOrigin ?? metadata.scope,
  };
}

export interface FixtureOptions {
  readonly loaded?: readonly LoadedPlasmid[];
  readonly failed?: readonly LoadFailure[];
  readonly baseUrl?: string;
  readonly editorCommand?: string;
}

export async function fakeDeps(
  opts: FixtureOptions = {},
): Promise<{
  readonly deps: CommandDeps;
  readonly workingDirectory: string;
  readonly cleanup: () => Promise<void>;
  readonly loadSpy: { calls: number };
  readonly lastResult: () => LoadResult;
}> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "dhelix-cmd-plasmid-"));
  const registryPath = ".dhelix/plasmids";
  const activationStore = new ActivationStore({ workingDirectory, registryPath });
  const result: LoadResult = {
    loaded: opts.loaded ?? [],
    failed: opts.failed ?? [],
  };
  const loadSpy = { calls: 0 };
  const deps: CommandDeps = {
    loadPlasmids: async () => {
      loadSpy.calls++;
      return result;
    },
    activationStore,
    registryPath,
    getActiveProviderBaseUrl: opts.baseUrl ? () => opts.baseUrl : undefined,
    editorCommand: opts.editorCommand,
  };
  return {
    deps,
    workingDirectory,
    loadSpy,
    lastResult: () => result,
    cleanup: async () => {
      await rm(workingDirectory, { recursive: true, force: true });
    },
  };
}

export function makeContext(workingDirectory: string): CommandContext {
  return {
    workingDirectory,
    model: "test-model",
    sessionId: "test-session",
    emit: () => {},
  };
}
