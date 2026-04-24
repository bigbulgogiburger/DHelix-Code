---
issue: GAL-1 Phase 5
status: dev-guide v1.0
date: 2026-04-24
---

# GAL-1 Phase 5 — Research-Assisted + Foundational + `/plasmid challenge`

> SSOT: PRD §9 (Research-Assisted) + PRD §22.4 (Foundational) + design docs
> P-1.5 v0.2, P-1.10 v0.2. Living plan: `docs/prd/plasmid-recombination-execution-plan.md`.

## Phase scope (PRD §13)

- [ ] `/plasmid --research` — WebSearch + WebFetch + scope/question aggregation
- [ ] Source tracking + evidence preservation (`source.references`)
- [ ] **Foundational** plasmid challenge ceremony — `/plasmid challenge <id>` 3-option
      flow (override / amend / revoke) with cooldown + audit log
- [ ] Privacy enforcement on the research path (`privacy: local-only` MUST NOT call
      WebSearch/WebFetch silently)
- [ ] `/plasmid` Phase-5 surface additions: `archive`, `challenge`, `inspect compression`,
      `--research`, `--from-file`, `--template`, `--dry-run` flags

## 0. Integration Contract — pre-committed

Phase 5 adds the following symbols to **`src/recombination/types.ts`** and a new
governance module surface in **`src/plasmids/governance/types.ts`**. Teams MUST
NOT change the contract without a huddle.

| Added symbol | Owner | Consumers |
|---|---|---|
| `ResearchSource`, `ResearchSourceRef` | T1 | T2 (research-mode), T5 (transcript) |
| `ResearchSession`, `RESEARCH_MAX_SOURCES = 5`, `RESEARCH_PER_PAGE_BUDGET_TOKENS = 4000` | T1 | T2 |
| `WebSearchFn`, `WebFetchFn` (DI seam types) | T1 | T2 |
| `ChallengeAction = "override" \| "amend" \| "revoke"` | T3 | T4, /plasmid command |
| `ChallengeLogEntry` (Zod-derived), `CHALLENGE_LOG_PATH = ".dhelix/governance/challenges.log"` | T3 | T4 |
| `OverridePending` (consume tracker), `OVERRIDE_PENDING_PATH = ".dhelix/governance/overrides.pending.json"` | T3 | T5 (executor Stage 0) |
| `CooldownDecision = { ok: true } \| { ok: false; waitUntil: Date; remainingMs: number }` | T3 | T4 |
| `PlasmidErrorCode` additions: `PLASMID_RESEARCH_PRIVACY_BLOCKED`, `PLASMID_RESEARCH_NETWORK_ERROR`, `PLASMID_CHALLENGE_COOLDOWN`, `PLASMID_CHALLENGE_JUSTIFICATION_TOO_SHORT`, `PLASMID_CHALLENGE_NOT_FOUNDATIONAL`, `PLASMID_OVERRIDE_CONSUMED` | T3 | T4, T5 |
| `PlasmidMetadata.source?: ResearchSource` (optional, forward-compat) | T1 | loader (additive — schema extension) |
| `PlasmidMetadata.challengeable?: ChallengeableBy` (optional, only validated when `foundational: true`) | T3 | loader, T4 |

## 1. Team layout (5-team parallel, worktree-isolated)

```
Team 1 — research-mode core (research-mode.ts + sources.ts + Zod schema additions)
Team 2 — research command flow + WebSearch/Fetch wiring + privacy gate
Team 3 — governance core (challenges-log.ts + cooldown.ts + overrides-pending.ts)
Team 4 — /plasmid challenge subcommand (3-option flow, archive subcommand)
Team 5 — executor override consumption + transcript additions + /plasmid surface (archive, inspect compression, flags)
```

Each team works in a dedicated worktree forked from the current HEAD of
`feature/GAL-1-phase-1`. Teams commit to their branch; the orchestrator merges
back via fast-forward (or cherry-pick on conflict).

**The integration contract + scaffold + this guide are pre-committed BEFORE any
worktree is forked**, so every team sees an identical contract surface and there
is no base-race (Phase 2/3 lessons reflected).

