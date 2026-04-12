# DHelix Revolution Epics and Workstreams

## Epic 1. Runtime Stage Refactor

Goal:

- turn `runAgentLoop` into an explicit staged runtime

Workstreams:

- define stage model and transition contracts
- extract runtime metrics and event emission
- separate recovery, compaction, and sampling checkpoints
- add per-stage timing and failure counters

Primary files:

- `src/core/agent-loop.ts`
- `src/core/context-manager.ts`
- `src/core/recovery-*.ts`

## Epic 2. Tool Runtime Refactor

Goal:

- separate scheduling, policy, execution, and result storage

Workstreams:

- introduce scheduler abstraction
- centralize hook/permission/guardrail mediation
- add persistent result storage metadata
- unify shell-task lifecycle behavior

Primary files:

- `src/tools/executor.ts`
- `src/tools/registry.ts`
- `src/permissions/`
- `src/hooks/`

## Epic 3. Durable Jobs and Team State

Goal:

- make delegated work resumable, inspectable, and durable

Workstreams:

- persist subagent/team state
- store artifacts and status snapshots
- add attach/resume/cancel flows
- expose job timeline and final summaries

Primary files:

- `src/subagents/spawner.ts`
- `src/subagents/team-manager.ts`
- new `src/jobs/` or `src/orchestration/`

## Epic 4. CLI Operations Surfaces

Goal:

- give operators a stronger control surface for long-running work

Workstreams:

- jobs panel
- approvals panel
- artifact panel
- compaction/runtime health panel
- richer diff/review output mode

Primary files:

- `src/cli/App.tsx`
- `src/cli/components/`
- `src/cli/hooks/`

## Epic 5. IDE and Extension Upgrade

Goal:

- make editor integration operational, not decorative

Workstreams:

- active file and selection context bridge
- diff viewing and apply flow
- task and agent background view
- error/reference navigation bridge

Primary files:

- `vscode-extension/src/`
- MCP/editor bridge code

## Epic 6. Typed Skills and Agent Manifests

Goal:

- evolve markdown capabilities into a typed extensibility platform

Workstreams:

- typed manifest schema
- trust-tier model
- version/dependency metadata
- validation and dry-run support

Primary files:

- `src/skills/`
- `src/subagents/definition-*`
- `src/commands/agents.ts`

## Epic 7. Policy Provenance and Operational Auditability

Goal:

- make execution policy explainable and inspectable

Workstreams:

- permission provenance model
- hook and guardrail trace output
- MCP auth/health audit surface
- exportable runtime anomaly reports

Primary files:

- `src/permissions/`
- `src/guardrails/`
- `src/mcp/`
- `src/hooks/`

## Epic 8. Intelligence and Context Quality

Goal:

- improve answer quality under scale and long sessions

Workstreams:

- compaction quality measurement
- memory freshness and contradiction management
- stale-index and LSP health tracking
- effective-instruction debug view

Primary files:

- `src/core/context-manager.ts`
- `src/memory/`
- `src/instructions/`
- `src/indexing/`
- `src/lsp/`
