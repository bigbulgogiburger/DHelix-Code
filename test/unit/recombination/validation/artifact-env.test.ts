/**
 * Unit tests for src/recombination/validation/artifact-env.ts.
 *
 * Covers:
 *   - symlink mode mirrors the 5 artifact dirs (posix only)
 *   - .dhelix/plasmids and .dhelix/recombination are NEVER mirrored (I-8)
 *   - prompt-sections/generated/*.md + DHELIX.md are copied (not symlinked)
 *   - cleanup removes the workspace
 *   - copy-fallback path exercised by patching process.platform
 *   - missing source dirs are tolerated (no ENOENT throw)
 */
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildArtifactEnv } from "../../../../src/recombination/validation/artifact-env.js";

async function makeProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dhelix-proj-"));
  // Populate all 5 artifact dirs with a marker file each.
  const dirs = [
    ".dhelix/agents",
    ".dhelix/skills",
    ".dhelix/commands",
    ".dhelix/hooks",
    ".dhelix/rules",
  ];
  for (const d of dirs) {
    await fs.mkdir(path.join(root, d), { recursive: true });
    await fs.writeFile(path.join(root, d, "marker.md"), `# ${d}\n`, "utf8");
  }
  // Populate forbidden dirs to verify they are NOT mirrored.
  await fs.mkdir(path.join(root, ".dhelix/plasmids/p1"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".dhelix/plasmids/p1/body.md"),
    "plasmid-secret",
    "utf8",
  );
  await fs.mkdir(path.join(root, ".dhelix/recombination/transcripts"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".dhelix/recombination/transcripts/t.json"),
    "{}",
    "utf8",
  );
  // Prompt sections + DHELIX.md
  await fs.mkdir(path.join(root, ".dhelix/prompt-sections/generated"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, ".dhelix/prompt-sections/generated/60-principles.md"),
    "principles",
    "utf8",
  );
  // non-md file should NOT be copied
  await fs.writeFile(
    path.join(root, ".dhelix/prompt-sections/generated/ignore.txt"),
    "nope",
    "utf8",
  );
  await fs.writeFile(path.join(root, "DHELIX.md"), "# constitution", "utf8");
  return root;
}

