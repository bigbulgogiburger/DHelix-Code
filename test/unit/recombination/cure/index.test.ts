/**
 * Unit tests for `src/recombination/cure/index.ts` — facade composition.
 */
import { describe, expect, it, vi } from "vitest";

import {
  createCure,
  defaultCureFacadeDeps,
  type CureFacadeDeps,
} from "../../../../src/recombination/cure/index.js";
import type {
  CureOptions,
  CurePlan,
  CureResult,
} from "../../../../src/recombination/types.js";

function fakePlan(): CurePlan {
  return { transcriptIds: ["t-1"], steps: [], warnings: [], preview: "preview" };
}

function fakeResult(plan: CurePlan, executed: boolean): CureResult {
  return {
    plan,
    executed,
    filesDeleted: [],
    markersRemoved: [],
    plasmidsArchived: [],
  };
}

function mkOptions(overrides: Partial<CureOptions> = {}): CureOptions {
  return {
    workingDirectory: "/tmp/x",
    mode: { kind: "latest" },
    dryRun: false,
    ...overrides,
  };
}

describe("createCure", () => {
  it("orchestrates plan → restore when not dry-run", async () => {
    const plan = fakePlan();
    const deps: CureFacadeDeps = {
      planCure: vi.fn().mockResolvedValue(plan),
      restoreCure: vi.fn().mockResolvedValue(fakeResult(plan, true)),
    };
    const execute = createCure(deps);
    const result = await execute(mkOptions());
    expect(deps.planCure).toHaveBeenCalledOnce();
    expect(deps.restoreCure).toHaveBeenCalledOnce();
    expect(result.executed).toBe(true);
  });

  it("short-circuits dry-run without calling restoreCure", async () => {
    const plan = fakePlan();
    const deps: CureFacadeDeps = {
      planCure: vi.fn().mockResolvedValue(plan),
      restoreCure: vi.fn(),
    };
    const execute = createCure(deps);
    const result = await execute(mkOptions({ dryRun: true }));
    expect(deps.planCure).toHaveBeenCalledOnce();
    expect(deps.restoreCure).not.toHaveBeenCalled();
    expect(result.executed).toBe(false);
    expect(result.plan).toBe(plan);
  });
});

describe("defaultCureFacadeDeps", () => {
  it("exposes planCure + restoreCure", () => {
    const deps = defaultCureFacadeDeps();
    expect(typeof deps.planCure).toBe("function");
    expect(typeof deps.restoreCure).toBe("function");
  });
});
