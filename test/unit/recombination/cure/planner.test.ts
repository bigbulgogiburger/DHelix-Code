/**
 * Unit tests for `src/recombination/cure/planner.ts`.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { planCure, CurePlanError } from "../../../../src/recombination/cure/planner.js";
import { writePlasmidRef } from "../../../../src/recombination/cure/refs.js";
import type {
  CureOptions,
  PipelineStrategies,
  RecombinationTranscript,
  WiringReport,
  WrittenFile,
} from "../../../../src/recombination/types.js";
import {
  CONSTITUTION_FILE,
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../../../../src/recombination/types.js";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function strategies(): PipelineStrategies {
  return {
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
}

function wiring(): WiringReport {
  return { findings: [], errorCount: 0, warnCount: 0, infoCount: 0, passed: true };
}

interface TranscriptFixture {
  readonly id: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly activePlasmidIds: readonly PlasmidId[];
  readonly writtenFiles: readonly WrittenFile[];
  readonly reorgMarkerIds: readonly string[];
}

async function writeTranscript(
  workdir: string,
  fixture: TranscriptFixture,
): Promise<void> {
  const transcript: RecombinationTranscript = {
    id: fixture.id,
    startedAt: fixture.startedAt,
    finishedAt: fixture.finishedAt,
    mode: "extend",
    model: "gpt-4o",
    strategies: strategies(),
    activePlasmidIds: fixture.activePlasmidIds,
    stages: [],
    writtenFiles: fixture.writtenFiles,
    reorgMarkerIds: fixture.reorgMarkerIds,
    wiring: wiring(),
    cacheHits: 0,
    cacheMisses: 0,
  };
  const dir = join(workdir, RECOMBINATION_TRANSCRIPTS_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${transcript.id}.json`),
    JSON.stringify(transcript, null, 2) + "\n",
    "utf-8",
  );
}

function mkOptions(workdir: string, overrides: Partial<CureOptions> = {}): CureOptions {
  return {
    workingDirectory: workdir,
    mode: { kind: "latest" },
    dryRun: true,
    ...overrides,
  };
}

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-cure-planner-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("planCure — modes", () => {
  it("latest: picks the newest transcript by id sort", async () => {
    await writeTranscript(workdir, {
      id: "2026-01-01T00-00-00Z-aaaa",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: ["p1" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: ["m1"],
    });
    await writeTranscript(workdir, {
      id: "2026-02-01T00-00-00Z-bbbb",
      startedAt: "2026-02-01T00:00:00.000Z",
      finishedAt: "2026-02-01T00:00:05.000Z",
      activePlasmidIds: ["p2" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: ["m2"],
    });

    const plan = await planCure({ options: mkOptions(workdir) });
    expect(plan.transcriptIds).toEqual(["2026-02-01T00-00-00Z-bbbb"]);
    expect(plan.steps.some((s) => s.kind === "remove-marker" && s.markerId === "m2")).toBe(
      true,
    );
  });

  it("all: loads every transcript, dedupes markers", async () => {
    await writeTranscript(workdir, {
      id: "2026-01-01T00-00-00Z-aa",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: ["p1" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: ["shared", "m1"],
    });
    await writeTranscript(workdir, {
      id: "2026-02-01T00-00-00Z-bb",
      startedAt: "2026-02-01T00:00:00.000Z",
      finishedAt: "2026-02-01T00:00:05.000Z",
      activePlasmidIds: ["p2" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: ["shared", "m2"],
    });

    const plan = await planCure({
      options: mkOptions(workdir, { mode: { kind: "all" } }),
    });
    expect(plan.transcriptIds).toHaveLength(2);
    const markerSteps = plan.steps.filter((s) => s.kind === "remove-marker");
    expect(markerSteps).toHaveLength(3); // shared deduped
  });

  it("transcript: loads a specific transcript", async () => {
    await writeTranscript(workdir, {
      id: "specific-id",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: [],
      writtenFiles: [],
      reorgMarkerIds: ["m1"],
    });
    const plan = await planCure({
      options: mkOptions(workdir, { mode: { kind: "transcript", id: "specific-id" } }),
    });
    expect(plan.transcriptIds).toEqual(["specific-id"]);
  });

  it("plasmid: resolves transcript id via refs/plasmids/<id>", async () => {
    await writeTranscript(workdir, {
      id: "ref-target",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: ["foo" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: ["m-foo"],
    });
    await writePlasmidRef(workdir, "foo" as PlasmidId, "ref-target");

    const plan = await planCure({
      options: mkOptions(workdir, {
        mode: { kind: "plasmid", id: "foo" as PlasmidId },
      }),
    });
    expect(plan.transcriptIds).toEqual(["ref-target"]);
  });

  it("throws CURE_NO_TRANSCRIPT when no transcripts exist (latest)", async () => {
    await expect(planCure({ options: mkOptions(workdir) })).rejects.toBeInstanceOf(
      CurePlanError,
    );
    await expect(planCure({ options: mkOptions(workdir) })).rejects.toMatchObject({
      code: "CURE_NO_TRANSCRIPT",
    });
  });

  it("throws CURE_NO_TRANSCRIPT for --all when dir empty", async () => {
    await expect(
      planCure({ options: mkOptions(workdir, { mode: { kind: "all" } }) }),
    ).rejects.toMatchObject({ code: "CURE_NO_TRANSCRIPT" });
  });

  it("throws CURE_NO_TRANSCRIPT when plasmid ref is missing", async () => {
    await expect(
      planCure({
        options: mkOptions(workdir, {
          mode: { kind: "plasmid", id: "missing" as PlasmidId },
        }),
      }),
    ).rejects.toMatchObject({ code: "CURE_NO_TRANSCRIPT" });
  });

  it("throws TRANSCRIPT_CORRUPT on malformed JSON", async () => {
    const dir = join(workdir, RECOMBINATION_TRANSCRIPTS_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "bad.json"), "{not valid", "utf-8");

    await expect(
      planCure({
        options: mkOptions(workdir, {
          mode: { kind: "transcript", id: "bad" },
        }),
      }),
    ).rejects.toMatchObject({ code: "TRANSCRIPT_CORRUPT" });
  });

  it("throws TRANSCRIPT_CORRUPT on missing required fields", async () => {
    const dir = join(workdir, RECOMBINATION_TRANSCRIPTS_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "partial.json"),
      JSON.stringify({ id: "x" }),
      "utf-8",
    );

    await expect(
      planCure({
        options: mkOptions(workdir, {
          mode: { kind: "transcript", id: "partial" },
        }),
      }),
    ).rejects.toMatchObject({ code: "TRANSCRIPT_CORRUPT" });
  });
});

describe("planCure — steps & warnings", () => {
  it("emits delete-file only for create|update ops", async () => {
    const filePath = join(workdir, "a.md");
    await writeFile(filePath, "hello");
    await writeTranscript(workdir, {
      id: "t-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: [],
      writtenFiles: [
        { path: filePath, contentHash: sha256("hello"), bytes: 5, op: "create" },
        {
          path: join(workdir, "b.md"),
          contentHash: "",
          bytes: 0,
          op: "delete", // should not become delete-file step
        },
      ],
      reorgMarkerIds: [],
    });
    const plan = await planCure({ options: mkOptions(workdir) });
    const deleteSteps = plan.steps.filter((s) => s.kind === "delete-file");
    expect(deleteSteps).toHaveLength(1);
  });

  it("emits archive-plasmid + clear-refs when purge=true", async () => {
    await writeTranscript(workdir, {
      id: "t-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: ["foo" as PlasmidId, "bar" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: [],
    });
    const plan = await planCure({
      options: mkOptions(workdir, { purge: true }),
    });
    const archiveSteps = plan.steps.filter((s) => s.kind === "archive-plasmid");
    const clearSteps = plan.steps.filter((s) => s.kind === "clear-refs");
    expect(archiveSteps).toHaveLength(2);
    expect(clearSteps).toHaveLength(2);
  });

  it("manual-edit warning fires when disk content diverges", async () => {
    const filePath = join(workdir, "a.md");
    await writeFile(filePath, "actually this is different");
    await writeTranscript(workdir, {
      id: "t-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: [],
      writtenFiles: [
        {
          path: filePath,
          contentHash: sha256("expected content"),
          bytes: 16,
          op: "create",
        },
      ],
      reorgMarkerIds: [],
    });
    const plan = await planCure({ options: mkOptions(workdir) });
    expect(plan.warnings.some((w) => w.kind === "manual-edit")).toBe(true);
  });

  it("later-transcript warning when newer transcript overlaps plasmids (mode=latest)", async () => {
    await writeTranscript(workdir, {
      id: "2026-01-01T00-00-00Z-older",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: ["shared" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: ["m-old"],
    });
    // Oops — we want the OLDER one to be "latest" by lexical id, but
    // `later-transcript` fires when another file is newer by startedAt.
    // Invert: make the lexically-last (picked as latest) have earlier finishedAt.
    await writeTranscript(workdir, {
      id: "2026-02-01T00-00-00Z-newer-startedAt",
      startedAt: "2026-03-01T00:00:00.000Z",
      finishedAt: "2026-03-01T00:00:05.000Z",
      activePlasmidIds: ["shared" as PlasmidId],
      writtenFiles: [],
      reorgMarkerIds: ["m-new"],
    });

    // Pick the LEXICALLY older by passing its id explicitly.
    const plan = await planCure({
      options: mkOptions(workdir, {
        mode: { kind: "transcript", id: "2026-01-01T00-00-00Z-older" },
      }),
    });
    expect(plan.warnings.some((w) => w.kind === "later-transcript")).toBe(true);
  });

  it("unknown-marker warning fires when marker absent in DHELIX.md", async () => {
    await writeFile(join(workdir, CONSTITUTION_FILE), "# just user content\n");
    await writeTranscript(workdir, {
      id: "t-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: [],
      writtenFiles: [],
      reorgMarkerIds: ["foo/bar"],
    });
    const plan = await planCure({ options: mkOptions(workdir) });
    expect(
      plan.warnings.some(
        (w) =>
          w.kind === "unknown-marker" && w.markerId === "foo/bar",
      ),
    ).toBe(true);
  });

  it("unknown-marker NOT emitted when marker present in DHELIX.md", async () => {
    await writeFile(
      join(workdir, CONSTITUTION_FILE),
      [
        "# prose",
        "",
        "<!-- BEGIN plasmid-derived: foo/bar -->",
        "body",
        "<!-- END plasmid-derived: foo/bar -->",
        "",
      ].join("\n"),
    );
    await writeTranscript(workdir, {
      id: "t-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: [],
      writtenFiles: [],
      reorgMarkerIds: ["foo/bar"],
    });
    const plan = await planCure({ options: mkOptions(workdir) });
    expect(plan.warnings.some((w) => w.kind === "unknown-marker")).toBe(false);
  });

  it("preview contains file list and marker list", async () => {
    await writeTranscript(workdir, {
      id: "t-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:05.000Z",
      activePlasmidIds: [],
      writtenFiles: [
        {
          path: join(workdir, "a.md"),
          contentHash: "",
          bytes: 0,
          op: "create",
        },
      ],
      reorgMarkerIds: ["m-1"],
    });
    const plan = await planCure({ options: mkOptions(workdir) });
    expect(plan.preview).toMatch(/Will delete/);
    expect(plan.preview).toMatch(/a\.md/);
    expect(plan.preview).toMatch(/m-1/);
  });
});
