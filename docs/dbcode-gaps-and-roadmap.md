# dbcode vs Claude Code: Gap Analysis & Improvement Roadmap

> Date: 2026-03-08 (Updated)
> Author: Claude Opus 4.6 (Anthropic Claude Code Expert Review)
> dbcode version: 0.1.0 (145 source files, ~13,000 LOC)
> Claude Code reference: v2.1.71 (latest stable, March 2026)

---

## Executive Summary

dbcode has a solid foundation — ReAct agent loop, 12 tools, multi-turn conversation, Ink-based UI, hooks system. However, compared to Claude Code v2.1.71 (18 tools, 110+ system prompt components, 18 hook events, 6 built-in subagents, skills ecosystem with 334+ community skills), there are significant gaps across **tool system, context management, agent capabilities, and developer experience**. This document provides a detailed gap analysis with concrete implementation recommendations.

---

## 1. Tool System (Critical)

### 1.1 Tool Inventory Comparison

Claude Code: **18 built-in tools** / dbcode: **12 tools**

| #   | Tool             | Claude Code                                                                                             | dbcode                              | Gap          |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------ |
| 1   | Read             | `file_path`, `offset`, `limit`, `pages` (PDF, max 20pp). 2000 char line truncation                      | file_read (implemented)             | Parity       |
| 2   | Write            | `file_path`, `content`. Must Read first if exists                                                       | file_write (implemented)            | Parity       |
| 3   | Edit             | `file_path`, `old_string`, `new_string`, `replace_all`. Fails if old_string not unique                  | file_edit (implemented)             | Parity       |
| 4   | **MultiEdit**    | Multiple edits to single file in one call                                                               | Missing                             | **Medium**   |
| 5   | Bash             | `command`, `description`, `timeout` (max 600s), `run_in_background`                                     | bash_exec (implemented)             | Parity       |
| 6   | Glob             | `pattern`, `path`                                                                                       | glob_search (implemented)           | Parity       |
| 7   | Grep             | `pattern`, `path`, `glob`, `type`, `output_mode`, `-A/-B/-C/-i/-n`, `multiline`, `head_limit`, `offset` | grep_search (basic)                 | Minor        |
| 8   | **Agent**        | `prompt`, `description`, `subagent_type`, `model`, `run_in_background`, `isolation`, `resume`           | spawner.ts exists but not a tool    | **Critical** |
| 9   | **TodoWrite**    | `todos[]` with `content`, `status` (pending/in_progress/completed). Exactly ONE must be in_progress     | Missing                             | **High**     |
| 10  | **WebFetch**     | `url`, `prompt`. 15-min cache, auto HTTP→HTTPS                                                          | Missing                             | **High**     |
| 11  | **WebSearch**    | `query`, `allowed_domains`, `blocked_domains`                                                           | web_search (Brave API, no fallback) | Partial      |
| 12  | **NotebookEdit** | `notebook_path`, `new_source`, `cell_id`, `cell_type`, `edit_mode`                                      | Missing                             | Medium       |
| 13  | **BashOutput**   | `bash_id`, `filter`. Returns only new output since last check                                           | Missing                             | Medium       |
| 14  | **KillShell**    | `shell_id`                                                                                              | Missing                             | Low          |
| 15  | **LS**           | Directory listing                                                                                       | Missing (via bash_exec)             | Low          |
| 16  | **ExitPlanMode** | `plan`                                                                                                  | Missing                             | Low          |
| 17  | **SlashCommand** | `command`                                                                                               | Missing (commands via registry)     | Low          |
| 18  | NotebookRead     | Jupyter notebook reading                                                                                | file_read handles .ipynb            | Parity       |

### 1.2 Tool Behavior Gaps

| Tool        | Claude Code Behavior                                                       | dbcode Gap                    |
| ----------- | -------------------------------------------------------------------------- | ----------------------------- |
| Bash        | Output truncated > 30,000 chars, `run_in_background` returns task ID       | No background task management |
| Read        | Line truncation at 2000 chars, image/PDF support                           | Image untested in prod        |
| Edit        | `replace_all` for bulk replacement                                         | Missing `replace_all` flag    |
| Grep        | `multiline` mode for cross-line patterns, `head_limit`/`offset` pagination | Basic grep only               |
| glob_search | .gitignore respect                                                         | No .gitignore awareness       |

