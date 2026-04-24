# GAL-1 Phase 3 Dev Guide — Runtime Validation + /cure + I-10

**Target**: 5-team parallel sprint on `feature/GAL-1-phase-1` (Phase-3 lands on same branch as Phase-1/2 per execution-plan v1.5).
**Base**: integration contract committed in `src/recombination/types.ts` + stubs in `src/recombination/validation/`, `src/recombination/cure/`, `src/commands/cure/`.
**SSOT**: `docs/prd/plasmid-recombination-system.md` §6.3 Stage 6-7 + §6.4 + §8 + §10.1 I-10.
**Reference synth**: design docs `P-1.16` (validation framework) · `P-1.17` (eval harness reuse) · `P-1.20` (degradation) · `P-1.21` (dual-model) · `P-1.23` (eval-seeds schema).

---

## 0. Conventions (all teams)

- **Layer rules** (CLAUDE.md): `validation/` + `cure/` both live in `src/recombination/` → Layer 2 (Core). MUST NOT import `cli/` or `commands/*` internals. MAY import `plasmids/` (Leaf) and `llm/model-capabilities` (Infra).
- **ESM**: `.js` extension on every relative import.
- **No default exports** — named only.
- **Immutability**: `readonly` everywhere. Return spread copies.
- **No `any`**: `unknown` + type guards; Zod at every external input boundary (eval-seeds YAML/JSON, transcript load).
- **AbortSignal**: propagated to every I/O + LLM call.
- **Named stub error pattern**: `throw new Error("TODO Phase 3 Team N: <fnName>")` — replace with real impl; leave NO stubs when done.
- **TDD**: write vitest spec alongside the file you implement (`*.test.ts` in same dir or `test/unit/recombination/validation/`). **≥80% coverage** per the per-commit gate.
- **Named exports only**; file should be individually tree-shakeable.

**Non-negotiables per PRD**:
- I-5  `.jsonl` ledgers append-only (use `{ flag: "a" }`)
- I-8  validator reads artifacts from CoW workspace, NEVER from real `.dhelix/plasmids/` or recombination bodies — those belong to the compile boundary
- I-10 L1/L2 fail ⇒ rollback; foundational L4 ≥5% ⇒ rollback
- Commit: `feat(recombination/validation): …` / `feat(cure): …` / `feat(commands/cure): …`

---

## 1. Team 1 — Case generation (eval-seeds + DSL + volume governor + case-generator)

### Files owned
```
src/recombination/validation/
  expectation-dsl.ts
  eval-seeds.ts
  volume-governor.ts
  case-generator.ts
```
+ matching `*.test.ts` files.

### Deliverables
1. `parseExpectation(raw): Expectation` — the 7-prefix DSL (P-1.23 §4). Quoted strings `"..."` for `output contains/excludes`; path-like for `file:`; integer for `exit code`; fallback to `free-text`. Robust: trim whitespace; reject malformed in strict mode.
2. `evalCaseSchema` + `evalSeedsFileSchema` Zod — extend `src/skills/creator/evals/types.ts::evalCaseSchema` with required `tier: "L1"|"L2"|"L3"|"L4"`, `.max(20)` on seeds, duplicate-id `superRefine`. Auto-convert legacy `expected_output_contains/excludes` → DSL strings at parse time.
3. `loadEvalSeeds(cwd, plasmidId)` reads `.dhelix/plasmids/<id>/eval-seeds.yaml` (YAML) or `.json`. Returns `[]` on ENOENT. On parse error throws typed error (caller reports as `EVAL_SEEDS_INVALID` warning — but use plain `Error` for now; error code is optional).
4. `buildVolumePlan({ irs, strategies })` — deterministic, sync. Matrix per PRD §8.3 (cloud vs local) + P-1.16 profile scaling (standard 150 / governed 50 / minimal 20). Uses `strategies.validationVolume` + `strategies.validationParallelism` + plasmid tier (`foundational|policy|tactical|agent-proposed`). Returns `VolumePlan`. Time budget: 300s for standard/governed, 180s for minimal.
5. `generateCases(req)` — consumes `VolumePlan`, fills each plasmid × tier slot using the 3-source priority (P-1.23 §7): **eval-seeds → deterministic → LLM auto-gen**.
   - L1: trigger keywords + description variants.
   - L2: `## Behavior` conditional parsing (`"When <X>, do Y"`).
   - L3: `expression-conditions` + constraint-exception derivations.
   - L4: LLM-only red-team; multilingual mix (50% body-language / 30% en / 20% other). Skipped entirely under `strategies.gradingTiers === ["deterministic"]` (local-small) because LLM judge isn't available.
   - Quota overflow: drop by plasmid-tier priority; record in `RuntimeCaseSet.droppedReasons`.

