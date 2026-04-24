/**
 * Phase 5 — Foundational challenge cooldown enforcement (P-1.10 §4).
 *
 * `parseCooldown` + `checkCooldown` — pure helpers, no I/O. Caller passes the
 * already-loaded log so cooldown decisions remain testable without touching
 * the filesystem.
 *
 * **Critical invariant** (P-1.10 §4.2): an `override` action NEVER starts a
 * cooldown for the next `amend`. The cooldown for `amend` is anchored on
 * the most recent `amend` or `revoke` for the same plasmid; `override`
 * entries are skipped when computing the anchor.
 *
 * Layer: Leaf — depends only on `../types.js`.
 *
 * Owned by Team 3 — Phase 5 GAL-1 dev-guide §4.
 */

import type {
  ChallengeAction,
  ChallengeLogEntry,
  CooldownDecision,
  PlasmidMetadata,
} from "../types.js";

const COOLDOWN_REGEX = /^(\d+)([hdw])$/;

const UNIT_MS: Readonly<Record<"h" | "d" | "w", number>> = Object.freeze({
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
});

/** Default cooldown when a foundational plasmid omits the `challengeable` block. */
const DEFAULT_COOLDOWN = "24h";

/**
 * Parse a `\d+[hdw]` cooldown string into milliseconds.
 *
 * Strict: throws on empty, missing unit, unknown unit, or any non-matching
 * input. Numeric overflow beyond `Number.MAX_SAFE_INTEGER` is *not* guarded
 * because the schema caps `require-cooldown` to plain `\d+[hdw]` and the
 * worst legal input ("999999w") is well within safe range.
 *
 * @example
 *   parseCooldown("24h") // 86_400_000
 *   parseCooldown("3d")  // 259_200_000
 *   parseCooldown("1w")  // 604_800_000
 */
export function parseCooldown(s: string): number {
  const match = COOLDOWN_REGEX.exec(s);
  if (!match) {
    throw new Error(
      `Invalid cooldown "${s}": must match \\d+[hdw] (e.g. "24h", "3d", "1w")`,
    );
  }
  const n = Number.parseInt(match[1] as string, 10);
  const unit = match[2] as "h" | "d" | "w";
  return n * UNIT_MS[unit];
}

/**
 * Decide whether `action` may proceed against `plasmid` given the prior
 * challenge log.
 *
 * Rules (P-1.10 §4.2):
 * - `override` actions never block — they are one-shot and have no
 *   long-term effect, so cooldown is not consulted.
 * - `amend` and `revoke` look at the most recent `amend` or `revoke`
 *   entry for the same plasmid; `override` entries in the log are
 *   ignored when computing the cooldown anchor. This means an override
 *   does not delay the next amend.
 * - When no prior `amend`/`revoke` exists, the action is allowed.
 *
 * Pure: takes a `now` factory so tests can pin time without a clock mock.
 */
export function checkCooldown(
  plasmid: PlasmidMetadata,
  action: ChallengeAction,
  log: readonly ChallengeLogEntry[],
  now: () => Date = () => new Date(),
): CooldownDecision {
  // Override is one-shot; cooldown never gates it.
  if (action === "override") {
    return { ok: true };
  }

  // Anchor lookup: most recent amend OR revoke for this plasmid. Walk in
  // reverse so the first match is the latest.
  let anchor: ChallengeLogEntry | undefined;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const entry = log[i];
    if (entry === undefined) continue;
    if (entry.plasmidId !== plasmid.id) continue;
    if (entry.action === "override") continue;
    anchor = entry;
    break;
  }

  if (anchor === undefined) {
    return { ok: true };
  }

  const cooldownSpec = plasmid.challengeable?.["require-cooldown"] ?? DEFAULT_COOLDOWN;
  const cooldownMs = parseCooldown(cooldownSpec);

  const anchorMs = Date.parse(anchor.timestamp);
  if (Number.isNaN(anchorMs)) {
    // Malformed timestamp on disk should not silently bypass the cooldown;
    // surface it to the caller. The log parser already filters obvious
    // garbage, so reaching here implies a hand-edited entry.
    throw new Error(
      `Cannot compute cooldown for plasmid "${plasmid.id}": prior entry has invalid timestamp "${anchor.timestamp}"`,
    );
  }

  const waitUntil = new Date(anchorMs + cooldownMs);
  const remainingMs = waitUntil.getTime() - now().getTime();

  if (remainingMs > 0) {
    return { ok: false, waitUntil, remainingMs };
  }

  return { ok: true };
}
