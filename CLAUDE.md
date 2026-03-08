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
├── index.ts              # CLI bootstrap (commander), logo stdout, Ink render
├── constants.ts          # Version, paths, limits
├── cli/                  # Layer 1: Terminal UI
│   ├── App.tsx           # Root Ink component (no Logo — printed before render)
│   ├── components/       # UI components (.tsx)
│   │   ├── ActivityFeed  # Progressive Static flushing (anti-flicker)
│   │   ├── TurnBlock     # Single turn: user msg + assistant + tool calls
│   │   ├── ToolCallBlock # Tool status with diff preview
│   │   ├── StreamingMessage # Partial markdown rendering
│   │   ├── ThinkingBlock # Extended thinking UI (collapsible)
│   │   ├── StatusBar     # Model, tokens, cost, context %
│   │   ├── UserInput     # Tab autocomplete, @mentions
│   │   ├── Logo          # DB brand logo + printStartupLogo()
│   │   └── ...           # ErrorBanner, PermissionPrompt, SlashCommandMenu, Spinner
│   ├── hooks/            # React hooks
│   │   ├── useAgentLoop  # Orchestrates agent loop ↔ React state
│   │   ├── useConversation # Immutable conversation state management
│   │   ├── useTextBuffering # 100ms batched text streaming
│   │   └── ...           # useKeybindings, usePermissionPrompt, useStreaming
│   └── renderer/         # Terminal rendering
│       ├── markdown.ts   # Markdown → terminal
│       ├── tool-display.ts # Tool output formatting, diff display
│       └── synchronized-output.ts # DEC Mode 2026 atomic frame rendering
├── core/                 # Layer 2: Business logic (ZERO UI imports)
│   ├── agent-loop.ts     # ReAct loop with parallel tool execution
│   ├── activity.ts       # ActivityCollector — turn/entry tracking
│   ├── conversation.ts   # Immutable conversation state
│   ├── context-manager.ts
│   ├── session-manager.ts
│   ├── checkpoint-manager.ts
│   ├── message-types.ts
│   ├── system-prompt-builder.ts
│   └── task-manager.ts
├── llm/                  # Layer 3: LLM client
│   ├── provider.ts       # LLMProvider interface + ThinkingConfig
│   ├── client.ts         # OpenAI SDK wrapper (baseURL configurable)
│   ├── streaming.ts      # SSE stream consumer + backpressure (1MB limit)
│   ├── token-counter.ts  # js-tiktoken + LRU cache (100 entries)
│   ├── model-router.ts   # Hybrid mode routing
│   ├── model-capabilities.ts # Per-model context limits
│   ├── tool-call-strategy.ts
│   ├── strategies/       # native-function-calling.ts, text-parsing.ts
│   └── providers/        # anthropic.ts (Extended Thinking support)
├── tools/                # Layer 4: Tool system
│   ├── registry.ts       # Tool registration, lazy loading
│   ├── types.ts          # ToolDefinition, ToolResult, PermissionLevel
│   ├── executor.ts       # Timeout, AbortController, BackgroundProcessManager
│   ├── validation.ts     # Zod → JSON Schema conversion
│   └── definitions/      # 12 built-in tools (see Tools section)
├── commands/             # Slash commands (/clear, /model, /help, /undo, etc.)
│   ├── registry.ts       # Command registration and dispatch
│   └── *.ts              # 27 commands
├── instructions/         # DBCODE.md / CLAUDE.md loader
├── permissions/          # Permission system
│   ├── manager.ts        # Check + approve/deny
│   ├── rules.ts          # Glob pattern matching
│   ├── modes.ts          # default/acceptEdits/plan/dontAsk/bypassPermissions
│   └── session-store.ts  # Session approval cache
├── guardrails/           # Security (input/output filters, secret scanner)
├── sandbox/              # OS-level: macOS Seatbelt (sandbox-exec profiles)
├── hooks/                # Pre/post tool-use hooks (loader + runner)
├── subagents/            # Agent spawning with worktree isolation
├── auth/                 # Token-based auth (Bearer/API-Key/Custom)
├── config/               # 5-level hierarchical config (Zod schema)
├── mcp/                  # Model Context Protocol integration
├── skills/               # Skill system
├── telemetry/            # Usage telemetry
├── indexing/             # Codebase indexing
├── mentions/             # @mention resolution
├── types/                # Shared type definitions
└── utils/                # logger(pino), events(mitt), error, path, platform
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

## Tools (12 built-in)

| Tool          | Permission | Description                                             |
| ------------- | ---------- | ------------------------------------------------------- |
| file_read     | safe       | Read with line numbers, offset/limit, image/PDF support |
| file_write    | confirm    | Create/overwrite (must read first if exists)            |
| file_edit     | confirm    | Search/Replace with uniqueness validation, diff preview |
| bash_exec     | confirm    | Shell execution with timeout, background support        |
| glob_search   | safe       | File pattern matching, sorted by mtime                  |
| grep_search   | safe       | Regex content search (ripgrep wrapper)                  |
| list_dir      | safe       | Directory listing with metadata                         |
| web_fetch     | confirm    | HTTP fetch with content extraction                      |
| web_search    | confirm    | Brave Search + DuckDuckGo fallback                      |
| notebook_edit | confirm    | Jupyter notebook cell editing                           |
| mkdir         | confirm    | Create directories recursively                          |
| ask_user      | safe       | Ask user questions with choices                         |

## Rendering Architecture (Anti-Flicker)

Logo is printed to stdout BEFORE Ink's `render()` call — it's never part of the dynamic area.

**Progressive Static Flushing** (ActivityFeed):
- Completed entries (finished tool calls, complete text) are immediately moved to `<Static>`
- Only in-progress entries (running tools, streaming text) stay in the dynamic area
- This keeps the dynamic area small regardless of conversation length

**DEC Mode 2026** (synchronized-output.ts):
- Wraps Ink render cycles with BEGIN/END markers for atomic frame display
- Supported by Ghostty, iTerm2, WezTerm, VSCode terminal, kitty, tmux 3.4+
- Unsupported terminals safely ignore the escape sequences

**Timing**: Text buffer 100ms, spinner animation 500ms

## Multi-Turn Message Pairing

Agent loop results must be stored with proper assistant(toolCalls) → tool pairing:
```
assistant(toolCalls=[tc1,tc2]) → tool(tc1 result) → tool(tc2 result) → assistant("done")
```
Never store tool messages without a preceding assistant message containing matching `toolCalls`.
The `useAgentLoop` hook extracts new messages via `result.messages.slice(initialMessageCount)` and saves them in order.

## Agent Loop (ReAct pattern)

```
User Input → Context Prepare → Input Filter → LLM Stream → Output Filter
  → Extract Tool Calls → (none? → done) → Permission Check → Execute
  → Append Results → Audit Log → Loop Back
```

- maxIterations: 50 (infinite loop protection)
- Tool timeout: bash 120s, file ops 30s
- Auto-compaction at 95% context usage
- Parallel tool execution: read-only tools always parallel, file writes conflict on same path

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
