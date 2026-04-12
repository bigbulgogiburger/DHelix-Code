# Core Runtime Invariants and Stage Model

## Main Diagnosis

DHelix has a good loop and a good context manager, but it still behaves more like a capable implementation than a runtime platform.

The benchmark gap with the 벤치마킹 대상 is not raw intelligence. It is invariant discipline.

## Runtime Invariants DHelix Should Enforce

### 1. Every loop continuation must have a reason

`src/core/agent-loop.ts` should carry a typed transition object such as:

- `tool_followup`
- `preemptive_compact`
- `context_recovery_retry`
- `response_retry`
- `budget_continue`
- `done`

Without this, retries and long-session recovery remain hard to debug.

### 2. Context shaping must run in a fixed order

Target order:

1. observation masking
2. tool-result budgeting
3. microcompact to cold refs
4. threshold compaction
5. post-compact restoration
6. prompt build
7. model sampling

This should be explicit, not hidden inside broad helper calls.

### 3. Preserved tails must be coherent

When only part of the conversation is kept:

- `tool_use` and `tool_result` pairs must remain linked
- multipart assistant fragments must stay together
- active plan and mode state must survive compaction

## File-Level Impact

Primary files:

- `src/core/agent-loop.ts`
- `src/core/context-manager.ts`
- `src/core/system-prompt-builder.ts`
- `src/core/session-manager.ts`

New modules worth adding:

- `src/core/runtime-stages.ts`
- `src/core/runtime-transitions.ts`
- `src/core/runtime-events.ts`

## Development Plan

### Step 1

Add `RuntimeStage` and `LoopTransitionReason` types and emit them from the loop.

### Step 2

Split `ContextManager.prepare()` into explicit internal phases that can be measured independently.

### Step 3

Add invariant repair for preserved tails before final compaction output is returned.

### Step 4

Persist transition and compaction summaries into session metadata for later `/resume` and debugging.

## Recommendation

If DHelix wants stronger core behavior, this is the center of gravity. New features will keep destabilizing the product until runtime invariants become first-class code.
