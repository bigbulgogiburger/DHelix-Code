# dbcode

CLI AI coding assistant for local/external LLMs. Claude Code-level capabilities with any OpenAI-compatible API.

```
$ dbcode
   ____  ____   ____ ___  ____  _____
  |  _ \| __ ) / ___/ _ \|  _ \| ____|
  | | | |  _ \| |  | | | | | | |  _|
  | |_| | |_) | |__| |_| | |_| | |___
  |____/|____/ \____\___/|____/|_____|

  AI coding assistant for local/external LLMs
```

## Features

- **Multi-Provider LLM** — OpenAI, Anthropic, Azure OpenAI, or any OpenAI-compatible API (Ollama, LM Studio, vLLM, etc.)
- **16 Built-in Tools** — File read/write/edit, bash execution, glob/grep search, web fetch/search, Jupyter notebook editing, subagent spawning
- **ReAct Agent Loop** — Parallel tool execution with intelligent grouping and auto-checkpointing
- **3-Layer Context Compaction** — Micro (cold storage) → structured summary → rehydration at 83.5% usage
- **Interactive Terminal UI** — Ink/React-based CLI with markdown rendering, syntax highlighting, diff preview
- **Anti-Flicker Rendering** — Progressive static flushing + DEC Mode 2026 atomic frames
- **Extensible Skill System** — User-defined skills as markdown files, auto-loaded as slash commands
- **Permission System** — 5 modes from strict confirmation to full bypass
- **MCP Integration** — Model Context Protocol support for external tool servers
- **Persistent Sessions** — Save, resume, and fork conversations
- **Headless Mode** — Non-interactive execution with `--print` for CI/scripting
- **Cross-Platform** — Windows + macOS

## Quick Start

### Prerequisites

- **Node.js 20+**
- **An LLM API key** (OpenAI, Azure, Anthropic, or any compatible provider)

### Install

```bash
# From source
git clone https://github.com/bigbulgogiburger/dbcode.git
cd dbcode
npm install
npm run build
npm link    # makes 'dbcode' available globally

# Or run directly
node bin/dbcode.mjs
```

### First Run

```bash
dbcode
```

On first launch, the **setup wizard** guides you through:
1. Selecting your LLM provider (OpenAI / Azure / Custom)
2. Entering your API base URL and API key
3. Choosing a default model

Configuration is saved to `~/.dbcode/config.json`.

### Environment Variables

You can also configure via environment variables:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.openai.com/v1"   # optional
export OPENAI_MODEL="gpt-4o"                          # optional

# Or dbcode-specific overrides
export DBCODE_API_KEY="sk-..."
export DBCODE_BASE_URL="https://your-endpoint.com/v1"
export DBCODE_MODEL="your-model"
```

## Usage

### Interactive Mode

```bash
dbcode                          # Start interactive session
dbcode -m gpt-4o                # Use specific model
dbcode -u http://localhost:11434/v1  # Use local Ollama
dbcode -c                       # Continue last session
dbcode -r <session-id>          # Resume specific session
dbcode --add-dir ../other-repo  # Include additional directories
```

### Headless Mode

```bash
dbcode -p "Explain this codebase"              # Print result and exit
dbcode -p "List all TODO comments" --output-format json   # JSON output
```

### CLI Options

| Flag | Description |
|------|-------------|
| `-m, --model <model>` | LLM model name |
| `-u, --base-url <url>` | OpenAI-compatible API base URL |
| `-k, --api-key <key>` | API key |
| `-v, --verbose` | Enable verbose logging |
| `-c, --continue` | Continue the most recent session |
| `-r, --resume <id>` | Resume a specific session by ID |
| `-p, --print <prompt>` | Headless mode: run prompt and print result |
| `--output-format <fmt>` | Headless output: `text`, `json`, `stream-json` |
| `--add-dir <dirs...>` | Additional directories for monorepo support |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Cancel current agent loop |
| `Shift+Tab` | Cycle permission modes |
| `Ctrl+O` | Toggle verbose mode (show full tool output) |
| `Ctrl+D` | Exit |
| `Alt+T` | Toggle extended thinking |

Customize in `~/.dbcode/keybindings.json`.

## Slash Commands

Type `/` in the interactive prompt to see all available commands.

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model` | Switch LLM model |
| `/commit` | AI-assisted git commit with conventional message |
| `/review` | Code review on current diff |
| `/compact` | Force context compaction |
| `/clear` | Clear conversation |
| `/undo` | Undo last file change |
| `/rewind` | Rewind to a previous checkpoint |
| `/diff` | Show pending changes |
| `/cost` | Show token usage and cost |
| `/stats` | Session statistics |
| `/config` | View/edit configuration |
| `/permissions` | Manage permission rules |
| `/memory` | Manage persistent memory |
| `/init` | Initialize DBCODE.md in project |
| `/export` | Export conversation |
| `/resume` | Resume a previous session |
| `/plan` | Enter plan mode |
| `/mcp` | MCP server management |
| `/doctor` | Diagnose configuration issues |

