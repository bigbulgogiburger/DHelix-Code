# `src/recombination/` — 8-stage Recombination Pipeline (GAL-1, Phase 2+)

**Scaffold only.** Implementation lands in Phase 2 (execution-plan §4).

Phase 1 creates this directory so the 4-layer dependency check
(`madge --circular`) and the directory-structure tests observe the
agreed layout early.

## Planned structure (Phase 2)

- `pipeline.ts` — 9-stage orchestrator (discover → activate → interpret →
  compress → reorganize → validate-static → assemble → validate-runtime →
  commit)
- `stages/*.ts` — one file per stage
- `validation/` — L1–L4 validation framework (P-1.16 v0.2)
- `interpreter.ts` — natural-language → structured constraints (DD-1)

## Layer

**Core (Layer 2)** — imports from `llm/`, `tools/`, `plasmids/`.
No imports from `cli/` or `commands/`.
