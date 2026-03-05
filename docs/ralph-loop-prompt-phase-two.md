### >>> ACTIVE PHASE: 2 — Tool System (주 3-4) <<<

**Goal**: LLM이 도구를 호출하여 코드를 읽고 수정 가능

**Deliverables** (ordered by dependency):

1. `src/tools/types.ts` — ToolDefinition, ToolResult, ToolContext, PermissionLevel interfaces
2. `src/tools/validation.ts` — Zod schema → JSON Schema conversion (zod-to-json-schema)
3. `src/tools/registry.ts` — Tool registration, lookup, lazy loading, `getDefinitionsForLLM()`
4. `src/tools/executor.ts` — Execution wrapper with timeout (AbortController), error handling
5. `src/tools/definitions/file-read.ts` — Read files with line numbers, offset/limit support
6. `src/tools/definitions/file-write.ts` — Create/overwrite files (must read first if exists)
7. `src/tools/definitions/file-edit.ts` — Search/Replace with uniqueness validation
8. `src/tools/definitions/bash-exec.ts` — Shell execution with timeout, background support
9. `src/tools/definitions/glob-search.ts` — File pattern matching, sorted by mtime
10. `src/tools/definitions/grep-search.ts` — Regex content search (ripgrep wrapper)
11. `src/tools/definitions/ask-user.ts` — Ask user questions with choices
12. `src/llm/tool-call-strategy.ts` — ToolCallStrategy interface + strategy selection
13. `src/llm/strategies/native-function-calling.ts` — OpenAI-style tool_calls handling
14. `src/core/agent-loop.ts` — ReAct agentic loop (while-loop with maxIterations guard)
15. `src/permissions/types.ts` — PermissionMode, PermissionRule types
16. `src/permissions/modes.ts` — 5 permission modes (default, acceptEdits, plan, dontAsk, bypassPermissions)
17. `src/permissions/rules.ts` — Tool-level permission rules with glob pattern matching
18. `src/permissions/manager.ts` — Permission check + approve/deny + session cache
19. `src/permissions/session-store.ts` — Session approval cache (remember "always allow")
20. `src/cli/components/ToolCallBlock.tsx` — Tool call display (collapsible, status indicator)
21. `src/cli/components/PermissionPrompt.tsx` — Permission confirmation UI [y/n/a]
22. Update `src/core/system-prompt-builder.ts` — Include tool descriptions in system prompt
23. Update `src/cli/App.tsx` — Integrate agent loop, tool call display, permission prompts
24. Unit tests for registry, executor, validation, permission manager, agent loop

**Acceptance Criteria**:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm test` — all unit tests pass (including new tool/permission tests)
- [ ] ESLint + Prettier pass with zero warnings
- [ ] No circular dependencies (verify with `madge --circular`)
- [ ] Agent loop: user says "read src/constants.ts" → LLM calls file_read → file contents displayed
- [ ] Agent loop: user says "rename function X to Y in file Z" → LLM calls file_read → file_edit sequence
- [ ] Permission prompt appears for `confirm`-level tools (file_write, file_edit, bash_exec)
- [ ] `safe` tools (file_read, glob_search, grep_search) execute without permission prompt
- [ ] Tool timeout: bash_exec respects 120s timeout, file ops 30s timeout
- [ ] maxIterations (50) prevents infinite agent loops
