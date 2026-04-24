/**
 * Recombination executor — orchestrates Stage 0 through Stage 5 of the
 * 8-stage pipeline defined in PRD §6.3. Stages 6 (runtime validation)
 * and 7 (release) are Phase-3 scope; we record a no-op stub in the
 * transcript so downstream tooling sees a complete stage list.
 *
 * Layer: Core (Layer 2). Consumes Leaf+Infra deps via dependency
 * injection — never directly imports the team modules.
 *
 * Invariants enforced:
 *   - I-1  Plasmid sources are read-only (loader is the only reader).
 *   - I-4  Stage-5 failure → rollback newly written files.
 *   - I-5  Transcript is append-only; we persist once at Stage 7.
 *   - I-7  Every mutation takes the advisory lock (Stage 0 acquire →
 *          Stage 7 release in the outer try/finally).
 *   - I-8  Plasmid bodies flow only into interpreter / generators /
 *          compression / reorganizer — never into the runtime prompt
 *          sections persisted to `.dhelix/prompt-sections/`.
 *   - I-9  Constitution writes only the BEGIN/END marker regions and
 *          verify user-area invariance post-apply.
 */
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import { getLogger } from "../utils/logger.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import type {
  LoadedPlasmid,
  PlasmidId,
  PlasmidTier,
} from "../plasmids/types.js";
import { ActivationStore } from "../plasmids/activation.js";
import { loadPlasmids } from "../plasmids/loader.js";
import { projectProfileRelativePath } from "./compression/index.js";
import {
  applyPlan as applyConstitutionPlan,
  parse as parseConstitution,
  verifyUserAreaInvariance,
} from "./constitution/index.js";
import {
  aborted,
  generatorError,
  interpreterJsonFailure,
  RecombinationError,
  wiringValidationError,
} from "./errors.js";
import { acquire, type LockHandle } from "./lock.js";
import { writeBlob } from "./object-store.js";
import { enforcePrivacy, selectStrategies } from "./strategy.js";
import {
  createTranscript,
  persistTranscript,
  type TranscriptBuilder,
} from "./transcript.js";
import {
  CONSTITUTION_FILE,
  RECOMBINATION_TRANSCRIPTS_DIR,
  type AssembledSection,
  type CompiledPlasmidIR,
  type CompressionOutput,
  type CurePlan,
  type CureStep,
  type ExecuteRecombinationFn,
  type ExecutorDeps,
  type GeneratedArtifact,
  type InterpretResult,
  type PipelineStrategies,
  type PreReorgSnapshot,
  type RebuildLineage,
  type RecombinationErrorCode,
  type RecombinationOptions,
  type RecombinationResult,
  type ReorgPlan,
  type RollbackDecision,
  type StaticValidationMode,
  type WrittenFile,
} from "./types.js";
import { validateWiring as validateWiringRaw } from "./wiring-validator.js";
import { restoreCure } from "./cure/restorer.js";
import { writePlasmidRef } from "./cure/refs.js";

/**
 * Phase 4 — pass `plasmidTiers` as a 5th context arg to the validator so
 * Team 3's Permission Alignment check can enforce
 * `PLASMID_TIER_TRUST_CEILING`. The current Team-3 worktree exports the
 * 4-arg signature; TS sees the broader type and JS ignores the extra arg,
 * so this stays compatible with both the stale and the merged branches.
 */
interface WiringValidatorContext {
  readonly plasmidTiers: ReadonlyMap<PlasmidId, PlasmidTier>;
}
type ValidateWiringFn = (
  artifacts: readonly GeneratedArtifact[],
  reorgPlan: ReorgPlan,
  workingDirectory: string,
  signal?: AbortSignal,
  context?: WiringValidatorContext,
) => ReturnType<typeof validateWiringRaw>;
const validateWiring: ValidateWiringFn = validateWiringRaw as ValidateWiringFn;

export const EXECUTOR_VERSION = "1.0.0";

/**
 * Execute the recombination pipeline.
 *
 * All heavy work is delegated through {@link ExecutorDeps}. The executor
 * owns only the orchestration concerns: lock, privacy gate, parallelism,
 * rollback, and transcript assembly.
 */
