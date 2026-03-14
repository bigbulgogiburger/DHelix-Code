import { describe, it, expect } from "vitest";
import { cleanOrphanedWorktrees } from "../../../src/subagents/spawner.js";

describe("worktree management", () => {
  it("cleanOrphanedWorktrees should return 0 when no worktrees exist", async () => {
    const cleaned = await cleanOrphanedWorktrees("/nonexistent");
    expect(cleaned).toBe(0);
  });
});