describe("buildArtifactEnv", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProject();
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("mirrors 5 artifact dirs + copies prompt-sections md + DHELIX.md; excludes I-8 dirs", async () => {
    const env = await buildArtifactEnv({
      workingDirectory: projectRoot,
      transcriptId: "2026-04-24T00-00-00",
      artifacts: [],
      writtenFiles: [],
    });
    try {
      expect(env.workspaceRoot).toContain("dhelix-val-");
      // Mirrored artifact dirs exist.
      for (const d of [".dhelix/agents", ".dhelix/skills", ".dhelix/commands", ".dhelix/hooks", ".dhelix/rules"]) {
        const marker = path.join(env.workspaceRoot, d, "marker.md");
        await expect(fs.readFile(marker, "utf8")).resolves.toContain("#");
      }
      // Forbidden dirs NOT present.
      await expect(
        fs.access(path.join(env.workspaceRoot, ".dhelix/plasmids")),
      ).rejects.toBeDefined();
      await expect(
        fs.access(path.join(env.workspaceRoot, ".dhelix/recombination")),
      ).rejects.toBeDefined();
      // Prompt sections — md copied, txt NOT copied.
      await expect(
        fs.readFile(
          path.join(env.workspaceRoot, ".dhelix/prompt-sections/generated/60-principles.md"),
          "utf8",
        ),
      ).resolves.toBe("principles");
      await expect(
        fs.access(
          path.join(env.workspaceRoot, ".dhelix/prompt-sections/generated/ignore.txt"),
        ),
      ).rejects.toBeDefined();
      // DHELIX.md copied.
      await expect(
        fs.readFile(path.join(env.workspaceRoot, "DHELIX.md"), "utf8"),
      ).resolves.toBe("# constitution");
      // scratch exists and is empty.
      const scratchEntries = await fs.readdir(path.join(env.workspaceRoot, "scratch"));
      expect(scratchEntries).toEqual([]);
      // mode selection matches platform.
      expect(env.mode).toBe(process.platform === "win32" ? "copy" : "symlink");
    } finally {
      await env.cleanup();
    }
  });

  it("symlink mode uses symlinks for the 5 artifact dirs (posix)", async () => {
    if (process.platform === "win32") return; // skip on windows CI
    const env = await buildArtifactEnv({
      workingDirectory: projectRoot,
      transcriptId: "tx-sym",
      artifacts: [],
      writtenFiles: [],
    });
    try {
      const stat = await fs.lstat(path.join(env.workspaceRoot, ".dhelix/agents"));
      expect(stat.isSymbolicLink()).toBe(true);
      // But prompt-sections/generated is a REAL directory (copied).
      const promptStat = await fs.lstat(
        path.join(env.workspaceRoot, ".dhelix/prompt-sections/generated"),
      );
      expect(promptStat.isSymbolicLink()).toBe(false);
      expect(promptStat.isDirectory()).toBe(true);
    } finally {
      await env.cleanup();
    }
  });

  it("tolerates missing artifact dirs (empty project)", async () => {
    const emptyProj = await fs.mkdtemp(path.join(os.tmpdir(), "dhelix-empty-"));
    try {
      const env = await buildArtifactEnv({
        workingDirectory: emptyProj,
        transcriptId: "tx-empty",
        artifacts: [],
        writtenFiles: [],
      });
      try {
        // scratch still exists.
        await expect(
          fs.readdir(path.join(env.workspaceRoot, "scratch")),
        ).resolves.toEqual([]);
        // None of the 5 dirs exist.
        for (const d of [".dhelix/agents", ".dhelix/skills"]) {
          await expect(
            fs.access(path.join(env.workspaceRoot, d)),
          ).rejects.toBeDefined();
        }
      } finally {
        await env.cleanup();
      }
    } finally {
      await fs.rm(emptyProj, { recursive: true, force: true });
    }
  });

  it("cleanup is idempotent", async () => {
    const env = await buildArtifactEnv({
      workingDirectory: projectRoot,
      transcriptId: "tx-clean",
      artifacts: [],
      writtenFiles: [],
    });
    await env.cleanup();
    // Second call must NOT throw.
    await expect(env.cleanup()).resolves.toBeUndefined();
    // Workspace root must be gone.
    await expect(fs.access(env.workspaceRoot)).rejects.toBeDefined();
  });

  it("aborts early when signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort(new Error("pre-aborted"));
    await expect(
      buildArtifactEnv({
        workingDirectory: projectRoot,
        transcriptId: "tx-abort",
        artifacts: [],
        writtenFiles: [],
        signal: ctrl.signal,
      }),
    ).rejects.toThrow(/pre-aborted/);
  });

  it("sanitizes transcriptId with unsafe characters into the dir name", async () => {
    const env = await buildArtifactEnv({
      workingDirectory: projectRoot,
      transcriptId: "a/b:c d",
      artifacts: [],
      writtenFiles: [],
    });
    try {
      const base = path.basename(env.workspaceRoot);
      expect(base).not.toContain("/");
      expect(base).not.toContain(":");
      expect(base).not.toContain(" ");
      expect(base.startsWith("dhelix-val-")).toBe(true);
    } finally {
      await env.cleanup();
    }
  });
});

describe("buildArtifactEnv — copy-mode branch (win32 simulation)", () => {
  const original = Object.getOwnPropertyDescriptor(process, "platform");

  afterEach(() => {
    if (original) Object.defineProperty(process, "platform", original);
  });

  it("deep-copies artifact dirs when platform === win32", async () => {
    const projectRoot = await (async (): Promise<string> => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "dhelix-proj-win-"));
      await fs.mkdir(path.join(root, ".dhelix/agents/nested"), { recursive: true });
      await fs.writeFile(path.join(root, ".dhelix/agents/top.md"), "top", "utf8");
      await fs.writeFile(
        path.join(root, ".dhelix/agents/nested/deep.md"),
        "deep",
        "utf8",
      );
      return root;
    })();

    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      const env = await buildArtifactEnv({
        workingDirectory: projectRoot,
        transcriptId: "tx-win",
        artifacts: [],
        writtenFiles: [],
      });
      try {
        expect(env.mode).toBe("copy");
        // The mirrored dir must be a real directory (not a symlink).
        const stat = await fs.lstat(
          path.join(env.workspaceRoot, ".dhelix/agents"),
        );
        expect(stat.isSymbolicLink()).toBe(false);
        expect(stat.isDirectory()).toBe(true);
        await expect(
          fs.readFile(
            path.join(env.workspaceRoot, ".dhelix/agents/nested/deep.md"),
            "utf8",
          ),
        ).resolves.toBe("deep");
      } finally {
        await env.cleanup();
      }
    } finally {
      await fs.rm(projectRoot, { recursive: true, force: true });
    }
  });
});
