/**
 * Phase 5 — Research-assisted plasmid drafting (PRD §9, P-1.5 §3.3).
 *
 * Pure orchestration: search → fetch → synthesise. The actual web tool calls
 * arrive via DI (`WebSearchFn`, `WebFetchFn`) so this module stays in-memory
 * and trivially testable.
 *
 * Privacy gate: must throw `PLASMID_RESEARCH_PRIVACY_BLOCKED` BEFORE any
 * network call when the active plasmid (or current draft) declares
 * `privacy: local-only` or when the calling environment forbids network egress.
 *
 * **Owned by Team 1 — Phase 5 GAL-1 dev-guide §2.**
 */

export {};
