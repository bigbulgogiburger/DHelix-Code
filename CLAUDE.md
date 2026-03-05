# CLAUDE.md — dbcode Project Instructions

## Project Overview

- **What**: CLI AI coding assistant (Claude Code-level) for local/external LLMs
- **Runtime**: Node.js 20+ / TypeScript 5.x / ESM only
- **UI**: Ink 5.x (React for CLI), JSX runtime = ink
- **Test**: Vitest
- **Build**: tsup (ESM output)
- **Lint**: ESLint + Prettier
- **Platform**: Windows + macOS cross-platform

## Architecture Layers (dependency direction: top → bottom only)

```
CLI (Ink/React)  →  Core  →  LLM / Tools / Permissions / Hooks  →  Utils
```

- CLI depends on Core (never reverse)
- Core orchestrates LLM, Tools, Permissions, Hooks
- Utils is leaf module (no internal dependencies)
- **Circular dependencies are forbidden** — verify with `madge --circular src/`

## Directory Structure

```
src/
├── index.ts              # CLI bootstrap (commander)
├── constants.ts          # Version, paths, limits
├── cli/                  # Layer 1: Terminal UI
│   ├── App.tsx           # Root Ink component
│   ├── components/       # UI components (.tsx)
│   ├── hooks/            # React hooks (useConversation, useStreaming, etc.)
│   └── renderer/         # markdown.ts, syntax.ts
├── core/                 # Layer 2: Business logic (ZERO UI imports)
│   ├── agent-loop.ts     # ReAct agentic loop
│   ├── conversation.ts   # Immutable conversation state
│   ├── context-manager.ts
│   ├── session-manager.ts
│   ├── checkpoint-manager.ts
│   ├── message-types.ts
│   ├── system-prompt-builder.ts
│   └── task-manager.ts
├── llm/                  # Layer 3: LLM client
│   ├── provider.ts       # LLMProvider interface
│   ├── client.ts         # OpenAI SDK wrapper (baseURL configurable)
│   ├── streaming.ts      # SSE stream consumer + chunk assembly
│   ├── token-counter.ts  # js-tiktoken (accurate) + tokenx (realtime)
│   ├── model-router.ts   # Hybrid mode routing
│   ├── tool-call-strategy.ts
│   └── strategies/       # native-function-calling.ts, text-parsing.ts
├── tools/                # Layer 4: Tool system
│   ├── registry.ts       # Tool registration, lazy loading
│   ├── types.ts          # ToolDefinition, ToolResult, PermissionLevel
│   ├── executor.ts       # Timeout, AbortController wrapper
│   ├── validation.ts     # Zod → JSON Schema conversion
│   └── definitions/      # file-read/write/edit, bash-exec, glob, grep, ask-user
├── permissions/          # Layer 5: Permission system
│   ├── manager.ts        # Check + approve/deny
│   ├── rules.ts          # Glob pattern matching
│   ├── modes.ts          # default/acceptEdits/plan/dontAsk/bypassPermissions
│   └── session-store.ts  # Session approval cache
├── guardrails/           # Layer 6: Security
│   ├── input-filter.ts, output-filter.ts, secret-scanner.ts
│   ├── rate-limiter.ts, token-budget.ts, audit-logger.ts
│   └── content-policy.ts
├── sandbox/              # OS-level: macOS Seatbelt, Windows AppContainer
├── auth/                 # Token-based auth (Bearer/API-Key/Custom)
├── config/               # 5-level hierarchical config (Zod schema)
├── utils/                # logger(pino), events(mitt), error, path, platform
└── [future: hooks/, skills/, mcp/, tasks/, plugins/, telemetry/, subagents/, mentions/, commands/]
```

## Key Interfaces

```typescript
// Tool definition (src/tools/types.ts)
interface ToolDefinition<TParams = unknown> {
  readonly name: string;
  readonly description: string;
  readonly parameterSchema: z.ZodSchema<TParams>;
  readonly permissionLevel: "safe" | "confirm" | "dangerous";
  readonly execute: (params: TParams, context: ToolContext) => Promise<ToolResult>;
}

// LLM Provider (src/llm/provider.ts)
interface LLMProvider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  countTokens(text: string): number;
}

// Dual tool-call strategy (src/llm/tool-call-strategy.ts)
interface ToolCallStrategy {
  readonly name: "native" | "text-parsing";
  prepareRequest(messages: ChatMessage[], tools: ToolDefinition[]): LLMRequest;
  extractToolCalls(response: LLMResponse): ExtractedToolCall[];
  formatToolResults(results: ToolCallResult[]): ChatMessage[];
}
```

## Coding Conventions

- Named exports only (no default exports)
- Immutable state: readonly properties, spread copy for mutations
- Error classes extend BaseError from src/utils/error.ts
- All async — no sync fs operations ever
- Cross-platform paths: always use src/utils/path.ts (normalizes to `/`)
- No `any` type — use `unknown` + type guards
- Zod schemas for all external inputs (config, tool params, API responses)
- AbortController/AbortSignal for all cancellable operations
- Event emission (mitt) at meaningful state transitions

## Import Rules

- ESM: use `.js` extension in relative imports (e.g., `import { foo } from './bar.js'`)
- No circular dependencies
- No importing from cli/ inside core/, llm/, tools/, or utils/

## TypeScript Config Essentials

- target: ES2022, module: ESNext, moduleResolution: bundler
- jsx: react-jsx, jsxImportSource: ink
- strict: true, noImplicitAny: true, noUnusedLocals: true

## P0 Tools (MVP required)

| Tool        | Permission | Description                                             |
| ----------- | ---------- | ------------------------------------------------------- |
| file_read   | safe       | Read with line numbers, offset/limit, image/PDF support |
| file_write  | confirm    | Create/overwrite (must read first if exists)            |
| file_edit   | confirm    | Search/Replace with uniqueness validation               |
| bash_exec   | confirm    | Shell execution with timeout, background support        |
| glob_search | safe       | File pattern matching, sorted by mtime                  |
| grep_search | safe       | Regex content search (ripgrep wrapper)                  |
| ask_user    | safe       | Ask user questions with choices                         |

## Agent Loop (ReAct pattern)

```
User Input → Context Prepare → Input Filter → LLM Stream → Output Filter
  → Extract Tool Calls → (none? → done) → Permission Check → Execute
  → Append Results → Audit Log → Loop Back
```

- maxIterations: 50 (infinite loop protection)
- Tool timeout: bash 120s, file ops 30s
- Auto-compaction at 95% context usage

## Commit Style

- Conventional: feat(module), fix(module), test(module), refactor(module), chore(module)
- One logical change per commit
- All checks pass before commit: `npm run typecheck && npm run lint && npm test && npm run build`

## Compact Instructions

When compacting, always preserve:

- Current phase and deliverable progress (X/N complete)
- Recent test failures and their root causes
- Architecture decisions made during this session
- Files created/modified in this session
- Any blockers or workarounds discovered
