import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandContext } from "../../../src/commands/registry.js";

// Mock child_process before importing the module under test
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { diffCommand } from "../../../src/commands/diff.js";

const mockedExecSync = vi.mocked(execSync);

const baseContext: CommandContext = {
  workingDirectory: "/tmp/test-repo",
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/diff enhanced command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct metadata", () => {
    expect(diffCommand.name).toBe("diff");
    expect(diffCommand.description).toBeDefined();
    expect(diffCommand.usage).toBe("/diff [file path]");
    expect(diffCommand.execute).toBeTypeOf("function");
  });

  it("should return error when not in a git repo", async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error("fatal: not a git repository");
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Not a git repository");
  });

  it("should show 'No changes detected.' when there are no changes", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      // Return empty string for all diff commands
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toBe("No changes detected.");
  });

  it("should show 'No changes detected for: <file>' when targeting a file with no changes", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      return "";
    });

    const result = await diffCommand.execute("src/index.ts", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toBe("No changes detected for: src/index.ts");
  });

  it("should display unstaged changes correctly", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--cached")) return "";
      if (cmd.includes("--numstat")) {
        return "40\t2\tsrc/commands/doctor.ts\n25\t3\tsrc/core/agent-loop.ts";
      }
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Changes in working directory");
    expect(result.output).toContain("=============================");
    expect(result.output).toContain("Modified: 2 files (+65, -5)");
    expect(result.output).toContain("Unstaged:");
    expect(result.output).toContain("src/commands/doctor.ts");
    expect(result.output).toContain("(+40, -2)");
    expect(result.output).toContain("src/core/agent-loop.ts");
    expect(result.output).toContain("(+25, -3)");
    expect(result.output).toContain("Total: 2 files, +65 / -5");
    // Should NOT contain "Staged:" section
    expect(result.output).not.toContain("Staged:");
  });

  it("should display staged changes correctly", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--cached") && cmd.includes("--numstat")) {
        return "30\t0\tsrc/commands/bug.ts";
      }
      if (cmd.includes("--numstat")) return "";
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Modified: 1 file (+30, -0)");
    expect(result.output).toContain("Staged:");
    expect(result.output).toContain("src/commands/bug.ts");
    expect(result.output).toContain("(+30)");
    // Should NOT contain "Unstaged:" section
    expect(result.output).not.toContain("Unstaged:");
  });

  it("should display both unstaged and staged changes", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--cached") && cmd.includes("--numstat")) {
        return "30\t0\tsrc/commands/bug.ts";
      }
      if (cmd.includes("--numstat")) {
        return "40\t2\tsrc/commands/doctor.ts\n25\t3\tsrc/core/agent-loop.ts";
      }
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Modified: 3 files (+95, -5)");
    expect(result.output).toContain("Unstaged:");
    expect(result.output).toContain("Staged:");
    expect(result.output).toContain("Total: 3 files, +95 / -5");
  });

  it("should pass file argument to git diff commands", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--numstat") && cmd.includes("-- src/index.ts")) {
        if (cmd.includes("--cached")) return "";
        return "10\t5\tsrc/index.ts";
      }
      return "";
    });

    const result = await diffCommand.execute("src/index.ts", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("src/index.ts");
    expect(result.output).toContain("(+10, -5)");

    // Verify that git commands include the file argument
    const calls = mockedExecSync.mock.calls.map((c) => String(c[0]));
    const numstatCalls = calls.filter((c) => c.includes("--numstat"));
    for (const call of numstatCalls) {
      expect(call).toContain("-- src/index.ts");
    }
  });

  it("should use the correct working directory from context", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      return "";
    });

    await diffCommand.execute("", baseContext);

    // All calls should use the context's working directory
    for (const call of mockedExecSync.mock.calls) {
      const opts = call[1] as { cwd?: string };
      expect(opts.cwd).toBe("/tmp/test-repo");
    }
  });

  it("should handle binary files (- in numstat)", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--cached")) return "";
      if (cmd.includes("--numstat")) {
        return "-\t-\timage.png";
      }
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("image.png");
    expect(result.output).toContain("Modified: 1 file (+0, -0)");
  });

  it("should handle git diff failure gracefully", async () => {
    let callCount = 0;
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      // Simulate git diff failure by throwing
      throw new Error("git diff failed");
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    // When both diffs fail (return null -> empty), should show no changes
    expect(result.output).toBe("No changes detected.");
  });

  it("should handle singular file count correctly", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--cached")) return "";
      if (cmd.includes("--numstat")) {
        return "5\t2\tsrc/single.ts";
      }
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Modified: 1 file (+5, -2)");
    expect(result.output).toContain("Total: 1 file, +5 / -2");
    // Verify singular form (no trailing "s")
    expect(result.output).not.toContain("1 files");
  });

  it("should deduplicate files that appear in both staged and unstaged", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--cached") && cmd.includes("--numstat")) {
        return "10\t0\tsrc/shared.ts";
      }
      if (cmd.includes("--numstat")) {
        return "5\t2\tsrc/shared.ts";
      }
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    // Same file in both staged and unstaged: total files should be 1
    expect(result.output).toContain("Modified: 1 file (+15, -2)");
    expect(result.output).toContain("Unstaged:");
    expect(result.output).toContain("Staged:");
  });

  it("should show only additions when deletions are 0", async () => {
    mockedExecSync.mockImplementation((command: string) => {
      const cmd = String(command);
      if (cmd.includes("rev-parse")) return "true";
      if (cmd.includes("--cached")) return "";
      if (cmd.includes("--numstat")) {
        return "20\t0\tsrc/new-feature.ts";
      }
      return "";
    });

    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("(+20)");
    // Should not contain "-0" in the per-file stats
    expect(result.output).toMatch(/src\/new-feature\.ts\s+\(\+20\)/);
  });
});