export const executeRecombination: ExecuteRecombinationFn = async (
  opts: RecombinationOptions,
  deps: ExecutorDeps,
): Promise<RecombinationResult> => {
  throwIfAborted(opts.signal, "stage-0");

  let lock: LockHandle | undefined;
  let transcript: TranscriptBuilder | undefined;
  const writtenFiles: WrittenFile[] = [];
  const rollbackActions: Array<() => Promise<void>> = [];
  let applied = false;

  const now = () => new Date();
  const staticValidationMode: StaticValidationMode = opts.staticValidation ?? "strict";
  const approvalMode = opts.approvalMode ?? "auto";

  try {
    // ── Stage 0: preflight ─────────────────────────────────────────────
    const stage0Started = now();
    lock = await acquire(opts.workingDirectory);

    // ── Phase 4: rebuild mode — internal cure of the latest transcript
    // runs BEFORE plasmids are loaded so the pipeline that follows sees a
    // pristine working tree (barring user edits we explicitly preserve).
    // Lineage data is captured here and recorded onto the new transcript
    // right after `createTranscript` below.
    let pendingRebuildLineage: RebuildLineage | null = null;
    let rebuildFallbackMessage: string | null = null;
    if (opts.mode === "rebuild") {
      const rebuildOutcome = await performRebuildCure(opts);
      if (rebuildOutcome.kind === "no-transcript") {
        rebuildFallbackMessage =
          "rebuild fallback: no prior transcript found — proceeding as extend";
      } else {
        pendingRebuildLineage = rebuildOutcome.lineage;
      }
    }

    const loadResult = await loadPlasmids({
      workingDirectory: opts.workingDirectory,
      registryPath: opts.registryPath,
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    });

    const activationStore = new ActivationStore({
      workingDirectory: opts.workingDirectory,
      registryPath: opts.registryPath,
    });
    const activation = await activationStore.read();
    const activeIdSet = new Set<string>(activation.activePlasmidIds);

    const preOverrideActive: readonly LoadedPlasmid[] = loadResult.loaded.filter((p) => {
      if (opts.plasmidId !== undefined) return p.metadata.id === opts.plasmidId;
      return activeIdSet.has(p.metadata.id);
    });

    // Phase 5 — best-effort consumption of any queued foundational overrides
    // (`/plasmid challenge --action override`). Drops the matching plasmid
    // ids so the rest of the pipeline (privacy gate, generators, validators)
    // never sees them for this run. Failures here MUST NOT fail the run —
    // missing pending file or absent governance module → no drops.
    const consumedOverrideIds = await consumePendingOverrides(
      opts.workingDirectory,
      preOverrideActive.map((p) => p.metadata.id),
      opts.signal,
    );
    const consumedSet = new Set<PlasmidId>(consumedOverrideIds);
    const activePlasmids: readonly LoadedPlasmid[] =
      consumedSet.size === 0
        ? preOverrideActive
        : preOverrideActive.filter((p) => !consumedSet.has(p.metadata.id));

    const modelId = opts.modelOverride ?? "gpt-4o"; // sane default; UX fills it in
    const caps = getModelCapabilities(modelId);
    const strategies: PipelineStrategies = selectStrategies(caps);
    enforcePrivacy(caps, activePlasmids);

    transcript = createTranscript({
      startedAt: stage0Started,
      mode: opts.mode,
      model: modelId,
      strategies,
      activePlasmidIds: activePlasmids.map((p) => p.metadata.id),
    });
    transcript.recordStageStart(0, "preflight", stage0Started);
    if (pendingRebuildLineage !== null) {
      transcript.recordRebuildLineage(pendingRebuildLineage);
    }
    if (consumedOverrideIds.length > 0) {
      transcript.recordConsumedOverrides(consumedOverrideIds);
    }
    transcript.recordStageFinish(
      0,
      now(),
      "ok",
      rebuildFallbackMessage ?? undefined,
    );

    // ── Stage 1: input collection ───────────────────────────────────────
    throwIfAborted(opts.signal, "stage-1");
    const stage1Started = now();
    transcript.recordStageStart(1, "input-collection", stage1Started);
    const existingConstitution = await readFileOrEmpty(
      join(opts.workingDirectory, CONSTITUTION_FILE),
    );
    // Phase 3 — capture a pre-reorg snapshot so `/cure` can verify I-9
    // invariance exactly (not via heuristic reverse reorg).
    const preReorgSnapshot: PreReorgSnapshot = {
      beforeContent: existingConstitution,
      beforeHash: sha256(existingConstitution),
      capturedAt: now().toISOString(),
    };
    transcript.recordPreReorgSnapshot(preReorgSnapshot);
    transcript.recordStageFinish(1, now(), "ok");

    // ── Stage 2a: interpret (parallel, capped) ──────────────────────────
    throwIfAborted(opts.signal, "stage-2a");
    const stage2aStarted = now();
    transcript.recordStageStart(2, "interpret", stage2aStarted);
    const interpretResults = await runBounded<LoadedPlasmid, InterpretResult>(
      activePlasmids,
      Math.max(1, strategies.validationParallelism),
      async (plasmid) => {
        try {
          return await deps.interpret({
            plasmid,
            strategy: strategies.interpreter,
            retries: strategies.interpreterRetries,
            modelId,
            workingDirectory: opts.workingDirectory,
            llm: deps.llm,
            ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
          });
        } catch (err) {
          if (err instanceof RecombinationError) throw err;
          throw interpreterJsonFailure(plasmid.metadata.id, err);
        }
      },
    );
    const irs: readonly CompiledPlasmidIR[] = interpretResults.map((r) => r.ir);
    const cacheHits = interpretResults.filter((r) => r.cacheHit).length;
    const cacheMisses = interpretResults.length - cacheHits;
    transcript.recordCacheCounters(cacheHits, cacheMisses);
    transcript.recordStageFinish(2, now(), "ok");

    // ── Stage 2b/2c/2d: generate + compress + reorganize ───────────────
    throwIfAborted(opts.signal, "stage-2b");
    const generateResult = await deps.generate({
      irs,
      strategies,
      workingDirectory: opts.workingDirectory,
      llm: deps.llm,
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    });
    const artifacts: readonly GeneratedArtifact[] = generateResult.artifacts;

    throwIfAborted(opts.signal, "stage-2c");
    const compression: CompressionOutput = await deps.compress({
      irs,
      strategies,
      workingDirectory: opts.workingDirectory,
      llm: deps.llm,
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    });

    throwIfAborted(opts.signal, "stage-2d");
    const reorgPlan: ReorgPlan = await deps.reorganize({
      irs,
      existingConstitution,
      strategies,
      workingDirectory: opts.workingDirectory,
      llm: deps.llm,
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    });
    // Phase 3 — record the reorg ops for `/cure` precise reverse planning.
    transcript.recordReorgOps(reorgPlan.ops);

    // ── Stage 3: preview + approval ─────────────────────────────────────
    throwIfAborted(opts.signal, "stage-3");
    const stage3Started = now();
    transcript.recordStageStart(3, "preview", stage3Started);

    if (opts.mode === "dry-run") {
      // Dry-run still reports the markers the plan would touch (insert +
      // update), not `keptMarkerIds`. Useful for previews and /cure
      // simulations that consume the transcript.
      const dryRunMarkerIds = reorgPlan.ops
        .filter((op) => op.kind === "insert" || op.kind === "update")
        .map((op) => op.markerId);
      transcript.recordReorgMarkers(dryRunMarkerIds);
      transcript.recordStageFinish(3, now(), "skipped", "dry-run: skipping apply");
      transcript.recordStageFinish(6, now(), "skipped", "runtime validation phase-3");
      transcript.recordStageStart(7, "release", now());
      const built = transcript.build(now());
      await persistTranscript(built, opts.workingDirectory, opts.signal);
      transcript.recordStageFinish(7, now(), "ok");
      applied = false;
      return {
        transcript: built,
        plan: { artifacts, compression, reorg: reorgPlan },
        applied,
      };
    }

    // Approval — Phase 2 supports auto / auto-on-clean; interactive defers
    // to auto with a TODO for the Ink prompt (Phase 3 UX).
    // TODO(phase-3): wire Ink prompt via RuntimePipeline message bus when
    // approvalMode === "interactive".
    if (approvalMode === "auto-on-clean") {
      // "clean" ≡ no WARN-severity findings after static validation. We
      // run a preview of the validator here to make the decision.
      const preview = await validateWiring(
        artifacts,
        reorgPlan,
        opts.workingDirectory,
        opts.signal,
        { plasmidTiers: buildPlasmidTiersMap(activePlasmids) },
      );
      if (preview.warnCount > 0 || preview.errorCount > 0) {
        transcript.recordStageFinish(3, now(), "warn", "approval withheld (warnings present)");
        const built = transcript.build(now());
        await persistTranscript(built, opts.workingDirectory, opts.signal);
        return {
          transcript: built,
          plan: { artifacts, compression, reorg: reorgPlan },
          applied: false,
        };
      }
    }
    transcript.recordStageFinish(3, now(), "ok");

    // ── Stage 4: persist ────────────────────────────────────────────────
    throwIfAborted(opts.signal, "stage-4");
    const stage4Started = now();
    transcript.recordStageStart(4, "persist", stage4Started);

    // 4a — write generated artifacts
    for (const art of artifacts) {
      try {
        await atomicWrite(art.targetPath, art.contents);
      } catch (err) {
        throw generatorError(art.sourceIntentId, err);
      }
      writtenFiles.push({
        path: art.targetPath,
        contentHash: art.contentHash,
        bytes: Buffer.byteLength(art.contents, "utf-8"),
        op: "create",
      });
      rollbackActions.push(async () => {
        try {
          await unlink(art.targetPath);
        } catch {
          /* best effort */
        }
      });
      transcript.recordFile(writtenFiles[writtenFiles.length - 1]!);
      // Phase 4 — content-addressed archive for Cure v1 3-way merge base.
      // Blob write is best-effort: failures never fail Stage 4 (I-7 advisory).
      await bestEffortBlob(opts.workingDirectory, art.contentHash, art.contents, opts.signal);
    }

    // 4b — write compression sections + project profile
    for (const section of compression.sections) {
      const abs = resolveSectionPath(opts.workingDirectory, section);
      await atomicWrite(abs, section.markdown);
      const sectionHash = sha256(section.markdown);
      const entry: WrittenFile = {
        path: abs,
        contentHash: sectionHash,
        bytes: Buffer.byteLength(section.markdown, "utf-8"),
        op: "create",
      };
      writtenFiles.push(entry);
      transcript.recordFile(entry);
      rollbackActions.push(async () => {
        try {
          await unlink(abs);
        } catch {
          /* ignore */
        }
      });
      await bestEffortBlob(opts.workingDirectory, sectionHash, section.markdown, opts.signal);
    }
    if (compression.projectProfileMarkdown.trim() !== "") {
      // Use Team 3's canonical path helper — PRD §7.1 locks this to
      // `.dhelix/prompt-sections/generated/40-project-profile.md`. Hard-
      // coding `90-project-profile.md` here used to shadow Team 3 and
      // broke the runtime loader's ordering convention.
      const profilePath = join(
        opts.workingDirectory,
        projectProfileRelativePath(),
      );
      await atomicWrite(profilePath, compression.projectProfileMarkdown);
      const profileHash = sha256(compression.projectProfileMarkdown);
      const entry: WrittenFile = {
        path: profilePath,
        contentHash: profileHash,
        bytes: Buffer.byteLength(compression.projectProfileMarkdown, "utf-8"),
        op: "create",
      };
      writtenFiles.push(entry);
      transcript.recordFile(entry);
      rollbackActions.push(async () => {
        try {
          await unlink(profilePath);
        } catch {
          /* ignore */
        }
      });
      await bestEffortBlob(
        opts.workingDirectory,
        profileHash,
        compression.projectProfileMarkdown,
        opts.signal,
      );
    }

    // 4c — apply the reorg plan to DHELIX.md (atomic + invariance check).
    // Delegated to Team 4's `applyPlan` / `verifyUserAreaInvariance` so the
    // marker grammar (`<!-- BEGIN plasmid-derived: <id> -->`) stays single-
    // sourced — see P-1.15 §1.1.
    const constitutionPath = join(opts.workingDirectory, CONSTITUTION_FILE);
    const beforeTree = parseConstitution(existingConstitution);
    const applyResult = applyConstitutionPlan(existingConstitution, reorgPlan);
    const nextConstitution = applyResult.newConstitution;
    const afterTree = parseConstitution(nextConstitution);
    verifyUserAreaInvariance(beforeTree, afterTree);
    await atomicWrite(constitutionPath, nextConstitution);
    const constitutionHash = sha256(nextConstitution);
    const constEntry: WrittenFile = {
      path: constitutionPath,
      contentHash: constitutionHash,
      bytes: Buffer.byteLength(nextConstitution, "utf-8"),
      op: existingConstitution === "" ? "create" : "update",
    };
    writtenFiles.push(constEntry);
    transcript.recordFile(constEntry);
    await bestEffortBlob(
      opts.workingDirectory,
      constitutionHash,
      nextConstitution,
      opts.signal,
    );
    rollbackActions.push(async () => {
      try {
        await atomicWrite(constitutionPath, existingConstitution);
      } catch {
        /* ignore */
      }
    });
    // Record the marker ids actually rendered into DHELIX.md (inserts +
    // updates) rather than the plan's `keptMarkerIds`, so /cure can undo
    // exactly what Stage 4 wrote.
    transcript.recordReorgMarkers(applyResult.markerIdsWritten);
    transcript.recordStageFinish(4, now(), "ok");

    // ── Stage 5: static wiring validation ───────────────────────────────
    throwIfAborted(opts.signal, "stage-5");
    const stage5Started = now();
    transcript.recordStageStart(5, "static-validation", stage5Started);
    const report = await validateWiring(
      artifacts,
      reorgPlan,
      opts.workingDirectory,
      opts.signal,
      { plasmidTiers: buildPlasmidTiersMap(activePlasmids) },
    );
    transcript.recordWiring(report);

    if (!report.passed && staticValidationMode === "strict") {
      await rollbackAll(rollbackActions);
      transcript.recordStageFinish(5, now(), "error", "wiring validation failed");
      const err = wiringValidationError(report);
      transcript.recordError(err.code, err.message);
      const built = transcript.build(now());
      await persistTranscript(built, opts.workingDirectory, opts.signal);
      return {
        transcript: built,
        plan: { artifacts, compression, reorg: reorgPlan },
        applied: false,
      };
    }

    transcript.recordStageFinish(
      5,
      now(),
      report.passed ? "ok" : "warn",
      report.passed ? undefined : `${report.warnCount} warning(s)`,
    );

    // ── Stage 6: runtime validation (Phase 3) ───────────────────────────
    transcript.recordStageStart(6, "runtime-validation", now());
    if (opts.validateProfile && opts.validateProfile !== "none" && deps.validate) {
      try {
        const validateResult = await deps.validate({
          irs,
          artifacts,
          reorgPlan,
          writtenFiles,
          strategies,
          model: modelId,
          workingDirectory: opts.workingDirectory,
          transcriptId: transcript.id,
          profile: opts.validateProfile,
          llm: deps.llm,
          ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
        });
        transcript.recordValidation(validateResult.report);
        if (validateResult.overrideRecorded) {
          transcript.recordOverride(validateResult.overrideRecorded);
        }
        if (validateResult.decision.action === "rollback") {
          const code = rollbackErrorCode(validateResult.decision);
          await rollbackAll(rollbackActions);
          applied = false;
          transcript.recordError(code, validateResult.decision.reason);
          transcript.recordStageFinish(
            6,
            now(),
            "error",
            validateResult.decision.reason,
          );
          const builtEarly = transcript.build(now());
          await persistTranscript(builtEarly, opts.workingDirectory, opts.signal);
          return {
            transcript: builtEarly,
            plan: { artifacts, compression, reorg: reorgPlan },
            applied: false,
          };
        }
        transcript.recordStageFinish(
          6,
          now(),
          validateResult.decision.action === "warn" ? "warn" : "ok",
          validateResult.decision.reason,
        );
      } catch (err) {
        // Validation crash — preserve Phase-2 behavior (continue) with
        // a warning stage record. No rollback on infrastructure failure.
        const msg = err instanceof Error ? err.message : String(err);
        transcript.recordStageFinish(6, now(), "warn", `validation error: ${msg}`);
      }
    } else {
      transcript.recordStageFinish(
        6,
        now(),
        "skipped",
        opts.validateProfile === "none"
          ? "explicit --validate=none"
          : deps.validate === undefined
            ? "no validator injected"
            : "phase-2 compatible path",
      );
    }

    // ── Stage 7: release ────────────────────────────────────────────────
    transcript.recordStageStart(7, "release", now());
    applied = true;
    // Phase 3 — persist plasmid → transcript refs for `/cure --plasmid <id>`.
    // Telemetry: Phase-3 scope does not yet wire OTLP spans here.
    const refPlasmidIds =
      opts.plasmidId !== undefined
        ? [opts.plasmidId]
        : activePlasmids.map((p) => p.metadata.id);
    for (const plasmidId of refPlasmidIds) {
      try {
        await writePlasmidRef(
          opts.workingDirectory,
          plasmidId,
          transcript.id,
          opts.signal,
        );
      } catch {
        /* non-fatal — ref write is best-effort */
      }
    }
    const built = transcript.build(now());
    await persistTranscript(built, opts.workingDirectory, opts.signal);
    transcript.recordStageFinish(7, now(), "ok");

    return {
      transcript: built,
      plan: { artifacts, compression, reorg: reorgPlan },
      applied,
    };
  } catch (err) {
    // Best-effort rollback on unexpected failure paths.
    if (!applied && rollbackActions.length > 0) {
      await rollbackAll(rollbackActions);
    }
    if (transcript !== undefined) {
      const code =
        err instanceof RecombinationError
          ? err.code
          : err instanceof Error && err.message === "aborted"
            ? "RECOMBINATION_ABORTED"
            : "RECOMBINATION_PLAN_ERROR";
      const msg = err instanceof Error ? err.message : String(err);
      transcript.recordError(code, msg);
      try {
        const built = transcript.build(now());
        await persistTranscript(built, opts.workingDirectory, opts.signal).catch(() => {
          /* do not mask original error */
        });
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    if (lock !== undefined) {
      await lock.release();
    }
  }
};

// ─── helpers ─────────────────────────────────────────────────────────────────

async function atomicWrite(targetPath: string, contents: string): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmp, contents, "utf-8");
    await rename(tmp, targetPath);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

async function readFileOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return "";
    throw err;
  }
}

