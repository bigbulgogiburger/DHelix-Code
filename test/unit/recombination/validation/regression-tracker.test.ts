/**
 * Unit tests for `src/recombination/validation/regression-tracker.ts`.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  appendHistory,
  detectRegressions,
  reportToHistoryEntry,
} from "../../../../src/recombination/validation/regression-tracker.js";
import type {
  HistoryEntry,
  PlasmidValidationSummary,
  TierStats,
  ValidationLevel,
  ValidationReport,
} from "../../../../src/recombination/types.js";
import { VALIDATION_HISTORY_FILE } from "../../../../src/recombination/types.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";

const pid = (s: string): PlasmidId => s as PlasmidId;

const tier = (
  level: ValidationLevel,
  rate: number,
  threshold = 0.9,
): TierStats => ({
  tier: level,
  total: 10,
  passed: Math.round(rate * 10),
  rate,
  threshold,
  meetsThreshold: rate >= threshold,
  skipped: 0,
});

const summary = (
  plasmidId: string,
  rates: Readonly<Record<ValidationLevel, number>>,
): PlasmidValidationSummary => ({
  plasmidId: pid(plasmidId),
  tier: "L2",
  perLevel: new Map<ValidationLevel, TierStats>([
    ["L1", tier("L1", rates.L1)],
    ["L2", tier("L2", rates.L2)],
    ["L3", tier("L3", rates.L3)],
    ["L4", tier("L4", rates.L4)],
  ]),
  overallPassed: true,
});

const buildReport = (
  perPlasmid: readonly PlasmidValidationSummary[],
  finishedAt = "2026-04-24T10:00:00Z",
): ValidationReport => ({
  startedAt: "2026-04-24T09:59:00Z",
  finishedAt,
  durationMs: 60_000,
  profile: "local",
  plan: {
    profile: "standard",
    totalBudget: 100,
    perPlasmid: new Map(),
    timeBudgetMs: 300_000,
    parallelism: 1,
  },
  totalCases: 100,
  perTier: [
    tier("L1", 1.0),
    tier("L2", 1.0),
    tier("L3", 1.0),
    tier("L4", 1.0),
  ],
  perPlasmid,
  caseGradings: [],
  earlyExit: false,
  timeBudgetExceeded: false,
  overallPassed: true,
  dropped: [],
});

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-regression-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("reportToHistoryEntry", () => {
  it("projects report tier + per-plasmid rates into a history entry", () => {
    const report = buildReport([
      summary("alpha", { L1: 1.0, L2: 0.95, L3: 0.9, L4: 0.7 }),
    ]);
    const entry = reportToHistoryEntry("tx-123", report);
    expect(entry.timestamp).toBe(report.finishedAt);
    expect(entry.transcriptId).toBe("tx-123");
    expect(entry.perTier.map((t) => t.tier)).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
    ]);
    expect(entry.perPlasmid[0]).toEqual({
      plasmidId: pid("alpha"),
      L1: 1.0,
      L2: 0.95,
      L3: 0.9,
      L4: 0.7,
    });
  });

  it("defaults missing per-level entries to 0", () => {
    const partialSummary: PlasmidValidationSummary = {
      plasmidId: pid("partial"),
      tier: "L2",
      perLevel: new Map<ValidationLevel, TierStats>([
        ["L1", tier("L1", 1.0)],
      ]),
      overallPassed: true,
    };
    const report = buildReport([partialSummary]);
    const entry = reportToHistoryEntry("tx-1", report);
    expect(entry.perPlasmid[0]).toEqual({
      plasmidId: pid("partial"),
      L1: 1.0,
      L2: 0,
      L3: 0,
      L4: 0,
    });
  });
});

describe("appendHistory", () => {
  it("round-trips an entry through the jsonl file", async () => {
    const report = buildReport([
      summary("alpha", { L1: 1.0, L2: 0.95, L3: 0.9, L4: 0.8 }),
    ]);
    const entry = reportToHistoryEntry("tx-1", report);
    await appendHistory(workdir, entry);
    const raw = await readFile(
      join(workdir, VALIDATION_HISTORY_FILE),
      "utf-8",
    );
    expect(raw.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(raw.trim()) as HistoryEntry;
    expect(parsed.transcriptId).toBe("tx-1");
    expect(parsed.perPlasmid[0]?.plasmidId).toBe("alpha");
  });

  it("appends multiple entries preserving order", async () => {
    await appendHistory(workdir, {
      timestamp: "2026-04-24T09:00:00Z",
      transcriptId: "tx-1",
      perTier: [],
      perPlasmid: [],
    });
    await appendHistory(workdir, {
      timestamp: "2026-04-24T10:00:00Z",
      transcriptId: "tx-2",
      perTier: [],
      perPlasmid: [],
    });
    const raw = await readFile(
      join(workdir, VALIDATION_HISTORY_FILE),
      "utf-8",
    );
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).transcriptId).toBe("tx-1");
    expect(JSON.parse(lines[1]!).transcriptId).toBe("tx-2");
  });
});

describe("detectRegressions", () => {
  const currentReport = buildReport(
    [summary("alpha", { L1: 0.85, L2: 0.9, L3: 0.9, L4: 0.9 })],
    "2026-04-24T11:00:00Z",
  );

  it("returns [] when no history file exists", async () => {
    const findings = await detectRegressions({
      workingDirectory: workdir,
      current: currentReport,
      transcriptId: "tx-now",
    });
    expect(findings).toEqual([]);
  });

  it("returns [] when only the current transcript is in history", async () => {
    await appendHistory(
      workdir,
      reportToHistoryEntry("tx-now", currentReport),
    );
    const findings = await detectRegressions({
      workingDirectory: workdir,
      current: currentReport,
      transcriptId: "tx-now",
    });
    expect(findings).toEqual([]);
  });

  it("flags synthetic 10% drop (L1 1.0 → 0.85)", async () => {
    const prior = buildReport(
      [summary("alpha", { L1: 1.0, L2: 0.9, L3: 0.9, L4: 0.9 })],
      "2026-04-24T09:00:00Z",
    );
    await appendHistory(workdir, reportToHistoryEntry("tx-prev", prior));
    const findings = await detectRegressions({
      workingDirectory: workdir,
      current: currentReport,
      transcriptId: "tx-now",
    });
    const l1 = findings.find((f) => f.tier === "L1");
    expect(l1).toBeDefined();
    expect(l1?.plasmidId).toBe("alpha");
    expect(l1?.previousRate).toBe(1.0);
    expect(l1?.currentRate).toBeCloseTo(0.85, 5);
    expect(l1?.delta).toBeLessThanOrEqual(-0.05);
    expect(l1?.previousTranscriptId).toBe("tx-prev");
  });

  it("ignores within-threshold 3% noise", async () => {
    const stableCurrent = buildReport(
      [summary("alpha", { L1: 0.97, L2: 0.9, L3: 0.9, L4: 0.9 })],
      "2026-04-24T11:00:00Z",
    );
    const prior = buildReport(
      [summary("alpha", { L1: 1.0, L2: 0.9, L3: 0.9, L4: 0.9 })],
      "2026-04-24T09:00:00Z",
    );
    await appendHistory(workdir, reportToHistoryEntry("tx-prev", prior));
    const findings = await detectRegressions({
      workingDirectory: workdir,
      current: stableCurrent,
      transcriptId: "tx-now",
    });
    expect(findings.find((f) => f.tier === "L1")).toBeUndefined();
  });

  it("uses the most recent prior when multiple exist", async () => {
    const old = buildReport(
      [summary("alpha", { L1: 0.5, L2: 0.5, L3: 0.5, L4: 0.5 })],
      "2026-04-24T07:00:00Z",
    );
    const recent = buildReport(
      [summary("alpha", { L1: 0.95, L2: 0.95, L3: 0.95, L4: 0.95 })],
      "2026-04-24T09:00:00Z",
    );
    await appendHistory(workdir, reportToHistoryEntry("tx-old", old));
    await appendHistory(workdir, reportToHistoryEntry("tx-recent", recent));
    const findings = await detectRegressions({
      workingDirectory: workdir,
      current: currentReport,
      transcriptId: "tx-now",
    });
    // alpha L1 dropped 0.95 → 0.85 (−0.10). Compare against tx-recent, not tx-old.
    const l1 = findings.find((f) => f.tier === "L1");
    expect(l1?.previousTranscriptId).toBe("tx-recent");
    expect(l1?.previousRate).toBeCloseTo(0.95, 5);
  });

  it("returns no findings when plasmid is new (no prior entry)", async () => {
    const prior = buildReport(
      [summary("other", { L1: 1.0, L2: 1.0, L3: 1.0, L4: 1.0 })],
      "2026-04-24T08:00:00Z",
    );
    await appendHistory(workdir, reportToHistoryEntry("tx-prev", prior));
    const findings = await detectRegressions({
      workingDirectory: workdir,
      current: currentReport,
      transcriptId: "tx-now",
    });
    expect(findings.filter((f) => f.plasmidId === "alpha")).toEqual([]);
  });

  it("honors a custom threshold (e.g. 0.02 catches 3% drop)", async () => {
    const prior = buildReport(
      [summary("alpha", { L1: 0.9, L2: 0.9, L3: 0.9, L4: 0.9 })],
      "2026-04-24T09:00:00Z",
    );
    const smallDrop = buildReport(
      [summary("alpha", { L1: 0.87, L2: 0.9, L3: 0.9, L4: 0.9 })],
      "2026-04-24T11:00:00Z",
    );
    await appendHistory(workdir, reportToHistoryEntry("tx-prev", prior));
    const findings = await detectRegressions({
      workingDirectory: workdir,
      current: smallDrop,
      transcriptId: "tx-now",
      threshold: 0.02,
    });
    expect(findings.find((f) => f.tier === "L1")).toBeDefined();
  });
});
