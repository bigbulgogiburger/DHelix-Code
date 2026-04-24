/**
 * Regression tracker (`.dhelix/recombination/validation-history.jsonl`).
 *
 * Team 3 — Phase 3. Append-only (I-5). Each successful validation run
 * records a `HistoryEntry`. `detectRegressions` diffs the new entry
 * against the last prior one and flags any plasmid-level rate drop ≥5%
 * (configurable). Returned findings are attached to `ValidateResult`
 * and, per PRD §10.3, surface as error code
 * `VALIDATION_REGRESSION_DETECTED` in the report warnings.
 *
 * Layer: Core. Atomic append; read-all for diff.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  HistoryEntry,
  RegressionFinding,
  ValidationLevel,
  ValidationReport,
} from "../types.js";
import { VALIDATION_HISTORY_FILE } from "../types.js";
import type { PlasmidId } from "../../plasmids/types.js";

const VALID_TIERS: readonly ValidationLevel[] = ["L1", "L2", "L3", "L4"];

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error("aborted");
  }
};

export const reportToHistoryEntry: (
  transcriptId: string,
  report: ValidationReport,
) => HistoryEntry = (transcriptId, report) => {
  const perTier = report.perTier.map((t) => ({
    tier: t.tier,
    rate: t.rate,
  }));
  const perPlasmid = report.perPlasmid.map((p) => ({
    plasmidId: p.plasmidId,
    L1: p.perLevel.get("L1")?.rate ?? 0,
    L2: p.perLevel.get("L2")?.rate ?? 0,
    L3: p.perLevel.get("L3")?.rate ?? 0,
    L4: p.perLevel.get("L4")?.rate ?? 0,
  }));
  return {
    timestamp: report.finishedAt,
    transcriptId,
    perTier,
    perPlasmid,
  };
};

export const appendHistory: (
  workingDirectory: string,
  entry: HistoryEntry,
  signal?: AbortSignal,
) => Promise<void> = async (workingDirectory, entry, signal) => {
  throwIfAborted(signal);
  const filePath = join(workingDirectory, VALIDATION_HISTORY_FILE);
  await mkdir(dirname(filePath), { recursive: true });
  throwIfAborted(signal);
  const line = `${JSON.stringify(entry)}\n`;
  await writeFile(filePath, line, { flag: "a", encoding: "utf-8" });
};

export interface DetectRegressionsRequest {
  readonly workingDirectory: string;
  readonly current: ValidationReport;
  readonly transcriptId: string;
  /** Threshold delta (default 0.05 = 5%). */
  readonly threshold?: number;
  readonly signal?: AbortSignal;
}

const isHistoryEntry = (value: unknown): value is HistoryEntry => {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.timestamp === "string" &&
    typeof v.transcriptId === "string" &&
    Array.isArray(v.perTier) &&
    Array.isArray(v.perPlasmid)
  );
};

export const detectRegressions: (
  req: DetectRegressionsRequest,
) => Promise<readonly RegressionFinding[]> = async (req) => {
  const { workingDirectory, current, transcriptId, threshold = 0.05, signal } =
    req;
  throwIfAborted(signal);
  const filePath = join(workingDirectory, VALIDATION_HISTORY_FILE);
  let contents: string;
  try {
    contents = await readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  throwIfAborted(signal);

  const prior: HistoryEntry[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.warn(
        `[regression-tracker] skipped malformed line in ${VALIDATION_HISTORY_FILE}`,
      );
      continue;
    }
    if (!isHistoryEntry(parsed)) continue;
    if (parsed.transcriptId === transcriptId) continue;
    prior.push(parsed);
  }

  if (prior.length === 0) return [];

  // Walk newest → oldest to find the most recent prior per-plasmid snapshot.
  // HistoryEntries are appended in chronological order, so iterate in reverse.
  const latestPriorPerPlasmid = new Map<
    PlasmidId,
    {
      readonly L1: number;
      readonly L2: number;
      readonly L3: number;
      readonly L4: number;
      readonly transcriptId: string;
    }
  >();
  for (let i = prior.length - 1; i >= 0; i -= 1) {
    const entry = prior[i];
    if (entry === undefined) continue;
    for (const row of entry.perPlasmid) {
      if (latestPriorPerPlasmid.has(row.plasmidId)) continue;
      latestPriorPerPlasmid.set(row.plasmidId, {
        L1: row.L1,
        L2: row.L2,
        L3: row.L3,
        L4: row.L4,
        transcriptId: entry.transcriptId,
      });
    }
  }

  const findings: RegressionFinding[] = [];
  for (const summary of current.perPlasmid) {
    const prev = latestPriorPerPlasmid.get(summary.plasmidId);
    if (!prev) continue;
    for (const tier of VALID_TIERS) {
      const currentRate = summary.perLevel.get(tier)?.rate ?? 0;
      const previousRate = prev[tier];
      const delta = currentRate - previousRate;
      if (delta <= -threshold) {
        findings.push({
          plasmidId: summary.plasmidId,
          tier,
          previousRate,
          currentRate,
          delta,
          previousTranscriptId: prev.transcriptId,
        });
      }
    }
  }
  return findings;
};