async function rollbackAll(actions: readonly (() => Promise<void>)[]): Promise<void> {
  // Roll back in reverse insertion order — constitution restore happens
  // before the per-file deletes, mimicking the write sequence.
  for (let i = actions.length - 1; i >= 0; i--) {
    try {
      await actions[i]!();
    } catch {
      /* swallow */
    }
  }
}

function resolveSectionPath(workingDirectory: string, section: AssembledSection): string {
  // Accept both relative and absolute generator outputs.
  if (section.relativePath.startsWith("/")) return section.relativePath;
  return join(workingDirectory, section.relativePath);
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

function throwIfAborted(signal: AbortSignal | undefined, stage: string): void {
  if (signal?.aborted) throw aborted(stage);
}

async function runBounded<I, O>(
  items: readonly I[],
  concurrency: number,
  task: (item: I) => Promise<O>,
): Promise<readonly O[]> {
  if (items.length === 0) return [];
  const width = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<O>(items.length);
  let cursor = 0;
  const workers: Promise<void>[] = [];
  const runWorker = async (): Promise<void> => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await task(items[idx]!);
    }
  };
  for (let i = 0; i < width; i++) workers.push(runWorker());
  await Promise.all(workers);
  return results;
}

// ─── reorg plan application (Phase-2 scope) ──────────────────────────────────
//
// Reorg-plan rendering + I-9 invariance enforcement is delegated to the
// Team-4 constitution module (`./constitution/index.js`). This keeps the
// locked `<!-- BEGIN plasmid-derived: <id> -->` grammar single-sourced and
// ensures `remove` ops on a previous run's markers actually succeed.

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

