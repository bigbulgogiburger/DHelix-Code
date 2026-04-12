# Command, Permission, and Extension Governance

## Main Diagnosis

DHelix already has commands, permissions, hooks, skills, MCP, and subagents. The missing piece is a stronger governance layer that makes these surfaces feel like one platform.

## Where the 벤치마킹 대상 Is Stronger

The 벤치마킹 대상 treats commands and extensions as one typed graph. Built-ins, bundled skills, plugins, and MCP-loaded command surfaces all carry richer metadata through the system.

Useful benchmark files:

- `types/command.ts`
- `plugins/builtinPlugins.ts`
- `skills/loadSkillsDir.ts`

## DHelix Gaps

### 1. Command graph is still too narrow

`src/commands/registry.ts` is clean, but it only models slash commands. It should grow toward a common command metadata layer that can also describe:

- MCP prompt commands
- skill-backed commands
- workflow commands
- hidden/internal commands

### 2. Permission semantics are stronger than their UX integration

`src/permissions/manager.ts` has good internal ordering, but command UX, runtime UX, and persistent rule UX still do not feel like one coherent operator model.

### 3. Extension surfaces are still partially separate products

MCP prompts, skills, and built-in commands should be more visibly governed by one system for discoverability, trust, and diagnostics.

## Development Plan

### Phase 1

Introduce a shared command metadata type that can wrap slash commands, MCP prompts, and future workflow entries.

### Phase 2

Expose permission provenance in operator surfaces:

- why a tool was allowed
- why it was denied
- whether the decision came from mode, session approval, or persistent rule

### Phase 3

Add extension diagnostics:

- invalid skill metadata
- MCP prompt registration failures
- hook load failures
- command-name collisions

## Recommendation

DHelix should not copy the 벤치마킹 대상’s exact extension topology, but it should copy the governance discipline. The product already has many powerful surfaces. They need to be made legible, typed, and auditable as one system.
