# Verification and Regression Strategy

## Why This Is Missing

The roadmap is now strong on architecture and prioritization, but it was still weak on one execution-critical question:

How will DHelix prove that these refactors improved the product instead of just moving complexity around?

## Highest-Risk Regression Zones

### 1. Runtime refactors

Any change around `src/core/agent-loop.ts`, `src/core/context-manager.ts`, or `src/core/session-manager.ts` can silently break:

- long-session continuity
- tool-call ordering
- resume behavior
- token accounting

### 2. Tool runtime refactors

Any extraction of `ToolExecutionPipeline` can break:

- permission prompt timing
- hook firing order
- checkpoint behavior
- grouped parallel execution

### 3. MCP and LSP wiring

These are integration-heavy areas where bugs often show up as capability drift rather than obvious crashes.

## Required Test Layers

### Unit

Add focused tests for:

- loop transition reasons
- compaction invariant repair
- append-first transcript writes
- permission provenance objects
- command metadata compilation

### Integration

Add end-to-end flows for:

- long session with compaction plus resume
- multi-tool turn with mixed read/write tools
- MCP server reconnect and tool reconciliation
- IDE-bridge-first semantic tool path

### Golden or snapshot-style runtime tests

For selected turns, capture:

- transition sequence
- emitted runtime events
- compact boundary metadata
- persisted session shape

These are high-value for refactors that preserve behavior but reorganize ownership.

## Release Gates

Before merging Wave 1 and Wave 2 work, require:

1. no regression in existing unit and integration suites
2. explicit new tests for each new runtime seam
3. successful long-session scenario with at least one compaction
4. successful resume after compaction
5. successful MCP reconnect reconciliation scenario

## Recommendation

The next stage of DHelix is no longer “just build the feature.” Every major runtime change should ship with a proof strategy. Verification now needs to be treated as part of the product architecture.