## 2. Team 1 — research-mode core

**Scope**: type contract + research session orchestration (model-agnostic shell;
the actual web tool calls are wired by Team 2). All work is **in-memory** —
this module never touches disk or makes HTTP calls itself; it consumes
`WebSearchFn` + `WebFetchFn` provided by Team 2 via DI.

**Files to create**:
- `src/plasmids/research-mode.ts` — exported `runResearchMode(input, deps, signal): Promise<ResearchResult>`
- `src/plasmids/research/sources.ts` — pure helpers: dedupe by canonical URL, rank by snippet+title token overlap, slice top N
- `src/plasmids/research/types.ts` — module-local types (re-exports the contract symbols imported from `../recombination/types`)
- `src/plasmids/__tests__/research-mode.test.ts` — co-located unit tests
- `src/plasmids/__tests__/sources.test.ts`

**Files to extend**:
- `src/plasmids/types.ts` — add `ResearchSource`, `ResearchSourceRef`,
  `PlasmidMetadata.source?`. ALSO add the new `PlasmidErrorCode` literals
  listed in §0 (only the `PLASMID_RESEARCH_*` subset).
- `src/plasmids/schema.ts` — extend `plasmidMetadataSchema` to accept
  optional `source: { references: ResearchSourceRef[]; researchedAt: ISO; engine: string }`.

**Contract** (matches PRD §9.1 + §9.4):

```typescript
export interface ResearchSourceRef {
  readonly url: string;            // canonical (https://, lowercase host, trailing-slash stripped)
  readonly title: string;          // search-result title
  readonly snippet?: string;       // optional 1-2 sentence summary
  readonly fetchedAt: string;      // ISO-8601, when WebFetch was attempted
  readonly contentSha256?: string; // hash of the fetched-and-stripped body
                                   //   omitted when fetch was skipped/failed
}

export interface ResearchSource {
  readonly engine: "web";          // forward-compat: "rag" | "kb" later
  readonly query: string;
  readonly references: readonly ResearchSourceRef[];
  readonly researchedAt: string;
}

export interface ResearchInput {
  readonly intent: string;         // user's natural-language request
  readonly currentDraft?: Partial<PlasmidMetadata>; // when entering from Quick mode (P-1.5 §Q2)
  readonly maxSources?: number;    // default RESEARCH_MAX_SOURCES (5)
  readonly locale?: "ko" | "en";
}

export interface ResearchResult {
  readonly synthesizedDraft: string;    // markdown body (no frontmatter)
  readonly metadataPatch: Partial<PlasmidMetadata>;  // includes `source`
  readonly sources: ResearchSource;
  readonly warnings: readonly string[];
}

export type WebSearchFn = (req: { query: string; maxResults: number; signal: AbortSignal })
  => Promise<readonly { url: string; title: string; snippet?: string }[]>;
export type WebFetchFn = (req: { url: string; signal: AbortSignal })
  => Promise<{ body: string; contentSha256: string }>;
```

**Privacy gate (MANDATORY)**: `runResearchMode` must throw a typed
`PlasmidResearchError({ code: "PLASMID_RESEARCH_PRIVACY_BLOCKED" })` when:
- `input.currentDraft?.privacy === "local-only"`, OR
- `deps.allowNetwork === false` (set by Team 2 when active LLM provider is local-only **AND** the user did not pass `--research --force-network`)

**MUST**:
- Source dedupe by canonical URL (drop tracking params: `utm_*`, `gclid`, `fbclid`).
- Rank candidates by overlap of intent tokens × (title + snippet); cap at `maxSources` (default 5, hard ceiling 8).
- For each top source, fetch via `deps.fetch` with `signal`; tolerate per-source failures (record fetch attempt with `contentSha256` omitted, continue).
- Synthesise the body via `deps.llm` only AFTER fetches complete; pass an explicit `system` prompt that includes the retrieved snippets verbatim and instructs "cite source IDs `[1]`, `[2]` inline".
- Persist nothing to disk. Caller (Team 2) decides when to write a draft.

