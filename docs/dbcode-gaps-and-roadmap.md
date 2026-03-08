# dbcode vs Claude Code: Gap Analysis & Improvement Roadmap

> Date: 2026-03-08
> Author: Claude Opus 4.6 (Anthropic Claude Code Expert Review)
> dbcode version: 0.1.0 (145 source files)
> Claude Code reference: v2.1.x (latest stable)

---

## Executive Summary

dbcode has a solid foundation — ReAct agent loop, 12 tools, multi-turn conversation, Ink-based UI. However, compared to Claude Code's latest, there are significant gaps across **rendering quality, conversation management, tool capabilities, security, and developer experience**. This document categorizes every gap by priority and provides a concrete roadmap.

---

## 1. Terminal Rendering (Critical)

### 1.1 Cell-Level Differential Renderer

| Aspect | Claude Code | dbcode | Gap |
|--------|-------------|--------|-----|
| Rendering engine | Custom cell-level diff renderer ("ink2 mode") | Ink default clear-and-redraw | **Critical** |
| Buffer strategy | Double-buffered packed TypedArrays | None (Ink manages) | Major |
| Frame budget | ~5ms scene-graph → ANSI | Uncontrolled | Major |
| Layout engine | Yoga WASM (retained) | Yoga via Ink (same) | Parity |
| Synchronized output | DEC Mode 2026 (upstream patches to VSCode, tmux) | Implemented (basic) | Minor |

**Current state**: dbcode uses Progressive Static Flushing + DEC Mode 2026, which helps but doesn't eliminate flickering. Claude Code rewrote the renderer entirely.

**Recommendation**: Phase approach:
1. Short-term: Optimize current Static flushing (done)
2. Mid-term: Implement simple cell-level diff on top of Ink
3. Long-term: Full custom renderer if user base justifies

### 1.2 Output Formatting

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Message markers | `⏺` bullet for assistant | `assistant:` text label | UX |
| Tool call display | Collapsible with `⎿` result prefix | Static `[✓]` with text | UX |
| Progressive collapse | Completed tools fold to summary | Always show full | UX |
| Diff display | Inline colored diff with context | Basic `+/-` lines | Minor |
| Thinking blocks | Toggle with timing + token count | ThinkingBlock component (exists) | Parity |
| Subagent transcripts | Collapsible nested display | Not rendered in UI | Major |
| OSC 8 hyperlinks | File paths are clickable | Plain text | Nice-to-have |
| Turn separators | Clear visual separation | Spacer text only | UX |
| Unicode art/emoji | Minimal, clean | DB logo art | Style |

**Key UX fix needed**: Tool call output should show:
```
⏺ Reading file src/index.ts
  ⎿ Read 382 lines (2.4s)
```
Instead of current:
```
  [✓] Read file: src/index.ts (382 lines, 2.4s)
```

---

## 2. Conversation Management (Critical)

### 2.1 Multi-Turn Message Integrity

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Message pairing | assistant(toolCalls) → tool results always paired | **Fixed** (was broken) | Fixed |
| Field preservation | toolCallId, toolCalls always preserved | **Fixed** (was dropping fields) | Fixed |
| Intermediate messages | All iterations preserved in history | Only last assistant saved | **Critical** |
| Context compaction | Sophisticated summary + key info retention | Basic token-based truncation | Major |
| Message pruning | Intelligent per-turn pruning | None | Major |

### 2.2 Intermediate Assistant Messages

**Bug (still present)**: During a multi-iteration agent loop, intermediate assistant text (e.g., "Let me create the files", "Now let me try building") is NOT stored as activity entries. Only the FINAL assistant message gets an `assistant-text` entry.

In `useAgentLoop.ts`:
```typescript
// Current: only adds the LAST assistant message as activity
const lastMessage = newMessages[newMessages.length - 1];
if (lastMessage && lastMessage.role === "assistant") {
  activityRef.current.addEntry("assistant-text", { ... });
}
```

**Should be**: Every assistant message during the loop should be an activity entry, so users see the agent's reasoning across iterations.

