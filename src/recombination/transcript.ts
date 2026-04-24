/**
 * Append-only recombination transcript writer (I-5).
 *
 * In-memory builder ({@link createTranscript}) accumulates stage / file
 * records while the executor runs; {@link persistTranscript} writes the
 * finalized transcript JSON under
 * `<workingDirectory>/.dhelix/recombination/transcripts/<id>.json` and
 * appends a one-line summary to `audit.log`.
 *
 * Invariants
 * - I-5  Audit log is append-only. We never truncate / rewrite.
 * - Atomic write for the transcript JSON (tmp + rename). The audit log
 *   uses `appendFile` so partial writes never corrupt earlier entries.
 *
 * Layer: Core. Depends on Node fs + `./types.js`.
 */
import { randomBytes } from "node:crypto";
import { appendFile, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  OverrideRecord,
  PipelineStrategies,
  PreReorgSnapshot,
  RecombinationErrorCode,
  RecombinationMode,
  RecombinationStageId,
  RecombinationTranscript,
  ReorgOp,
  StageRecord,
  ValidationReport,
  WiringReport,
  WrittenFile,
} from "./types.js";
import {
  RECOMBINATION_AUDIT_LOG,
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "./types.js";
import type { PlasmidId } from "../plasmids/types.js";

/** Initial seed for a transcript builder. */
export interface TranscriptSeed {
  readonly startedAt: Date;
  readonly mode: RecombinationMode;
  readonly model: string;
  readonly strategies: PipelineStrategies;
  readonly activePlasmidIds: readonly PlasmidId[];
  /**
   * Optional id override — mostly for tests. Production callers should
   * let the builder derive the id from `startedAt` + random bytes.
   */
  readonly id?: string;
}

/**
 * Mutable in-process transcript accumulator.
 *
 * Methods return the builder to allow chaining but callers usually hold
 * a single builder for the duration of an execution and call the
 * various `record*` methods as stages progress.
 */
export interface TranscriptBuilder {
  readonly id: string;
  readonly startedAt: string;
  recordStage(record: StageRecord): void;
  recordStageStart(stage: RecombinationStageId, name: string, startedAt: Date): void;
  recordStageFinish(
    stage: RecombinationStageId,
    finishedAt: Date,
    status: StageRecord["status"],
    message?: string,
  ): void;
  recordFile(file: WrittenFile): void;
  recordReorgMarkers(ids: readonly string[]): void;
  recordWiring(report: WiringReport): void;
  recordError(code: RecombinationErrorCode, message: string): void;
  recordCacheCounters(hits: number, misses: number): void;
  /** Phase 3 — Stage 6 validation report. Only included in `build()` when set. */
  recordValidation(report: ValidationReport): void;
  /** Phase 3 — keep-override audit. Only included in `build()` when set. */
  recordOverride(override: OverrideRecord): void;
  /** Phase 3 — pre-Stage-4 snapshot of DHELIX.md. Only included when set. */
  recordPreReorgSnapshot(snapshot: PreReorgSnapshot): void;
  /** Phase 3 — reorg ops actually applied at Stage 2d. Only included when set. */
  recordReorgOps(ops: readonly ReorgOp[]): void;
  build(finishedAt: Date): RecombinationTranscript;
}

/** Create a new in-memory transcript builder. */
export function createTranscript(seed: TranscriptSeed): TranscriptBuilder {
  const id = seed.id ?? makeTranscriptId(seed.startedAt);
  const stages: StageRecord[] = [];
  const stageStarts: Map<RecombinationStageId, Date> = new Map();
  const writtenFiles: WrittenFile[] = [];
  let reorgMarkerIds: readonly string[] = [];
  let wiring: WiringReport = emptyWiring();
  let errorCode: RecombinationErrorCode | undefined;
  let errorMessage: string | undefined;
  let cacheHits = 0;
  let cacheMisses = 0;
  let validation: ValidationReport | undefined;
  let validationOverride: OverrideRecord | undefined;
  let preReorgSnapshot: PreReorgSnapshot | undefined;
  let reorgOps: readonly ReorgOp[] | undefined;

  return {
    id,
    startedAt: seed.startedAt.toISOString(),
    recordStage(record) {
      stages.push(record);
    },
    recordStageStart(stage, name, startedAt) {
      stageStarts.set(stage, startedAt);
      stages.push({ stage, name, startedAt: startedAt.toISOString(), status: "ok" });
    },
    recordStageFinish(stage, finishedAt, status, message) {
      const idx = stages.findIndex((s) => s.stage === stage && s.finishedAt === undefined);
      if (idx === -1) {
        stages.push({
          stage,
          name: `stage-${stage}`,
          startedAt: finishedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          status,
          ...(message !== undefined ? { message } : {}),
        });
        return;
      }
      const start = stageStarts.get(stage);
      const durationMs =
        start !== undefined ? finishedAt.getTime() - start.getTime() : undefined;
      const existing = stages[idx] as StageRecord;
      stages[idx] = {
        ...existing,
        finishedAt: finishedAt.toISOString(),
        status,
        ...(message !== undefined ? { message } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
      };
    },
    recordFile(file) {
      writtenFiles.push(file);
    },
    recordReorgMarkers(ids) {
      reorgMarkerIds = [...ids];
    },
    recordWiring(report) {
      wiring = report;
    },
    recordError(code, message) {
      errorCode = code;
      errorMessage = message;
    },
    recordCacheCounters(hits, misses) {
      cacheHits = hits;
      cacheMisses = misses;
    },
    recordValidation(report) {
      validation = report;
    },
    recordOverride(override) {
      validationOverride = override;
    },
    recordPreReorgSnapshot(snapshot) {
      preReorgSnapshot = snapshot;
    },
    recordReorgOps(ops) {
      reorgOps = [...ops];
    },
    build(finishedAt: Date): RecombinationTranscript {
      return {
        id,
        startedAt: seed.startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        mode: seed.mode,
        model: seed.model,
        strategies: seed.strategies,
        activePlasmidIds: [...seed.activePlasmidIds],
        stages: [...stages],
        writtenFiles: [...writtenFiles],
        reorgMarkerIds: [...reorgMarkerIds],
        wiring,
        ...(errorCode !== undefined ? { errorCode } : {}),
        ...(errorMessage !== undefined ? { errorMessage } : {}),
        cacheHits,
        cacheMisses,
        ...(validation !== undefined ? { validation } : {}),
        ...(validationOverride !== undefined ? { validationOverride } : {}),
        ...(preReorgSnapshot !== undefined ? { preReorgSnapshot } : {}),
        ...(reorgOps !== undefined ? { reorgOps: [...reorgOps] } : {}),
      };
    },
  };
}

/**
 * Write the transcript JSON atomically and append one audit line. The
 * audit line shape is tab-delimited:
 *   `<id>\t<status>\tactivePlasmids=<csv>\tmode=<mode>\tmodel=<model>`.
 */
export async function persistTranscript(
  transcript: RecombinationTranscript,
  workingDirectory: string,
  signal?: AbortSignal,
): Promise<{ readonly transcriptPath: string; readonly auditPath: string }> {
  if (signal?.aborted) {
    throw new Error("persistTranscript: aborted");
  }
  const transcriptsDir = join(workingDirectory, RECOMBINATION_TRANSCRIPTS_DIR);
  const auditPath = join(workingDirectory, RECOMBINATION_AUDIT_LOG);
  const transcriptPath = join(transcriptsDir, `${transcript.id}.json`);

  await mkdir(transcriptsDir, { recursive: true });
  await mkdir(dirname(auditPath), { recursive: true });

  const body = JSON.stringify(transcript, null, 2) + "\n";
  const tmpPath = `${transcriptPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmpPath, body, "utf-8");
    await rename(tmpPath, transcriptPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      /* best effort */
    }
    throw err;
  }

  const status = transcript.errorCode !== undefined ? "error" : "ok";
  const activeCsv = transcript.activePlasmidIds.join(",");
  const auditLine =
    [
      transcript.id,
      `status=${status}`,
      `mode=${transcript.mode}`,
      `model=${transcript.model}`,
      `activePlasmids=${activeCsv}`,
      ...(transcript.errorCode !== undefined ? [`errorCode=${transcript.errorCode}`] : []),
    ].join("\t") + "\n";

  await appendFile(auditPath, auditLine, "utf-8");

  return { transcriptPath, auditPath };
}

/**
 * Id shape: `YYYY-MM-DDTHH-mm-ssZ-<rand8>` (ISO-8601 with `:` swapped for
 * `-` so the id is safe as a filename on every platform).
 */
export function makeTranscriptId(at: Date): string {
  const iso = at.toISOString().replace(/[.:]/g, "-").replace(/-\d+Z$/, "Z");
  const rand = randomBytes(4).toString("hex");
  return `${iso}-${rand}`;
}

function emptyWiring(): WiringReport {
  return {
    findings: [],
    errorCount: 0,
    warnCount: 0,
    infoCount: 0,
    passed: true,
  };
}
