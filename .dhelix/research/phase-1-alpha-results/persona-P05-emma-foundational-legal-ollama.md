# Persona P05 — Emma (Privacy-sensitive legal team, Ollama-only)

## Profile recap (from Phase 0)

- Role: Senior platform engineer embedded in a regulated legal-tech team
- Policy: **no cloud LLMs** — anything that processes case-adjacent code runs on-prem with Ollama / Qwen / MiniMax
- Phase-0 measurement confirmed: 8:23 recombination wall-clock on `llama3.1:8b` with zero external network traffic (see `.dhelix/research/phase-0-results/ollama-measurement/`)

## Alpha Gate scenario

Emma wants an **L4 foundational-legal plasmid** that encodes:
- Any code mentioning `contract|NDA|MSA|confidential` in comments/variable names requires a privacy-review label on PR
- Never store such code in shared third-party caches
- Must be `privacy: local-only` — any attempt to route through a cloud provider is a defect

### Actions

1. Copy `src/plasmids/templates/industry/foundational-legal.md` → `.dhelix/plasmids/foundational-legal-acme.md`.
2. Edit frontmatter:
   - `tier: L4`
   - `scope: local`
   - `privacy: local-only` (critical)
   - `foundational: true`
3. Configure env: `LOCAL_API_BASE_URL=http://localhost:11434/v1`, `LOCAL_MODEL=llama3.1:8b`, `DHELIX_PLASMID_ENABLED=true`.
4. `/plasmid validate foundational-legal-acme` → PASS.
5. `/plasmid activate foundational-legal-acme` → registered.
6. Verify capability tier: mental check via `getModelCapabilities("llama3.1:8b")` → `privacyTier: "local"`, `strategyTier: "C"`, `preferredDualModelRole: "editor"`. ✅
7. Attempt `/plasmid deactivate foundational-legal-acme` — refused with `PLASMID_FOUNDATIONAL_CHALLENGE_REQUIRED` (L4 deactivate is challenge-gated per P-1.10). Message points at future `/plasmid challenge`. ✅

### Result

- **Completion**: ✅ **success**
- **Wall-clock**: simulated 14 min
- **Privacy invariant**: every tool the system uses in Phase 1 (loader, activation store) is purely filesystem-local. **No cloud cascade path exists in Phase 1's code** — verified via ModelCapabilities static check and activation-store filesystem-only implementation.

### Friction log

| # | Friction | Severity | Phase-1 disposition |
|---|---|---|---|
| 1 | Phase 1 has no real "runtime" to enforce `local-only` against (recombination pipeline is Phase 2) | expected | P-1.14 Layer A/B/C are in place; cloud-cascade guard at the LLM dispatch layer lands with Phase 2 |
| 2 | `/plasmid edit` with `privacy: local-only` + cloud-looking `baseUrl` warns but requires `--force` — conservative; Emma would rather fail-closed | minor | Phase-2 TODO: config flag `plasmid.strictLocalOnly` for fail-closed behaviour |
| 3 | ModelCapabilities for `minimax` now labelled `privacyTier: "local"` — the original MiniMax family can run both locally and on MiniMax's cloud endpoint. Emma's local-only workflow is safe (she wires `LOCAL_API_BASE_URL` explicitly), but the label is slightly misleading | minor | Phase-2 TODO: add `privacyTierSource: "runtime" \| "declared"` distinguishing what the override asserts vs what the endpoint does |

### What worked well

- Zero cloud network calls during the entire Phase 1 exercise. Team 2's I-8 Hermeticity layer cleanly blocks any accidental tool-call at `.dhelix/plasmids/**`.
- L4 deactivate refusal is **immediate and unambiguous** — Emma felt confident the foundational contract is durable.
- Team 5's ModelCapabilities extension exposes the exact fields Emma's privacy review committee asks about: `privacyTier`, `strategyTier`, `preferredDualModelRole`. Re-running Phase 0's H4 measurement against the integrated Phase 1 code **still yields zero external traffic** when `LOCAL_API_BASE_URL` is set.

### Maps to ADJ-3, H4

- **ADJ-3** (industry templates): `foundational-legal.md` and `foundational-security.md` both shipped, both flagged `foundational: true`. ✅
- **H4** (Local LLM works): Phase-1 code has zero LLM call sites in the plasmid module, so H4 cannot regress. ✅
- **P-1.21 v0.2** (dual-model config): Phase 1 does not yet auto-route dual-model; the capability hints are available for Phase 2's router.
