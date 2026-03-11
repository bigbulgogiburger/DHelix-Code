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
├── constants.ts          # Version, paths, limits, getProjectConfigPaths(), INPUT_HISTORY_FILE
├── cli/                  # Layer 1: Terminal UI
│   ├── App.tsx           # Root Ink component (keyboard shortcuts, permission cycling)
│   ├── components/       # UI components (.tsx)
│   │   ├── ActivityFeed  # Progressive Static flushing (anti-flicker)
│   │   ├── TurnBlock     # Single turn: user msg + assistant + tool calls
│   │   ├── ToolCallBlock # Tool status with diff preview
│   │   ├── StreamingMessage # Partial markdown rendering
│   │   ├── ThinkingBlock # Extended thinking UI (collapsible)
│   │   ├── StatusBar     # Model, tokens, cost, context %, permission mode, verbose, thinking
│   │   ├── UserInput     # Tab autocomplete, @mentions
│   │   ├── Logo          # DB brand logo + printStartupLogo()
│   │   └── ...           # ErrorBanner, PermissionPrompt, SlashCommandMenu, Spinner
│   ├── hooks/            # React hooks
│   │   ├── useAgentLoop  # Orchestrates agent loop ↔ React state + CheckpointManager
│   │   ├── useConversation # Immutable conversation state management
│   │   ├── useTextBuffering # 100ms batched text streaming
│   │   ├── useKeybindings # Keyboard shortcut registry + ~/.dbcode/keybindings.json
│   │   ├── useInput       # Input history with disk persistence (~/.dbcode/input-history.json)
│   │   └── ...           # usePermissionPrompt, useStreaming
│   └── renderer/         # Terminal rendering
│       ├── markdown.ts   # Markdown → terminal
│       ├── tool-display.ts # Tool output formatting, tense switching (Reading→Read)
│       └── synchronized-output.ts # DEC Mode 2026 atomic frame rendering
├── core/                 # Layer 2: Business logic (ZERO UI imports)
│   ├── agent-loop.ts     # ReAct loop with parallel tool execution + auto-checkpointing
│   ├── activity.ts       # ActivityCollector — turn/entry tracking + intermediate messages
│   ├── conversation.ts   # Immutable conversation state
│   ├── context-manager.ts # 3-layer compaction (micro → structured summary → rehydration)
│   ├── session-manager.ts
│   ├── checkpoint-manager.ts # File state checkpointing and rewind
│   ├── message-types.ts
│   ├── system-prompt-builder.ts # Dynamic conditional prompt assembly + system reminders
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
│   └── definitions/      # 14 built-in tools (see Tools section)
├── commands/             # Slash commands (/clear, /model, /help, /undo, /rewind, etc.)
│   ├── registry.ts       # Command registration and dispatch (+ skill bridge support)
│   └── *.ts              # 29 commands (including /memory, /keybindings)
├── instructions/         # DBCODE.md loader — hierarchical merge from multiple sources
│   ├── loader.ts         # loadInstructions() with 6-layer merge hierarchy
│   ├── parser.ts         # Instruction file parsing
│   └── path-matcher.ts   # Glob-based path-conditional rules
├── permissions/          # Permission system
│   ├── manager.ts        # Check + approve/deny
│   ├── rules.ts          # Glob pattern matching
│   ├── modes.ts          # default/acceptEdits/plan/dontAsk/bypassPermissions
│   └── session-store.ts  # Session approval cache
├── guardrails/           # Security (input/output filters, secret scanner)
├── sandbox/              # OS-level: macOS Seatbelt (sandbox-exec profiles)
├── hooks/                # Pre/post tool-use hooks (loader + runner)
├── subagents/            # Agent spawning with worktree isolation
│   ├── spawner.ts        # spawnSubagent(), spawnParallelSubagents(), agent history store
│   ├── explore.ts        # Explore agent config
│   ├── plan.ts           # Plan agent config
│   └── general.ts        # General-purpose agent config
├── auth/                 # Token-based auth (Bearer/API-Key/Custom)
├── config/               # 5-level hierarchical config (Zod schema)
│   ├── schema.ts         # Config schema (includes dbcodeMdExcludes)
│   └── defaults.ts       # Default config values
├── mcp/                  # Model Context Protocol integration
├── skills/               # Skill system — integrated into agent loop
│   ├── loader.ts         # loadSkill(), loadSkillsFromDirectory()
│   ├── types.ts          # SkillDefinition, skillFrontmatterSchema
│   ├── executor.ts       # Skill execution
│   ├── manager.ts        # SkillManager — loads from 4 dirs, builds prompt section
│   └── command-bridge.ts # createSkillCommands() — bridges skills into slash commands
├── telemetry/            # Usage telemetry
├── indexing/             # Codebase indexing
├── mentions/             # @mention resolution
├── types/                # Shared type definitions
└── utils/                # logger(pino), events(mitt), error, path, platform
```

## DBCODE.md Location

- **Primary**: `DBCODE.md` at project root (convention, same as CLAUDE.md)
- **Fallback**: `.dbcode/DBCODE.md` (backward compatible)
- `/init` creates `DBCODE.md` at project root + `.dbcode/` for settings and rules
- `DBCODE.md` is optional — dbcode works without it
- Use `getProjectConfigPaths(cwd)` from `src/constants.ts` to resolve paths consistently
- **Never hardcode DBCODE.md paths** — always use the centralized helper

### Instruction Loading Hierarchy (lowest → highest priority)

1. `~/.dbcode/DBCODE.md` — global user instructions
2. `~/.dbcode/rules/*.md` — global user rules
3. Parent directory `DBCODE.md` files (walking up from cwd)
4. Project root `DBCODE.md`
5. `.dbcode/rules/*.md` — project path-conditional rules
6. `DBCODE.local.md` — local overrides (gitignored)

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

## Tools (14 built-in)

| Tool          | Permission | Description                                               |
| ------------- | ---------- | --------------------------------------------------------- |
| file_read     | safe       | Read with line numbers, offset/limit, image/PDF support   |
| file_write    | confirm    | Create/overwrite (must read first if exists)              |
| file_edit     | confirm    | Search/Replace with uniqueness validation, diff preview   |
| bash_exec     | confirm    | Shell execution with timeout, background support          |
| glob_search   | safe       | File pattern matching, sorted by mtime                    |
| grep_search   | safe       | Regex content search (ripgrep wrapper)                    |
| list_dir      | safe       | Directory listing with metadata                           |
| web_fetch     | confirm    | HTTP fetch with 15-min cache, content extraction          |
| web_search    | confirm    | Brave Search + DuckDuckGo fallback                        |
| notebook_edit | confirm    | Jupyter notebook cell editing                             |
| mkdir         | confirm    | Create directories recursively                            |
| ask_user      | safe       | Ask user questions with choices                           |
| agent         | confirm    | Spawn subagent (explore/plan/general) via factory pattern |
| todo_write    | safe       | Task tracking with pending/in_progress/completed states   |

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
  → Extract Tool Calls → (none? → done) → Permission Check
  → Auto-Checkpoint (file_write/file_edit) → Execute
  → Append Results → Emit assistant-message event → Audit Log → Loop Back
```

- maxIterations: 50 (infinite loop protection)
- Tool timeout: bash 120s, file ops 30s
- Auto-compaction at 83.5% context usage (3-layer: micro → summary → rehydration)
- Parallel tool execution: read-only tools always parallel, file writes conflict on same path
- Intermediate assistant messages emitted as `agent:assistant-message` events

## Context Compaction (3-Layer)

- **Layer 1 — Microcompaction**: Bulky tool outputs saved to disk as cold storage; hot tail of 5 recent results kept inline
- **Layer 2 — Structured summarization**: Triggers at 83.5% context. Preserves: user intent, key decisions, files touched, errors, next steps
- **Layer 3 — Post-compaction rehydration**: Re-reads 5 most recently accessed files after compaction

## Skills System

- Skills loaded from 4 directories: `.dbcode/commands/`, `.dbcode/skills/`, `~/.dbcode/commands/`, `~/.dbcode/skills/`
- `SkillManager` builds system prompt section listing available skills
- User-invocable skills become `/name` slash commands via `command-bridge.ts`
- String substitutions: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `${DBCODE_SESSION_ID}`

### Verify Skills

| Skill                           | Description                                |
| ------------------------------- | ------------------------------------------ |
| `verify-tool-metadata-pipeline` | Tool metadata 전달 일관성 검증             |
| `verify-model-capabilities`     | ModelCapabilities 및 기본 모델 동기화 검증 |

## Keyboard Shortcuts

| Shortcut  | Action                    |
| --------- | ------------------------- |
| Esc       | Cancel current agent loop |
| Shift+Tab | Cycle permission modes    |
| Ctrl+O    | Toggle verbose mode       |
| Ctrl+D    | Exit application          |
| Alt+T     | Toggle extended thinking  |

Customizable via `~/.dbcode/keybindings.json`.

## Input History

- Persisted to `~/.dbcode/input-history.json` (survives restarts)
- Up/Down arrow keys navigate history across sessions
- Max 500 entries, deduplication on insert (most recent wins)
- Auto-saves on every new input

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

## Gap Analysis & Roadmap

See `docs/dbcode-vs-claude-code-v2.md` for comprehensive comparison with Claude Code (7.5/10 overall).
Key gaps: persistent permissions, auto-memory, Windows sandbox (WSL2/Git Bash), MCP integration depth.

## Compact Instructions

When compacting, always preserve:

- Current phase and deliverable progress (X/N complete)
- Recent test failures and their root causes
- Architecture decisions made during this session
- Files created/modified in this session
- Any blockers or workarounds discovered
