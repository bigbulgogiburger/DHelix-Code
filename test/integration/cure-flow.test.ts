/**
 * Integration test — /cure full happy path.
 *
 * Sets up a fake transcript + artifact files + DHELIX.md marker block,
 * then:
 *   1. Runs `createCure(defaultCureFacadeDeps())` with `dryRun: true` —
 *      asserts no fs mutation.
 *   2. Runs again with `dryRun: false` and `approvalMode: "auto"` —
 *      asserts files deleted, marker removed, I-9 (user area) preserved.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createCure,
  defaultCureFacadeDeps,
} from "../../src/recombination/cure/index.js";
import { __resetReentrantForTests } from "../../src/recombination/lock.js";
import {
  CONSTITUTION_FILE,
  RECOMBINATION_AUDIT_LOG,
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../../src/recombination/types.js";
import type {
  CureOptions,
  RecombinationTranscript,
} from "../../src/recombination/types.js";
import type { PlasmidId } from "../../src/plasmids/types.js";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-cure-flow-"));
  __resetReentrantForTests();
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
  __resetReentrantForTests();
});

async function seedFixture(): Promise<{
  readonly artifactPath: string;
  readonly marker: string;
  readonly userPrefix: string;
  readonly userSuffix: string;
}> {
  const artifactDir = join(workdir, ".dhelix", "agents");
  await mkdir(artifactDir, { recursive: true });
  const artifactPath = join(artifactDir, "foo.md");
  const artifactContent = "# Agent body\nhello world\n";
  await writeFile(artifactPath, artifactContent);

  const marker = "foo/agent";
  const userPrefix = "# User Rules\nAlways follow these rules.\n";
  const userSuffix = "# Keep This\nAnother user section.\n";
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

  const transcript: RecombinationTranscript = {
    id: "2026-04-24T12-00-00Z-test",
    startedAt: "2026-04-24T12:00:00.000Z",
    finishedAt: new Date().toISOString(),
    mode: "extend",
    model: "gpt-4o",
    strategies: {
      interpreter: "single-pass",
      compression: "abstractive",
      reorgFallback: "llm-only",
      validationVolume: "standard",
      validationParallelism: 10,
      gradingTiers: ["deterministic", "semi", "llm"],
      passThresholds: { L1: 0.95, L2: 0.8, L3: 0.7, L4: 0.6 },
      projectProfile: "full-llm",
      artifactGeneration: "template-and-llm",
      interpreterRetries: 1,
    },
    activePlasmidIds: ["foo" as PlasmidId],
    stages: [],
    writtenFiles: [
      {
        path: artifactPath,
        contentHash: sha256(artifactContent),
        bytes: artifactContent.length,
        op: "create",
      },
    ],
    reorgMarkerIds: [marker],
    wiring: { findings: [], errorCount: 0, warnCount: 0, infoCount: 0, passed: true },
    cacheHits: 0,
    cacheMisses: 0,
  };
  const transcriptsDir = join(workdir, RECOMBINATION_TRANSCRIPTS_DIR);
  await mkdir(transcriptsDir, { recursive: true });
  await writeFile(
    join(transcriptsDir, `${transcript.id}.json`),
    JSON.stringify(transcript, null, 2) + "\n",
    "utf-8",
  );

  return { artifactPath, marker, userPrefix, userSuffix };
}

describe("cure-flow integration", () => {
  it("dry-run preserves all state; auto run reverses changes and preserves I-9", async () => {
    const { artifactPath, marker, userPrefix, userSuffix } = await seedFixture();
    const execute = createCure(defaultCureFacadeDeps());

    // --- Pass 1: dry-run ---
    const dryOptions: CureOptions = {
      workingDirectory: workdir,
      mode: { kind: "latest" },
      dryRun: true,
    };
    const before = await readFile(join(workdir, CONSTITUTION_FILE), "utf-8");
    const dryResult = await execute(dryOptions);
    const afterDryConst = await readFile(join(workdir, CONSTITUTION_FILE), "utf-8");

    expect(dryResult.executed).toBe(false);
    expect(dryResult.plan.steps.length).toBeGreaterThan(0);
    expect(afterDryConst).toBe(before);
    // artifact file still present
    const st = await stat(artifactPath);
    expect(st.isFile()).toBe(true);

    // --- Pass 2: auto execute ---
    const runOptions: CureOptions = {
      workingDirectory: workdir,
      mode: { kind: "latest" },
      dryRun: false,
      approvalMode: "auto",
    };
    const runResult = await execute(runOptions);
    expect(runResult.executed).toBe(true);
    expect(runResult.errorCode).toBeUndefined();
    expect(runResult.filesDeleted).toContain(artifactPath);
    expect(runResult.markersRemoved).toContain(marker);

    // artifact removed
    await expect(stat(artifactPath)).rejects.toThrow();

    // marker gone; user area preserved
    const finalConst = await readFile(join(workdir, CONSTITUTION_FILE), "utf-8");
    expect(finalConst).not.toContain(`plasmid-derived: ${marker}`);
    expect(finalConst).toContain("Always follow these rules.");
    expect(finalConst).toContain("Another user section.");

    // audit line appended
    const audit = await readFile(join(workdir, RECOMBINATION_AUDIT_LOG), "utf-8");
    expect(audit).toMatch(/\tcure\t/);
    expect(audit).toContain("filesDeleted=1");
    expect(audit).toContain("markersRemoved=1");

    // Reference userPrefix/userSuffix variables so TS doesn't warn.
    expect(userPrefix.length).toBeGreaterThan(0);
    expect(userSuffix.length).toBeGreaterThan(0);
  });
});
