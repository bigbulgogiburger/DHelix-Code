/**
 * Unit tests for `src/recombination/cure/refs.ts`.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { RECOMBINATION_REFS_DIR } from "../../../../src/recombination/types.js";
import {
  clearPlasmidRef,
  listPlasmidRefs,
  readPlasmidRef,
  writePlasmidRef,
} from "../../../../src/recombination/cure/refs.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-cure-refs-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("refs", () => {
  it("writePlasmidRef then readPlasmidRef round-trips the transcript id", async () => {
    const plasmidId = "foo" as PlasmidId;
    await writePlasmidRef(workdir, plasmidId, "tid-1");

    const got = await readPlasmidRef(workdir, plasmidId);
    expect(got).toBe("tid-1");

    // File has trailing newline on disk.
    const raw = await readFile(
      join(workdir, RECOMBINATION_REFS_DIR, "foo"),
      "utf-8",
    );
    expect(raw).toBe("tid-1\n");
  });

  it("writePlasmidRef overwrites rather than appending", async () => {
    const plasmidId = "foo" as PlasmidId;
    await writePlasmidRef(workdir, plasmidId, "tid-1");
    await writePlasmidRef(workdir, plasmidId, "tid-2");
    const got = await readPlasmidRef(workdir, plasmidId);
    expect(got).toBe("tid-2");
  });

  it("readPlasmidRef returns null when the file is missing", async () => {
    const got = await readPlasmidRef(workdir, "nope" as PlasmidId);
    expect(got).toBeNull();
  });

  it("clearPlasmidRef is idempotent", async () => {
    const plasmidId = "foo" as PlasmidId;
    await writePlasmidRef(workdir, plasmidId, "tid-1");
    await clearPlasmidRef(workdir, plasmidId);
    await clearPlasmidRef(workdir, plasmidId); // idempotent
    const got = await readPlasmidRef(workdir, plasmidId);
    expect(got).toBeNull();
  });

  it("listPlasmidRefs returns all refs as a map", async () => {
    await writePlasmidRef(workdir, "a" as PlasmidId, "tid-a");
    await writePlasmidRef(workdir, "b" as PlasmidId, "tid-b");

    const got = await listPlasmidRefs(workdir);
    expect(got.size).toBe(2);
    expect(got.get("a" as PlasmidId)).toBe("tid-a");
    expect(got.get("b" as PlasmidId)).toBe("tid-b");
  });

  it("listPlasmidRefs returns an empty map when the dir does not exist", async () => {
    const got = await listPlasmidRefs(workdir);
    expect(got.size).toBe(0);
  });

  it("rejects the call when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      writePlasmidRef(workdir, "a" as PlasmidId, "tid", controller.signal),
    ).rejects.toThrow(/aborted/);
  });
});
