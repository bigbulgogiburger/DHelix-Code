---
issue: GAL-1 Phase 4
status: dev-guide v1.0
date: 2026-04-24
---

# GAL-1 Phase 4 — Advanced Generators + `/recombination --mode rebuild` + Cure v1 (3-way merge)

**Phase scope (PRD §13)**:

- [ ] agent / hook / harness generator
- [ ] Permission alignment 검증
- [ ] `/recombination --mode rebuild`
- [ ] Cyclical dependency 검사
- [ ] Cure v1 — modify rollback 3-way merge

## 0. Integration Contract

Types are **already pre-committed** to `src/recombination/types.ts`. Teams MUST NOT change the contract without calling for a huddle.

| Added symbol | Owner | Consumers |
|---|---|---|
| `HOOK_GENERATOR_EVENTS`, `isHookGeneratorEvent` | T2 | T3 (validator), executor |
| `ArtifactTrustLevel`, `PLASMID_TIER_TRUST_CEILING`, `TOOL_MIN_TRUST`, `TRUST_ORDER` | T3 | T1/T2 (generator trustLevel default), executor |
| `ThreeWayMergeMode`, `ThreeWayMergeResult`, `ThreeWayMergeConflict` | T4 | restorer, command |
| `objectStorePath` | T5 | T4 (blob read), T5 (blob write) |
| `RebuildLineage`, `RecombinationTranscript.rebuildLineage?` | T5 | /cure (forward-compat — ignore safely) |

## 1. Team Layout (5-team parallel, worktree-isolated)

```
Team 1 — agent-generator
Team 2 — hook + harness generators
Team 3 — wiring-validator: permission alignment + cyclic dep
Team 4 — cure v1: 3-way merge + blob read
Team 5 — executor: rebuild mode + generator dispatch + blob write
```

Each team works in a dedicated git worktree forked from the current HEAD of `feature/GAL-1-phase-1`. Teams commit and the orchestrator fast-forward merges back to the feature branch.

## 2. Team 1 — agent-generator

**Scope**: implement `src/recombination/generators/agent-generator.ts` + template + unit tests.

**Output shape**: `.dhelix/agents/<kebab-name>.md`, frontmatter validates against `agentDefinitionSchema` (`src/subagents/definition-types.ts`).

**Template**: `src/recombination/generators/templates/primitives/agent.basic.hbs`. Include slots `systemPrompt` and `capabilities`. Frontmatter keys: `name`, `description`, `tools`, `model`, `maxTurns`, `permissionMode`, `skills`, `memory`.

**Intent params** it consumes (from `PlasmidIntentNode.params`, all optional):
- `tools?: string[]` — propagated to frontmatter + `GeneratedArtifact.requiredTools`
- `model?: "sonnet" | "opus" | "haiku" | "inherit"`
- `maxTurns?: number` (positive integer)
- `permissionMode?: "default" | "acceptEdits" | "dontAsk" | "bypassPermissions" | "plan"`
- `skills?: string[]`
- `memory?: "user" | "project" | "local"`

**Trust level defaulting**: set `GeneratedArtifact.trustLevel` per the **plasmid tier ceiling** from `PLASMID_TIER_TRUST_CEILING[ir.tier]`, unless intent params override AND the override is ≤ the ceiling. Otherwise raise — validator will flag.

**MUST**:
- Use existing `buildTemplateContext` + `renderTemplate` + `finaliseSlots`. Do NOT write to disk.
- Validate frontmatter against `agentDefinitionSchema.safeParse` before returning (throw `Error("invalid agent frontmatter: …")` if fails).
- Update `MANIFEST.json` entry.
- Update `src/recombination/generators/index.ts`: remove `"agent"` from `DEFERRED_KINDS`, add dispatch branch.
- Write unit tests in `src/recombination/generators/__tests__/agent-generator.test.ts`: at least kebab naming, schema violation, tier→trust mapping, with-all-params, with-no-params.

**MUST NOT**:
- Import from `cli/`, `commands/`, `tools/`.
- Call the LLM directly — accept `deps.llm` optionally, use existing `fillSlots` path only when `strategies.artifactGeneration === "template-and-llm"`.

## 3. Team 2 — hook-generator + harness-generator

**Hook generator**: `src/recombination/generators/hook-generator.ts`.

- **Output shape**: **two** artifacts per intent:
  1. `.dhelix/hooks/<Event>/<kebab>.sh` — executable shell script. Add `#!/usr/bin/env bash\nset -euo pipefail\n` header + a block comment listing available env vars (`$TOOL_NAME`, `$FILE_PATH`, `$SESSION_ID`). Body slot drives actual command.
  2. `.dhelix/hooks/<Event>/<kebab>.manifest.json` — small JSON:
     `{ "event": "<Event>", "script": "<name>.sh", "matcher": "<pattern-or-null>", "sourcePlasmid": "<id>" }`
