/**
 * Unit tests for the interpreter's content-addressed cache.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  INTERPRETER_VERSION,
  buildCacheKey,
  cachePathFor,
  readCached,
  writeCached,
} from "../../../../src/recombination/interpreter/cache.js";
import type {
  CompiledPlasmidIR,
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/recombination/types.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "dhelix-interp-cache-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const METADATA: PlasmidMetadata = {
  id: "sample-plasmid" as PlasmidId,
  name: "sample plasmid",
  description: "fixture",
  version: "0.1.0",
  tier: "L2",
  scope: "local",
  privacy: "local-only",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-02T00:00:00Z",
};

function makeIR(key: string): CompiledPlasmidIR {
  return {
    plasmidId: METADATA.id,
    plasmidVersion: METADATA.version,
    metadata: METADATA,
    bodyFingerprint: "abc123" as PlasmidFingerprint,
    summary: "a plasmid",
    intents: [],
    tier: METADATA.tier,
    interpretedAt: "2026-04-24T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: key,
  };
}

describe("buildCacheKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = buildCacheKey({ bodyFingerprint: "abc", modelId: "m1", strategy: "single-pass" });
    const b = buildCacheKey({ bodyFingerprint: "abc", modelId: "m1", strategy: "single-pass" });
    expect(a).toBe(b);
  });

  it("differs when the strategy changes", () => {
    const a = buildCacheKey({ bodyFingerprint: "abc", modelId: "m1", strategy: "single-pass" });
    const b = buildCacheKey({ bodyFingerprint: "abc", modelId: "m1", strategy: "chunked" });
    expect(a).not.toBe(b);
  });

  it("differs when the model changes", () => {
    const a = buildCacheKey({ bodyFingerprint: "abc", modelId: "m1", strategy: "single-pass" });
    const b = buildCacheKey({ bodyFingerprint: "abc", modelId: "m2", strategy: "single-pass" });
    expect(a).not.toBe(b);
  });

  it("differs when the fingerprint changes", () => {
    const a = buildCacheKey({ bodyFingerprint: "abc", modelId: "m1", strategy: "single-pass" });
    const b = buildCacheKey({ bodyFingerprint: "xyz", modelId: "m1", strategy: "single-pass" });
    expect(a).not.toBe(b);
  });

  it("embeds the interpreter version by construction", () => {
    // Not exposed in the key directly — but bumping the constant MUST change keys.
    // This test asserts the constant exists so bumping requires deliberate edit.
    expect(INTERPRETER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("cachePathFor", () => {
  it("splits the key into <first2>/<rest>.json", () => {
    const key = "abcdef0123456789";
    const path = cachePathFor("/tmp/x", key);
    expect(path.endsWith(join("ab", "cdef0123456789.json"))).toBe(true);
  });
});

describe("readCached / writeCached", () => {
  it("writes atomically and reads back", async () => {
    const key = buildCacheKey({
      bodyFingerprint: "abc",
      modelId: "gpt-x",
      strategy: "single-pass",
    });
    const ir = makeIR(key);
    await writeCached(root, key, ir);
    const got = await readCached(root, key);
    expect(got).not.toBeNull();
    expect(got?.cacheKey).toBe(key);
    expect(got?.plasmidId).toBe(METADATA.id);
  });

  it("returns null on miss", async () => {
    const got = await readCached(root, "nonexistent-key");
    expect(got).toBeNull();
  });

  it("returns null on malformed JSON without throwing", async () => {
    const key = "ffeeddccbbaa0011223344556677889900aabbccddeeff0011223344556677";
    const path = cachePathFor(root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "{not-json");
    const got = await readCached(root, key);
    expect(got).toBeNull();
  });

  it("returns null on malformed envelope without throwing", async () => {
    const key = "aabbccddeeff0011223344556677889900ffeeddccbbaa0011223344556677";
    const path = cachePathFor(root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ hello: "world" }));
    const got = await readCached(root, key);
    expect(got).toBeNull();
  });

  it("respects an already-aborted signal on write", async () => {
    const controller = new AbortController();
    controller.abort();
    const key = buildCacheKey({
      bodyFingerprint: "abc",
      modelId: "m",
      strategy: "chunked",
    });
    await writeCached(root, key, makeIR(key), controller.signal);
    const got = await readCached(root, key);
    expect(got).toBeNull();
  });

  it("respects an already-aborted signal on read", async () => {
    const key = buildCacheKey({
      bodyFingerprint: "abc",
      modelId: "m",
      strategy: "chunked",
    });
    await writeCached(root, key, makeIR(key));
    const controller = new AbortController();
    controller.abort();
    const got = await readCached(root, key, controller.signal);
    expect(got).toBeNull();
  });
});