### 1.3 Parallel Tool Execution

| Feature             | Claude Code                           | dbcode                         | Gap    |
| ------------------- | ------------------------------------- | ------------------------------ | ------ |
| Dependency analysis | Smart grouping by file path conflicts | `groupToolCalls()` implemented | Parity |
| Promise.allSettled  | Yes                                   | Yes                            | Parity |
| Result ordering     | Preserved                             | Preserved                      | Parity |
| Timeout per tool    | Tool-specific                         | Global + tool-specific         | Parity |

---

## 2. Context Management (Critical)

### 2.1 Three-Layer Compaction Architecture (Claude Code)

Claude Code uses a **3-layer** context management system:

**Layer 1 — Microcompaction (continuous)**

- Bulky tool outputs (Read, Bash, Grep, Glob, WebSearch, WebFetch, Edit, Write) are saved to disk with path references
- A "hot tail" of recent tool results stays inline; older results become "cold storage"
- Retrievable by path on demand

**Layer 2 — Auto-compaction (threshold-based)**

- Triggers when free space drops below reserved threshold (~83.5% by default, not 95%)
- Context buffer: ~33,000 tokens (16.5% of window)
- Overridable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` env var
- Structured summarization contract requires: user intent, key technical decisions, files touched, errors + resolutions, pending tasks, next steps

**Layer 3 — Post-compaction rehydration**

- Re-reads 5 most recently accessed files
- Restores todo list state, plan state, hook outputs
- Boundary marker denotes the compaction point

**`PreCompact` hook**: Fires before compaction with matcher for `manual` vs `auto` trigger (observability only)

### 2.2 dbcode Current State

| Feature                     | Claude Code                           | dbcode                        | Gap          |
| --------------------------- | ------------------------------------- | ----------------------------- | ------------ |
| Microcompaction             | Continuous, disk-backed cold storage  | None                          | **Critical** |
| Auto-compaction trigger     | ~83.5% context (overridable)          | 95% threshold (too late)      | **Major**    |
| Compaction strategy         | Structured summary with checklist     | Simple token-based truncation | **Major**    |
| Post-compaction rehydration | Re-reads recent files, restores state | None                          | **Major**    |
| `/compact` command          | Interactive with custom instructions  | Exists but basic              | Minor        |
| Token counting              | Accurate (tiktoken)                   | tiktoken + LRU cache          | Parity       |
| Context % warning           | Persistent status bar warning         | StatusBar shows %             | Parity       |

---

## 3. System Prompt Architecture (Major)

### 3.1 Claude Code's Dynamic Assembly

Claude Code assembles the system prompt from **110+ conditional strings** totaling ~85,000+ tokens:

- **26 Agent Prompts**: Explore (517 tks), Plan Enhanced (685 tks), Agent Creation Architect (1,110 tks), Security Review (2,607 tks), Conversation Summarization (956 tks), Security Monitor Parts 1+2 (~5,000 tks)
- **22 Data/Reference Prompts**: SDK patterns for Python/TypeScript, Claude API references in 8 languages
- **75+ System Prompt Core**: Tool usage policies (11 components), Learning Mode (1,042 tks), Plan Mode Active 5-phase (1,437 tks), Session Memory (756 tks)
- **40+ System Reminders**: Mid-conversation contextual notifications (18-1,437 tks each)

Assembly is conditional based on: environment variables, feature flags, user configuration, session state, available subagents, and A/B tests.

### 3.2 dbcode Current State

| Feature                    | Claude Code                             | dbcode                        | Gap       |
| -------------------------- | --------------------------------------- | ----------------------------- | --------- |
| Dynamic assembly           | 110+ conditional strings                | `buildSystemPrompt()` (basic) | **Major** |
| Conditional injection      | Feature flags, session state, A/B tests | Static template               | Major     |
| Mid-conversation reminders | 40+ contextual system reminders         | None                          | Major     |
| Agent-specific prompts     | 26 specialized agent prompts            | None                          | Major     |
| SDK/API references         | 8 language references loaded on demand  | None                          | Medium    |

---

## 4. Agent & Sub-Agent System (Critical)

### 4.1 Claude Code's Agent Architecture

**6 Built-in subagent types:**

| Agent             | Model        | Tools     | Purpose                                               |
| ----------------- | ------------ | --------- | ----------------------------------------------------- |
| Explore           | Haiku (fast) | Read-only | File discovery, code search. 3 thoroughness levels    |
| Plan              | Inherits     | Read-only | Research during plan mode. Cannot spawn sub-subagents |
| General-purpose   | Inherits     | All tools | Complex multi-step tasks                              |
| Bash              | Inherits     | Bash only | Terminal commands in separate context                 |
| statusline-setup  | Sonnet       | -         | Status line configuration                             |
| Claude Code Guide | Haiku        | -         | Self-help about Claude Code                           |

**Custom subagent schema** (YAML frontmatter):

- `name`, `description`, `tools`, `disallowedTools`, `model` (sonnet/opus/haiku/inherit)
- `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`
- `memory` (user/project/local), `background`, `isolation` (worktree)

**Key constraint**: Subagents cannot spawn other subagents.

### 4.2 Agent Teams (Feb 2026, Experimental)

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` to enable
- 2-16 agents working on shared codebases
- One session as **team lead**, others as teammates
- **Peer-to-peer messaging** via mailbox system (`SendMessage` tool)
- Each teammate has own context window