/**
 * Map a Phase-3 rollback decision to the canonical `RecombinationErrorCode`
 * recorded on the transcript. Foundational L4 failures win over tier-specific
 * codes so audit consumers can quickly surface the highest-severity signal.
 */
/**
 * Build a `plasmidId → tier` lookup map for the wiring validator's
 * Permission Alignment check. Consumed as the 5th arg context object.
 */
function buildPlasmidTiersMap(
  activePlasmids: readonly LoadedPlasmid[],
): ReadonlyMap<PlasmidId, PlasmidTier> {
  const map = new Map<PlasmidId, PlasmidTier>();
  for (const p of activePlasmids) {
    map.set(p.metadata.id, p.metadata.tier);
  }
  return map;
}

/**
 * Write `contents` to the content-addressed object store. Failures are
 * swallowed — blob archival is advisory (I-7) and MUST NOT fail the
 * pipeline.
 */
/**
 * Phase 5 — best-effort consumption of foundational overrides queued via
 * `/plasmid challenge --action override`. Returns the subset of `candidateIds`
 * whose pending entry was consumed (each id gets `true` from `consumeOverride`
 * exactly once per queued entry, then `false` thereafter).
 *
 * Best-effort surface (dev-guide §6 MUST):
 *   - Missing pending file → []
 *   - Governance module absent / fails to import → log + []
 *   - Per-id consume failure → log + skip that id
 *
 * Implementation note: we resolve the governance module via dynamic import
 * so this file compiles even when Team 3's `consumeOverride` is still a
 * placeholder export. When Team 3 lands the real surface, no executor edit
 * is required.
 */
