# Extension Platform Evolution

## Summary

The strongest new lesson from the 벤치마킹 대상 is that extensibility should not be split into unrelated systems.

Today DHelix has:

- slash commands
- skills
- hooks
- MCP prompts/resources/tools
- subagent definitions

These are useful, but they are not yet one coherent platform.

## 벤치마킹 대상 Pattern Worth Copying

### 1. One typed command graph

The 벤치마킹 대상 models built-ins, skills, local commands, plugin commands, workflow commands, and MCP-derived commands through a unified command graph with shared metadata.

That means one system can reason about:

- where a command came from
- whether it is visible
- what tools it may use
- whether it forks context
- what hooks it registers

### 2. Shared markdown/frontmatter compiler

Skills and plugin commands share parsing, argument handling, tool allowlists, models, effort hints, and hook metadata.

That avoids duplicate authoring pipelines.

### 3. Plugin system as a multi-surface platform

The 벤치마킹 대상’s plugins can provide more than commands:

- skills
- hooks
- MCP servers
- LSP servers
- agents
- output styles
- settings
- dependencies

This is materially ahead of the usual “plugin = command pack” model.

### 4. Load-time dependency demotion

Broken plugin dependency graphs do not crash startup. Dependents are demoted deterministically and surfaced clearly.

### 5. Hooks as typed execution backends

Hooks support multiple execution modes while still living under one schema and one event model.

## DHelix Gaps

### Gap A. Command-like surfaces are still separate products

Commands, skills, MCP prompts, and custom agents are defined and loaded in different ways.

### Gap B. Skills are still macro-like

DHelix skills are useful, but still closer to prompt expansion than to packaged capabilities with lifecycle metadata.

### Gap C. No plugin-grade packaging model

There is no mature story yet for:

- extension packaging
- dependency metadata
- load-time validation
- trust tiers
- reload semantics

### Gap D. Hook lifecycle is too narrow

DHelix hooks exist, but they are not yet clearly a platform with typed backends, session-scoped registration, and atomic reload.

## Development Direction

### Step 1. Introduce `ExtensionCommand`

Create one internal type covering:

- source
- loadedFrom
- visibility
- model profile
- allowed tools
- execution context
- optional hooks
- trust tier

### Step 2. Unify markdown compilation

Use one compiler for:

- skills
- plugin commands
- MCP prompt wrappers

### Step 3. Add typed extension manifests

Manifest categories:

- skill
- command
- plugin
- agent

### Step 4. Add dependency demotion

Startup should keep running even with broken extension graphs.

### Step 5. Make hooks a platform

Target backends:

- `command`
- `prompt`
- `http`
- later `agent`

## Security Direction

Because extensibility is the highest-risk surface, each extension should carry:

- source provenance
- trust tier
- validation status
- dependency health
- allowed capability set

## Recommendation

DHelix should evolve toward one extensibility graph, not five extension mini-systems.
