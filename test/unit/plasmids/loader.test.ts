/**
 * Integration-ish unit tests for `src/plasmids/loader.ts`.
 *
 * Writes fixture plasmids into a temp dir and asserts the loader's partitioned
 * result across happy/orphan/duplicate/abort paths.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadPlasmids } from "../../../src/plasmids/loader.js";
import type { LoadResult } from "../../../src/plasmids/types.js";

// Build a fresh temp root per-test so cases do not leak.
let rootDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "dhelix-plasmid-loader-"));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

const META_YAML = (id: string, extra: Record<string, unknown> = {}) => {
  const base: Record<string, unknown> = {
    id,
    name: `${id} plasmid`,
    description: "fixture plasmid for loader tests",
    version: "0.1.0",
    tier: "L2",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-02T00:00:00Z",
    ...extra,
  };
  return Object.entries(base)
    .map(([k, v]) => (typeof v === "string" ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`))
    .join("\n");
};

const BODY_MD = "# Body\nContent here.\n";

async function writeTwoFile(
  base: string,
  id: string,
  metaExtra: Record<string, unknown> = {},
  body: string = BODY_MD,
): Promise<void> {
  const dir = join(base, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "metadata.yaml"), META_YAML(id, metaExtra), "utf8");
  await writeFile(join(dir, "body.md"), body, "utf8");
}

async function writeSingleFile(
  base: string,
  id: string,
  metaExtra: Record<string, unknown> = {},
  body: string = BODY_MD,
): Promise<void> {
  await mkdir(base, { recursive: true });
  const source = `---\n${META_YAML(id, metaExtra)}\n---\n${body}`;
  await writeFile(join(base, `${id}.md`), source, "utf8");
}

async function load(options?: {
  readonly shared?: string;
  readonly signal?: AbortSignal;
}): Promise<LoadResult> {
  return loadPlasmids({
    workingDirectory: rootDir,
    registryPath: "registry",
    sharedRegistryPath: options?.shared,
    signal: options?.signal,
  });
}

describe("loadPlasmids — happy paths", () => {
  it("loads a single two-file plasmid from the local scope", async () => {
    await writeTwoFile(join(rootDir, "registry"), "alpha-one");
    const result = await load();
    expect(result.failed).toEqual([]);
    expect(result.loaded).toHaveLength(1);
    const [p] = result.loaded;
    expect(p.metadata.id).toBe("alpha-one");
    expect(p.scopeOrigin).toBe("local");
    expect(p.bodyFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(p.sourcePath).toContain("body.md");
    expect(p.metadataPath).toContain("metadata.yaml");
  });

  it("loads a single-file plasmid", async () => {
    await writeSingleFile(join(rootDir, "registry"), "beta-two");
    const result = await load();
    expect(result.failed).toEqual([]);
    expect(result.loaded).toHaveLength(1);
    expect(result.loaded[0].scopeOrigin).toBe("local");
  });

  it("parses eval cases from single-file form", async () => {
    const body = [
      "# Prose",
      "## Eval cases",
      "- id: case-1",
      "  description: basic",
      "  input: hello",
      "  expectations:",
      "    - contains:hello",
      "    - not-contains:goodbye",
    ].join("\n");
    await writeSingleFile(join(rootDir, "registry"), "gamma-three", {}, body);
    const result = await load();
    expect(result.failed).toEqual([]);
    expect(result.loaded[0].evalCases).toHaveLength(1);
    expect(result.loaded[0].evalCases[0].expectations).toHaveLength(2);
  });

  it("computes deterministic sha256 bodyFingerprint", async () => {
    await writeTwoFile(join(rootDir, "registry"), "delta-four");
    const r1 = await load();
    await rm(join(rootDir, "registry", "delta-four"), { recursive: true });
    await writeTwoFile(join(rootDir, "registry"), "delta-four");
    const r2 = await load();
    expect(r1.loaded[0].bodyFingerprint).toBe(r2.loaded[0].bodyFingerprint);
  });

  it("returns empty when scope dirs do not exist", async () => {
    const result = await load();
    expect(result.loaded).toEqual([]);
    expect(result.failed).toEqual([]);
  });
});

describe("loadPlasmids — scope precedence", () => {
  it("ephemeral wins over local for the same id", async () => {
    await writeTwoFile(join(rootDir, "registry", ".drafts"), "same-id");
    await writeTwoFile(join(rootDir, "registry"), "same-id");
    const result = await load();
    expect(result.loaded).toHaveLength(1);
    expect(result.loaded[0].scopeOrigin).toBe("ephemeral");
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].code).toBe("PLASMID_DUPLICATE_ID");
  });

  it("loads from shared scope when registry provided", async () => {
    const shared = await mkdtemp(join(tmpdir(), "dhelix-plasmid-shared-"));
    try {
      await writeTwoFile(shared, "team-shared");
      const result = await load({ shared });
      expect(result.loaded).toHaveLength(1);
      expect(result.loaded[0].scopeOrigin).toBe("shared");
    } finally {
      await rm(shared, { recursive: true, force: true });
    }
  });
});

describe("loadPlasmids — failure modes", () => {
  it("reports PLASMID_ORPHAN_METADATA when body.md missing", async () => {
    const dir = join(rootDir, "registry", "orphan-meta");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "metadata.yaml"), META_YAML("orphan-meta"), "utf8");
    const result = await load();
    expect(result.loaded).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].code).toBe("PLASMID_ORPHAN_METADATA");
  });

  it("reports PLASMID_ORPHAN_BODY when metadata.yaml missing", async () => {
    const dir = join(rootDir, "registry", "orphan-body");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "body.md"), BODY_MD, "utf8");
    const result = await load();
    expect(result.loaded).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].code).toBe("PLASMID_ORPHAN_BODY");
  });

  it("reports PLASMID_SCHEMA_INVALID on bad metadata", async () => {
    const dir = join(rootDir, "registry", "bad-tier");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "metadata.yaml"),
      META_YAML("bad-tier", { tier: "L9" }),
      "utf8",
    );
    await writeFile(join(dir, "body.md"), BODY_MD, "utf8");
    const result = await load();
    expect(result.loaded).toEqual([]);
    expect(result.failed[0].code).toBe("PLASMID_SCHEMA_INVALID");
  });

  it("reports PLASMID_SCHEMA_INVALID when on-disk id disagrees with metadata", async () => {
    const dir = join(rootDir, "registry", "on-disk-name");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "metadata.yaml"),
      META_YAML("different-id"),
      "utf8",
    );
    await writeFile(join(dir, "body.md"), BODY_MD, "utf8");
    const result = await load();
    expect(result.failed[0].code).toBe("PLASMID_SCHEMA_INVALID");
    expect(result.failed[0].reason).toContain("does not match on-disk id");
  });

  it("reports PLASMID_FRONTMATTER_MISSING on a single-file without frontmatter", async () => {
    await mkdir(join(rootDir, "registry"), { recursive: true });
    await writeFile(
      join(rootDir, "registry", "no-meta.md"),
      "# No frontmatter here",
      "utf8",
    );
    const result = await load();
    expect(result.failed[0].code).toBe("PLASMID_FRONTMATTER_MISSING");
  });

  it("reports schema error for duplicate eval-case ids", async () => {
    const body = [
      "# Prose",
      "## Eval cases",
      "- id: same",
      "  description: a",
      "  input: i",
      "  expectations: [contains:x]",
      "- id: same",
      "  description: b",
      "  input: i",
      "  expectations: [contains:x]",
    ].join("\n");
    await writeSingleFile(join(rootDir, "registry"), "dup-evals", {}, body);
    const result = await load();
    expect(result.failed[0].code).toBe("PLASMID_SCHEMA_INVALID");
    expect(result.failed[0].reason).toContain("duplicate eval case id");
  });
});

describe("loadPlasmids — AbortSignal", () => {
  it("aborts before processing when signal is pre-aborted", async () => {
    await writeTwoFile(join(rootDir, "registry"), "aborted-one");
    const controller = new AbortController();
    controller.abort();
    await expect(load({ signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("loadPlasmids — options validation", () => {
  it("throws on missing workingDirectory", async () => {
    await expect(
      loadPlasmids({
        workingDirectory: "",
        registryPath: "registry",
      }),
    ).rejects.toThrow(/workingDirectory/);
  });

  it("throws on missing registryPath", async () => {
    await expect(
      loadPlasmids({ workingDirectory: rootDir, registryPath: "" }),
    ).rejects.toThrow(/registryPath/);
  });
});
