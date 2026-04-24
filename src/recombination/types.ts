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
  /**
   * Phase 3 — Stage 6 runtime validation profile (`--validate=<profile>`).
   * `undefined` disables Stage 6 (Phase 2 behavior). `"none"` is explicit skip.
   */
  readonly validateProfile?: ValidateProfile;
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
  /**
   * Phase 3 — Stage 6 runtime validation report. Absent when validation was
   * skipped (`validateProfile` undefined or `"none"`). Phase 2 transcripts
   * parse cleanly because the field is optional.
   */
  readonly validation?: ValidationReport;
  /** Phase 3 — recorded when a user keeps a failed run after grace period. */
  readonly validationOverride?: OverrideRecord;
  /**
   * Phase 3 — pre-Stage-4 snapshot of DHELIX.md. Lets /cure verify I-9
   * exactly (not just via I-9-safe reverse reorg). Absent in Phase 2
   * transcripts; `/cure` must handle both paths.
   */
  readonly preReorgSnapshot?: PreReorgSnapshot;
  /**
   * Phase 3 — reorg ops actually applied at Stage 2d, in order. Allows
   * /cure to construct a precise reverse plan instead of heuristic removal.
   */
  readonly reorgOps?: readonly ReorgOp[];
  /**
   * Phase 4 — set on transcripts produced by `/recombination --mode rebuild`.
   * Points at the transcript whose artifacts were internally cured before
   * this rebuild ran. Absent on Phase 2/3 transcripts.
   */
  readonly rebuildLineage?: RebuildLineage;
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
  | "MODEL_DRIFT_DETECTED"
  // Phase 3 — Stage 6/7
  | "VALIDATION_FAILED_L1"
  | "VALIDATION_FAILED_L2"
  | "VALIDATION_FAILED_FOUNDATIONAL_L4"
  | "VALIDATION_TIMEOUT"
  | "VALIDATION_CONSTRAINT_CASES_DROPPED"
  | "VALIDATION_REGRESSION_DETECTED"
  // Phase 3 — /cure
  | "CURE_CONFLICT"
  | "TRANSCRIPT_CORRUPT"
  | "CURE_PARTIAL_FAILURE"
  | "CURE_ABORTED"
  | "CURE_NO_TRANSCRIPT";

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

// ─── Shared LLM adapter (dependency-injected by teams) ───────────────────────

/** Minimal completion shape every team shares. Kept provider-agnostic. */
export interface LLMCompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly jsonMode?: boolean;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}

/** Unified completion callable. Implementations wrap `OpenAICompatibleClient`. */
export type LLMCompletionFn = (req: LLMCompletionRequest) => Promise<string>;

// ─── Top-level team entry points (public API surface) ───────────────────────

/** Team 1 — interpret a single plasmid. */
export interface InterpretRequest {
  readonly plasmid: LoadedPlasmid;
  readonly strategy: InterpreterStrategy;
  readonly retries: number;
  readonly modelId: string;
  readonly workingDirectory: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}
export interface InterpretResult {
  readonly ir: CompiledPlasmidIR;
  readonly cacheHit: boolean;
  readonly warnings: readonly string[];
}
export type InterpretFn = (req: InterpretRequest) => Promise<InterpretResult>;

/** Team 2 — render artifacts from interpreter IRs. */
export interface GenerateRequest {
  readonly irs: readonly CompiledPlasmidIR[];
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}
export interface GenerateResult {
  readonly artifacts: readonly GeneratedArtifact[];
  readonly warnings: readonly string[];
}
export type GenerateFn = (req: GenerateRequest) => Promise<GenerateResult>;

/** Team 3 — compress plasmids into prompt sections. */
export interface CompressRequest {
  readonly irs: readonly CompiledPlasmidIR[];
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}
export type CompressFn = (req: CompressRequest) => Promise<CompressionOutput>;

/** Team 4 — reorganize DHELIX.md based on interpreter graph. */
export interface ReorganizeRequest {
  readonly irs: readonly CompiledPlasmidIR[];
  readonly existingConstitution: string;
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}
export type ReorganizeFn = (req: ReorganizeRequest) => Promise<ReorgPlan>;

