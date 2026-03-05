### >>> ACTIVE PHASE: 6 — Polish & Distribution (주 12-16) <<<

**Goal**: Repository Map, 텔레메트리, 테스트 80%+, 배포, 고급 UX

**Deliverables** (ordered by dependency):

1. `src/indexing/repo-map.ts` — Repository map using tree-sitter (WASM) + graph ranking for context selection
2. `src/telemetry/config.ts` — OpenTelemetry environment variable configuration
3. `src/telemetry/metrics.ts` — Counter definitions (tokens, sessions, tool usage)
4. `src/telemetry/events.ts` — Event schema (tool decisions, errors)
5. `src/telemetry/otel-exporter.ts` — OpenTelemetry metrics + events export (OTLP, Prometheus)
6. `src/commands/config.ts` — /config interactive settings UI
7. `src/commands/diff.ts` — /diff interactive viewer (arrow key navigation, file browsing)
8. `src/commands/doctor.ts` — /doctor diagnostic (installation, config, connectivity checks)
9. `src/commands/stats.ts` — /stats usage visualization (daily usage, sessions, model preferences)
10. `src/commands/context.ts` — /context usage color grid visualization
11. `src/commands/copy.ts` — /copy code block selection and copy
12. `src/commands/export.ts` — /export [filename] conversation export
13. `src/commands/fork.ts` — /fork [name] conversation forking
14. `src/commands/output-style.ts` — /output-style (default, explanatory, learning, custom)
15. `src/commands/rename.ts` — /rename [name] session naming
16. `src/commands/cost.ts` — /cost token usage breakdown
17. `src/commands/mcp.ts` — /mcp server management (add/remove/list)
18. Auto lint+test feedback loop: PostToolUse → run linter → feed failures back to LLM
19. `--add-dir` multi-directory support for monorepo/multi-repo workflows
20. Theme system: dark/light/auto/colorblind-accessible in `src/cli/renderer/`
21. StatusBar completion: token usage, context %, model, effort level display
22. `dbcode update` command — self-update mechanism
23. npm distribution: verify `npm pack` → install → run cycle
24. Air-gap deployment: `npm pack` + offline installation guide
25. Comprehensive unit tests: all modules 80%+ coverage
26. Integration tests: agent-loop, tool-execution, permission-flow, MCP connection
27. E2E tests: key user scenarios (file editing, multi-turn conversation, session resume)

**Acceptance Criteria**:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm test` — all tests pass
- [ ] `vitest --coverage` — 80%+ coverage across all modules
- [ ] ESLint + Prettier pass with zero warnings
- [ ] No circular dependencies (verify with `madge --circular`)
- [ ] repo-map selects relevant code within token budget automatically
- [ ] OpenTelemetry metrics export to OTLP endpoint
- [ ] /doctor verifies: Node.js version, LLM connectivity, config validity
- [ ] /stats shows daily usage with visual charts
- [ ] Theme switching works: `dbcode --theme light`
- [ ] `npm pack` → air-gap install → `dbcode --version` works
- [ ] Auto lint loop: file_edit → linter runs → errors fed back → LLM auto-fixes
- [ ] All slash commands (15+) functional and documented
- [ ] Integration tests cover full agent loop with tool calls
