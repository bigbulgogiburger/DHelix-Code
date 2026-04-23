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
  | "PLASMID_FOUNDATIONAL_CHALLENGE_REQUIRED";

/** Activation state — managed by Team 3 activation store. */
export interface ActivationState {
  readonly activePlasmidIds: readonly PlasmidId[];
  readonly updatedAt: string;
  readonly profile?: string; // named activation profile (Phase 2+)
}

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
