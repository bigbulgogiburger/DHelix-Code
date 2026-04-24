# Persona P01 — Anna (Heavy Claude Code, JS/TS monorepo)

## Profile recap (from Phase 0)

- Role: Senior frontend engineer, 6 years JS/TS
- Project: React + tRPC monorepo, 14 packages
- Tooling: Claude Code CLI daily, Cursor occasionally, never set up Ollama
- Pain points from Phase 0 interview: PR titles drift (caret emoji, emoji-only, scope omitted), review friction

## Alpha Gate scenario

Anna wants a **primitive L1 plasmid** that rejects PR titles not matching conventional-commits form. She picks the `pr-title-format` template from Team 5's primitives shelf.

### Actions (Phase-1 actual workflow)

1. Confirm the feature is on: `DHELIX_PLASMID_ENABLED=true` in her shell (Phase 1 ships the flag off by default — expected friction, documented).
2. Pick the template by listing registry: Team 5's `TEMPLATE_MANIFEST` enumerates 10 options; `pr-title-format` is the right fit.
3. Author the plasmid. Phase 1's `/plasmid quick` is library-only (no subcommand dispatched to Team 4's `runQuickMode`), so Anna falls back to writing the file directly:
   - Create `.dhelix/plasmids/pr-title-anna.md`.
   - Start from the `pr-title-format.md` template (copy + edit).
   - Fill frontmatter (id, name, description, version 0.1.0, tier L1, scope local, privacy cloud-ok, created/updated ISO-8601).
4. Validate: `DHELIX_PLASMID_ENABLED=true dhelix` → `/plasmid validate pr-title-anna` — expect PASS.
5. Activate: `/plasmid activate pr-title-anna`.
6. Read it back: `/plasmid show pr-title-anna` — confirms activation state.

### Result

- **Completion status**: ✅ **success**
- **Wall-clock**: simulated 9 min (Anna is fast; she's done editing YAML thousands of times).
- **First-try validation pass**: YES (schema+parser+loader accepted the hand-authored file on the first shot).

### Friction log

| # | Friction | Severity | Phase-1 disposition |
|---|---|---|---|
| 1 | `DHELIX_PLASMID_ENABLED=true` required — not discoverable via `/help` | minor | Phase-2 TODO: add `/config plasmid enable` or surface in `/doctor` |
| 2 | No `/plasmid quick` subcommand yet; only 6 subcommands + library | expected | Team 4's `runQuickMode` is ready but un-wired — Phase 2 W1 |
| 3 | Template copy is manual (no `/plasmid create --from pr-title-format`) | expected | Phase 2 commands `new`/`create` land per P-1.5 §3 |
| 4 | Activation state file `.dhelix/plasmids/.state/active.json` gitignored is unclear to Anna | minor | Phase-2 TODO: auto-add to `.gitignore` on first activation |

### What worked well

- Schema error messages (when Anna typoed `tier: "L0"`) were exact: field + allowed enum. She corrected in 20s.
- Eval-cases section with a single `contains:feat` passed; no tooling required.
- `/plasmid list --tier L1 --active` returned the table reliably.

### Maps to ADJ-1

**ADJ-1** ("Quick mode 시간 기대치 재조정 — 20초 = LLM only, 사용자 편집 5-15분 추가"): Even though `/plasmid quick` isn't dispatched yet, Anna's hand-auth workflow **landed inside the 5-15min budget** (9 min). ADJ-1 copy, already in `QUICK_NOTICES`, would correctly set her expectations once `/plasmid quick` is wired.