## Built-in Tools

The AI agent has access to these tools during conversations:

| Tool | Permission | Description |
|------|-----------|-------------|
| `file_read` | safe | Read files (supports images, PDFs, Jupyter notebooks) |
| `file_write` | confirm | Create or overwrite files |
| `file_edit` | confirm | Search/replace with diff preview |
| `bash_exec` | confirm | Shell command execution (120s timeout) |
| `glob_search` | safe | File pattern matching |
| `grep_search` | safe | Regex content search (ripgrep-powered, JS fallback) |
| `list_dir` | safe | Directory listing with metadata |
| `web_fetch` | confirm | HTTP fetch with 15-min cache |
| `web_search` | confirm | Web search (Brave + DuckDuckGo) |
| `notebook_edit` | confirm | Jupyter notebook cell editing |
| `agent` | confirm | Spawn subagents (explore/plan/general) |
| `todo_write` | safe | Task tracking |

**Permission levels:**
- `safe` — Runs without confirmation (read-only operations)
- `confirm` — Requires user approval (can be auto-approved based on permission mode)

## Project Configuration

### DBCODE.md

Create a `DBCODE.md` file at your project root to give the AI context about your codebase:

```bash
dbcode init    # Creates DBCODE.md + .dbcode/ directory
```

Or create manually:

```markdown
# DBCODE.md

## Project Overview
- Runtime: Node.js 20 / TypeScript
- Test: Jest
- Build: webpack

## Coding Conventions
- Use named exports only
- Prefer functional components
```

### Instruction Hierarchy (lowest to highest priority)

1. `~/.dbcode/DBCODE.md` — Global user instructions
2. `~/.dbcode/rules/*.md` — Global rules
3. Parent directory `DBCODE.md` files (walking up from cwd)
4. Project root `DBCODE.md`
5. `.dbcode/rules/*.md` — Project-level rules
6. `DBCODE.local.md` — Local overrides (add to `.gitignore`)

### Permission Modes

Cycle with `Shift+Tab` during a session:

| Mode | Behavior |
|------|----------|
| `default` | Confirm dangerous operations |
| `acceptEdits` | Auto-approve file edits, confirm bash |
| `plan` | Read-only — AI proposes changes, you approve |
| `dontAsk` | Auto-approve everything except dangerous ops |
| `bypassPermissions` | Auto-approve all operations |

## Skills System

Skills are markdown files that extend dbcode with custom workflows. They're loaded from:

```
.dbcode/commands/    # Project commands (shared via git)
.dbcode/skills/      # Project skills (shared via git)
~/.dbcode/commands/  # Global user commands
~/.dbcode/skills/    # Global user skills
```

### Creating a Skill

Create `.dbcode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Does something useful when user asks for X
argument-hint: "[file path]"
---

## Instructions

When the user invokes this skill, do the following:

1. Read the file at $ARGUMENTS
2. Analyze it for patterns
3. Report findings
```

The skill becomes available as `/my-skill` slash command.

### Frontmatter Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Skill identifier |
| `description` | string | required | When to trigger + what it does |
| `argument-hint` | string | — | Usage hint shown in help |
| `user-invocable` | boolean | `true` | Available as `/name` command |
| `disable-model-invocation` | boolean | `false` | Prevent AI from auto-invoking |
| `context` | `inline` / `fork` | `inline` | Execution context |
| `agent` | `explore` / `plan` / `general` | — | Subagent type (when `context: fork`) |
| `allowed-tools` | array | — | Tool whitelist for this skill |

### Built-in Skills

| Skill | Description |
|-------|-------------|
| `sprint-execution` | Parallel team orchestration from improvement plans |
| `dbcode-e2e-test` | End-to-end testing framework |
| `verify-implementation` | Run all verification skills |
| `verify-model-capabilities` | Validate model capability sync |
| `verify-tool-metadata-pipeline` | Validate tool metadata flow |

## Architecture

```
CLI (Ink/React)  →  Core  →  LLM / Tools / Permissions / Hooks  →  Utils
```

Strict unidirectional dependencies — circular imports are forbidden.

