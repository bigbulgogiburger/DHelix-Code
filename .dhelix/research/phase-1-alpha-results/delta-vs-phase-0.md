# Delta: Phase 1 Alpha (self-dogfood) vs Phase 0 findings

**Comparison date**: 2026-04-24
**Baseline**: `.dhelix/research/phase-0-results/go-no-go-decision.md` (Go tentative)
**Target**: this directory

## Hypothesis rollup

| Hypothesis | Phase 0 | Phase 1 Alpha (self-dogfood) | Delta |
|---|---|---|---|
| **H1** — painpoint exists | ✅ 4/5 personas named 3+ painpoints | ✅ 3/3 re-surfaced the same painpoints; none disappeared after exposure to Phase 1 code | **no regression** |
| **H2** — concept appeals | ✅ Q10 ≥4 on 4/5 | ✅ All 3 personas completed end-to-end (authoring → validate → activate) without abandoning | **unchanged positive signal** |
| **H3** — writable in 20 min | ⚠️ 3/3 Zod + rating, 1/3 time | ✅ 3/3 within 9-14 min (all under 20 min target) | **improved**: concrete templates + schema error messages cut cognitive load |
| **H4** — local LLM works | ✅ Ollama 8:23 / network 0 | ✅ Static check confirms zero cloud-cascade paths in Phase 1 code; Capability mapping correct | **maintained**: no new code violates H4 |

## Adjustments rollup (ADJ-1 … ADJ-4)

| Adjustment | Status in Phase 1 | Evidence |
|---|---|---|
| **ADJ-1** — Quick mode time expectation re-calibrated (20s LLM + 5–15 min user edit) | ✅ **in code** | `src/plasmids/quick-mode.ts` exports `QUICK_NOTICES.ko` / `.en`; returned in every `QuickResult.warnings`. Team 4 report line 3. |
| **ADJ-2** — L4 auto-gen priority inversion (eval-seeds first) | ⏳ **deferred to Phase 3** | Phase 1 implements L1 static validation only. P-1.23 schema supports the `tier: optional-but-warned` compatibility path that ADJ-2 needs. Team 1 report § "legacy 공존". |
| **ADJ-3** — Industry templates (foundational-legal, foundational-security, team-governance) | ✅ **shipped** | `src/plasmids/templates/industry/` contains all three; each validates structurally in `test/unit/plasmids/template-registry.test.ts`. |
| **ADJ-4** — Alpha Gate (external 3-5 user POC) | ⚠️ **self-dogfood (tentative PASS)** | User delegated to Claude Code because no external testers available. Real alpha cohort still owed — flagged as a Phase 2 Entry Gate re-check. |

## Risk notes — what self-dogfood cannot prove

1. **Tacit UX friction** — real users mis-type, mis-remember command names, skip docs. Claude's simulations approximate these but do not reproduce them. A single real user would likely surface at least one discoverability bug in a 20-min session.
2. **Template body quality** — Claude is the one who authored the 10 templates (Team 5), so the self-dogfood risks grading its own homework. Team 5 templates are structurally valid but "does this foundational-legal actually map to real legal teams' needs?" is not answered here.
3. **Ollama runtime with real LLM** — Phase 1 has no LLM call sites in `src/plasmids/`, so we cannot re-measure H4 wall-clock. Phase 2 will.

## Verdict

**Engineering-green**: Phase 1 delivers a correct, tested, type-safe foundation. Cloud / Local / Hermeticity Gates all pass.

**Market-green**: **deferred**. Real Alpha Gate remains owed. Record it as a Phase 2 Entry Gate re-check when alpha users materialise.

## What comes next

- Phase 2 W0: wire `/plasmid quick` + `/plasmid new` subcommands so ADJ-1 UI copy surfaces in the real CLI path.
- Phase 2 W1–W3: implement the 9-stage recombination pipeline (§6.3). This is where `privacy: local-only` enforcement becomes runtime, not just metadata.
- **Before Phase 2 Entry Gate**: re-run Alpha Gate with ≥3 real users if available. If still not available, record another self-dogfood pass and call out the synthetic bias compound.
