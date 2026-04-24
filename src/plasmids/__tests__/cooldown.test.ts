/**
 * Tests for `src/plasmids/governance/cooldown.ts`.
 *
 * Pure helpers — no filesystem. We construct in-memory `PlasmidMetadata`
 * and `ChallengeLogEntry` arrays directly.
 */

import { describe, expect, it } from "vitest";

import { checkCooldown, parseCooldown } from "../governance/cooldown.js";
import type {
  ChallengeLogEntry,
  PlasmidId,
  PlasmidMetadata,
} from "../types.js";

const MIN_RATIONALE = "x".repeat(20);

function makePlasmid(overrides: Partial<PlasmidMetadata> = {}): PlasmidMetadata {
  return {
    id: ("core-values" as unknown) as PlasmidId,
    name: "Core Values",
    description: "Foundational plasmid",
    version: "1.0.0",
    tier: "L4",
    scope: "local",
    privacy: "cloud-ok",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
    foundational: true,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<ChallengeLogEntry> = {}): ChallengeLogEntry {
  return {
    timestamp: "2026-04-23T10:45:12Z",
    plasmidId: "core-values",
    action: "amend",
    rationale: MIN_RATIONALE,
    ...overrides,
  };
}

describe("parseCooldown", () => {
  it("parses hours", () => {
    expect(parseCooldown("1h")).toBe(3_600_000);
    expect(parseCooldown("24h")).toBe(86_400_000);
    expect(parseCooldown("100h")).toBe(360_000_000);
  });

  it("parses days", () => {
    expect(parseCooldown("3d")).toBe(259_200_000);
  });

  it("parses weeks", () => {
    expect(parseCooldown("1w")).toBe(604_800_000);
    expect(parseCooldown("2w")).toBe(1_209_600_000);
  });

  it("throws on missing unit", () => {
    expect(() => parseCooldown("24")).toThrow(/Invalid cooldown/);
  });

  it("throws on unknown unit", () => {
    expect(() => parseCooldown("24x")).toThrow(/Invalid cooldown/);
  });

  it("throws on empty string", () => {
    expect(() => parseCooldown("")).toThrow(/Invalid cooldown/);
  });

  it("throws when the unit is at the start (h24)", () => {
    expect(() => parseCooldown("h24")).toThrow(/Invalid cooldown/);
  });

  it("throws on negative or fractional values (regex only matches digits)", () => {
    expect(() => parseCooldown("-1h")).toThrow(/Invalid cooldown/);
    expect(() => parseCooldown("1.5h")).toThrow(/Invalid cooldown/);
  });

  it("throws on uppercase unit (strict casing)", () => {
    expect(() => parseCooldown("24H")).toThrow(/Invalid cooldown/);
  });
});

describe("checkCooldown", () => {
  const now = () => new Date("2026-04-30T00:00:00Z");
  const plasmid = makePlasmid();

  it("allows amend when the log is empty", () => {
    const result = checkCooldown(plasmid, "amend", [], now);
    expect(result).toEqual({ ok: true });
  });

  it("blocks amend when within the cooldown window of the last amend", () => {
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "amend", timestamp: "2026-04-29T12:00:00Z" }), // 12h ago
    ];
    const result = checkCooldown(plasmid, "amend", log, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.waitUntil.toISOString()).toBe("2026-04-30T12:00:00.000Z");
    }
  });

  it("allows amend after the cooldown has expired", () => {
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "amend", timestamp: "2026-04-25T00:00:00Z" }), // 5d ago, default 24h
    ];
    const result = checkCooldown(plasmid, "amend", log, now);
    expect(result).toEqual({ ok: true });
  });

  it("ignores override entries when computing cooldown for amend (P-1.10 §4.2)", () => {
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "amend", timestamp: "2026-04-25T00:00:00Z" }), // 5d ago
      makeEntry({ action: "override", timestamp: "2026-04-29T23:59:00Z" }), // ~1m ago
    ];
    // The recent override must NOT start a cooldown for the next amend.
    // Anchor falls back to the 5-day-old amend, which is well past 24h.
    const result = checkCooldown(plasmid, "amend", log, now);
    expect(result).toEqual({ ok: true });
  });

  it("override action is never blocked, regardless of recent amends", () => {
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "amend", timestamp: "2026-04-29T23:00:00Z" }), // 1h ago
    ];
    const result = checkCooldown(plasmid, "override", log, now);
    expect(result).toEqual({ ok: true });
  });

  it("uses revoke as a cooldown anchor for amend", () => {
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "revoke", timestamp: "2026-04-29T18:00:00Z" }), // 6h ago
    ];
    const result = checkCooldown(plasmid, "amend", log, now);
    expect(result.ok).toBe(false);
  });

  it("respects custom challengeable.require-cooldown (3d)", () => {
    const customPlasmid = makePlasmid({
      challengeable: {
        "require-justification": true,
        "min-justification-length": 50,
        "audit-log": true,
        "require-cooldown": "3d",
        "require-team-consensus": false,
        "min-approvers": 1,
      },
    });
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "amend", timestamp: "2026-04-28T00:00:00Z" }), // 2d ago
    ];
    const result = checkCooldown(customPlasmid, "amend", log, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Anchor + 3d = 2026-05-01T00:00:00Z
      expect(result.waitUntil.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    }
  });

  it("treats different plasmids' cooldowns as independent", () => {
    const log: ChallengeLogEntry[] = [
      makeEntry({
        plasmidId: "other-foundational",
        action: "amend",
        timestamp: "2026-04-29T23:00:00Z",
      }),
    ];
    const result = checkCooldown(plasmid, "amend", log, now);
    expect(result).toEqual({ ok: true });
  });

  it("falls back to 24h default when challengeable is absent", () => {
    const noChallengeable = makePlasmid({ challengeable: undefined });
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "amend", timestamp: "2026-04-29T23:00:00Z" }), // 1h ago
    ];
    const result = checkCooldown(noChallengeable, "amend", log, now);
    expect(result.ok).toBe(false);
  });

  it("throws when the anchor entry has an unparseable timestamp", () => {
    const log: ChallengeLogEntry[] = [
      makeEntry({ action: "amend", timestamp: "not-a-date" }),
    ];
    expect(() => checkCooldown(plasmid, "amend", log, now)).toThrow(/invalid timestamp/);
  });
});
