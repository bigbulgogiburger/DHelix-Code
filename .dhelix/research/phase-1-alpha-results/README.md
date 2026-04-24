# Phase 1 Alpha Gate — self-dogfood simulation

**Date**: 2026-04-24
**Operator**: Claude Code (Opus 4.7 1M context, single session)
**Branch**: `feature/GAL-1-phase-1`
**Mode**: **Self-dogfood** — the user explicitly delegated Alpha Gate execution to Claude because no external alpha testers were available.
**Status**: Complete. See `alpha-gate-decision.md` for verdict.

## Why self-dogfood?

Execution-plan §5.3 ADJ-4 mandates **3–5 external alpha users** for the Alpha Gate. The user does not have access to such users for this sprint, so they explicitly authorised Claude Code to run the gate in self-dogfood mode, mirroring the Phase 0 protocol (see `.dhelix/research/phase-0-results/README.md`).

Self-dogfood has a **synthetic bias** the user is aware of:

> "저는 이걸 해달라고 할 친구가 없어서" — user, 2026-04-24

Treat the results below as **engineering-green signal only**. Real market validation is still owed to Phase 1 retrospectively when an alpha cohort materialises.

## What was simulated

Three personas, each attempting a plasmid-authoring scenario against the integrated Phase 1 system (`feature/GAL-1-phase-1` HEAD after all 5 teammate merges + integration fixes):

| Persona | File | Scenario | Target tier | Privacy |
|---|---|---|---|---|
| **P01 Anna** — Heavy Claude Code user, JS/TS monorepo | `persona-P01-anna-quick-pr-title.md` | Wants every PR title to match `chore|feat|fix(scope): …` via a primitive plasmid | L1 | cloud-ok |
| **P03 Chris** — Team lead, 8-dev team | `persona-P03-chris-team-governance.md` | Wants a team-governance plasmid that enforces checklist + reviewer policy | L3 | cloud-ok |
| **P05 Emma** — Privacy-sensitive legal team, Ollama user | `persona-P05-emma-foundational-legal-ollama.md` | Wants a foundational-legal L4 plasmid and refuses cloud access on principle | L4 | local-only |

Each run records: step-by-step actions, friction points, successes, time-to-complete.

## Delta vs Phase 0

See `delta-vs-phase-0.md` for a direct comparison against the four Phase 0 hypotheses (H1–H4) and the four ADJ remediations.

## File map

- `README.md` — this file
- `alpha-gate-decision.md` — PASS / CONDITIONAL / FAIL verdict + rationale
- `persona-P01-anna-quick-pr-title.md`
- `persona-P03-chris-team-governance.md`
- `persona-P05-emma-foundational-legal-ollama.md`
- `delta-vs-phase-0.md`
