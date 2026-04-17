# Eval Guide — from Phase 1 scaffold to Phase 2 harness

## What an eval is

An **eval** is a single test case that answers: "when the user sends *this* prompt, does the skill do the right thing?" It has a prompt, optional input files, and a list of human-readable expectations that a grader (either an LLM or a human) can verify against the skill's actual output.

Aggregated across a handful of cases, evals let us **measure** whether description changes or workflow changes make the skill better or worse — instead of eyeballing it.

## evals.json schema (v1)

```json
{
  "skill_name": "refactor-service",
  "version": 1,
  "cases": [
    {
      "id": "e1",
      "prompt": "Extract validation out of UserService into a separate class.",
      "files": ["src/services/UserService.ts"],
      "expectations": [
        "A new class (e.g. UserValidator) is extracted from UserService.",
        "UserService no longer contains inline validation logic.",
        "No public API is broken."
      ],
      "expected_output_contains": ["class UserValidator", "UserService"]
    }
  ]
}
```

Field reference (see `docs/skill-creator-plan.md` §12.1 for the full Zod schema):

| Field | Type | Required | Notes |
|---|---|---|---|
| `skill_name` | string | yes | matches the directory name |
| `version` | number | no | schema version; v1 in Phase 1 |
| `cases[].id` | string | yes | unique within the file |
| `cases[].prompt` | string | yes | verbatim user message |
| `cases[].files` | string[] | no | paths the grader may read for context |
| `cases[].expectations` | string[] | yes (≥1) | natural-language assertions |
| `cases[].expected_output_contains` | string[] | no | substring hints for Phase 2 grader |
| `cases[].expected_output_excludes` | string[] | no | substring denylist |
| `cases[].tags` | string[] | no | for filtering |
| `cases[].should_trigger` | boolean | no (default true) | `false` → negative example for description optimizer |

## How many cases

- **Phase 1 (now)**: 2–3 cases per skill. Derive from the Step 2 interview.
- **Phase 2**: 5–8 cases typical, mix of happy path and edge cases.
- **Phase 3 description optimizer**: 20 trigger evals (10 positive + 10 negative) auto-generated.

## Writing good expectations

A good expectation is **checkable**. Examples:

| ❌ Bad | ✅ Good |
|---|---|
| "The output is good." | "The output is a valid Vitest test file with at least one `it(...)` block." |
| "It handles the user properly." | "The response uses AskUserQuestion when arguments are missing, not Write." |
| "No bugs." | "The generated code compiles with `tsc --noEmit` and no `any` types are introduced." |

Aim for expectations that another person (or the grader LLM) could verify without re-reading the entire conversation.

## Improvement loop (preview of Phase 3)

Once the Phase 2 harness lands, the loop is:

1. `/skill-eval <name>` — runs all cases twice (with-skill + baseline), produces `benchmark.json`
2. Inspect results in `/skill-review` — pass rate, variance, delta vs baseline
3. Add `feedback.json` for any case the grader mis-judged or a new failure pattern you spotted
4. `/skill-improve <name>` — rewrites description and/or body, creates `iteration-<N+1>/`
5. Rerun `/skill-eval <name>`; if delta > +5% and no regression > -10%, accept
6. Repeat up to 5 iterations or until the curve plateaus

Regression guard keeps the loop honest: an iteration that wins on 3 cases but loses badly on one is rejected.

## Safety notes

- Evals must never hit **real external APIs** without a clearly marked `@real-api` tag. Default is mocked.
- Never include secrets in `evals.json` — the file is committed to the repo.
- `files` paths should be repo-relative and public; do not use absolute or user-machine paths.

## Phase status

| Phase | Artifact |
|---|---|
| 1 | `evals.json` written alongside `SKILL.md`, no harness yet |
| 2 | `/skill-eval` runs and produces `benchmark.json` |
| 3 | `/skill-improve` + description-optimizer + `/skill-review` dashboard |
| 4 | `.dskill` packaging includes the latest `iteration-<N>` as evidence |