### 4.3 dbcode Gap Analysis

| Feature            | Claude Code                                     | dbcode                                           | Gap          |
| ------------------ | ----------------------------------------------- | ------------------------------------------------ | ------------ |
| Agent tool         | First-class tool (renamed from Task in v2.1.63) | spawner.ts (407 lines) but not a tool            | **Critical** |
| Built-in agents    | 6 types with model/tool specialization          | 3 stubs (explore, general, plan, ~38 lines each) | **Critical** |
| Custom agents      | YAML frontmatter schema with 12+ fields         | Not implemented                                  | Major        |
| Worktree isolation | Git worktree per agent                          | Planned in spawner                               | Partial      |
| Background agents  | `run_in_background` param, task notifications   | Not wired                                        | Major        |
| Agent teams        | 2-16 agents, SendMessage, team lead             | Not implemented                                  | Future       |
| Resume/continue    | Resume agent by ID                              | Not implemented                                  | Medium       |
| Agent display      | Collapsible transcript in UI (Ctrl+O toggle)    | No UI rendering                                  | Major        |

---

## 5. Terminal Rendering (Major)

### 5.1 Cell-Level Differential Renderer

| Aspect              | Claude Code                                              | dbcode                            | Gap    |
| ------------------- | -------------------------------------------------------- | --------------------------------- | ------ |
| Rendering engine    | Custom cell-level diff renderer (~85% flicker reduction) | Ink + Progressive Static Flushing | Major  |
| Buffer strategy     | Double-buffered packed TypedArrays                       | None (Ink manages)                | Major  |
| Frame budget        | ~5ms scene-graph → ANSI                                  | Uncontrolled                      | Major  |
| Synchronized output | DEC Mode 2026 (pushed upstream to VSCode, tmux)          | Implemented                       | Parity |
| Layout engine       | Yoga WASM (retained)                                     | Yoga via Ink (same)               | Parity |

### 5.2 Output Formatting

| Feature                     | Claude Code                                 | dbcode                 | Gap          |
| --------------------------- | ------------------------------------------- | ---------------------- | ------------ |
| Tool progress indicators    | "Reading..." → "Read" with tense switching  | Static `[✓]` with text | UX           |
| Customizable thinking verbs | "Pondering", "Befuddling", etc. via tweakcc | Fixed text             | Nice-to-have |
| Spinner phases              | Multi-phase with speed settings             | Single phase, 500ms    | Minor        |
| Turn duration               | "Cooked for 1m 6s" (hideable via setting)   | Not shown              | Minor        |
| Verbose toggle              | Ctrl+O shows full subagent transcripts      | Not implemented        | Medium       |
| Diff display                | Inline colored diff with context            | Basic `+/-` lines      | Minor        |
| OSC 8 hyperlinks            | File paths are clickable                    | Plain text             | Nice-to-have |

---

## 6. Skills System (Major)

### 6.1 Claude Code's Progressive Disclosure

Skills use **3-level loading**:

1. **YAML frontmatter** (always loaded): name + description (~tiny token cost)
2. **SKILL.md body** (loaded when relevant): full instructions
3. **Linked files** (on demand): supporting scripts, references, assets