### 2.3 Context Window Management

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Auto-compaction trigger | ~95% context | ContextManager exists but basic | Major |
| Compaction strategy | Structured summary preserving key context | Simple truncation | Major |
| `/compact` command | Interactive with custom instructions | Exists but basic | Minor |
| Token counting | Accurate (tiktoken) | tiktoken + LRU cache | Parity |
| Context % warning | Persistent status bar warning | StatusBar shows % | Parity |

---

## 3. Tool System (Major)

### 3.1 Missing Tools

| Tool | Claude Code | dbcode | Priority |
|------|-------------|--------|----------|
| Task/TodoWrite | Create/manage task lists | Missing | High |
| Agent (subagent) | Spawn specialized sub-agents | spawner.ts exists but not a tool | High |
| NotebookRead | Read Jupyter notebooks | file_read handles .ipynb | Parity |
| MultiEdit | Batch file edits | Missing (single edit only) | Medium |
| ScreenshotCapture | Capture terminal/browser screenshots | Missing | Low |

### 3.2 Tool Quality Gaps

| Tool | Gap | Priority |
|------|-----|----------|
| file_edit | No `replace_all` flag for bulk replacements | Medium |
| bash_exec | No interactive command detection/blocking | Minor |
| file_read | Image support exists but untested in production | Minor |
| web_search | Brave API key required, no fallback to free API | Medium |
| glob_search | No .gitignore respect | Medium |

### 3.3 Parallel Tool Execution

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Dependency analysis | Smart grouping by file path conflicts | `groupToolCalls()` implemented | Parity |
| Promise.allSettled | Yes | Yes | Parity |
| Result ordering | Preserved | Preserved | Parity |
| Timeout per tool | Tool-specific | Global + tool-specific | Parity |

---

## 4. Agent & Sub-Agent System (Major)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Agent tool | First-class tool with types, isolation | `spawner.ts` (407 lines) but not registered as tool | Major |
| Agent types | general, Explore, Plan + custom | explore, general, plan stubs | Major |
| Worktree isolation | Git worktree per agent | Planned in spawner | Partial |
| Background agents | `run_in_background` param | Not wired | Major |
| Agent teams | TeamCreate, SendMessage | Not implemented | Major |
| Agent display | Collapsible transcript in UI | No UI rendering | Major |
| Resume/continue | Resume agent by ID | Not implemented | Medium |

**Key gap**: Sub-agents exist as code but are NOT accessible from the agent loop. Need to register as a tool.

---

## 5. Permission System (Minor gaps)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Permission modes | 5 modes (default, acceptEdits, plan, dontAsk, bypassPermissions) | Modes defined, manager works | Parity |
| Session store | Remember per-session approvals | session-store.ts exists | Parity |
| Tool-specific rules | Glob patterns for paths | rules.ts exists | Parity |
| Permission prompt UI | Interactive with Y/N/always | PermissionPrompt component | Parity |
| Bulk approval | "Always allow X for this session" | Not fully wired | Minor |

---

## 6. Slash Commands (Medium)

### 6.1 Implemented (27 commands)

dbcode has: `/clear`, `/compact`, `/help`, `/model`, `/resume`, `/rewind`, `/effort`, `/fast`, `/simplify`, `/batch`, `/debug`, `/mcp`, `/config`, `/diff`, `/doctor`, `/stats`, `/status`, `/context`, `/copy`, `/export`, `/fork`, `/output-style`, `/rename`, `/cost`, `/update`, `/init`, `/plan`, `/undo`

### 6.2 Missing vs Claude Code

| Command | Claude Code | dbcode | Priority |
|---------|-------------|--------|----------|
| `/review` | Review code changes | Missing | High |
| `/login` / `/logout` | API auth management | Missing | Medium |
| `/memory` | View/edit project memory | Missing | Medium |
| `/vim` | Toggle vim keybindings | Missing | Low |
| `/terminal-setup` | Configure terminal | Missing | Low |
| `/bug` | Report bugs | Missing | Low |
| Custom commands | User `.md` files as commands | Missing | High |

### 6.3 Custom Slash Commands

**Major gap**: Claude Code allows users to create custom slash commands by placing `.md` files in `.claude/commands/`. dbcode has no equivalent. This is a high-value, low-effort feature.

---

