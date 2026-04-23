/**
 * Recombination module — shared public type contract (Phase 2, GAL-1).
 *
 * Single source of truth for types that cross stage boundaries (0–5). Every
 * Phase 2 team implements against this contract so integration is trivial.
 *
 * Layer: Core (Layer 2). May import from:
 *   - `plasmids/types` (Leaf, Layer 4)
 *   - `llm/model-capabilities` (Layer 3)
 * MUST NOT import from `cli/`, `commands/`, `tools/`.
 *
 * Invariants (enforced downstream):
 *   - I-1  Two-file lock — plasmid .md is immutable; caches go in compiled lock.
 *   - I-3  Two-stage idempotency — structural bit-for-bit; post-interp via lock.
 *   - I-4  Wiring validation failure → rollback (stage 5).
 *   - I-5  Transcripts append-only.
 *   - I-7  Every mutation under the advisory lock at `.dhelix/recombination/.lock`.
 *   - I-8  Compile-runtime hermeticity — compiler/generators/compression read
 *          plasmid bodies; runtime surfaces never do.
 *   - I-9  Constitution reorg touches only BEGIN/END marker blocks.
 *   - I-10 L1/L2 validation failure → auto-rollback (phase 3, reserved fields).
 */

import type {
  LoadedPlasmid,
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
  PlasmidTier,
} from "../plasmids/types.js";

// ─── Execution mode + options ────────────────────────────────────────────────

/** `/recombination` mode. Phase 2 lands `extend` + `dry-run`; `rebuild` is phase 4. */
export type RecombinationMode = "extend" | "rebuild" | "dry-run";

/** Stage 5 static validation strategy — phase 3 extends to runtime. */
export type StaticValidationMode = "strict" | "warn-only" | "skip";

/** Surface-level options assembled by the CLI / command handler. */
export interface RecombinationOptions {
  readonly workingDirectory: string;
  readonly registryPath: string;
  readonly mode: RecombinationMode;
  /** If set, restrict compilation to a single plasmid id (`--plasmid <id>`). */
  readonly plasmidId?: PlasmidId;
  /** Default: model discovered via llm config. Override with `--model`. */
  readonly modelOverride?: string;
  /** Stage 3 preview behaviour — when `auto`, skip the y/d/e/n prompt. */
  readonly approvalMode?: "interactive" | "auto" | "auto-on-clean";
  /** Static validation — strict by default; `warn-only` skips Stage-5 rollback. */
  readonly staticValidation?: StaticValidationMode;
  /** Propagated through every I/O call; aborts are observed at stage boundaries. */
  readonly signal?: AbortSignal;
}

// ─── Strategy selector (P-1.19) ──────────────────────────────────────────────

export type InterpreterStrategy = "single-pass" | "chunked" | "field-by-field";
export type CompressionStrategy = "abstractive" | "extractive";
export type ReorgFallback =
  | "llm-only"
  | "llm-with-xml-fallback"
  | "llm-with-deterministic-fallback"
  | "deterministic-only";
export type ValidationVolumeProfile = "standard" | "governed" | "minimal";
export type GradingTier = "deterministic" | "semi" | "llm";
export type ProjectProfileMode = "full-llm" | "llm-summary" | "static-template";
export type ArtifactGenerationStrategy = "template-and-llm" | "template-only";

/** Output of `selectStrategies(caps)` — deterministic given the same caps. */
export interface PipelineStrategies {
  readonly interpreter: InterpreterStrategy;
  readonly compression: CompressionStrategy;
  readonly reorgFallback: ReorgFallback;
  readonly validationVolume: ValidationVolumeProfile;
  readonly validationParallelism: number;
  readonly gradingTiers: readonly GradingTier[];
  readonly passThresholds: {
    readonly L1: number;
    readonly L2: number;
    readonly L3: number;
    readonly L4: number;
  };
  readonly projectProfile: ProjectProfileMode;
  readonly artifactGeneration: ArtifactGenerationStrategy;
  readonly interpreterRetries: number;
}

// ─── Interpreter output (Stage 2a) ───────────────────────────────────────────

/** Kind of artifact the generator should emit from an intent node. */
export type IntentKind = "agent" | "skill" | "command" | "hook" | "rule" | "harness";

/** Intent node extracted from a plasmid body — feeds generators + reorganizer. */
export interface PlasmidIntentNode {
  readonly id: string;
  readonly sourcePlasmid: PlasmidId;
  readonly kind: IntentKind;
  /** Short imperative phrase (≤80 chars) — used as section heading / file name. */
  readonly title: string;
  /** One-paragraph description — consumed by generator slot-fill + reorg. */
  readonly description: string;
  /** Structural constraints (pre-run assertions) — expectation DSL optional. */
  readonly constraints: readonly string[];
  /** Evidence / rationale strings — may be empty. */
  readonly evidence: readonly string[];
  /** Free-form metadata used by generator templates (e.g. trigger, tool list). */
  readonly params: Readonly<Record<string, unknown>>;
}