### Reuse
- `src/skills/creator/evals/types.ts::evalCaseSchema` — extend, don't duplicate.
- `src/plasmids/types.ts::PlasmidTier` for plasmid priority ordering.
- `src/llm/model-capabilities.ts::StrategyTier` to gate L3/L4 LLM auto-gen.

### DoD
- [ ] `parseExpectation` round-trips all 7 prefix shapes + free-text
- [ ] Zod rejects >20 seeds, duplicate ids, missing tier
- [ ] `buildVolumePlan` honors all 9 (3 profile × 3 plasmid tier) × 4 level cells — unit tests cover each
- [ ] `generateCases` respects quota (never exceeds per-plasmid L1/L2/L3/L4 counts)
- [ ] 3-source priority order verified by fixture tests (seed > deterministic > LLM)
- [ ] **NO LLM calls** when `strategies.gradingTiers` omits `"llm"` (minimal profile) — verified via mock

---

## 2. Team 2 — Runtime executor + grader cascade + CoW workspace

### Files owned
```
src/recombination/validation/
  artifact-env.ts
  runtime-executor.ts
  grader-cascade.ts
```
+ matching `*.test.ts`.

### Deliverables
1. `buildArtifactEnv({ workingDirectory, transcriptId, artifacts, writtenFiles })` — creates `${tmpdir}/dhelix-val-<transcriptId>-<random>/` containing:
   - Symlink tree (posix) or copy (win32 via `process.platform === "win32"` branch) for `.dhelix/{agents,skills,commands,hooks,rules}/` dirs that the artifacts reference.
   - Copy of `.dhelix/prompt-sections/generated/*.md` (always copy — runtime may mutate these).
   - Copy of `DHELIX.md`.
   - Empty `scratch/` dir the case runner can freely mutate.
   Returns `ArtifactEnv` with `cleanup()`.
2. `runCases(req)` — wraps `src/skills/creator/evals/runner.ts::runEvals`. For each `RuntimeCase`, build an `EvalCase`-compatible shape, invoke the runner with `concurrency = req.parallelism`, time-budget via `AbortController` tied to `req.timeBudgetMs`. Each case runs with `cwd = workspaceRoot/scratch`. Capture:
   - `output` (full agent transcript)
   - `toolCalls` (flattened list of tool-invocation names from transcript)
   - `hookFires` (any hook-invocation events)
   - `filesTouched` (walk `scratch/` post-run)
   - `status`: `"ok" | "timeout" | "error" | "skipped"`
   Early-exit when L1 hits 3 consecutive hard-fails: subsequent cases recorded with `status: "skipped"`.
