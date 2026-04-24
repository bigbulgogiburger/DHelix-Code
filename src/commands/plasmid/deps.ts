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
import type {
  ChallengeAction,
  ChallengeLogEntry,
  CooldownDecision,
  LoadResult,
  OverridePending,
  PlasmidId,
  PlasmidMetadata,
  PlasmidScope,
} from "../../plasmids/types.js";
import { join } from "node:path";

import { ActivationStore } from "../../plasmids/activation.js";
import {
  loadPlasmids as realLoadPlasmids,
  type LoaderOptions as RealLoaderOptions,
} from "../../plasmids/loader.js";
import {
  webSearchAdapter,
  webFetchAdapter,
  type WebSearchFn,
  type WebFetchFn,
} from "../../plasmids/research/web-adapter.js";
import {
  appendChallenge as realAppendChallenge,
  readChallengesLog as realReadChallengesLog,
} from "../../plasmids/governance/challenges-log.js";
import { checkCooldown as realCheckCooldown } from "../../plasmids/governance/cooldown.js";
import { OverridesPendingStore as RealOverridesPendingStore } from "../../plasmids/governance/overrides-pending.js";
import { OVERRIDE_PENDING_PATH } from "../../plasmids/types.js";

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
 * Research-mode entrypoint signature — Phase 5 Team 1 owns the production
 * implementation in `src/plasmids/research-mode.ts` (`runResearchMode`).
 *
 * We declare a structural seam here rather than importing the function
 * directly so the Team-2 wiring (this file + `commands/plasmid/research.ts`)
 * can land independently of Team 1. The orchestrator can flip the default
 * factory to import the real symbol once Team 1 merges.
 *
 * Phase 5 dev-guide §2 contract:
 *   - `input.intent`        — natural-language request
 *   - `input.currentDraft?` — partial metadata when entering from `--from-file`
 *   - `input.maxSources?`   — defaults to RESEARCH_MAX_SOURCES (5)
 *   - `input.locale?`       — "ko" | "en"
 *
 *   - `deps.webSearch` / `deps.webFetch` — DI adapters
 *   - `deps.allowNetwork`                — false ⇒ throw PRIVACY_BLOCKED
 *
 * Returns markdown body + metadata patch + provenance bundle.
 */
export interface ResearchInput {
  readonly intent: string;
  readonly currentDraft?: Partial<PlasmidMetadata>;
  readonly maxSources?: number;
  readonly locale?: "ko" | "en";
}

export interface ResearchModeDeps {
  readonly webSearch: WebSearchFn;
  readonly webFetch: WebFetchFn;
  readonly allowNetwork: boolean;
  readonly now?: () => Date;
}

export interface ResearchResult {
  readonly synthesizedDraft: string;
  readonly metadataPatch: Partial<PlasmidMetadata>;
  readonly sources: import("../../plasmids/types.js").ResearchSource;
  readonly warnings: readonly string[];
}

export type RunResearchFn = (
  input: ResearchInput,
  deps: ResearchModeDeps,
  signal: AbortSignal,
) => Promise<ResearchResult>;

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

// ─── Phase 5 — Governance seam types (Team 3 contract surface) ────────────
//
// Team 3 owns the runtime modules (`challenges-log.ts`, `cooldown.ts`,
// `overrides-pending.ts`) but until those are merged, Team 4 (`challenge.ts`)
// must compile against a stable type contract. The shapes below mirror Phase
// 5 dev-guide §4 verbatim. When Team 3 lands, `defaultDeps` will wire the
// real implementations; the shape is identical so no consumer change is
// needed.

/** Append a single entry to `.dhelix/governance/challenges.log` (JSONL). */
export type AppendChallengeFn = (
  entry: ChallengeLogEntry,
  workingDirectory?: string,
) => Promise<void>;

/** Read every entry from the challenge log. Returns `[]` when missing. */
export type ReadChallengesLogFn = (
  workingDirectory?: string,
) => Promise<readonly ChallengeLogEntry[]>;

/**
 * Decide whether the given (plasmid, action) pair is allowed to proceed
 * given the cooldown contract from `metadata.challengeable`. Override
 * actions never start a cooldown; amend/revoke do (P-1.10 §4.2).
 */
export type CheckCooldownFn = (input: {
  readonly plasmidId: PlasmidId;
  readonly action: ChallengeAction;
  readonly cooldown: string; // `\d+[hdw]`
  readonly log: readonly ChallengeLogEntry[];
  readonly now?: Date;
}) => CooldownDecision;

