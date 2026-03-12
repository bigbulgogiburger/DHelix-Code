# Directory Structure

> 참조 시점: 파일 위치를 파악하거나 새 모듈을 배치할 때

## 전체 구조

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
│   └── definitions/      # 14 built-in tools (see interfaces-and-tools.md)
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

## 주의사항

- `src/index.ts`는 `commander` `.action()` 내에서 dynamic import 사용 (빠른 --help/--version)
- `cli/` 내부에서만 React/Ink 사용, `core/` 이하에서 UI import 금지
- 새 도구는 `src/tools/definitions/`에, 새 슬래시 커맨드는 `src/commands/`에 배치