## 7. MCP (Model Context Protocol) Integration (Medium)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| MCP client | Full client with tool/resource discovery | client.ts (319 lines) | Partial |
| MCP manager | Auto-start/stop servers from config | manager.ts (151 lines) | Partial |
| Tool bridge | MCP tools → agent loop tools | tool-bridge.ts (172 lines) | Implemented |
| MCP config | `~/.claude/mcp.json` | Not standardized | Minor |
| Built-in servers | None required, user-configured | Same approach | Parity |
| `/mcp` command | List/manage servers | Implemented | Parity |

**Status**: MCP is fairly well implemented. Main gap is production hardening and config standardization.

---

## 8. Skills System (Medium)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Skill loading | `.claude/skills/` directory scan | loader.ts (178 lines) | Partial |
| SKILL.md parsing | Frontmatter + body | types.ts exists | Partial |
| Skill triggering | Description-based matching | Not wired to agent loop | Major |
| Bundled resources | scripts/, references/, assets/ | Not implemented | Major |
| Skill packages | `.skill` file packaging | Not implemented | Medium |

**Key gap**: Skills exist as a module but are NOT integrated into the agent loop or system prompt.

---

## 9. Hooks System (Good)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Hook events | PreToolUse, PostToolUse, SessionStart, Stop, etc. | loader.ts + runner.ts | Parity |
| Hook config | `.dbcode/hooks.json` | Implemented | Parity |
| Auto-lint | Post-edit formatting | auto-lint.ts exists | Implemented |
| UserPromptSubmit | Pre-process user input | Wired in useAgentLoop | Parity |

**Status**: Hooks are well implemented. One of the stronger areas.

---

## 10. Session Management (Minor gaps)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Create session | Auto-create on start | Implemented | Parity |
| Resume (`--continue`) | Most recent session | Implemented | Parity |
| Resume by ID (`--resume`) | Specific session | Implemented | Parity |
| `/fork` | Branch conversation | Command exists | Parity |
| `/export` | Export conversation | Command exists | Parity |
| Session history | List past sessions | Basic | Minor |
| Session search | Search across sessions | Not implemented | Medium |

---

## 11. Git Integration (Medium gaps)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Git status awareness | Always aware of branch, changes | Via bash_exec | Indirect |
| Commit message generation | AI-generated conventional commits | Not built-in | Medium |
| PR creation | `gh pr create` via tool | Via bash_exec | Indirect |
| Diff display | `/diff` command | Implemented | Parity |
| Git hooks | Pre-commit integration | Not implemented | Low |
| Worktree for agents | Isolated git worktrees | Planned in spawner.ts | Partial |

---

## 12. Security & Sandboxing (Medium gaps)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| macOS Seatbelt | sandbox-exec profiles | seatbelt.ts (209 lines) | Implemented |
| Windows AppContainer | Process isolation | Not implemented | Major (if Windows target) |
| Secret scanner | Detect leaked secrets | secret-scanner.ts (34 lines, minimal) | Needs expansion |
| Input guardrails | Filter dangerous tool inputs | guardrails/index.ts | Implemented |
| Output guardrails | Filter sensitive output | output-limiter.ts | Basic |
| Command filter | Block dangerous shell commands | command-filter.ts | Basic |
| Content policy | PII, harmful content detection | Not implemented | Medium |

---

## 13. Developer Experience (Major gaps)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| First-run wizard | Model + API key setup | setup-wizard.ts | Parity |
| `--print` mode | Headless single prompt | headless.ts | Parity |
| `--output-format` | text, json, stream-json | Implemented | Parity |
| `--add-dir` | Multi-repo support | CLI flag exists but unused | Partial |
| `/doctor` | Diagnostics | Implemented | Parity |
| Error messages | User-friendly, zero stack traces | handleError() in index.ts | Parity |
| Update check | Notify of new versions | `/update` command exists | Parity |
| Keyboard shortcuts | Tab, Ctrl+C, vim mode | Basic (Ctrl+C abort) | Minor |
| Auto-update | Background update check | Not implemented | Low |

---

## 14. Instructions System (Minor gaps)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| CLAUDE.md loading | Project root + parents + .claude/ | loader.ts in instructions/ | Partial |
| User-level rules | `~/.claude/rules/` | Not scanned | Medium |
| Project-level rules | `.claude/rules/` | Not scanned | Medium |
| Hierarchical merge | Global → project → local | Not implemented | Medium |
| `/init` command | Generate CLAUDE.md | Implemented | Parity |

