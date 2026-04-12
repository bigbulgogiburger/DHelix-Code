# MCP, LSP, and Intelligence Wiring Gaps

## Key Finding

DHelix already contains a surprising amount of capability here. The problem is not missing subsystems. The problem is incomplete wiring between them.

## MCP Gaps

### 1. Connector path is dormant

`MCPManagerConnector` contains useful enrichment logic, but the main UI path only calls `mcpManager.connectAll()`. In practice, `src/index.ts` still owns most startup wiring while `/mcp` UX in `src/commands/mcp.ts` is config-centric rather than runtime-centric. As a result:

- prompt discovery is underused
- resource discovery is underused
- deferred-tool registration is underused
- output limiter stats are underused
- OAuth flows are underused

### 2. Prompt and resource UX are half-integrated

Prompt command generation and resource resolution exist, but are not fully inserted into command registration and mention expansion. The gap is not protocol support. The gap is integration between:

- `src/mcp/manager-connector.ts`
- `src/mentions/resource-resolver.ts`
- `src/commands/registry.ts`
- `src/commands/mcp.ts`

### 3. CLI transport UX lags implementation

The code supports `stdio`, `http`, and `sse`, but `/mcp add` is still largely stdio-shaped.

## LSP Gaps

### 1. Smart session path is not consistently used

The intended smart entrypoint prefers IDE bridge, then self-managed LSP, then fallback. Some tools still bypass it. That means the system advertises semantic intelligence but still falls back to fragmented code paths too often.

### 2. VS Code bridge has unused power

The extension already exposes richer capabilities such as:

- workspace symbols
- diagnostics
- code actions
- call hierarchy

These are not yet surfaced as first-class CLI tools.

Relevant files:

- `src/lsp/manager.ts`
- `src/lsp/ide-bridge-manager.ts`
- `vscode-extension/src/services/workspace-symbols.ts`
- `vscode-extension/src/services/diagnostics-forwarder.ts`
- `vscode-extension/src/services/code-actions.ts`
- `vscode-extension/src/services/call-hierarchy.ts`

## Indexing Gaps

### 1. Shared backend is missing

Multiple code intelligence tools still use separate regex flows while the richer tree-sitter engine exists in parallel.

### 2. Repo map and symbol tools should converge

Tree-sitter should become the shared backend with regex as fallback, not a parallel advanced path.

## Instruction and Permission Wiring Gaps

### 1. Instructions have eager and lazy loaders but only partial use

This is an opportunity for explicit two-phase loading:

- eager repo-level instructions
- lazy path-scoped rules on demand

### 2. Permission persistence is inconsistent

There is a solid persistent store, but command UX and prompt UX do not consistently use it.

## Development Plan

### MCP

- wire connector initialization into the real connection path
- register MCP prompt commands in the command registry
- wire MCP resource resolver into mentions
- expose remote transports in `/mcp add`
- add reconciliation logic so stale tool registrations are removed when server state changes

### LSP

- route all semantic tools through smart session acquisition
- add CLI surfaces for diagnostics, code actions, workspace symbols, and call hierarchy

### Indexing

- move `symbol_search`, `code_outline`, and repo-map generation to a shared tree-sitter backend
- keep regex fallback for unsupported languages or startup-fast paths

### Instructions and permissions

- adopt two-phase instruction loading
- unify permission persistence semantics between commands, prompts, and runtime

## Benchmark Note from the External Target

The 벤치마킹 대상’s advantage here is less about raw protocol breadth and more about disciplined integration. DHelix should copy that discipline, not its exact product surface. Finish the end-to-end MCP/LSP wiring before inventing another intelligence subsystem.

## Recommendation

Before building brand-new capability in these areas, DHelix should first fully wire what it already has.
