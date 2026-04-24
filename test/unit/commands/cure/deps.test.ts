/**
 * Unit tests for `src/commands/cure/deps.ts` + `render.ts`.
 */
import { describe, expect, it } from "vitest";

import { defaultDeps } from "../../../../src/commands/cure/deps.js";
import { renderCureReport } from "../../../../src/commands/cure/render.js";
import type {
  CurePlan,
  CureResult,
} from "../../../../src/recombination/types.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";

describe("defaultDeps", () => {
  it("returns an object with an executeCure function", () => {
    const deps = defaultDeps("/tmp/anywhere");
    expect(typeof deps.executeCure).toBe("function");
  });
});

describe("renderCureReport", () => {
  const plan: CurePlan = {
    transcriptIds: ["t-1"],
    steps: [],
    warnings: [],
    preview: "preview\nline-2",
  };

  it("renders executed state with deleted/marker/archive lists", () => {
    const result: CureResult = {
      plan,
      executed: true,
      filesDeleted: ["/tmp/a.md"],
      markersRemoved: ["m1"],
      plasmidsArchived: ["foo" as PlasmidId],
    };
    const out = renderCureReport(result);
    expect(out).toMatch(/restored/);
    expect(out).toMatch(/a\.md/);
    expect(out).toMatch(/m1/);
    expect(out).toMatch(/foo/);
    expect(out).toMatch(/completed successfully/);
  });

  it("renders preview when not executed", () => {
    const result: CureResult = {
      plan,
      executed: false,
      filesDeleted: [],
      markersRemoved: [],
      plasmidsArchived: [],
    };
    const out = renderCureReport(result);
    expect(out).toMatch(/preview/);
    expect(out).toMatch(/not executed/);
  });

  it("renders error code when present", () => {
    const result: CureResult = {
      plan,
      executed: false,
      filesDeleted: [],
      markersRemoved: [],
      plasmidsArchived: [],
      errorCode: "CURE_CONFLICT",
      errorMessage: "hash mismatch",
    };
    const out = renderCureReport(result);
    expect(out).toMatch(/CURE_CONFLICT/);
    expect(out).toMatch(/hash mismatch/);
  });
});
