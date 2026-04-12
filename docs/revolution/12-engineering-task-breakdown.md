# Engineering Task Breakdown

## P0 Tasks

### Runtime

- define runtime stages and lifecycle events
- add runtime metrics collector
- expose stage trace in verbose/debug mode
- persist compaction stats into session metadata

### Tooling

- extract scheduler from executor
- define policy boundary for permissions/hooks/guardrails
- add tool-result store abstraction
- unify shell task IDs across `bash_exec`, `bash_output`, `kill_shell`

### Orchestration

- define durable job schema
- persist team state snapshots
- add resumable attach/cancel APIs

### Security and trust

- define skill trust tiers
- add permission provenance payloads
- add audit record for sensitive action outcomes

## P1 Tasks

### CLI and IDE

- jobs/approvals/artifacts panels
- diff-first review mode
- VS Code selection and active file bridge
- VS Code task and diff surfaces

### Skills and agents

- typed agent manifest schema
- typed skill manifest schema
- validation and dry-run command
- skill source and trust display

### MCP and operations

- connection health indicators
- auth failure diagnostics
- reconnect metrics
- resource/prompt/tool discovery UX cleanup

## P2 Tasks

### GUI and advanced surfaces

- web dashboard for jobs and artifacts
- delegated-agent monitor
- richer accessibility and voice command flows
- advanced enterprise policy packaging

## Dependency Notes

- runtime stages should land before major orchestration changes
- durable job schema should land before CLI jobs panel
- trust tiers should land before stronger skill power
- IDE review UX should build on the diff/artifact model, not invent a parallel one
