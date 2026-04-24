/**
 * Phase 5 — Append-only challenge log at `.dhelix/governance/challenges.log`.
 *
 * JSONL format. Append uses `appendFile {flag:"a"}` to honour I-5 audit-log
 * semantics (one writer per process; OS-level atomicity for small lines).
 * Reads tolerate CRLF, blank lines, and corruption (one bad line never
 * poisons the rest of the history — see `parseChallengesLog`).
 *
 * Layer: Leaf — depends only on `node:fs/promises`, `node:path`, the public
 * type module, and the local `./types.js` schema/parser helpers.
 *
 * Owned by Team 3 — Phase 5 GAL-1 dev-guide §4.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  CHALLENGE_LOG_PATH,
  type ChallengeAction,
  type ChallengeLogEntry,
} from "../types.js";
import { challengeLogEntrySchema, parseChallengesLog } from "./types.js";

type AsyncSignal = AbortSignal | undefined;

/** Resolve the absolute path to the challenges log under a working directory. */
function resolveLogPath(workingDirectory: string): string {
  return join(workingDirectory, CHALLENGE_LOG_PATH);
}

function throwIfAborted(signal: AsyncSignal): void {
  if (signal?.aborted) {
    // Match the DOMException-shape Node throws for `AbortSignal.throwIfAborted()`.
    throw signal.reason instanceof Error
      ? signal.reason
      : Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  }
}

/**
 * Append a single challenge entry to the JSONL log. Validates against the
 * Zod schema before serialising so callers cannot persist a malformed
 * record. Creates the parent directory on first use.
 *
 * **Append-only**: this function never reads, mutates, or rewrites prior
 * entries. The OS guarantees per-line atomicity for small writes opened
 * with `O_APPEND`, which is what `appendFile` uses underneath.
 */
export async function appendChallenge(
  workingDirectory: string,
  entry: ChallengeLogEntry,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);

  // Schema-validate up-front: bad input fails loudly here rather than
  // corrupting the on-disk log.
  const validated = challengeLogEntrySchema.parse(entry);

  const logPath = resolveLogPath(workingDirectory);
  await mkdir(dirname(logPath), { recursive: true });
  throwIfAborted(signal);

  // One JSON object per line. Serialise without indentation so the JSONL
  // format stays machine-friendly. `appendFile` does not accept an
  // `AbortSignal` directly — we honour cancellation via the pre/post-write
  // checks bracketing this call instead.
  const line = `${JSON.stringify(validated)}\n`;
  await appendFile(logPath, line, { flag: "a", encoding: "utf8" });
  throwIfAborted(signal);
}

/**
 * Read and parse the challenge log. Returns `[]` when the file does not
 * exist — the log is created lazily on first append. Malformed lines are
 * skipped (with a warning) rather than throwing.
 */
export async function readChallengesLog(
  workingDirectory: string,
  signal?: AbortSignal,
): Promise<readonly ChallengeLogEntry[]> {
  throwIfAborted(signal);

  const logPath = resolveLogPath(workingDirectory);
  let raw: string;
  try {
    raw = await readFile(logPath, { encoding: "utf8", signal });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Object.freeze([]);
    }
    throw error;
  }

  return parseChallengesLog(raw);
}

/**
 * Filter the challenge log by plasmid id, action, and/or `since` boundary
 * (inclusive). Loads the entire log into memory — acceptable because the
 * log is bounded by user ceremony frequency (a few entries per day at
 * most). If that ever changes, switch to a streaming parser.
 */
export async function queryChallenges(
  workingDirectory: string,
  opts: { plasmidId?: string; action?: ChallengeAction; since?: Date },
  signal?: AbortSignal,
): Promise<readonly ChallengeLogEntry[]> {
  const entries = await readChallengesLog(workingDirectory, signal);

  const sinceMs = opts.since ? opts.since.getTime() : undefined;

  const filtered = entries.filter((entry) => {
    if (opts.plasmidId !== undefined && entry.plasmidId !== opts.plasmidId) return false;
    if (opts.action !== undefined && entry.action !== opts.action) return false;
    if (sinceMs !== undefined) {
      const ts = Date.parse(entry.timestamp);
      if (Number.isNaN(ts) || ts < sinceMs) return false;
    }
    return true;
  });

  return Object.freeze(filtered);
}

const WINDOW_MS: Readonly<Record<"7d" | "30d", number>> = Object.freeze({
  "7d": 7 * 86_400_000,
  "30d": 30 * 86_400_000,
});

/**
 * Compute the average per-day rate of challenge entries for a plasmid over
 * the given rolling window. Returns 0 when no entries fall inside the
 * window.
 *
 * Used by the dashboard / abuse-detection telemetry (P-1.10 §10 Q4) to
 * surface plasmids that are being challenged unusually often.
 */
export async function computeChallengeRate(
  workingDirectory: string,
  plasmidId: string,
  window: "7d" | "30d",
  now: () => Date = () => new Date(),
  signal?: AbortSignal,
): Promise<number> {
  const windowMs = WINDOW_MS[window];
  const since = new Date(now().getTime() - windowMs);
  const entries = await queryChallenges(workingDirectory, { plasmidId, since }, signal);
  const days = windowMs / 86_400_000;
  return entries.length / days;
}
