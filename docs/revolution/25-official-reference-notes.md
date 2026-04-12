# Official Reference Notes

## Why This Exists

Most of the roadmap is based on local source analysis. These official references help confirm which parts of the 벤치마킹 대상 are product-level capabilities versus local implementation details.

## References Used

- official overview
- official hooks guide
- official IDE integrations guide
- Anthropic MCP connector documentation

## Relevant Product Signals

### Hooks

The official documentation shows hooks as a first-class lifecycle concept. That strengthens the case that DHelix should finish hook wiring around tool execution and permissions instead of leaving hooks mostly around session edges.

### IDE integrations

The official documentation treats IDE connectivity as an operational feature, not a sidecar. That supports the DHelix roadmap item to fully surface diagnostics, code actions, workspace symbols, and diff/review flows through the CLI and VS Code bridge.

### MCP

Anthropic’s MCP connector documentation confirms an important product split:

- remote URL-based MCP can be treated as API-connected tool infrastructure
- local servers, prompts, and resources still require a richer client-side connection model

That matches the DHelix conclusion that MCP transport UX and richer prompt/resource wiring should remain separate concerns.

## Recommendation

Use official docs as product confirmation, but keep local source analysis as the primary benchmark. The strongest roadmap items came from reading the actual code paths, not from the marketing surface.