3. `gradeCases(req)` — cascade. For each `(case, run)`:
   - Parse expectations via `parseExpectation`.
   - Each parsed expectation routes to its handler:
     - `output-contains | output-excludes | file-exists | file-modified | exit-code` → `deterministic` check.
     - `tool-called | hook-fired` → if `strategies.gradingTiers.includes("semi")` use `run.toolCalls`/`run.hookFires`; else `"skipped"`.
     - `free-text` → if `strategies.gradingTiers.includes("llm")` call grader LLM; else `"skipped"`. Reuse judge prompt from `src/skills/creator/evals/grader.ts` (don't re-invent).
   - Case `passed = true` only if **all** non-`skipped` expectations passed AND at least one non-skipped expectation exists.
   - Return `CaseGrading` with per-expectation details.

### Reuse
- `src/skills/creator/evals/runner.ts::runEvals(evalsFile, configs, deps, opts?)` — reuse as-is, wrap with adapter.
- `src/skills/creator/evals/grader.ts::createGraderClient()` + `gradeCase()` — for LLM judge branch.
- `src/skills/creator/evals/types.ts` — `EvalCase`, `EvalsFile`, `RawRunResult`, `Grading`.
- `src/skills/creator/evals/workspace.ts::createWorkspace / persistRunResult` — OPTIONAL, only if we want failed-case artifacts under `validation-failures/`.

### Critical invariants
- **I-8**: never touch `.dhelix/plasmids/` or `.dhelix/recombination/` from within `runCases`. The CoW workspace explicitly excludes those directories.
- Signal handling: if `req.signal.aborted`, abort outstanding runs and return partial results with `status: "skipped"`.

### DoD
- [ ] CoW workspace cleans up on success **and** failure paths (finally-block)
- [ ] Symlink mode works on darwin; copy-fallback works on windows (test via `process.platform` branching)
- [ ] Time-budget enforcement verified with a slow case fixture
- [ ] Early-exit at 3 consecutive L1 hard-fails
- [ ] Grader cascade correctly routes all 8 expectation kinds; `skipped` on handler unavailable
- [ ] Integration test with fake `GenerateCasesFn` + fake `LLMCompletionFn` producing deterministic results

---

## 3. Team 3 — Rollback decision + grace UX + audit ledgers

### Files owned
```
src/recombination/validation/
  rollback-decision.ts
  reporter.ts
  override-tracker.ts
  regression-tracker.ts
```
+ matching `*.test.ts`.

### Deliverables
1. `decideRollback({ report, plasmids, strategies })` — pure sync. Matrix per PRD §8.5:
   - L1: any tier miss → `"rollback"` (exception: `require-override` if `report.early_exit` and threshold almost met — Phase 3 scope: treat as `"rollback"`).
   - L2: miss → `"rollback"`.
   - L3: miss → `"warn"` (no rollback).
   - L4: `"warn"`; foundational plasmid with L4 fail rate ≥0.05 → `"rollback"` (`foundationalL4Triggered: true`).
   - None failing → `"continue"`.
2. `renderReport(report)` — multi-line string matching PRD §6.3.3 validation summary layout (L1/L2/L3/L4 with pass counts, overall %, timestamps, per-plasmid breakdown on failure).
3. `renderGraceFrame(report, decision, secondsRemaining)` — countdown frame that includes:
   - `🧬 Validation FAILED — auto-rollback in Ns`
   - Top failing tier stats
   - Hotkey legend: `[r] Rollback (default) [k] Keep (override+audit) [c] Re-run cloud [i] Inspect [e] Edit plasmid`
4. `awaitRollbackDecision({ io, report, decision, signal })` — 10s countdown (`ROLLBACK_GRACE_PERIOD_MS`). Calls `io.prompt(frameRenderer, 10_000, ["rollback","keep",...])`. Returns `"rollback"` on timeout / on `io` returning `"rollback"`. Returns `"keep"` on explicit keep. `"rerun" | "inspect" | "edit"` map to `"rollback"` for Phase 3 (noted in reporter comment — richer UX in Phase 4).
5. `autoTimeoutDecisionIO(valid)` — a pure `GracePromptIO` that resolves `"rollback"` after timeout (for headless / test use).
6. `recordOverride(cwd, record)` — appends one JSON line to `validation-overrides.jsonl` atomically (open `{ flag: "a" }`). `countOverrides(cwd, { plasmidId, sinceDays })` — reads back + filters by timestamp.
7. `reportToHistoryEntry(transcriptId, report)` — pure projector.
8. `appendHistory(cwd, entry)` — append-only.
9. `detectRegressions({ cwd, current, threshold=0.05, transcriptId })` — reads `validation-history.jsonl` in reverse, compares latest different `transcriptId`'s per-plasmid tier rates; emits `RegressionFinding[]` for any drop ≥ threshold.

### DoD
- [ ] All 16 cells of (tier × decision matrix) covered by unit tests
- [ ] Grace countdown emits N frames for N seconds (test with fake timer)
- [ ] Override jsonl is atomic (no half-written lines in failure injection test)
- [ ] Regression detection finds synthetic 10% drop; ignores within-threshold noise
- [ ] `renderReport` snapshot test matches PRD §6.3.3 layout

---

## 4. Team 4 — `/cure` command + reverse-plan helpers

### Files owned
```
src/recombination/cure/
  planner.ts
  restorer.ts
  edit-detector.ts
  refs.ts
  index.ts

src/commands/cure/
  index.ts      (already registered in builtin-commands.ts)
  extend.ts
  deps.ts
  render.ts
```
+ matching `*.test.ts` under `test/unit/recombination/cure/` and `test/unit/commands/cure/`.

### Deliverables
1. `planCure({ options })` — builds `CurePlan`. Modes:
   - `latest`: load last transcript from `.dhelix/recombination/transcripts/` (by id sort, ISO-8601 slug is comparable).
   - `all`: load every transcript, union their writtenFiles/markers.
   - `transcript: <id>`: load that specific transcript.
   - `plasmid: <id>`: read `refs/plasmids/<id>` → load that transcript.
   For each transcript, emit:
   - `{kind:"delete-file", path, expectedHash}` per `writtenFile` where `op ∈ {"create","update"}`.
   - `{kind:"remove-marker", markerId}` per entry in `reorgMarkerIds`.
   - (`purge=true`) `{kind:"archive-plasmid", plasmidId}` + `{kind:"clear-refs", plasmidId}`.
   Emit warnings via `detectManualEdits` + `later-transcript` detection (another transcript after `latest` references same plasmid/file) + `git-uncommitted` (shell out to `git status --porcelain` non-blocking — stub OK if git absent).
2. `restoreCure({ options, plan })` — executes plan atomically:
   - `acquire(cwd)` — reentrant lock (same API as recombination).
   - For each `delete-file` step: check current hash; if mismatch AND `!options.approvalMode==="auto"`, return `CURE_CONFLICT` with guidance. Else `unlink`.
   - For `remove-marker` steps: read current `DHELIX.md`, construct a reverse `ReorgPlan { ops: [{kind:"remove", markerId, heading:"", body:""}, ...], keptMarkerIds: [], preReorgContentHash: "", intentGraphHash: "", fallbackTier: "deterministic-only" }`, call `applyConstitutionPlan(existing, reversePlan)` — reuse Team 4 Phase-2 applier; verify `verifyUserAreaInvariance(beforeTree, afterTree)` after. On I-9 violation → abort with `CURE_ABORTED`.
   - `archive-plasmid`: move `.dhelix/plasmids/<id>/` to `.dhelix/plasmids/archive/<id>-<ts>/` (or per current archive naming).
   - Append audit.log line: `cure\t<ts>\ttranscripts=<ids>\tfilesDeleted=N\tmarkersRemoved=M` (tab-delimited per existing audit format).
   - Release lock in finally.
3. `detectManualEdits({ workingDirectory, transcript, files })` — SHA-256 compare + mtime > `transcript.finishedAt` → `manual-edit` warning.
4. `refs.ts` — `writePlasmidRef / readPlasmidRef / clearPlasmidRef / listPlasmidRefs` backed by `.dhelix/recombination/refs/plasmids/<id>` plaintext single-line file. Atomic via tmp+rename (consistency with `atomicWrite` elsewhere).
5. `createCure(deps)` / `defaultCureFacadeDeps()` — returns `ExecuteCureFn`. Orchestrates plan → (dry-run short-circuit) → restore.
6. `/cure` command:
   - `runCure(argv, context, deps)` — parse `--all`, `--transcript <id>`, `--plasmid <id>`, `--dry-run`, `--purge`, `--yes` (skip approval prompt; default requires `y/N` prompt via `approvalMode` field). Build `CureOptions`, call `deps.executeCure`. Render via `renderCureReport`. Match PRD §6.4.3 output exactly.
   - `defaultDeps(cwd)` — wires `createCure(defaultCureFacadeDeps())`.

### Reuse
- `src/recombination/lock.ts::acquire` — same lock as `/recombination`.
- `src/recombination/constitution/index.ts::{ parse, applyPlan, verifyUserAreaInvariance }` — marker removal + I-9 check.
- `src/recombination/transcript.ts::persistTranscript` — not strictly needed; cure has its own audit line.
- No git library: shell out to `git` CLI via `child_process.spawn`. Tolerate `ENOENT` (no git).

### DoD
- [ ] `/cure --dry-run` produces PRD-format preview; **no disk mutation** (verified via fs snapshot)
- [ ] `/cure` (latest) successfully undoes a recombination E2E run
- [ ] `/cure --plasmid <id>` uses refs/ to locate the right transcript
- [ ] `CURE_CONFLICT` surfaces on manually-edited file; `--yes` bypasses
- [ ] `verifyUserAreaInvariance` on post-restore tree — violation aborts
- [ ] `--purge` moves plasmid `.md` to archive; no `.md` deletion (I-1)
- [ ] audit.log line appended per cure
- [ ] Tests cover all 4 modes + dry-run + warnings

---

## 5. Team 5 — Executor integration + `--validate=` wiring + facade + E2E

### Files owned (modify)
```
src/recombination/executor.ts              (Stage 6 hook + Stage 7 telemetry + preReorgSnapshot capture + reorgOps recording)
src/recombination/transcript.ts            (builder extensions — optional fields)
src/recombination/validation/index.ts      (createValidate composition + defaults)
src/commands/recombination/extend.ts       (--validate=<profile> flag → opts.validateProfile)
src/commands/recombination/deps.ts         (wire validate into ExecutorDeps)
```
Plus new files:
```
test/integration/recombination/validation-flow.test.ts
test/integration/recombination/cure-flow.test.ts
```

### Deliverables
1. **Executor Stage 1 extension**: after `readFileOrEmpty(DHELIX.md)` → compute `preReorgSnapshot = { beforeContent, beforeHash: sha256(beforeContent), capturedAt: now().toISOString() }`. Pass to transcript builder.
2. **Executor Stage 2d extension**: record `reorgPlan.ops` into transcript (`recordReorgOps`).
3. **Executor Stage 6 wiring**:
   ```ts
   if (opts.validateProfile && opts.validateProfile !== "none" && deps.validate) {
     transcript.recordStageStart(6, "runtime-validation", now());
     const validateResult = await deps.validate({
       irs, artifacts, reorgPlan, writtenFiles,
       strategies, model: modelId,
       workingDirectory: opts.workingDirectory,
       transcriptId: transcript.id,
       profile: opts.validateProfile,
       llm: deps.llm,
       signal: opts.signal,
     });
     transcript.recordValidation(validateResult.report);
     if (validateResult.decision.action === "rollback") {
       await rollbackAll(rollbackActions);
       transcript.recordError(rollbackErrorCode(validateResult.decision), validateResult.decision.reason);
       transcript.recordStageFinish(6, now(), "error", validateResult.decision.reason);
       // persist transcript + return applied: false
     } else {
       if (validateResult.overrideRecorded) transcript.recordOverride(validateResult.overrideRecorded);
       transcript.recordStageFinish(6, now(), validateResult.decision.action === "warn" ? "warn" : "ok");
     }
   } else {
     transcript.recordStageStart(6, "runtime-validation", now());
     transcript.recordStageFinish(6, now(), "skipped", opts.validateProfile === "none" ? "explicit --validate=none" : "phase-2 compatible path");
   }
   ```
4. **Executor Stage 7 extension**: emit telemetry (via existing `src/utils/events` bus — follow current Stage 5 pattern if any; else `console.debug` stub for Phase-3, real OTLP later), write `refs/plasmids/<id>` for each active plasmid (lookup `writePlasmidRef` from `cure/refs.ts`).
5. **Transcript builder extensions** (`src/recombination/transcript.ts`):
   - `recordValidation(report)`, `recordOverride(record)`, `recordPreReorgSnapshot(snapshot)`, `recordReorgOps(ops)` — all optional; build() includes them if set.
6. **`--validate=<profile>` wiring** (`src/commands/recombination/extend.ts`): already parses. Wire the parsed `validate` field into `RecombinationOptions.validateProfile`. Update the final report renderer to display Stage-6 summary via `renderReport` when present.
7. **`createValidate` composition** (`src/recombination/validation/index.ts`):
   ```ts
   export const createValidate: (deps: ValidateFacadeDeps) => ValidateFn = (deps) =>
     async (req) => {
       const plan = deps.buildVolumePlan({ irs: req.irs, strategies: req.strategies });
       const caseSet = await deps.generateCases({ irs, strategies, plan, workingDirectory: req.workingDirectory, llm: req.llm, signal: req.signal });
       const env = await deps.buildArtifactEnv({ workingDirectory, transcriptId: req.transcriptId, artifacts: req.artifacts, writtenFiles: req.writtenFiles, signal: req.signal });
       try {
         const runs = await deps.runCases({ cases: caseSet.cases, strategies, workingDirectory, workspaceRoot: env.workspaceRoot, llm, timeBudgetMs: plan.timeBudgetMs, parallelism: plan.parallelism, signal });
         const gradings = await deps.gradeCases({ cases: caseSet.cases, runs, strategies, llm, signal });
         const report = buildValidationReport(...);  // new helper
         const decision = deps.decideRollback({ report, plasmids: req.irs, strategies });
         // grace prompt (only for rollback + io provided)
         let finalAction = decision.action;
         let overrideRecorded: OverrideRecord | undefined;
         if (decision.action === "rollback" && deps.promptIO) {
           const chosen = await awaitRollbackDecision({ io: deps.promptIO, report, decision, signal });
           if (chosen === "keep") { finalAction = "continue"; overrideRecorded = makeOverride(...); await recordOverride(workingDirectory, overrideRecorded); }
         }
         // Regression tracking
         const regressions = await detectRegressions({ workingDirectory, current: report, transcriptId: req.transcriptId, signal });
         await appendHistory(workingDirectory, reportToHistoryEntry(transcriptId, report));
         return { report, decision: { ...decision, action: finalAction }, regressions, ...(overrideRecorded ? { overrideRecorded } : {}) };
       } finally {
         await env.cleanup();
       }
     };
   ```
8. **Integration tests**:
   - `validation-flow.test.ts`: fake plasmid with deterministic trigger + L1 expectation. Run `/recombination --validate=local`. Assert: transcript includes validation, decision `"continue"`, files applied. Then inject a failing L1 case. Assert: rollback triggered, files cleaned, transcript records `VALIDATION_FAILED_L1`.
   - `cure-flow.test.ts`: run `/recombination` extend, then `/cure --dry-run` (assert no changes), then `/cure` (assert `delete-file` + `remove-marker` applied, I-9 preserved).

### DoD
- [ ] Phase-2 transcripts still parse (optional fields)
- [ ] `/recombination` without `--validate` preserves Phase-2 behavior (Stage 6 skipped)
- [ ] `--validate=smoke | local | exhaustive | ci` all execute Stage 6; `--validate=none` explicit skip
- [ ] Rollback path correctly reverses Stage 4 effects + records error code
- [ ] `preReorgSnapshot` + `reorgOps` present in new transcripts
- [ ] `refs/plasmids/<id>` written after successful run
- [ ] Integration tests green end-to-end
- [ ] `npm run quality` passes (typecheck + lint + test + build + madge)

---

## 6. Merge + verification protocol (Lead developer)

1. Each team branch merges into `feature/GAL-1-phase-1` via ff-only (Phase 2 pattern).
2. After all 5 merge → `npm run quality`. Triage failures by team.
3. Integration defects:
   - Cross-team import issues → fix in Lead-owned glue file (executor or facade).
   - Missing path in CoW workspace → Team 2 PR.
   - Schema mismatch at contract boundary → extend `types.ts` + re-typecheck.
4. Verify invariants manually:
   - I-5: cat `.jsonl`, confirm append-only format.
   - I-8: grep `runtime-executor.ts` for `.dhelix/plasmids/` or `.dhelix/recombination/` string access — MUST be zero.
   - I-9: run a recombination → `/cure` → diff DHELIX.md user area → must be identical.
   - I-10: force a failing L1 case → rollback happens within 10s grace.
5. Update `.claude/docs/reference/recombination-pipeline.md` with Stage 6/7 + `/cure` coverage.
6. Bump execution-plan to v1.6, add Phase 3 block matching v1.4/1.5 style.
7. Commit: `feat(recombination): Phase 3 Stage 6 runtime validation + /cure + I-10 (GAL-1)` and push.
