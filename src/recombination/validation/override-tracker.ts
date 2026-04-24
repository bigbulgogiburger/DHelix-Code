/**
 * Override audit ledger (`.dhelix/recombination/validation-overrides.jsonl`).
 *
 * Team 3 — Phase 3. Append-only (I-5). Whenever a user keeps a failed
 * validation via the grace-period prompt, an `OverrideRecord` is appended.
 * Phase 3 is read-only auditing; Phase 4+ may block after N overrides.
 *
 * Layer: Core. Atomic append via `{ flag: "a" }`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { OverrideRecord } from "../types.js";
import { VALIDATION_OVERRIDES_FILE } from "../types.js";
import type { PlasmidId } from "../../plasmids/types.js";

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error("aborted");
  }
};

export const recordOverride: (
  workingDirectory: string,
  record: OverrideRecord,
  signal?: AbortSignal,
) => Promise<void> = async (workingDirectory, record, signal) => {
  throwIfAborted(signal);
  const filePath = join(workingDirectory, VALIDATION_OVERRIDES_FILE);
  await mkdir(dirname(filePath), { recursive: true });
  throwIfAborted(signal);
  const line = `${JSON.stringify(record)}\n`;
  await writeFile(filePath, line, { flag: "a", encoding: "utf-8" });
};

export interface OverrideQuery {
  readonly plasmidId: PlasmidId;
  readonly sinceDays?: number;
}

const isOverrideRecord = (value: unknown): value is OverrideRecord => {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.timestamp === "string" &&
    typeof v.transcriptId === "string" &&
    typeof v.plasmidId === "string" &&
    typeof v.tier === "string" &&
    typeof v.reason === "string" &&
    typeof v.passRate === "number" &&
    typeof v.threshold === "number" &&
    typeof v.actor === "string"
  );
};

export const countOverrides: (
  workingDirectory: string,
  query: OverrideQuery,
  signal?: AbortSignal,
) => Promise<number> = async (workingDirectory, query, signal) => {
  throwIfAborted(signal);
  const filePath = join(workingDirectory, VALIDATION_OVERRIDES_FILE);
  let contents: string;
  try {
    contents = await readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw err;
  }
  throwIfAborted(signal);

  const cutoffMs =
    query.sinceDays !== undefined
      ? Date.now() - query.sinceDays * 24 * 60 * 60 * 1000
      : undefined;

  let count = 0;
  const lines = contents.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.warn(
        `[override-tracker] skipped malformed line in ${VALIDATION_OVERRIDES_FILE}`,
      );
      continue;
    }
    if (!isOverrideRecord(parsed)) {
      console.warn(
        `[override-tracker] skipped non-OverrideRecord entry in ${VALIDATION_OVERRIDES_FILE}`,
      );
      continue;
    }
    if (parsed.plasmidId !== query.plasmidId) continue;
    if (cutoffMs !== undefined) {
      const ts = Date.parse(parsed.timestamp);
      if (Number.isNaN(ts) || ts < cutoffMs) continue;
    }
    count += 1;
  }
  return count;
};
