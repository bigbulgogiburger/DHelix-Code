# Context, Runtime, and Session Benchmark Notes

## Why This Needs Its Own Document

DHelix already has a strong context architecture on paper. The second deep-dive showed the real gap is not feature absence but runtime invariants and transition semantics.

## DHelix Strengths

- 3-layer context handling already exists in `src/core/context-manager.ts`
- compaction is wired into the main loop
- rehydration exists
- prompt shaping is token-budget aware

These are real strengths. Many tools never get this far.

## 벤치마킹 대상 Advantages

### 1. Transition-aware runtime

The 벤치마킹 대상’s `query.ts` behaves like a transition machine, not just a `while` loop. Continue reasons are explicit, which makes recovery and debugging far clearer.

Most relevant benchmark idea for DHelix:

- persist `transition` state per loop iteration
- distinguish `tool_followup`, `preemptive_compact`, `prompt_too_long_retry`, `budget_continue`, `max_output_retry`

### 2. Invariant-safe tail preservation

The 벤치마킹 대상 explicitly avoids breaking API invariants during compaction:

- `tool_use` and `tool_result` pairs stay coherent
- assistant fragments sharing a message id are preserved together

DHelix’s current tail preservation is simpler and therefore more fragile in tool-heavy sessions.

### 3. Autocompact circuit breaker

The 벤치마킹 대상 stops repeated doomed compaction attempts after several failures. DHelix currently lacks an equivalent per-session failure suppression model.

### 4. Transcript durability as a product concern

The 벤치마킹 대상 treats long-session continuity as a transcript management problem:

- append-oriented logging
- compaction-aware metadata preservation
- safer resume after context mutation

DHelix session persistence is correct, but still too naive for very long sessions.

## Current DHelix Fault Lines

### Runtime ownership is split

The biggest structural problem is that runtime responsibility is spread across:

- `src/index.ts`
- `src/cli/hooks/useAgentLoop.ts`
- `src/core/agent-loop.ts`

That causes duplicated context preparation and weakens observability.

### Context lifecycle is duplicated

`useAgentLoop` may prepare context, and `runAgentLoop` constructs another `ContextManager` and prepares/compacts again. That means cold-storage references and compaction state are not coherent.

### Session persistence will not scale well

`SessionManager.appendMessages()` currently rewrites the whole transcript, and the UI persists turns asynchronously. That creates both scaling cost and shutdown-loss risk.

## Concrete Changes

### Phase A. Transition-state model

Add:

- `LoopTransitionReason`
- per-turn transition logging
- failure and retry classification tied to transitions

### Phase B. Compaction invariants

Before preserving the recent tail:

- walk backward to include missing tool partners
- keep same-message assistant fragments together
- preserve active plan/mode/tool-schema deltas

### Phase C. Compaction circuit breaker

Add:

- per-session failure counter
- backoff or suppression after repeated failure
- operator-visible compaction state

### Phase D. Append-first session logging

Move to:

- true append writes
- boundary-aware resume
- metadata preservation through compacted sessions

## High-Priority Metrics

- compaction attempts per session
- compaction failures per session
- average tokens reclaimed
- average resumed session size
- turns completed after first compaction
- repeated-retry suppression count

## Recommendation

Treat long-session continuity as a first-class product capability. This is one of the cleanest places where DHelix can become noticeably more reliable without chasing feature breadth first.