/** Interpreter IR — one per loaded plasmid after Stage 2a. */
export interface CompiledPlasmidIR {
  readonly plasmidId: PlasmidId;
  readonly plasmidVersion: string;
  readonly metadata: PlasmidMetadata;
  readonly bodyFingerprint: PlasmidFingerprint;
  readonly summary: string;
  readonly intents: readonly PlasmidIntentNode[];
  readonly tier: PlasmidTier;
  readonly interpretedAt: string; // ISO-8601
  /** Strategy used — cache key includes this so strategy change invalidates. */
  readonly strategyUsed: InterpreterStrategy;
  /** Hash over (bodyFingerprint + interpreter version + model id + strategy). */
  readonly cacheKey: string;
}

// ─── Compression output (Stage 2c) ───────────────────────────────────────────

/** Identifier of a prompt-section bucket — P-1.13 Layer C. */
export type PromptSectionBucket =
  | "principles"
  | "domain-knowledge"
  | "constraints"
  | "capabilities"
  | "project-profile";

/** A single compressed plasmid summary (Layer B output). */
export interface CompressedPlasmidSummary {
  readonly plasmidId: PlasmidId;
  readonly bucket: PromptSectionBucket;
  readonly tier: PlasmidTier;
  /** Pre-rendered markdown (Layer A frontmatter + Layer B body). */
  readonly markdown: string;
  readonly tokenEstimate: number;
  readonly preservedConstraints: readonly string[];
  readonly cacheKey: string;
}

/** Per-bucket assembled section file — Layer C output. */
export interface AssembledSection {
  readonly bucket: PromptSectionBucket;
  readonly relativePath: string; // e.g. `prompt-sections/generated/60-principles.md`
  readonly markdown: string;
  readonly tokenEstimate: number;
  readonly memberPlasmidIds: readonly PlasmidId[];
}

/** Complete compression output for Stage 2c → Stage 4 persistence. */
export interface CompressionOutput {
  readonly summaries: readonly CompressedPlasmidSummary[];
  readonly sections: readonly AssembledSection[];
  readonly projectProfileMarkdown: string;
  readonly totalTokenEstimate: number;
  readonly budgetTokens: number;
  readonly droppedPlasmidIds: readonly PlasmidId[];
}

// ─── Generator output (Stage 2b) ─────────────────────────────────────────────

/** Artifact origin layer (P-1.4 template hierarchy). */
export type TemplateLayer = "primitives" | "patterns" | "project";

/** Unified generated artifact envelope — written to disk at Stage 4. */
export interface GeneratedArtifact {
  readonly kind: IntentKind;
  readonly sourcePlasmid: PlasmidId;
  readonly sourceIntentId: string;
  /** Absolute target path — inside `.dhelix/{agents,skills,commands,hooks,rules}/`. */
  readonly targetPath: string;
  /** Actual file content to be written (post-template-fill). */
  readonly contents: string;
  /** SHA-256 over contents — used for idempotency + transcript record. */
  readonly contentHash: string;
  /** Which template layer supplied the base template. */
  readonly templateLayer: TemplateLayer;
  /** Template id (e.g. `primitives/rule.basic`). */
  readonly templateId: string;
  /** Execution permissions, for Stage 5 permission alignment check. */
  readonly requiredTools?: readonly string[];
  /** Optional trust level claimed by the artifact (for alignment check). */
  readonly trustLevel?: "T0" | "T1" | "T2" | "T3";
}

// ─── Constitution reorganizer (Stage 2d) ─────────────────────────────────────

export type ReorgOpKind = "insert" | "update" | "remove" | "keep";

/** A single operation applied to the DHELIX.md section tree. */
export interface ReorgOp {
  readonly kind: ReorgOpKind;
  /** Stable marker id — same across runs. Format: `plasmid-derived:<plasmid-id>:<slug>`. */
  readonly markerId: string;
  /** Heading text rendered above the marker block. */
  readonly heading: string;
  /** Body markdown placed inside the marker block (empty for `remove`). */
  readonly body: string;
  /**
   * Optional anchor — `location.after` hint from P-1.15. Inserts go *after*
   * this marker / heading. Ignored for `update` / `remove` / `keep`.
   */
  readonly locationAfter?: string;
  readonly sourcePlasmid?: PlasmidId;
}