- `intent.params.event: HookEvent` is **required**. Validate with `isHookGeneratorEvent`; throw typed error if missing/invalid.
- `intent.params.matcher?: string` — optional glob, propagated to manifest.
- `GeneratedArtifact.kind` = `"hook"` for both artifacts. `trustLevel` default = plasmid tier ceiling (hooks can run bash — typically T2).
- Template: `hook.basic.hbs` + `hook.manifest.hbs`. Update MANIFEST.json.

**Harness generator**: `src/recombination/generators/harness-generator.ts`.

- **Output shape**: `.dhelix/harness/<kebab>.md` — a Markdown "install recipe" containing:
  - Intro paragraph derived from intent.description
  - A fenced `json` code block with a **suggested** `settings.json` fragment (hooks section)
  - A step-by-step apply guide
- No direct mutation of `settings.json` — keep scope tight.
- `intent.params.settings?: Record<string, unknown>` — the JSON fragment to display verbatim (pretty-printed).
- `intent.params.event?: HookEvent` — optional anchor event for the recipe.
- `GeneratedArtifact.kind` = `"harness"`. `trustLevel` default = plasmid tier ceiling.
- Template: `harness.basic.hbs`. Update MANIFEST.json.

**MUST**:
- Update `src/recombination/generators/index.ts`: remove `"hook"` and `"harness"` from `DEFERRED_KINDS`, add both dispatch branches. Hook generator returns `GeneratedArtifact[]` (note: plural — helper function to flatten).
- Write unit tests in `src/recombination/generators/__tests__/hook-generator.test.ts` and `harness-generator.test.ts`.

## 4. Team 3 — wiring validator Permission Alignment + Cyclical Dependency

**Scope**: extend `src/recombination/wiring-validator.ts` (pure function) with two new passes. No new file needed; extend in-place.

**Permission Alignment pass**:
- Iterate artifacts; use `TOOL_MIN_TRUST`. For each `tool` in `art.requiredTools`:
  - If `TOOL_MIN_TRUST[tool]` > `art.trustLevel` → emit `WIRING_PERMISSION_MISMATCH`.
  - `tool` not in map → skip (already handled by Reference check).
- Cross-check artifact trust vs plasmid tier: if executor supplies the plasmid tier (passed as new optional arg to `validateWiring`), compare against `PLASMID_TIER_TRUST_CEILING[tier]`; exceeds → emit `WIRING_TRUST_DOWNGRADE_REQUIRED`.
- To avoid breaking T5's existing call signature, add an optional third arg:
  ```ts
  export async function validateWiring(
    artifacts: readonly GeneratedArtifact[],
    reorgPlan: ReorgPlan,
    workingDirectory: string,
    signal?: AbortSignal,
    context?: { readonly plasmidTiers?: ReadonlyMap<PlasmidId, PlasmidTier> },
  ): Promise<WiringReport>
  ```
  T5 will pass `context.plasmidTiers`. Phase 3 callers ignore → tier check noop.

**Cyclical Dependency pass**:
- Build a directed graph over the current artifact set + existing on-disk artifacts (scan `.dhelix/agents/`, `.dhelix/skills/`, `.dhelix/commands/`, `.dhelix/hooks/` for kebab names + frontmatter `skills` / `agents` / `triggers` references).
- Edges: `agent --skills--> skill`, `agent --agents--> agent`, `command --triggers--> hook`, `skill --references--> skill/agent`.
- Run Tarjan SCC. Any SCC of size ≥2 → emit `WIRING_CYCLIC_DEPENDENCY` per cycle (one finding, message lists the nodes).
- Skip self-loops (already emitted by trivial detection upstream).

**Tests**: append to `src/recombination/__tests__/wiring-validator.test.ts` (new file if absent):
- permission mismatch (require `bash` on T0 artifact)
- trust downgrade (tactical plasmid with T3 agent)
- cyclic 2-node (A→B→A)
- cyclic 3-node (A→B→C→A)
- acyclic graph passes
- dangling reference does NOT cause false positive cycle

## 5. Team 4 — Cure v1 3-way merge

**Scope**:
- New file `src/recombination/cure/three-way-merge.ts` — pure diff3 implementation.
- Extend `src/recombination/cure/restorer.ts` to consume it.
- New field on `CureOptions`: `mergeMode?: ThreeWayMergeMode` (default `"block"` for Phase-3 back-compat).

**3-way merge algorithm** (pure, no fs):
```ts
export function threeWayMerge(
  base: string,
  current: string,
  target: string,
): ThreeWayMergeResult
```
- Tokenize by line.
- Compute `diff(base, current)` and `diff(base, target)` via Myers O(ND) (small inputs; ≤1500 lines typical).
- Walk the base: for each line, if current and target both retain the line → emit it; if one changes → apply that change; if both change differently → emit conflict hunk (git markers).
- For our "delete" case (`target === ""`): current modifications are preserved literally, base lines removed. Effectively: `mergedContent = current` with no conflicts when user's edits don't overlap marker boundaries.

