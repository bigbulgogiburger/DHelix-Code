/**
 * `/plasmid` dependency-injection seam — Phase 1 Week 3.
 *
 * The `plasmidCommand` dispatcher and its six subcommands close over a
 * `CommandDeps` object rather than importing the loader / activation
 * store directly. This keeps the commands 100% pure w.r.t. filesystem
 * and LLM calls, which makes the unit tests cheap and hermetic.
 *
 * `defaultDeps(workingDirectory)` is the production factory used by
 * `builtin-commands.ts`. Tests pass an in-memory / tmpdir-backed deps
 * object directly into `makePlasmidCommand(...)`.
 */
import type { LoadResult, PlasmidScope } from "../../plasmids/types.js";
import { ActivationStore } from "../../plasmids/activation.js";
import {
  loadPlasmids as realLoadPlasmids,
  type LoaderOptions as RealLoaderOptions,
} from "../../plasmids/loader.js";

/**
 * Loader options as seen by the `/plasmid` commands.
 *
 * Extends Team 1's `LoaderOptions` with two Phase-1 advisory knobs
 * (`draftsPath`, `scopes`) that the commands pass through from
 * `CommandDeps`. Phase 1's real loader honours its built-in defaults;
 * both knobs are reserved for Phase 2 overrides and dropped here.
 */
export interface LoaderOptions extends RealLoaderOptions {
  readonly draftsPath?: string;
  readonly scopes?: readonly PlasmidScope[];
}

/** Loader signature as seen by commands — re-exported for test convenience. */
export type LoadPlasmidsFn = (opts: LoaderOptions) => Promise<LoadResult>;

/**
 * Phase-1 production loader wrapper. Drops the advisory fields before
 * forwarding to Team 1's loader; see {@link LoaderOptions} for the
 * rationale.
 */
const loadPlasmids: LoadPlasmidsFn = (opts) => {
  const { draftsPath: _draftsPath, scopes: _scopes, ...rest } = opts;
  // Suppress unused-variable diagnostics without losing the advisory
  // types at the call site.
  void _draftsPath;
  void _scopes;
  return realLoadPlasmids(rest);
};

/**
 * Everything the /plasmid command tree needs from the outside world.
 *
 * Keeping the seam narrow means tests can substitute a plain object
 * literal with no spies and no module-level mocks.
 */
export interface CommandDeps {
  /** Plasmid loader (Team 1's `loadPlasmids`, wrapped for Phase-1 extras). */
  readonly loadPlasmids: LoadPlasmidsFn;
  /** Activation store factory — callers pass `workingDirectory`. */
  readonly activationStore: ActivationStore;
  /** Effective registry path (relative to `workingDirectory`). */
  readonly registryPath: string;
  /** Optional shared/team registry path — forwarded to the loader. */
  readonly sharedRegistryPath?: string;
  /** Optional drafts cache path — forwarded to the loader. */
  readonly draftsPath?: string;
  /** Scopes the loader should walk; defaults to SCOPE_PRECEDENCE. */
  readonly scopes?: readonly PlasmidScope[];
  /**
   * Looks up the currently active LLM provider's `baseUrl`. Used by
   * `/plasmid show --body` and `/plasmid edit` to refuse displaying
   * `privacy: local-only` bodies when the active provider looks cloud-y.
   * Returns `undefined` when the provider is unknown / local.
   */
  readonly getActiveProviderBaseUrl?: () => string | undefined;
  /** Editor command (defaults to `$EDITOR` / `vim` / `nano`). */
  readonly editorCommand?: string;
  /** Clock — defaults to `() => new Date()`. Tests inject for determinism. */
  readonly now?: () => Date;
}

/** Default production deps factory. */
export function defaultDeps(workingDirectory: string): CommandDeps {
  // Phase-1 defaults mirror `plasmidConfigSchema` — the real config
  // loader lives at `src/config/loader.ts` and is wired in during
  // integration. The values here are only used when a caller forgets to
  // supply config; they match the schema defaults.
  const registryPath = ".dhelix/plasmids";
  const draftsPath = ".dhelix/plasmids/.drafts";
  const activationStore = new ActivationStore({ workingDirectory, registryPath });

  return {
    loadPlasmids,
    activationStore,
    registryPath,
    draftsPath,
    getActiveProviderBaseUrl: () => process.env.OPENAI_BASE_URL ?? undefined,
    editorCommand: process.env.EDITOR ?? undefined,
    now: () => new Date(),
  };
}
