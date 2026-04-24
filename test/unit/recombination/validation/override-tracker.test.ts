/**
 * Unit tests for `src/recombination/validation/override-tracker.ts`.
 */
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  countOverrides,
  recordOverride,
} from "../../../../src/recombination/validation/override-tracker.js";
import type { OverrideRecord } from "../../../../src/recombination/types.js";
import { VALIDATION_OVERRIDES_FILE } from "../../../../src/recombination/types.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";

const pid = (s: string): PlasmidId => s as PlasmidId;

const mkRecord = (
  overrides: Partial<OverrideRecord> = {},
): OverrideRecord => ({
  timestamp: "2026-04-24T10:00:00Z",
  transcriptId: "tx-1",
  plasmidId: pid("p-alpha"),
  tier: "L1",
  reason: "user keep",
  passRate: 0.8,
  threshold: 1.0,
  actor: "user",
  ...overrides,
});

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-override-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("recordOverride", () => {
  it("creates the parent directory and appends JSON line", async () => {
    const rec = mkRecord();
    await recordOverride(workdir, rec);
    const raw = await readFile(
      join(workdir, VALIDATION_OVERRIDES_FILE),
      "utf-8",
    );
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw.trim())).toEqual(rec);
  });

  it("is append-only — two calls produce two lines", async () => {
    await recordOverride(
      workdir,
      mkRecord({ transcriptId: "tx-1", timestamp: "2026-04-24T10:00:00Z" }),
    );
    await recordOverride(
      workdir,
      mkRecord({ transcriptId: "tx-2", timestamp: "2026-04-24T11:00:00Z" }),
    );
    const raw = await readFile(
      join(workdir, VALIDATION_OVERRIDES_FILE),
      "utf-8",
    );
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).transcriptId).toBe("tx-1");
    expect(JSON.parse(lines[1]!).transcriptId).toBe("tx-2");
  });

  it("respects pre-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      recordOverride(workdir, mkRecord(), controller.signal),
    ).rejects.toThrow("aborted");
  });
});

describe("countOverrides", () => {
  it("returns 0 on ENOENT", async () => {
    const n = await countOverrides(workdir, { plasmidId: pid("nope") });
    expect(n).toBe(0);
  });

  it("filters by plasmidId", async () => {
    await recordOverride(workdir, mkRecord({ plasmidId: pid("alpha") }));
    await recordOverride(workdir, mkRecord({ plasmidId: pid("beta") }));
    await recordOverride(workdir, mkRecord({ plasmidId: pid("alpha") }));
    expect(await countOverrides(workdir, { plasmidId: pid("alpha") })).toBe(
      2,
    );
    expect(await countOverrides(workdir, { plasmidId: pid("beta") })).toBe(1);
    expect(await countOverrides(workdir, { plasmidId: pid("gamma") })).toBe(
      0,
    );
  });

  it("filters by sinceDays window", async () => {
    const now = Date.now();
    const oldIso = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
    const recentIso = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    await recordOverride(
      workdir,
      mkRecord({ plasmidId: pid("alpha"), timestamp: oldIso }),
    );
    await recordOverride(
      workdir,
      mkRecord({ plasmidId: pid("alpha"), timestamp: recentIso }),
    );
    // sinceDays=30: only the recent one qualifies.
    expect(
      await countOverrides(workdir, {
        plasmidId: pid("alpha"),
        sinceDays: 30,
      }),
    ).toBe(1);
    // no window: both.
    expect(
      await countOverrides(workdir, { plasmidId: pid("alpha") }),
    ).toBe(2);
  });

  it("tolerates malformed lines (warns, continues counting)", async () => {
    const filePath = join(workdir, VALIDATION_OVERRIDES_FILE);
    await mkdir(dirname(filePath), { recursive: true });
    const good = JSON.stringify(mkRecord({ plasmidId: pid("alpha") }));
    await writeFile(filePath, `${good}\n{not-json\n${good}\n`, {
      encoding: "utf-8",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const n = await countOverrides(workdir, { plasmidId: pid("alpha") });
    expect(n).toBe(2);
    expect(warn).toHaveBeenCalled();
  });

  it("respects pre-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      countOverrides(
        workdir,
        { plasmidId: pid("alpha") },
        controller.signal,
      ),
    ).rejects.toThrow("aborted");
  });
});
