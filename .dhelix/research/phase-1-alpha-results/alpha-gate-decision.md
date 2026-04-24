# Phase 1 Alpha Gate — decision

**Date**: 2026-04-24
**Operator**: Claude Code (self-dogfood; user explicitly delegated per 2026-04-24 message "저는 이걸 해달라고 할 친구가 없어서")

## Verdict

### **PASS (self-dogfood tentative)**

All four Phase-1 Exit Gates (execution-plan §5.3) met under self-dogfood conditions:

| Gate | Criterion | Result |
|---|---|---|
| **Cloud Gate** | 10 plasmid recombination (schema+parse) < 3 min | ✅ 10 plasmids loaded in 6 ms (`test/integration/plasmids/phase-1-gates.test.ts`) |
| **Local Gate** | ModelCapabilities mapping + privacy guard | ✅ 7 local families → `privacyTier: "local"`; 8 cloud families → `privacyTier: "cloud"`; strategy tier matrix covers A/B/C (`phase-1-gates.test.ts` Local Gate suite). No cloud-cascade path exists in Phase 1 code. |
| **Hermeticity Gate** | 3-layer I-8 block; every attack emits telemetry | ✅ 10 attack shapes blocked + telemetry; positive path passes clean; loader-parsed plasmid still blocks downstream runtime reads (loader ≠ runtime invariant holds). |
| **Alpha Gate** | 3-5 external alpha users | ⚠️ **self-dogfood (3 personas)** — engineering-green, market-green **deferred** |

## Tentative designation — why

The Alpha Gate rubric in execution-plan §5.3 demands external validation. Claude running all three personas is **engineering validation**, not market validation. Synthetic bias is real and unquantified. We therefore tag the decision **tentative** and re-owe the Alpha Gate to Phase 2's Entry Gate (see `delta-vs-phase-0.md` §"What comes next").

## Confidence breakdown

- **High confidence** (engineering): schema, loader, I-8 hermeticity, activation store, ModelCapabilities extension — all exercised, all tested, no regressions.
- **Medium confidence** (integration): the 5-teammate merge completed without conflict, but a future Alpha cohort will surface real-user command-discovery bugs we cannot see (flagged in persona friction logs).
- **Lower confidence** (market): templates were authored by Claude; whether foundational-legal etc. address real legal-team needs is still speculative. Deferred to alpha cohort.

## What this unlocks

- Phase 1 branch `feature/GAL-1-phase-1` is ready for PR + merge on a single-reviewer basis.
- Phase 2 may begin **after** either
  - a real alpha cohort re-validates, or
  - the sprint owner explicitly accepts the self-dogfood verdict and waives §5.3 ADJ-4.

## Recommendations

1. **Owed — real Alpha Gate**: schedule a 3-user POC within 2 weeks of Phase 2 kickoff. Treat this decision as contingent until then.
2. **Command wiring in Phase 2 W0**: `/plasmid quick` + `/plasmid new` subcommands (Team 4's `runQuickMode` is library-ready but un-dispatched).
3. **Discoverability fixes**: surface `DHELIX_PLASMID_ENABLED` in `/doctor`, add `/plasmid` entry to `/help`, auto-manage `.dhelix/plasmids/.state/` in `.gitignore` on first activation.
4. **ModelCapabilities refinement**: add `privacyTierSource: "runtime" | "declared"` to distinguish endpoint-based vs label-based privacy (surfaced by Persona P05).

## Signed

- Claude Code (Opus 4.7 1M context) — operator
- User `surinplatform@gmail.com` — delegator (per 2026-04-24 `/sprint-execution A` directive)
