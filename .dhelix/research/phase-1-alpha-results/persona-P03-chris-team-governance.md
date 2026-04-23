# Persona P03 — Chris (Team lead, 8-dev backend team)

## Profile recap (from Phase 0)

- Role: Staff backend engineer / tech lead, Python + Go + Rust shop
- Project: internal data platform, 3 services + a CLI
- Pain: reviewer drift — people skipping eval updates, test gaps, mismatched PR descriptions
- Seeks: team-level governance without resorting to pre-commit hooks he has to maintain

## Alpha Gate scenario

Chris wants a **team-governance L3 plasmid** (ADJ-3 industry template) encoding:
- PR description must mention linked Jira ticket
- Reviewer must be in the `@team-backend-core` group
- Changes to `services/*/migrations/**` require a second reviewer

### Actions

1. Copy `src/plasmids/templates/industry/team-governance.md` into `.dhelix/plasmids/team-governance.md`.
2. Edit frontmatter → `tier: L3`, `scope: shared`, `privacy: cloud-ok`, set `sharedRegistryPath` in project config to a git submodule `.team-plasmids/`.
3. Edit the body: three rule sections (PR description / reviewer group / migration reviewer count).
4. `/plasmid validate team-governance` → PASS.
5. `/plasmid activate team-governance` — store writes `.dhelix/plasmids/.state/active.json`.
6. Commits the plasmid file to the team submodule so peers pick it up.

### Result

- **Completion**: ✅ **success**
- **Wall-clock**: simulated 13 min (team-governance is the heaviest template; body editing took longer).
- **Schema validation**: PASS on first re-run after one field-order tweak (Chris initially put `scope` before `description`; schema is strict but order-agnostic, so this was a non-issue).

### Friction log

| # | Friction | Severity | Phase-1 disposition |
|---|---|---|---|
| 1 | `shared` scope loader requires `sharedRegistryPath` — undocumented in any command's help text | moderate | Phase-2 TODO: `/plasmid show --scope shared` should print the expected registry path or a hint |
| 2 | No way to test "reviewer policy" enforcement from Phase 1 — only schema validation exists | expected | Recombination pipeline (Phase 2) is where behavioural enforcement lands |
| 3 | Eval cases DSL has no domain-specific reviewer matchers yet (`reviewer-in-group:@team-backend-core`) | expected | P-1.23 §4 extensions targeted for Phase 3 L4 validation layer |

### What worked well

- `team-governance.md` template is concrete enough that Chris didn't need to invent YAML keys.
- `/plasmid list --scope shared` returned his plasmid + metadata after he pointed config at the submodule.
- Merge-safety check in activation (cycle detection) surfaced a self-reference bug in a draft iteration immediately.

### Maps to ADJ-3

**ADJ-3** ("industry template 추가 — foundational-legal, foundational-security, team-governance"): All three industry templates are shipped (`src/plasmids/templates/industry/`). Chris used the `team-governance` one; its frontmatter validates cleanly and the body prompts for the three rule dimensions he needs. ✅
