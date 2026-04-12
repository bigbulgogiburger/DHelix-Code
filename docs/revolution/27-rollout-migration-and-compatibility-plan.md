# Rollout, Migration, and Compatibility Plan

## Why This Matters

Several roadmap items change core ownership and persisted state:

- append-first session persistence
- compact boundary metadata
- unified command graph
- orchestration state store
- trust-tiered extension metadata

Without a migration plan, these improvements can create operator pain even if the architecture is correct.

## Migration-Sensitive Areas

### 1. Session storage

Changes to `src/core/session-manager.ts` must preserve readability of existing session directories.

Recommended rule:

- old sessions remain readable
- new metadata is additive
- no destructive rewrite on first load

### 2. Command and extension metadata

If DHelix introduces a unified command descriptor, old slash commands and skill bridges should continue to work during the transition.

Recommended rule:

- compile old structures into the new descriptor first
- remove old paths only after parity is proven

### 3. Orchestration state

Durable team or job state should start as opt-in or shadow-written metadata before becoming authoritative.

## Rollout Strategy

### Phase 1. Shadow mode

Write new metadata and runtime events without changing user-visible behavior.

### Phase 2. Read-path parity

Read both old and new forms where needed, preferring new data only when it is present and valid.

### Phase 3. Operator-visible adoption

Expose the new runtime state, jobs, and diagnostics in CLI or IDE surfaces after parity is established.

### Phase 4. Decommission old paths

Only remove old ownership paths after:

- migration stability
- regression coverage
- at least one full implementation batch in production use

## Compatibility Rules

- additive schema changes before breaking ones
- compatibility shims before deletion
- explicit feature flags around runtime rewiring
- one authoritative owner per feature at the end of rollout

## Recommendation

DHelix is now mature enough that rollout quality matters almost as much as architecture quality. The roadmap should be executed with compatibility discipline, not as a single-step refactor.
