# dbcode Gap Analysis: Feature Comparison vs Claude Code & Competitors

> Comprehensive analysis of features confirmed, missing, and worth considering
> Based on: Claude Code docs (59 pages), Cursor, Aider, Windsurf, Continue.dev, GitHub Copilot CLI
> Date: 2026-03-05

---

## Legend

- Confirmed in architecture plan
- Missing from architecture plan
- Competitor-exclusive feature worth considering

Priority: **P0** = Must have for MVP | **P1** = Must have for v1.0 | **P2** = Nice to have | **P3** = Future consideration

---

## 1. Core Agent Loop & Tool System

### Confirmed Features

| Feature                                                | Status    | Notes                                                  |
| ------------------------------------------------------ | --------- | ------------------------------------------------------ |
| ReAct agentic loop                                     | Confirmed | `agent-loop.ts` with while-loop, max iterations, abort |
| Tool registry with lazy loading                        | Confirmed | `registry.ts` with search/deferred loading             |
| Native function calling strategy                       | Confirmed | `native-function-calling.ts`                           |
| Text parsing fallback (XML)                            | Confirmed | `text-parsing.ts` for non-FC models                    |
| Auto strategy detection                                | Confirmed | Probe request to detect FC support                     |
| Streaming with backpressure                            | Confirmed | SSE consumption, block-level rendering                 |
| Tool timeout & AbortController                         | Confirmed | 120s bash, 30s file ops                                |
| P0 tools (7 core tools)                                | Confirmed | file_read/write/edit, bash, glob, grep, ask_user       |
| P1 tools (web_fetch, web_search, sub_agent, tasks)     | Confirmed | Planned for v1.0                                       |
| Search/Replace code editing with uniqueness validation | Confirmed | Exact string matching, replace_all                     |
| Zod schema validation for tool params                  | Confirmed | `validation.ts` with JSON Schema conversion            |

### Missing Features

| Feature                                         | Priority | Description                                                                                                                                                                                                                                                                                                                                                 | Source      |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **MCP Tool Search (deferred tool loading)**     | **P1**   | Claude Code auto-defers MCP tools when they exceed 10% of context. Uses a search tool to discover relevant MCP tools on-demand instead of preloading all definitions. Critical for scaling with many MCP servers. dbcode has tool search in registry but not the MCP-specific deferred loading with configurable threshold (`ENABLE_TOOL_SEARCH=auto:<N>`). | Claude Code |
| **Parallel tool execution for read-only tools** | **P2**   | Architecture notes "향후 병렬화 가능" for reads but doesn't detail it. Claude Code runs read-only tools in parallel. Significant speed improvement for multi-file operations.                                                                                                                                                                               | Claude Code |
| **Notebook editing tool (NotebookEdit)**        | **P2**   | Claude Code has a dedicated Jupyter notebook cell editing tool. dbcode supports .ipynb reading but not cell-level editing.                                                                                                                                                                                                                                  | Claude Code |
| **Tool reference blocks**                       | **P2**   | Claude Code uses `tool_reference` blocks (Sonnet 4+) to let the model reference tools without loading full definitions. Reduces context usage.                                                                                                                                                                                                              | Claude Code |
| **Fallback model on overload**                  | **P1**   | `--fallback-model` flag auto-switches to a different model when the primary is overloaded (print mode). dbcode has `fallbackModel` in config but no automatic overload detection and switchover.                                                                                                                                                            | Claude Code |
| **Max budget (USD) limit**                      | **P1**   | `--max-budget-usd` stops API calls after spending a dollar amount. dbcode has token budget but not dollar-denominated budget limits.                                                                                                                                                                                                                        | Claude Code |
| **Max turns limit**                             | **P1**   | `--max-turns` limits agentic turns in headless mode. dbcode has `maxAgentIterations` but no explicit turns limit for SDK/headless mode.                                                                                                                                                                                                                     | Claude Code |

---

## 2. Permission & Security System

### Confirmed Features

| Feature                                                 | Status    | Notes                                 |
| ------------------------------------------------------- | --------- | ------------------------------------- |
| Permission modes (default, acceptEdits, plan, bypass)   | Confirmed | `modes.ts`                            |
| Fine-grained allow/deny rules with glob patterns        | Confirmed | `rules.ts`                            |
| Deny -> Ask -> Allow evaluation order                   | Confirmed | First match wins                      |
| Dangerous command auto-detection                        | Confirmed | 10+ regex patterns                    |
| OS-level sandbox (macOS Seatbelt, Windows AppContainer) | Confirmed | `sandbox/` directory                  |
| Secret scanner (15+ patterns + entropy)                 | Confirmed | `secret-scanner.ts`                   |
| Input/output filters                                    | Confirmed | `input-filter.ts`, `output-filter.ts` |
| Audit logging with hash chain                           | Confirmed | SHA-256, JSONL, rotation              |
| Rate limiting                                           | Confirmed | Sliding window                        |
| Token budget management                                 | Confirmed | Daily/session limits                  |
| Security profiles (local vs external)                   | Confirmed | Different guardrail levels            |

### Missing Features

| Feature                                      | Priority | Description                                                                                                                                                                                                                         | Source      |
| -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Network sandbox with proxy**               | **P1**   | Claude Code routes all sandboxed network traffic through a proxy server that enforces domain allowlists. Blocks all outbound traffic except approved domains. dbcode has `allowedDomains` in config but no proxy-based enforcement. | Claude Code |
| **Sandbox auto-allow mode**                  | **P2**   | Two sandbox modes: auto-allow (sandboxed commands run without permission) and regular permissions (all commands prompt). Reduces approval fatigue significantly.                                                                    | Claude Code |
| **`excludedCommands` for sandbox**           | **P2**   | Allows specific commands (e.g., `docker`) to bypass sandbox when incompatible, while keeping sandbox for everything else.                                                                                                           | Claude Code |
| **Managed MCP configuration**                | **P2**   | System-wide `/Library/Application Support/ClaudeCode/managed-mcp.json` (macOS) and allowlist/denylist for MCP servers. Enterprise control over which MCP servers employees can use.                                                 | Claude Code |
| **`allowManagedPermissionRulesOnly`**        | **P2**   | Enterprise setting that prevents user/project settings from defining permission rules. Only managed settings apply.                                                                                                                 | Claude Code |
| **`allowManagedHooksOnly`**                  | **P2**   | Enterprise setting that prevents loading user/project/plugin hooks. Only managed hooks allowed.                                                                                                                                     | Claude Code |
| **Permission prompt tool for headless mode** | **P2**   | `--permission-prompt-tool` specifies an MCP tool to handle permission prompts in non-interactive mode. Enables custom approval flows in CI/CD.                                                                                      | Claude Code |
| **Server-managed settings**                  | **P2**   | Centralized settings management pushed from a server to all clients. Enterprise fleet management.                                                                                                                                   | Claude Code |
| **`dontAsk` permission mode**                | **P1**   | Auto-denies tools unless pre-approved. Safer than bypass but more autonomous than default. Missing from dbcode's mode list.                                                                                                         | Claude Code |

