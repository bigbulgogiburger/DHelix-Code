# `src/plasmids/` — Plasmid & Recombination (GAL-1, Phase 1)

Feature-flagged module (`plasmid.enabled` / `DHELIX_PLASMID_ENABLED=true`).

## Layer

**Leaf (Layer 4)** — no imports from `cli/`, `core/`, or `tools/`.
Used by `commands/plasmid/` (Layer 5) and `tools/pipeline/preflight` (Layer 3).

## Public surface

`./types.ts` is the **single shared contract**. All teammates code against it.
See that file for `Plasmid*` types and invariant notes.

## Sub-modules

| File                         | Owner    | Purpose                                                   |
| ---------------------------- | -------- | --------------------------------------------------------- |
| `types.ts`                   | shared   | Public type contract (PRD §6.1 + §10.1)                   |
| `schema.ts`                  | Team 1   | Zod validators (P-1.23)                                   |
| `frontmatter.ts`             | Team 1   | YAML frontmatter split/parse                              |
| `parser.ts`                  | Team 1   | Markdown + eval-cases extraction                          |
| `loader.ts`                  | Team 1   | 4-scope file discovery + I-1 two-file lock                |
| `errors.ts`                  | Team 1   | PlasmidError hierarchy                                    |
| `runtime-guard.ts`           | Team 2   | RUNTIME_BLOCKED_PATTERNS + canonicalization (I-8 L1)      |
| `preflight-integration.ts`   | Team 2   | PreflightCheck wiring (I-8 L2)                            |
| `activation.ts`              | Team 3   | Activation-state store + conflict detection               |
| `quick-mode.ts`              | Team 4   | P-1.5 3-step flow                                         |
| `interview-mode.ts`          | Team 4   | Interview skeleton                                        |
| `generators.ts`              | Team 4   | Template interpolation                                    |
| `drafts.ts`                  | Team 4   | `.drafts/` cache                                          |
| `template-registry.ts`       | Team 5   | Template lookup by id                                     |
| `templates/**`               | Team 5   | 10 markdown templates (primitives/patterns/industry)      |

## Invariants

- **I-1** Two-file lock — a plasmid consists of `metadata.yaml` + `body.md`
  co-located under a single directory. Loader emits `PLASMID_ORPHAN_*` on
  mismatch.
- **I-7** Privacy — `privacy: local-only` plasmids MUST NOT traverse to a
  cloud provider. Enforcement at activation + at dispatch.
- **I-8** Compile-runtime hermeticity — plasmid bodies never flow into the
  agent's runtime context, only into compile-time system prompt assembly.
  `runtime-guard.ts` + preflight check enforce at tool-call boundary.
- **I-9** User-scope invariance — `activate`/`deactivate` mutate only
  ephemeral state; never the plasmid body on disk.
- **I-10** Rollback default-on — recombination runs opt-in for skip-rollback.

## Testing

```
test/unit/plasmids/*.test.ts
test/unit/commands/plasmid/*.test.ts
test/unit/tools/pipeline/plasmid-hermeticity.test.ts
```

## References

- PRD: `docs/prd/plasmid-recombination-system.md`
- Execution plan: `docs/prd/plasmid-recombination-execution-plan.md` §5
- Design docs: `docs/design/P-1.{1..23}-*.md`