/** Team 5 — orchestrate stages 0–5 with injected dependencies. */
export interface ExecutorDeps {
  readonly interpret: InterpretFn;
  readonly generate: GenerateFn;
  readonly compress: CompressFn;
  readonly reorganize: ReorganizeFn;
  readonly llm: LLMCompletionFn;
  /**
   * Phase 3 — Stage 6 runtime validation facade. Optional: when omitted, the
   * executor records Stage 6 as `"skipped"` and skips rollback based on
   * runtime results (Phase 2 behavior preserved).
   */
  readonly validate?: ValidateFn;
}

export interface RecombinationResult {
  readonly transcript: RecombinationTranscript;
  readonly plan: {
    readonly artifacts: readonly GeneratedArtifact[];
    readonly compression: CompressionOutput;
    readonly reorg: ReorgPlan;
  };
  readonly applied: boolean; // false in dry-run / abort paths
}

export type ExecuteRecombinationFn = (
  opts: RecombinationOptions,
  deps: ExecutorDeps,
) => Promise<RecombinationResult>;

/** Re-export types the adjacent modules import as public surface. */
export type { LoadedPlasmid };

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3 — RUNTIME VALIDATION (Stage 6) + /cure + I-10 AUTO-ROLLBACK
// ═══════════════════════════════════════════════════════════════════════════
//
// Invariants added in this phase:
//   - I-10 L1/L2 validation failure → auto-rollback with 10s grace period.
//          Foundational plasmids rollback on L4 ≥5% failure too.
//   - I-5  Validation history + override ledger are append-only (jsonl).
//   - I-8  Validation executor must run inside a copy-on-write workspace —
//          it reads compiled artifacts but must not mutate the real project.
//
// Ownership (Phase 3 5-team split):
//   Team 1 — eval-seeds schema, expectation DSL, case-generator, volume-governor
//   Team 2 — runtime-executor, grader-cascade, artifact-env (CoW workspace)
//   Team 3 — rollback-decision, reporter (grace UX), override-tracker,
//            regression-tracker
//   Team 4 — /cure command + cure/{planner,restorer,edit-detector,refs}
//   Team 5 — executor Stage 6/7 wiring, transcript extensions, --validate=
//            flag routing, validate facade (index.ts), integration tests
//
// Every Phase 3 team implements strictly against the contracts below. The
// executor degrades gracefully when `ExecutorDeps.validate` is omitted
// (records Stage 6 as "skipped") to preserve Phase 2 call sites.

// ─── Validation level + case origin ──────────────────────────────────────────

/** Runtime validation tier (PRD §8.2 / P-1.16). */
export type ValidationLevel = "L1" | "L2" | "L3" | "L4";

/** Where a case came from — tracked for audit + telemetry. */
export type CaseOrigin = "eval-seed" | "deterministic" | "llm-auto";

/** `/recombination --validate=<profile>` flag values. */
export type ValidateProfile = "smoke" | "local" | "exhaustive" | "ci" | "none";

// ─── Expectation DSL (P-1.23 §4) ─────────────────────────────────────────────
//
// Seven prefixes; free-text falls through to the LLM judge. Parsed once per
// case at grade time by the grader-cascade. `original` is retained verbatim
// for reporting.

export type Expectation =
  | { readonly kind: "output-contains"; readonly text: string; readonly original: string }
  | { readonly kind: "output-excludes"; readonly text: string; readonly original: string }
  | { readonly kind: "file-exists"; readonly path: string; readonly original: string }
  | { readonly kind: "file-modified"; readonly path: string; readonly original: string }
  | { readonly kind: "exit-code"; readonly code: number; readonly original: string }
  | { readonly kind: "tool-called"; readonly tool: string; readonly original: string }
  | { readonly kind: "hook-fired"; readonly event: string; readonly original: string }
  | { readonly kind: "free-text"; readonly text: string; readonly original: string };

/** Which grader tier handled a given expectation (for report + skip tracking). */
export type GraderHandler = "deterministic" | "semi" | "llm" | "skipped";

// ─── Runtime case + volume plan ──────────────────────────────────────────────

