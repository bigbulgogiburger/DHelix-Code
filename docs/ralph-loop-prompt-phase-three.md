### >>> ACTIVE PHASE: 3 — Resilience (주 5-6) <<<

**Goal**: 세션 영속성, 컨텍스트 관리, 폴백 전략, 슬래시 명령어

**Deliverables** (ordered by dependency):

1. `src/core/session-manager.ts` — Session save/restore (JSONL format), auto-naming
2. `src/core/context-manager.ts` — Context window management (auto-compaction at 95%, targeted summarization)
3. `src/core/checkpoint-manager.ts` — File state checkpointing + rewind capability
4. `src/llm/strategies/text-parsing.ts` — XML-based tool call parsing fallback for non-function-calling models
5. Update `src/llm/tool-call-strategy.ts` — Auto-detect strategy (probe model capabilities)
6. `src/llm/model-router.ts` — Hybrid mode routing (simple→local, complex→external), fallback model switching
7. `src/instructions/loader.ts` — DBCODE.md / .dbcode/rules/ loader with @import syntax
8. `src/instructions/parser.ts` — @import directive processing
9. `src/instructions/path-matcher.ts` — Path-based conditional rule loading
10. `src/commands/registry.ts` — Slash command registry
11. `src/commands/clear.ts` — /clear command
12. `src/commands/compact.ts` — /compact [focus] command (manual compaction)
13. `src/commands/help.ts` — /help command
14. `src/commands/model.ts` — /model command (switch model mid-session)
15. `src/commands/resume.ts` — /resume command (list + resume sessions)
16. `src/commands/rewind.ts` — /rewind command (checkpoint restore + summary)
17. `src/commands/effort.ts` — /effort [low|medium|high|max] command
18. `src/commands/fast.ts` — /fast command (toggle fast output mode)
19. `src/cli/components/SlashCommandMenu.tsx` — Slash command autocomplete menu
20. Update `src/cli/App.tsx` — Integrate session persistence, slash commands, context management
21. Update `src/index.ts` — Add `--continue`, `--resume` CLI flags
22. Error recovery: classify-retry-fallback pattern in agent loop
23. Message queuing: type next instruction while LLM is responding (FIFO queue)
24. Unit tests for session-manager, context-manager, text-parsing strategy, slash commands

**Acceptance Criteria**:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm test` — all unit tests pass
- [ ] ESLint + Prettier pass with zero warnings
- [ ] No circular dependencies (verify with `madge --circular`)
- [ ] Session saves on exit, `dbcode --continue` resumes last session
- [ ] /rewind restores checkpoint with summary
- [ ] /compact reduces context window usage
- [ ] Text-parsing fallback works with models that don't support function calling
- [ ] Model router switches to fallback on overload/error
- [ ] DBCODE.md instructions loaded into system prompt automatically
- [ ] Slash commands autocomplete on `/` input
- [ ] Message queuing: can type while LLM is streaming, queued messages sent after