/** Result of Stage 2d — consumed by Stage 4 persistence. */
export interface ReorgPlan {
  readonly ops: readonly ReorgOp[];
  /** Marker ids the reorganizer wants to leave untouched (for invariance audit). */
  readonly keptMarkerIds: readonly string[];
  /** Hash of pre-reorg DHELIX.md (used in I-9 invariance check). */
  readonly preReorgContentHash: string;
  /** Hash of the plasmid intent graph — part of the cache key. */
  readonly intentGraphHash: string;
  /** Which fallback tier produced this plan. */
  readonly fallbackTier: ReorgFallback;
}

// ─── Stage 5 static wiring validation (P-1.3) ────────────────────────────────

export type WiringSeverity = "ERROR" | "WARN" | "INFO";

export type WiringCheckId =
  | "WIRING_REFERENCE_MISSING_TOOL"
  | "WIRING_REFERENCE_MISSING_SKILL"
  | "WIRING_REFERENCE_MISSING_AGENT"
  | "WIRING_PERMISSION_MISMATCH"
  | "WIRING_TRUST_DOWNGRADE_REQUIRED"
  | "WIRING_CYCLIC_DEPENDENCY"
  | "WIRING_TRIGGER_CONFLICT"
  | "WIRING_SYNTAX_INVALID"
  | "WIRING_MARKER_UNTERMINATED"
  | "WIRING_MARKER_DUPLICATE"
  | "WIRING_FRONTMATTER_SCHEMA"
  | "WIRING_PATH_OUT_OF_SCOPE"
  | "WIRING_TEMPLATE_DRIFT"
  | "WIRING_DEFAULT_TRUST_APPLIED";

export interface WiringFinding {
  readonly checkId: WiringCheckId;
  readonly severity: WiringSeverity;
  readonly artifactPath?: string;
  readonly sourcePlasmid?: PlasmidId;
  readonly message: string;
  readonly remediation?: string;
}

export interface WiringReport {
  readonly findings: readonly WiringFinding[];
  readonly errorCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly passed: boolean;
}

// ─── Transcript (append-only per I-5) ────────────────────────────────────────

export type RecombinationStageId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface StageRecord {
  readonly stage: RecombinationStageId;
  readonly name: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly status: "ok" | "skipped" | "warn" | "error";
  readonly message?: string;
  readonly durationMs?: number;
}

export interface WrittenFile {
  readonly path: string;
  readonly contentHash: string;
  readonly bytes: number;
  readonly op: "create" | "update" | "delete";
}

export interface RecombinationTranscript {
  readonly id: string; // ISO-8601 collision-safe slug
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly mode: RecombinationMode;
  readonly model: string;
  readonly strategies: PipelineStrategies;
  readonly activePlasmidIds: readonly PlasmidId[];
  readonly stages: readonly StageRecord[];
  readonly writtenFiles: readonly WrittenFile[];
  readonly reorgMarkerIds: readonly string[];
  readonly wiring: WiringReport;
  readonly errorCode?: RecombinationErrorCode;
  readonly errorMessage?: string;
  readonly cacheHits: number;
  readonly cacheMisses: number;
}

// ─── Error catalog (PRD §10.3) ───────────────────────────────────────────────

export type RecombinationErrorCode =
  | "RECOMBINATION_LOCK_BUSY"
  | "RECOMBINATION_ABORTED"
  | "RECOMBINATION_PLAN_ERROR"
  | "INTERPRETER_JSON_FAILURE"
  | "GENERATOR_ERROR"
  | "REORG_FALLBACK_USED"
  | "REORG_USER_AREA_VIOLATION"
  | "REORG_INVALID_UPDATE_TARGET"
  | "PRIVACY_CLOUD_BLOCKED"
  | "WIRING_VALIDATION_ERROR"
  | "LOCAL_LLM_UNAVAILABLE"
  | "MODEL_DRIFT_DETECTED";

/** Well-known path under the project root for compile-time artefacts. */
export const RECOMBINATION_DIR = ".dhelix/recombination";
export const RECOMBINATION_LOCK_FILE = ".dhelix/recombination/.lock";
export const RECOMBINATION_TRANSCRIPTS_DIR = ".dhelix/recombination/transcripts";
export const RECOMBINATION_OBJECTS_DIR = ".dhelix/recombination/objects";
export const RECOMBINATION_AUDIT_LOG = ".dhelix/recombination/audit.log";
export const PROMPT_SECTIONS_GENERATED_DIR = ".dhelix/prompt-sections/generated";
export const CONSTITUTION_FILE = "DHELIX.md";

/** Default token budget (P-1.13). Adaptive: min 300, max 1500. */
export const COMPRESSION_DEFAULT_BUDGET_TOKENS = 1500;
export const COMPRESSION_PER_PLASMID_TOKENS = 150;
export const COMPRESSION_MIN_BUDGET_TOKENS = 300;

/** Re-export types the adjacent modules import as public surface. */
export type { LoadedPlasmid };