/** A generated L1-L4 case ready for execution in the CoW workspace. */
export interface RuntimeCase {
  readonly id: string;
  readonly plasmidId: PlasmidId;
  readonly tier: ValidationLevel;
  readonly origin: CaseOrigin;
  readonly prompt: string;
  /** Raw DSL expectation strings — parsed at grade time. */
  readonly expectations: readonly string[];
  /** Optional setup files for the isolated workspace. */
  readonly setupFiles?: readonly {
    readonly path: string;
    readonly content: string;
  }[];
  readonly tags?: readonly string[];
}

/** Per-plasmid quota at each level — sized by volume governor. */
export interface PlasmidQuota {
  readonly L1: number;
  readonly L2: number;
  readonly L3: number;
  readonly L4: number;
}

/** Output of volume governor — total budget + per-plasmid allocations. */
export interface VolumePlan {
  readonly profile: ValidationVolumeProfile;
  readonly totalBudget: number;
  readonly perPlasmid: ReadonlyMap<PlasmidId, PlasmidQuota>;
  /** Wall-clock budget for the full Stage 6 (ms). */
  readonly timeBudgetMs: number;
  /** Max parallelism (1 for local, 10 for cloud). */
  readonly parallelism: number;
}

export interface DroppedCase {
  readonly plasmidId: PlasmidId;
  readonly tier: ValidationLevel;
  readonly reason: string;
}

export interface RuntimeCaseSet {
  readonly cases: readonly RuntimeCase[];
  readonly droppedCount: number;
  readonly droppedReasons: readonly DroppedCase[];
}

// ─── Team 1 entry: case-generator + volume-governor ──────────────────────────

export interface VolumeGovernorRequest {
  readonly irs: readonly CompiledPlasmidIR[];
  readonly strategies: PipelineStrategies;
}
export type VolumeGovernorFn = (req: VolumeGovernorRequest) => VolumePlan;

export interface GenerateCasesRequest {
  readonly irs: readonly CompiledPlasmidIR[];
  readonly strategies: PipelineStrategies;
  readonly plan: VolumePlan;
  readonly workingDirectory: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}
export type GenerateCasesFn = (req: GenerateCasesRequest) => Promise<RuntimeCaseSet>;

// ─── Team 2 entry: runtime-executor + grader-cascade ─────────────────────────

/** Captured output of a single case run — fed to the grader cascade. */
export interface RuntimeRunResult {
  readonly caseId: string;
  readonly plasmidId: PlasmidId;
  readonly tier: ValidationLevel;
  readonly output: string;
  /** Tool names observed in the case transcript — used for semi grading. */
  readonly toolCalls: readonly string[];
  readonly hookFires: readonly string[];
  /** File system effects observed inside the isolated workspace. */
  readonly filesTouched: readonly {
    readonly path: string;
    readonly op: "create" | "update" | "delete";
  }[];
  readonly exitCode?: number;
  readonly durationMs: number;
  readonly status: "ok" | "timeout" | "error" | "skipped";
  readonly errorMessage?: string;
}

export interface RunCasesRequest {
  readonly cases: readonly RuntimeCase[];
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  /** Pre-allocated copy-on-write workspace root (see artifact-env). */
  readonly workspaceRoot: string;
  readonly llm: LLMCompletionFn;
  readonly timeBudgetMs: number;
  readonly parallelism: number;
  readonly signal?: AbortSignal;
}
export type RunCasesFn = (req: RunCasesRequest) => Promise<readonly RuntimeRunResult[]>;

export interface ExpectationResult {
  readonly original: string;
  readonly parsed: Expectation;
  readonly handler: GraderHandler;
  readonly passed: boolean;
  readonly evidence?: string;
  readonly llmConfidence?: number;
}

export interface CaseGrading {
  readonly caseId: string;
  readonly plasmidId: PlasmidId;
  readonly tier: ValidationLevel;
  readonly passed: boolean;
  readonly expectationResults: readonly ExpectationResult[];
}

export interface GradeCasesRequest {
  readonly cases: readonly RuntimeCase[];
  readonly runs: readonly RuntimeRunResult[];
  readonly strategies: PipelineStrategies;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}
export type GradeCasesFn = (req: GradeCasesRequest) => Promise<readonly CaseGrading[]>;

