# `src/recombination/validation/` — Phase 3 Runtime Validation

Implements Stage 6 of the 8-stage `/recombination` pipeline (PRD §6.3.2 +
§8 + P-1.16 + P-1.17 + P-1.23). Four validation levels (L1 direct, L2
indirect, L3 contextual, L4 adversarial) graded via a deterministic →
semi → LLM cascade, with volume governance per capability tier and
auto-rollback per I-10.

## Team ownership

| Team | Files | Contract |
|------|-------|----------|
| 1 — case gen + volume governor | `eval-seeds.ts`, `expectation-dsl.ts`, `case-generator.ts`, `volume-governor.ts` | `VolumeGovernorFn` + `GenerateCasesFn` |
| 2 — runtime exec + grading | `runtime-executor.ts`, `grader-cascade.ts`, `artifact-env.ts` | `RunCasesFn` + `GradeCasesFn` + `BuildArtifactEnvFn` |
| 3 — rollback + reporter + audit | `rollback-decision.ts`, `reporter.ts`, `override-tracker.ts`, `regression-tracker.ts` | `DecideRollbackFn` + grace IO + audit jsonl |
| 4 — `/cure` | `../cure/*`, `../../commands/cure/*` | `ExecuteCureFn` |
| 5 — executor wiring + facade | `index.ts` (`createValidate`), `../executor.ts` Stage 6/7, `../transcript.ts` extensions, `../../commands/recombination/extend.ts` | `ValidateFn` composition + integration tests |

All contracts: see `../types.ts` (Phase 3 section, line ~430+).

## Invariants

- **I-5**  validation-history + validation-overrides are append-only jsonl
- **I-8**  Runtime executor MUST run inside a CoW workspace; never mutate real project
- **I-10** L1/L2 fail → rollback; foundational L4 ≥5% fail → rollback; 10s grace period

## Rollout

Integration contract (this scaffold) committed first. Each team takes a
worktree, implements its files, and returns with unit tests. Team 5
merges + wires Stage 6/7 + writes integration tests + the final
`createValidate` composition.
