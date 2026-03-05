# Claude Code Feature Parity Checklist for dbcode

> Comprehensive analysis of Claude Code (Anthropic's agentic CLI coding tool) features.
> Priority: P0 = must-have for MVP, P1 = important for v1.0, P2 = nice-to-have / future

---

## 1. Core Architecture & Agent Loop

### 1.1 Agentic Loop Engine

- **What**: Claude Code runs an agentic loop where the LLM decides which tools to call, executes them, observes results, and iterates until the task is complete. Each "turn" is one LLM call + tool execution cycle.
- **Why**: This is the fundamental execution model -- without it, nothing works.
- **Priority**: P0
- **Complexity**: High -- requires streaming, tool dispatch, error recovery, and multi-turn state management.

### 1.2 Context Window Management

- **What**: Auto-compaction when approaching context limits (~95% capacity by default, configurable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`). Conversation history is automatically compressed while preserving key information. `/compact` command for manual compaction with optional focus instructions.
- **Why**: Long coding sessions easily exceed context limits; without auto-compaction the tool becomes unusable for complex tasks.
- **Priority**: P0
- **Complexity**: Medium -- requires token counting, summarization strategy, and preservation of critical context.

### 1.3 Session Management

- **What**: Sessions are persisted to disk with unique IDs. Resume with `--continue` (most recent) or `--resume <id|name>`. Fork sessions with `--fork-session`. Sessions auto-cleaned after configurable period (default 30 days). Session naming/renaming via `/rename`.
- **Why**: Users frequently need to continue work across terminal sessions, computer restarts, etc.
- **Priority**: P0
- **Complexity**: Medium -- JSONL transcript storage, session indexing, fork/branch semantics.

### 1.4 Streaming Output

- **What**: Real-time token streaming during LLM responses. Markdown rendering with syntax highlighting in terminal. Support for `stream-json` output format for programmatic consumption.
- **Why**: Without streaming, users stare at a blank screen for 10-30 seconds per response. Critical for UX.
- **Priority**: P0
- **Complexity**: Medium -- SSE/streaming protocol handling, incremental markdown rendering in terminal.

### 1.5 Model Selection & Configuration

- **What**: Switch models mid-session with `/model` or `Alt+P`. Supports aliases (`sonnet`, `opus`, `haiku`) and full model IDs. Configurable default model in settings. Effort level adjustment (high/medium/low) per model. Fallback model support (`--fallback-model`). Fast mode toggle (`/fast`) for faster output at higher cost.
- **Why**: Different tasks need different cost/capability tradeoffs. Fast mode for simple tasks, Opus for complex reasoning.
- **Priority**: P1
- **Complexity**: Low-Medium -- model registry, API endpoint routing.

### 1.6 Extended Thinking (Ultrathink)

- **What**: Toggle extended thinking mode (`Alt+T` or `/` menu) that lets the model spend more time reasoning through complex problems. Can be enabled in skills with the word "ultrathink".
- **Why**: Complex architectural decisions and debugging benefit from deeper reasoning.
- **Priority**: P1
- **Complexity**: Low -- API parameter toggle.

---

## 2. Built-in Tools

### 2.1 File System Tools

#### Read

- **What**: Read files with line numbers. Supports offset/limit for large files. Can read images (PNG, JPG), PDFs (with page ranges), and Jupyter notebooks (.ipynb). Max 2000 lines by default, lines >2000 chars truncated.
- **Priority**: P0
- **Complexity**: Low

#### Write

- **What**: Create new files or completely overwrite existing files. Requires reading file first if it exists (safety check).
- **Priority**: P0
- **Complexity**: Low

#### Edit

- **What**: Exact string replacement in files. Requires unique `old_string` match. Supports `replace_all` for global replacements. Preserves indentation. Fails if old_string is not unique (forces more context).
- **Priority**: P0
- **Complexity**: Low-Medium -- uniqueness validation, indentation preservation.

#### NotebookEdit

- **What**: Edit Jupyter notebook cells. Supports replace, insert, and delete operations. 0-indexed cell numbers, cell type specification (code/markdown).
- **Priority**: P2
- **Complexity**: Low

### 2.2 Search Tools

#### Glob

- **What**: Fast file pattern matching (e.g., `**/*.ts`). Returns paths sorted by modification time. Used for file discovery by name patterns.
- **Priority**: P0
- **Complexity**: Low

#### Grep

- **What**: Content search built on ripgrep. Full regex, glob filtering, type filtering. Output modes: content, files_with_matches, count. Context lines (-A/-B/-C), head_limit, offset. Multiline matching support.
- **Priority**: P0
- **Complexity**: Low -- wrapper around ripgrep or similar.

### 2.3 Execution Tools

#### Bash

- **What**: Execute shell commands. Supports background execution (`run_in_background`), timeouts (up to 600s), working directory persistence between calls. The core tool for running builds, tests, git, etc.
- **Priority**: P0
- **Complexity**: Medium -- process management, timeout handling, output capture, background task tracking.

### 2.4 Web Tools

#### WebFetch

- **What**: Fetch URL content, convert HTML to markdown, process with AI model. 15-minute cache. Handles redirects. Cannot access authenticated URLs (uses WebSearch or MCP instead).
- **Priority**: P1
- **Complexity**: Medium -- HTTP client, HTML-to-markdown conversion, caching.

#### WebSearch

- **What**: Web search with results formatted as search result blocks with markdown hyperlinks. Domain filtering (allowed/blocked). Returns links and summaries.
- **Priority**: P1
- **Complexity**: Medium -- search API integration.

### 2.5 Agent Tools

#### Agent / SubAgent

- **What**: Spawn specialized subagents for task delegation. Each runs in own context window with custom system prompt, tool restrictions, and independent permissions. Built-in agents: Explore (Haiku, read-only), Plan (read-only for planning), general-purpose (all tools). Custom agents via `.claude/agents/` or `--agents` flag.
- **Priority**: P1
- **Complexity**: High -- nested agent orchestration, context isolation, result aggregation.

### 2.6 Interaction Tools

#### AskUserQuestion

- **What**: Ask the user a clarifying question during execution. Used when the agent needs more information to proceed.
- **Priority**: P0
- **Complexity**: Low

#### TaskCreate / TaskUpdate / TaskList / TaskGet

- **What**: Task tracking system for multi-step work. Tasks have subject, description, status (pending/in_progress/completed), dependencies (blocks/blockedBy), owner assignment. Displayed in terminal status area via Ctrl+T. Persistent across context compactions.
- **Priority**: P1
- **Complexity**: Medium -- task state management, dependency resolution, UI rendering.

### 2.7 Other Tools

#### EnterWorktree

- **What**: Create isolated git worktree for parallel work. Auto-cleanup on session exit.
- **Priority**: P2
- **Complexity**: Low -- git worktree commands.

#### Skill (Tool)

- **What**: Invoke user-defined or bundled skills programmatically. Claude can call skills based on task context.
- **Priority**: P1
- **Complexity**: Low

#### ToolSearch (Deferred Tool Loading)

- **What**: Dynamically discover and load MCP tools on demand. Keyword search or direct selection. Prevents context bloat from loading all MCP tools upfront. Auto-activates when MCP tools exceed 10% of context.
- **Priority**: P1
- **Complexity**: Medium -- lazy loading architecture, tool registry.

---

## 3. Permission System

### 3.1 Permission Modes

- **What**: Five modes controlling tool approval:
  - `default`: Standard prompting for each tool use
  - `acceptEdits`: Auto-accept file edits
  - `plan`: Read-only mode (analyze but no modifications)
  - `dontAsk`: Auto-deny unless pre-approved via rules
  - `bypassPermissions`: Skip all prompts (dangerous, containerized use)
- **Priority**: P0
- **Complexity**: Medium

### 3.2 Permission Rules

- **What**: Fine-grained allow/ask/deny rules per tool. Syntax: `Tool` or `Tool(specifier)`. Supports glob patterns for Bash (`Bash(npm run *)`), gitignore-style patterns for Read/Edit (`Edit(/src/**/*.ts)`), domain patterns for WebFetch (`WebFetch(domain:example.com)`), MCP tool patterns (`mcp__server__tool`), Agent patterns (`Agent(Explore)`). Evaluation order: deny -> ask -> allow (first match wins).
- **Priority**: P0
- **Complexity**: Medium -- pattern matching engine, rule evaluation.

### 3.3 Tiered Tool Permissions

- **What**: Read-only tools (no approval needed), bash commands (approval required, remembers per project+command), file modifications (approval per session).
- **Priority**: P0
- **Complexity**: Low

### 3.4 Managed Permissions (Enterprise)

- **What**: Organization-level settings that cannot be overridden. Settings like `disableBypassPermissionsMode`, `allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`. Deployed via MDM/OS-level policies.
- **Priority**: P2
- **Complexity**: Medium -- system-level config file reading, policy enforcement.

---

## 4. Hook System

### 4.1 Hook Events

- **What**: User-defined shell commands, HTTP endpoints, or LLM prompts that execute at lifecycle points:
  - `PreToolUse`: Before tool execution (validate, modify, approve/deny)
  - `PostToolUse`: After tool execution (auto-format, lint, type-check)
  - `Stop`: When session ends (final verification)
  - `Notification`: When notifications are sent
  - `SubagentStart` / `SubagentStop`: Subagent lifecycle
  - `TeammateIdle`: When a teammate goes idle (agent teams)
  - `TaskCompleted`: When a task is marked complete
- **Priority**: P1
- **Complexity**: Medium-High -- event system, stdin/stdout JSON protocol, exit code handling.

### 4.2 Hook Types

- **What**: Three hook handler types:
  - `command`: Shell commands receiving JSON on stdin
  - `http`: HTTP endpoints receiving JSON as POST body
  - `prompt`: LLM prompts for AI-powered validation
- **Priority**: P1
- **Complexity**: Medium

### 4.3 Hook Matchers

- **What**: Filter which tool invocations trigger hooks using regex patterns on tool names. Hooks can approve (exit 0), deny (exit 2), or pass through.
- **Priority**: P1
- **Complexity**: Low

### 4.4 Async Hooks

- **What**: Hooks that run in background without blocking the agent loop.
- **Priority**: P2
- **Complexity**: Low

---

## 5. MCP Server Integration

### 5.1 MCP Server Configuration

- **What**: Add/remove/list MCP servers via `claude mcp add/remove/list/get`. Three transports: HTTP (recommended), SSE (deprecated), stdio (local). Environment variable support (`--env`). Scopes: local (default, private), project (shared via `.mcp.json`), user (cross-project).
- **Priority**: P1
- **Complexity**: High -- MCP protocol implementation, transport handling, lifecycle management.

### 5.2 MCP Tool Discovery

- **What**: Tools from MCP servers appear alongside built-in tools. Dynamic `list_changed` notifications for live tool updates. Permission rules support MCP tool patterns. OAuth 2.0 authentication for remote servers.
- **Priority**: P1
- **Complexity**: High

### 5.3 MCP Resources

- **What**: Reference MCP resources via `@server:protocol://resource/path` mentions. Resources fetched and attached automatically.
- **Priority**: P2
- **Complexity**: Medium

### 5.4 MCP Prompts as Commands

- **What**: MCP server prompts appear as `/mcp__server__prompt` commands. Dynamically discovered.
- **Priority**: P2
- **Complexity**: Low

### 5.5 MCP Tool Search

- **What**: When many MCP tools exist, automatically defer loading and use search to discover relevant tools on demand. Prevents context bloat.
- **Priority**: P2
- **Complexity**: Medium

### 5.6 Managed MCP Configuration (Enterprise)

- **What**: `managed-mcp.json` for exclusive control. Allowlists/denylists (`allowedMcpServers`, `deniedMcpServers`) for policy-based control. Server matching by name, command, or URL pattern.
- **Priority**: P2
- **Complexity**: Medium

### 5.7 Claude Code as MCP Server

- **What**: `claude mcp serve` exposes Claude Code's tools as an MCP server for other applications to connect to.
- **Priority**: P2
- **Complexity**: Medium

---

## 6. Sub-Agent System

### 6.1 Built-in Sub-Agents

- **What**: Explore (Haiku, read-only, file discovery), Plan (read-only research for planning), general-purpose (all tools, complex tasks), Bash, Claude Code Guide.
- **Priority**: P1
- **Complexity**: Medium -- per-agent configuration, model routing.

### 6.2 Custom Sub-Agents

- **What**: Define in `.claude/agents/` (project) or `~/.claude/agents/` (user) as Markdown files with YAML frontmatter. Configurable: name, description, tools, disallowedTools, model, permissionMode, maxTurns, skills, mcpServers, hooks, memory, background, isolation.
- **Priority**: P1
- **Complexity**: Medium

### 6.3 Sub-Agent Isolation

- **What**: Each subagent runs in own context window. Can use git worktrees for file isolation (`isolation: worktree`). Auto-cleanup of worktrees if no changes made.
- **Priority**: P2
- **Complexity**: Medium

### 6.4 Background Sub-Agents

- **What**: Run subagents concurrently while user continues working. Pre-approve permissions before launch. Ctrl+B to background running tasks. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` to disable.
- **Priority**: P2
- **Complexity**: Medium

### 6.5 Sub-Agent Persistent Memory

- **What**: Subagents can maintain persistent memory across sessions. Scopes: user (`~/.claude/agent-memory/`), project (`.claude/agent-memory/`), local (`.claude/agent-memory-local/`). MEMORY.md entrypoint (first 200 lines loaded).
- **Priority**: P2
- **Complexity**: Low

### 6.6 Sub-Agent Resumption

- **What**: Resume subagents by agent ID to continue with full conversation history. Transcripts stored in `~/.claude/projects/{project}/{sessionId}/subagents/`.
- **Priority**: P2
- **Complexity**: Low

---

## 7. Agent Teams (Experimental)

### 7.1 Team Architecture

- **What**: Multiple Claude Code instances coordinated as a team. One lead, multiple teammates. Each teammate is a separate Claude session with own context. Shared task list for coordination. Direct inter-agent messaging.
- **Priority**: P2
- **Complexity**: Very High -- multi-process coordination, shared state, messaging.

### 7.2 Team Communication

- **What**: SendMessage tool with types: `message` (DM), `broadcast` (all), `shutdown_request`/`shutdown_response`, `plan_approval_request`/`plan_approval_response`. Automatic idle notifications.
- **Priority**: P2
- **Complexity**: High

### 7.3 Display Modes

- **What**: `in-process` (all in one terminal, Shift+Down to cycle), `tmux` (split panes), `auto` (tmux if available). Configurable via `--teammate-mode` or `teammateMode` setting.
- **Priority**: P2
- **Complexity**: Medium -- tmux/iTerm2 integration.

### 7.4 Plan Approval for Teammates

- **What**: Require teammates to plan before implementing. Lead reviews and approves/rejects plans.
- **Priority**: P2
- **Complexity**: Medium

---

## 8. Memory & Instructions System

### 8.1 CLAUDE.md Files

- **What**: Markdown files loaded at session start providing persistent instructions. Locations (by precedence):
  - Managed policy: `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS)
  - Project: `./CLAUDE.md` or `./.claude/CLAUDE.md`
  - User: `~/.claude/CLAUDE.md`
  - Local: `./CLAUDE.local.md` (gitignored)
  - Subdirectory: loaded on-demand when files in that dir are read
