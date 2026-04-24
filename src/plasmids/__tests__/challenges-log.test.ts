/**
 * Tests for `src/plasmids/governance/challenges-log.ts`.
 *
 * Each test gets a fresh tmp working directory so the JSONL log is fully
 * isolated. Round-trip semantics, malformed-line tolerance, query filters,
 * and rate computation are all exercised.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  appendChallenge,
  computeChallengeRate,
  queryChallenges,
  readChallengesLog,
} from "../governance/challenges-log.js";
import { CHALLENGE_LOG_PATH, type ChallengeLogEntry } from "../types.js";

let workingDir: string;

beforeEach(async () => {
  workingDir = await mkdtemp(join(tmpdir(), "dhelix-challenges-log-"));
});

afterEach(async () => {
  await rm(workingDir, { recursive: true, force: true });
});

const MIN_RATIONALE = "x".repeat(20);

function makeEntry(overrides: Partial<ChallengeLogEntry> = {}): ChallengeLogEntry {
  return {
    timestamp: "2026-04-23T10:45:12Z",
    plasmidId: "core-values",
    action: "override",
    rationale: MIN_RATIONALE,
    ...overrides,
  };
}

async function writeRawLog(workingDirectory: string, content: string): Promise<void> {
  const logPath = join(workingDirectory, CHALLENGE_LOG_PATH);
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, content, "utf8");
}

describe("readChallengesLog", () => {
  it("returns [] when the log file does not exist", async () => {
    const entries = await readChallengesLog(workingDir);
    expect(entries).toEqual([]);
  });

  it("returns [] for an empty log file", async () => {
    await writeRawLog(workingDir, "");
    const entries = await readChallengesLog(workingDir);
    expect(entries).toEqual([]);
  });

  it("tolerates CRLF line endings and blank lines", async () => {
    const a = JSON.stringify(makeEntry({ plasmidId: "a" }));
    const b = JSON.stringify(makeEntry({ plasmidId: "b" }));
    await writeRawLog(workingDir, `${a}\r\n\r\n${b}\r\n`);
    const entries = await readChallengesLog(workingDir);
    expect(entries.map((e) => e.plasmidId)).toEqual(["a", "b"]);
  });

  it("skips malformed JSON lines but keeps valid ones", async () => {
    const valid = JSON.stringify(makeEntry({ plasmidId: "ok" }));
    await writeRawLog(workingDir, `${valid}\nthis-is-not-json{\n${valid}\n`);
    const entries = await readChallengesLog(workingDir);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.plasmidId === "ok")).toBe(true);
  });

  it("skips lines that fail schema validation (e.g. rationale too short)", async () => {
    const valid = JSON.stringify(makeEntry({ plasmidId: "good" }));
    const tooShort = JSON.stringify({ ...makeEntry(), rationale: "short" });
    await writeRawLog(workingDir, `${tooShort}\n${valid}\n`);
    const entries = await readChallengesLog(workingDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.plasmidId).toBe("good");
  });
});

describe("appendChallenge", () => {
  it("appends a single entry round-trippable via readChallengesLog", async () => {
    const entry = makeEntry({ plasmidId: "alpha", action: "amend", newHash: "abc" });
    await appendChallenge(workingDir, entry);
    const entries = await readChallengesLog(workingDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject(entry);
  });

  it("creates the .dhelix/governance directory on first append", async () => {
    await appendChallenge(workingDir, makeEntry());
    const file = await readFile(join(workingDir, CHALLENGE_LOG_PATH), "utf8");
    expect(file.endsWith("\n")).toBe(true);
    expect(file.split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("preserves prior entries (append-only) across multiple writes", async () => {
    const a = makeEntry({ plasmidId: "a", timestamp: "2026-04-21T00:00:00Z" });
    const b = makeEntry({
      plasmidId: "b",
      action: "amend",
      timestamp: "2026-04-22T00:00:00Z",
    });
    const c = makeEntry({
      plasmidId: "a",
      action: "revoke",
      timestamp: "2026-04-23T00:00:00Z",
      dependentsAction: "orphaned",
    });
    await appendChallenge(workingDir, a);
    await appendChallenge(workingDir, b);
    await appendChallenge(workingDir, c);

    const entries = await readChallengesLog(workingDir);
    expect(entries.map((e) => e.plasmidId)).toEqual(["a", "b", "a"]);
    expect(entries.map((e) => e.action)).toEqual(["override", "amend", "revoke"]);
  });

  it("rejects entries with a too-short rationale before writing", async () => {
    await expect(
      appendChallenge(workingDir, makeEntry({ rationale: "nope" })),
    ).rejects.toThrow();
    // The log file must not exist after a rejected write.
    await expect(readChallengesLog(workingDir)).resolves.toEqual([]);
  });

  it("honours an aborted signal and never touches the disk", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      appendChallenge(workingDir, makeEntry(), ctrl.signal),
    ).rejects.toThrow(/aborted/i);
    await expect(readChallengesLog(workingDir)).resolves.toEqual([]);
  });
});

describe("queryChallenges", () => {
  beforeEach(async () => {
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", action: "override", timestamp: "2026-04-20T00:00:00Z" }),
    );
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", action: "amend", timestamp: "2026-04-21T00:00:00Z" }),
    );
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "other", action: "amend", timestamp: "2026-04-22T00:00:00Z" }),
    );
  });

  it("filters by plasmidId", async () => {
    const result = await queryChallenges(workingDir, { plasmidId: "core" });
    expect(result.map((e) => e.plasmidId)).toEqual(["core", "core"]);
  });

  it("filters by action", async () => {
    const result = await queryChallenges(workingDir, { action: "amend" });
    expect(result.map((e) => e.plasmidId)).toEqual(["core", "other"]);
  });

  it("filters by since (inclusive)", async () => {
    const result = await queryChallenges(workingDir, {
      since: new Date("2026-04-21T00:00:00Z"),
    });
    expect(result.map((e) => e.timestamp)).toEqual([
      "2026-04-21T00:00:00Z",
      "2026-04-22T00:00:00Z",
    ]);
  });

  it("combines plasmidId + action filters with AND semantics", async () => {
    const result = await queryChallenges(workingDir, {
      plasmidId: "core",
      action: "amend",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.plasmidId).toBe("core");
    expect(result[0]?.action).toBe("amend");
  });
});

describe("computeChallengeRate", () => {
  const now = () => new Date("2026-04-30T00:00:00Z");

  it("returns 0 when there are no entries at all", async () => {
    const rate = await computeChallengeRate(workingDir, "core", "7d", now);
    expect(rate).toBe(0);
  });

  it("computes a 7d rate as count / 7", async () => {
    // 3 entries inside the last 7 days for "core".
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", timestamp: "2026-04-25T00:00:00Z" }),
    );
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", timestamp: "2026-04-27T00:00:00Z" }),
    );
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", timestamp: "2026-04-29T00:00:00Z" }),
    );
    // One ancient entry that should fall outside the 7d window.
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", timestamp: "2026-01-01T00:00:00Z" }),
    );

    const rate = await computeChallengeRate(workingDir, "core", "7d", now);
    expect(rate).toBeCloseTo(3 / 7, 6);
  });

  it("computes a 30d rate as count / 30", async () => {
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", timestamp: "2026-04-10T00:00:00Z" }),
    );
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", timestamp: "2026-04-25T00:00:00Z" }),
    );
    const rate = await computeChallengeRate(workingDir, "core", "30d", now);
    expect(rate).toBeCloseTo(2 / 30, 6);
  });

  it("ignores entries from other plasmids", async () => {
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "core", timestamp: "2026-04-25T00:00:00Z" }),
    );
    await appendChallenge(
      workingDir,
      makeEntry({ plasmidId: "other", timestamp: "2026-04-25T00:00:00Z" }),
    );
    const rate = await computeChallengeRate(workingDir, "core", "7d", now);
    expect(rate).toBeCloseTo(1 / 7, 6);
  });
});
