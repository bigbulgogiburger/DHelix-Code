/**
 * Unit tests for `src/recombination/validation/eval-seeds.ts`.
 */
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PlasmidId } from "../../../../src/plasmids/types.js";
import {
  evalSeedSchema,
  evalSeedsFileSchema,
  evalSeedsPath,
  loadEvalSeeds,
  seedsToCases,
} from "../../../../src/recombination/validation/eval-seeds.js";

const PID = "test-plasmid" as PlasmidId;

describe("evalSeedSchema", () => {
  it("accepts a minimal valid seed", () => {
    const parsed = evalSeedSchema.parse({
      id: "s1",
      tier: "L1",
      prompt: "hello",
      expectations: ["output contains 'hi'"],
    });
    expect(parsed.tier).toBe("L1");
  });

  it("rejects missing tier", () => {
    expect(() =>
      evalSeedSchema.parse({
        id: "s1",
        prompt: "hello",
        expectations: ["x"],
      }),
    ).toThrow();
  });

  it("rejects invalid tier values", () => {
    expect(() =>
      evalSeedSchema.parse({
        id: "s1",
        tier: "L5",
        prompt: "hello",
        expectations: ["x"],
      }),
    ).toThrow();
  });
});

describe("evalSeedsFileSchema", () => {
  const makeSeed = (id: string) => ({
    id,
    tier: "L1" as const,
    prompt: "p",
    expectations: ["output contains 'x'"],
  });

  it("accepts up to 20 seeds", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => makeSeed(`s${i}`));
    const r = evalSeedsFileSchema.safeParse({ plasmidId: "p", seeds });
    expect(r.success).toBe(true);
  });

  it("rejects >20 seeds", () => {
    const seeds = Array.from({ length: 21 }, (_, i) => makeSeed(`s${i}`));
    const r = evalSeedsFileSchema.safeParse({ plasmidId: "p", seeds });
    expect(r.success).toBe(false);
  });

  it("detects duplicate seed ids", () => {
    const r = evalSeedsFileSchema.safeParse({
      plasmidId: "p",
      seeds: [makeSeed("dupe"), makeSeed("dupe")],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /Duplicate/.test(i.message))).toBe(
        true,
      );
    }
  });

  it("defaults version to 1", () => {
    const r = evalSeedsFileSchema.parse({
      plasmidId: "p",
      seeds: [makeSeed("s0")],
    });
    expect(r.version).toBe(1);
  });
});

describe("loadEvalSeeds", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "eval-seeds-test-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const writeYaml = async (body: string): Promise<void> => {
    const p = evalSeedsPath(cwd, PID);
    await mkdir(join(cwd, ".dhelix/plasmids", PID), { recursive: true });
    await writeFile(p, body, "utf8");
  };

  it("returns [] when no file exists (ENOENT)", async () => {
    const out = await loadEvalSeeds(cwd, PID);
    expect(out).toEqual([]);
  });

  it("loads a valid YAML file", async () => {
    await writeYaml(
      `plasmidId: ${PID}\nseeds:\n  - id: s1\n    tier: L1\n    prompt: hi\n    expectations: ["output contains 'hi'"]\n`,
    );
    const out = await loadEvalSeeds(cwd, PID);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("s1");
  });

  it("loads a valid JSON file", async () => {
    await mkdir(join(cwd, ".dhelix/plasmids", PID), { recursive: true });
    const payload = {
      plasmidId: PID,
      seeds: [
        {
          id: "j1",
          tier: "L2",
          prompt: "p",
          expectations: ["output contains 'j'"],
        },
      ],
    };
    await writeFile(
      join(cwd, ".dhelix/plasmids", PID, "eval-seeds.json"),
      JSON.stringify(payload),
      "utf8",
    );
    const out = await loadEvalSeeds(cwd, PID);
    expect(out).toHaveLength(1);
    expect(out[0].tier).toBe("L2");
  });

  it("auto-converts legacy expected_output_contains/excludes to DSL", async () => {
    await writeYaml(
      `plasmidId: ${PID}\nseeds:\n  - id: s1\n    tier: L1\n    prompt: hi\n    expectations: ["exit code 0"]\n    expected_output_contains: ["foo"]\n    expected_output_excludes: ["bar"]\n`,
    );
    const [seed] = await loadEvalSeeds(cwd, PID);
    expect(seed.expectations).toContain(`output contains "foo"`);
    expect(seed.expectations).toContain(`output does NOT contain "bar"`);
    expect(seed.expectations).toContain("exit code 0");
  });

  it("throws typed error on invalid YAML", async () => {
    await writeYaml(":: not : valid : yaml :");
    await expect(loadEvalSeeds(cwd, PID)).rejects.toThrow(
      /eval-seeds parse failed/,
    );
  });

  it("throws typed error on schema violation", async () => {
    await writeYaml(
      `plasmidId: ${PID}\nseeds:\n  - id: s1\n    prompt: hi\n    expectations: ["x"]\n`,
    );
    await expect(loadEvalSeeds(cwd, PID)).rejects.toThrow(
      /eval-seeds parse failed/,
    );
  });

  it("rejects pre-aborted signal", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(loadEvalSeeds(cwd, PID, ac.signal)).rejects.toThrow(
      /aborted/,
    );
  });

  it("rejects when plasmidId on disk mismatches caller", async () => {
    await writeYaml(
      `plasmidId: other\nseeds:\n  - id: s1\n    tier: L1\n    prompt: hi\n    expectations: ["output contains 'hi'"]\n`,
    );
    await expect(loadEvalSeeds(cwd, PID)).rejects.toThrow(
      /plasmidId mismatch/,
    );
  });
});

describe("seedsToCases", () => {
  it("projects seeds with seed:<id> + origin=eval-seed", () => {
    const cases = seedsToCases(PID, [
      {
        id: "s1",
        tier: "L1",
        prompt: "p",
        expectations: ["output contains 'x'"],
      },
    ]);
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe("seed:s1");
    expect(cases[0].origin).toBe("eval-seed");
    expect(cases[0].plasmidId).toBe(PID);
  });
});