// ─── Copy-on-write workspace (Team 2) ────────────────────────────────────────

export interface ArtifactEnv {
  readonly workspaceRoot: string;
  /** Call once validation is done to free disk. */
  readonly cleanup: () => Promise<void>;
  /** Symlink-first on posix; copy-fallback on windows / cross-device. */
  readonly mode: "symlink" | "copy";
}

export interface BuildArtifactEnvRequest {
  readonly workingDirectory: string;
  readonly transcriptId: string;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly writtenFiles: readonly WrittenFile[];
  readonly signal?: AbortSignal;
}
export type BuildArtifactEnvFn = (
  req: BuildArtifactEnvRequest,
) => Promise<ArtifactEnv>;

// ─── Validation report ───────────────────────────────────────────────────────

export interface TierStats {
  readonly tier: ValidationLevel;
  readonly total: number;
  readonly passed: number;
  readonly rate: number; // 0..1
  readonly threshold: number; // 0..1 — PipelineStrategies.passThresholds[tier] normalized
  readonly meetsThreshold: boolean;
  readonly skipped: number;
}

export interface PlasmidValidationSummary {
  readonly plasmidId: PlasmidId;
  readonly tier: PlasmidTier;
  readonly perLevel: ReadonlyMap<ValidationLevel, TierStats>;
  readonly overallPassed: boolean;
}

export interface ValidationReport {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly profile: ValidateProfile;
  readonly plan: VolumePlan;
  readonly totalCases: number;
  readonly perTier: readonly TierStats[];
  readonly perPlasmid: readonly PlasmidValidationSummary[];
  readonly caseGradings: readonly CaseGrading[];
  readonly earlyExit: boolean;
  readonly timeBudgetExceeded: boolean;
  readonly overallPassed: boolean;
  readonly dropped: readonly DroppedCase[];
}

// ─── Team 3 entry: rollback decision + override + regression ─────────────────

export type RollbackAction =
  | "continue"
  | "rollback"
  | "warn"
  | "require-override";

export interface RollbackDecision {
  readonly action: RollbackAction;
  readonly reason: string;
  readonly failingTier?: ValidationLevel;
  readonly failingPlasmidId?: PlasmidId;
  readonly foundationalL4Triggered?: boolean;
}

export interface DecideRollbackRequest {
  readonly report: ValidationReport;
  readonly plasmids: readonly CompiledPlasmidIR[];
  readonly strategies: PipelineStrategies;
}
export type DecideRollbackFn = (req: DecideRollbackRequest) => RollbackDecision;

export interface OverrideRecord {
  readonly timestamp: string;
  readonly transcriptId: string;
  readonly plasmidId: PlasmidId;
  readonly tier: ValidationLevel;
  readonly reason: string;
  readonly passRate: number;
  readonly threshold: number;
  readonly actor: string;
}

export interface RegressionFinding {
  readonly plasmidId: PlasmidId;
  readonly tier: ValidationLevel;
  readonly previousRate: number;
  readonly currentRate: number;
  readonly delta: number;
  readonly previousTranscriptId: string;
}

export interface HistoryEntry {
  readonly timestamp: string;
  readonly transcriptId: string;
  readonly perTier: readonly {
    readonly tier: ValidationLevel;
    readonly rate: number;
  }[];
  readonly perPlasmid: readonly {
    readonly plasmidId: PlasmidId;
    readonly L1: number;
    readonly L2: number;
    readonly L3: number;
    readonly L4: number;
  }[];
}

// ─── Grace-period IO (Team 3 reporter, consumed by executor + command) ──────

export type GraceInput = "rollback" | "keep" | "rerun" | "inspect" | "edit";

export interface GracePromptIO {
  prompt(
    frameRenderer: (secondsRemaining: number) => string,
    timeoutMs: number,
    validInputs: readonly GraceInput[],
  ): Promise<GraceInput>;
}

// ─── Team 5 facade: `ValidateFn` consumed by executor Stage 6 ────────────────