**Token budget**: 2% of context window (dynamically scaled), fallback 16,000 chars. Override via `SLASH_COMMAND_TOOL_CHAR_BUDGET`.

**Frontmatter fields**: `name`, `description`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `context` (fork), `agent`, `hooks`

**String substitutions**: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}`

**Bundled skills** (ship with Claude Code): `/simplify` (3 parallel review agents), `/batch` (parallel changes in worktrees), `/debug`, `/loop` (recurring prompts), `/claude-api`

**Community ecosystem**: 334+ community skills as of March 2026.

### 6.2 Custom Commands → Skills Migration

Claude Code merged custom commands into skills. Files in `.claude/commands/` still work but skills in `.claude/skills/` are recommended.

- **Project-scoped**: `.claude/commands/name.md` or `.claude/skills/name/SKILL.md`
- **User-scoped**: `~/.claude/commands/name.md` or `~/.claude/skills/name/SKILL.md`
- Filename → `/name` slash command
- `!`command`` syntax for shell command preprocessing
- `@` for file references

### 6.3 dbcode Gap

| Feature              | Claude Code                                | dbcode                  | Gap          |
| -------------------- | ------------------------------------------ | ----------------------- | ------------ |
| Skill loading        | Progressive 3-level disclosure             | loader.ts (178 lines)   | Partial      |
| SKILL.md parsing     | Full frontmatter schema (12+ fields)       | types.ts (basic)        | Major        |
| Skill triggering     | Description-based, 2% context budget       | Not wired to agent loop | **Critical** |
| Bundled skills       | 5 built-in skills                          | None                    | Major        |
| Community skills     | 334+ published                             | None                    | Future       |
| Custom commands      | Merged into skills system                  | Missing entirely        | **Critical** |
| String substitutions | `$ARGUMENTS`, `$N`, `${CLAUDE_SESSION_ID}` | Not implemented         | Major        |
| Bundled resources    | scripts/, references/, assets/             | Not implemented         | Medium       |

---

## 7. Hooks System (Medium)

### 7.1 Lifecycle Events (Full List)

Claude Code: **18 lifecycle events** / dbcode: **~6 events**

| #   | Event                | Fires When                 | Can Block?            | dbcode          |
| --- | -------------------- | -------------------------- | --------------------- | --------------- |
| 1   | `SessionStart`       | Session begins/resumes     | No                    | Partial         |
| 2   | `InstructionsLoaded` | CLAUDE.md loaded           | No                    | Missing         |
| 3   | `UserPromptSubmit`   | User submits prompt        | Yes                   | **Implemented** |
| 4   | `PreToolUse`         | Before tool executes       | Yes (+ modify inputs) | Block only      |
| 5   | `PermissionRequest`  | Permission dialog appears  | Yes                   | Missing         |
| 6   | `PostToolUse`        | After tool succeeds        | No                    | **Implemented** |
| 7   | `PostToolUseFailure` | After tool fails           | No                    | Missing         |
| 8   | `SubagentStart`      | Subagent spawned           | No                    | Missing         |
| 9   | `SubagentStop`       | Subagent finishes          | Yes                   | Missing         |
| 10  | `Stop`               | Claude finishes responding | Yes                   | **Implemented** |
| 11  | `TeammateIdle`       | Agent team teammate idle   | Yes                   | Missing         |
| 12  | `TaskCompleted`      | Task marked completed      | Yes                   | Missing         |
| 13  | `ConfigChange`       | Config file changes        | Yes                   | Missing         |
| 14  | `WorktreeCreate`     | Worktree being created     | Yes                   | Missing         |
| 15  | `WorktreeRemove`     | Worktree being removed     | No                    | Missing         |
| 16  | `PreCompact`         | Before context compaction  | No                    | Missing         |
| 17  | `Notification`       | Notification sent          | No                    | Missing         |
| 18  | `SessionEnd`         | Session terminates         | No                    | Missing         |

### 7.2 Handler Types

Claude Code supports **4 handler types**:

| Type      | Description                                                    | dbcode          |
| --------- | -------------------------------------------------------------- | --------------- |
| `command` | Shell command execution, supports `async: true` for background | **Implemented** |
| `http`    | POST JSON to URL, `allowedEnvVars` for header interpolation    | Missing         |
| `prompt`  | LLM prompt evaluation                                          | Missing         |
| `agent`   | Subagent execution                                             | Missing         |

All handlers support `timeout` and `statusMessage`. HTTP hooks require 2xx + `decision: "block"` to block.

**Decision control**: `PreToolUse` uses `hookSpecificOutput.permissionDecision` (allow/deny/ask) + `updatedInput` for input modification.

**Environment variables**: `$CLAUDE_PROJECT_DIR`, `$CLAUDE_PLUGIN_ROOT`, `$CLAUDE_ENV_FILE`, `$CLAUDE_CODE_REMOTE`

### 7.3 Security Note

Two CVEs found in Claude Code hooks: CVE-2025-59536, CVE-2026-21852 — hooks exploitable via malicious project configs. dbcode should learn from these vulnerabilities.

---

## 8. Checkpointing & Rewind (Major — Missing)

| Feature              | Claude Code                                     | dbcode                       | Gap       |
| -------------------- | ----------------------------------------------- | ---------------------------- | --------- |
| File change tracking | Tracks all Write/Edit/NotebookEdit changes      | checkpoint-manager.ts exists | Partial   |
| `/rewind` command    | Browse and revert to any checkpoint             | Command stub only            | **Major** |
| Esc+Esc menu         | Visual checkpoint browser                       | Not implemented              | Major     |
| Scope                | Only Write/Edit/NotebookEdit (not Bash changes) | —                            | —         |

---

## 9. Keyboard Shortcuts & Input (Medium)

### 9.1 Claude Code Shortcuts

| Shortcut         | Action                           | dbcode          |
| ---------------- | -------------------------------- | --------------- |
| Ctrl+C           | Cancel current operation         | Implemented     |
| Ctrl+D           | Exit                             | Not implemented |
| Esc              | Stop current action              | Not implemented |
| Esc+Esc          | Browse history / rewind menu     | Not implemented |
| Shift+Enter      | New line (instead of send)       | Not implemented |
| Shift+Tab        | Cycle permission modes (4 modes) | Not implemented |
| Option+T / Alt+T | Toggle extended thinking         | Not implemented |
| Ctrl+O           | Toggle verbose/expanded view     | Not implemented |
| Ctrl+A / Ctrl+E  | Start/end of line                | Ink default     |
| Tab (after @)    | Autocomplete file paths          | Not implemented |

Fully customizable via `~/.claude/keybindings.json` and `/keybindings` command.

### 9.2 @ File Mentions

Type `@` + path to include file content in context, with Tab autocomplete. dbcode has no equivalent.

---

## 10. Voice Mode (Future — Nice-to-have)

Released March 2026:

- `/voice` command activation
- Push-to-talk: hold spacebar to speak, release to send
- 20 languages supported
- `voice:pushToTalk` keybinding rebindable
- No extra cost for Pro/Max/Team/Enterprise

Not a priority for dbcode but worth tracking.

---

## 11. IDE Integration (Medium)

| Feature           | Claude Code                                 | dbcode          | Gap    |
| ----------------- | ------------------------------------------- | --------------- | ------ |
| VS Code extension | Native diff viewer, session management      | Not implemented | Medium |
| JetBrains plugin  | IDE diff viewer integration                 | Not implemented | Medium |
| GitHub Actions    | `claude-code-action`, @claude in PRs/issues | Not implemented | Medium |
| Diff viewing      | 2 modes: column (side-by-side) + unified    | Terminal only   | Minor  |

---

## 12. Permission System (Minor gaps)

| Feature                | Claude Code                                             | dbcode                         | Gap    |
| ---------------------- | ------------------------------------------------------- | ------------------------------ | ------ |
| Permission modes       | 4 modes cycled with Shift+Tab                           | 5 modes defined, manager works | Parity |
| Session store          | Remember per-session approvals (NOT restored on resume) | session-store.ts exists        | Parity |
| Tool-specific rules    | Glob patterns, deny > ask > allow priority              | rules.ts exists                | Parity |
| Permission prompt      | Interactive Y/N/always, diff preview for edits          | PermissionPrompt component     | Parity |
| `/permissions` command | List all rules and source files                         | Missing                        | Minor  |

---

## 13. Session Management (Minor gaps)

| Feature          | Claude Code                 | dbcode          | Gap    |
| ---------------- | --------------------------- | --------------- | ------ |
| Create session   | Auto-create on start        | Implemented     | Parity |
| `--continue`     | Resume most recent          | Implemented     | Parity |
| `--resume <id>`  | Resume specific session     | Implemented     | Parity |
| `--fork-session` | Copy history, diverge       | `/fork` exists  | Parity |
| `/export`        | Export to file or clipboard | Implemented     | Parity |
| Session search   | Search across sessions      | Not implemented | Medium |

---

## 14. Instructions System (Medium gaps)

| Feature             | Claude Code                                      | dbcode              | Gap    |
| ------------------- | ------------------------------------------------ | ------------------- | ------ |
| CLAUDE.md loading   | Project root + parents + .claude/                | loader.ts (partial) | Minor  |
| User-level rules    | `~/.claude/rules/`                               | Not scanned         | Medium |
| Project-level rules | `.claude/rules/`                                 | Not scanned         | Medium |
| `claudeMdExcludes`  | User/project/local/managed policy layers         | Not implemented     | Medium |
| Hierarchical merge  | Global → project → local                         | Not implemented     | Medium |
| Auto-memory         | Claude saves notes across sessions automatically | Not implemented     | Major  |
| `/memory` command   | Edit CLAUDE.md memory files                      | Missing             | Medium |

---

## 15. Slash Commands (Medium)

### 15.1 dbcode Implemented (27 commands)

`/clear`, `/compact`, `/help`, `/model`, `/resume`, `/rewind`, `/effort`, `/fast`, `/simplify`, `/batch`, `/debug`, `/mcp`, `/config`, `/diff`, `/doctor`, `/stats`, `/status`, `/context`, `/copy`, `/export`, `/fork`, `/output-style`, `/rename`, `/cost`, `/update`, `/init`, `/plan`, `/undo`

### 15.2 Missing vs Claude Code

| Command              | Claude Code                   | dbcode                     | Priority |
| -------------------- | ----------------------------- | -------------------------- | -------- |
| `/agents`            | Manage custom subagents       | Missing                    | High     |
| `/review`            | Review code changes           | Missing                    | High     |
| `/login` / `/logout` | API auth management           | Missing                    | Medium   |
| `/memory`            | View/edit project memory      | Missing                    | Medium   |
| `/permissions`       | View/manage tool permissions  | Missing                    | Medium   |
| `/statusline`        | Configure status line display | Missing                    | Low      |
| `/voice`             | Activate voice input          | Missing                    | Future   |
| `/keybindings`       | Open keybindings.json         | Missing                    | Low      |
| `/bashes`            | List background tasks         | Missing                    | Medium   |
| `/loop`              | Recurring prompt on interval  | Missing                    | Low      |
| `/add-dir`           | Add working directories       | CLI flag exists but unused | Partial  |

---

## 16. Security & Sandboxing (Medium gaps)

| Feature              | Claude Code                                                                             | dbcode                  | Gap                       |
| -------------------- | --------------------------------------------------------------------------------------- | ----------------------- | ------------------------- |
| macOS Seatbelt       | sandbox-exec profiles, `sandbox.filesystem.allowWrite/denyWrite`                        | seatbelt.ts (209 lines) | Implemented               |
| Linux bubblewrap     | Kernel-level isolation                                                                  | Not implemented         | Major (if Linux target)   |
| Windows AppContainer | Process isolation                                                                       | Not implemented         | Major (if Windows target) |
| Secret scanner       | gitleaks pre-commit hook, 160+ detectors (API keys, tokens, private keys, high-entropy) | 34 lines, minimal       | **Needs major expansion** |
| Security Monitor     | 2-part system prompt (2,482 + 2,460 tks) evaluating autonomous actions                  | Not implemented         | Major                     |
| Network isolation    | Unix domain socket to proxy, domain allowlisting                                        | Not implemented         | Medium                    |
| Sandbox config       | `sandbox.enabled`, filesystem/network/commands fine-tuning                              | Basic                   | Medium                    |
| Input guardrails     | Filter dangerous tool inputs                                                            | Implemented             | Parity                    |
| Output limits        | Bash output truncated > 30,000 chars                                                    | Basic                   | Minor                     |
| Command filter       | Block dangerous shell commands                                                          | Basic                   | Minor                     |

---

## 17. Config System (Medium gaps)

### 17.1 Claude Code's 5-Level Hierarchy

| Priority    | Level            | Source                                                    | dbcode          |
| ----------- | ---------------- | --------------------------------------------------------- | --------------- |
| 1 (highest) | Managed Settings | Server-managed, MDM, managed-settings.json, HKCU registry | Missing         |
| 2           | CLI flags        | `--model`, `--permission-mode`, etc.                      | **Implemented** |
| 3           | Local project    | `.claude/settings.local.json`                             | Missing         |
| 4           | Shared project   | `.claude/settings.json`                                   | **Implemented** |
| 5 (lowest)  | User settings    | `~/.claude/settings.json`                                 | **Implemented** |

Array settings merge across scopes (concatenated + deduplicated).

### 17.2 Managed-Only Settings (Enterprise)

Claude Code supports enterprise-managed settings that users cannot override: `allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, `allowManagedMcpServersOnly`, `disableBypassPermissionsMode`, `strictKnownMarketplaces`, `blockedMarketplaces`.