- **Why**: Primary mechanism for project-specific instructions, coding standards, architecture decisions.
- **Priority**: P0
- **Complexity**: Low-Medium -- file discovery, precedence resolution, directory walking.

### 8.2 Import Syntax

- **What**: `@path/to/import` in CLAUDE.md to include other files. Relative paths resolve from importing file. Max 5 hops depth. First-use approval dialog for external imports.
- **Priority**: P1
- **Complexity**: Low

### 8.3 Rules Directory (`.claude/rules/`)

- **What**: Modular instruction files organized by topic. Path-scoped rules via YAML frontmatter `paths` field with glob patterns (e.g., `src/**/*.ts`). Loaded on-demand when matching files are opened. User-level rules at `~/.claude/rules/`. Supports symlinks for cross-project sharing.
- **Priority**: P1
- **Complexity**: Medium -- glob matching, conditional loading.

### 8.4 Auto Memory

- **What**: Claude automatically saves notes as it works -- build commands, debugging insights, preferences. Stored in `~/.claude/projects/<project>/memory/`. MEMORY.md entrypoint (first 200 lines loaded at session start). Topic files loaded on demand. Toggle via `/memory` or `autoMemoryEnabled` setting.
- **Priority**: P1
- **Complexity**: Medium -- intelligent note extraction, deduplication, organization.