async function consumePendingOverrides(
  workingDirectory: string,
  candidateIds: readonly PlasmidId[],
  signal: AbortSignal | undefined,
): Promise<readonly PlasmidId[]> {
  if (candidateIds.length === 0) return [];
  let consumeOverride: ConsumeOverrideFn | undefined;
  try {
    const mod = (await import(
      "../plasmids/governance/overrides-pending.js"
    )) as Partial<{ consumeOverride: ConsumeOverrideFn }>;
    consumeOverride = mod.consumeOverride;
  } catch (err) {
    // Governance module unavailable — Phase-2/3/4 worktrees won't have it
    // wired yet. Treat as no-op rather than failing the pipeline.
    getLogger().debug(
      { err: messageOf(err) },
      "consumePendingOverrides: governance module not loadable; skipping",
    );
    return [];
  }
  if (typeof consumeOverride !== "function") {
    return [];
  }
  if (signal?.aborted === true) return [];

  const consumed: PlasmidId[] = [];
  for (const id of candidateIds) {
    try {
      const wasConsumed = await consumeOverride({
        workingDirectory,
        plasmidId: id,
        ...(signal !== undefined ? { signal } : {}),
      });
      if (wasConsumed === true) consumed.push(id);
    } catch (err) {
      getLogger().warn(
        { plasmidId: id, err: messageOf(err) },
        "consumePendingOverrides: consume failed for plasmid id",
      );
    }
  }
  return consumed;
}

