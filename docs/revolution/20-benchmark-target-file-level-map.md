# 벤치마킹 대상 File-Level Map

## Purpose

This note captures the concrete 벤치마킹 대상 file clusters that most strongly explain its maturity. The goal is not imitation by filename. The goal is to identify the integration patterns that DHelix should benchmark against.

## Runtime and Session Continuity

Key files:

- `query.ts`
- `services/compact/autoCompact.ts`
- `services/compact/compact.ts`
- `assistant/sessionHistory.ts`

What they demonstrate:

- explicit turn and compaction control
- stronger history durability and recovery posture
- clearer post-compaction reinjection discipline

## Tool Runtime and Execution Safety

Key files:

- `services/tools/toolOrchestration.ts`
- `services/tools/toolExecution.ts`
- `Tool.ts`
- `tools/BashTool/*`

What they demonstrate:

- separation between orchestration and execution
- tool-specific safety layers without collapsing policy into one loop
- typed context for execution and display

## Extension Platform

Key files:

- `types/command.ts`
- `services/plugins/pluginOperations.ts`
- `plugins/builtinPlugins.ts`
- `skills/loadSkillsDir.ts`

What they demonstrate:

- one command graph for built-in, bundled, plugin, and MCP sources
- a cleaner distinction between bundled features and user-toggleable plugins
- typed metadata that survives loading, filtering, and UX rendering

## Operator Model and Remote Durability

Key files:

- `bridge/flushGate.ts`
- `bridge/sessionRunner.ts`
- `bridge/remoteBridgeCore.ts`

What they demonstrate:

- reconnect-safe transport sequencing
- explicit queuing during flush windows
- remote work built on a durable session model instead of ad hoc background tasks

## Shell and Modal UX

Key files:

- `entrypoints/cli.tsx`
- `REPL.tsx`
- `FullscreenLayout.tsx`
- `context/modalContext.tsx`

What they demonstrate:

- layout as a first-class system
- shared UI state for overlays, dialogs, and footer actions
- operator UX that is designed as infrastructure, not decoration

## Recommendation

When DHelix copies from the 벤치마킹 대상, copy the invariant-preserving seams:

- runtime stage boundaries
- typed command metadata
- transport flush discipline
- shell layout ownership

Do not copy surface complexity without first copying the underlying contracts.
