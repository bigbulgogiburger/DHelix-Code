### >>> ACTIVE PHASE: 1 — Foundation (주 1-2) <<<

**Goal**: 최소 동작하는 스트리밍 채팅 CLI

**Deliverables** (ordered by dependency):

1. Project scaffolding: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `tsup.config.ts`, `vitest.config.ts`, `bin/dbcode.mjs`
2. `src/constants.ts` — version, default paths, limits
3. `src/utils/` — logger.ts (pino), events.ts (mitt typed bus), error.ts (custom errors), path.ts (cross-platform `/` normalization), platform.ts (OS detection)
4. `src/config/` — schema.ts (Zod full config), defaults.ts, loader.ts (5-level hierarchical), types.ts
5. `src/auth/` — token-manager.ts, token-store.ts (env/file/keychain), types.ts
6. `src/llm/` — provider.ts (interface), client.ts (OpenAI SDK wrapper with baseURL), streaming.ts (SSE consumer + chunk assembly), token-counter.ts (js-tiktoken + lightweight fallback)
7. `src/core/conversation.ts` — immutable conversation state machine
8. `src/core/message-types.ts` — all message type definitions
9. `src/core/system-prompt-builder.ts` — modular system prompt assembly
10. `src/cli/renderer/` — markdown.ts (marked + marked-terminal), syntax.ts (shiki codeToAnsi)
11. `src/cli/components/` — StreamingMessage.tsx, MessageList.tsx, UserInput.tsx (multiline), Spinner.tsx, StatusBar.tsx, ErrorBanner.tsx
12. `src/cli/hooks/` — useConversation.ts, useStreaming.ts, useInput.ts, useKeybindings.ts
13. `src/cli/App.tsx` — root Ink component composing all UI
14. `src/index.ts` — CLI bootstrap (commander), `--version`, basic flags
15. Unit tests for config, conversation, LLM client, token counter

**Acceptance Criteria**:

- [ ] `npm run build` succeeds with zero errors
- [ ] `npx dbcode --version` prints version
- [ ] `npx dbcode` → type message → streaming markdown response renders in terminal
- [ ] `npm test` — all unit tests pass
- [ ] ESLint + Prettier pass with zero warnings
- [ ] No circular dependencies (verify with `madge --circular`)