/**
 * Surface of Team 3's `consumeOverride`. Kept narrow so the dynamic import
 * does not couple the executor to a specific signature shape — only the
 * boolean return matters here.
 */
type ConsumeOverrideFn = (req: {
  readonly workingDirectory: string;
  readonly plasmidId: PlasmidId;
  readonly signal?: AbortSignal;
}) => Promise<boolean> | boolean;

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function bestEffortBlob(
  cwd: string,
  hash: string,
  contents: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await writeBlob(cwd, hash, contents, signal);
  } catch {
    /* best effort — intentionally ignored per I-7 advisory */
  }
}

interface RebuildCureSuccess {
  readonly kind: "consumed";
  readonly lineage: RebuildLineage;
}
interface RebuildCureFallback {
  readonly kind: "no-transcript";
}
type RebuildCureOutcome = RebuildCureSuccess | RebuildCureFallback;

/**
 * Internal `/cure`-equivalent executed at the start of `/recombination
 * --mode rebuild`. Deletes the artifacts + strips the markers recorded in
 * the most recent transcript, then hands off to the normal Stage-0..7
 * pipeline so the rebuild runs on a clean slate.
 *
 * The cure is executed with `approvalMode: "auto"` + `mergeMode:
 * "keep-user"` so user edits inside marker blocks are preserved (Team 4
 * Phase-4 3-way merge). Team 4 may not have landed yet — the extension
 * `CureOptions & { mergeMode }` stays type-safe via an intersection cast.
 */