### 8.5 CLAUDE.md Excludes

- **What**: `claudeMdExcludes` setting to skip irrelevant CLAUDE.md files (glob patterns against absolute paths). Useful for monorepos.
- **Priority**: P2
- **Complexity**: Low

---

## 9. Settings System

### 9.1 Settings Hierarchy

- **What**: Five-level precedence:
  1. Managed (highest) -- server-managed, plist/registry, system-level `managed-settings.json`
  2. Command line arguments
  3. Local -- `.claude/settings.local.json`
  4. Project -- `.claude/settings.json`
  5. User (lowest) -- `~/.claude/settings.json`
- **Priority**: P0
- **Complexity**: Medium -- multi-source merging, array concatenation for certain fields.

### 9.2 Configuration Categories

- **What**: Model & performance, permissions & security, file & environment, UI & experience, sandbox & network, hooks & automation, MCP servers, plugins & marketplaces. Full JSON schema available for IDE autocompletion.
- **Priority**: P0
- **Complexity**: Medium

### 9.3 Environment Variables

- **What**: `env` field in settings.json for environment configuration. Key variables: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CLAUDE_CODE_SHELL`, `CLAUDE_CONFIG_DIR`, `DISABLE_TELEMETRY`, etc.
- **Priority**: P0
- **Complexity**: Low

### 9.4 Server-Managed Settings

- **What**: Remote configuration from server. Enterprise feature for centralized policy management.
- **Priority**: P2
- **Complexity**: Medium

---

## 10. Skills / Custom Commands

### 10.1 Skill System

- **What**: `SKILL.md` files with YAML frontmatter in `~/.claude/skills/` (user) or `.claude/skills/` (project). Skills extend what Claude can do. Both user-invocable (`/skill-name`) and model-invocable (Claude loads automatically when relevant). Supports arguments (`$ARGUMENTS`, `$0`, `$1`), string substitutions (`${CLAUDE_SESSION_ID}`), dynamic context injection (`!`command``).
- **Priority**: P1
- **Complexity**: Medium

### 10.2 Skill Configuration

- **What**: Frontmatter fields: name, description, argument-hint, disable-model-invocation, user-invocable, allowed-tools, model, context (fork), agent, hooks. Supporting files in skill directory. Path: `skills/<name>/SKILL.md`.
- **Priority**: P1
- **Complexity**: Medium

### 10.3 Bundled Skills

- **What**: Pre-built skills shipping with Claude Code:
  - `/simplify`: Reviews changed files for code reuse/quality/efficiency, spawns 3 parallel agents
  - `/batch`: Orchestrates large-scale parallel changes across codebase, spawns background agents in git worktrees
  - `/debug`: Troubleshoots current session by reading debug logs
- **Priority**: P1
- **Complexity**: High -- multi-agent orchestration for /batch.

### 10.4 Skills in Subagents

- **What**: `context: fork` to run skill in isolated subagent context. Preload skills into subagents via `skills` field in agent config.
- **Priority**: P2
- **Complexity**: Low

---

## 11. Plugin System

### 11.1 Plugin Structure

- **What**: Plugins are directories with `.claude-plugin/plugin.json` manifest. Can contain: skills, agents, hooks, MCP servers, LSP servers, settings, and commands. Namespaced skill invocation (`/plugin-name:skill-name`).
- **Priority**: P2
- **Complexity**: High -- plugin discovery, lifecycle, namespacing, component loading.

### 11.2 Plugin Marketplace

- **What**: GitHub-repo-based or URL-based plugin marketplaces. `claude mcp` / `/plugin` for management. Official Anthropic marketplace for submission. Managed marketplace restrictions for enterprises (`blockedMarketplaces`, `strictKnownMarketplaces`).
- **Priority**: P2
- **Complexity**: High -- marketplace protocol, versioning, distribution.

### 11.3 LSP Server Plugins

- **What**: Language Server Protocol integration via `.lsp.json` in plugins. Provides real-time code intelligence (diagnostics, completions, hover info).
- **Priority**: P2
- **Complexity**: Medium

### 11.4 Plugin Settings

- **What**: `settings.json` in plugin root. Currently supports `agent` key to activate a plugin agent as main thread.
- **Priority**: P2
- **Complexity**: Low

---

## 12. Interactive Mode & UI

### 12.1 Slash Commands (Built-in)

- **What**: Comprehensive command set accessed via `/`. Key commands:
  - Session: `/clear`, `/compact`, `/resume`, `/rewind`, `/fork`, `/rename`, `/export`
  - Config: `/config`, `/settings`, `/permissions`, `/memory`, `/hooks`, `/mcp`, `/agents`
  - Model: `/model`, `/fast`
  - Git: `/diff`, `/review`, `/pr-comments`, `/security-review`
  - UI: `/theme`, `/vim`, `/output-style`, `/statusline`, `/context`, `/copy`
  - Navigation: `/help`, `/exit`, `/status`, `/cost`, `/usage`, `/stats`
  - Integration: `/chrome`, `/ide`, `/desktop`, `/remote-control`
  - Other: `/init`, `/plugin`, `/skills`, `/doctor`, `/terminal-setup`, `/feedback`
- **Priority**: P0 (core subset), P1 (extended set)
- **Complexity**: Medium -- command registry, argument parsing, UI rendering.

### 12.2 Keyboard Shortcuts

- **What**: Comprehensive keybinding system with 15+ contexts (Global, Chat, Autocomplete, Confirmation, etc.). Customizable via `~/.claude/keybindings.json`. Key shortcuts: Ctrl+C (cancel), Ctrl+D (exit), Ctrl+T (task list), Ctrl+O (verbose), Ctrl+B (background), Shift+Tab (mode toggle), Esc+Esc (rewind), Ctrl+G (external editor), Ctrl+R (history search). Vim mode support.
- **Priority**: P1
- **Complexity**: Medium -- keybinding engine, context-aware dispatch.

### 12.3 File & Resource Mentions

- **What**: `@filename` for file path autocomplete with fuzzy matching. `@server:protocol://resource` for MCP resources. `@terminal:name` for terminal output. `@browser` for Chrome integration. Shift+drag for file attachments.
- **Priority**: P1
- **Complexity**: Medium -- autocomplete engine, resource resolution.

