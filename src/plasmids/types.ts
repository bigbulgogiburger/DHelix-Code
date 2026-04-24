/**
 * Plasmid module — shared public type contract.
 *
 * Single source of truth for types that cross team/module boundaries.
 * Derivations from Zod schemas live in `./schema.ts` and MUST remain
 * structurally compatible with the public interfaces defined here.
 *
 * Layer: Leaf (no cross-layer imports; only zod/node types).
 *
 * Invariants (enforced downstream):
 * - I-1  Two-file lock model (metadata.yaml + body.md co-located per id)
 * - I-8  Compile-runtime hermeticity: plasmid bodies must never flow into
 *        runtime context. Types below encode this by separating loader
 *        outputs (LoadedPlasmidMetadata) from compiled outputs.
 * - I-9  User-scope invariance (activation never mutates user body)
 */

/** L1–L4 tier per PRD §4 / §21.2. */
export type PlasmidTier = "L1" | "L2" | "L3" | "L4";

/** Visibility scope per P-1.6 (v0.2). `team` is reserved; emits warn today. */
export type PlasmidScope = "local" | "shared" | "ephemeral" | "team";

/** Privacy contract per PRD §10.1 I-7 + P-1.21 (v0.2). */
export type PlasmidPrivacy = "local-only" | "cloud-ok" | "no-network";

/** Expectation DSL prefix per P-1.23 (v0.2). */
export type ExpectationPrefix =
  | "pattern"
  | "semver"
  | "ast-match"
  | "contains"
  | "not-contains"
  | "equals"
  | "gte"
  | "lte";

/**
 * Branded plasmid identifier. Validated by schema: `[a-z][a-z0-9-]*`,
 * length 3..64, no consecutive hyphens.
 */
export type PlasmidId = string & { readonly __brand: "PlasmidId" };

/** SHA-256 hex digest of body.md — used for fingerprint + drift detection. */
export type PlasmidFingerprint = string & { readonly __brand: "PlasmidFingerprint" };

/**
 * Plasmid metadata — parsed frontmatter contract.
 *
 * All fields `readonly`; state mutations produce new objects (spread copy).
 */
export interface PlasmidMetadata {
  readonly id: PlasmidId;
  readonly name: string;
  readonly description: string;
  readonly version: string; // semver
  readonly tier: PlasmidTier;
  readonly scope: PlasmidScope;
  readonly privacy: PlasmidPrivacy;
  readonly author?: string;
  readonly created: string; // ISO-8601
  readonly updated: string; // ISO-8601
  readonly tags?: readonly string[];
  readonly requires?: readonly PlasmidId[];
  readonly conflicts?: readonly PlasmidId[];
  readonly extends?: PlasmidId;
  readonly foundational?: boolean; // L4 flag
  readonly template?: string; // template id the plasmid derives from
  /** Provenance from `/plasmid --research` (PRD §9.4). Phase 5 addition. */
  readonly source?: ResearchSource;
  /**
   * Foundational governance contract (P-1.10 §2). Loader fills defaults when
   * `foundational: true` but the block is omitted; absent on non-foundational
   * plasmids.
   */
  readonly challengeable?: ChallengeableBy;
}

/** A single evaluation case — used by /plasmid validate + L2/L4 validation. */
export interface PlasmidEvalCase {
  readonly id: string;
  readonly description: string;
  readonly input: string;
  readonly expectations: readonly PlasmidEvalExpectation[];
  readonly tier?: PlasmidTier; // required in schema; optional here for forward-compat
}

/** Parsed expectation — `prefix:value`. */
export interface PlasmidEvalExpectation {
  readonly prefix: ExpectationPrefix;
  readonly value: string;
  readonly negated?: boolean;
}

/**
 * Loaded plasmid (raw) — body is present for /plasmid show/validate only.
 *
 * **I-8 enforcement**: this shape must never be packed into runtime system
 * prompt. The compile stage consumes it and produces `CompiledPlasmid`
 * (defined in Phase 2). Layers above Leaf that touch `body` MUST route
 * through the runtime-guard (Team 2 module).
 */
export interface LoadedPlasmid {
  readonly metadata: PlasmidMetadata;
  readonly body: string; // raw markdown after frontmatter
  readonly bodyFingerprint: PlasmidFingerprint;
  readonly evalCases: readonly PlasmidEvalCase[];
  readonly sourcePath: string; // absolute path to body.md
  readonly metadataPath: string; // absolute path to metadata.yaml (I-1)
  readonly scopeOrigin: PlasmidScope; // the scope that provided this file
}

/** Loader result surface — separates successes from failures. */
export interface LoadResult {
  readonly loaded: readonly LoadedPlasmid[];
  readonly failed: readonly LoadFailure[];
}

export interface LoadFailure {
  readonly path: string;
  readonly reason: string;
  readonly code: PlasmidErrorCode;
}