dbcode has no managed/enterprise settings tier.

### 17.3 Environment Variables

Claude Code documents **60+ environment variables**. dbcode supports ~5 (`DBCODE_MODEL`, `DBCODE_BASE_URL`, `DBCODE_API_KEY`, `OPENAI_API_KEY`, `DBCODE_VERBOSE`).

---

## 18. Plugins System (New — Missing)

Claude Code introduced a **plugins system** in 2026:

| Feature        | Claude Code                                   | dbcode          | Gap    |
| -------------- | --------------------------------------------- | --------------- | ------ |
| Package format | Skills + hooks + agents + MCP servers bundled | Not implemented | Future |
| Sources        | GitHub, git, npm, URL, file, directory        | Not implemented | Future |
| Marketplace    | Trust management, known marketplaces          | Not implemented | Future |
| Commands       | `/plugins`, `/reload-plugins`                 | Missing         | Future |

Not a priority for dbcode v1, but worth tracking for v2+.

---

## 19. Model & Cost (Updated)

### 17.1 Default Model Change

dbcode default model changed from `gpt-4o` to `gpt-4.1-mini`:

|                    | GPT-4o (previous) | GPT-4.1-mini (new)                     | Delta           |
| ------------------ | ----------------- | -------------------------------------- | --------------- |
| Input/1M           | $2.50             | $0.40                                  | **84% cheaper** |
| Output/1M          | $10.00            | $1.60                                  | **84% cheaper** |
| Context            | 128K              | 1M                                     | **8x larger**   |
| Max Output         | 16,384            | 32,768                                 | **2x larger**   |
| Coding (SWE-bench) | ~33%              | Higher (mini follows 4.1 improvements) | Better          |
| Tool calling       | Baseline          | 30% more efficient                     | Better          |
| Latency            | Baseline          | ~50% lower                             | Faster          |