```
src/
├── index.ts              # CLI bootstrap (Commander + Ink)
├── cli/                  # Terminal UI (Ink components + React hooks)
├── core/                 # Agent loop, context/session/checkpoint managers
├── llm/                  # LLM clients (OpenAI-compatible + Anthropic)
├── tools/                # 16 built-in tools with permission system
├── commands/             # 34 slash commands
├── skills/               # Skill loader, executor, command bridge
├── config/               # 5-level hierarchical config (Zod schema)
├── permissions/          # Permission manager with 5 modes
├── instructions/         # DBCODE.md loader with 6-layer merge
├── guardrails/           # Security (secret scanning, I/O filtering)
├── hooks/                # Pre/post tool-use hooks
├── subagents/            # Agent spawning with worktree isolation
├── mcp/                  # Model Context Protocol integration
├── auth/                 # Token-based auth
└── utils/                # Logger (pino), events (mitt), error, path
```

### Key Design Decisions

- **ESM only** — No CommonJS, `.js` extensions in all imports
- **Immutable state** — `readonly` properties, spread copy for mutations
- **Zod schemas** — All external inputs validated (config, tool params, API responses)
- **AbortController** — All cancellable operations use AbortSignal
- **No `any`** — Use `unknown` + type guards everywhere

## Development

### Setup

```bash
git clone https://github.com/bigbulgogiburger/dbcode.git
cd dbcode
npm install
```

### Common Commands

```bash
npm run dev            # Watch mode (auto-rebuild on changes)
npm run build          # Production build (tsup)
npm run typecheck      # TypeScript strict check
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Run all tests (Vitest)
npm run test:watch     # Test watch mode
npm run test:coverage  # Coverage report
npm run ci             # Full pipeline: typecheck → lint → test:coverage → build
```

### Running Locally

```bash
npm run build
node bin/dbcode.mjs                    # Run from source
node bin/dbcode.mjs -p "Hello"         # Headless test
```

### Testing

Tests use **Vitest** with comprehensive mocking — no real LLM calls are made during testing.

```bash
npm test                                    # All tests
npx vitest run test/unit/llm/              # Specific directory
npx vitest run test/unit/tools/            # Tool tests only
npx vitest run --coverage                  # With coverage report
```

**Test structure:**
```
test/
├── unit/          # Unit tests (fast, isolated)
│   ├── cli/       # Component + renderer tests
│   ├── core/      # Agent loop, context manager tests
│   ├── llm/       # LLM client tests
│   ├── tools/     # Tool definition tests
│   ├── commands/  # Slash command tests
│   ├── config/    # Config loader/schema tests
│   └── utils/     # Utility tests
├── integration/   # Cross-module tests
└── e2e/           # End-to-end CLI tests
```

### Commit Convention

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Architecture Validation

```bash
npx madge --circular src/    # Check for circular dependencies (must be clean)
```

## File Locations

### Global (per-user)

| Path | Purpose |
|------|---------|
| `~/.dbcode/config.json` | User configuration |
| `~/.dbcode/debug.log` | Debug log |
| `~/.dbcode/sessions/` | Saved sessions |
| `~/.dbcode/input-history.json` | Input history (500 entries, persists across sessions) |
| `~/.dbcode/keybindings.json` | Custom keyboard shortcuts |
| `~/.dbcode/memory/` | Persistent memory |
| `~/.dbcode/DBCODE.md` | Global instructions |
| `~/.dbcode/rules/*.md` | Global rules |
| `~/.dbcode/skills/` | Global skills |

### Project (per-repo)

| Path | Purpose |
|------|---------|
| `DBCODE.md` | Project instructions |
| `DBCODE.local.md` | Local overrides (gitignored) |
| `.dbcode/` | Project config directory |
| `.dbcode/rules/*.md` | Project-specific rules |
| `.dbcode/skills/` | Project skills |
| `.dbcode/memory/` | Project memory |

## Supported LLM Providers

| Provider | Base URL | Notes |
|----------|----------|-------|
| **OpenAI** | `https://api.openai.com/v1` | Default provider |
| **Azure OpenAI** | `https://{resource}.openai.azure.com/openai?api-version=...` | Supports Responses API for codex models |
| **Anthropic** | via proxy | Extended thinking support for Claude models |
| **Ollama** | `http://localhost:11434/v1` | Local models |
| **LM Studio** | `http://localhost:1234/v1` | Local models |
| **vLLM** | `http://localhost:8000/v1` | Self-hosted inference |
| **Any OpenAI-compatible** | Custom URL | Works with any compatible endpoint |

## License

MIT