---

## 15. Telemetry & Cost Tracking (Minor)

| Feature | Claude Code | dbcode | Gap |
|---------|-------------|--------|-----|
| Token counting | Per-message accurate | Basic aggregate | Minor |
| Cost calculation | Per-model pricing table | MODEL_PRICING in StatusBar | Parity |
| `/cost` command | Session cost summary | Implemented | Parity |
| `/stats` command | Usage statistics | Implemented | Parity |
| OpenTelemetry | Full OTLP export | otel-exporter.ts exists | Partial |

---

## Priority Roadmap

### P0 — Must Fix Now (Blocking real usage)

1. **Intermediate assistant messages in activity feed** — Users can't see agent's reasoning across iterations
2. **Custom slash commands** (`.md` files) — High-value, low-effort, Claude Code's killer feature
3. **Agent tool registration** — Sub-agents exist but aren't usable from the agent loop

### P1 — High Priority (Major UX improvement)

4. **Output formatting overhaul** — `⏺` markers, collapsible tool output, `⎿` result prefix
5. **Context compaction strategy** — Structured summary instead of truncation
6. **Skills integration** — Wire skill triggering into agent loop + system prompt
7. **Hierarchical instructions** — Scan `~/.claude/rules/` + `.claude/rules/`

### P2 — Medium Priority (Feature completeness)

8. **replace_all in file_edit** — Bulk renaming/replacement
9. **Session search** — Find past conversations
10. **Content-aware .gitignore** in glob_search
11. **MCP config standardization**
12. **Windows sandboxing** (if targeting Windows)
13. **`/review` command**

### P3 — Nice to Have (Polish)

14. **Cell-level differential renderer** — Major engineering effort, big impact
15. **OSC 8 clickable file paths**
16. **Vim keybinding mode**
17. **Auto-update background check**
18. **Git commit message generation**

---

## Architecture Health Assessment

### Strengths
- Clean layer separation (CLI → Core → LLM/Tools → Utils)
- Immutable conversation state
- Proper event-driven architecture (mitt)
- Good tool abstraction with Zod validation
- Hooks system is production-ready
- Anti-flicker rendering (Progressive Static Flushing + DEC Mode 2026)

### Weaknesses
- **No integration tests for multi-turn conversations** — The message pairing bug could have been caught
- **Activity tracking incomplete** — Only final assistant message tracked, not intermediate ones
- **Subagents/Skills/MCP are islands** — Code exists but not integrated into the agent loop
- **No automated E2E test for rendering** — Flickering regressions can't be caught
- **Secret scanner is minimal** (34 lines) — Needs real regex patterns for API keys, tokens, etc.

### Technical Debt
- `conversation.toMessagesForLLM()` uses `tool_call_id` (snake_case) while `ChatMessage` uses `toolCallId` (camelCase) — field name mismatch requires manual mapping
- `ToolCall` type is duplicated between `message-types.ts` and `provider.ts`
- `--add-dir` CLI flag is parsed but never used
- Several stub files in subagents/ (explore.ts, general.ts, plan.ts are ~38 lines each)

---

## Lines of Code Summary

| Module | Files | Lines | Status |
|--------|-------|-------|--------|
| CLI components | 15 | ~1,800 | Active |
| CLI hooks | 7 | ~500 | Active |
| CLI renderer | 5 | ~400 | Active |
| Core | 8 | ~1,200 | Active |
| LLM | 9 | ~1,500 | Active |
| Tools | 17 | ~2,000 | Active |
| Commands | 29 | ~1,800 | Active |
| Permissions | 4 | ~400 | Active |
| Guardrails | 5 | ~170 | Minimal |
| MCP | 4 | ~770 | Partial |
| Subagents | 4 | ~520 | Stub-heavy |
| Skills | 3 | ~360 | Not integrated |
| Hooks | 4 | ~300 | Complete |
| Config | 4 | ~400 | Complete |
| Other | 20 | ~1,200 | Various |
| **Total** | **145** | **~13,000** | — |
