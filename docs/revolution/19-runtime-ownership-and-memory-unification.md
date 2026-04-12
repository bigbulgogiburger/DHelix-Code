# Runtime Ownership and Memory Unification

## Core Diagnosis

The second DHelix deep-dive exposed the most important internal architecture issue:

There is no single runtime owner.

Instead, responsibility is split across:

- `src/index.ts`
- `src/cli/hooks/useAgentLoop.ts`
- `src/core/agent-loop.ts`

That split also leaks into memory, session, and subagent persistence. The architecture currently has several "almost owners" instead of one real owner.

## Why This Is Dangerous

### 1. Context lifecycle is duplicated

Context preparation and compaction can happen in both the React hook and the core loop. That means:

- duplicated work
- inconsistent cold-storage references
- unclear metrics
- harder debugging

The duplication is visible in:

- `src/cli/hooks/useAgentLoop.ts`
- `src/core/context-manager.ts`
- `src/core/system-prompt-builder.ts`
- `src/core/agent-loop.ts`

### 2. Tool execution policy lives in the loop

The main loop is still the only true tool runtime because:

- scheduling
- permission checks
- guardrails
- auto-checkpointing
- result truncation

are still embedded there.

### 3. Memory is fragmented into separate products

Current storage models differ across:

- project memory
- core memory storage
- agent memory

Concrete fault lines:

- `src/memory/manager.ts`
- `src/core/memory-storage.ts`
- `src/subagents/agent-memory.ts`

This is not scoped storage. It is architectural fragmentation.

### 4. Jobs and team orchestration are not unified

`spawnSubagent` is active, `AgentTeamManager` is separate, background history is separate again. That creates inventory, not platform coherence.

Relevant files:

- `src/subagents/spawner.ts`
- `src/subagents/team-manager.ts`
- `src/subagents/shared-state.ts`
- `src/core/session-manager.ts`

## Strategic Target

Introduce three unifying abstractions:

### 1. `AgentRuntime`

Owns:

- prompt assembly
- context lifecycle
- loop transitions
- event wiring
- session persistence

### 2. `ToolExecutionPipeline`

Owns:

- preflight
- schedule
- execute
- postprocess

### 3. `MemoryRepository`

Owns:

- project scope
- global scope
- agent scope
- session artifact scope

## Refactor Sequence

### Step 1

Fix MCP registry reconciliation. This is isolated and immediately valuable.

### Step 2

Make `ContextManager` injectable end-to-end so there is one context owner per runtime session.

### Step 3

Extract `ToolExecutionPipeline` from `agent-loop.ts`.

### Step 4

Move session persistence to true append semantics and await persistence at turn boundaries. `src/core/session-manager.ts` already documents JSONL append semantics; the runtime should fully honor that model instead of relying on fire-and-forget UI persistence patterns.

### Step 5

Consolidate memory behind one repository API and choose one canonical project-memory location.

### Step 6

Collapse job orchestration around one durable job/session model.

### Step 7

Shrink `useAgentLoop` so it becomes a UI adapter instead of an orchestration owner.

## What Not to Copy from the Benchmark Target

DHelix should not blindly copy the 벤치마킹 대상’s size or layering density. The benchmark value is:

- explicit ownership boundaries
- durable operator state
- typed seams between runtime surfaces

Keep DHelix’s simpler file graph where possible. The target is stronger ownership, not maximum complexity.

## Recommendation

This is the deepest architecture change in the roadmap, but also the one that will unlock almost every other improvement. If DHelix wants to scale without turning every feature into another special case, it needs one runtime owner and one memory model.