---

## 3. Context Management

### Confirmed Features

| Feature                                                 | Status    | Notes                      |
| ------------------------------------------------------- | --------- | -------------------------- |
| Auto-compaction at 95% threshold                        | Confirmed | `context-manager.ts`       |
| 4 context strategies (Write, Select, Compress, Isolate) | Confirmed | Anthropic pattern          |
| Token counting (js-tiktoken + tokenx)                   | Confirmed | Accurate + real-time       |
| /compact with custom instructions                       | Confirmed | Focus-guided summarization |
| Subagent context isolation                              | Confirmed | `subagents/spawner.ts`     |
| DBCODE.md hierarchical loading                          | Confirmed | 5-level priority           |

### Missing Features

| Feature                                    | Priority | Description                                                                                                                                                                                                                                                         | Source      |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Targeted summarization from checkpoint** | **P1**   | Claude Code's `/rewind` allows "Summarize from here" which compresses only messages after a selected point, keeping earlier context intact. Different from `/compact` which summarizes everything. dbcode has `/rewind` for restore but not targeted summarization. | Claude Code |
| **`/context` visualization**               | **P2**   | Visualizes current context usage as a colored grid showing what's consuming space (CLAUDE.md, MCP tools, skills, conversation). Helps users understand and optimize context.                                                                                        | Claude Code |
| **Prompt caching optimization**            | **P1**   | Claude Code leverages Anthropic's prompt caching to reduce costs for repeated content (system prompts, CLAUDE.md). Since dbcode uses OpenAI-compatible APIs, investigate provider-specific caching (e.g., vLLM prefix caching, Ollama keep-alive).                  | Claude Code |
| **Background conversation summarization**  | **P2**   | Claude Code uses tokens in background to summarize previous conversations for `--resume` feature. Small cost (~$0.04/session) but improves session continuation quality.                                                                                            | Claude Code |
| **Compaction instructions in DBCODE.md**   | **P2**   | Claude Code supports `# Compact instructions` section in CLAUDE.md to guide what compaction preserves. Simple but effective for maintaining important context across compactions.                                                                                   | Claude Code |

---

## 4. Session Management

### Confirmed Features

| Feature                         | Status    | Notes                                  |
| ------------------------------- | --------- | -------------------------------------- |
| Session save/restore (JSONL)    | Confirmed | `session-manager.ts`                   |
| Checkpointing + rewind          | Confirmed | `checkpoint-manager.ts`                |
| --continue, --resume            | Confirmed | CLI flags                              |
| /fork for session branching     | Confirmed | Creates new session from current point |
| /export for conversation export | Confirmed | Text export                            |
| 30-day auto-cleanup             | Confirmed | Configurable                           |

### Missing Features

| Feature                              | Priority | Description                                                                                                                                                            | Source      |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Session naming and rename**        | **P1**   | `/rename [name]` command for naming sessions. Auto-generates name from conversation if none provided. Makes session management much more usable.                       | Claude Code |
| **Fork with `--fork-session` flag**  | **P2**   | When resuming, creates a new session ID instead of reusing the original. Allows branching from any resumed session.                                                    | Claude Code |
| **Session linked to PR**             | **P2**   | `--from-pr 123` resumes sessions linked to a specific GitHub PR. Sessions auto-linked when created via `gh pr create`. Bridges coding sessions with PR workflow.       | Claude Code |
| **`--session-id` for specific UUID** | **P2**   | Use a specific session UUID for deterministic session management in automation.                                                                                        | Claude Code |
| **`--no-session-persistence`**       | **P2**   | Disable session saving for ephemeral/CI usage. Prevents sessions from accumulating on disk.                                                                            | Claude Code |
| **Prompt suggestions**               | **P2**   | After Claude responds, grayed-out suggested next prompts appear based on conversation history and git activity. Tab to accept. Reuses prompt cache so cost is minimal. | Claude Code |

---

## 5. CLI Interface & Terminal UX

### Confirmed Features

| Feature                                | Status    | Notes                        |
| -------------------------------------- | --------- | ---------------------------- |
| Ink + React terminal UI                | Confirmed | Full component tree designed |
| Streaming with block-level rendering   | Confirmed | Static blocks + active block |
| Markdown + syntax highlighting (Shiki) | Confirmed | VS Code-level output         |
| StatusBar (model, tokens, context %)   | Confirmed | `StatusBar.tsx`              |
| Multiline input (\ continuation)       | Confirmed | Plus Ctrl+E toggle           |
| Permission prompt [y/n/a]              | Confirmed | `PermissionPrompt.tsx`       |
| Slash command menu                     | Confirmed | `SlashCommandMenu.tsx`       |
| @ mention autocomplete                 | Confirmed | `MentionAutocomplete.tsx`    |
| Task list view (Ctrl+T)                | Confirmed | `TaskListView.tsx`           |
| DiffView for file changes              | Confirmed | `DiffView.tsx`               |
| Headless mode (-p flag)                | Confirmed | Phase 5                      |
| JSON output format                     | Confirmed | For scripting                |
| Pipe input support                     | Confirmed | Unix philosophy              |
| Input history (up/down arrows)         | Confirmed | `useInput.ts`                |

### Missing Features

