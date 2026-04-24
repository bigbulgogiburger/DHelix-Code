/**
 * Unit tests for `src/commands/cure/extend.ts`.
 */
import { describe, expect, it, vi } from "vitest";

import type { CommandContext } from "../../../../src/commands/registry.js";
import { runCure } from "../../../../src/commands/cure/extend.js";
import type {
  CureOptions,
  CurePlan,
  CureResult,
} from "../../../../src/recombination/types.js";

function makeContext(): CommandContext {
  return {
    workingDirectory: "/tmp/project",
    model: "gpt-4o",
    sessionId: "sess-1",
    emit: () => {},
  };
}

function fakePlan(): CurePlan {
  return {
    transcriptIds: ["t-1"],
    steps: [],
    warnings: [],
    preview: "preview-text",
  };
}

function fakeResult(executed: boolean, overrides: Partial<CureResult> = {}): CureResult {
  return {
    plan: fakePlan(),
    executed,
    filesDeleted: [],
    markersRemoved: [],
    plasmidsArchived: [],
    ...overrides,
  };
}

describe("makeCureCommand (index.ts)", () => {
  it("registers a SlashCommand with name='cure' and dispatches", async () => {
    const { makeCureCommand, cureCommand } = await import(
      "../../../../src/commands/cure/index.js"
    );
    expect(cureCommand.name).toBe("cure");

    const executeCure = vi.fn().mockResolvedValue({
      plan: {
        transcriptIds: ["t-1"],
        steps: [],
        warnings: [],
        preview: "p",
      },
      executed: true,
      filesDeleted: [],
      markersRemoved: [],
      plasmidsArchived: [],
    });
    const cmd = makeCureCommand({ executeCure });
    const result = await cmd.execute("--yes", makeContext());
    expect(result.success).toBe(true);
    expect(executeCure).toHaveBeenCalled();
  });

  it("tokenizes multi-word args and strips extras", async () => {
    const { makeCureCommand } = await import(
      "../../../../src/commands/cure/index.js"
    );
    const executeCure = vi.fn().mockResolvedValue({
      plan: { transcriptIds: ["t"], steps: [], warnings: [], preview: "" },
      executed: true,
      filesDeleted: [],
      markersRemoved: [],
      plasmidsArchived: [],
    });
    const cmd = makeCureCommand(() => ({ executeCure }));
    const result = await cmd.execute("  --yes   --purge ", makeContext());
    expect(result.success).toBe(true);
    const opts = executeCure.mock.calls[0][0];
    expect(opts.purge).toBe(true);
  });

  it("empty args still invokes in preview mode", async () => {
    const { makeCureCommand } = await import(
      "../../../../src/commands/cure/index.js"
    );
    const executeCure = vi.fn().mockResolvedValue({
      plan: { transcriptIds: [], steps: [], warnings: [], preview: "" },
      executed: false,
      filesDeleted: [],
      markersRemoved: [],
      plasmidsArchived: [],
    });
    const cmd = makeCureCommand({ executeCure });
    const result = await cmd.execute("", makeContext());
    expect(executeCure).toHaveBeenCalledTimes(1);
    expect(result.output).toMatch(/Run with --yes/);
  });
});

describe("runCure — flag parsing", () => {
  it("defaults to mode=latest with interactive approval (preview only)", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(false));
    const result = await runCure([], makeContext(), { executeCure });
    expect(executeCure).toHaveBeenCalledTimes(1);
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.mode).toEqual({ kind: "latest" });
    expect(opts.dryRun).toBe(true); // preview path forces dryRun:true
    expect(opts.approvalMode).toBe("interactive");
    expect(result.output).toMatch(/Run with --yes/);
    expect(result.success).toBe(true);
  });

  it("--all sets mode=all", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(true));
    await runCure(["--all", "--yes"], makeContext(), { executeCure });
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.mode).toEqual({ kind: "all" });
    expect(opts.approvalMode).toBe("auto");
  });

  it("--transcript <id> sets mode=transcript", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(true));
    await runCure(
      ["--transcript", "abc-123", "--yes"],
      makeContext(),
      { executeCure },
    );
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.mode).toEqual({ kind: "transcript", id: "abc-123" });
  });

  it("--transcript=<id> equal-form works", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(true));
    await runCure(["--transcript=xyz", "--yes"], makeContext(), { executeCure });
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.mode).toEqual({ kind: "transcript", id: "xyz" });
  });

  it("--plasmid <id> sets mode=plasmid", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(true));
    await runCure(
      ["--plasmid", "foo", "--yes"],
      makeContext(),
      { executeCure },
    );
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.mode.kind).toBe("plasmid");
  });

  it("--purge propagates into opts", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(true));
    await runCure(["--purge", "--yes"], makeContext(), { executeCure });
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.purge).toBe(true);
  });

  it("--dry-run sets dryRun=true", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(false));
    await runCure(["--dry-run"], makeContext(), { executeCure });
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.dryRun).toBe(true);
  });

  it("-y alias of --yes", async () => {
    const executeCure = vi.fn().mockResolvedValue(fakeResult(true));
    await runCure(["-y"], makeContext(), { executeCure });
    const opts = executeCure.mock.calls[0][0] as CureOptions;
    expect(opts.approvalMode).toBe("auto");
  });

  it("rejects multiple mode selectors", async () => {
    const executeCure = vi.fn();
    const result = await runCure(
      ["--all", "--transcript", "abc"],
      makeContext(),
      { executeCure },
    );
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/At most one/);
    expect(executeCure).not.toHaveBeenCalled();
  });

  it("rejects unknown flags", async () => {
    const executeCure = vi.fn();
    const result = await runCure(["--nope"], makeContext(), { executeCure });
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/Unknown flag/);
    expect(executeCure).not.toHaveBeenCalled();
  });

  it("rejects --transcript without value", async () => {
    const executeCure = vi.fn();
    const result = await runCure(["--transcript"], makeContext(), { executeCure });
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/--transcript requires/);
  });
});

describe("runCure — execution paths", () => {
  it("yes + no dry-run → executes and renders report", async () => {
    const executeCure = vi.fn().mockResolvedValue(
      fakeResult(true, { filesDeleted: ["/tmp/foo.md"] }),
    );
    const result = await runCure(["--yes"], makeContext(), { executeCure });
    expect(executeCure).toHaveBeenCalledTimes(1);
    expect(result.output).toMatch(/\/cure — restored/);
    expect(result.success).toBe(true);
  });

  it("surfaces CURE_CONFLICT error code as failure", async () => {
    const executeCure = vi.fn().mockResolvedValue(
      fakeResult(false, {
        errorCode: "CURE_CONFLICT",
        errorMessage: "hash mismatch",
      }),
    );
    const result = await runCure(["--yes"], makeContext(), { executeCure });
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/CURE_CONFLICT/);
  });

  it("catches thrown errors and formats them", async () => {
    const executeCure = vi.fn().mockRejectedValue(
      Object.assign(new Error("no transcript"), { code: "CURE_NO_TRANSCRIPT" }),
    );
    const result = await runCure(["--yes"], makeContext(), { executeCure });
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/CURE_NO_TRANSCRIPT/);
  });
});
