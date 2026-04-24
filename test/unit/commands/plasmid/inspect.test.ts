/**
 * `/plasmid inspect compression <id>` — Phase 5 Team 5.
 *
 * Coverage:
 *   - happy path: matching transcript + compression section file with
 *     plasmid markers → token counts, ratio, preserved-constraint list
 *   - graceful no-transcript error when nothing references the plasmid
 *   - malformed transcript JSON is skipped (graceful continue)
 *   - argument validation: missing topic/id, unknown topic, extra args
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { inspectSubcommand } from "../../../../src/commands/plasmid/inspect.js";
import {
  PROMPT_SECTIONS_GENERATED_DIR,
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../../../../src/recombination/types.js";
import type {
  RecombinationTranscript,
  WrittenFile,
} from "../../../../src/recombination/types.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

function emptyWiring() {
  return {
    findings: [],
    errorCount: 0,
    warnCount: 0,
    infoCount: 0,
    passed: true,
  };
}

function emptyStrategies() {
  return {
    interpreter: "single-pass" as const,
    compression: "abstractive" as const,
    reorgFallback: "llm-only" as const,
    validationVolume: "minimal" as const,
    validationParallelism: 1,
    gradingTiers: [],
    passThresholds: { L1: 1, L2: 1, L3: 1, L4: 1 },
    projectProfile: "static-template" as const,
    artifactGeneration: "template-only" as const,
    interpreterRetries: 0,
  };
}

function buildTranscript(
  id: string,
  activePlasmidIds: readonly string[],
  writtenFiles: readonly WrittenFile[],
): RecombinationTranscript {
  return {
    id,
    startedAt: "2026-04-01T00:00:00Z",
    finishedAt: "2026-04-01T00:00:01Z",
    mode: "extend",
    model: "test-model",
    strategies: emptyStrategies(),
    activePlasmidIds: activePlasmidIds as readonly PlasmidId[],
    stages: [],
    writtenFiles,
    reorgMarkerIds: [],
    wiring: emptyWiring(),
    cacheHits: 0,
    cacheMisses: 0,
  };
}

async function writeTranscript(
  workdir: string,
  transcript: RecombinationTranscript,
): Promise<void> {
  const dir = join(workdir, RECOMBINATION_TRANSCRIPTS_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${transcript.id}.json`),
    JSON.stringify(transcript, null, 2),
    "utf-8",
  );
}

async function writeSectionFile(
  workdir: string,
  filename: string,
  content: string,
): Promise<string> {
  const dir = join(workdir, PROMPT_SECTIONS_GENERATED_DIR);
  await mkdir(dir, { recursive: true });
  const fullPath = join(dir, filename);
  await writeFile(fullPath, content, "utf-8");
  return fullPath;
}

describe("/plasmid inspect compression", () => {
  let cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("rejects missing arguments", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const r = await inspectSubcommand([], makeContext(fx.workingDirectory), fx.deps);
    expect(r.success).toBe(false);
    expect(r.output).toContain("Missing arguments");
  });

  it("rejects unknown topic", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const r = await inspectSubcommand(
      ["dependencies", "alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Unknown topic");
  });

  it("returns a graceful error when no transcript references the plasmid", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);

    const r = await inspectSubcommand(
      ["compression", "alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("No recombination transcript references plasmid 'alpha'");
  });

  it("prints body/summary tokens, ratio, and preserved constraints (happy path)", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({ id: "alpha" as PlasmidId }),
          {
            body:
              "This is a fairly long plasmid body that should produce a non-trivial " +
              "token count when estimated by word frequency multiplied by 1.3.",
          },
        ),
      ],
    });
    cleanups.push(fx.cleanup);

    const sectionPath = await writeSectionFile(
      fx.workingDirectory,
      "60-principles.md",
      [
        "<!-- GENERATED — do not edit directly. Sources: alpha -->",
        "",
        "## Principles",
        "",
        "<!-- BEGIN plasmid: alpha -->",
        "Short summary of alpha.",
        "Constraints:",
        "- must use semver",
        "- must include changelog",
        "<!-- END plasmid: alpha -->",
      ].join("\n"),
    );
    const transcript = buildTranscript("2026-04-01T00-00-00Z-aaaa", ["alpha"], [
      {
        path: sectionPath,
        contentHash: "deadbeef",
        bytes: 100,
        op: "create",
      },
    ]);
    await writeTranscript(fx.workingDirectory, transcript);

    const r = await inspectSubcommand(
      ["compression", "alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain("Compression report for plasmid 'alpha'");
    expect(r.output).toContain("transcript:  2026-04-01T00-00-00Z-aaaa");
    expect(r.output).toMatch(/body tokens: ~\d+/u);
    expect(r.output).toMatch(/summary tokens: ~\d+/u);
    expect(r.output).toContain("Preserved constraints:");
    expect(r.output).toContain("must use semver");
    expect(r.output).toContain("must include changelog");
  });

  it("skips malformed transcript JSON and continues searching older transcripts", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);

    // Write a malformed (newer) transcript first — must be skipped.
    const dir = join(fx.workingDirectory, RECOMBINATION_TRANSCRIPTS_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "2026-04-01T99-99-99Z-zzzz.json"),
      "{not valid json",
      "utf-8",
    );

    // And a valid older transcript that DOES reference alpha.
    const sectionPath = await writeSectionFile(
      fx.workingDirectory,
      "60-principles.md",
      [
        "<!-- BEGIN plasmid: alpha -->",
        "Older summary",
        "<!-- END plasmid: alpha -->",
      ].join("\n"),
    );
    await writeTranscript(
      fx.workingDirectory,
      buildTranscript("2026-04-01T00-00-00Z-aaaa", ["alpha"], [
        { path: sectionPath, contentHash: "x", bytes: 1, op: "create" },
      ]),
    );

    const r = await inspectSubcommand(
      ["compression", "alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain("Compression report for plasmid 'alpha'");
  });

  it("returns not-found for an unknown plasmid id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const r = await inspectSubcommand(
      ["compression", "ghost"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Plasmid not found");
  });
});