**MUST NOT**:
- Call HTTP libraries directly (use injected `WebFetchFn`).
- Change existing `quickModeSchema` semantics.
- Default `tier` to `L4` — research-derived plasmids inherit `currentDraft?.tier ?? "L2"`.

**Tests** (Vitest, ≥10 cases):
- happy-path: 3 search results → 3 fetches → `references.length === 3`
- privacy-blocked: `currentDraft.privacy = "local-only"` throws structured error before any DI call
- partial fetch failure: 3 results, 1 fetch throws → result has 3 refs (1 with no `contentSha256`)
- dedupe: 5 results with 2 duplicate canonical URLs → 3 refs
- abort: signal aborted mid-fetch propagates `DOMException("AbortError")`

## 3. Team 2 — `/plasmid --research` command + WebSearch/Fetch wiring

**Scope**: glue Team 1's pure orchestrator to the real `web_search` and `web_fetch`
tools, surface the `--research` flag on `/plasmid`, and persist the resulting
draft.

**Files to create**:
- `src/plasmids/research/web-adapter.ts` — production adapters that wrap
  `webSearchTool` (`src/tools/definitions/web-search.ts`) + `webFetchTool`
  (`src/tools/definitions/web-fetch.ts`) into the `WebSearchFn`/`WebFetchFn`
  shapes.
- `src/commands/plasmid/research.ts` — `researchSubcommand(args, ctx, deps)`
- `src/plasmids/__tests__/research-web-adapter.test.ts` — test the canonicalisation + error mapping

**Files to extend**:
- `src/commands/plasmid/index.ts` — add `--research` flag + `research` subcommand routing.
  Also wire the four flags: `--from-file <path>`, `--template <name>`, `--dry-run`.
- `src/commands/plasmid/deps.ts` — add `webSearch?: WebSearchFn`, `webFetch?: WebFetchFn`,
  `getActiveProviderPrivacyTier?: () => "local" | "cloud" | "unknown"`.
  Production factory wires the real tool adapters; tests stub.

**Privacy enforcement matrix**:

| Condition | Behavior |
|-----------|----------|
| `--research` AND active provider is local-only AND no `--force-network` | error `PLASMID_RESEARCH_PRIVACY_BLOCKED`, exit non-zero |
| `--research` AND `--from-file` plasmid has `privacy: local-only` | error `PLASMID_RESEARCH_PRIVACY_BLOCKED` |
| WebSearch returns 0 results | warn + fall back to Quick mode draft (no error) |
| WebFetch all fail | error `PLASMID_RESEARCH_NETWORK_ERROR`; preserve any partial sources |

**Phase-1 default deps wiring** (production):

```typescript
// src/commands/plasmid/deps.ts (sketch)
return {
  // ... existing fields ...
  webSearch: (req) => webSearchAdapter(req),
  webFetch: (req) => webFetchAdapter(req),
  getActiveProviderPrivacyTier: () => detectProviderPrivacyTier(),
};
```

**MUST**:
- Use the `executeViaToolDefinition` helper if one exists; otherwise call `webSearchTool.execute({...}, ctx)` + map result string → structured form. Verify shape via Zod parser in adapter.
- Honour `signal` end-to-end (the tools accept `ToolContext` which already carries `signal`).
- After `runResearchMode` returns, save draft via existing `DraftsStore` + return `QuickResult`-shaped object so `/plasmid` UX stays unified.
- Append `--dry-run` semantics: when set, return the rendered draft markdown in `CommandResult.output` and DO NOT persist.

**MUST NOT**:
- Call `fetch()` / `https.request` directly — go through the existing tool definitions so guardrails + permissions apply.
- Edit `webSearchTool` / `webFetchTool` source.

**Tests** (≥8 cases):
- e2e: stubbed `webSearch` returns 3 results, `webFetch` returns 3 bodies → draft saved + `output` lists references
- privacy-blocked at command level (provider=cloud, plasmid privacy=local-only)
- `--dry-run` → no draft written, output contains body
- `--from-file` reads existing plasmid metadata, passes `currentDraft`
- `--template foundational-security` short-circuits research and uses template (still validate flag interplay)
- network error path returns `PLASMID_RESEARCH_NETWORK_ERROR`

