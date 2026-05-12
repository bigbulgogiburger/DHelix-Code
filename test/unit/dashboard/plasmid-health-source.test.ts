/**
 * Phase 6 GAL-1 — fs-backed PlasmidHealthDataSource unit tests.
 *
 * Empty workdir / 일부 파일만 있음 / 풀스택 fixture 의 3 시나리오를 검증한다.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFsPlasmidHealthDataSource } from "../../../src/dashboard/plasmid-health-source.js";
import { OVERRIDE_PENDING_PATH } from "../../../src/plasmids/types.js";
import { RECOMBINATION_TRANSCRIPTS_DIR } from "../../../src/recombination/types.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-plasmid-health-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

const META = (id: string, extra: Record<string, unknown> = {}): string => {
  const base: Record<string, unknown> = {
    id,
    name: `${id} fixture`,
    description: "test fixture",
    version: "0.1.0",
    tier: "L2",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-02T00:00:00Z",
    ...extra,
  };
  return Object.entries(base)
    .map(([k, v]) =>
      typeof v === "string" ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`,
    )
    .join("\n");
};

async function writePlasmid(
  base: string,
  id: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const dir = join(base, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "metadata.yaml"), META(id, extra), "utf8");
  await writeFile(join(dir, "body.md"), "# body\n", "utf8");
}

describe("createFsPlasmidHealthDataSource", () => {
  it("empty workdir — graceful zeros / nulls", async () => {
    const source = createFsPlasmidHealthDataSource(workdir);
    const h = await source.getHealth();

    expect(h.counts.totalPlasmids).toBe(0);
    expect(h.counts.activePlasmidIds).toEqual([]);
    expect(h.counts.foundationalIds).toEqual([]);
    expect(h.lastRecombination).toBeNull();
    expect(h.transcriptsCount).toBe(0);
    expect(h.governance.pendingOverrideCount).toBe(0);
    expect(h.governance.lastChallengeAt).toBeNull();
  });

  it("counts plasmids + tier histogram + foundational ids", async () => {
    const registryDir = join(workdir, ".dhelix", "plasmids");
    await mkdir(registryDir, { recursive: true });
    await writePlasmid(registryDir, "alpha");
    await writePlasmid(registryDir, "bravo", { tier: "L4", foundational: true });
    await writePlasmid(registryDir, "charlie", { tier: "L1" });

    const source = createFsPlasmidHealthDataSource(workdir);
    const h = await source.getHealth();

    expect(h.counts.totalPlasmids).toBe(3);
    expect(h.counts.foundationalIds).toEqual(["bravo"]);
    expect(h.counts.byTier).toMatchObject({ L1: 1, L2: 1, L4: 1 });
  });

  it("surfaces last recombination from transcripts dir lex-sort", async () => {
    const transcriptsDir = join(workdir, RECOMBINATION_TRANSCRIPTS_DIR);
    await mkdir(transcriptsDir, { recursive: true });
    await writeFile(
      join(transcriptsDir, "2026-04-01T10-00-00Z-aaaa.json"),
      "{}",
      "utf8",
    );
    await writeFile(
      join(transcriptsDir, "2026-05-04T07-26-05Z-bbbb.json"),
      "{}",
      "utf8",
    );

    const source = createFsPlasmidHealthDataSource(workdir);
    const h = await source.getHealth();

    expect(h.transcriptsCount).toBe(2);
    expect(h.lastRecombination?.transcriptId).toBe(
      "2026-05-04T07-26-05Z-bbbb",
    );
    expect(h.lastRecombination?.timestamp).toBe("2026-05-04T07:26:05Z");
  });

  it("collects pending overrides from governance file (object form)", async () => {
    const overridePath = join(workdir, OVERRIDE_PENDING_PATH);
    await mkdir(join(workdir, ".dhelix", "governance"), { recursive: true });
    await writeFile(
      overridePath,
      JSON.stringify({
        pending: [
          { plasmidId: "anti-deception", queuedAt: "2026-05-04T00:00:00Z" },
          { plasmidId: "no-secrets", queuedAt: "2026-05-04T00:00:01Z" },
        ],
      }),
      "utf8",
    );

    const source = createFsPlasmidHealthDataSource(workdir);
    const h = await source.getHealth();

    expect(h.governance.pendingOverrideCount).toBe(2);
    expect(h.governance.pendingOverridePlasmidIds).toEqual([
      "anti-deception",
      "no-secrets",
    ]);
  });

  it("collects pending overrides from governance file (array form)", async () => {
    const overridePath = join(workdir, OVERRIDE_PENDING_PATH);
    await mkdir(join(workdir, ".dhelix", "governance"), { recursive: true });
    await writeFile(
      overridePath,
      JSON.stringify([{ plasmidId: "x" }, { plasmidId: "y" }]),
      "utf8",
    );

    const source = createFsPlasmidHealthDataSource(workdir);
    const h = await source.getHealth();
    expect(h.governance.pendingOverridePlasmidIds).toEqual(["x", "y"]);
  });

  it("reads last challenge timestamp from challenges.log (NDJSON)", async () => {
    await mkdir(join(workdir, ".dhelix", "governance"), { recursive: true });
    const path = join(workdir, ".dhelix", "governance", "challenges.log");
    const lines = [
      JSON.stringify({ timestamp: "2026-04-01T00:00:00Z", action: "amend" }),
      JSON.stringify({ timestamp: "2026-05-03T12:34:56Z", action: "override" }),
    ].join("\n");
    await writeFile(path, lines + "\n", "utf8");

    const source = createFsPlasmidHealthDataSource(workdir);
    const h = await source.getHealth();
    expect(h.governance.lastChallengeAt).toBe("2026-05-03T12:34:56Z");
  });

  it("is robust against malformed governance files", async () => {
    const overridePath = join(workdir, OVERRIDE_PENDING_PATH);
    await mkdir(join(workdir, ".dhelix", "governance"), { recursive: true });
    await writeFile(overridePath, "{this is not json", "utf8");
    const challengesPath = join(workdir, ".dhelix", "governance", "challenges.log");
    await writeFile(challengesPath, "garbage\nnot-json-either\n", "utf8");

    const source = createFsPlasmidHealthDataSource(workdir);
    const h = await source.getHealth();
    expect(h.governance.pendingOverrideCount).toBe(0);
    expect(h.governance.lastChallengeAt).toBeNull();
  });
});
