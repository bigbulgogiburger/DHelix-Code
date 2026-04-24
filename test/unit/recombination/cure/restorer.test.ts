/**
 * Unit tests for `src/recombination/cure/restorer.ts`.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { restoreCure } from "../../../../src/recombination/cure/restorer.js";
import { __resetReentrantForTests } from "../../../../src/recombination/lock.js";
import {
  CONSTITUTION_FILE,
  PLASMIDS_ARCHIVE_DIR,
  RECOMBINATION_AUDIT_LOG,
} from "../../../../src/recombination/types.js";
import type { CurePlan, CureOptions } from "../../../../src/recombination/types.js";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-cure-restore-"));
  __resetReentrantForTests();
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
  __resetReentrantForTests();
});

function mkOptions(overrides: Partial<CureOptions> = {}): CureOptions {
  return {
    workingDirectory: workdir,
    mode: { kind: "latest" },
    dryRun: false,
    ...overrides,
  };
}

describe("restoreCure", () => {
  it("dry-run: returns unexecuted, no fs mutation", async () => {
    const filePath = join(workdir, "a.md");
    await writeFile(filePath, "content");
    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [{ kind: "delete-file", path: filePath, expectedHash: sha256("content") }],
      warnings: [],
      preview: "preview",
    };
    const result = await restoreCure({
      options: mkOptions({ dryRun: true }),
      plan,
    });
    expect(result.executed).toBe(false);
    expect(result.filesDeleted).toHaveLength(0);
    const st = await stat(filePath); // still present
    expect(st.isFile()).toBe(true);
  });

  it("deletes files and records them", async () => {
    const filePath = join(workdir, "a.md");
    const content = "hello world";
    await writeFile(filePath, content);

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [{ kind: "delete-file", path: filePath, expectedHash: sha256(content) }],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.executed).toBe(true);
    expect(result.filesDeleted).toEqual([filePath]);
    await expect(stat(filePath)).rejects.toThrow();
  });

  it("CURE_CONFLICT on hash mismatch with approvalMode=interactive", async () => {
    const filePath = join(workdir, "a.md");
    await writeFile(filePath, "actual content");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: filePath,
          expectedHash: sha256("expected content"),
        },
      ],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({
      options: mkOptions({ approvalMode: "interactive" }),
      plan,
    });
    expect(result.executed).toBe(false);
    expect(result.errorCode).toBe("CURE_CONFLICT");
    // file still present
    const st = await stat(filePath);
    expect(st.isFile()).toBe(true);
  });

  it("approvalMode=auto bypasses the conflict check", async () => {
    const filePath = join(workdir, "a.md");
    await writeFile(filePath, "actual");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: filePath,
          expectedHash: sha256("expected"),
        },
      ],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({
      options: mkOptions({ approvalMode: "auto" }),
      plan,
    });
    expect(result.executed).toBe(true);
    expect(result.filesDeleted).toEqual([filePath]);
  });

  it("expectedHash='' auto-proceeds (Phase-2 legacy compat)", async () => {
    const filePath = join(workdir, "a.md");
    await writeFile(filePath, "actual");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: filePath,
          expectedHash: "",
        },
      ],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({
      options: mkOptions({ approvalMode: "interactive" }),
      plan,
    });
    expect(result.executed).toBe(true);
  });

  it("removes markers from DHELIX.md and preserves user content (I-9)", async () => {
    const marker = "foo/bar";
    const constitutionSource = [
      "# User Rules",
      "Always follow these rules.",
      "",
      `<!-- BEGIN plasmid-derived: ${marker} -->`,
      "# Injected",
      "body-line",
      `<!-- END plasmid-derived: ${marker} -->`,
      "",
      "# Keep This",
      "Another user section.",
      "",
    ].join("\n");
    await writeFile(join(workdir, CONSTITUTION_FILE), constitutionSource);

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [{ kind: "remove-marker", markerId: marker }],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.executed).toBe(true);
    expect(result.markersRemoved).toContain(marker);

    const after = await readFile(join(workdir, CONSTITUTION_FILE), "utf-8");
    expect(after).not.toContain(`plasmid-derived: ${marker}`);
    expect(after).toContain("Always follow these rules.");
    expect(after).toContain("Another user section.");
  });

  it("removes marker is a no-op when the marker is not present", async () => {
    const constitutionSource = "# Just user\n";
    await writeFile(join(workdir, CONSTITUTION_FILE), constitutionSource);

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [{ kind: "remove-marker", markerId: "missing/x" }],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.executed).toBe(true);
    // Markers recorded even if they weren't physically present (applyPlan skips silently).
    expect(result.markersRemoved).toContain("missing/x");
    const after = await readFile(join(workdir, CONSTITUTION_FILE), "utf-8");
    expect(after).toBe(constitutionSource);
  });

  it("archives plasmid directory (move, not delete — I-1)", async () => {
    const plasmidDir = join(workdir, ".dhelix", "plasmids", "foo");
    await mkdir(plasmidDir, { recursive: true });
    await writeFile(join(plasmidDir, "foo.md"), "# plasmid body");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        { kind: "archive-plasmid", plasmidId: "foo" as PlasmidId },
        { kind: "clear-refs", plasmidId: "foo" as PlasmidId },
      ],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.plasmidsArchived).toContain("foo" as PlasmidId);

    // Original location gone.
    await expect(stat(plasmidDir)).rejects.toThrow();

    // Some timestamped entry exists under archive/.
    const { readdir } = await import("node:fs/promises");
    const archiveEntries = await readdir(join(workdir, PLASMIDS_ARCHIVE_DIR));
    expect(archiveEntries.some((name) => name.startsWith("foo-"))).toBe(true);
  });

  it("aborts when signal already aborted before deletions", async () => {
    const filePath = join(workdir, "a.md");
    await writeFile(filePath, "x");
    const controller = new AbortController();
    controller.abort();

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        { kind: "delete-file", path: filePath, expectedHash: "" },
      ],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({
      options: { ...mkOptions(), signal: controller.signal },
      plan,
    });
    expect(result.executed).toBe(false);
    expect(result.errorCode).toBe("CURE_ABORTED");
    // file untouched
    const st = await stat(filePath);
    expect(st.isFile()).toBe(true);
  });

  it("idempotent delete: missing target files do not raise", async () => {
    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: join(workdir, "never-existed.md"),
          expectedHash: "deadbeef",
        },
      ],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.executed).toBe(true);
    expect(result.filesDeleted).toHaveLength(0);
  });

  it("archives plasmid with all steps (clear-refs also runs)", async () => {
    // Write ref first, then archive + clear
    const { writePlasmidRef } = await import(
      "../../../../src/recombination/cure/refs.js"
    );
    await writePlasmidRef(workdir, "bar" as PlasmidId, "t-1");

    const plasmidDir = join(workdir, ".dhelix", "plasmids", "bar");
    await mkdir(plasmidDir, { recursive: true });
    await writeFile(join(plasmidDir, "bar.md"), "# body");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        { kind: "archive-plasmid", plasmidId: "bar" as PlasmidId },
        { kind: "clear-refs", plasmidId: "bar" as PlasmidId },
      ],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.plasmidsArchived).toContain("bar" as PlasmidId);
    expect(result.errorCode).toBeUndefined();
  });

  it("aborts with CURE_ABORTED when DHELIX.md is malformed (unterminated marker)", async () => {
    // Unterminated BEGIN marker → parse() throws → caught as I-9 abort path.
    await writeFile(
      join(workdir, CONSTITUTION_FILE),
      "<!-- BEGIN plasmid-derived: foo/bar -->\nno-end\n",
    );
    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [{ kind: "remove-marker", markerId: "foo/bar" }],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.executed).toBe(false);
    expect(result.errorCode).toBe("CURE_ABORTED");
  });

  it("appends one audit line", async () => {
    const plan: CurePlan = {
      transcriptIds: ["t-1", "t-2"],
      steps: [],
      warnings: [],
      preview: "",
    };
    const result = await restoreCure({ options: mkOptions(), plan });
    expect(result.executed).toBe(true);

    const audit = await readFile(join(workdir, RECOMBINATION_AUDIT_LOG), "utf-8");
    expect(audit).toMatch(/\tcure\t/);
    expect(audit).toContain("t-1,t-2");
    expect(audit).toContain("filesDeleted=0");
    expect(audit).toContain("markersRemoved=0");
  });
});
