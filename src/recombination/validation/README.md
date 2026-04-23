# `src/recombination/validation/` — L1–L4 Validation Framework

**Scaffold only.** Implementation lands in Phase 3 (execution-plan §4).

Per P-1.16 v0.2:
- **L1** Schema + static checks (Phase 1 partial, handled in `src/plasmids/schema.ts`)
- **L2** Deterministic eval cases (Phase 2)
- **L3** Behavior probes (Phase 3)
- **L4** Subjective assessor (Phase 3, multilingual + auto-gen priority per ADJ-2)

Volume governor: standard 150 / governed 50 / minimal 20 per tier.
