### >>> ACTIVE PHASE: 5 — Extensibility (주 9-11) <<<

**Goal**: 훅, 스킬, 서브에이전트, MCP, 태스크 관리

**Deliverables** (ordered by dependency):

1. `src/hooks/types.ts` — HookEvent (PreToolUse, PostToolUse, Stop, etc.), HookHandler types
2. `src/hooks/registry.ts` — Hook registration, event matching (regex filters)
3. `src/hooks/runner.ts` — Hook execution (command, http, prompt, agent handlers)
4. `src/skills/types.ts` — SkillDefinition (YAML frontmatter schema)
5. `src/skills/loader.ts` — SKILL.md file loader with YAML frontmatter parsing
6. `src/skills/registry.ts` — Skill registration, lookup, description budget management
7. `src/skills/executor.ts` — Skill execution (argument substitution, context forking)
8. `src/skills/builtin/simplify/SKILL.md` — 3 parallel review agents
9. `src/skills/builtin/batch/SKILL.md` — Large-scale parallel changes (worktree)
10. `src/skills/builtin/debug/SKILL.md` — Session debug log analysis
11. `src/subagents/types.ts` — Agent type definitions
12. `src/subagents/spawner.ts` — Sub-agent spawning (context isolation)
13. `src/subagents/builtin/explore.ts` — Exploration agent (read-only tools)
14. `src/subagents/builtin/plan.ts` — Planning agent (read-only tools)
15. `src/subagents/builtin/general.ts` — General agent (all tools)
16. `src/core/task-manager.ts` — Task list management (create/update/dependencies)
17. `src/cli/components/TaskListView.tsx` — Task list UI (Ctrl+T toggle)
18. `src/mcp/types.ts` — MCPServer, MCPTool, MCPResource types
19. `src/mcp/config.ts` — .mcp.json parsing, environment variable expansion
20. `src/mcp/client.ts` — MCP client (stdio, HTTP, SSE transports)
21. `src/mcp/tool-bridge.ts` — MCP tool → dbcode tool registry bridge (lazy loading, list_changed)
22. `src/mcp/resource-resolver.ts` — MCP resource resolution (@server:uri mentions)
23. `src/mentions/types.ts` — MentionType, ResolvedMention
24. `src/mentions/parser.ts` — @ mention parsing from input text
25. `src/mentions/resolver.ts` — Mention → actual content resolution
26. `src/mentions/autocomplete.ts` — Fuzzy matching autocomplete engine
27. `src/cli/components/MentionAutocomplete.tsx` — @ mention autocomplete dropdown
28. Update `src/index.ts` — Add `-p` (print/headless mode), `--add-dir` flags
29. Headless mode: `-p "prompt"` for CI/CD usage with structured JSON output
30. Unit tests for hooks, skills, MCP client, task-manager, mentions

**Acceptance Criteria**:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm test` — all unit tests pass
- [ ] ESLint + Prettier pass with zero warnings
- [ ] No circular dependencies (verify with `madge --circular`)
- [ ] MCP server connection → tools auto-registered in tool registry
- [ ] Bundled skill `/simplify` executes with 3 parallel review agents
- [ ] Hook system: PreToolUse hook can block tool execution
- [ ] Hook system: PostToolUse hook receives tool result
- [ ] Sub-agent spawning: explore agent runs with read-only tool subset
- [ ] Task manager: create/update tasks, dependency tracking
- [ ] @ mentions: `@file.ts` resolves to file content in context
- [ ] Headless mode: `dbcode -p "what is 2+2"` outputs answer and exits
- [ ] Keybindings: Ctrl+T toggles task list