**Restorer integration**:
- Read `options.mergeMode ?? "block"`.
- In delete loop, when hash mismatch detected:
  - `"block"` → existing Phase-3 behavior (CURE_CONFLICT)
  - `"keep-user"` → skip unlink + push a `{kind: "manual-edit", ...}` warning; record into `filesDeleted` = no.
  - `"auto"` → lookup base from object store (`objectStorePath(cwd, step.expectedHash)`):
    - Blob found → run `threeWayMerge(base, current, "")`. If `outcome === "clean-merge"` with empty merged content, delete the file. If `outcome === "kept-user"` or any conflicts, skip + warn.
    - Blob missing → downgrade to `"keep-user"` with explanatory warning (CURE_CONFLICT not raised).
  - `"prompt"` → reserved; for Phase 4 treat like `"auto"`.
- For DHELIX.md marker blocks: when `expectedHash` in transcript points at a marker region content, apply 3-way merge to marker block before `applyPlan(remove)` executes; if user edits found inside the marker, prepend them as a new user-area section at the same insertion point.

**Object store read helper**: `src/recombination/cure/object-store.ts`:
```ts
export async function readBlob(cwd: string, hash: string): Promise<string | null>
```
Returns `null` on ENOENT.

**Tests**: `src/recombination/cure/__tests__/three-way-merge.test.ts`:
- identical legs → `"identical"` outcome.
- user-edit only → clean merge.
- base+target conflict → conflict markers.
- delete with no user edit → outcome `"clean-merge"`, mergedContent=`""`.
- delete with user edit → outcome `"kept-user"` (Phase 4 policy: user wins on delete).

`cure/restorer` tests extension — `__tests__/restorer.test.ts` or add new file:
- `mergeMode: "auto"` + edited file + blob present → skipped delete + warning.
- `mergeMode: "auto"` + edited file + blob missing → skipped delete + "blob missing" warning.
- `mergeMode: "block"` + edited file → CURE_CONFLICT (unchanged Phase-3 behavior).

## 6. Team 5 — executor rebuild + Phase-4 wiring

**Scope**:
1. Remove the Phase-4 guard throw in `executor.ts` when `opts.mode === "rebuild"`.
2. Implement rebuild path:
   - Locate latest transcript via `listTranscriptIds` (reuse planner helper) + sort by id.
   - If none: treat as `"extend"` (no-op fallback).
   - Acquire lock; execute internal cure plan against the latest transcript's `writtenFiles` + `reorgMarkerIds`, using the existing restorer with `mergeMode: "keep-user"` so user edits aren't lost.
   - Then run the normal Stage 0–7 pipeline; tag the new transcript with `rebuildLineage: { rebuiltFromTranscriptId, rebuiltAt, consumedArtifactCount, consumedMarkerCount }`.
3. Blob store write at Stage 4 (for every `writtenFile`): compute hash → write bytes to `objectStorePath(cwd, hash)` atomically + idempotently.
4. Remove the `DEFERRED_KINDS` gate entries for agent/hook/harness — but only after Teams 1 & 2 land.
5. Pass `context.plasmidTiers` to `validateWiring` (build from `activePlasmids`).

**Tests** (`src/recombination/__tests__/executor-rebuild.test.ts`):
- rebuild with no prior transcript → falls back gracefully (no throw).
- rebuild consumes prior writtenFiles + markers.
- rebuild transcript carries `rebuildLineage`.
- blob store write at Stage 4 is idempotent.

**Transcript builder**: extend `transcript.ts` — add `recordRebuildLineage(lineage)` method + include in `build()` output. Keep backwards compat.

## 7. Done Definition (Phase 4 Exit Gate)

- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run lint` → 0 errors (warnings permitted only if `// eslint-disable-next-line` documented)
- [ ] `npm test` → all Phase 1/2/3 tests still green + new Phase 4 tests green (target: ≥30 new tests)
- [ ] `npm run build` → ok
- [ ] `npx madge --circular --extensions ts,tsx src/` → 0 cycles
- [ ] Manual invariant check:
  - I-1  plasmid sources never mutated by rebuild
  - I-5  rebuilt transcript is a new file; old transcript still readable
  - I-8  blob store under `.dhelix/recombination/objects/` never loaded into agent prompt
  - I-9  3-way merge of marker blocks preserves user prose concat
  - I-10 rebuild respects `--validate` profile + auto-rollback

## 8. Coordination Notes

- **Branch base**: All worktrees branch off `feature/GAL-1-phase-1` HEAD after the integration-contract commit lands.
- **Generator index edits**: Teams 1 & 2 both touch `generators/index.ts` (DEFERRED_KINDS). Team 1 owns the first edit; Team 2 fast-forwards + applies its delta. If conflict, both entries removed simultaneously.
- **Tests directory**: Each team uses `src/recombination/<subdir>/__tests__/` to avoid cross-team test collisions.
- **DO NOT** bump `EXECUTOR_VERSION` unless making a breaking contract change.
