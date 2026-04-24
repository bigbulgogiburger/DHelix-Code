/**
 * Unit tests for `src/recombination/cure/three-way-merge.ts`.
 */
import { describe, expect, it } from "vitest";

import { threeWayMerge } from "../three-way-merge.js";

describe("threeWayMerge", () => {
  it("identical base/current/target → outcome=identical", () => {
    const base = "alpha\nbeta\ngamma";
    const r = threeWayMerge(base, base, base);
    expect(r.outcome).toBe("identical");
    expect(r.mergedContent).toBe(base);
    expect(r.conflicts).toHaveLength(0);
    expect(r.userEditDetected).toBe(false);
  });

  it("only current modified → clean-merge, mergedContent=current", () => {
    const base = "a\nb\nc";
    const current = "a\nB\nc";
    const target = base;
    const r = threeWayMerge(base, current, target);
    expect(r.outcome).toBe("clean-merge");
    expect(r.mergedContent).toBe(current);
    expect(r.userEditDetected).toBe(true);
    expect(r.conflicts).toHaveLength(0);
  });

  it("only target modified → clean-merge, mergedContent=target", () => {
    const base = "a\nb\nc";
    const current = base;
    const target = "a\nb-new\nc";
    const r = threeWayMerge(base, current, target);
    expect(r.outcome).toBe("clean-merge");
    expect(r.mergedContent).toBe(target);
    expect(r.userEditDetected).toBe(false);
    expect(r.conflicts).toHaveLength(0);
  });

  it("both sides apply identical change → clean-merge", () => {
    const base = "a\nb\nc";
    const same = "a\nX\nc";
    const r = threeWayMerge(base, same, same);
    expect(r.outcome).toBe("clean-merge");
    expect(r.mergedContent).toBe(same);
    expect(r.conflicts).toHaveLength(0);
  });

  it("disjoint hunks merge cleanly", () => {
    const base = "line1\nline2\nline3\nline4\nline5";
    const current = "line1\nline2-CUR\nline3\nline4\nline5";
    const target = "line1\nline2\nline3\nline4-TGT\nline5";
    const r = threeWayMerge(base, current, target);
    expect(r.outcome).toBe("clean-merge");
    expect(r.mergedContent).toBe(
      "line1\nline2-CUR\nline3\nline4-TGT\nline5",
    );
    expect(r.conflicts).toHaveLength(0);
  });

  it("overlapping divergent hunks → conflict-markers", () => {
    const base = "a\nb\nc\nd";
    const current = "a\nCUR1\nCUR2\nd";
    const target = "a\nTGT1\nTGT2\nd";
    const r = threeWayMerge(base, current, target);
    expect(r.outcome).toBe("conflict-markers");
    expect(r.conflicts.length).toBeGreaterThan(0);
    expect(r.mergedContent).toContain("<<<<<<< current");
    expect(r.mergedContent).toContain("||||||| base");
    expect(r.mergedContent).toContain("=======");
    expect(r.mergedContent).toContain(">>>>>>> target");
    expect(r.mergedContent).toContain("CUR1");
    expect(r.mergedContent).toContain("TGT1");
    expect(r.userEditDetected).toBe(true);
  });

  it("conflict block carries correct hunks", () => {
    const base = "x\nold-middle\ny";
    const current = "x\nuser-middle\ny";
    const target = "x\nupstream-middle\ny";
    const r = threeWayMerge(base, current, target);
    expect(r.outcome).toBe("conflict-markers");
    expect(r.conflicts).toHaveLength(1);
    const c = r.conflicts[0];
    expect(c.baseHunk).toEqual(["old-middle"]);
    expect(c.currentHunk).toEqual(["user-middle"]);
    expect(c.targetHunk).toEqual(["upstream-middle"]);
  });

  it("delete-case: current===base and target==='' → clean-merge, merged=''", () => {
    const base = "some\ncontent\nhere";
    const r = threeWayMerge(base, base, "");
    expect(r.outcome).toBe("clean-merge");
    expect(r.mergedContent).toBe("");
    expect(r.userEditDetected).toBe(false);
    expect(r.conflicts).toHaveLength(0);
  });

  it("delete-case: current!==base and target==='' → kept-user", () => {
    const base = "original\ntext";
    const current = "original\ntext-edited";
    const r = threeWayMerge(base, current, "");
    expect(r.outcome).toBe("kept-user");
    expect(r.mergedContent).toBe(current);
    expect(r.userEditDetected).toBe(true);
    expect(r.conflicts).toHaveLength(0);
  });

  it("all empty strings → identical", () => {
    const r = threeWayMerge("", "", "");
    expect(r.outcome).toBe("identical");
    expect(r.mergedContent).toBe("");
  });

  it("only current has appended lines (end-of-file insertion)", () => {
    const base = "a\nb";
    const current = "a\nb\nc";
    const target = base;
    const r = threeWayMerge(base, current, target);
    expect(r.outcome).toBe("clean-merge");
    expect(r.mergedContent).toBe("a\nb\nc");
  });
});
