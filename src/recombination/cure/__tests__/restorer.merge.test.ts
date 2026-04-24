/**
 * Integration tests for `restoreCure` + 3-way merge (Team 4 Phase 4).
 *
 * Sets up a real temp-dir project with:
 *   - a fake artifact at <cwd>/DHELIX.md (or similar) written on disk
 *   - a fake base blob under .dhelix/recombination/objects/<hash>
 *   - a CurePlan with a `delete-file` step whose expectedHash matches the
 *     blob hash (but not the on-disk content, to simulate a user edit)
 * Then calls `restoreCure` with `mergeMode: "auto" | "keep-user" | "block"`
 * and asserts the resulting on-disk state + the result envelope.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetReentrantForTests } from "../../lock.js";
import { objectStorePath } from "../../types.js";
import type {
  CureOptions,
  CurePlan,
  ThreeWayMergeMode,
} from "../../types.js";
import { restoreCure } from "../restorer.js";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function writeBlob(
  cwd: string,
  hash: string,
  body: string,
): Promise<void> {
  const path = objectStorePath(cwd, hash);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf-8");
}

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-cure-merge-"));
  __resetReentrantForTests();
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
  __resetReentrantForTests();
});

type MergeOptOverrides = Partial<CureOptions> & {
  readonly mergeMode?: ThreeWayMergeMode;
};

function mkOptions(overrides: MergeOptOverrides = {}): CureOptions {
  // Cast back to CureOptions — mergeMode is a Phase-4 extension read via
  // structural access inside restorer.ts.
  const { mergeMode, ...rest } = overrides;
  const base: CureOptions = {
    workingDirectory: workdir,
    mode: { kind: "latest" },
    dryRun: false,
    ...rest,
  };
  return mergeMode === undefined
    ? base
    : ({ ...base, mergeMode } as CureOptions);
}

describe("restoreCure — three-way merge integration", () => {
  it("mergeMode='auto' + matching hash → normal delete path (no merge needed)", async () => {
    // This case never enters the merge branch — hashOk=true short-circuits
    // to the unlink. It confirms mergeMode=auto doesn't regress the happy
    // path.
    const baseBody = "line1\nline2\nline3";
    const baseHash = sha256(baseBody);
    await writeBlob(workdir, baseHash, baseBody);
    const filePath = join(workdir, "artifact.md");
    await writeFile(filePath, baseBody, "utf-8");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        { kind: "delete-file", path: filePath, expectedHash: baseHash },
      ],
      warnings: [],
      preview: "",
    };

    const result = await restoreCure({
      options: mkOptions({ mergeMode: "auto" }),
      plan,
    });
    expect(result.executed).toBe(true);
    expect(result.filesDeleted).toEqual([filePath]);
    await expect(stat(filePath)).rejects.toThrow();
  });

  it("mergeMode='auto' + real user edit → keeps user file (no delete)", async () => {
    const baseBody = "alpha\nbeta\ngamma";
    const baseHash = sha256(baseBody);
    await writeBlob(workdir, baseHash, baseBody);

    // Disk file is edited → current hash != baseHash.
    const fileContent = "alpha\nUSER-EDIT\ngamma";
    const filePath = join(workdir, "artifact.md");
    await writeFile(filePath, fileContent, "utf-8");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: filePath,
          expectedHash: baseHash,
        },
      ],
      warnings: [],
      preview: "",
    };

    const result = await restoreCure({
      options: mkOptions({ mergeMode: "auto" }),
      plan,
    });
    expect(result.executed).toBe(true); // audit line written, but no files deleted
    expect(result.filesDeleted).toHaveLength(0);
    expect(result.errorCode).toBeUndefined();

    // File is preserved with user edits intact.
    const survived = await readFile(filePath, "utf-8");
    expect(survived).toBe(fileContent);
  });

  it("mergeMode='auto' with missing blob → safe fallback (keeps user file)", async () => {
    // No blob written → readBlob returns null.
    const unknownHash = sha256("never-stored");
    const fileContent = "user content";
    const filePath = join(workdir, "artifact.md");
    await writeFile(filePath, fileContent, "utf-8");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: filePath,
          expectedHash: unknownHash,
        },
      ],
      warnings: [],
      preview: "",
    };

    const result = await restoreCure({
      options: mkOptions({ mergeMode: "auto" }),
      plan,
    });
    expect(result.executed).toBe(true);
    expect(result.filesDeleted).toHaveLength(0);
    const survived = await readFile(filePath, "utf-8");
    expect(survived).toBe(fileContent);
  });

  it("mergeMode='keep-user' skips delete on hash mismatch (regardless of blob)", async () => {
    const fileContent = "user file";
    const filePath = join(workdir, "artifact.md");
    await writeFile(filePath, fileContent, "utf-8");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: filePath,
          expectedHash: sha256("something-else"),
        },
      ],
      warnings: [],
      preview: "",
    };

    const result = await restoreCure({
      options: mkOptions({ mergeMode: "keep-user" }),
      plan,
    });
    expect(result.executed).toBe(true);
    expect(result.filesDeleted).toHaveLength(0);
    expect(result.errorCode).toBeUndefined();
    const survived = await readFile(filePath, "utf-8");
    expect(survived).toBe(fileContent);
  });

  it("mergeMode='block' (default) still returns CURE_CONFLICT on hash mismatch", async () => {
    const fileContent = "user edit";
    const filePath = join(workdir, "artifact.md");
    await writeFile(filePath, fileContent, "utf-8");

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
      options: mkOptions({
        approvalMode: "interactive",
        mergeMode: "block",
      }),
      plan,
    });
    expect(result.executed).toBe(false);
    expect(result.errorCode).toBe("CURE_CONFLICT");
    const st = await stat(filePath);
    expect(st.isFile()).toBe(true);
  });

  it("mergeMode='auto' with divergent diff → writes conflict markers, keeps file", async () => {
    // base content → blob
    const baseBody = "x\nold\ny";
    const baseHash = sha256(baseBody);
    await writeBlob(workdir, baseHash, baseBody);

    // User rewrote the middle line. Because target is "" (delete), our merge
    // policy reports `kept-user` rather than conflict markers — but if the
    // user DELETED the middle line we still want the "kept-user" outcome.
    // To exercise the `conflict-markers` write branch requires a non-empty
    // target; Cure v1 deletes always have target="" so this scenario maps
    // to `kept-user`. We verify that explicitly here.
    const fileContent = "x\nuser-version\ny";
    const filePath = join(workdir, "artifact.md");
    await writeFile(filePath, fileContent, "utf-8");

    const plan: CurePlan = {
      transcriptIds: ["t-1"],
      steps: [
        {
          kind: "delete-file",
          path: filePath,
          expectedHash: baseHash,
        },
      ],
      warnings: [],
      preview: "",
    };

    const result = await restoreCure({
      options: mkOptions({ mergeMode: "auto" }),
      plan,
    });
    expect(result.filesDeleted).toHaveLength(0);
    const survived = await readFile(filePath, "utf-8");
    expect(survived).toBe(fileContent);
  });
});