async function performRebuildCure(
  opts: RecombinationOptions,
): Promise<RebuildCureOutcome> {
  const latestId = await readLatestTranscriptId(opts.workingDirectory);
  if (latestId === null) {
    return { kind: "no-transcript" };
  }
  const transcript = await readTranscriptTolerant(opts.workingDirectory, latestId);
  if (transcript === null) {
    // Corrupt / missing transcript — act like a fallback rebuild rather
    // than crashing the run.
    return { kind: "no-transcript" };
  }

  const steps: CureStep[] = [];
  const writtenFiles = Array.isArray(transcript.writtenFiles)
    ? transcript.writtenFiles
    : [];
  for (const file of writtenFiles) {
    if (file.op !== "create" && file.op !== "update") continue;
    steps.push({
      kind: "delete-file",
      path: file.path,
      expectedHash: file.contentHash ?? "",
    });
  }
  const reorgMarkerIds = Array.isArray(transcript.reorgMarkerIds)
    ? transcript.reorgMarkerIds
    : [];
  for (const markerId of reorgMarkerIds) {
    steps.push({ kind: "remove-marker", markerId });
  }

  const plan: CurePlan = {
    transcriptIds: [latestId],
    steps,
    warnings: [],
    preview: `rebuild internal cure of ${latestId}`,
  };

  // Team 4 Phase-4 adds a `mergeMode` field to CureOptions. Keep the cast
  // tight to that single optional property so a merged Team-4 branch
  // upgrades the typing transparently; earlier branches simply ignore the
  // extra key at runtime.
  const cureOptions = {
    workingDirectory: opts.workingDirectory,
    mode: { kind: "transcript" as const, id: latestId },
    dryRun: false,
    approvalMode: "auto" as const,
    mergeMode: "keep-user" as const,
    ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
  } as Parameters<typeof restoreCure>[0]["options"];

  const cureResult = await restoreCure({ options: cureOptions, plan });

  const lineage: RebuildLineage = {
    rebuiltFromTranscriptId: latestId,
    rebuiltAt: new Date().toISOString(),
    consumedArtifactCount: cureResult.filesDeleted.length,
    consumedMarkerCount: cureResult.markersRemoved.length,
  };
  return { kind: "consumed", lineage };
}