export interface ValidateRequest {
  readonly irs: readonly CompiledPlasmidIR[];
  readonly artifacts: readonly GeneratedArtifact[];
  readonly reorgPlan: ReorgPlan;
  readonly writtenFiles: readonly WrittenFile[];
  readonly strategies: PipelineStrategies;
  readonly model: string;
  readonly workingDirectory: string;
  readonly transcriptId: string;
  readonly profile: ValidateProfile;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

export interface ValidateResult {
  readonly report: ValidationReport;
  readonly decision: RollbackDecision;
  readonly regressions: readonly RegressionFinding[];
  readonly overrideRecorded?: OverrideRecord;
}

export type ValidateFn = (req: ValidateRequest) => Promise<ValidateResult>;

// ─── /cure (Team 4 — PRD §6.4) ───────────────────────────────────────────────

export type CureMode =
  | { readonly kind: "latest" }
  | { readonly kind: "all" }
  | { readonly kind: "transcript"; readonly id: string }
  | { readonly kind: "plasmid"; readonly id: PlasmidId };

export interface CureOptions {
  readonly workingDirectory: string;
  readonly mode: CureMode;
  readonly dryRun: boolean;
  /** When true, also archive plasmid `.md` to `.dhelix/plasmids/archive/`. */
  readonly purge?: boolean;
  readonly approvalMode?: "interactive" | "auto";
  readonly signal?: AbortSignal;
}

export type CureStep =
  | {
      readonly kind: "delete-file";
      readonly path: string;
      readonly expectedHash: string;
    }
  | { readonly kind: "remove-marker"; readonly markerId: string }
  | { readonly kind: "archive-plasmid"; readonly plasmidId: PlasmidId }
  | { readonly kind: "clear-refs"; readonly plasmidId: PlasmidId };

export type CureWarningKind =
  | "manual-edit"
  | "later-transcript"
  | "git-uncommitted"
  | "transcript-orphan"
  | "constitution-user-conflict"
  | "unknown-marker";

export interface CureWarning {
  readonly kind: CureWarningKind;
  readonly path?: string;
  readonly markerId?: string;
  readonly plasmidId?: PlasmidId;
  readonly message: string;
}

export interface CurePlan {
  /** One entry per transcript consumed (1 for `latest`/`plasmid`, many for `all`). */
  readonly transcriptIds: readonly string[];
  readonly steps: readonly CureStep[];
  readonly warnings: readonly CureWarning[];
  /** Human-readable preview — PRD §6.4.3. */
  readonly preview: string;
}

export interface CureResult {
  readonly plan: CurePlan;
  readonly executed: boolean;
  readonly filesDeleted: readonly string[];
  readonly markersRemoved: readonly string[];
  readonly plasmidsArchived: readonly PlasmidId[];
  readonly errorCode?: CureErrorCode;
  readonly errorMessage?: string;
}

export type CureErrorCode =
  | "CURE_CONFLICT"
  | "TRANSCRIPT_CORRUPT"
  | "CURE_PARTIAL_FAILURE"
  | "CURE_ABORTED"
  | "CURE_NO_TRANSCRIPT";

export interface PlanCureRequest {
  readonly options: CureOptions;
}
export type PlanCureFn = (req: PlanCureRequest) => Promise<CurePlan>;

export interface RestoreCureRequest {
  readonly options: CureOptions;
  readonly plan: CurePlan;
}
export type RestoreCureFn = (req: RestoreCureRequest) => Promise<CureResult>;

export type ExecuteCureFn = (opts: CureOptions) => Promise<CureResult>;

// ─── Optional transcript extensions (Phase 3 adds, Phase 2 absent) ──────────

export interface PreReorgSnapshot {
  readonly beforeContent: string;
  readonly beforeHash: string;
  readonly capturedAt: string;
}

// ─── Phase 3 path constants ──────────────────────────────────────────────────

export const VALIDATION_HISTORY_FILE =
  ".dhelix/recombination/validation-history.jsonl";
export const VALIDATION_OVERRIDES_FILE =
  ".dhelix/recombination/validation-overrides.jsonl";
export const VALIDATION_FAILURES_DIR =
  ".dhelix/recombination/validation-failures";
export const RECOMBINATION_REFS_DIR = ".dhelix/recombination/refs/plasmids";
export const PLASMIDS_ARCHIVE_DIR = ".dhelix/plasmids/archive";

/** Grace period for I-10 auto-rollback (ms). PRD §10.1. */
export const ROLLBACK_GRACE_PERIOD_MS = 10_000;
/** Hardcoded minimum foundational-L4 failure rate that triggers rollback. */
export const FOUNDATIONAL_L4_ROLLBACK_THRESHOLD = 0.05;

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4 — ADVANCED GENERATORS + /recombination --mode rebuild + CURE v1
// ═══════════════════════════════════════════════════════════════════════════
//
// Ownership (Phase 4 5-team split):
//   Team 1 — agent-generator (.dhelix/agents/<name>.md via agentDefinitionSchema)
//   Team 2 — hook-generator (.dhelix/hooks/<Event>/<name>.sh) + harness-generator
//            (.dhelix/harness/<name>.md settings-recipe doc)
//   Team 3 — wiring-validator extensions: Permission Alignment + Cyclical Dep
//   Team 4 — Cure v1 3-way merge (restorer) + content-addressed blob lookup
//   Team 5 — executor --mode rebuild + Phase-4 generator dispatch + object
//            store (`.dhelix/recombination/objects/<hash>`) write at Stage 4
//
// Invariants preserved by this phase:
//   - I-1  Plasmid .md never mutated; blob store lives under .recombination/
//          which is I-8 blocked from runtime.
//   - I-5  Object store writes are append-only; blobs keyed by sha256.
//   - I-7  Rebuild mode still takes the advisory lock once for the full pass.
//   - I-8  New generator outputs (agent/hook/harness) live under .dhelix/
//          and are loader-read, never runtime-prompt-inlined.
//   - I-9  3-way merge of DHELIX.md marker blocks never writes outside the
//          original marker region; user prose invariance still enforced.
//   - I-10 Rebuild mode runs Stage 6 validation; any L1/L2/foundational-L4
//          failure rolls back to the pre-rebuild snapshot, not pristine.

// ─── Hook generator event map (PRD §6.3.3) ───────────────────────────────────
//
// The hook generator derives its event from `intent.params.event` — a string
// that must match one of the 17 canonical HookEvent names. We surface it here
// as a list constant the validator + generator both agree on.

export const HOOK_GENERATOR_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "TeammateIdle",
  "TaskCompleted",
  "ConfigChange",
  "PreCompact",
  "InstructionsLoaded",
  "WorktreeCreate",
  "WorktreeRemove",
] as const;
export type HookGeneratorEvent = (typeof HOOK_GENERATOR_EVENTS)[number];