### 17.2 Pricing Table (Complete)

| Model             | Input/1M  | Output/1M | Cached Input/1M |
| ----------------- | --------- | --------- | --------------- |
| gpt-4.1           | $2.00     | $8.00     | $0.50           |
| **gpt-4.1-mini**  | **$0.40** | **$1.60** | **$0.10**       |
| gpt-4.1-nano      | $0.10     | $0.40     | $0.025          |
| gpt-4o            | $2.50     | $10.00    | $1.25           |
| gpt-4o-mini       | $0.15     | $0.60     | $0.075          |
| claude-opus-4-6   | $15.00    | $75.00    | —               |
| claude-sonnet-4-6 | $3.00     | $15.00    | —               |

---

## 20. Priority Roadmap (Updated)

### P0 — Must Fix Now (Blocking real usage)

1. **Agent tool registration** — Sub-agents exist (spawner.ts, 407 lines) but aren't usable from the agent loop. This is the single biggest capability gap.
2. **Custom commands / Skills integration** — Wire skill triggering into agent loop + system prompt. Support `.md` files in `.dbcode/commands/`.
3. **Context compaction overhaul** — Implement microcompaction (disk-backed cold storage) + structured summarization. Lower threshold from 95% to ~83%.
4. **Intermediate assistant messages** — Every assistant message during agent loop should be an activity entry, not just the final one.