/** Error codes per PRD §10.3 (partial — more added as phases land). */
export type PlasmidErrorCode =
  | "PLASMID_SCHEMA_INVALID"
  | "PLASMID_FRONTMATTER_MISSING"
  | "PLASMID_BODY_UNREADABLE"
  | "PLASMID_DUPLICATE_ID"
  | "PLASMID_ORPHAN_METADATA"
  | "PLASMID_ORPHAN_BODY"
  | "PLASMID_RUNTIME_ACCESS_BLOCKED"
  | "PLASMID_PRIVACY_CLOUD_BLOCKED"
  | "PLASMID_PRIVACY_VIOLATION"
  | "PLASMID_REORG_INVALID_UPDATE_TARGET"
  | "PLASMID_NOT_FOUND"
  | "PLASMID_ACTIVATION_CONFLICT"
  | "PLASMID_FOUNDATIONAL_CHALLENGE_REQUIRED"
  // Phase 5 — research-assisted authoring (PRD §9)
  | "PLASMID_RESEARCH_PRIVACY_BLOCKED"
  | "PLASMID_RESEARCH_NETWORK_ERROR"
  // Phase 5 — foundational challenge ceremony (PRD §22.4 + P-1.10)
  | "PLASMID_CHALLENGE_COOLDOWN"
  | "PLASMID_CHALLENGE_JUSTIFICATION_TOO_SHORT"
  | "PLASMID_CHALLENGE_NOT_FOUNDATIONAL"
  | "PLASMID_OVERRIDE_CONSUMED";

/** Activation state — managed by Team 3 activation store. */
export interface ActivationState {
  readonly activePlasmidIds: readonly PlasmidId[];
  readonly updatedAt: string;
  readonly profile?: string; // named activation profile (Phase 2+)
}

// ─── Phase 5 — Research-Assisted Authoring (PRD §9 / §9.4) ─────────────────

/**
 * One source the research mode consulted while drafting a plasmid. The set is
 * persisted on the resulting plasmid metadata as `source.references` so future
 * readers can audit the provenance (PRD §9.4).
 *
 * `contentSha256` is omitted when the WebFetch attempt failed — the reference
 * still surfaces so the user knows the source was *considered*, even if its
 * full body never reached the synthesiser.
 */
export interface ResearchSourceRef {
  readonly url: string;            // canonical: https://, lower-cased host, no tracking params
  readonly title: string;
  readonly snippet?: string;
  readonly fetchedAt: string;      // ISO-8601
  readonly contentSha256?: string; // sha256 hex of the fetched-and-stripped body
}

/** Provenance bundle attached to `PlasmidMetadata.source` after research mode. */
export interface ResearchSource {
  readonly engine: "web";          // forward-compat: "rag" | "kb"
  readonly query: string;
  readonly references: readonly ResearchSourceRef[];
  readonly researchedAt: string;   // ISO-8601
}

// ─── Phase 5 — Foundational challenge governance (PRD §22.4 + P-1.10) ──────

/**
 * Parsed `challengeable` block from plasmid frontmatter. Only meaningful when
 * `metadata.foundational === true`. The loader fills sensible defaults when a
 * foundational plasmid omits the block.
 *
 * Field names use kebab-case verbatim (matching frontmatter YAML) so callers
 * can `JSON.stringify()` round-trip back to source without aliasing.
 */
export interface ChallengeableBy {
  readonly "require-justification": boolean;
  readonly "min-justification-length": number;
  readonly "audit-log": boolean;
  readonly "require-cooldown": string; // `\d+[hdw]`
  readonly "require-team-consensus": boolean;
  readonly "min-approvers": number;
  readonly "approver-roles"?: readonly string[];
}

/** Challenge action surface (P-1.10 §3). */
export type ChallengeAction = "override" | "amend" | "revoke";

/** Cooldown decision returned by `governance/cooldown.ts#checkCooldown`. */
export type CooldownDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly waitUntil: Date; readonly remainingMs: number };

/**
 * One entry in `.dhelix/governance/challenges.log` (JSONL, append-only).
 *
 * `previousHash` / `newHash` are populated for `amend` actions (the user's
 * editor produced a new body); `dependentsAction` is recorded only for
 * `revoke`. `teamApprovals` is forward-compat (v0.5+ team UI).
 */
export interface ChallengeLogEntry {
  readonly timestamp: string;
  readonly plasmidId: string;
  readonly action: ChallengeAction;
  readonly rationale: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly previousHash?: string;
  readonly newHash?: string;
  readonly dependentsAction?: "kept" | "orphaned" | "revoked";
  readonly teamApprovals?: readonly { readonly userId: string; readonly approvedAt: string }[];
}

/**
 * One queued single-shot override waiting to be consumed by the next
 * `/recombination` run. Stored under `.dhelix/governance/overrides.pending.json`
 * as `{ pending: OverridePending[] }`. Atomic write (tmp + rename) — this
 * file is a small mutable cache, NOT a log.
 */
export interface OverridePending {
  readonly plasmidId: PlasmidId;
  readonly queuedAt: string;
  readonly rationaleSha256: string;
}

/** Public well-known paths for Phase 5 governance state. */
export const CHALLENGE_LOG_PATH = ".dhelix/governance/challenges.log";
export const OVERRIDE_PENDING_PATH = ".dhelix/governance/overrides.pending.json";
export const PLASMIDS_ARCHIVE_DIR = ".dhelix/plasmids/archive";

/** Hard ceiling on web sources surfaced + persisted by research mode (P-1.5). */
export const RESEARCH_MAX_SOURCES = 5;

/** Per-page fetch budget (chars after sanitisation) used by research synthesis. */
export const RESEARCH_PER_PAGE_BUDGET_TOKENS = 4000;

/**
 * Canonical scope-search order for the loader.
 *
 * When two scopes provide the same plasmid id, the earlier entry wins.
 * Rationale: ephemeral (session) overrides local (project) overrides
 * shared (team) overrides team (org) for dev ergonomics. Privacy checks
 * still apply regardless of scope.
 */
export const SCOPE_PRECEDENCE: readonly PlasmidScope[] = [
  "ephemeral",
  "local",
  "shared",
  "team",
];
