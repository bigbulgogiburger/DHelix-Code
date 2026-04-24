/**
 * Phase 5 — One-shot override queue at
 * `.dhelix/governance/overrides.pending.json`.
 *
 * Atomic write (tmp + rename) — this file is a small mutable cache, NOT a
 * log. `consumeOverride` is idempotent: returns `true` exactly once per
 * pending entry, then `false`.
 *
 * Owned by Team 3 — Phase 5 GAL-1 dev-guide §4.
 */

export {};