## 4. Team 3 — Governance core (challenges-log + cooldown + override-pending)

**Scope**: the storage + decision primitives that gate foundational mutation.
Pure data-layer code; no UI. Team 4 consumes this from the command handler.

**Files to create**:
- `src/plasmids/governance/types.ts` — re-exports the public symbols, defines
  `ChallengeableBy` Zod schema.
- `src/plasmids/governance/challenges-log.ts` — `appendChallenge`, `readChallengesLog`, `queryChallenges`, `computeChallengeRate(plasmidName, "7d"|"30d")`.
- `src/plasmids/governance/cooldown.ts` — `parseCooldown(s)`, `checkCooldown(plasmid, action, log)` returns `CooldownDecision`. **Override never sets a cooldown**; only amend + revoke do (P-1.10 §4.2).
- `src/plasmids/governance/overrides-pending.ts` — single-file JSON tracker for one-shot overrides:
  `{ pending: Array<{ plasmidId, queuedAt, rationaleHash }> }`.
  Methods: `enqueueOverride(plasmidId, rationale)`, `consumeOverride(plasmidId): boolean`, `peekPending(): readonly OverridePending[]`.
- `src/plasmids/__tests__/challenges-log.test.ts`
- `src/plasmids/__tests__/cooldown.test.ts`
- `src/plasmids/__tests__/overrides-pending.test.ts`

**Files to extend**:
- `src/plasmids/types.ts` — add `ChallengeableBy` interface + `PlasmidMetadata.challengeable?`. Add the new error codes from §0.
- `src/plasmids/schema.ts` — extend `plasmidMetadataSchema` with optional `challengeable: challengeableBySchema`. Add `superRefine`: when `foundational: true`, `challengeable` is optional but if absent we default to `{ "min-justification-length": 50, "require-cooldown": "24h", "audit-log": true, "require-justification": true }` at read time (in the loader, NOT in the schema, because Zod transforms would change the public type — see §6).

**`ChallengeableBy` schema** (verbatim, P-1.10 §2):

```typescript
export const challengeableBySchema = z.object({
  "require-justification": z.boolean().default(true),
  "min-justification-length": z.number().int().min(20).default(50),
  "audit-log": z.boolean().default(true),
  "require-cooldown": z.string().regex(/^\d+[hdw]$/).default("24h"),
  "require-team-consensus": z.boolean().default(false),  // v0.5+ schema only
  "min-approvers": z.number().int().min(1).default(1),
  "approver-roles": z.array(z.string()).optional(),
}).strict();
```

**`ChallengeLogEntry`** (P-1.10 §5.1):

```typescript
export const challengeLogEntrySchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  plasmidId: z.string(),
  action: z.enum(["override", "amend", "revoke"]),
  rationale: z.string().min(20),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  previousHash: z.string().optional(),
  newHash: z.string().optional(),
  dependentsAction: z.enum(["kept","orphaned","revoked"]).optional(),
  teamApprovals: z.array(z.object({ userId: z.string(), approvedAt: z.string() })).optional(),
}).strict();
```

**MUST**:
- `appendChallenge` uses `appendFile` with `{ flag: "a" }` → append-only (matches I-5 transcript pattern).
- `readChallengesLog` tolerates `\r\n`, blank lines, and the file not existing (returns `[]`).
- `parseCooldown("24h" | "3d" | "1w")` strict regex; throw on invalid.
- `consumeOverride` is **idempotent**: returns `true` exactly once per pending entry, then `false`. Implementation: read → match first pending entry by `plasmidId` → atomic write the modified file (`writeFile` to `.tmp` + `rename`).

**MUST NOT**:
- Write logs from worker threads (one writer = the command handler, serialised through advisory lock when amending/revoking). Override append is best-effort + `O_APPEND`.
- Mutate `ChallengeLogEntry` after write.