/** A safe hook-event type guard — consumed by generator + wiring validator. */
export function isHookGeneratorEvent(value: unknown): value is HookGeneratorEvent {
  return (
    typeof value === "string" &&
    (HOOK_GENERATOR_EVENTS as readonly string[]).includes(value)
  );
}

// ─── Permission alignment (Team 3) ───────────────────────────────────────────
//
// Plasmid tier → artifact trust level ceiling. Foundational plasmids permit up
// to T3 agents (dangerous tools ok); tactical plasmids cap at T1 (confirm
// edits). Agent-proposed plasmids stay at T0. The wiring validator enforces
// this mapping; generators advisory-emit `trustLevel` via GeneratedArtifact.

export type ArtifactTrustLevel = "T0" | "T1" | "T2" | "T3";

/** Ordered most-restrictive → least-restrictive. */
export const TRUST_ORDER: readonly ArtifactTrustLevel[] = [
  "T0",
  "T1",
  "T2",
  "T3",
];

/**
 * Plasmid tier → max allowed artifact trust level (inclusive).
 *
 * PlasmidTier is the L1–L4 code (PRD §22.1 / §4); L4 is the foundational
 * tier per `schema.ts` ("foundational: true implies tier === L4"). Foundational
 * plasmids earn the highest trust ceiling because they embody the project's
 * durable principles. L1 is the most tactical tier and caps at T0 to keep
 * blast radius small for ad-hoc rules.
 */
export const PLASMID_TIER_TRUST_CEILING: Readonly<
  Record<PlasmidTier, ArtifactTrustLevel>
> = {
  L4: "T3",
  L3: "T2",
  L2: "T1",
  L1: "T0",
};