| Feature                                           | Priority | Description                                                                                                                                                                                                | Source      |
| ------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Vim mode**                                      | **P2**   | `/vim` toggles vim-style editing with mode switching (NORMAL/INSERT), navigation (hjkl, w/e/b), editing (dd, cc, yy), text objects (iw, aw, i", etc.), and dot-repeat. Popular with power users.           | Claude Code |
| **`!` bash mode prefix**                          | **P1**   | Run bash commands directly by prefixing with `!` (e.g., `! npm test`). Output is added to conversation context. No Claude interpretation needed. Includes history-based Tab autocomplete for `!` commands. | Claude Code |
| **Ctrl+R reverse history search**                 | **P2**   | Interactive reverse search through command history with highlighting. Standard readline behavior but valuable in an AI assistant.                                                                          | Claude Code |
| **Ctrl+G open in external editor**                | **P2**   | Open current prompt in default text editor (`$EDITOR`). Useful for long, complex prompts.                                                                                                                  | Claude Code |
| **Ctrl+O toggle verbose output**                  | **P2**   | Shows detailed tool usage and execution info without restarting.                                                                                                                                           | Claude Code |
| **Ctrl+B background running tasks**               | **P1**   | Move long-running bash commands to background. Continue working while builds/tests run. Get output later via TaskOutput tool. Essential for productivity.                                                  | Claude Code |
| **Background task system**                        | **P1**   | Full background task infrastructure: unique task IDs, buffered output, TaskOutput retrieval tool, auto-cleanup on exit. Critical for running dev servers, builds, tests concurrently.                      | Claude Code |
| **Stream-JSON output format**                     | **P1**   | `--output-format stream-json` for real-time streaming in headless mode. Each line is a JSON event. Essential for SDK/programmatic integrations.                                                            | Claude Code |
| **Structured output with JSON Schema**            | **P1**   | `--json-schema` validates output against a JSON Schema after agent completes. Returns `structured_output` field. Critical for automation pipelines.                                                        | Claude Code |
| **`/diff` interactive viewer**                    | **P2**   | Interactive diff viewer with left/right arrows to switch between git diff and individual Claude turns, up/down to browse files. Goes beyond simple diff display.                                           | Claude Code |
| **`/stats` usage visualization**                  | **P2**   | Visualizes daily usage, session history, streaks, and model preferences. Gamification element that increases engagement.                                                                                   | Claude Code |
| **`/insights` session analysis**                  | **P2**   | Generates report analyzing Claude Code sessions including project areas, interaction patterns, and friction points.                                                                                        | Claude Code |
| **`/doctor` diagnostics**                         | **P1**   | Diagnose and verify installation, settings, connectivity. Essential for troubleshooting. Partially in plan but needs full implementation spec.                                                             | Claude Code |
| **Output styles (Explanatory, Learning, custom)** | **P2**   | `/output-style` switches between Default, Explanatory (adds educational insights), and Learning (pauses for hands-on practice). Users can create custom styles.                                            | Claude Code |
| **PR review status in footer**                    | **P2**   | Clickable PR link with colored underline (green=approved, yellow=pending, red=changes requested). Auto-updates every 60s. Requires `gh` CLI.                                                               | Claude Code |
| **Custom status line configuration**              | **P2**   | `/statusline` lets users configure what appears in the status bar (model, git branch, token usage progress bar, etc.). Highly customizable.                                                                | Claude Code |
| **`/copy` with code block picker**                | **P2**   | When code blocks are present, shows an interactive picker to select individual blocks or the full response to copy to clipboard.                                                                           | Claude Code |
| **Notification system**                           | **P1**   | Fires notification event when Claude finishes and waits for input. Supports terminal notifications (iTerm2, Kitty, Ghostty) and custom notification hooks.                                                 | Claude Code |
| **`/terminal-setup` auto-configuration**          | **P2**   | Automatically configures Shift+Enter and other keybindings for VS Code, Alacritty, Zed, Warp terminals. Only appears when needed.                                                                          | Claude Code |
| **Debug mode with category filtering**            | **P1**   | `--debug "api,mcp"` enables debug output filtered by category. Supports negation: `"!statsig,!file"`. Essential for development and troubleshooting.                                                       | Claude Code |
| **Verbose mode**                                  | **P1**   | `--verbose` shows full turn-by-turn output. Helpful for debugging in both print and interactive modes.                                                                                                     | Claude Code |

---

## 6. Hook System

### Confirmed Features

| Feature                    | Status    | Notes                              |
| -------------------------- | --------- | ---------------------------------- |
| PreToolUse hooks           | Confirmed | Validation, parameter modification |
| PostToolUse hooks          | Confirmed | Auto-formatting, linting           |
| Stop hooks                 | Confirmed | Final verification                 |
| Command-type hooks (shell) | Confirmed | stdin JSON, exit code control      |
| Matcher patterns           | Confirmed | Regex-based tool matching          |

### Missing Features

| Feature                              | Priority | Description                                                                                                                                                            | Source      |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **HTTP hooks**                       | **P1**   | POST JSON to a URL and receive JSON back instead of running shell commands. Enables serverless/cloud-based hook handlers, webhook integrations, and team-shared hooks. | Claude Code |
| **Prompt hooks (LLM-based)**         | **P2**   | Hook type that uses an LLM to evaluate. Useful for semantic validation that can't be done with regex/scripts.                                                          | Claude Code |
| **Notification hooks**               | **P1**   | Fire when Claude is waiting for input. Can play sounds, send messages, trigger desktop notifications. Essential for background work.                                   | Claude Code |
| **Init hooks**                       | **P2**   | Run at session initialization (`--init`, `--init-only`). Setup environment, validate prerequisites, fetch configs.                                                     | Claude Code |
| **Maintenance hooks**                | **P2**   | Run on `--maintenance` flag. Periodic cleanup, cache invalidation, health checks.                                                                                      | Claude Code |
| **ConfigChange hooks**               | **P2**   | Fire when configuration changes. Useful for propagating setting changes.                                                                                               | Claude Code |
| **PromptSubmit hooks**               | **P2**   | Fire when user submits a prompt. Preprocessing, logging, validation before Claude sees input.                                                                          | Claude Code |
| **PermissionRequest hooks**          | **P2**   | Fire during permission prompts. Custom approval flows, logging, auto-approve patterns.                                                                                 | Claude Code |
| **Compaction hooks**                 | **P2**   | Fire during context compaction. Influence what's preserved/discarded.                                                                                                  | Claude Code |
| **TeammateIdle hooks**               | **P3**   | For agent teams: runs when teammate goes idle. Exit code 2 sends feedback to keep working.                                                                             | Claude Code |
| **TaskCompleted hooks**              | **P3**   | For agent teams: runs when task marked complete. Exit code 2 prevents completion with feedback.                                                                        | Claude Code |
| **Async hooks**                      | **P2**   | Hooks that run asynchronously without blocking the main flow. For logging, analytics, notifications.                                                                   | Claude Code |
| **Hook output as context injection** | **P2**   | Hook stdout can be injected back into conversation context. Enables dynamic context augmentation.                                                                      | Claude Code |

---

## 7. Skills System

### Confirmed Features

| Feature                                    | Status    | Notes                             |
| ------------------------------------------ | --------- | --------------------------------- |
| SKILL.md with YAML frontmatter             | Confirmed | `skills/loader.ts`                |
| Skill registry and discovery               | Confirmed | `skills/registry.ts`              |
| Skill execution with argument substitution | Confirmed | `skills/executor.ts` ($ARGUMENTS) |
| Context fork for isolated execution        | Confirmed | `context: fork`                   |
| User-invocable skills (/ commands)         | Confirmed | Slash command integration         |

### Missing Features

| Feature                                        | Priority | Description                                                                                                                                                                                        | Source      |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **`disable-model-invocation` frontmatter**     | **P1**   | Prevents Claude from auto-triggering skills. User-only invocation for skills with side effects like `/deploy`. Critical for safety.                                                                | Claude Code |
| **`user-invocable: false` frontmatter**        | **P2**   | Hides skill from `/` menu. For background knowledge Claude should know but users shouldn't invoke directly.                                                                                        | Claude Code |
| **`allowed-tools` frontmatter**                | **P1**   | Restrict which tools a skill can use. Creates read-only modes or sandboxed skill execution.                                                                                                        | Claude Code |
| **`model` frontmatter**                        | **P2**   | Override model for specific skill. Use cheaper models for simple skills.                                                                                                                           | Claude Code |
| **`agent` frontmatter**                        | **P2**   | Specify which subagent type to use when `context: fork`. Maps to built-in or custom agents.                                                                                                        | Claude Code |
| **`hooks` frontmatter**                        | **P2**   | Skill-scoped hooks that only fire during that skill's lifecycle.                                                                                                                                   | Claude Code |
| **Dynamic context injection (`!`command``)**   | **P1**   | Shell commands in skill content run before Claude sees it. Output replaces placeholder. Essential for skills that need live data (e.g., PR diff, git status).                                      | Claude Code |
| **Bundled skills (/simplify, /batch, /debug)** | **P1**   | `/simplify` spawns 3 parallel review agents. `/batch` decomposes work into 5-30 units with worktree isolation. `/debug` analyzes session debug log. Ship production-quality skills out of the box. | Claude Code |
| **Skill description budget management**        | **P2**   | Skills descriptions budget scales at 2% of context window (fallback 16,000 chars). `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var override. Prevents context bloat from many skills.                     | Claude Code |
| **Agent Skills standard compliance**           | **P2**   | Claude Code follows the [agentskills.io](https://agentskills.io) open standard. Skills work across Claude Code, Codex, Gemini CLI. Interoperability advantage.                                     | Claude Code |
| **Skills from `--add-dir` directories**        | **P2**   | Skills in additional directories auto-loaded with live change detection. Edit during session without restart.                                                                                      | Claude Code |
| **Supporting files in skill directories**      | **P2**   | Skills can include templates, examples, scripts alongside SKILL.md. Keeps main skill focused while providing reference material.                                                                   | Claude Code |
| **`argument-hint` frontmatter**                | **P2**   | Hint shown during autocomplete (e.g., `[issue-number]`, `[filename] [format]`). Improves discoverability.                                                                                          | Claude Code |
| **`$ARGUMENTS[N]` and `$N` positional access** | **P1**   | Access individual arguments by position. `$0` for first, `$1` for second. Essential for multi-argument skills.                                                                                     | Claude Code |

---

## 8. Plugin & Marketplace System

### Confirmed Features

| Feature                               | Status | Notes                                                                       |
| ------------------------------------- | ------ | --------------------------------------------------------------------------- |
| (Not explicitly in architecture plan) | --     | Skills and hooks are planned but not a plugin packaging/distribution system |

### Missing Features

| Feature                              | Priority | Description                                                                                                                                                                                                  | Source      |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **Plugin system**                    | **P2**   | Plugins bundle skills, hooks, subagents, MCP servers, and LSP servers into a single installable unit. `.claude-plugin/plugin.json` manifest with name, version, author. Namespaced skills prevent conflicts. | Claude Code |
| **Plugin marketplace**               | **P3**   | Host and distribute plugin collections. Official Anthropic marketplace + custom team marketplaces. `/plugin install` command.                                                                                | Claude Code |
| **Plugin-provided MCP servers**      | **P2**   | Plugins can bundle MCP servers that auto-start when enabled. `${CLAUDE_PLUGIN_ROOT}` for relative paths.                                                                                                     | Claude Code |
| **Plugin-provided LSP servers**      | **P2**   | Plugins can bundle Language Server Protocol servers for code intelligence (go-to-definition, type checking, diagnostics). Reduces unnecessary file reads.                                                    | Claude Code |
| **Plugin settings.json**             | **P2**   | Plugins can ship default settings including activating a custom agent as the main thread.                                                                                                                    | Claude Code |
| **`--plugin-dir` for development**   | **P2**   | Load plugins from local directories for testing. Essential for plugin development workflow.                                                                                                                  | Claude Code |
| **Managed marketplace restrictions** | **P3**   | `blockedMarketplaces`, `strictKnownMarketplaces` settings for enterprise control over which plugin sources are allowed.                                                                                      | Claude Code |

---

## 9. MCP (Model Context Protocol) Integration

### Confirmed Features

| Feature                               | Status | Notes                                         |
| ------------------------------------- | ------ | --------------------------------------------- |
| (Not explicitly in architecture plan) | --     | MCP is not mentioned in the architecture plan |

### Missing Features

| Feature                                         | Priority | Description                                                                                                                                                                             | Source      |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **MCP server support (stdio, HTTP, SSE)**       | **P1**   | Connect to external tools, databases, APIs via MCP protocol. Three transport types. `claude mcp add` CLI. Hundreds of integrations available. This is a major ecosystem differentiator. | Claude Code |
| **MCP scope hierarchy (local, project, user)**  | **P2**   | Local (private, project-specific), Project (`.mcp.json` in repo, shared), User (cross-project). Override by name with precedence.                                                       | Claude Code |
| **MCP OAuth 2.0 authentication**                | **P2**   | Secure connections to cloud MCP servers with OAuth flow. Token refresh, browser-based login.                                                                                            | Claude Code |
| **MCP resources as @ mentions**                 | **P2**   | Reference MCP resources using `@server:protocol://resource/path`. Fuzzy-searchable autocomplete.                                                                                        | Claude Code |
| **MCP prompts as / commands**                   | **P2**   | MCP servers expose prompts available as `/mcp__server__prompt` commands. Dynamic discovery.                                                                                             | Claude Code |
| **MCP `list_changed` notifications**            | **P2**   | MCP servers can dynamically update available tools without reconnection.                                                                                                                | Claude Code |
| **Environment variable expansion in .mcp.json** | **P2**   | `${VAR}` and `${VAR:-default}` syntax in MCP configs. Team-shared configs with machine-specific values.                                                                                 | Claude Code |
| **MCP output limits and warnings**              | **P2**   | Warning at 10,000 tokens. Configurable max via `MAX_MCP_OUTPUT_TOKENS`. Prevents context bloat from large MCP responses.                                                                | Claude Code |
| **`claude mcp serve` (Claude as MCP server)**   | **P3**   | Use dbcode itself as an MCP server that other apps can connect to. Exposes tools like Read, Edit, etc.                                                                                  | Claude Code |

---

## 10. Agent Teams & Multi-Agent Coordination

### Confirmed Features

| Feature                          | Status    | Notes                                   |
| -------------------------------- | --------- | --------------------------------------- |
| Subagents with context isolation | Confirmed | `subagents/spawner.ts`                  |
| Built-in Explore and Plan agents | Confirmed | `builtin/explore.ts`, `builtin/plan.ts` |
| Task manager                     | Confirmed | `task-manager.ts`                       |

### Missing Features

| Feature                                         | Priority | Description                                                                                                                                                                                                                    | Source      |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **Agent teams (multi-session coordination)**    | **P3**   | Multiple independent Claude Code sessions with shared task list, inter-agent messaging, and centralized management. Team lead coordinates, teammates work independently. Uses tmux for split panes. Experimental but powerful. | Claude Code |
| **Custom subagent definitions (--agents flag)** | **P2**   | Define subagents via JSON with description, prompt, tools, model, skills, mcpServers, maxTurns. Dynamic agent creation without config files.                                                                                   | Claude Code |
| **Subagent skill preloading**                   | **P1**   | Subagents can preload specific skills at launch. Full skill content injected at startup, not on-demand. Essential for specialized workers.                                                                                     | Claude Code |
| **Agent definitions in `.dbcode/agents/`**      | **P2**   | Project-level agent configurations in markdown files. Shareable via version control.                                                                                                                                           | Claude Code |
| **General-purpose agent type**                  | **P2**   | Beyond Explore and Plan, a general-purpose agent with full tool access. Default for skills with `context: fork`.                                                                                                               | Claude Code |
| **Git worktree isolation for agents**           | **P2**   | `--worktree` / `-w` flag starts agent in isolated git worktree at `.claude/worktrees/<name>`. Agents work on separate branches without conflicts. `/batch` skill uses this for parallel implementation.                        | Claude Code |
| **Teammate plan approval**                      | **P3**   | Teammates work in read-only plan mode until lead approves their approach. Lead reviews and approves/rejects. Rejected teammates revise.                                                                                        | Claude Code |
| **Inter-agent messaging (mailbox)**             | **P3**   | Teammates can message each other directly, not just report to lead. Broadcast to all teammates. File-locked task claiming prevents races.                                                                                      | Claude Code |

---

## 11. Monitoring, Analytics & Telemetry

### Confirmed Features

| Feature                           | Status    | Notes               |
| --------------------------------- | --------- | ------------------- |
| Audit logging (JSONL, hash chain) | Confirmed | `audit-logger.ts`   |
| /cost command                     | Confirmed | Token usage display |
| Token counting in StatusBar       | Confirmed | Real-time display   |

### Missing Features

| Feature                                           | Priority | Description                                                                                                                                                                                         | Source      |
| ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **OpenTelemetry integration**                     | **P1**   | Full OTel support: metrics (OTLP, Prometheus, console) + events (logs). Session count, lines of code, commits, PRs, cost, token usage, active time, tool decisions. Enterprise-grade observability. | Claude Code |
| **Analytics dashboard**                           | **P2**   | Web-based dashboard showing usage metrics, contribution metrics, daily active users, suggestion accept rate, leaderboard. GitHub integration for PR attribution.                                    | Claude Code |
| **PR attribution (`claude-code-assisted` label)** | **P3**   | Automatically labels merged PRs that contain AI-assisted code. Tracks lines of code written with AI. Conservative matching with 21-day time window.                                                 | Claude Code |
| **Dynamic OTel headers**                          | **P2**   | `otelHeadersHelper` script generates auth headers dynamically. Refreshed every 29 minutes. Enterprise auth integration.                                                                             | Claude Code |
| **Multi-team resource attributes**                | **P2**   | `OTEL_RESOURCE_ATTRIBUTES` for department, team, cost center. Filter metrics by org unit.                                                                                                           | Claude Code |
| **Metrics cardinality control**                   | **P2**   | Toggle session ID, version, account UUID inclusion in metrics. Manage storage costs vs granularity.                                                                                                 | Claude Code |
| **Tool decision event tracking**                  | **P2**   | Log when user accepts/rejects Edit/Write/NotebookEdit. Track decision source (config, hook, user_permanent, etc.).                                                                                  | Claude Code |
| **Prompt correlation (prompt.id)**                | **P2**   | UUID linking all events from a single user prompt. Trace API requests + tool results back to triggering prompt.                                                                                     | Claude Code |

---

## 12. IDE & Platform Integration

### Confirmed Features

| Feature                          | Status    | Notes                         |
| -------------------------------- | --------- | ----------------------------- |
| CLI-first design                 | Confirmed | Terminal-native               |
| Cross-platform (Windows + macOS) | Confirmed | Extensive compatibility notes |

### Missing Features

| Feature                                          | Priority | Description                                                                                                                                                                          | Source      |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **VS Code extension**                            | **P2**   | Claude Code integrates as VS Code extension with terminal panel. Not just CLI in VS Code terminal but native extension integration.                                                  | Claude Code |
| **JetBrains plugin**                             | **P3**   | Native JetBrains IDE integration.                                                                                                                                                    | Claude Code |
| **Desktop app**                                  | **P3**   | Standalone desktop application. macOS and Windows. `/desktop` command to continue session in app.                                                                                    | Claude Code |
| **Web-based IDE**                                | **P3**   | Browser-based IDE at claude.ai/code. `--remote` creates web session. `--teleport` brings web session to local terminal.                                                              | Claude Code |
| **Remote control**                               | **P3**   | Control local Claude Code from claude.ai or Claude app. `claude remote-control` command.                                                                                             | Claude Code |
| **Chrome browser integration**                   | **P2**   | `--chrome` flag enables web automation and testing via Chrome DevTools. MCP-based. Useful for E2E testing.                                                                           | Claude Code |
| **Slack integration**                            | **P3**   | `/install-slack-app` for Slack integration. OAuth flow.                                                                                                                              | Claude Code |
| **GitHub Actions integration**                   | **P1**   | `@claude` mention in PR/issue triggers Claude. Auto code review, PR creation, feature implementation. Essential for CI/CD. Translates to: create a GitHub Action wrapper for dbcode. | Claude Code |
| **GitLab CI/CD integration**                     | **P2**   | Same as GitHub Actions but for GitLab pipelines.                                                                                                                                     | Claude Code |
| **`--add-dir` for multiple working directories** | **P1**   | Add additional working directories for multi-repo or monorepo workflows. `/add-dir` command during session. `additionalDirectories` in settings.                                     | Claude Code |

---

## 13. Configuration & Settings

### Confirmed Features

| Feature                                      | Status    | Notes                                      |
| -------------------------------------------- | --------- | ------------------------------------------ |
| 5-level hierarchical config                  | Confirmed | Managed -> CLI -> Local -> Project -> User |
| Zod schema validation                        | Confirmed | Full config schema                         |
| Environment variable for auth                | Confirmed | `DBCODE_API_KEY`                           |
| Per-project settings (.dbcode/settings.json) | Confirmed | Shared via VCS                             |
| Managed enterprise settings                  | Confirmed | System-level policies                      |

### Missing Features

| Feature                                     | Priority | Description                                                                                                                                                                                      | Source      |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **`--setting-sources` flag**                | **P2**   | Comma-separated list of which setting sources to load (user, project, local). Useful for isolated testing.                                                                                       | Claude Code |
| **`--settings` flag (file or JSON string)** | **P2**   | Load additional settings from a file or inline JSON. Useful for CI/CD and scripting.                                                                                                             | Claude Code |
| **`/config` interactive settings UI**       | **P1**   | Interactive settings interface with Config and Status tabs. Browse and modify settings without editing JSON files.                                                                               | Claude Code |
| **`--strict-mcp-config`**                   | **P2**   | Only use MCP servers from `--mcp-config`, ignoring all other MCP configurations. For isolated environments.                                                                                      | Claude Code |
| **Extended thinking configuration**         | **P1**   | Thinking levels: "think" < "think hard" < "think harder" < "ultrathink". Budget control via `MAX_THINKING_TOKENS`. Toggle with Alt+T. Default 31,999 tokens. Critical for reasoning-heavy tasks. | Claude Code |
| **Fast mode toggle**                        | **P1**   | `/fast` toggles faster output from the same model. Same model, different speed/cost tradeoff.                                                                                                    | Claude Code |
| **Effort level adjustment**                 | **P2**   | In `/model`, use left/right arrows to adjust effort level for models that support it (Opus 4.6). Fine-grained control over reasoning depth.                                                      | Claude Code |
| **Colorblind-accessible themes**            | **P2**   | Daltonized themes in `/theme`. Accessibility feature.                                                                                                                                            | Claude Code |
| **ANSI themes using terminal palette**      | **P2**   | Themes that use terminal's native color palette for consistent look.                                                                                                                             | Claude Code |

---

## 14. Auto-Update & Distribution

### Confirmed Features

| Feature                      | Status    | Notes                |
| ---------------------------- | --------- | -------------------- |
| npm deployment               | Confirmed | Phase 6              |
| Airgap deployment (npm pack) | Confirmed | Offline installation |

### Missing Features

| Feature                      | Priority | Description                                                                                | Source      |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------ | ----------- |
| **`dbcode update` command**  | **P1**   | Self-update command. Claude Code has `claude update`. Essential for keeping users current. | Claude Code |
| **`--version` / `-v` flag**  | **P0**   | Output version number. Standard CLI convention.                                            | Claude Code |
| **`/release-notes` command** | **P2**   | View full changelog with most recent version closest to prompt. In-app changelog.          | Claude Code |
| **`/upgrade` command**       | **P3**   | Open upgrade page for plan tier changes. Only relevant if dbcode has paid tiers.           | Claude Code |

---

## 15. Competitor-Exclusive Features Worth Considering

### From Cursor IDE

| Feature                                 | Priority | Description                                                                                                                                                                                | Differentiation Value                                                                                                                                                                                                         |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Codebase semantic indexing**          | **P1**   | Builds a semantic understanding of entire project. Sub-second queries on up to 500MB codebases. Enables context-aware suggestions based on architecture, naming conventions, and patterns. | HIGH - dbcode could use tree-sitter for AST-based indexing combined with vector embeddings (local FAISS/HNSW) for semantic search. This is in the P1 deps list (`tree-sitter`) but not architected as a full indexing system. |
| **Tab completion / predictive editing** | **P2**   | Specialized model predicts next edit across lines and blocks. Anticipates several coding steps. Single keystroke to execute.                                                               | MEDIUM - Requires IDE integration (not possible in pure CLI). Could be implemented as a VS Code extension feature. CLI could offer "suggested next action" prompts.                                                           |
| **Inline diff preview**                 | **P2**   | Shows proposed changes inline in the editor before applying. Accept/reject per-hunk.                                                                                                       | MEDIUM - CLI diff view exists but inline preview requires IDE integration.                                                                                                                                                    |

### From Aider

| Feature                                         | Priority | Description                                                                                                                                                                           | Differentiation Value                                                                                                                                                                 |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository map (repo-map)**                   | **P1**   | Tree-sitter-based map of entire repo showing classes, functions, and call signatures. Graph-ranked by dependencies. Optimized to fit token budget. Sends only most relevant portions. | HIGH - This is a critical efficiency feature. dbcode lists tree-sitter as P1 dependency but doesn't architect the repo-map system. Should be a core feature for context optimization. |
| **Voice input**                                 | **P3**   | Voice-to-code capabilities. Speak coding instructions. Useful for accessibility and hands-free workflows.                                                                             | LOW for CLI tool. Could integrate with OS speech-to-text APIs.                                                                                                                        |
| **Browser UI mode**                             | **P3**   | Aider can run in browser, not just CLI. Lowers barrier to entry for non-CLI users.                                                                                                    | MEDIUM - Could be implemented as a separate lightweight web server (similar to Jupyter).                                                                                              |
| **Auto-lint and auto-test on changes**          | **P2**   | Configure Aider to automatically run linter/test suite on LLM-made changes and feed results back.                                                                                     | MEDIUM - dbcode has PostToolUse hooks for this, but Aider's is more integrated (auto-retry on failure). Consider built-in lint-and-retry loop in agent loop.                          |
| **Multi-model architecture (architect+editor)** | **P2**   | Uses a strong model for planning and a fast model for editing. Different models for different phases of work.                                                                         | MEDIUM - dbcode has model routing (Hybrid mode) but not phase-specific model switching within a single task.                                                                          |

### From Windsurf/Codeium

| Feature                                        | Priority | Description                                                                                                                                               | Differentiation Value                                                                                                  |
| ---------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Flows (real-time action awareness)**         | **P2**   | AI is aware of your real-time editor actions without prompting. Tracks cursor movement, file switches, typing patterns. Removes need to describe context. | LOW for CLI (no editor cursor). HIGH for IDE extension. Could track terminal command history and file access patterns. |
| **Cascading actions with background planning** | **P2**   | Specialized planning agent continuously refines long-term plan while execution model handles short-term actions. Dual-agent architecture.                 | MEDIUM - Could implement as a background planning subagent that updates task list while main agent executes.           |
| **Message queuing during execution**           | **P1**   | Queue up new messages while Claude is working. Execute in order once current task completes.                                                              | HIGH - Simple UX improvement. Allow typing next instruction while current one runs. Buffer and send when ready.        |

### From Continue.dev

| Feature                                   | Priority  | Description                                                                                                             | Differentiation Value                                                                                       |
| ----------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Context providers (pluggable context)** | **P2**    | Extensible context system: code, docs, URLs, databases, custom sources. Each provider adds relevant context to prompts. | MEDIUM - dbcode's @ mentions + MCP cover most of this. Could formalize as a "context provider" abstraction. |
| **Model flexibility (any LLM backend)**   | Confirmed | Continue supports OpenAI, Anthropic, local models via Ollama.                                                           | CONFIRMED - dbcode already has this via OpenAI-compatible client.                                           |
| **Open-source, self-hostable**            | Confirmed | Fully open source, can be self-hosted.                                                                                  | CONFIRMED - dbcode is designed for internal deployment.                                                     |

### From GitHub Copilot CLI

| Feature                                                   | Priority  | Description                                                                                      | Differentiation Value                                                                                         |
| --------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **`gh copilot explain` pattern**                          | **P2**    | Dedicated command for explaining shell commands, errors, code. Focused UX for a common task.     | LOW - This is just a prompt pattern. Could be a bundled skill (`/explain`).                                   |
| **Specialized agents (Explore, Task, Code Review, Plan)** | **P1**    | Auto-delegates to purpose-built agents based on task type. Each has optimized tools and prompts. | MEDIUM - dbcode has Explore and Plan. Consider adding Task (builds/tests) and Code Review agents as built-in. |
| **Plan mode with explicit approval**                      | Confirmed | Reviews and approves plan before execution.                                                      | CONFIRMED - dbcode has Plan permission mode.                                                                  |
| **Autopilot mode**                                        | Confirmed | Fully autonomous execution.                                                                      | CONFIRMED - dbcode has bypassPermissions mode.                                                                |

---

## 16. Summary: Top Priority Missing Features

### Must-Add for MVP (P0)

| #   | Feature                 | Category     |
| --- | ----------------------- | ------------ |
| 1   | `--version` / `-v` flag | Distribution |

### Must-Add for v1.0 (P1)

| #   | Feature                                          | Category             | Effort |
| --- | ------------------------------------------------ | -------------------- | ------ |
| 1   | Background task system (Ctrl+B, TaskOutput tool) | CLI UX               | Medium |
| 2   | `!` bash mode prefix                             | CLI UX               | Small  |
| 3   | Notification system (when waiting for input)     | CLI UX               | Small  |
| 4   | Stream-JSON output format                        | Headless/SDK         | Medium |
| 5   | Structured output with JSON Schema               | Headless/SDK         | Medium |
| 6   | MCP server support (stdio, HTTP, SSE)            | Extensibility        | Large  |
| 7   | HTTP hooks                                       | Hooks                | Medium |
| 8   | Notification hooks                               | Hooks                | Small  |
| 9   | Repository map (tree-sitter + graph ranking)     | Context Optimization | Large  |
| 10  | Codebase semantic indexing                       | Context Optimization | Large  |
| 11  | Bundled skills (/simplify, /batch, /debug)       | Skills               | Medium |
| 12  | Dynamic context injection in skills (`!`cmd``)   | Skills               | Small  |
| 13  | `disable-model-invocation` for skills            | Skills               | Small  |
| 14  | `allowed-tools` for skills                       | Skills               | Small  |
| 15  | $ARGUMENTS[N] positional access                  | Skills               | Small  |
| 16  | Session naming/rename                            | Sessions             | Small  |
| 17  | `dontAsk` permission mode                        | Permissions          | Small  |
| 18  | Max budget (USD) limit                           | Cost Management      | Small  |
| 19  | Fallback model on overload                       | LLM Client           | Medium |
| 20  | OpenTelemetry integration                        | Monitoring           | Medium |
| 21  | `dbcode update` command                          | Distribution         | Small  |
| 22  | Debug/verbose mode with categories               | Developer UX         | Small  |
| 23  | `/config` interactive settings UI                | Configuration        | Medium |
| 24  | Extended thinking configuration                  | Model Config         | Medium |
| 25  | Fast mode toggle                                 | Model Config         | Small  |
| 26  | GitHub Actions integration                       | CI/CD                | Medium |
| 27  | Network sandbox with proxy                       | Security             | Large  |
| 28  | `--add-dir` for multiple working directories     | CLI                  | Small  |
| 29  | Prompt caching optimization                      | Cost Optimization    | Medium |
| 30  | Targeted summarization from checkpoint           | Context Mgmt         | Medium |
| 31  | `/doctor` diagnostics                            | Troubleshooting      | Medium |
| 32  | Message queuing during execution                 | UX (from Windsurf)   | Small  |
| 33  | Subagent skill preloading                        | Agents               | Small  |

### Nice-to-Have for v2.0 (P2)

| #   | Feature                            | Category        |
| --- | ---------------------------------- | --------------- |
| 1   | Plugin system with marketplace     | Extensibility   |
| 2   | Full MCP scope hierarchy and OAuth | MCP             |
| 3   | VS Code extension                  | IDE Integration |
| 4   | Chrome browser integration         | Testing         |
| 5   | Agent teams (experimental)         | Multi-Agent     |
| 6   | Git worktree isolation             | Parallel Work   |
| 7   | Vim mode                           | CLI UX          |
| 8   | Output styles                      | UX              |
| 9   | Analytics dashboard                | Monitoring      |
| 10  | Custom subagent definitions        | Agents          |
| 11  | All remaining hook types           | Hooks           |
| 12  | Tab completion (IDE extension)     | UX              |
| 13  | Repo-map with graph ranking        | Context         |
| 14  | Parallel read-only tool execution  | Performance     |

---

## 17. Key Architectural Gaps (Structural Issues)

These are not just missing features but structural gaps that affect the overall architecture:

### 1. No MCP Architecture

The architecture plan has no MCP layer at all. MCP is the de facto standard for AI tool integrations with hundreds of available servers. This needs a dedicated module:

```
src/mcp/
  ├── client.ts          # MCP client (stdio, HTTP, SSE transports)
  ├── registry.ts        # Server registration, scope management
  ├── auth.ts            # OAuth 2.0 flow for remote servers
  ├── tool-bridge.ts     # Bridge MCP tools to dbcode tool registry
  └── config.ts          # .mcp.json parsing, env var expansion
```

### 2. No Background Task Infrastructure

The plan has no concept of background tasks. This is critical for productivity:

```
src/tasks/
  ├── background-runner.ts  # Run commands in background
  ├── output-buffer.ts      # Buffer and retrieve output
  ├── task-output-tool.ts   # Tool for retrieving background output
  └── types.ts              # TaskId, TaskStatus, etc.
```

### 3. No Plugin Packaging Layer

Skills and hooks exist but there's no way to package and distribute them:

```
src/plugins/
  ├── loader.ts          # Load plugins from directories
  ├── manifest.ts        # Parse plugin.json
  ├── namespace.ts       # Skill namespacing
  └── marketplace.ts     # Install from remote sources
```

### 4. No Monitoring/Telemetry Layer

Only audit logging exists. No structured telemetry for org-level monitoring:

```
src/telemetry/
  ├── otel-exporter.ts   # OpenTelemetry metrics + events
  ├── metrics.ts         # Counter definitions
  ├── events.ts          # Event schemas
  └── config.ts          # OTEL env var configuration
```

### 5. No Extended Thinking / Effort Control

The plan has `temperature` and `maxTokens` but no concept of thinking budgets, effort levels, or thinking mode toggles. These are critical for reasoning-heavy coding tasks.

---

## Sources

- [Claude Code Documentation Index](https://code.claude.com/docs/llms.txt)
- [Claude Code Features Overview](https://code.claude.com/docs/en/features-overview.md)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference.md)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks.md)
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp.md)
- [Claude Code Permissions](https://code.claude.com/docs/en/permissions.md)
- [Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing.md)
- [Claude Code Skills](https://code.claude.com/docs/en/skills.md)
- [Claude Code Monitoring](https://code.claude.com/docs/en/monitoring-usage.md)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams.md)
- [Claude Code Analytics](https://code.claude.com/docs/en/analytics.md)
- [Claude Code Costs](https://code.claude.com/docs/en/costs.md)
- [Claude Code Checkpointing](https://code.claude.com/docs/en/checkpointing.md)
- [Claude Code Interactive Mode](https://code.claude.com/docs/en/interactive-mode.md)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins.md)
- [Claude Code Devcontainer](https://code.claude.com/docs/en/devcontainer.md)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions.md)
- [Claude Code Headless/SDK](https://code.claude.com/docs/en/headless.md)
- [Claude Code Terminal Config](https://code.claude.com/docs/en/terminal-config.md)
- [Claude Code Changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [Claude Code 2025 Summary](https://medium.com/@joe.njenga/claude-code-2025-summary-from-launch-to-beast-timeline-features-full-breakdown-45e5f3d8d5ff)
- [Claude Code vs Cursor](https://www.builder.io/blog/cursor-vs-claude-code)
- [Aider vs Cursor vs Claude Code](https://www.morphllm.com/comparisons/morph-vs-aider-diff)
- [Aider Repository Map](https://aider.chat/docs/repomap.html)
- [Aider Voice Input](https://aider.chat/docs/usage/voice.html)
- [Cursor IDE Features](https://techjacksolutions.com/ai/ai-development/cursor-ide-what-it-is/)
- [Windsurf Cascade](https://docs.codeium.com/windsurf/cascade)
- [Continue.dev Customization](https://docs.continue.dev/customize/overview)
- [GitHub Copilot CLI GA](https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/)
- [GitHub Copilot CLI Enhanced Agents](https://github.blog/changelog/2026-01-14-github-copilot-cli-enhanced-agents-context-management-and-new-ways-to-install/)
- [Claude Code Tips (45 tips)](https://github.com/ykdojo/claude-code-tips)
- [Best AI Coding Agents 2026](https://www.faros.ai/blog/best-ai-coding-agents-2026)