/**
 * Lexical scan of the transcripts directory — returns the most recent
 * transcript id or null. Mirrors `cure/planner.ts#listTranscriptIds` but
 * kept local so the executor doesn't create a circular dep on cure/.
 */
async function readLatestTranscriptId(cwd: string): Promise<string | null> {
  const dir = join(cwd, RECOMBINATION_TRANSCRIPTS_DIR);
  let entries: readonly string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return null;
    throw err;
  }
  const ids = entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
  return ids.length === 0 ? null : (ids[ids.length - 1] ?? null);
}

/** Shape-tolerant transcript reader — enough fields to drive the rebuild cure. */
interface RebuildReadableTranscript {
  readonly writtenFiles?: ReadonlyArray<{
    readonly path: string;
    readonly contentHash?: string;
    readonly op?: "create" | "update" | "delete";
  }>;
  readonly reorgMarkerIds?: readonly string[];
}

async function readTranscriptTolerant(
  cwd: string,
  transcriptId: string,
): Promise<RebuildReadableTranscript | null> {
  const path = join(cwd, RECOMBINATION_TRANSCRIPTS_DIR, `${transcriptId}.json`);
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return null;
    throw err;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as RebuildReadableTranscript;
  } catch {
    return null;
  }
}

function rollbackErrorCode(decision: RollbackDecision): RecombinationErrorCode {
  if (decision.foundationalL4Triggered === true)
    return "VALIDATION_FAILED_FOUNDATIONAL_L4";
  if (decision.failingTier === "L1") return "VALIDATION_FAILED_L1";
  if (decision.failingTier === "L2") return "VALIDATION_FAILED_L2";
  return "RECOMBINATION_PLAN_ERROR";
}
