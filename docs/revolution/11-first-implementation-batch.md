# First Implementation Batch

## Objective

Ship the first batch that improves runtime maturity without destabilizing the product surface.

This batch should avoid large UX churn and focus on foundational internal seams.

## Batch Scope

### 1. Runtime stage model

Deliver:

- internal stage enum/types
- per-stage events
- per-stage timers

Minimum success bar:

- no user-visible regressions
- stage traces available in verbose mode

### 2. Tool scheduler split

Deliver:

- scheduler extraction from loop/executor coupling
- explicit grouping and conflict reasoning
- policy handoff seam

Minimum success bar:

- current tests remain green
- tool ordering is unchanged for existing cases

### 3. Compaction instrumentation

Deliver:

- compaction counters
- reclaimed-token metrics
- session-level stats persistence

Minimum success bar:

- metrics emitted for both microcompact and threshold compaction

### 4. Shell task durability base

Deliver:

- persistent task record schema
- stdout cursor/index model
- attach and cancel primitives

Minimum success bar:

- background shell work survives UI detach within the same session lifecycle

## Suggested PR Sequence

1. runtime stage types and events
2. runtime metrics plumbing
3. scheduler extraction
4. compaction metrics persistence
5. shell task record model

## Tests Required

- unit tests for stage transitions
- unit tests for scheduler grouping
- unit tests for compaction metric emission
- integration tests for shell attach/cancel
- regression tests for current tool execution order

## Files Likely to Change First

- `src/core/agent-loop.ts`
- `src/core/context-manager.ts`
- `src/tools/executor.ts`
- `src/tools/registry.ts`
- `src/cli/hooks/useAgentLoop.ts`

## Explicit Non-Goals

- no GUI yet
- no large command redesign yet
- no typed skill marketplace yet
- no big editor UX overhaul in batch one
