# Directory Structure

> 참조 시점: 파일 위치를 파악하거나 새 모듈을 배치할 때

## 전체 구조

```
src/
├── index.ts              # CLI bootstrap (commander), logo stdout, Ink render
├── constants.ts          # Version, paths, limits, getProjectConfigPaths(), INPUT_HISTORY_FILE
├── cli/                  # Layer 1: Terminal UI
│   ├── App.tsx           # Root Ink component (keyboard shortcuts, permission cycling)
│   ├── ErrorBoundary.tsx # React error boundary for crash recovery
│   ├── headless.ts       # Headless mode (--print flag, no UI)
│   ├── setup-wizard.ts   # First-run interactive setup
│   ├── analytics.ts      # /analytics — session analytics dashboard
│   ├── components/       # 22 UI components (.tsx)
│   │   ├── ActivityFeed  # Progressive Static flushing (anti-flicker)
│   │   ├── TurnBlock     # Single turn: user msg + assistant + tool calls
│   │   ├── ToolCallBlock # Tool status with diff preview
│   │   ├── StreamingMessage # Partial markdown rendering
│   │   ├── ThinkingBlock # Extended thinking UI (collapsible)
│   │   ├── StatusBar     # Model, tokens, cost, context %, permission mode
│   │   ├── UserInput     # Tab autocomplete, @mentions, multiline
│   │   ├── TeammateStatus # Subagent status indicator
│   │   ├── TaskListView / TaskViewPanel # Task management UI
│   │   ├── Logo          # DB brand logo + printStartupLogo()
│   │   └── ...           # ErrorBanner, PermissionPrompt, SlashCommandMenu, RetryCountdown, VoiceIndicator
│   ├── hooks/            # 7 React hooks
│   │   ├── useAgentLoop  # Orchestrates agent loop ↔ React state + CheckpointManager
│   │   ├── useConversation # Immutable conversation state management
│   │   ├── useTextBuffering # 100ms batched text streaming
│   │   ├── useKeybindings # Keyboard shortcut registry + ~/.dbcode/keybindings.json
│   │   ├── useInput      # Input history with disk persistence
│   │   ├── useVoice      # Voice recording + transcription
│   │   └── ...           # usePermissionPrompt, useStreaming
│   └── renderer/         # Terminal rendering
│       ├── markdown.ts   # Markdown → terminal (marked + marked-terminal)
│       ├── syntax.ts     # Syntax highlighting (Shiki)
│       ├── theme.ts      # Terminal color themes
│       ├── tool-display.ts # Tool output formatting, tense switching
│       └── synchronized-output.ts # DEC Mode 2026 atomic frame rendering
├── core/                 # Layer 2: Business logic (ZERO UI imports)
│   ├── agent-loop.ts     # ReAct loop + recovery, circuit-breaker, observation-masking, tool grouping
│   ├── activity.ts       # ActivityCollector — turn/entry tracking + intermediate messages
│   ├── conversation.ts   # Immutable conversation state
│   ├── context-manager.ts # 3-layer compaction + cold storage + adaptive GC
│   ├── session-manager.ts # Session save/restore
│   ├── session-auto-save.ts # Periodic session metadata updates
│   ├── checkpoint-manager.ts # File state checkpointing and rewind
│   ├── task-manager.ts   # Task/todo management
│   ├── message-types.ts  # Message structure definitions
│   ├── system-prompt-builder.ts # Dynamic conditional prompt assembly
│   ├── system-prompt-cache.ts # SHA-256 mtime-based prompt caching
│   ├── recovery-executor.ts # Executes recovery strategies (compact/retry/fallback)
│   ├── recovery-strategy.ts # Error classification → recovery mapping
│   ├── circuit-breaker.ts # Ralph Loop pattern — semantic progress tracking
│   ├── observation-masking.ts # Masks re-readable tool outputs
│   ├── adaptive-context.ts # Task complexity estimation + context strategy
│   ├── auto-memory.ts    # Automatic learning/memory updates
│   ├── code-review-agent.ts # Generator-Critic pattern code review
│   ├── tone-profiles.ts  # Conversation tone settings
│   └── update-checker.ts # Weekly npm version check
├── llm/                  # Layer 3: LLM client
│   ├── provider.ts       # LLMProvider interface + ThinkingConfig
│   ├── client.ts         # OpenAI SDK wrapper (baseURL configurable)
│   ├── responses-client.ts # Responses API client (o1, o3 models)
│   ├── streaming.ts      # SSE stream consumer + backpressure
│   ├── token-counter.ts  # js-tiktoken + LRU cache (500 entries)
│   ├── cost-tracker.ts   # API cost calculation
│   ├── structured-output.ts # Provider-specific structured output
│   ├── model-router.ts   # Hybrid mode routing
│   ├── dual-model-router.ts # Architect/Editor pattern (plan vs execute)
│   ├── model-capabilities.ts # Per-model context limits + capability tiers
│   ├── thinking-budget.ts # Extended thinking token allocation
│   ├── tool-call-strategy.ts
│   ├── strategies/       # native-function-calling.ts, text-parsing.ts, two-stage-tool-call.ts
│   └── providers/        # anthropic.ts (Extended Thinking + prompt cache)
├── tools/                # Tool system
│   ├── registry.ts       # Tool registration, hot tools, lazy loading
│   ├── types.ts          # ToolDefinition, ToolResult, PermissionLevel
│   ├── executor.ts       # Timeout, AbortController, BackgroundProcessManager
│   ├── validation.ts     # Zod → JSON Schema conversion
│   ├── adaptive-schema.ts # Adapts tool schema per capability tier (HIGH/MEDIUM/LOW)
│   ├── lazy-tool-loader.ts # On-demand schema loading
│   ├── tool-retry.ts     # Levenshtein path correction, JSON repair
│   ├── tool-call-corrector.ts # Pre-validation auto-fix (relative paths, type coercion)
│   └── definitions/      # 16 built-in tools:
│       ├── file-read, file-write, file-edit
│       ├── bash-exec, bash-output, kill-shell
│       ├── glob-search, grep-search, list-dir
│       ├── web-fetch, web-search
│       ├── notebook-edit, mkdir, ask-user
│       ├── agent, todo-write
├── commands/             # 41 slash commands
│   ├── registry.ts       # CommandRegistry + SlashCommand interface + CommandContext
│   └── *.ts              # agents, analytics, batch, bug, clear, commit, compact, config,
│                         # context, copy, cost, debug, diff, doctor, dual-model, effort,
│                         # export, fast, fork, help, init, keybindings, mcp, memory, model,
│                         # output-style, permissions, plan, rename, resume, review, rewind,
│                         # simplify, stats, status, team, tone, undo, update, voice
├── mcp/                  # Model Context Protocol integration
│   ├── client.ts         # JSON-RPC 2.0 MCP client
│   ├── manager.ts        # Server lifecycle management
│   ├── manager-connector.ts # Initializes sub-modules (resources, prompts, tools, OAuth)
│   ├── scope-manager.ts  # 3-scope config: local > project > user
│   ├── tool-bridge.ts    # MCP tools → dbcode tool registry bridge
│   ├── tool-filter.ts    # Include/exclude MCP tools
│   ├── tool-search.ts    # Search and filter MCP tools
│   ├── output-limiter.ts # Token limiting for tool outputs
│   ├── oauth.ts          # OAuth authentication
│   ├── managed-config.ts # MCP server configuration
│   ├── prompts.ts        # MCP prompt integration
│   ├── resources.ts      # MCP resource handling
│   ├── serve.ts          # Expose dbcode as MCP server (stub)
│   └── types.ts          # MCPServerConfig, MCPTransport, JSON-RPC types
├── subagents/            # Subagent spawning and team coordination
│   ├── spawner.ts        # spawnSubagent(), spawnParallelSubagents(), worktree isolation
│   ├── agent-types.ts    # Built-in: explore, plan, general
│   ├── definition-types.ts # AgentDefinition structure
│   ├── definition-loader.ts # Load .dbcode/agents/*.md
│   ├── team-manager.ts   # Multi-agent team coordination
│   ├── task-list.ts      # Shared task list between agents
│   ├── shared-state.ts   # Shared variables between agents
│   ├── agent-hooks.ts    # Agent-level hooks
│   ├── agent-skills-loader.ts # Load skills for agents
│   └── agent-memory.ts   # Per-agent memory persistence
├── permissions/          # Permission system
│   ├── manager.ts        # Hierarchical decision: deny → session → allow → rules → mode
│   ├── rules.ts          # Glob pattern matching
│   ├── modes.ts          # default/acceptEdits/plan/dontAsk/bypassPermissions
│   ├── session-store.ts  # Session approval cache
│   ├── persistent-store.ts # ~/.dbcode/settings.json rules
│   ├── pattern-parser.ts # Tool(pattern) matching
│   ├── wildcard.ts       # Glob pattern matching
│   └── audit-log.ts      # JSONL permission audit logging
├── guardrails/           # Security (input/output filters)
│   ├── secret-scanner.ts # Regex-based secret detection
│   ├── entropy-scanner.ts # Shannon entropy secret detection
│   ├── command-filter.ts # Dangerous shell command blocking
│   ├── path-filter.ts    # Path traversal + sensitive path blocking
│   ├── injection-detector.ts # Prompt injection detection
│   └── output-limiter.ts # Token/character limits
├── instructions/         # DBCODE.md loader — hierarchical merge
│   ├── loader.ts         # loadInstructions() with 6-layer merge
│   ├── parser.ts         # Instruction file parsing
│   └── path-matcher.ts   # Glob-based path-conditional rules
├── skills/               # Skill system — 4 load directories
│   ├── manager.ts        # SkillManager — loads skills, builds prompt section
│   ├── loader.ts         # loadSkill(), loadSkillsFromDirectory()
│   ├── executor.ts       # Skill execution with template substitution
│   ├── command-bridge.ts # Bridges skills into slash commands
│   └── types.ts          # SkillDefinition, skillFrontmatterSchema
├── memory/               # Project-scoped memory persistence
│   ├── manager.ts        # CRUD operations
│   ├── loader.ts         # Load memory at session start
│   ├── writer.ts         # Append/save memory
│   ├── paths.ts          # Compute project hash, memory paths
│   └── types.ts          # MemoryEntry, MemoryConfig
├── config/               # 5-level hierarchical config (Zod schema)
│   ├── loader.ts         # Load and merge all config layers
│   ├── schema.ts         # Config schema (Zod)
│   ├── defaults.ts       # Default config values
│   └── types.ts          # AppConfig, ConfigSource, ResolvedConfig
├── hooks/                # Pre/post tool-use hooks
│   ├── loader.ts         # Hook file loading
│   ├── runner.ts         # Hook execution (SessionStart, UserPromptSubmit, Stop)
│   ├── auto-lint.ts      # Post-write linting hooks
│   ├── team-events.ts    # Team coordination events
│   └── types.ts          # Hook definitions
├── sandbox/              # OS-level sandboxing
│   ├── seatbelt.ts       # macOS sandbox-exec profiles
│   ├── bubblewrap.ts     # Linux Bubblewrap sandboxing
│   ├── network-policy.ts # Network access policies
│   └── sandboxed-network.ts # Network isolation
├── auth/                 # Token-based auth (Bearer/API-Key/Custom)
├── indexing/             # Codebase indexing (repo-map.ts)
├── mentions/             # @mention resolution (parser, resolver, resource-resolver)
├── telemetry/            # Usage telemetry (metrics, events, otel-exporter)
├── voice/                # Voice input (recorder, transcriber)
├── types/                # Shared type definitions
└── utils/                # logger(pino + redaction), events(mitt), error, path, platform, notifications
```

## 주의사항

- `src/index.ts`는 `commander` `.action()` 내에서 dynamic import 사용 (빠른 --help/--version)
- `cli/` 내부에서만 React/Ink 사용, `core/` 이하에서 UI import 금지
- 새 도구는 `src/tools/definitions/`에, 새 슬래시 커맨드는 `src/commands/`에 배치
- 새 MCP 모듈은 `src/mcp/`에 배치, scope-manager.ts의 3-scope 구조 준수