**Tests** (≥15 cases): schema acceptance/rejection (foundational w/o challengeable allowed in schema but defaulted by loader; min-justification-length < 20 rejected), append+read round-trip, parseCooldown (`"24h"`, `"3d"`, `"1w"`, invalid), checkCooldown (`override` never starts cooldown for next amend), enqueue→consume→consume returns false, atomic write resilience.

## 5. Team 4 — `/plasmid challenge` subcommand (3-option flow)

**Scope**: the user-facing 3-option ceremony from P-1.10 §3 (override / amend /
revoke), routed through Team 3's primitives.

**Files to create**:
- `src/commands/plasmid/challenge.ts` — `challengeSubcommand(args, ctx, deps)`
- `src/commands/plasmid/__tests__/challenge.test.ts` (or `test/unit/commands/plasmid/challenge.test.ts` — match existing pattern in repo)

**Files to extend**:
- `src/commands/plasmid/index.ts` — add `challenge` subcommand routing.
- `src/commands/plasmid/deps.ts` — add `appendChallenge`, `checkCooldown`,
  `enqueueOverride`, `findDependentPlasmids` to `CommandDeps`. Production factory wires Team 3's exports.

**Flow** (CLI argument parsing, NOT interactive terminal — Phase 5 keeps it
non-interactive like Phase 3 `/cure`; `--yes` gate where appropriate):

```
/plasmid challenge <id> --action override --rationale "<text>"
/plasmid challenge <id> --action amend    --rationale "<text>" [--yes]
/plasmid challenge <id> --action revoke   --rationale "<text>" --dependents <keep|orphan|revoke> [--confirm REVOKE <id>]
/plasmid challenge <id>           # no args → print preview + ceremony requirements
```

