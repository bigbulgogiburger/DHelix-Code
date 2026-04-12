# DHelix File-Level Refactor Map

## Purpose

This note translates the roadmap into the actual DHelix files that should move first. It is a bridge between strategy documents and implementation tickets.

## Runtime Ownership

Primary files:

- `src/index.ts`
- `src/cli/hooks/useAgentLoop.ts`
- `src/core/agent-loop.ts`
- `src/core/context-manager.ts`

Primary refactor:

- move orchestration ownership out of the UI hook
- introduce a single `AgentRuntime` composition boundary
- make `ContextManager` injection explicit through the full runtime path

## Tool Pipeline

Primary files:

- `src/core/agent-loop.ts`
- `src/tools/executor.ts`
- `src/tools/validation.ts`
- `src/permissions/manager.ts`

Primary refactor:

- extract preflight, scheduling, execution, and postprocess into a `ToolExecutionPipeline`
- keep policy decisions observable and testable outside the loop

## Session and Resume

Primary files:

- `src/core/session-manager.ts`
- `src/core/session-auto-save.ts`
- `src/commands/resume.ts`

Primary refactor:

- make transcript persistence truly append-first
- restore richer runtime state on resume, not just message history

## MCP and Intelligence Wiring

Primary files:

- `src/mcp/manager.ts`
- `src/mcp/manager-connector.ts`
- `src/commands/mcp.ts`
- `src/mentions/resource-resolver.ts`
- `src/lsp/manager.ts`

Primary refactor:

- reconcile tool registration on MCP state changes
- wire connector enrichment to the main runtime path
- route semantic tools through one smart-session path

## Memory and Delegation

Primary files:

- `src/memory/manager.ts`
- `src/core/memory-storage.ts`
- `src/subagents/agent-memory.ts`
- `src/subagents/spawner.ts`
- `src/subagents/team-manager.ts`

Primary refactor:

- collapse memory access behind one repository API
- unify delegated work, team state, and session durability

## Recommendation

The first real implementation batch should touch a small number of files with high leverage. The correct starting point is not more commands or more UI. It is ownership clarification in the files above.
