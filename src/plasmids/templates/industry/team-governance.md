---
id: ${id}
name: ${name}
description: ${description}
version: ${version}
tier: L3
scope: ${scope}
privacy: ${privacy}
locale: ${locale}
created: ${created}
updated: ${updated}
template: team-governance
---

# ${name}

Team-level governance rules for code review, branch workflow, and release hygiene.
This is a project-tier (L3) template — it applies when activated for the current
project and can be tuned per team without triggering the foundational challenge
flow.

## Rules

1. **Branching.**
   - Work on short-lived branches prefixed by ticket id: `feature/<KEY>-<slug>`,
     `fix/<KEY>-<slug>`, `chore/<slug>`.
   - Branches older than 7 days since last push must either merge or be marked
     `status: parked` in the PR description.
2. **Code review.**
   - Every PR requires at least one approving review from a code owner before
     merge. Self-approval is not a substitute.
   - Reviewers must acknowledge: correctness, tests, observability, docs.
3. **Release notes.**
   - User-visible changes require a `CHANGELOG.md` entry under the unreleased
     section, using the same conventional-commit type as the commit.
4. **Ownership.**
   - `CODEOWNERS` must map every top-level module. New modules require a
     CODEOWNERS update in the same PR that introduces them.
5. **SLA.**
   - PR reviews: first response within 1 business day.
   - Failing `main` build: a rollback PR is opened within 2 hours of detection.
   - Security advisories with severity high or above: triaged within 4 hours.

## Eval cases

- id: branch-name-ok
  description: a ticketed branch name passes.
  input: "feature/GAL-1-plasmid-registry"
  expectations:
    - pattern:^(feature|fix|chore)/[A-Z]+-\d+

- id: reject-untracked-branch
  description: a personal branch without a ticket key must be rejected.
  input: "my-random-work"
  expectations:
    - not-contains:/