### P1 — High Priority (Major UX improvement)

5. **TodoWrite tool** — Simple task tracking (pending/in_progress/completed state machine)
6. **WebFetch tool** — URL fetching with caching (15-min), essential for documentation lookup
7. **Hierarchical instructions** — Scan `~/.dbcode/rules/` + `.dbcode/rules/`, implement merge hierarchy
8. **Keyboard shortcuts** — Esc (stop), Shift+Enter (newline), Shift+Tab (mode cycle), Ctrl+O (verbose)
9. **Dynamic system prompt** — Conditional assembly based on session state, features, tools
10. **Checkpointing / Rewind** — Track file changes, implement `/rewind` with checkpoint browser

### P2 — Medium Priority (Feature completeness)

11. **MultiEdit tool** — Batch edits to single file
12. **@ File mentions** — `@path` to include file content with Tab autocomplete
13. **Background task management** — `run_in_background`, BashOutput, KillShell tools
14. **Grep enhancements** — multiline mode, head_limit/offset pagination
15. **Auto-memory system** — Persist notes across sessions automatically
16. **Hook enhancements** — HTTP hooks, tool input modification, 18 lifecycle events
17. **Session search** — Find past conversations
18. **IDE integrations** — VS Code extension, JetBrains plugin

### P3 — Nice to Have (Polish)

