# Remote, Background, and Operator Model

## Key Finding

The 벤치마킹 대상’s biggest practical advantage is not just “background jobs exist.” It is that remote/background continuity is treated as a transport and operator-state problem from the start.

## 벤치마킹 대상 Patterns Worth Copying

### 1. Ordered reconnect gating

Outbound mutations are gated while history or reconnect work is in flight. This prevents ordering corruption during rebuilds.

### 2. Session-level UUID dedup

Both inbound and outbound events are deduplicated by stable identifiers.

### 3. Canonical task state

Tasks have:

- stable id
- output file
- output offset
- timestamps
- notification state

That makes foregrounding, killing, summarizing, and resuming coherent.

### 4. Resume restores execution context

Resume is not just transcript replay. It restores work context, filters unsafe cross-project resumes, and loads histories progressively.

### 5. Operator HUD

Background work is exposed through:

- compact pills
- detail dialogs
- grouped task views
- concise progress summaries

## Current DHelix Gaps

### Gap A. No unified durable job model

Subagent backgrounding exists, but there is no canonical job schema shared across:

- subagents
- shell tasks
- teams
- future remote jobs

### Gap B. Resume is transcript-centric

Current resume flow is much closer to “pick a previous chat” than “restore a working execution context.”

### Gap C. Operator observability is too transcript-shaped

The UI shows activity, but background and delegated work need their own control surface.

### Gap D. No reconnect/dedup model yet

If DHelix grows remote execution, it needs ordered flush gating and UUID-based event dedup from day one.

## Design Direction

### Canonical `TaskStateBase`

Every long-lived work unit should share:

- `id`
- `kind`
- `status`
- `outputFile`
- `outputOffset`
- `startedAt`
- `endedAt`
- `notified`
- `parentSessionId`
- `ownerAgentId`

### Operator Surfaces

Build three layers:

1. footer summary
2. jobs browser
3. task detail / attach / resume view

### Resume Rules

Resume should restore:

- prompt state
- active jobs
- active task summaries
- agent/team context
- session metadata

## Development Plan

### Phase 1

- define durable job schema
- add output metadata
- add attach/cancel APIs

### Phase 2

- make resume context-aware
- add safer filtering and metadata restoration

### Phase 3

- add operator HUD and detail views
- add notification compaction

### Phase 4

- add remote transport semantics only after local durability is correct

## Recommendation

Do not build remote execution first. Build the operator model first, then attach remote transport semantics to it.
