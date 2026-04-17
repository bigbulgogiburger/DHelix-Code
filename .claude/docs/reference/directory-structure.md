# Directory Structure

> 참조 시점: 파일 위치를 파악하거나 새 모듈을 배치할 때

## 전체 구조

```
src/
├── index.ts              # CLI bootstrap (commander), logo stdout, Ink render
├── constants.ts          # Version, paths, limits, getProjectConfigPaths(), LLM_DEFAULTS
├── bootstrap/            # Layer 5: Composition Root — Ink/headless 공통 AppContext 조립
│   ├── app-factory.ts    # createAppContext() — 설정/도구/명령/MCP/스킬 초기화 조율
│   ├── tool-registry-factory.ts    # 빌트인 29개 도구 + 훅 기반 등록
│   ├── command-registry-factory.ts # builtinCommands 배럴 + 스킬 변환 명령 등록
│   └── types.ts          # AppContext, CLIOptions, ResolvedConfig
├── cli/                  # Layer 1: Terminal UI
│   ├── accessibility/    # WCAG — contrast, keyboard-nav, screen-reader
│   ├── layout/           # ShellLayout + TranscriptFrame + FooterBar
│   ├── components/       # 22 UI components + panels/
│   │   ├── ActivityFeed  # Progressive Static flushing (anti-flicker)
│   │   ├── TurnBlock     # Single turn: user msg + assistant + tool calls
│   │   ├── ToolCallBlock # Tool status with diff preview
│   │   ├── StreamingMessage # Partial markdown rendering
│   │   ├── ThinkingBlock # Extended thinking UI (collapsible)
│   │   ├── StatusBar     # Model, tokens, cost, context %, permission mode
│   │   ├── UserInput     # Tab autocomplete, @mentions, multiline
│   │   ├── TeammateStatus # Subagent status indicator
│   │   ├── TaskListView / TaskViewPanel # Task management UI
│   │   ├── ReadGroupBlock # Grouped read-only tool displays
│   │   ├── AgentStatus / AgentTabs # Multi-agent status + tabs
│   │   ├── Logo          # DB brand logo + printStartupLogo()
│   │   ├── VoiceIndicator # Voice recording state
│   │   ├── panels/       # ApprovalPanel, JobPanel, TaskPanel
│   │   └── ...           # ErrorBanner, ErrorBoundary, PermissionPrompt, SelectList,
│   │                     #    SlashCommandMenu, RetryCountdown, MessageList
│   ├── hooks/            # 8 React hooks
│   │   ├── useAgentLoop      # Orchestrates agent loop ↔ React state + CheckpointManager
│   │   ├── useConversation   # Immutable conversation state management
│   │   ├── useTextBuffering  # 100ms batched text streaming
│   │   ├── useKeybindings    # Keyboard shortcut registry + ~/.dhelix/keybindings.json
│   │   ├── useInput          # Input history with disk persistence
│   │   ├── useVoice          # Voice recording + transcription
│   │   ├── usePermissionPrompt
│   │   └── useStreaming
│   └── renderer/         # Terminal rendering
│       ├── markdown.ts       # Markdown → terminal (marked + marked-terminal)
│       ├── syntax.ts         # Syntax highlighting (Shiki)
│       ├── theme.ts          # Terminal color themes (SSOT)
│       ├── tool-display.ts   # Tool output formatting, tense switching
│       └── synchronized-output.ts # DEC Mode 2026 atomic frame rendering
├── core/                 # Layer 2: Business logic (ZERO UI imports)
│   ├── runtime/          # RuntimePipeline — 9 stages + metrics
│   │   ├── pipeline.ts           # 파이프라인 오케스트레이터
│   │   ├── context-factory.ts    # 스테이지 컨텍스트 생성
│   │   ├── async-compaction.ts   # 백그라운드 압축
│   │   ├── metrics.ts            # MetricsCollector
│   │   └── stages/               # 9 stages:
│   │       ├── prepare-context / preflight-policy / resolve-tools
│   │       ├── sample-llm / extract-calls / execute-tools
│   │       ├── persist-results / evaluate-continuation / compact-context
│   ├── session/          # Persistence
│   │   ├── sqlite-store.ts       # SQLite session storage
│   │   ├── streaming-writer.ts   # Incremental write buffer
│   │   └── migration.ts          # Schema migrations
│   ├── agent-loop.ts         # ReAct loop + recovery, circuit-breaker, tool grouping
│   ├── agent-loop-config.ts  # Loop limits, timeouts
│   ├── activity.ts           # ActivityCollector — turn/entry tracking
│   ├── conversation.ts       # Immutable conversation state
│   ├── context-manager.ts    # 3-layer compaction + cold storage + adaptive GC
│   ├── adaptive-context.ts   # Task complexity → context strategy
│   ├── session-manager.ts    # Session save/restore
│   ├── session-auto-save.ts  # Periodic metadata updates
│   ├── session-fork.ts       # /fork — branch current transcript
│   ├── checkpoint-manager.ts # File state checkpointing for /undo /rewind
│   ├── task-manager.ts       # Task/todo management
│   ├── message-types.ts      # Message structure definitions
│   ├── tool-call-utils.ts    # Tool call parsing helpers
│   ├── system-prompt-builder.ts # Dynamic conditional prompt assembly
│   ├── system-prompt-cache.ts   # SHA-256 + mtime prompt caching
│   ├── recovery-executor.ts  # Executes recovery (compact/retry/fallback)
│   ├── recovery-strategy.ts  # Error classification → recovery mapping
│   ├── error-classification.ts  # Error pattern → category
│   ├── circuit-breaker.ts    # Ralph Loop semantic progress tracking
│   ├── observation-masking.ts   # Re-readable tool output masking
│   ├── auto-memory.ts        # Automatic memory updates
│   ├── memory-storage.ts     # Memory file I/O
│   ├── code-review-agent.ts  # Generator-Critic code review
│   ├── tone-profiles.ts      # Conversation tone settings
│   ├── update-checker.ts     # Weekly npm version check
│   └── usage-aggregator.ts   # Token/cost aggregation
├── llm/                  # Layer 3: LLM client
│   ├── provider.ts           # LLMProvider interface + ThinkingConfig
│   ├── client.ts             # OpenAI SDK wrapper (baseURL configurable)
│   ├── client-factory.ts     # Provider-aware client construction
│   ├── responses-client.ts   # Responses API client (o1, o3, gpt-5-codex)
│   ├── streaming.ts          # SSE stream consumer + backpressure
│   ├── token-counter.ts      # js-tiktoken + LRU cache
│   ├── cost-tracker.ts       # API cost calculation
│   ├── chat-template.ts      # Local model template detection
│   ├── model-router.ts       # Hybrid mode routing + fallback
│   ├── dual-model-router.ts  # Architect/Editor pattern
│   ├── model-capabilities.ts # Per-model capability tiers
│   ├── task-classifier.ts    # plan/execute/review classification
│   ├── thinking-budget.ts    # Extended thinking allocation
│   ├── tool-call-strategy.ts # Strategy selector
│   ├── strategies/           # native-function-calling / text-parsing / two-stage-tool-call
│   └── providers/            # 8 providers:
│       ├── anthropic / aws-bedrock / azure-openai
│       ├── google-gemini / groq / mistral / local
│       └── registry.ts       # Pattern-based resolve()
├── tools/                # Tool system
│   ├── registry.ts           # Tool registration, hot tools, lazy loading
│   ├── types.ts              # ToolDefinition, ToolResult, PermissionLevel
│   ├── executor.ts           # Timeout, AbortController, background processes
│   ├── validation.ts         # Zod → JSON Schema conversion
│   ├── adaptive-schema.ts    # Tier-aware schema (HIGH/MEDIUM/LOW)
│   ├── lazy-tool-loader.ts   # On-demand schema loading
│   ├── tool-retry.ts         # Levenshtein path correction, JSON repair
│   ├── tool-call-corrector.ts # Pre-validation auto-fix
│   ├── retry-engine.ts       # Backoff policies
│   ├── import-hint.ts        # Suggest missing imports
│   ├── errors.ts             # Tool-specific error classes
│   ├── streaming.ts          # Tool streaming output
│   ├── pipeline/             # 4-stage tool pipeline
│   ├── pipeline.ts           # Pipeline orchestrator
│   └── definitions/          # 29 built-in tools:
│       ├── file-read / file-write / file-edit / list-dir / mkdir
│       ├── bash-exec / bash-output / kill-shell
│       ├── glob-search / grep-search
│       ├── symbol-search / code-outline / find-dependencies   # Tier 1 (tree-sitter)
│       ├── goto-definition / find-references / get-type-info / safe-rename  # Tier 2 (LSP)
│       ├── apply-patch / batch-file-ops / refactor
│       ├── web-fetch / web-search
│       ├── notebook-edit / ask-user / agent / todo-write
│       └── code-mode (+ code-mode-utils, refactor-utils)
├── commands/             # 43 slash commands (40 registered + 3 unregistered)
│   ├── registry.ts       # CommandRegistry + SlashCommand + CommandContext
│   ├── builtin-commands.ts # 배럴 — 40 registered commands
│   ├── init/             # /init sub-steps
│   └── *.ts              # agents*, analytics, batch, bug, clear, commit, compact,
│                         # config, context, copy, cost, dashboard, debug, diff,
│                         # doctor, dual-model (architect+editor+dual), effort,
│                         # export, extensions, fast, fork, help, init, keybindings,
│                         # mcp, memory, model, output-style, permissions*, plan,
│                         # rename, resume, review, rewind, simplify, stats, status,
│                         # team*, tone, undo, update, voice
│                         # (* = 파일 존재하나 builtinCommands 배럴 미등록)
├── mcp/                  # Model Context Protocol
│   ├── client.ts             # JSON-RPC 2.0 MCP client
│   ├── manager.ts            # Server lifecycle
│   ├── manager-connector.ts  # Sub-modules 초기화
│   ├── scope-manager.ts      # 3-scope: local > project > user
│   ├── tool-bridge.ts        # MCP tools → ToolRegistry
│   ├── tool-filter.ts / tool-search.ts
│   ├── output-limiter.ts     # Token limits
│   ├── oauth.ts / oauth-pkce.ts    # OAuth + PKCE challenge
│   ├── agent-to-agent.ts     # A2A protocol
│   ├── health-monitor.ts     # Health checks
│   ├── managed-config.ts
│   ├── prompts.ts / resources.ts / resource-manager.ts
│   ├── registry-client.ts    # Remote MCP registry
│   ├── serve.ts              # Expose dhelix as MCP server (stub)
│   ├── streaming.ts          # SSE/stream transport helpers
│   ├── transports/           # stdio / http / sse
│   └── types.ts              # MCPServerConfig, JSON-RPC types
├── subagents/            # Subagent + team coordination
│   ├── spawner.ts / agent-types.ts
│   ├── definition-types.ts / definition-loader.ts
│   ├── team-manager.ts / task-list.ts / shared-state.ts
│   ├── agent-hooks.ts / agent-skills-loader.ts / agent-memory.ts
├── permissions/          # Permission + trust system
│   ├── manager.ts            # Hierarchical decision engine
│   ├── rules.ts              # Glob pattern matching
│   ├── modes.ts              # default/acceptEdits/plan/dontAsk/bypassPermissions
│   ├── session-store.ts / persistent-store.ts
│   ├── approval-db.ts        # SQLite persistent approval (TTL)
│   ├── pattern-parser.ts / wildcard.ts
│   ├── trust-tiers.ts        # T0-T3 trust tiers
│   └── audit-log.ts          # JSONL audit logging
├── guardrails/           # Security input/output filters
│   ├── secret-scanner.ts / entropy-scanner.ts
│   ├── command-filter.ts / path-filter.ts
│   ├── injection-detector.ts / output-masker.ts / output-limiter.ts
│   └── types.ts / index.ts
├── instructions/         # DHELIX.md hierarchical merge
│   ├── loader.ts / parser.ts / path-matcher.ts
├── skills/               # Skill system
│   ├── manager.ts / loader.ts / executor.ts
│   ├── composer.ts / dependency-resolver.ts
│   ├── command-bridge.ts     # Skill → slash command
│   ├── manifest.ts / types.ts
├── memory/               # Project-scoped memory
│   ├── manager.ts / loader.ts / writer.ts / paths.ts / types.ts / index.ts
├── config/               # 5-level hierarchical config (Zod)
│   ├── loader.ts / schema.ts / defaults.ts / types.ts
├── hooks/                # Pre/post tool-use hooks
│   ├── loader.ts / runner.ts / events.ts
│   ├── auto-lint.ts / team-events.ts
│   ├── event-emitter-adapter.ts / types.ts
├── sandbox/              # OS-level sandboxing
│   ├── seatbelt.ts (macOS) / bubblewrap.ts (Linux) / container.ts (Docker)
│   ├── env-sanitizer.ts / process-sandbox.ts / linux.ts
│   ├── network-policy.ts / network-policy-schema.ts / network-proxy.ts
│   └── sandboxed-network.ts
├── auth/                 # Token-based auth
│   ├── token-store.ts / types.ts
├── dashboard/            # REST + WebSocket dashboard
│   ├── server.ts / websocket.ts / types.ts / index.ts
├── cloud/                # Cloud execution
│   ├── job-queue.ts / agent-runner.ts / result-sync.ts / types.ts / index.ts
├── indexing/             # Codebase indexing
│   ├── repo-map.ts / incremental-indexer.ts
│   ├── semantic-search.ts / tree-sitter-engine.ts
│   └── queries/              # Per-language tree-sitter queries (10 langs)
├── lsp/                  # LSP + IDE integration
│   ├── manager.ts / server-connection.ts / language-detector.ts
│   ├── ide-bridge.ts / ide-bridge-manager.ts / ide-bridge-protocol.ts
│   ├── ide-integration.ts / types.ts / index.ts
├── mentions/             # @mention resolution
├── telemetry/            # OTLP + metrics
│   ├── config.ts / events.ts / metrics.ts
│   ├── otel-exporter.ts / agent-telemetry-bridge.ts
├── plugins/              # Plugin platform
│   ├── loader.ts / registry.ts / types.ts / index.ts
├── voice/                # Voice input
│   ├── recorder.ts / transcriber.ts / index.ts
├── types/                # Shared type definitions
└── utils/                # logger (pino redaction), events (mitt), error, path,
                          # platform, notifications, metrics, otlp-exporter, stack
```

## 주의사항

- `src/index.ts`는 `commander` `.action()` 내에서 dynamic import 사용 (빠른 --help/--version)
- `cli/` 내부에서만 React/Ink 사용 — `core/` 이하에서 UI import 금지
- 새 도구는 `src/tools/definitions/`에, 새 슬래시 커맨드는 `src/commands/`에 배치
- 새 MCP 모듈은 `src/mcp/`에 배치, `scope-manager.ts`의 3-scope 구조 준수
- 신규 모듈은 반드시 `src/bootstrap/app-factory.ts`의 조립 순서에 따라 초기화 지점 연결
- `src/core/runtime/stages/`에 새 스테이지 추가 시 `pipeline.ts`의 순서 준수