19. **Cell-level differential renderer** — Major engineering effort, big impact (~85% flicker reduction)
20. **Output formatting overhaul** — Progress indicators, turn duration, thinking verbs
21. **Agent teams** — Multi-agent collaboration on shared codebases
22. **Voice mode** — Push-to-talk voice input
23. **OSC 8 clickable file paths**
24. **Vim keybinding mode**

---

## 21. Architecture Health Assessment

### Strengths

- Clean layer separation (CLI → Core → LLM/Tools → Utils)
- Immutable conversation state
- Proper event-driven architecture (mitt)
- Good tool abstraction with Zod validation
- Hooks system is production-ready
- Anti-flicker rendering (Progressive Static Flushing + DEC Mode 2026)
- Multi-model support with model router (GPT-4.1, Claude, Llama, DeepSeek, etc.)

### Weaknesses

- **Subagents/Skills are islands** — Code exists but not integrated into the agent loop
- **Context management is naive** — No microcompaction, no rehydration, late trigger threshold
- **System prompt is static** — No conditional assembly, no mid-conversation reminders
- **Activity tracking incomplete** — Only final assistant message tracked, not intermediate ones
- **No integration tests for multi-turn conversations**
- **Secret scanner is minimal** (34 lines)

### Technical Debt

- `conversation.toMessagesForLLM()` uses `tool_call_id` (snake_case) while `ChatMessage` uses `toolCallId` (camelCase)
- `ToolCall` type is duplicated between `message-types.ts` and `provider.ts`
- `--add-dir` CLI flag is parsed but never used
- Several stub files in subagents/ (explore.ts, general.ts, plan.ts are ~38 lines each)

---

## 22. Lines of Code Summary

| Module         | Files   | Lines       | Status         |
| -------------- | ------- | ----------- | -------------- |
| CLI components | 15      | ~1,800      | Active         |
| CLI hooks      | 7       | ~500        | Active         |
| CLI renderer   | 5       | ~400        | Active         |
| Core           | 8       | ~1,200      | Active         |
| LLM            | 9       | ~1,500      | Active         |
| Tools          | 17      | ~2,000      | Active         |
| Commands       | 29      | ~1,800      | Active         |
| Permissions    | 4       | ~400        | Active         |
| Guardrails     | 5       | ~170        | Minimal        |
| MCP            | 4       | ~770        | Partial        |
| Subagents      | 4       | ~520        | Stub-heavy     |
| Skills         | 3       | ~360        | Not integrated |
| Hooks          | 4       | ~300        | Complete       |
| Config         | 4       | ~400        | Complete       |
| Other          | 20      | ~1,200      | Various        |
| **Total**      | **145** | **~13,000** | —              |

---

## Sources

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code System Prompts](https://github.com/Piebald-AI/claude-code-system-prompts) (updated within minutes of each release)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [Claude Code Context Buffer Management](https://claudefa.st/blog/guide/mechanics/context-buffer-management)
- [OpenAI GPT-4.1 Announcement](https://openai.com/index/gpt-4-1/)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
