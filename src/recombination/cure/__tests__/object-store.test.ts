/**
 * Unit tests for `src/recombination/cure/object-store.ts`.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { objectStorePath } from "../../types.js";
import { readBlob } from "../object-store.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-cure-objstore-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("readBlob", () => {
  it("returns the blob body when it exists", async () => {
    const hash =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const path = objectStorePath(workdir, hash);
    await mkdir(dirname(path), { recursive: true });
    const body = "hello\nworld\n";
    await writeFile(path, body, "utf-8");

    const out = await readBlob(workdir, hash);
    expect(out).toBe(body);
  });

  it("returns null when the blob file does not exist", async () => {
    const hash =
      "0000000000000000000000000000000000000000000000000000000000000000";
    const out = await readBlob(workdir, hash);
    expect(out).toBeNull();
  });

  it("returns null for empty hash (Phase-2 legacy transcripts)", async () => {
    const out = await readBlob(workdir, "");
    expect(out).toBeNull();
  });

  it("respects AbortSignal (aborted → throws)", async () => {
    const hash =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const path = objectStorePath(workdir, hash);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "x", "utf-8");

    const controller = new AbortController();
    controller.abort();
    await expect(readBlob(workdir, hash, controller.signal)).rejects.toThrow();
  });
});