/** Single-shot override queue (atomic JSON file). */
export interface OverridesPendingStore {
  readonly enqueue: (
    plasmidId: PlasmidId,
    rationale: string,
    workingDirectory?: string,
  ) => Promise<OverridePending>;
  readonly peek: (
    workingDirectory?: string,
  ) => Promise<readonly OverridePending[]>;
  readonly path: (workingDirectory?: string) => string;
}

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
  // ─── Phase 5 — research-assisted authoring (Team 2 owns these) ───────────
  /**
   * `WebSearchFn` adapter. Production wiring goes through the existing
   * `web_search` tool; tests stub a deterministic generator. Optional so
   * Phase-1..4 callers that never use `--research` keep compiling.
   */
  readonly webSearch?: WebSearchFn;
  /** `WebFetchFn` adapter. Mirrors `webSearch` semantics. */
  readonly webFetch?: WebFetchFn;
  /**
   * Resolves the privacy tier of the **active** LLM provider so the research
   * gate can refuse cloud calls when the user is on a local-only provider
   * without `--force-network`. Returns `"unknown"` when the runtime cannot
   * detect the tier (Phase-5 conservative default).
   *
   * Conservative interpretation rule (per dev-guide §3): when the result is
   * `"unknown"` we DO NOT block the cloud call — gating only fires for an
   * explicit `"local"` tier. Rationale: blocking on `"unknown"` would break
   * every existing flow that has not yet wired a tier detector. The privacy
   * gate at the **plasmid** level (`privacy: local-only` on `--from-file`)
   * still fires unconditionally and is the primary safety net.
   */
  readonly getActiveProviderPrivacyTier?: () => "local" | "cloud" | "unknown";
  /**
   * Research orchestrator hook. Production factory wires Team 1's
   * `runResearchMode`; tests stub for deterministic results. Phase-5 only.
   */
  readonly runResearch?: RunResearchFn;
  // ─── Phase 5 — Foundational challenge governance (Team 3 wiring) ──────
  /** Append-only challenge log writer. Optional → `/plasmid challenge` errors when missing. */
  readonly appendChallenge?: AppendChallengeFn;
  /** Read the full challenge log (used for cooldown + auditing). */
  readonly readChallengesLog?: ReadChallengesLogFn;
  /** Cooldown decision (P-1.10 §4). */
  readonly checkCooldown?: CheckCooldownFn;
  /** One-shot override queue accessor. */
  readonly overridesPending?: OverridesPendingStore;
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
    // Phase 5 — research path. Production wires the real adapters; tier
    // detection defaults to `"unknown"` until a richer provider-introspection
    // hook lands (Phase 6 candidate). See `CommandDeps.getActiveProviderPrivacyTier`
    // for the conservative interpretation rule.
    webSearch: webSearchAdapter,
    webFetch: webFetchAdapter,
    getActiveProviderPrivacyTier: () => "unknown",
    // `runResearch` is intentionally left undefined by the production factory
    // because Team 1's `runResearchMode` requires an LLM seam (`deps.llm`)
    // that the /plasmid command tree does not yet carry. Phase 6 will add an
    // LLM provider adapter and flip this. Tests inject a stub directly so
    // the research subcommand is fully testable today.
    runResearch: undefined,
    // Phase 5 — Foundational challenge governance (Team 3 → Team 4 bridge).
    // The production functions live in `src/plasmids/governance/*` with a
    // slightly richer signature than `CommandDeps` declares; the wrappers
    // below adapt arg orders / shapes 1:1.
    appendChallenge: (entry, cwd) =>
      realAppendChallenge(cwd ?? workingDirectory, entry),
    readChallengesLog: (cwd) => realReadChallengesLog(cwd ?? workingDirectory),
    checkCooldown: ({ plasmidId, action, cooldown, log, now }) => {
      // Team-3 takes the full plasmid metadata so its rules can stay pure;
      // we synthesise the minimal shape needed for the cooldown decision.
      const stub = {
        id: plasmidId,
        challengeable: {
          "require-justification": true,
          "min-justification-length": 50,
          "audit-log": true,
          "require-cooldown": cooldown,
          "require-team-consensus": false,
          "min-approvers": 1,
        },
      } as unknown as Parameters<typeof realCheckCooldown>[0];
      return realCheckCooldown(stub, action, log, now ? () => now : undefined);
    },
    overridesPending: (() => {
      const store = new RealOverridesPendingStore({ workingDirectory });
      return {
        enqueue: (plasmidId, rationale) => store.enqueueOverride(plasmidId, rationale),
        peek: () => store.peekPending(),
        // Note: the absolute path is owned by the store itself; we mirror the
        // dev-guide §0 well-known constant here for callers that only want a
        // pretty-printed location.
        path: (cwd) => join(cwd ?? workingDirectory, OVERRIDE_PENDING_PATH),
      };
    })(),
  };
}