### 12.4 Multiline Input

- **What**: `\` + Enter, Option+Enter, Shift+Enter, Ctrl+J for multiline. Paste mode for code blocks.
- **Priority**: P0
- **Complexity**: Low

### 12.5 Vim Mode

- **What**: Full vim editing support with INSERT/NORMAL modes, motions (hjkl, w/e/b, f/F/t/T), operators (d/c/y with text objects), and visual operations. Toggle via `/vim`.
- **Priority**: P2
- **Complexity**: Medium

### 12.6 Command History

- **What**: Input history per working directory. Up/Down navigation. Reverse search with Ctrl+R (interactive, highlighted matches). History resets on `/clear`.
- **Priority**: P0
- **Complexity**: Low

### 12.7 Bash Mode (`!` prefix)

- **What**: Run shell commands directly without Claude interpreting them. Adds command + output to conversation context. History-based autocomplete with Tab.
- **Priority**: P1
- **Complexity**: Low

### 12.8 Prompt Suggestions

- **What**: Auto-generated grayed-out suggestions based on git history and conversation. Tab to accept. Uses background request with prompt cache. Skipped when cache is cold to avoid cost.
- **Priority**: P2
- **Complexity**: Medium

### 12.9 Task List UI

- **What**: Ctrl+T to toggle task list in terminal status area. Shows up to 10 tasks with status indicators (pending/in-progress/completed). Persists across compactions. Shared across sessions via `CLAUDE_CODE_TASK_LIST_ID`.
- **Priority**: P1
- **Complexity**: Medium

### 12.10 PR Review Status

- **What**: Clickable PR link in footer with colored underline (green=approved, yellow=pending, red=changes requested, gray=draft, purple=merged). Auto-updates every 60 seconds. Requires `gh` CLI.
- **Priority**: P2
- **Complexity**: Low

### 12.11 Diff Viewer

- **What**: `/diff` opens interactive diff viewer. Shows uncommitted changes and per-turn diffs. Left/right for diff sources, up/down for files.
- **Priority**: P1
- **Complexity**: Medium

### 12.12 Theme System

- **What**: `/theme` for color theme selection. Light/dark variants, colorblind-accessible (daltonized) themes, ANSI themes using terminal palette. Syntax highlighting toggle (Ctrl+T in theme picker).
- **Priority**: P1
- **Complexity**: Low-Medium

### 12.13 Status Line

- **What**: Customizable status line in terminal. Configure via `/statusline`. Custom commands for dynamic data display.
- **Priority**: P2
- **Complexity**: Low

---

## 13. Output Styles

### 13.1 Built-in Styles

- **What**: Three modes: Default (efficient SE output), Explanatory (adds educational insights), Learning (collaborative learn-by-doing with `TODO(human)` markers).
- **Priority**: P2
- **Complexity**: Low -- system prompt modification.

### 13.2 Custom Output Styles

- **What**: Markdown files in `~/.claude/output-styles/` or `.claude/output-styles/` with frontmatter (name, description, keep-coding-instructions). Modify system prompt behavior.
- **Priority**: P2
- **Complexity**: Low

---

## 14. Checkpointing & Rewind

### 14.1 Automatic Checkpointing

- **What**: Every user prompt creates a checkpoint. Tracks all file edits made by Claude's editing tools. Persists across sessions. Auto-cleaned with sessions (30 days default).
- **Priority**: P1
- **Complexity**: Medium -- file state tracking, git stash-like mechanisms.

### 14.2 Rewind (Esc+Esc or /rewind)

- **What**: Scrollable list of prompts from session. Actions:
  - Restore code and conversation (full revert)
  - Restore conversation only (keep current code)
  - Restore code only (keep conversation)
  - Summarize from here (compress later messages, free context)
- **Priority**: P1
- **Complexity**: Medium-High -- selective state restoration.

---

## 15. Git Integration

### 15.1 Commit Creation

- **What**: Claude reviews staged changes, writes commit messages following project conventions, creates commits. Understanding of conventional commits format. Co-author attribution.
- **Priority**: P0
- **Complexity**: Low -- git command execution.

### 15.2 PR Creation & Review

- **What**: `/review` for PR code review. `/pr-comments` to fetch PR comments. `/security-review` for security analysis. Full commit history analysis with `git diff [base]...HEAD`. PR description generation. Requires `gh` CLI.
- **Priority**: P1
- **Complexity**: Low-Medium -- gh CLI integration.

### 15.3 Git Worktrees

- **What**: `--worktree` flag or `EnterWorktree` tool for isolated parallel work. Each worktree gets its own branch based on HEAD. Stored in `.claude/worktrees/`. Cleanup prompt on session exit.
- **Priority**: P2
- **Complexity**: Low

### 15.4 Branch Management

- **What**: Create branches, switch branches, handle merge conflicts via natural language. Understanding of git workflow patterns.
- **Priority**: P1
- **Complexity**: Low -- git command execution.

---

## 16. Sandboxing

### 16.1 Filesystem Sandboxing

- **What**: OS-level enforcement (Seatbelt on macOS, bubblewrap on Linux). Default: write to CWD only, read anywhere (with denied dirs). Configurable `allowWrite`/`denyWrite`/`denyRead` paths. All child processes inherit restrictions.
- **Priority**: P1
- **Complexity**: High -- OS-level sandboxing, platform-specific implementations.

### 16.2 Network Sandboxing

- **What**: Proxy-based domain filtering. Only approved domains accessible. New domains trigger permission prompts. Custom proxy support for enterprise. `allowedDomains` configuration.
- **Priority**: P1
- **Complexity**: High -- proxy server, domain filtering.

### 16.3 Sandbox Modes

- **What**: Auto-allow (sandboxed commands auto-approved) vs Regular (standard permission flow even when sandboxed). Escape hatch: `dangerouslyDisableSandbox` parameter for commands that fail in sandbox.
- **Priority**: P1
- **Complexity**: Medium

### 16.4 Open Source Sandbox Runtime

- **What**: `@anthropic-ai/sandbox-runtime` npm package. Can sandbox any process, including MCP servers.
- **Priority**: P2
- **Complexity**: N/A (separate project)

---

## 17. Headless / Programmatic Mode (Agent SDK)

### 17.1 Print Mode (`-p`)

- **What**: Non-interactive execution with `-p` flag. All CLI options work. Output formats: text, json, stream-json. Structured output via `--json-schema`. Max budget (`--max-budget-usd`), max turns (`--max-turns`).
- **Priority**: P0
- **Complexity**: Low-Medium

### 17.2 Piped Input

- **What**: `cat file | claude -p "query"` for processing piped content. Unix-philosophy composability.
- **Priority**: P0
- **Complexity**: Low

### 17.3 System Prompt Customization

- **What**: Four flags: `--system-prompt` (replace), `--system-prompt-file` (replace from file), `--append-system-prompt` (append), `--append-system-prompt-file` (append from file).
- **Priority**: P1
- **Complexity**: Low

### 17.4 Agent SDK (Python/TypeScript)

- **What**: Full programmatic control via Python and TypeScript packages. Structured outputs, tool approval callbacks, native message objects. Same tools and agent loop as CLI.
- **Priority**: P2
- **Complexity**: High -- SDK design, language bindings.

---

## 18. IDE Integration

### 18.1 VS Code Extension

- **What**: Native graphical panel for Claude Code. Features: inline diffs with accept/reject, @-mentions with line ranges from selection, plan review mode, conversation history browser (local + remote), multiple tabs/windows, auto-save, plugin management UI. Command Palette integration. Extension settings (selectedModel, useTerminal, initialPermissionMode, etc.). Can switch to terminal mode.
- **Priority**: P1
- **Complexity**: Very High -- VS Code extension development, diff rendering, state sync.

### 18.2 JetBrains Plugin

- **What**: Plugin for IntelliJ IDEA, PyCharm, WebStorm, etc. Interactive diff viewing and selection context sharing.
- **Priority**: P2
- **Complexity**: High

### 18.3 Desktop App

- **What**: Standalone app for macOS and Windows. Visual diff review, multiple sessions side by side, cloud session management. `/desktop` command to hand off terminal session.
- **Priority**: P2
- **Complexity**: Very High -- Electron/native app development.

---

## 19. Remote & Cloud Features

### 19.1 Remote Control

- **What**: Control local Claude Code session from claude.ai or Claude mobile app. `claude remote-control` or `/remote-control`. Continue working from any device.
- **Priority**: P2
- **Complexity**: High -- WebSocket/WebRTC relay, authentication.

### 19.2 Web Sessions (Claude Code on the Web)

- **What**: Run Claude Code in browser with no local setup. Long-running tasks. `--remote` flag to create web session. `/teleport` to resume web session locally.
- **Priority**: P2
- **Complexity**: Very High -- cloud execution environment.

### 19.3 Slack Integration

- **What**: Route tasks from Slack to Claude Code. Mention @Claude with bug reports to get PRs.
- **Priority**: P2
- **Complexity**: High

### 19.4 Chrome Integration

- **What**: Browser automation via Claude in Chrome extension. Live debugging (console errors), design verification, web app testing, authenticated web apps, data extraction, form automation, session recording (GIF). `--chrome` flag or `/chrome`. `@browser` mentions.
- **Priority**: P2
- **Complexity**: High -- Chrome DevTools Protocol, native messaging.

---

## 20. CI/CD Integration

### 20.1 GitHub Actions

- **What**: `@claude` mentions on PRs and issues. Automated code review and issue triage. `/install-github-app` for setup.
- **Priority**: P1
- **Complexity**: Medium -- GitHub API integration, webhook handling.

### 20.2 GitLab CI/CD

- **What**: Integration with GitLab pipelines for automated review and development tasks.
- **Priority**: P2
- **Complexity**: Medium

---

## 21. Cost & Usage Management

### 21.1 Token Usage Tracking

- **What**: `/cost` command for token usage statistics. `/usage` for plan limits and rate limit status. `/stats` for daily usage visualization, session history, streaks, model preferences. `/context` for context window visualization (colored grid).
- **Priority**: P1
- **Complexity**: Low-Medium

### 21.2 Budget Controls

- **What**: `--max-budget-usd` for API call spending limit (print mode). Rate limit handling with extra usage configuration (`/extra-usage`).
- **Priority**: P1
- **Complexity**: Low

### 21.3 Analytics (Enterprise)

- **What**: Team usage tracking, monitoring dashboards. OpenTelemetry integration.
- **Priority**: P2
- **Complexity**: Medium

---

## 22. Security Features

### 22.1 Authentication

- **What**: Claude.ai subscription or Anthropic Console account. `claude auth login/logout/status`. SSO support (`--sso`). Third-party providers (Bedrock, Vertex AI, Foundry). API key helper (`apiKeyHelper` setting). Force login method (`forceLoginMethod`).
- **Priority**: P0
- **Complexity**: Medium -- OAuth flow, token management, multi-provider support.

### 22.2 Data Privacy

- **What**: Code not used for model training. Zero data retention option. Privacy settings (`/privacy-settings`). Telemetry opt-out.
- **Priority**: P0
- **Complexity**: Low

### 22.3 Security Review

- **What**: `/security-review` analyzes pending changes for vulnerabilities. Reviews git diff for injection, auth issues, data exposure.
- **Priority**: P1
- **Complexity**: Low -- prompt-based analysis.

---

## 23. Development Containers

### 23.1 DevContainer Support

- **What**: Run Claude Code inside development containers for additional isolation.
- **Priority**: P2
- **Complexity**: Medium

---

## 24. Miscellaneous Features

### 24.1 Auto-Update

- **What**: Native install auto-updates in background. `claude update` for manual. `autoUpdatesChannel` setting (stable/latest). `DISABLE_AUTOUPDATER` to opt out.
- **Priority**: P1
- **Complexity**: Medium

### 24.2 Diagnostic Tools

- **What**: `/doctor` to diagnose installation and settings. Debug mode (`--debug` with category filtering). Verbose mode (`--verbose`). Log viewing.
- **Priority**: P1
- **Complexity**: Low

### 24.3 Image Support

- **What**: Paste images from clipboard (Ctrl+V). Read image files. Multimodal input for visual context.
- **Priority**: P1
- **Complexity**: Low -- base64 encoding, API multimodal support.

### 24.4 PDF Support

- **What**: Read PDF files with page ranges. Maximum 20 pages per request.
- **Priority**: P2
- **Complexity**: Low -- PDF parsing library.

### 24.5 Internationalization

- **What**: `language` setting for response language (e.g., "japanese"). System prompt adaptation.
- **Priority**: P2
- **Complexity**: Low

### 24.6 Session Export

- **What**: `/export [filename]` to export conversation as plain text. Copy to clipboard or save to file.
- **Priority**: P2
- **Complexity**: Low

### 24.7 Conversation Forking

- **What**: `/fork [name]` to create a branch of current conversation. `--fork-session` when resuming.
- **Priority**: P2
- **Complexity**: Low

---

## Summary: Implementation Priority Matrix

### P0 -- Must Have for MVP (Core Engine)

| #   | Feature                                              | Complexity |
| --- | ---------------------------------------------------- | ---------- |
| 1   | Agentic Loop Engine                                  | High       |
| 2   | Context Window Management (auto-compaction)          | Medium     |
| 3   | Session Management (persist/resume)                  | Medium     |
| 4   | Streaming Output                                     | Medium     |
| 5   | Read/Write/Edit tools                                | Low        |
| 6   | Glob/Grep tools                                      | Low        |
| 7   | Bash tool (with background execution)                | Medium     |
| 8   | Permission System (modes + rules)                    | Medium     |
| 9   | CLAUDE.md / instruction files                        | Low-Medium |
| 10  | Settings hierarchy                                   | Medium     |
| 11  | Headless/print mode (`-p`)                           | Low-Medium |
| 12  | Authentication                                       | Medium     |
| 13  | Core slash commands (/clear, /compact, /help, /exit) | Low        |
| 14  | Multiline input                                      | Low        |
| 15  | Command history                                      | Low        |
| 16  | AskUserQuestion tool                                 | Low        |
| 17  | Piped input                                          | Low        |

### P1 -- Important for v1.0

| #   | Feature                                     | Complexity  |
| --- | ------------------------------------------- | ----------- |
| 1   | Model selection & switching                 | Low-Medium  |
| 2   | Extended thinking                           | Low         |
| 3   | WebFetch / WebSearch tools                  | Medium      |
| 4   | Sub-agent system (built-in + custom)        | High        |
| 5   | Task tracking system (TodoWrite)            | Medium      |
| 6   | Hook system (PreToolUse, PostToolUse, Stop) | Medium-High |
| 7   | MCP server integration (core)               | High        |
| 8   | Rules directory (.claude/rules/)            | Medium      |
| 9   | Auto memory                                 | Medium      |
| 10  | Skill/custom command system                 | Medium      |
| 11  | Bundled skills (/simplify, /batch, /debug)  | High        |
| 12  | Checkpointing & rewind                      | Medium-High |
| 13  | Git commit/PR/branch integration            | Low-Medium  |
| 14  | Sandboxing (filesystem + network)           | High        |
| 15  | Keyboard shortcuts (customizable)           | Medium      |
| 16  | File/resource mentions (@)                  | Medium      |
| 17  | Diff viewer                                 | Medium      |
| 18  | Theme system                                | Low-Medium  |
| 19  | Bash mode (! prefix)                        | Low         |
| 20  | System prompt customization flags           | Low         |
| 21  | VS Code extension                           | Very High   |
| 22  | GitHub Actions integration                  | Medium      |
| 23  | Token usage / cost tracking                 | Low-Medium  |
| 24  | Budget controls                             | Low         |
| 25  | Security review                             | Low         |
| 26  | Image support                               | Low         |
| 27  | Auto-update                                 | Medium      |
| 28  | Diagnostic tools (/doctor)                  | Low         |
| 29  | Import syntax in CLAUDE.md                  | Low         |

### P2 -- Nice to Have / Future

| #   | Feature                                   | Complexity |
| --- | ----------------------------------------- | ---------- |
| 1   | Agent Teams (multi-instance coordination) | Very High  |
| 2   | Plugin system + marketplace               | High       |
| 3   | Chrome browser integration                | High       |
| 4   | Remote Control / Web sessions             | Very High  |
| 5   | Slack integration                         | High       |
| 6   | Desktop app                               | Very High  |
| 7   | JetBrains plugin                          | High       |
| 8   | MCP resources, prompts, tool search       | Medium     |
| 9   | Claude Code as MCP server                 | Medium     |
| 10  | Managed settings (enterprise)             | Medium     |
| 11  | Sub-agent isolation (worktrees)           | Medium     |
| 12  | Background sub-agents                     | Medium     |
| 13  | Sub-agent persistent memory               | Low        |
| 14  | NotebookEdit tool                         | Low        |
| 15  | Vim mode                                  | Medium     |
| 16  | Prompt suggestions                        | Medium     |
| 17  | Output styles (custom)                    | Low        |
| 18  | Status line                               | Low        |
| 19  | PR review status footer                   | Low        |
| 20  | DevContainer support                      | Medium     |
| 21  | PDF support                               | Low        |
| 22  | Internationalization                      | Low        |
| 23  | Session export                            | Low        |
| 24  | Conversation forking                      | Low        |
| 25  | GitLab CI/CD                              | Medium     |
| 26  | Analytics (enterprise)                    | Medium     |
| 27  | LSP server plugins                        | Medium     |
| 28  | Agent SDK (Python/TypeScript)             | High       |
| 29  | Open source sandbox runtime               | N/A        |
| 30  | Server-managed settings                   | Medium     |
| 31  | CLAUDE.md excludes                        | Low        |
| 32  | Async hooks                               | Low        |

---

## Key Architectural Observations

### 1. Everything is Tools

Claude Code's architecture is tool-centric. Every capability (file reading, command execution, web access, agent spawning) is exposed as a tool that the LLM decides when to use. dbcode should follow this pattern for extensibility.

### 2. Configuration is Layered

Five levels of configuration (managed > CLI > local > project > user) with specific merge semantics (arrays merge, scalars override). This enables both enterprise control and individual customization.

### 3. Context is King

Auto-compaction, task persistence across compactions, selective loading of CLAUDE.md/rules, MCP tool search (deferred loading) -- everything is designed to maximize effective use of the context window.

### 4. Security is Defense-in-Depth

Permission rules + sandboxing + hooks + managed settings. Multiple independent layers that complement each other.

### 5. Extensibility at Every Level

Skills extend prompts, hooks extend lifecycle, MCP extends tools, plugins package everything, agents customize behavior. The extension surface area is massive.

### 6. Unix Philosophy

Piped input, composable CLI flags, JSON output formats, headless mode. Claude Code works as both an interactive tool and a Unix building block.
