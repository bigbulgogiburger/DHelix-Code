---
id: ${id}
name: ${name}
description: ${description}
version: ${version}
tier: L1
scope: ${scope}
privacy: ${privacy}
locale: ${locale}
created: ${created}
updated: ${updated}
template: pr-title-format
---

# ${name}

PR titles MUST follow Conventional Commits: `<type>(<scope>): <subject>`.

## Rule

- `type` is one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
- `scope` is a lowercase kebab-case module identifier in parentheses.
- `subject` is imperative mood, lowercase, no trailing period, max 72 chars.
- Regex (reference): `^(feat|fix|refactor|docs|test|chore|perf|ci)\([a-z][a-z0-9-]*\): [^A-Z].{1,70}[^.]$`

## Eval cases

- id: valid-feat
  description: a well-formed feat title passes.
  input: "feat(plasmids): add template registry"
  expectations:
    - pattern:^(feat|fix|refactor|docs|test|chore|perf|ci)\([a-z][a-z0-9-]*\):\s

- id: reject-missing-scope
  description: a title without a scope must be rejected.
  input: "feat: add template registry"
  expectations:
    - not-contains:):
