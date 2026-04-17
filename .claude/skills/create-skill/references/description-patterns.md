# Description Patterns — pushy, concrete, testable

## Why descriptions matter

The `description` field is the single piece of skill metadata the model sees during routing. Claude Code skill-creator v2.0's largest quality lever is description tuning: the exact same body can undertrigger (model never picks the skill) or overtrigger (model picks the skill for unrelated prompts) depending on the description.

## Anatomy

A pushy description has three parts:

1. **Verb phrase** — what the skill *does* (not what it "is for")
2. **"Use when..." clause** — explicit trigger condition
3. **Quoted trigger phrases** — 3 concrete example user messages

## Before / After examples

### Example A — code review skill

| | |
|---|---|
| ❌ Before | `"Reviews code."` |
| ✅ After  | `"Run a structured code review on staged or recent diffs, flagging correctness, security, and style issues. Use when the user says 'review this', 'check my changes', '리뷰해줘', or pastes a diff for feedback."` |

**Why it works**: verb-led, explicit Use-when clause, 3 quoted triggers that cover English + Korean + paste-diff behavior.

### Example B — test scaffolder

| | |
|---|---|
| ❌ Before | `"Creates tests for the user."` |
| ✅ After  | `"Generate Vitest unit tests for a named function or class, covering happy path + edge cases + error cases. Use when the user says 'write tests for X', 'add coverage to Y', '테스트 만들어줘', or references a file and asks for tests."` |

### Example C — deployment helper

| | |
|---|---|
| ❌ Before | `"Helps with deployment."` |
| ✅ After  | `"Walk the user through deploying the service to the staging environment: prechecks, environment confirmation, run deploy, watch health. Use when the user says 'deploy to staging', '배포해줘', or explicitly names a staging target."` |

### Example D — negative differentiation

| | |
|---|---|
| ❌ Before | `"Handles Git operations."` (overtriggers on any git keyword) |
| ✅ After  | `"Create a well-formed Git commit message from staged changes, following conventional commits. Use when the user says 'commit this', 'make a commit', '커밋 메시지', or explicitly asks for a commit message. Do NOT trigger on 'git status', 'show diff', 'pull'."` |

Include an explicit **negative** list when two sibling skills risk conflict.

## Length target

- 1–3 sentences
- 200–400 characters is typical
- Under 100 chars almost always undertriggers
- Over 600 chars dilutes the trigger signal

## Pushy voice checklist

- [ ] Starts with a verb (Create, Generate, Run, Walk, Extract, Audit, Draft)
- [ ] Contains the literal phrase "Use when"
- [ ] Quotes at least 3 concrete user phrases
- [ ] Includes at least one non-English phrase when appropriate (dhelix is KR+EN)
- [ ] Avoids meta phrases ("this skill is for...", "used for...")
- [ ] Avoids vague nouns ("stuff", "things", "operations")

## Negative examples to avoid

| Pattern | Why it fails |
|---|---|
| `"Used for X."` | Passive, no trigger condition |
| `"X helper."` | Noun-only, model can't match it |
| `"Does X, Y, Z, and also A and B."` | Scope too broad, dilutes triggers |
| `"Claude will automatically know when to use this."` | Meta, no signal |

## Iteration pattern (preview of Phase 3)

In Phase 3, `description-optimizer.ts` will:

1. Generate 10 should-trigger + 10 should-not-trigger evals
2. Measure baseline trigger accuracy
3. Ask the model to rewrite the description to fix failures
4. Accept the rewrite only if accuracy improves by ≥ 5%
5. Roll back on regressions greater than 10%

Until then, aim for **≥ 8/10 should-trigger** and **≤ 1/10 should-not-trigger** manually.
