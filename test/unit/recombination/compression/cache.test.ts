import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetWarnedForTests,
  cacheKey,
  cachePath,
  readCache,
  writeCache,
} from "../../../../src/recombination/compression/cache.js";
import { RECOMBINATION_OBJECTS_DIR } from "../../../../src/recombination/types.js";

describe("cache helpers", () => {
  let working: string;

  beforeEach(async () => {
    __resetWarnedForTests();
    working = await mkdtemp(join(tmpdir(), "compress-cache-"));
  });

  afterEach(async () => {
    await rm(working, { recursive: true, force: true });
  });

  it("cacheKey hashes parts deterministically with NUL separation", () => {
    const a = cacheKey(["foo", "bar"]);
    const b = cacheKey(["foo", "bar"]);
    const c = cacheKey(["foo", "baz"]);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(64); // sha256 hex
  });

  it("cachePath splits hash into first-two prefix directory", () => {
    const path = cachePath("/tmp/proj", "abcd1234");
    expect(path).toBe(
      join("/tmp/proj", RECOMBINATION_OBJECTS_DIR, "ab", "cd1234.json"),
    );
  });

  it("read on a missing key returns undefined silently", async () => {
    const result = await readCache<{ hi: string }>(working, "deadbeef".repeat(8));
    expect(result).toBeUndefined();
  });

  it("write then read round-trips the payload", async () => {
    const hash = "a".repeat(64);
    await writeCache(working, hash, { summary: "hello", n: 42 });
    const round = await readCache<{ summary: string; n: number }>(working, hash);
    expect(round).toEqual({ summary: "hello", n: 42 });
  });

  it("read on corrupt JSON returns undefined (no throw)", async () => {
    const hash = "b".repeat(64);
    const path = cachePath(working, hash);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "NOT JSON", { encoding: "utf8" });
    const result = await readCache(working, hash);
    expect(result).toBeUndefined();
  });

  it("read on wrong schemaVersion returns undefined (no throw)", async () => {
    const hash = "c".repeat(64);
    const path = cachePath(working, hash);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      JSON.stringify({ schemaVersion: 99, writtenAt: "", payload: {} }),
      { encoding: "utf8" },
    );
    const result = await readCache(working, hash);
    expect(result).toBeUndefined();
  });
});
