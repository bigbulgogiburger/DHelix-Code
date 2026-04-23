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
template: test-required
---

# ${name}

Every public export in `src/` MUST have at least one test that imports it.

## Rule

- A new source file under `src/**` is only complete when a matching test file
  exists under `test/unit/**` or co-located `*.test.ts` next to it.
- CI fails the PR if `src/<path>/<name>.ts` introduces a new exported symbol and
  no file under `test/**` imports from `<name>`.
- Generated files (`dist/`, `*.d.ts`, build output) are exempt.

## Eval cases

- id: paired-source-test
  description: a module that adds a named export must ship with a test import.
  input: "export function add(a: number, b: number): number { return a + b; }\nimport { add } from \"./util.js\";"
  expectations:
    - contains:import

- id: missing-test
  description: a new export without a corresponding test must be flagged.
  input: "export function orphan() {}"
  expectations:
    - not-contains:from "./orphan
