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
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import { getModelCapabilities } from "../llm/model-capabilities.js";
import type { LoadedPlasmid } from "../plasmids/types.js";
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
import { enforcePrivacy, selectStrategies } from "./strategy.js";
import {
  createTranscript,
  persistTranscript,
  type TranscriptBuilder,
} from "./transcript.js";
import {
  CONSTITUTION_FILE,
  type AssembledSection,
  type CompiledPlasmidIR,
  type CompressionOutput,
  type ExecuteRecombinationFn,
  type ExecutorDeps,
  type GeneratedArtifact,
  type InterpretResult,
  type PipelineStrategies,
  type RecombinationOptions,
  type RecombinationResult,
  type ReorgPlan,
  type StaticValidationMode,
  type WrittenFile,
} from "./types.js";
import { validateWiring } from "./wiring-validator.js";

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
  if (opts.mode === "rebuild") {
    throw new RecombinationError(
      "RECOMBINATION_PLAN_ERROR",
      "/recombination --mode rebuild is a Phase-4 feature and not yet implemented.",
      { mode: opts.mode },
    );
  }
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

    const activePlasmids: readonly LoadedPlasmid[] = loadResult.loaded.filter((p) => {
      if (opts.plasmidId !== undefined) return p.metadata.id === opts.plasmidId;
      return activeIdSet.has(p.metadata.id);
    });

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
    transcript.recordStageFinish(0, now(), "ok");

    // ── Stage 1: input collection ───────────────────────────────────────
    throwIfAborted(opts.signal, "stage-1");
    const stage1Started = now();
    transcript.recordStageStart(1, "input-collection", stage1Started);
    const existingConstitution = await readFileOrEmpty(
      join(opts.workingDirectory, CONSTITUTION_FILE),
    );
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
    }

    // 4b — write compression sections + project profile
    for (const section of compression.sections) {
      const abs = resolveSectionPath(opts.workingDirectory, section);
      await atomicWrite(abs, section.markdown);
      const entry: WrittenFile = {
        path: abs,
        contentHash: sha256(section.markdown),
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
      const entry: WrittenFile = {
        path: profilePath,
        contentHash: sha256(compression.projectProfileMarkdown),
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
    const constEntry: WrittenFile = {
      path: constitutionPath,
      contentHash: sha256(nextConstitution),
      bytes: Buffer.byteLength(nextConstitution, "utf-8"),
      op: existingConstitution === "" ? "create" : "update",
    };
    writtenFiles.push(constEntry);
    transcript.recordFile(constEntry);
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

    // ── Stage 6: runtime validation (Phase 3 — skipped) ────────────────
    transcript.recordStageStart(6, "runtime-validation", now());
    transcript.recordStageFinish(6, now(), "skipped", "phase-3 not yet implemented");

    // ── Stage 7: release ────────────────────────────────────────────────
    transcript.recordStageStart(7, "release", now());
    applied = true;
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
