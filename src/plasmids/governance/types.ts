/**
 * Phase 5 — Governance module-local types + parsers (P-1.10 §5).
 *
 * Re-exports the public symbols (`ChallengeAction`, `ChallengeLogEntry`,
 * `OverridePending`, `CHALLENGE_LOG_PATH`, `OVERRIDE_PENDING_PATH`) so
 * downstream callers (Team 4 challenge command, Team 5 executor) only need
 * one import path.
 *
 * Also defines the runtime Zod schema `challengeLogEntrySchema` and the
 * tolerant JSONL parser `parseChallengesLog` used by `challenges-log.ts`.
 *
 * Layer: Leaf — depends only on `zod`, `../types.js`.
 *
 * Owned by Team 3 — Phase 5 GAL-1 dev-guide §4.
 */

import { z } from "zod";

import type {
  ChallengeAction,
  ChallengeLogEntry,
  OverridePending,
  PlasmidId,
} from "../types.js";
import {
  CHALLENGE_LOG_PATH,
  OVERRIDE_PENDING_PATH,
} from "../types.js";

// Re-export public symbols so governance/* consumers have a single entry point.
export type {
  ChallengeAction,
  ChallengeLogEntry,
  OverridePending,
  PlasmidId,
};
export { CHALLENGE_LOG_PATH, OVERRIDE_PENDING_PATH };

/**
 * Runtime Zod schema for one entry in `.dhelix/governance/challenges.log`
 * (P-1.10 §5.1). Strict mode — unknown keys reject so future extensions are
 * never silently dropped.
 *
 * `rationale` enforces the design's hard floor of 20 chars (the
 * `min-justification-length` in `challengeable` may push it higher per
 * plasmid; the schema only encodes the floor).
 */
export const challengeLogEntrySchema = z
  .object({
    timestamp: z.string().datetime({ offset: true }),
    plasmidId: z.string().min(1),
    action: z.enum(["override", "amend", "revoke"]),
    rationale: z.string().min(20),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    previousHash: z.string().optional(),
    newHash: z.string().optional(),
    dependentsAction: z.enum(["kept", "orphaned", "revoked"]).optional(),
    teamApprovals: z
      .array(
        z
          .object({
            userId: z.string().min(1),
            approvedAt: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

// Compile-time compatibility: schema OUTPUT must satisfy the public type.
type _ChallengeLogEntryCompat = z.infer<typeof challengeLogEntrySchema> extends ChallengeLogEntry
  ? true
  : never;
const _challengeLogEntryCompat: _ChallengeLogEntryCompat = true;
void _challengeLogEntryCompat;

/**
 * Schema for one entry in `.dhelix/governance/overrides.pending.json`. Used
 * by `OverridesPendingStore` for read-side validation; writes go through the
 * branded `PlasmidId` flowing in from callers (already validated upstream).
 */
export const overridePendingSchema = z
  .object({
    plasmidId: z.string().min(1),
    queuedAt: z.string().datetime({ offset: true }),
    rationaleSha256: z.string().regex(/^[a-f0-9]{64}$/i, "rationaleSha256 must be 64-char hex"),
  })
  .strict();

// Compile-time compatibility note: the schema OUTPUT carries an unbranded
// `string` for `plasmidId`; the on-disk file is read back through
// `OverridesPendingStore` which re-applies the brand for callers. We assert
// only the structural keys/value types match — the brand is a compile-time
// fiction with no runtime cost.
type _OverridePendingShape = {
  readonly plasmidId: string;
  readonly queuedAt: string;
  readonly rationaleSha256: string;
};
type _OverridePendingCompat = z.infer<typeof overridePendingSchema> extends _OverridePendingShape
  ? true
  : never;
const _overridePendingCompat: _OverridePendingCompat = true;
void _overridePendingCompat;
// Sanity: the public branded type is also assignable to the structural shape.
type _PublicOverridePendingShape = OverridePending extends _OverridePendingShape ? true : never;
const _publicOverridePendingShape: _PublicOverridePendingShape = true;
void _publicOverridePendingShape;

/**
 * Wrapper schema for the on-disk `overrides.pending.json` payload.
 */
export const overridesPendingFileSchema = z
  .object({
    pending: z.array(overridePendingSchema),
  })
  .strict();

/**
 * Tolerant JSONL parser for the challenges log.
 *
 * - Splits on `\n` AND `\r\n` (CRLF tolerant for Windows authors).
 * - Skips blank/whitespace-only lines.
 * - Skips lines that do not parse as JSON or fail schema validation.
 *   Malformed lines are reported via `console.warn` so operators can spot
 *   corruption, but they never abort the read — the log is append-only and
 *   a single bad line must not poison the entire history.
 *
 * Returns a frozen array (callers may not mutate the entries).
 */
export function parseChallengesLog(content: string): readonly ChallengeLogEntry[] {
  if (content.length === 0) return Object.freeze([]);

  const lines = content.split(/\r?\n/);
  const entries: ChallengeLogEntry[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch (error) {
      // Soft-warn so silent corruption is observable in dev / CI logs.
      // eslint-disable-next-line no-console
      console.warn(
        `[plasmids.governance] skipping malformed challenges.log line ${i + 1}: ${
          (error as Error).message
        }`,
      );
      continue;
    }

    const parsed = challengeLogEntrySchema.safeParse(raw);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.warn(
        `[plasmids.governance] skipping invalid challenges.log line ${i + 1}: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
      continue;
    }

    entries.push(parsed.data);
  }

  return Object.freeze(entries);
}
