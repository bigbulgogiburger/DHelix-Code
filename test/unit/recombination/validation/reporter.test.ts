/**
 * Unit tests for `src/recombination/validation/reporter.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  autoTimeoutDecisionIO,
  awaitRollbackDecision,
  renderGraceFrame,
  renderReport,
} from "../../../../src/recombination/validation/reporter.js";
import type {
  GraceInput,
  GracePromptIO,
  PlasmidValidationSummary,
  RollbackDecision,
  TierStats,
  ValidationLevel,
  ValidationReport,
} from "../../../../src/recombination/types.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";

const pid = (s: string): PlasmidId => s as PlasmidId;

const tier = (
  level: ValidationLevel,
  passed: number,
  total: number,
  threshold: number,
): TierStats => {
  const rate = total === 0 ? 1 : passed / total;
  return {
    tier: level,
    total,
    passed,
    rate,
    threshold,
    meetsThreshold: rate >= threshold,
    skipped: 0,
  };
};

const buildReport = (
  perTier: readonly TierStats[],
  perPlasmid: readonly PlasmidValidationSummary[] = [],
  overrides: Partial<ValidationReport> = {},
): ValidationReport => ({
  startedAt: "2026-04-24T10:00:00Z",
  finishedAt: "2026-04-24T10:00:38Z",
  durationMs: 38_000,
  profile: "local",
  plan: {
    profile: "standard",
    totalBudget: perTier.reduce((sum, t) => sum + t.total, 0),
    perPlasmid: new Map(),
    timeBudgetMs: 300_000,
    parallelism: 1,
  },
  totalCases: perTier.reduce((sum, t) => sum + t.total, 0),
  perTier,
  perPlasmid,
  caseGradings: [],
  earlyExit: false,
  timeBudgetExceeded: false,
  overallPassed: perTier.every((t) => t.meetsThreshold),
  dropped: [],
  ...overrides,
});

describe("renderReport", () => {
  it("renders the passing-run summary with all four tiers", () => {
    const report = buildReport([
      tier("L1", 50, 50, 1.0),
      tier("L2", 22, 25, 0.88),
      tier("L3", 10, 10, 0.8),
      tier("L4", 5, 5, 0.7),
    ]);
    const out = renderReport(report);
    expect(out).toContain("Validation summary:");
    expect(out).toContain("L1 (direct):      50/50 ✓ (100.0%)");
    expect(out).toContain("L2 (indirect):    22/25 ✓ (88.0%)");
    expect(out).toContain("L3 (conditional): 10/10 ✓ (100.0%)");
    expect(out).toContain("L4 (adversarial): 5/5 ✓ (100.0%)");
    expect(out).toContain("Overall:          87/90 (96.7%)");
    expect(out).toContain("Profile:          local");
  });

  it("marks failing tiers with ✗ and lists failing plasmids", () => {
    const perPlasmid: PlasmidValidationSummary[] = [
      {
        plasmidId: pid("bad-plasmid"),
        tier: "L2",
        perLevel: new Map<ValidationLevel, TierStats>([
          ["L1", tier("L1", 10, 15, 1.0)],
        ]),
        overallPassed: false,
      },
    ];
    const report = buildReport(
      [tier("L1", 10, 15, 1.0), tier("L2", 25, 25, 0.9)],
      perPlasmid,
    );
    const out = renderReport(report);
    expect(out).toContain("✗");
    expect(out).toContain("Failing plasmids:");
    expect(out).toContain("bad-plasmid");
    expect(out).toContain("[L1]");
  });

  it("shows time budget + dropped cases when present", () => {
    const report = buildReport(
      [tier("L1", 50, 50, 1.0)],
      [],
      {
        timeBudgetExceeded: true,
        dropped: [
          { plasmidId: pid("x"), tier: "L4", reason: "quota overflow" },
          { plasmidId: pid("y"), tier: "L3", reason: "quota overflow" },
        ],
      },
    );
    const out = renderReport(report);
    expect(out).toContain("time budget exceeded");
    expect(out).toContain("Dropped cases:    2");
  });
});

describe("renderGraceFrame", () => {
  it("includes the countdown, hotkey legend, and failing tier", () => {
    const report = buildReport([tier("L1", 48, 50, 1.0)]);
    const decision: RollbackDecision = {
      action: "rollback",
      reason: "L1 miss",
      failingTier: "L1",
      failingPlasmidId: pid("bad-one"),
      foundationalL4Triggered: false,
    };
    const frame = renderGraceFrame(report, decision, 10);
    expect(frame).toContain("🧬 Validation FAILED — auto-rollback in 10s");
    expect(frame).toContain("L1: 48/50");
    expect(frame).toContain("Plasmid: bad-one");
    expect(frame).toContain("[r] Rollback (default, auto in 10s)");
    expect(frame).toContain("[k] Keep (override+audit)");
    expect(frame).toContain("[c] Re-run cloud");
    expect(frame).toContain("[i] Inspect");
    expect(frame).toContain("[e] Edit plasmid");
  });

  it("renders different countdown values", () => {
    const report = buildReport([tier("L2", 10, 20, 0.9)]);
    const decision: RollbackDecision = {
      action: "rollback",
      reason: "L2 miss",
      failingTier: "L2",
    };
    expect(renderGraceFrame(report, decision, 3)).toContain(
      "auto-rollback in 3s",
    );
    expect(renderGraceFrame(report, decision, 0)).toContain(
      "auto-rollback in 0s",
    );
  });
});

describe("awaitRollbackDecision", () => {
  const report = buildReport([tier("L1", 48, 50, 1.0)]);
  const decision: RollbackDecision = {
    action: "rollback",
    reason: "L1",
    failingTier: "L1",
  };

  const makeIO = (result: GraceInput): GracePromptIO => ({
    prompt: vi.fn().mockResolvedValue(result),
  });

  it('maps "keep" → keep', async () => {
    const out = await awaitRollbackDecision({
      io: makeIO("keep"),
      report,
      decision,
    });
    expect(out).toBe("keep");
  });

  it('maps "rollback" → rollback', async () => {
    const out = await awaitRollbackDecision({
      io: makeIO("rollback"),
      report,
      decision,
    });
    expect(out).toBe("rollback");
  });

  it.each<GraceInput>(["rerun", "inspect", "edit"])(
    'Phase-3 maps %s → rollback',
    async (input) => {
      const out = await awaitRollbackDecision({
        io: makeIO(input),
        report,
        decision,
      });
      expect(out).toBe("rollback");
    },
  );

  it("throws when aborted before the prompt", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      awaitRollbackDecision({
        io: makeIO("keep"),
        report,
        decision,
        signal: controller.signal,
      }),
    ).rejects.toThrow("grace period aborted");
  });

  it("throws when aborted after the prompt resolves", async () => {
    const controller = new AbortController();
    const io: GracePromptIO = {
      prompt: vi.fn().mockImplementation(async () => {
        controller.abort();
        return "keep" as GraceInput;
      }),
    };
    await expect(
      awaitRollbackDecision({
        io,
        report,
        decision,
        signal: controller.signal,
      }),
    ).rejects.toThrow("grace period aborted");
  });
});

describe("autoTimeoutDecisionIO", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves to rollback after the timeout elapses", async () => {
    const io = autoTimeoutDecisionIO(["rollback", "keep"]);
    const frame = () => "frame";
    const promise = io.prompt(frame, 10_000, ["rollback", "keep"]);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBe("rollback");
  });

  it("combined with awaitRollbackDecision produces a rollback on timeout", async () => {
    const report = buildReport([tier("L1", 48, 50, 1.0)]);
    const decision: RollbackDecision = {
      action: "rollback",
      reason: "L1",
      failingTier: "L1",
    };
    const io = autoTimeoutDecisionIO([
      "rollback",
      "keep",
      "rerun",
      "inspect",
      "edit",
    ]);
    const promise = awaitRollbackDecision({ io, report, decision });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toBe("rollback");
  });
});
