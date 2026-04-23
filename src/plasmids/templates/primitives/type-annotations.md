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
template: type-annotations
---

# ${name}

All exported functions and public class members MUST declare explicit parameter
and return types. Implicit `any` is forbidden.

## Rule

- Top-level exported functions: explicit parameter types and return type.
- Class public methods and getters: explicit return type.
- Prefer `readonly` properties on interfaces representing values.
- Use `unknown` for untyped externals; never `any`.

## Eval cases

- id: explicit-signature
  description: an exported function with full signature passes.
  input: "export function greet(name: string): string { return `hi ${name}`; }"
  expectations:
    - pattern:\):\s*[A-Za-z<][^=]*\{

- id: reject-implicit-any
  description: a parameter without a type annotation is rejected.
  input: "export function bad(x) { return x; }"
  expectations:
    - not-contains:(x:
