---
name: create-skill
description: "Create, improve, and test dhelix skills through a structured interview and scaffold. Use when the user says things like 'make a skill', '스킬 만들어줘', 'turn this workflow into a reusable /command', 'add a slash command that does X', or when the user wants to refine an existing skill's triggering behavior. Benchmarked against Claude Code skill-creator v2.0."
userInvocable: true
argumentHint: "[skill-name] [--intent \"...\"]"
trustLevel: built-in
context: inline
minModelTier: medium
---

# create-skill — dhelix skill authoring workflow

## Mission

Help the operator produce a skill that **triggers reliably on intended prompts and reliably declines on non-intended prompts**, with an evals file ready for the Phase 2 harness. A skill is more than a prompt template: it is an onboarding guide with description, workflow, quality bar, and test cases.

Benchmarked against Claude Code `skill-creator` v2.0 — the four modes are Create, Eval, Improve, Benchmark. This file covers **Create** in full; Eval/Improve/Benchmark are delegated to `references/eval-guide.md` and the `src/skills/creator/` module (Phase 2+).

## When This Triggers

- User explicitly invokes `/create-skill [name] [--intent "..."]`
- Natural-language prompts: "make a skill for X", "자동화 스킬 만들어줘", "automate this workflow", "turn this into /xxx"
- User wants to improve an existing skill's description or triggering accuracy

### Should NOT Trigger On

- Requests to add a built-in slash command (use `add-slash-command` instead)
- Requests to add a tool (use `add-tool`)
- General refactoring or code questions
- Running or fixing tests for an existing skill (use `debug-test-failure`)

## Workflow — Create Mode

Run steps in order. Skip a step **only** when you explicitly state *why* and proceed.

### Step 1 — Parse args and decide mode

Inspect `$ARGUMENTS`:

- If args contain a **valid kebab-case name** AND `--intent "..."` → **headless path**. Skip to Step 3 with the provided values. The programmatic `scaffoldSkill` helper (see `src/skills/creator/scaffold.ts`) already supports this one-shot flow.
- Otherwise → **interactive path**. Continue to Step 2.

Name rules: lowercase, kebab-case, matches `/^[a-z][a-z0-9-]*$/`. If the user proposes `MySkill` or `my_skill`, auto-convert and confirm.

### Step 2 — Interview

Use `AskUserQuestion` (or the conversational equivalent) to collect five answers. Do not invent answers. If the user is vague, ask for one specific example.

1. **Problem** — What problem should this skill solve? (one sentence)
2. **Three should-trigger prompts** — concrete example user messages that SHOULD activate this skill
3. **Three should-not-trigger prompts** — examples that should NOT activate it (differentiating neighbors)
4. **Expected output shape** — code edits / a report / a file scaffold / a conversation / a summary
5. **Execution context** — `inline` (runs in current chat) or `fork` (subagent with isolated context)

If the user gives fewer than 3 examples in #2 or #3, push back once and accept two. Never proceed with zero examples — those are the ground truth for description optimization (Phase 3).

### Step 3 — Draft the SKILL.md

Write the file to `.dhelix/skills/<name>/SKILL.md` using the Write tool directly. Structure:

```
---
name: <name>
description: "<intent>. Use when the user says things like: '<t1>', '<t2>', '<t3>'."
userInvocable: true
argumentHint: "<usage hint>"
trustLevel: project
context: <inline|fork>
minModelTier: <low|medium|high>
---

# <name>

## Mission
<one paragraph>

## When This Triggers
- <trigger 1>
- <trigger 2>
- <trigger 3>

### Should NOT Trigger On
- <anti 1>
- <anti 2>
- <anti 3>

## Workflow
1. <step>
2. <step>
3. <step>

## Quality Bar
- [ ] <verifiable outcome>
- [ ] <verifiable outcome>

## References
- [description-patterns](../../.claude/skills/create-skill/references/description-patterns.md)
```

Rules (see `references/description-patterns.md` for detail):

- Description is **pushy**: starts with a verb phrase, contains an explicit "Use when..." clause, and quotes 3 real trigger phrases. Descriptions without a "Use when" clause undertrigger.
- Body stays **≤ 500 lines**. If you need more, split it into `references/` files and link from the body.
- Use **imperative voice** ("Write", "Check", "Ask"). Avoid second person ("you should") and ALL-CAPS absolutes ("ALWAYS", "MUST"). Explain *why* on non-obvious rules so the model can generalize to edge cases.

### Step 4 — Draft `evals/evals.json`

Write `.dhelix/skills/<name>/evals/evals.json` with 2–3 cases derived from Step 2's should-trigger prompts. Each case has:

```json
{
  "id": "e1",
  "prompt": "<verbatim from user>",
  "files": [],
  "expectations": [
    "The workflow described in SKILL.md is followed in order.",
    "No destructive edits occur without confirmation.",
    "<specific outcome the user named in Step 2 Q4>"
  ]
}
```

Leave assertions loose in v1. The Phase 2 grader will refine them.

### Step 5 — Validate

Verify the draft meets the Quality Bar. You have two paths:

**A. Programmatic (preferred when `src/skills/creator/` is loadable):**
Call `scaffoldSkill` from a short node snippet, or rely on the validation path embedded in the scaffolder. It runs `skillManifestSchema.safeParse`, enforces the 500-line cap, and checks JSON validity.

**B. Manual checklist (fallback):**
Read the file back and confirm each Quality Bar item. Report any failure honestly — do not fabricate passes.

Quality Bar:

- [ ] Frontmatter parses as a valid `SkillManifest` (run `node -e "const {validateManifest} = await import('./dist/skills/manifest.js'); ..."` or re-read)
- [ ] Description contains `"Use when"` and ≥ 3 quoted trigger phrases
- [ ] Body sections: Mission, When This Triggers, Workflow, Quality Bar all present
- [ ] Body ≤ 500 lines
- [ ] `evals/evals.json` is valid JSON with ≥ 2 cases
- [ ] No absolute directives without a *why*
- [ ] No mention of tools that do not exist in the registry (check `src/tools/definitions/`)

### Step 6 — Next steps for the user

Tell the user exactly:

1. The paths you created
2. How to invoke the skill: `/name` if `userInvocable: true`
3. Recommend `/skill-eval <name>` once Phase 2 lands, and `/skill-improve <name>` for trigger tuning once Phase 3 lands
4. That they should test the skill on 1–2 of their should-not-trigger prompts and confirm it does NOT activate

## Modes Not Covered Here

- **Eval**: see `references/eval-guide.md` and the future `/skill-eval` command
- **Improve**: see `references/eval-guide.md` §"Improvement loop" and the future `/skill-improve` command
- **Benchmark**: requires Phase 3 `src/skills/creator/{comparator,benchmark}.ts`

## Required Tools

- `Write` — create the SKILL.md and evals.json files
- `AskUserQuestion` — interview the user in Step 2
- `Read` — validate drafts in Step 5
- `Glob` — check name collisions in `.dhelix/skills/`

## References

- [description-patterns.md](references/description-patterns.md) — pushy description rules with before/after examples
- [eval-guide.md](references/eval-guide.md) — evals.json schema and Phase 2 harness preview
