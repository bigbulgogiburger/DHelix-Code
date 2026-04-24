/**
 * Unit tests for `src/recombination/transcript.ts`.
 *
 * Exercises the in-memory builder and `persistTranscript` (atomic write +
 * append-only audit log).
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  OverrideRecord,
  PipelineStrategies,
  PreReorgSnapshot,
  RecombinationTranscript,
  ReorgOp,
  ValidationReport,
  VolumePlan,
  WiringReport,
} from "../../../src/recombination/types.js";
import {
  RECOMBINATION_AUDIT_LOG,
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../../../src/recombination/types.js";
import {
  createTranscript,
  makeTranscriptId,
  persistTranscript,
} from "../../../src/recombination/transcript.js";
import type { PlasmidId } from "../../../src/plasmids/types.js";

function fakeStrategies(): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "llm-only",
    validationVolume: "standard",
    validationParallelism: 10,
    gradingTiers: ["deterministic", "semi", "llm"],
    passThresholds: { L1: 0.95, L2: 0.8, L3: 0.7, L4: 0.6 },
    projectProfile: "full-llm",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 1,
  };
}

function okWiring(): WiringReport {
  return { findings: [], errorCount: 0, warnCount: 0, infoCount: 0, passed: true };
}

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-transcript-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("createTranscript", () => {
  it("records stage start/finish with duration", () => {
    const started = new Date("2026-04-24T12:00:00.000Z");
    const builder = createTranscript({
      startedAt: started,
      mode: "extend",
      model: "gpt-4o",
      strategies: fakeStrategies(),
      activePlasmidIds: ["p1" as PlasmidId],
      id: "test-id",
    });
    builder.recordStageStart(0, "preflight", started);
    builder.recordStageFinish(0, new Date(started.getTime() + 25), "ok");

    const built = builder.build(new Date(started.getTime() + 100));
    expect(built.id).toBe("test-id");
    expect(built.stages).toHaveLength(1);
    expect(built.stages[0]!.status).toBe("ok");
    expect(built.stages[0]!.durationMs).toBe(25);
    expect(built.mode).toBe("extend");
  });

  it("appends a synthetic stage record when finish called without start", () => {
    const builder = createTranscript({
      startedAt: new Date(),
      mode: "dry-run",
      model: "gpt-4o",
      strategies: fakeStrategies(),
      activePlasmidIds: [],
    });
    builder.recordStageFinish(3, new Date(), "skipped", "nothing to preview");
    const built = builder.build(new Date());
    expect(built.stages).toHaveLength(1);
    expect(built.stages[0]!.status).toBe("skipped");
    expect(built.stages[0]!.message).toBe("nothing to preview");
  });

  it("accumulates files, markers, wiring, error, and cache counters", () => {
    const builder = createTranscript({
      startedAt: new Date(),
      mode: "extend",
      model: "gpt-4o",
      strategies: fakeStrategies(),
      activePlasmidIds: ["p1" as PlasmidId, "p2" as PlasmidId],
    });
    builder.recordFile({ path: "/x.md", contentHash: "h", bytes: 10, op: "create" });
    builder.recordReorgMarkers(["m1", "m2"]);
    builder.recordWiring({
      findings: [],
      errorCount: 0,
      warnCount: 2,
      infoCount: 1,
      passed: true,
    });
    builder.recordError("RECOMBINATION_PLAN_ERROR", "bad plan");
    builder.recordCacheCounters(3, 7);

    const built = builder.build(new Date());
    expect(built.writtenFiles).toHaveLength(1);
    expect(built.reorgMarkerIds).toEqual(["m1", "m2"]);
    expect(built.wiring.warnCount).toBe(2);
    expect(built.errorCode).toBe("RECOMBINATION_PLAN_ERROR");
    expect(built.errorMessage).toBe("bad plan");
    expect(built.cacheHits).toBe(3);
    expect(built.cacheMisses).toBe(7);
    expect(built.activePlasmidIds).toEqual(["p1", "p2"]);
  });

  it("omits phase-3 optional fields when never recorded", () => {
    const builder = createTranscript({
      startedAt: new Date(),
      mode: "extend",
      model: "gpt-4o",
      strategies: fakeStrategies(),
      activePlasmidIds: [],
    });
    const built = builder.build(new Date());
    expect(built.validation).toBeUndefined();
    expect(built.validationOverride).toBeUndefined();
    expect(built.preReorgSnapshot).toBeUndefined();
    expect(built.reorgOps).toBeUndefined();
  });

  it("records phase-3 validation / override / snapshot / reorg ops when set", () => {
    const builder = createTranscript({
      startedAt: new Date(),
      mode: "extend",
      model: "gpt-4o",
      strategies: fakeStrategies(),
      activePlasmidIds: ["p1" as PlasmidId],
    });
    const plan: VolumePlan = {
      profile: "minimal",
      totalBudget: 5,
      perPlasmid: new Map(),
      timeBudgetMs: 1000,
      parallelism: 1,
    };
    const report: ValidationReport = {
      startedAt: "2026-04-24T12:00:00.000Z",
      finishedAt: "2026-04-24T12:00:01.000Z",
      durationMs: 1000,
      profile: "local",
      plan,
      totalCases: 0,
      perTier: [],
      perPlasmid: [],
      caseGradings: [],
      earlyExit: false,
      timeBudgetExceeded: false,
      overallPassed: true,
      dropped: [],
    };
    const override: OverrideRecord = {
      timestamp: "2026-04-24T12:00:02.000Z",
      transcriptId: "tid",
      plasmidId: "p1" as PlasmidId,
      tier: "L1",
      reason: "kept by user",
      passRate: 0.5,
      threshold: 0.95,
      actor: "1234@host",
    };
    const snapshot: PreReorgSnapshot = {
      beforeContent: "# Existing\n",
      beforeHash: "hash",
      capturedAt: "2026-04-24T12:00:00.000Z",
    };
    const ops: readonly ReorgOp[] = [
      {
        kind: "insert",
        markerId: "p1/intent",
        heading: "Intent",
        body: "body",
      },
    ];
    builder.recordValidation(report);
    builder.recordOverride(override);
    builder.recordPreReorgSnapshot(snapshot);
    builder.recordReorgOps(ops);

    const built = builder.build(new Date());
    expect(built.validation).toEqual(report);
    expect(built.validationOverride).toEqual(override);
    expect(built.preReorgSnapshot).toEqual(snapshot);
    expect(built.reorgOps).toEqual(ops);
    // ReorgOps should be a defensive copy — mutating the source array
    // must NOT change the transcript view.
    expect(built.reorgOps).not.toBe(ops);
  });

  it("auto-generates filesystem-safe ids via makeTranscriptId", () => {
    const id = makeTranscriptId(new Date("2026-04-24T12:34:56.789Z"));
    expect(id).toMatch(/^2026-04-24T12-34-56Z-[0-9a-f]{8}$/);
    // Generated ids MUST NOT contain characters that are invalid on Windows.
    expect(id).not.toContain(":");
  });
});

describe("persistTranscript", () => {
  function baseTranscript(overrides: Partial<RecombinationTranscript> = {}): RecombinationTranscript {
    const started = "2026-04-24T12:00:00.000Z";
    return {
      id: overrides.id ?? "fixed-id",
      startedAt: started,
      finishedAt: "2026-04-24T12:00:05.000Z",
      mode: overrides.mode ?? "extend",
      model: overrides.model ?? "gpt-4o",
      strategies: fakeStrategies(),
      activePlasmidIds: overrides.activePlasmidIds ?? (["p1"] as readonly PlasmidId[]),
      stages: overrides.stages ?? [],
      writtenFiles: overrides.writtenFiles ?? [],
      reorgMarkerIds: overrides.reorgMarkerIds ?? [],
      wiring: overrides.wiring ?? okWiring(),
      ...(overrides.errorCode !== undefined ? { errorCode: overrides.errorCode } : {}),
      ...(overrides.errorMessage !== undefined ? { errorMessage: overrides.errorMessage } : {}),
      cacheHits: overrides.cacheHits ?? 0,
      cacheMisses: overrides.cacheMisses ?? 0,
    };
  }

  it("writes the transcript JSON and audit log line (happy path)", async () => {
    const t = baseTranscript();
    const { transcriptPath, auditPath } = await persistTranscript(t, workdir);

    expect(transcriptPath).toBe(
      join(workdir, RECOMBINATION_TRANSCRIPTS_DIR, "fixed-id.json"),
    );
    expect(auditPath).toBe(join(workdir, RECOMBINATION_AUDIT_LOG));

    const body = await readFile(transcriptPath, "utf-8");
    const parsed = JSON.parse(body) as RecombinationTranscript;
    expect(parsed.id).toBe("fixed-id");

    const audit = await readFile(auditPath, "utf-8");
    expect(audit).toContain("fixed-id");
    expect(audit).toContain("status=ok");
    expect(audit).toContain("mode=extend");
    expect(audit).toContain("model=gpt-4o");
    expect(audit).toContain("activePlasmids=p1");
    expect(audit.endsWith("\n")).toBe(true);
  });

  it("records status=error and errorCode= in the audit log when transcript has an error", async () => {
    const t = baseTranscript({
      id: "err-id",
      errorCode: "RECOMBINATION_PLAN_ERROR",
      errorMessage: "plan broke",
    });
    const { auditPath } = await persistTranscript(t, workdir);
    const audit = await readFile(auditPath, "utf-8");
    expect(audit).toContain("status=error");
    expect(audit).toContain("errorCode=RECOMBINATION_PLAN_ERROR");
  });

  it("audit log is append-only: consecutive writes yield two distinct lines", async () => {
    const a = baseTranscript({ id: "a-id" });
    const b = baseTranscript({ id: "b-id" });
    await persistTranscript(a, workdir);
    await persistTranscript(b, workdir);

    const audit = await readFile(join(workdir, RECOMBINATION_AUDIT_LOG), "utf-8");
    const lines = audit.split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.startsWith("a-id")).toBe(true);
    expect(lines[1]!.startsWith("b-id")).toBe(true);
  });

  it("rejects when the abort signal is already triggered", async () => {
    const t = baseTranscript({ id: "aborted" });
    const ac = new AbortController();
    ac.abort();
    await expect(persistTranscript(t, workdir, ac.signal)).rejects.toThrow(
      /aborted/,
    );
  });
});
