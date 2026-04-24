/**
 * Unit tests for `src/recombination/cure/edit-detector.ts`.
 */
import { createHash } from "node:crypto";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectManualEdits } from "../../../../src/recombination/cure/edit-detector.js";
import type {
  PipelineStrategies,
  RecombinationTranscript,
  WiringReport,
  WrittenFile,
} from "../../../../src/recombination/types.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function fakeTranscript(finishedAt: string): RecombinationTranscript {
  const strategies: PipelineStrategies = {
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
  };
  const wiring: WiringReport = {
    findings: [],
    errorCount: 0,
    warnCount: 0,
    infoCount: 0,
    passed: true,
  };
  return {
    id: "t-1",
    startedAt: finishedAt,
    finishedAt,
    mode: "extend",
    model: "gpt-4o",
    strategies,
    activePlasmidIds: [] as readonly PlasmidId[],
    stages: [],
    writtenFiles: [],
    reorgMarkerIds: [],
    wiring,
    cacheHits: 0,
    cacheMisses: 0,
  };
}

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-cure-edit-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("detectManualEdits", () => {
  it("emits no warning when hash matches and mtime is within slack", async () => {
    const path = join(workdir, "a.md");
    const content = "hello";
    await writeFile(path, content);
    const finishedAt = new Date().toISOString();

    const file: WrittenFile = {
      path,
      contentHash: sha256(content),
      bytes: content.length,
      op: "create",
    };
    const warnings = await detectManualEdits({
      workingDirectory: workdir,
      transcript: fakeTranscript(finishedAt),
      files: [file],
    });
    expect(warnings).toHaveLength(0);
  });

  it("emits manual-edit on SHA-256 mismatch", async () => {
    const path = join(workdir, "a.md");
    await writeFile(path, "changed");
    const finishedAt = new Date().toISOString();

    const file: WrittenFile = {
      path,
      contentHash: sha256("original"),
      bytes: 8,
      op: "create",
    };
    const warnings = await detectManualEdits({
      workingDirectory: workdir,
      transcript: fakeTranscript(finishedAt),
      files: [file],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe("manual-edit");
    expect(warnings[0]?.message).toMatch(/SHA-256/);
    expect(warnings[0]?.path).toBe(path);
  });

  it("emits manual-edit when mtime > finishedAt + slack (and hash not checked)", async () => {
    const path = join(workdir, "a.md");
    const content = "x";
    await writeFile(path, content);

    // finishedAt is 10 seconds ago; mtime is `now` → outside slack.
    const finishedAt = new Date(Date.now() - 10_000).toISOString();
    const file: WrittenFile = {
      path,
      contentHash: "", // skip hash check
      bytes: 1,
      op: "create",
    };
    const warnings = await detectManualEdits({
      workingDirectory: workdir,
      transcript: fakeTranscript(finishedAt),
      files: [file],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/mtime/);
  });

  it("does NOT double-warn when hash mismatch and mtime both fail", async () => {
    const path = join(workdir, "a.md");
    await writeFile(path, "changed");
    const finishedAt = new Date(Date.now() - 10_000).toISOString();
    const file: WrittenFile = {
      path,
      contentHash: sha256("original"),
      bytes: 8,
      op: "create",
    };
    const warnings = await detectManualEdits({
      workingDirectory: workdir,
      transcript: fakeTranscript(finishedAt),
      files: [file],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/SHA-256/);
  });

  it("emits no warning when the file is missing (already removed)", async () => {
    const finishedAt = new Date().toISOString();
    const file: WrittenFile = {
      path: join(workdir, "missing.md"),
      contentHash: sha256("original"),
      bytes: 8,
      op: "create",
    };
    const warnings = await detectManualEdits({
      workingDirectory: workdir,
      transcript: fakeTranscript(finishedAt),
      files: [file],
    });
    expect(warnings).toHaveLength(0);
  });

  it("respects earlier mtime (within slack) with empty content hash", async () => {
    const path = join(workdir, "a.md");
    await writeFile(path, "x");
    // Backdate mtime to 1 hour before finishedAt
    const oldTime = new Date(Date.now() - 3600_000);
    await utimes(path, oldTime, oldTime);

    const finishedAt = new Date().toISOString();
    const file: WrittenFile = {
      path,
      contentHash: "",
      bytes: 1,
      op: "create",
    };
    const warnings = await detectManualEdits({
      workingDirectory: workdir,
      transcript: fakeTranscript(finishedAt),
      files: [file],
    });
    expect(warnings).toHaveLength(0);
  });
});