/**
 * Tools grouped by the minimum trust level that may call them. Generators
 * derive `requiredTools` from intent params; wiring validator cross-checks
 * each required tool against the artifact's declared trust level.
 */
export const TOOL_MIN_TRUST: Readonly<Record<string, ArtifactTrustLevel>> = {
  read: "T0",
  glob: "T0",
  grep: "T0",
  ls: "T0",
  plan: "T0",
  thinking: "T0",
  todo: "T0",
  websearch: "T0",
  webfetch: "T0",
  memory: "T0",
  notebook: "T1",
  edit: "T1",
  write: "T2",
  bash: "T2",
  task: "T2",
};

// ─── Cure v1 3-way merge (Team 4) ────────────────────────────────────────────
//
// When a `delete-file` cure step encounters a file whose current hash differs
// from the transcript's `expectedHash` (user edit), Cure v1 offers a 3-way
// merge instead of a blanket CURE_CONFLICT block. The merge consumes:
//   base    = content written at Stage 4 (fetched from object store by hash)
//   current = user's modified file on disk
//   target  = "" (the /cure action is "delete")
// For non-DHELIX.md files, the merge either preserves the user's edits
// (skip deletion + mark as kept) or escalates conflict markers depending on
// the `ThreeWayMergeMode`. For DHELIX.md marker blocks it strips the marker
// wrapper and retains any user edits inside the block as a new orphaned
// user-area section (I-9 still verified post-merge).

export type ThreeWayMergeMode =
  /** Legacy: hash-mismatch blocks restore (Phase 3 default). */
  | "block"
  /** Attempt diff3 auto-merge; escalate to markers on conflict. */
  | "auto"
  /** Keep the user's file untouched; skip the delete step + record warning. */
  | "keep-user"
  /** Non-interactive environments only — reserved for UX prompt (Phase 5). */
  | "prompt";

export type ThreeWayMergeOutcome =
  | "identical"
  | "clean-merge"
  | "kept-user"
  | "conflict-markers";

export interface ThreeWayMergeConflict {
  readonly startLine: number;
  readonly endLine: number;
  readonly baseHunk: readonly string[];
  readonly currentHunk: readonly string[];
  readonly targetHunk: readonly string[];
}

export interface ThreeWayMergeResult {
  readonly outcome: ThreeWayMergeOutcome;
  readonly mergedContent: string;
  readonly conflicts: readonly ThreeWayMergeConflict[];
  readonly userEditDetected: boolean;
}

// ─── Object store (Team 5) ───────────────────────────────────────────────────
//
// Content-addressed blob store at `.dhelix/recombination/objects/<sha256>`.
// Stage 4 writes every artifact body keyed by its `contentHash`. Cure v1
// reads these blobs as the `base` leg of the 3-way merge. Blobs are write-
// once; duplicates are no-ops. Lives under .recombination/ → I-8 blocked
// from runtime readers.

/** Absolute path for a blob given cwd + hex hash. */
export function objectStorePath(workingDirectory: string, hash: string): string {
  // First two hex chars fan-out the blob tree (like git). Pure helper.
  const fan = hash.slice(0, 2);
  const rest = hash.slice(2);
  return `${workingDirectory}/${RECOMBINATION_OBJECTS_DIR}/${fan}/${rest}`;
}

// ─── Rebuild mode (Team 5) ───────────────────────────────────────────────────
//
// `/recombination --mode rebuild` semantics (PRD §B.3):
//   1. Load latest transcript.
//   2. Internal /cure: delete all writtenFiles + strip all reorgMarkerIds.
//   3. Execute Stages 0–7 freshly on the current active plasmids.
//   4. Emit a new transcript tagged `mode: "rebuild"`, with a
//      `rebuiltFromTranscriptId` field pointing at the consumed transcript.
//
// The previous transcript is NOT deleted — it remains in the immutable
// transcripts dir (I-5) but becomes unreachable from `/cure --latest` since
// the new transcript is now latest. Audit log records the rebuild lineage.

export interface RebuildLineage {
  readonly rebuiltFromTranscriptId: string;
  readonly rebuiltAt: string;
  readonly consumedArtifactCount: number;
  readonly consumedMarkerCount: number;
}