**Validation order** (fail-fast, return structured `CommandResult`):
1. plasmid exists + loaded (else `PLASMID_NOT_FOUND`)
2. plasmid is foundational (`metadata.foundational === true`); else `PLASMID_CHALLENGE_NOT_FOUNDATIONAL`
3. action ∈ { override, amend, revoke }
4. rationale length ≥ effective `min-justification-length` (resolved with the loader's default-fill); else `PLASMID_CHALLENGE_JUSTIFICATION_TOO_SHORT`
5. for amend/revoke: `checkCooldown` must be `ok: true`; else `PLASMID_CHALLENGE_COOLDOWN`
6. for revoke: `--confirm REVOKE <id>` typed verbatim
7. for revoke: resolve `dependents` via `findDependentPlasmids(id, allLoaded)` (intersect `requires`, `extends`, `conflicts`)

**Action effects** (idempotent surface):

- `override`: `enqueueOverride(id, rationale)` + `appendChallenge({action:"override"})`. Returns text describing how to consume (next `/recombination` will skip this plasmid).
- `amend`: `appendChallenge({action:"amend", previousHash})` THEN `editSubcommand`-style hand-off to `$EDITOR` (NOT auto-applied — the user's edit produces the new body; on save we recompute `newHash` and append a follow-up entry). For Phase 5 v1 keep this simpler: open editor, on close re-read body, append amend entry with both hashes, advise user to run `/recombination`.
- `revoke`: archive plasmid `.md` (move to `.dhelix/plasmids/archive/<id>-<ISO>.md`), append entry, mark dependents per flag.

**MUST**:
- Use `safe-fs` move semantics (atomic on same FS) for revoke archive.
- Return `success: false` for any validation gate failure with a clear human-readable hint.
- For `override`, surface the queued entry path (`OVERRIDE_PENDING_PATH`) so the user can inspect.

**MUST NOT**:
- Allow `--action amend` to bypass the cooldown gate via `--yes`.
- Rewrite the plasmid body itself (only the user's editor does that).

**Tests** (≥12 cases): all 6 validation gates (each rejection path), happy override → file appended, happy amend opens editor (mock $EDITOR), revoke moves to archive, revoke dependents=orphan marks 3 deps, cooldown blocks 2nd amend, override doesn't set cooldown, idempotent override consumption integration with executor (mock executor).

## 6. Team 5 — Executor override consumption + transcript additions + `/plasmid` surface

**Scope**: the small executor edit that makes overrides actually take effect, the
transcript field that records consumed overrides, and the remaining `/plasmid`
subcommand additions (`archive`, `inspect compression`).

**Files to extend**:
- `src/recombination/executor.ts` — Stage 0 / Stage 1: after `loadPlasmids` + activation
  filter, call `consumeOverridesFor(loadedActivePlasmids)` and **drop** any plasmid id
  for which `consumeOverride` returns true. Emit a transcript stage entry
  `stageId: 0, name: "preflight", consumedOverrides: [<plasmidId>]` so cure/audit can find them.
- `src/recombination/types.ts` — add optional `consumedOverrides?: readonly PlasmidId[]` to `RecombinationTranscript` (forward-compat, Phase 4 transcripts ignore it).
- `src/recombination/transcript.ts` — `recordConsumedOverrides(ids)` method.
- `src/commands/plasmid/index.ts` — add `archive` + `inspect compression` subcommands.
- `src/plasmids/loader.ts` — apply default-fill for `metadata.challengeable` when `foundational: true`.

**Files to create**:
- `src/commands/plasmid/archive.ts` — moves plasmid file to `.dhelix/plasmids/archive/<id>-<ISO>.md`. **Refuses** when `metadata.foundational === true` (must go through `/plasmid challenge … --action revoke`).
- `src/commands/plasmid/inspect.ts` — `inspect compression <id>` reads the most recent `RecombinationTranscript` for that plasmid and prints body→summary token counts + compression ratio + preserved-constraint list. Pure — no LLM call. Reads `.dhelix/recombination/transcripts/`.
- `src/recombination/__tests__/executor-override-consumption.test.ts` — integration: enqueue override → run executor → verify plasmid skipped + transcript records the consumption + 2nd executor run does NOT skip (override consumed once).

**MUST**:
- Override consumption is best-effort (overrides-pending file missing → no-op, do not fail the run).
- `archive` rejection for foundational MUST cite `/plasmid challenge --action revoke` as the path.
- `inspect compression` returns a clean error if no transcript references the plasmid.
- Loader default-fill is in the loader, not the Zod schema (schema stays narrow + failure-only); rationale: Zod transforms create a wider input type that breaks existing tests.

**MUST NOT**:
- Touch `src/plasmids/runtime-guard.ts` (I-8 must remain identical — `.dhelix/governance/` is **also blocked** from runtime; verify your changes don't expose it).
- Persist the consumed override list back to the JSON pending file in any format other than the atomic `.tmp + rename` already used.

**Tests** (≥6 cases): override consumed exactly once across two executor runs; archive of non-foundational → file moves; archive of foundational → rejected with hint; inspect compression with no transcript → graceful error; inspect compression happy path; transcript shape stays Phase-4 compatible (consumedOverrides field absent when none consumed).

## 7. I-8 / I-1 / I-5 / I-9 / I-10 — invariants to NOT violate

| Invariant | Phase 5 risk | Mitigation |
|-----------|-------------|------------|
| **I-1** plasmid `.md` immutable | revoke moves file (allowed); amend opens $EDITOR (user-driven, allowed) | Never let executor / research-mode write to the plasmid `.md`. Use `archive/` move for revoke. |
| **I-5** transcripts/log append-only | challenge log + override-pending file | Use `appendFile {flag:"a"}` for log; for override-pending use atomic `.tmp+rename` (it's a small mutable cache, NOT a log). |
| **I-8** runtime hermeticity | new `.dhelix/governance/` directory | Verify `RUNTIME_BLOCKED_PATTERNS` already covers `.dhelix/governance/` OR add it. Add a hermeticity-attack test (`test/unit/plasmids/hermeticity-attack.test.ts`) for `.dhelix/governance/challenges.log`. |
| **I-9** constitution user-area unchanged | None expected (Phase 5 doesn't touch DHELIX.md) | n/a |
| **I-10** auto-rollback | foundational L4 already enforced (Phase 3) | When override consumes a foundational plasmid, validation skips it for that run — verify the rollback decision still fires for *other* plasmids' L1/L2 misses. |

**Privacy invariant (PRD §10.1, P-1.21)**: research mode MUST NOT call WebSearch
when the active LLM provider is private OR the plasmid is `privacy: local-only`.
Privacy enforcement runs **before** any tool call (in research-mode + adapter).
The existing `enforcePrivacy(caps, plasmids)` in `src/recombination/strategy.ts`
covers the recombination path; research is a parallel path so we add a sibling
gate in Team 1 + Team 2.

## 8. Test layout

- Unit (per team, listed above) — Vitest, co-located OR `test/unit/...` mirroring existing pattern.
- Integration: `test/integration/plasmids/research-flow.test.ts` — full `/plasmid --research "OWASP basics"` E2E with stubbed `webSearch` + `webFetch`, asserts:
  draft saved, `metadata.source.references` has correct shape, no I-8 violation, `--dry-run` doesn't persist.
- Integration: `test/integration/plasmids/challenge-flow.test.ts` — full `/plasmid challenge` E2E for all 3 actions, asserts log entries, cooldown gating across two runs, override consumed by executor.
- Hermeticity: extend `test/unit/plasmids/hermeticity-attack.test.ts` with one case for `.dhelix/governance/challenges.log` read attempt → blocked.

**Coverage target**: ≥85% for new modules, must not regress global coverage.

## 9. Ordering / merge plan

1. **Pre-commit** (orchestrator does this BEFORE forking worktrees):
   - `src/recombination/types.ts` Phase-5 additions
   - `src/plasmids/types.ts` Phase-5 additions (+ ChallengeableBy interface)
   - `src/plasmids/schema.ts` extension for optional `source` + `challengeable`
   - empty scaffold files for every team's new module path
   - this dev-guide
   - update `vitest` include to cover `src/plasmids/__tests__/` (already covers Phase-4 layout)
2. **Fork 5 worktrees** from the resulting commit.
3. **Merge order**: T3 → T1 → T2 → T4 → T5. T3 and T1 are independent of each
   other and could be merged in either order, but T3 first lets T1's research
   path import the contract without surprise. T5 last because it touches
   executor + index.ts (most likely conflict surface).
4. **Conflict policy**: prefer manual 3-way (`git checkout --conflict=diff3`).
   The most likely conflict is `src/commands/plasmid/index.ts` (T2/T4/T5 all
   add subcommands) and `src/commands/plasmid/deps.ts` (T2/T3/T4 all add deps
   fields). Resolve by union-merge.

## 10. Quality gates (Phase 5 Exit Criteria)

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean (0 errors; warnings allowed only if pre-existing)
- [ ] `npm test` all green; **≥7700** tests (baseline 7592 + ~110 Phase-5)
- [ ] `npm run build` clean
- [ ] `npx madge --circular src/` no NEW cycles vs Phase-4 baseline (31 cycles)
- [ ] Manual invariant check (I-1, I-5, I-8, I-10) — see §7
- [ ] `/plasmid --research "..."` dry-run on dummy provider returns a draft with non-empty `references`
- [ ] `/plasmid challenge core-values --action override --rationale "<...>"` enqueues, then next `/recombination` consumes it (test/integration)
- [ ] Privacy gate test: research with `privacy: local-only` plasmid → blocked

## 11. Out of scope (Phase 6 / later)

- Real terminal interactivity for the challenge flow (Phase 5 is CLI-flag-driven; Phase 6 adds prompts).
- Team consensus UI (`require-team-consensus: true`) — schema only, no enforcement.
- Challenge-rate dashboard panel.
- RAG/local-KB research backend (`engine: "rag"`).
- `/plasmid history` / `/plasmid snapshot` — Phase 6.

## 12. Reference

- PRD §9 — Research-Assisted Authoring
- PRD §22.4 — Foundational Plasmid (v0.3)
- PRD §10.1 — Invariants (I-1..I-10)
- P-1.5 v0.2 — `/plasmid` Quick-First (research mode UX in §3.3)
- P-1.10 v0.2 — Foundational + challenge schema, 3-option flow, cooldown
- P-1.21 v0.2 — Privacy enforcement (cloud blocked)
- `.claude/docs/reference/recombination-pipeline.md` — Phase 2/3/4 module map
