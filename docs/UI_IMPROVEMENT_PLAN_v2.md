# dhelix Improvement Plan v2 — Full-Stack Production Roadmap

> **Author**: Claude Agent Team (8 specialist agents, parallel analysis)
> **Date**: 2026-03-12 (v2)
> **Status**: **Approved — Ready for Implementation** > **Analysis Method**: Claude Agent Teams (8 parallel specialists, ~27,000 lines analyzed)
> **Scope**: Core Engine + LLM + Tools + UI + Security + MCP/Skills + DX + Testing

---

## Executive Summary

8명의 전문가 에이전트가 dhelix 코드베이스(27,287줄, 22개 모듈)를 병렬로 심층 분석했습니다.
v1 계획(UI 중심 33개 항목)을 확장하여 **Core 레벨까지 포괄하는 95개 개선 항목**을 도출했습니다.

### Key Findings

| Category               | Items   | Critical | High   | Medium | Low    |
| ---------------------- | ------- | -------- | ------ | ------ | ------ |
| Core Engine            | 22      | 1        | 5      | 10     | 6      |
| LLM Layer              | 26      | 3        | 5      | 12     | 6      |
| Tool System            | 12      | 1        | 4      | 4      | 3      |
| CLI UI/Rendering       | 31      | 0        | 8      | 15     | 8      |
| Permissions & Security | 19      | 0        | 5      | 9      | 5      |
| MCP & Skills           | 16      | 1        | 3      | 7      | 5      |
| Developer Experience   | 22      | 5        | 6      | 7      | 4      |
| Testing & Quality      | 12      | 1        | 4      | 5      | 2      |
| **Total**              | **160** | **12**   | **40** | **69** | **39** |

### Strategic Positioning

> **"The Provider-Agnostic AI Coding Assistant"**
>
> dhelix's killer differentiator is multi-provider support (OpenAI + Anthropic + Local).
> No competitor occupies this niche. Strategic focus should be:
>
> 1. Multi-provider excellence (routing, capabilities, cost awareness)
> 2. Extensibility (agents, skills, hooks, MCP)
> 3. CI/CD first-class citizen

### Competitive Score (March 2026)

| Tool                 | Score      | Key Strength                                      |
| -------------------- | ---------- | ------------------------------------------------- |
| Claude Code          | 8.8/10     | Market leader, Agent Teams, MCP Tool Search       |
| Copilot CLI          | 7.0/10     | GA, /fleet, specialized agents                    |
| Gemini CLI           | 7.1/10     | 1M context, open-source                           |
| Codex CLI            | 6.1/10     | Rust/fast, minimal                                |
| **dhelix**           | **6.8/10** | Multi-provider, 3-layer compaction, extensibility |
| **dhelix (post-v2)** | **8.2/10** | Target after implementing this plan               |

---

## Part I: Core Engine Improvements

> Analyst: **core-architect** | Files: 8 | Lines: ~3,000

### 1.1 Session Resumption with Context Restoration [CRITICAL]

**Current**: `session-manager.ts` loads raw JSONL transcripts on `--resume`. Context manager state
(cold storage refs, file access history, compaction metrics) is lost.

**Gap**: Resumed sessions start with fresh context management. Long conversations may exceed context
window immediately.

**Proposed**: Persist `ContextManager` state in `context-state.json` per session. Restore cold storage
refs, file access history, compaction count on resume.

- **Effort**: 8-12 hours | **Impact**: ★★★★★
- **Files**: `session-manager.ts`, `context-manager.ts`
- **Competitive**: Claude Code has full session resumption with state

### 1.2 Summarization Caching [HIGH]

**Current**: Every compaction re-summarizes all middle turns from scratch (`context-manager.ts:458`).
LLM summarization is expensive (additional API call each time).

**Proposed**: Cache summaries keyed by content hash. On subsequent compactions, only summarize new
turns since last cached summary, then merge.

- **Effort**: 6-8 hours | **Impact**: ★★★★★
- **Files**: `context-manager.ts:708-778`
- **Saves**: Significant API cost and latency on long conversations

### 1.3 Content-Addressable Checkpoint Storage [HIGH]

**Current**: Every checkpoint copies entire file content (`checkpoint-manager.ts:100-103`). 50
checkpoints of a 10KB file = 500KB.

**Proposed**: Hash file content, store unique blobs once, reference by hash. Similar to git's
object store. Estimated 80-90% storage reduction.

- **Effort**: 8-12 hours | **Impact**: ★★★★★
- **Files**: `checkpoint-manager.ts:78-139`

### 1.4 Rate-Limit Header Awareness in Retry [HIGH]

**Current**: Fixed exponential backoff `1000 * 2^attempt` ms (`agent-loop.ts:412`). Comment says
"client already retried" but no evidence of `Retry-After` header consumption.

**Proposed**: Pass rate-limit headers from LLM response. Use `Retry-After` when available,
add jitter to prevent thundering herd.

- **Effort**: 3-4 hours | **Impact**: ★★★★
- **Files**: `agent-loop.ts:400-418`, `src/llm/client.ts`

### 1.5 Async Git Context + Caching [HIGH]

**Current**: `detectGitContext()` calls `execSync()` 3 times (`system-prompt-builder.ts:434-458`),
blocking event loop up to 9 seconds.

**Proposed**: Replace with `execAsync` + `Promise.all()`. Cache results for 30 seconds with
invalidation on file mutations.

- **Effort**: 4-6 hours | **Impact**: ★★★★
- **Files**: `system-prompt-builder.ts:428-469`

### 1.6 Adaptive Compaction Threshold [HIGH]

**Current**: Fixed 83.5% (`constants.ts:48`). For 8k models, leaves only ~1.3k for response.
For 1M models, wastes potential.

**Proposed**: `min(0.90, 0.835 + (maxContext - 128k) * 0.0001)` — earlier for small windows,
later for large. Consider average response token count.

- **Effort**: 3-4 hours | **Impact**: ★★★★
- **Files**: `context-manager.ts:162-174`, `constants.ts:48`

### 1.7 Checkpoint Auto-Pruning [MEDIUM]

**Current**: Checkpoints accumulate indefinitely. 200 file edits = 200 full checkpoints.

**Proposed**: `maxCheckpoints` config (default: 50). Prune oldest, keep every Nth as "keyframe".

- **Effort**: 3-4 hours | **Impact**: ★★★★
- **Files**: `checkpoint-manager.ts:61-68`

### 1.8 Partial Stream Validation [MEDIUM]

**Current**: Partial stream content used without validating tool call JSON
(`agent-loop.ts:378-388`). Incomplete JSON causes cryptic parse errors.

**Proposed**: Validate each tool call's `arguments` is parseable JSON. Drop unparseable calls
with warning.

- **Effort**: 2-3 hours | **Impact**: ★★★★
- **Files**: `agent-loop.ts:378-395`, `streaming.ts:102-126`

### 1.9 Semantic Rehydration [MEDIUM]

**Current**: Post-compaction rehydration reads first 4000 chars of 5 files
(`context-manager.ts:574-586`). May miss the relevant section.

**Proposed**: Track last-accessed line ranges per file. Rehydrate specific touched regions.

- **Effort**: 6-8 hours | **Impact**: ★★★★
- **Files**: `context-manager.ts:567-610`

### 1.10 Iteration Budget Awareness [MEDIUM]

**Current**: Hard limit of 50 iterations. No warning as limit approaches.

**Proposed**: Emit `agent:budget-warning` at 80%. Inject system reminder at 90% telling LLM
to finalize.

- **Effort**: 2-3 hours | **Impact**: ★★★
- **Files**: `agent-loop.ts:327-340`

### 1.11 Task Manager Atomic Save [MEDIUM]

**Current**: `save()` uses raw `writeFile()` without locking (`task-manager.ts:86-92`).
Concurrent saves corrupt data.

**Proposed**: Use `withFileLock()` + `atomicWrite()` from `session-manager.ts`.

- **Effort**: 1 hour | **Impact**: ★★★
- **Files**: `task-manager.ts:86-92`

### 1.12 Session Metrics & Analytics [MEDIUM]

**Current**: Session metadata only tracks basic fields. No token usage, cost, tool counts.

**Proposed**: Extend `SessionMetadata` with `totalTokens`, `totalCost`, `toolCallCount`,
`compactionCount`, `duration`, `errorCount`.

- **Effort**: 3-4 hours | **Impact**: ★★★
- **Files**: `session-manager.ts:126-134`

---

## Part II: LLM Layer Improvements

> Analyst: **llm-specialist** | Files: 12 | Lines: ~2,500

### 2.1 ResponsesAPIClient Has Zero Retry Logic [P0-CRITICAL]

**Current**: `responses-client.ts` has NO retry logic — any error immediately fails.
This is the client for the **default model** (`gpt-5.1-codex-mini`).

**Proposed**: Add same retry pattern as `client.ts` (3 retries transient, exponential backoff).
Extract shared `withRetry()` utility.

- **Effort**: 0.5 day | **Impact**: P0 — default model has zero fault tolerance
- **Files**: `responses-client.ts`

### 2.2 Missing Modern Models in Capabilities [P0]

**Current**: No entries for Claude 4.x/4.5/4.6, GPT-4.1, Gemini models. Claude pricing outdated.

**Proposed**: Add Claude 4.x family (200K context), GPT-4.1 (1M context), Gemini entries.

- **Effort**: 0.5 day | **Impact**: P0
- **Files**: `model-capabilities.ts`, `cost-tracker.ts`

### 2.3 Memory Leak in Abort Signal Listeners [P0]

**Current**: `anthropic.ts:372-373` adds abort listeners without cleanup. Leaks listeners
over many requests.

**Proposed**: Use `{ once: true }` option or manually remove in finally block.

- **Effort**: 15 minutes | **Impact**: P0 (correctness bug)
- **Files**: `providers/anthropic.ts`

### 2.4 Single Tokenizer for All Models [HIGH]

**Current**: Only `o200k_base` used. `ModelCapabilities.tokenizer` field exists but is
**never consumed**. Claude models use `text.length/4` estimate (~25-30% inaccuracy).

**Proposed**: Make `countTokens()` accept model name, use appropriate encoder per model.
For Claude, use improved `estimateTokens()` with CJK differentiation.

- **Effort**: 1-2 days | **Impact**: HIGH — affects compaction thresholds
- **Files**: `token-counter.ts`, `model-capabilities.ts`

### 2.5 Duplicated Error Classification [HIGH]

**Current**: `model-router.ts:36-76` uses string matching on `error.message`.
`client.ts:94-112` uses `instanceof` checks. Inconsistent approaches.

**Proposed**: Unify into shared `error-classifier.ts`. Router consumes structured error info.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `model-router.ts`, `client.ts`, `providers/anthropic.ts`

### 2.6 No Circuit Breaker [HIGH]

**Current**: Each request retries independently. If provider is down, every request
burns through retries.

**Proposed**: CLOSED → OPEN (after N consecutive failures, fail fast) → HALF-OPEN (probe).

- **Effort**: 1-2 days | **Impact**: HIGH
- **Files**: New `circuit-breaker.ts`, `model-router.ts`

### 2.7 Duplicated Pricing Tables [MEDIUM]

**Current**: `cost-tracker.ts:31-41` has 6 pricing entries. `model-capabilities.ts` has
separate pricing. They can drift.

**Proposed**: Single source of truth — `cost-tracker.ts` calls `getModelCapabilities(model).pricing`.

- **Effort**: 0.5 day | **Impact**: LOW (maintainability)
- **Files**: `cost-tracker.ts`, `model-capabilities.ts`

### 2.8 No Stream Resumption [HIGH]

**Current**: Partial content returned on stream failure. No way to continue from where it stopped.

**Proposed**: On failure with partial content, inject partial as assistant message prefix,
ask model to continue.

- **Effort**: 2-3 days | **Impact**: HIGH
- **Files**: `streaming.ts`, `client.ts`, `providers/anthropic.ts`

### 2.9 No Provider Health Monitoring [MEDIUM]

**Current**: No latency/error rate tracking. No user visibility when provider is degraded.

**Proposed**: `ProviderHealthMonitor` with avg latency, error rate, last success time.
Expose via `/stats`.

- **Effort**: 1-2 days | **Impact**: MEDIUM
- **Files**: New `provider-health.ts`, `model-router.ts`

### 2.10 No Cost Budget Alerts [MEDIUM]

**Current**: Cost tracked but never acted upon. No session budget or warnings.

**Proposed**: `setBudget(maxUSD)`. Warning events at 80%/100%. Auto-switch to cheaper model.

- **Effort**: 1 day | **Impact**: MEDIUM
- **Files**: `cost-tracker.ts`, `model-router.ts`

### 2.11 Streaming Timeout Not Refreshed [MEDIUM]

**Current**: Single timeout for entire stream. Long outputs (32K tokens) can hit 120s timeout
while actively receiving data.

**Proposed**: Refresh timeout on each chunk. Abort only when no chunk for `timeout` ms.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `providers/anthropic.ts`, `responses-client.ts`

### 2.12 User-Defined Model Overrides [MEDIUM]

**Current**: All model capabilities hardcoded. Adding new model requires code change.

**Proposed**: `~/.dhelix/models.json` for user-defined overrides. Fall back to built-in registry.

- **Effort**: 1-2 days | **Impact**: MEDIUM
- **Files**: `model-capabilities.ts`, `config/schema.ts`

### 2.13 CostTracker Not Integrated in Bootstrap [MEDIUM]

**Current**: `CostTracker` exists but never instantiated in `index.ts`. May use separate instance.

**Proposed**: Create in bootstrap, pass through to agent loop and status bar.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `index.ts`, `core/agent-loop.ts`

### 2.14 No Gemini Provider Routing [MEDIUM]

**Current**: Only `claude-*` and `gpt-*/o1-*/o3-*` prefixes routed. No `gemini-*` support.

**Proposed**: Add `gemini-*` routing. Also `deepseek-*`, `mistral-*` for direct API routing.

- **Effort**: 1-2 days | **Impact**: MEDIUM
- **Files**: `model-router.ts`

---

## Part III: Tool System Improvements

> Analyst: **tools-expert** | Files: 20 | Lines: ~2,500

### 3.1 grep_search Pure JavaScript Implementation [CRITICAL]

**This is the single most impactful performance fix in the entire codebase.**

**Current**: `grep-search.ts` uses `fast-glob` to enumerate ALL files, reads EVERY file into
memory, tests each line with regex. On 10,000 files: ~10 seconds.

**ripgrep equivalent**: ~50ms (100x faster, memory-mapped, SIMD-accelerated).

**Claude Code, Codex CLI, and all major competitors wrap ripgrep.**

**Proposed**: Replace with ripgrep subprocess wrapper:

- Detect `rg` in PATH (fallback to current JS for environments without ripgrep)
- Support `-A/-B/-C` context lines, `-i` case insensitive, `--type` filtering
- Support `-U` multiline, `--count` mode, `--max-count` result limiting
- Automatic `.gitignore` respect (rg default behavior)

- **Effort**: 1-2 days | **Impact**: CRITICAL (100x search performance)
- **Files**: `src/tools/definitions/grep-search.ts`

### 3.2 bash_exec No Output Size Limit [HIGH]

**Current**: No output cap. `cat /dev/urandom | base64` fills memory unboundedly.

**Proposed**: 1MB stdout/stderr cap with truncation notice. Validate cwd exists.

- **Effort**: 0.5 day | **Impact**: HIGH (prevents OOM)
- **Files**: `src/tools/definitions/bash-exec.ts`

### 3.3 glob_search No Result Limit [HIGH]

**Current**: Returns ALL matches. `**/*` in large repo returns thousands, consuming tokens.

**Proposed**: `maxResults` parameter (default: 100). Respect `.gitignore`.

- **Effort**: 0.5 day | **Impact**: HIGH
- **Files**: `src/tools/definitions/glob-search.ts`

### 3.4 Tool Metadata System [HIGH]

**Current**: Flat, untyped registry. Agent-loop maintains hardcoded sets
(`ALWAYS_PARALLEL_TOOLS`, `FILE_WRITE_TOOLS`).

**Proposed**: Add `ToolMetadata`: `{ category, tags, isReadOnly, examples }`.
Derive parallel execution rules from metadata instead of hardcoded sets.

- **Effort**: 1-2 days | **Impact**: HIGH (unlocks better parallel execution)
- **Files**: `types.ts`, `registry.ts`, all tool definitions

### 3.5 Concurrency Limiter in Executor [HIGH]

**Current**: All tool calls in a group fire simultaneously. No semaphore/pool.

**Proposed**: Configurable `maxParallelToolCalls` (default: 8) with semaphore.

- **Effort**: 1 day | **Impact**: HIGH (prevents resource exhaustion)
- **Files**: `executor.ts`, `agent-loop.ts:206-252`

### 3.6 file_edit Diff Output [MEDIUM]

**Current**: Returns "Successfully edited" without showing what changed.

**Proposed**: Return unified diff in result. Add `ignoreWhitespace` option.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `src/tools/definitions/file-edit.ts`

### 3.7 Execution Timing Metrics [MEDIUM]

**Current**: No timing data captured per tool call.

**Proposed**: Record `durationMs` in `ToolCallResult`. Aggregate per-tool stats.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `executor.ts`

### 3.8 Fix Sync FS in BackgroundProcessManager [MEDIUM]

**Current**: `readFileSync`, `statSync`, `openSync` used — violates "no sync fs" convention.
Temp output files never cleaned up.

**Proposed**: Convert to async. Add cleanup on session end.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `executor.ts`

### 3.9 Proposed New Tools

| Tool              | Priority | Description                                              |
| ----------------- | -------- | -------------------------------------------------------- |
| `multi_file_edit` | HIGH     | Atomic multi-file edits (like Codex CLI's `apply_patch`) |
| `batch_file_read` | MEDIUM   | Read multiple files in one call (token-efficient)        |
| `diff_view`       | MEDIUM   | Show diff between files or vs git HEAD                   |
| `code_search`     | LOW      | AST-aware search via tree-sitter                         |
| `file_rename`     | LOW      | Rename/move with import awareness                        |

---

## Part IV: CLI UI/Rendering Improvements

> Analyst: **ui-renderer** | Files: 17 | Lines: ~2,500 | Cross-referenced with v1 plan

### Tier 1 — Immediate Impact (0-3 days)

#### 4.1 Rich Tool Display — Diff Default [v1 CONFIRMED]

**Current**: Diff preview gated by `isExpanded` (`ToolCallBlock.tsx:138`). The diff engine
in `tool-display.ts` (`formatContextDiff`, `formatEditDiff`) is **fully built but hidden**.

**Fix**: Change line 138 from `{isExpanded && preview}` to `{preview}`.
Also change header format from `Verb(arg)` to `Verb arg` (Claude Code style).

- **Effort**: 0.25 day | **Impact**: ★★★★★
- **One-line change** unlocks sophisticated diff engine

#### 4.2 Live Token Counter [v1 CONFIRMED]

**Current**: `StatusBar.tsx` has `inputTokens`/`outputTokens` props and `calculateCost()`
with 14-model pricing table. But `useAgentLoop.ts` never subscribes to usage events.

**Fix**: Subscribe to `agent:usage-update` / `llm:usage` events, add state, pass to StatusBar.

- **Effort**: 1 day | **Impact**: ★★★★★
- **80% of infrastructure already exists**

#### 4.3 Working Timer [v1 CONFIRMED]

**Current**: `Spinner.tsx` is 30 lines with static label. No elapsed time.

**Fix**: Add `useState(Date.now())` + 500ms interval for elapsed display.

- **Effort**: 0.25 day | **Impact**: ★★★★

#### 4.4 Syntax Highlighting [v1 CONFIRMED]

**Current**: `syntax.ts` has full shiki integration (`highlightCode()`, `tokensToAnsi()`,
`resolveLanguage()`). Never called from `markdown.ts`.

**Fix**: Intercept code block rendering in `marked-terminal`, delegate to shiki.
Risk: async shiki init vs sync `marked.parse()` — needs pre-processing or cache.

- **Effort**: 0.5-1 day | **Impact**: ★★★★

#### 4.5 Format Permission Arguments [NEW]

**Current**: `App.tsx:206` shows raw `JSON.stringify(pendingPermission.call.arguments)`.

**Fix**: Format semantically per tool (bash: show command, file_edit: show path + summary).

- **Effort**: 0.5 day | **Impact**: ★★★★
- **Permission decisions are critical UX moments**

#### 4.6 Remove "assistant:" Label [NEW]

**Current**: `StreamingMessage.tsx:73-75` prefixes every message with "assistant: ".
Claude Code and Codex don't do this.

**Fix**: Remove or make configurable.

- **Effort**: 0.1 day | **Impact**: ★★★

### Tier 2 — Input Experience (3-10 days)

#### 4.7 ! Bash Mode [v1 CONFIRMED]

**Current**: No `!` prefix detection in `UserInput.tsx`.

**Fix**: Detect `!` prefix in `handleSubmit`, spawn `child_process` directly, add to context.

- **Effort**: 0.5 day | **Impact**: ★★★★

#### 4.8 Inline Permission Deny Feedback [v1 CONFIRMED]

**Current**: Deny calls `onResponse("no")` with no feedback text.

**Fix**: Add text input after Deny, feed back to agent as tool result.

- **Effort**: 0.5 day | **Impact**: ★★★★★

#### 4.9 Word-Level Diff Highlighting [v1 CONFIRMED]

**Current**: `DiffPreview` colors entire +/- lines. No intra-line diffing.

**Fix**: Use `diff-match-patch` for old/new line pairs. Bold/underline changed spans.

- **Effort**: 1 day | **Impact**: ★★★★

#### 4.10 Ctrl+R Reverse History Search [v1 CONFIRMED]

**Current**: `useInput.ts` has Up/Down navigation only. No search mode.

**Fix**: Add `isSearching` state machine, render search bar inline.

- **Effort**: 1 day | **Impact**: ★★★★

#### 4.11 "Always" Persistent Permission [v1 CONFIRMED]

**Current**: 3 options (Allow once / Allow session / Deny). No permanent approval.

**Fix**: 4th option persisting to `.dhelix/permissions.json`.

- **Effort**: 0.5 day | **Impact**: ★★★★

#### 4.12 Completion Notification [v1 CONFIRMED]

**Current**: No notification when long task completes.

**Fix**: OSC9: `\x1b]9;Task completed\x07`, BEL fallback. Config toggle.

- **Effort**: 0.5 day | **Impact**: ★★★★

#### 4.13 Adaptive Text Buffering [NEW]

**Current**: Fixed 100ms batching (`useTextBuffering.ts`).

**Fix**: Flush immediately if no chunk in 50ms (debounce), batch when rapid (throttle).

- **Effort**: 0.5 day | **Impact**: ★★★

#### 4.14 StatusBar Responsive Width [NEW]

**Current**: Fixed layout. Narrow terminals cut elements.

**Fix**: Read `process.stdout.columns`, conditionally hide elements. Flex layout.

- **Effort**: 0.5 day | **Impact**: ★★★

### Tier 3 — Advanced UI (10-20 days)

#### 4.15 /btw Side Questions [v1 CONFIRMED]

- **Effort**: 1 day | **Impact**: ★★★★

#### 4.16 Customizable Statusline [v1 CONFIRMED]

- **Effort**: 2 days | **Impact**: ★★★★

#### 4.17 Esc+Esc Rewind Menu [v1 CONFIRMED]

Requires chord support in `useKeybindings.ts` first.

- **Effort**: 2 days (including chord support) | **Impact**: ★★★★

#### 4.18 Interactive /diff Viewer [v1 CONFIRMED]

- **Effort**: 2 days | **Impact**: ★★★★

#### 4.19 ActivityFeed Memory Management [NEW]

**Current**: `staticItems` grows unbounded in long sessions. WeakSet for entries but Static
items accumulate React nodes indefinitely.

**Fix**: Sliding window or periodic pruning of older static items.

- **Effort**: 0.5 day | **Impact**: ★★★ (HIGH for long sessions)

#### 4.20 Keybinding Chord Support [NEW]

**Current**: Single key combos only. No chords (Esc+Esc, Ctrl+K Ctrl+C).

**Fix**: Chord state machine — track "pending first key" with timeout.

- **Effort**: 1 day | **Impact**: ★★★ (enables Tier 3 features)

#### 4.21 SlashCommandMenu Fuzzy Matching [NEW]

**Current**: Strict `startsWith` matching. `/clr` won't match `/clear`.

**Fix**: Add fuzzy/substring matching with score sorting.

- **Effort**: 0.25 day | **Impact**: ★★

---

## Part V: Permissions & Security Improvements

> Analyst: **permissions-security** | Files: 22 | Lines: ~2,200

### Security Maturity Score: 7/10

### 5.1 Per-Category Auto-Approve Toggles [HIGH]

**Current**: 5 coarse-grained modes.

**Proposed**: Per-category config:

```typescript
categoryPermissions: {
  reads: "auto" | "ask" | "deny",
  writes: "auto" | "ask" | "deny",
  bash: "auto" | "ask" | "deny",
  network: "auto" | "ask" | "deny",
  agent: "auto" | "ask" | "deny",
}
```

- **Effort**: 1-2 days | **Impact**: HIGH (Cline CLI 2.0 parity)
- **Files**: `config/schema.ts`, `permissions/manager.ts`, `permissions/modes.ts`

### 5.2 Deny-with-Reason Feedback [HIGH]

**Current**: No reason captured on deny. Agent may retry same approach.

**Proposed**: Add `denyReason?: string` to result. Feed back to agent loop.

- **Effort**: 1 day | **Impact**: HIGH (Copilot CLI parity)
- **Files**: `permissions/types.ts`, `permissions/manager.ts`, `agent-loop.ts`

### 5.3 PII Detection in Output [HIGH]

**Current**: Secret scanner catches API keys but NOT PII (emails, phone numbers, SSN, CC).

**Proposed**: New `pii-scanner.ts` with email, phone, SSN, credit card patterns.

- **Effort**: 1-2 days | **Impact**: HIGH (data leakage prevention)
- **Files**: New `src/guardrails/pii-scanner.ts`

### 5.4 Command Filter Bypass Hardening [HIGH]

**Current**: Known bypasses: base64-encoded commands, variable expansion, subshell execution.

**Proposed**: Add patterns for base64 pipe-to-exec, subshell detection, --no-preserve-root.

- **Effort**: 0.5 day | **Impact**: HIGH
- **Files**: `src/guardrails/command-filter.ts`

### 5.5 Wire Unimplemented Config Flags [HIGH]

**Current**: `security.auditLogging` and `security.rateLimit` defined in schema but **never
read or enforced** anywhere in the codebase. False sense of configurability.

**Proposed**: Implement audit logging and rate limiting, or remove from schema.

- **Effort**: 2-3 days | **Impact**: HIGH (eliminates dead config)
- **Files**: New `permissions/audit-log.ts`, new `guardrails/rate-limiter.ts`

### 5.6 Consolidate Bubblewrap Implementations [MEDIUM]

**Current**: TWO bubblewrap implementations — `linux.ts` (simpler, used by dispatcher) and
`bubblewrap.ts` (complete with WSL2 support, NOT used). The better one is unused.

**Proposed**: Merge into single implementation. Update dispatcher to use consolidated version.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `sandbox/linux.ts`, `sandbox/bubblewrap.ts`, `sandbox/index.ts`

### 5.7 Windows Native Sandbox [MEDIUM-HIGH]

**Current**: Windows has NO sandbox — falls back to unsandboxed execution.

**Proposed**: Phase 1: Windows Sandbox (lightweight VM). Phase 2: AppContainer.
Phase 3: PowerShell Constrained Language Mode.

- **Effort**: 3-5 days | **Impact**: HIGH (biggest platform gap)
- **Files**: New `sandbox/windows.ts`

### 5.8 OWASP Code Generation Scanner [MEDIUM]

**Current**: No scanning of generated code for vulnerabilities (SQL injection, XSS, SSRF).

**Proposed**: Pattern-based scanner for `file_write`/`file_edit` outputs. Emit warnings.

- **Effort**: 2-3 days | **Impact**: MEDIUM
- **Files**: New `src/guardrails/code-scanner.ts`

### 5.9 Permission Audit Trail [MEDIUM]

**Current**: `auditLogging` config exists but zero implementation.

**Proposed**: `PermissionAuditLog` recording all check results to `~/.dhelix/audit.jsonl`.

- **Effort**: 1-2 days | **Impact**: MEDIUM
- **Files**: New `permissions/audit-log.ts`

### 5.10 Injection Detector Context Awareness [MEDIUM]

**Current**: Context-blind. Flags legitimate code comments containing "ignore previous"
or documentation headers like "### System:". False positives reduce trust.

**Proposed**: Add `context` parameter: `"user_input" | "tool_output" | "file_content"`.
Reduce severity for `file_content` context.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `guardrails/injection-detector.ts`

### 5.11 OS Keychain Integration [LOW]

**Current**: `TokenSource: "keychain"` type exists but never used. Credentials in plain JSON.

**Proposed**: macOS Keychain, Linux libsecret, Windows Credential Manager. Fallback to file.

- **Effort**: 2-3 days | **Impact**: MEDIUM
- **Files**: `auth/token-store.ts`

### 5.12 Dead Security Code Inventory

| Feature                    | Config/Type      | Implementation       | Status |
| -------------------------- | ---------------- | -------------------- | ------ |
| `security.auditLogging`    | ✅ Defined       | ❌ Zero refs         | DEAD   |
| `security.rateLimit`       | ✅ Defined       | ❌ Never enforced    | DEAD   |
| `ResolvedToken.expiresAt`  | ✅ Type field    | ❌ Never populated   | DEAD   |
| `TokenSource: "keychain"`  | ✅ Type variant  | ❌ Never used        | DEAD   |
| `bubblewrap.ts` (advanced) | ✅ Complete impl | ❌ Not in dispatcher | DEAD   |

---

## Part VI: MCP & Skills Improvements

> Analyst: **mcp-skills** | Files: 22 | Lines: ~2,200

### 6.1 MCP Tool Search / Deferred Loading [CRITICAL]

**The #1 most impactful improvement for MCP users.**

**Current**: ALL MCP tools eagerly loaded into system prompt. 100+ tools = 20K-50K tokens
wasted. `shouldDeferTools()` exists at `tool-bridge.ts:169-171` but is **NEVER CALLED** (dead code).

**Claude Code shipped this in January 2026 — 85-95% token savings.**

**Proposed Implementation**:

```
Phase 1: Lightweight Tool Index
- On MCP connect, store only {name, description} (no inputSchema)
- Render deferred tools as compact <available-deferred-tools> block
- Token savings: 85-95%

Phase 2: ToolSearch Tool
- New built-in tool: tool_search (safe permission)
- Input: { query, max_results }
- Returns full schemas for matched tools
- LLM calls matched tools with proper parameters

Phase 3: On-Demand Schema Fetching
- Lazy schema fetch on first call to deferred tool
- Cache schemas in-memory per session
```

**Architecture changes**:

1. `MCPToolBridge` — add `DeferredToolEntry` type
2. `ToolRegistry` — add `registerDeferred()` method
3. `system-prompt-builder.ts` — render deferred tools as compact block
4. New `src/tools/definitions/tool-search.ts`

- **Effort**: 3-5 days | **Impact**: CRITICAL
- **Files**: `tool-bridge.ts`, `registry.ts`, `system-prompt-builder.ts`

### 6.2 Agent Teams: Shared Task List [HIGH]

**Current**: `SharedAgentState` has messaging + key-value store but no task list.

**Proposed**: Add `TaskList` to `SharedAgentState`. Agents claim/update/complete tasks.
Coordinator monitors completion. Wire into agent-loop polling.

- **Effort**: 2-3 days | **Impact**: HIGH (Claude Code Agent Teams parity)
- **Files**: `shared-state.ts`, `spawner.ts`

### 6.3 Agent Teams: Inter-Agent Messaging During Execution [HIGH]

**Current**: Agents can only read shared state after completion.

**Proposed**: Between iterations, poll `SharedAgentState.getMessages(agentId)`.
Inject new messages as system reminders.

- **Effort**: 2-3 days | **Impact**: HIGH
- **Files**: `shared-state.ts`, `agent-loop.ts`

### 6.4 Skills Hot-Reload [MEDIUM]

**Current**: Skills loaded once at startup. Changes require restart.

**Proposed**: `fs.watch()` on 4 skill directories. Re-parse on change, debounce 500ms.

- **Effort**: 1-2 days | **Impact**: MEDIUM
- **Files**: `skills/manager.ts`

### 6.5 MCP Health Monitoring [MEDIUM]

**Current**: No health checks. Unresponsive servers go undetected.

**Proposed**: Periodic ping, consecutive failure tracking, auto-disconnect threshold.

- **Effort**: 1-2 days | **Impact**: MEDIUM
- **Files**: `mcp/client.ts`, `mcp/manager.ts`

### 6.6 Stdio Transport Reconnection [MEDIUM]

**Current**: SSE has reconnection (5 attempts with backoff), stdio has none.

**Proposed**: Auto-restart child process on unexpected exit.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `mcp/transports/stdio.ts`

### 6.7 Worktree Merge-Back [MEDIUM]

**Current**: Worktree changes are lost after force-delete.

**Proposed**: Add `mergeBack` option. Descriptive branch names. Conflict reporting.

- **Effort**: 2-3 days | **Impact**: MEDIUM
- **Files**: `subagents/spawner.ts`

### 6.8 Frontmatter Parser Deduplication [LOW]

**Current**: Identical parsers in `skills/loader.ts` and `subagents/definition-loader.ts`.

**Proposed**: Extract to shared `utils/frontmatter.ts`.

- **Effort**: 0.5 day | **Impact**: LOW (code quality)

### 6.9 Agent Definition: Wire Hooks from Frontmatter [LOW]

**Current**: `AgentHookConfig` type exists in `definition-types.ts` but NOT in Zod schema.
Hook conversion code is ready but can't be triggered.

**Proposed**: Add hooks field to `agentDefinitionSchema`.

- **Effort**: 0.5 day | **Impact**: MEDIUM
- **Files**: `subagents/definition-types.ts`, `subagents/spawner.ts`

### 6.10 System Prompt Token Impact

| Section              | Priority | Tokens (current) | Tokens (after Tool Search) |
| -------------------- | -------- | ---------------- | -------------------------- |
| MCP tools            | 82       | **5K-50K**       | **500-1K**                 |
| Identity             | 100      | ~200             | ~200                       |
| Tools (built-in)     | 85       | ~500             | ~500                       |
| Skills               | 78       | ~100-500         | ~100-500                   |
| Project instructions | 70       | variable         | variable                   |
| Auto-memory          | 72       | ~200-2K          | ~200-2K                    |

**MCP Tool Search alone saves 85-95% of the largest system prompt section.**

---

## Part VII: Developer Experience & Missing Commands

> Analyst: **dx-competitive** | Files: 7 | Lines: ~1,500

### 7.1 Fix /context Command [P0]

**Current**: Hardcoded to show 0% usage. Not wired to actual ContextManager state.

- **Effort**: 0.5 day | **Impact**: P0 (broken feature)
- **Files**: `commands/context.ts`

### 7.2 Fix Setup Wizard i18n [P0]

**Current**: Korean strings in setup wizard presets. Should be English-first.

- **Effort**: 0.25 day | **Impact**: P0 (first-run experience)
- **Files**: `index.ts` (setup wizard section)

### 7.3 Multi-Provider Setup Wizard [HIGH]

**Current**: OpenAI-only presets. No Anthropic, Gemini, or local model options.

**Proposed**: Provider selection first (OpenAI/Anthropic/Google/Local/Custom),
then model presets per provider.

- **Effort**: 1 day | **Impact**: HIGH (core differentiator)
- **Files**: `index.ts`

### 7.4 Missing Critical Slash Commands

| Command    | Priority | Description                          | Effort  |
| ---------- | -------- | ------------------------------------ | ------- |
| `/commit`  | **P0**   | AI-generated commit message + commit | 1 day   |
| `/review`  | **P0**   | Code review current changes          | 1 day   |
| `/pr`      | **P0**   | Create pull request from context     | 1 day   |
| `/test`    | **HIGH** | Run tests and analyze failures       | 1 day   |
| `/login`   | **HIGH** | Authentication management            | 0.5 day |
| `/search`  | MEDIUM   | Web search within session            | 0.5 day |
| `/image`   | MEDIUM   | Screenshot/diagram analysis          | 0.5 day |
| `/profile` | LOW      | Switch config profiles               | 0.5 day |
| `/theme`   | LOW      | UI theme picker                      | 1 day   |
| `/fleet`   | LOW      | Launch specialized agent fleet       | 2 days  |

### 7.5 CI/CD Integration Gaps

| Gap                   | Priority | Description                          |
| --------------------- | -------- | ------------------------------------ |
| Semantic exit codes   | **HIGH** | 0=success, 1=error, 2=no changes     |
| `--auto-approve` flag | **HIGH** | Non-interactive tool approval for CI |
| stdin piping          | **HIGH** | `git diff \| dhelix -p "review"`     |
| `--max-cost` flag     | MEDIUM   | Cost guard for CI runs               |
| GitHub Actions action | MEDIUM   | Official `dhelix-action`             |
| Artifact output       | LOW      | Structured CI output (patches, PRs)  |

### 7.6 Enhanced /doctor Command [HIGH]

**Current**: Only 4 basic checks (Node.js, Git, Git repo, Model config).

**Proposed**: Add API key validation, network connectivity, MCP server health,
disk space, permission config, hook config validation.

- **Effort**: 1 day | **Impact**: HIGH
- **Files**: `commands/doctor.ts`

### 7.7 ACP (Agent Client Protocol) Support [MEDIUM]

**Current**: No ACP support. JetBrains and Zed are adopting ACP.

**Proposed**: Expose dhelix as ACP-compatible agent for IDE integration.
Current architecture (tool registry + agent loop) maps cleanly to ACP.

- **Effort**: 3-5 days | **Impact**: HIGH (IDE integration)

### 7.8 Built-in Specialized Agents [MEDIUM]

**Current**: 3 generic types (explore/plan/general) + custom definitions.

**Proposed**: Ship built-in specialized agents:

- `reviewer` — Code review with severity classification
- `tester` — Test execution and analysis
- `security-scanner` — Security vulnerability detection
- `doc-writer` — Documentation generation

- **Effort**: 2-3 days | **Impact**: MEDIUM
- **Files**: New `.dhelix/agents/` defaults

### 7.9 Startup Performance

**Potential bottlenecks identified**:

1. 30+ parallel dynamic imports at startup
2. Skill loading from 4 directories (filesystem I/O)
3. No startup time measurement
4. Eager shiki loading (heavy dependency)

**Proposed**: Add `--timing` flag, lazy-load shiki, bundle critical path modules.

---

## Part VIII: Testing & Quality

> Analyst: **testing-quality** | Files: 131 tests | 2,312 test cases

### Testing Maturity: 7.2/10

### Current State

| Metric         | Value                                            |
| -------------- | ------------------------------------------------ |
| Test files     | 131 (123 passing, 8 failing)                     |
| Test cases     | 2,312 (2,277 passing, 35 failing)                |
| Execution time | ~17s                                             |
| LLM mocking    | Excellent (3 patterns, no real API calls)        |
| CI pipeline    | GitHub Actions (typecheck → lint → test → build) |

### 8.1 Fix 35 Failing Tests [P0]

**Root causes**:

1. `persistent-store.test.ts` (18 failures) — Constructor API changed
2. `config/loader.test.ts` (2) — Default model changed to `gpt-5.1-codex-mini`
3. `memory-command.test.ts` (5) — Output format changed
4. `platform.test.ts` (4) — `/bin/bash` assumption on macOS
5. `config/defaults.test.ts` (2) — Default values changed
6. Others (4) — Minor schema/loader changes

- **Effort**: 1-2 days | **Impact**: P0 (CI must be green)

### 8.2 Missing Critical Test Files [HIGH]

| Missing Test                 | Priority | Reason                                      |
| ---------------------------- | -------- | ------------------------------------------- |
| `responses-client.test.ts`   | HIGH     | New file, zero tests, used by default model |
| `injection-detector.test.ts` | HIGH     | Security-critical, no dedicated tests       |
| `agent.test.ts` (tool def)   | HIGH     | Complex subagent spawning, untested         |
| `output-limiter.test.ts`     | MEDIUM   | No tests                                    |
| `path-filter.test.ts`        | MEDIUM   | No tests                                    |
| `mcp/manager.test.ts`        | MEDIUM   | No dedicated tests                          |

### 8.3 CLI Component Tests are Shallow [MEDIUM]

**Current**: Tests mostly verify exports exist. No `ink-testing-library` rendering tests.

**Proposed**: Add proper Ink component tests for ActivityFeed, ToolCallBlock, StatusBar,
PermissionPrompt using `ink-testing-library`.

- **Effort**: 2-3 days | **Impact**: MEDIUM

### 8.4 Coverage Thresholds [MEDIUM]

**Current**: No thresholds configured. Coverage can silently regress.

**Proposed**: Add to `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    statements: 70,
    branches: 60,
    functions: 65,
    lines: 70,
  }
}
```

### 8.5 CI/CD Improvements

| Improvement               | Priority | Description                   |
| ------------------------- | -------- | ----------------------------- |
| Coverage thresholds       | HIGH     | Prevent silent regression     |
| Node version matrix       | MEDIUM   | Test on Node 20.x + 22.x      |
| Circular dependency check | MEDIUM   | `madge --circular src/` in CI |
| E2E test job (scheduled)  | MEDIUM   | Run smoke tests on schedule   |
| Pre-commit hooks          | LOW      | husky + lint-staged           |
| Coverage PR comments      | LOW      | vitest-coverage-report action |

### 8.6 Shared LLM Mock Factory [MEDIUM]

**Current**: 3 different mock patterns duplicated across test files.

**Proposed**: Create `test/helpers/mock-llm.ts` with:

- `createMockProvider(responses)` — full provider mock
- `createMockStream(chunks)` — streaming mock
- `createMockToolResult(name, output)` — tool result mock

### 8.7 ESLint Rule Additions [LOW]

- `@typescript-eslint/no-floating-promises` — catches unhandled async errors
- `@typescript-eslint/strict-boolean-expressions` — prevents truthiness bugs
- Import ordering rules

---

## Part IX: Master Priority Matrix

### P0 — Ship This Week (12 items)

| #   | Item                                            | Category | Effort | Impact                   |
| --- | ----------------------------------------------- | -------- | ------ | ------------------------ |
| 1   | Fix 35 failing tests                            | Testing  | 1-2d   | CI health                |
| 2   | ResponsesAPIClient add retry logic              | LLM      | 0.5d   | Default model resilience |
| 3   | Fix abort signal memory leak                    | LLM      | 15min  | Correctness              |
| 4   | Update model capabilities (Claude 4.x, GPT-4.1) | LLM      | 0.5d   | Model support            |
| 5   | Fix /context command (0% hardcoded)             | DX       | 0.5d   | Broken feature           |
| 6   | Fix setup wizard i18n                           | DX       | 0.25d  | First-run UX             |
| 7   | Show diff by default (one-line change)          | UI       | 0.25d  | Biggest visual win       |
| 8   | Add working timer to Spinner                    | UI       | 0.25d  | Perceived responsiveness |
| 9   | Wire token/cost events to StatusBar             | UI       | 1d     | Real-time feedback       |
| 10  | Format permission arguments (not raw JSON)      | UI       | 0.5d   | Permission UX            |
| 11  | Add /commit command                             | DX       | 1d     | Table stakes             |
| 12  | Add /review command                             | DX       | 1d     | Table stakes             |

**Total P0 effort: ~7 days**

### P1 — Ship This Month (20 items)

| #   | Item                                        | Category | Effort |
| --- | ------------------------------------------- | -------- | ------ |
| 13  | MCP Tool Search / Deferred Loading          | MCP      | 3-5d   |
| 14  | grep_search → ripgrep wrapper               | Tools    | 1-2d   |
| 15  | Session resumption with context restoration | Core     | 8-12h  |
| 16  | Connect shiki syntax highlighting           | UI       | 0.5-1d |
| 17  | ! Bash mode                                 | UI       | 0.5d   |
| 18  | Inline permission deny feedback             | UI       | 0.5d   |
| 19  | "Always" persistent permission              | UI       | 0.5d   |
| 20  | Per-category auto-approve                   | Security | 1-2d   |
| 21  | bash_exec output size limit                 | Tools    | 0.5d   |
| 22  | Tool metadata system                        | Tools    | 1-2d   |
| 23  | Multi-provider setup wizard                 | DX       | 1d     |
| 24  | Unify error classification                  | LLM      | 0.5d   |
| 25  | Adaptive compaction threshold               | Core     | 3-4h   |
| 26  | Rate-limit header awareness                 | Core     | 3-4h   |
| 27  | Async git context + caching                 | Core     | 4-6h   |
| 28  | Circuit breaker for providers               | LLM      | 1-2d   |
| 29  | CI semantic exit codes                      | DX       | 0.5d   |
| 30  | --auto-approve flag for CI                  | DX       | 0.5d   |
| 31  | Command filter bypass hardening             | Security | 0.5d   |
| 32  | Wire unimplemented security config          | Security | 2-3d   |

**Total P1 effort: ~25-35 days**

### P2 — Ship Next Quarter (30+ items)

| #   | Item                                   | Category   | Effort |
| --- | -------------------------------------- | ---------- | ------ |
| 33  | Summarization caching                  | Core       | 6-8h   |
| 34  | Content-addressable checkpoint storage | Core       | 8-12h  |
| 35  | Checkpoint auto-pruning                | Core       | 3-4h   |
| 36  | Agent Teams shared task list           | MCP/Agents | 2-3d   |
| 37  | Agent Teams inter-agent messaging      | MCP/Agents | 2-3d   |
| 38  | Word-level diff highlighting           | UI         | 1d     |
| 39  | Ctrl+R reverse history search          | UI         | 1d     |
| 40  | Completion notification                | UI         | 0.5d   |
| 41  | /btw side questions                    | UI         | 1d     |
| 42  | Esc+Esc rewind menu                    | UI         | 2d     |
| 43  | Customizable statusline                | UI         | 2d     |
| 44  | Interactive /diff viewer               | UI         | 2d     |
| 45  | Stream resumption on failure           | LLM        | 2-3d   |
| 46  | Cost budget alerts                     | LLM        | 1d     |
| 47  | Multi-tokenizer support                | LLM        | 1-2d   |
| 48  | PII detection in output                | Security   | 1-2d   |
| 49  | Windows native sandbox                 | Security   | 3-5d   |
| 50  | OWASP code generation scanner          | Security   | 2-3d   |
| 51  | Skills hot-reload                      | Skills     | 1-2d   |
| 52  | MCP health monitoring                  | MCP        | 1-2d   |
| 53  | Worktree merge-back                    | Agents     | 2-3d   |
| 54  | /test command                          | DX         | 1d     |
| 55  | /pr command                            | DX         | 1d     |
| 56  | Enhanced /doctor                       | DX         | 1d     |
| 57  | Gemini provider routing                | LLM        | 1-2d   |
| 58  | ACP support                            | DX         | 3-5d   |
| 59  | Concurrency limiter for tools          | Tools      | 1d     |
| 60  | Semantic rehydration                   | Core       | 6-8h   |
| 61  | Consolidate bubblewrap                 | Security   | 0.5d   |
| 62  | Injection detector context awareness   | Security   | 0.5d   |

### P3 — Backlog (30+ items)

Includes: /theme picker, prompt suggestions, /copy code picker, Vim mode,
agent composition, skill marketplace, container sandbox, OS keychain,
code_search AST tool, voice commands, and more.

---

## Part X: Sprint Plan

### Sprint 1: "Foundation Fix" (Week 1, 5 days)

```
Day 1-2: Fix 35 failing tests + CI green
Day 2:   P0 LLM fixes (retry, memory leak, models)
Day 3:   P0 UI fixes (diff default, timer, token counter)
Day 3:   P0 DX fixes (/context, i18n)
Day 4:   /commit and /review commands
Day 5:   Permission argument formatting + remove "assistant:" label
```

**Deliverable**: CI green, real-time feedback, critical commands

### Sprint 2: "Performance & Search" (Week 2, 5 days)

```
Day 1-2: grep_search → ripgrep wrapper
Day 2-3: bash_exec output limit + glob_search result limit
Day 3-4: Tool metadata system + concurrency limiter
Day 4-5: Multi-provider setup wizard
```

**Deliverable**: 100x search performance, tool system hardening

### Sprint 3: "MCP & Context" (Week 3-4, 10 days)

```
Day 1-5:  MCP Tool Search / Deferred Loading (CRITICAL)
Day 6-7:  Session resumption with context restoration
Day 8:    Adaptive compaction threshold + rate-limit headers
Day 9:    Async git context + caching
Day 10:   Circuit breaker for providers
```

**Deliverable**: 85-95% MCP token savings, production resilience

### Sprint 4: "Input Experience" (Week 5, 5 days)

```
Day 1:   ! Bash mode
Day 1:   Connect shiki syntax highlighting
Day 2:   Inline permission deny feedback + "Always" persist
Day 3:   Per-category auto-approve toggles
Day 4:   CI improvements (exit codes, --auto-approve)
Day 5:   Command filter hardening + wire security config
```

**Deliverable**: Claude Code-level input UX, CI readiness

### Sprint 5: "Agent Teams & Advanced UI" (Week 6-8, 15 days)

```
Day 1-3:  Agent Teams shared task list
Day 4-6:  Agent Teams inter-agent messaging
Day 7:    Word-level diff + Ctrl+R reverse search
Day 8-9:  Keybinding chords + Esc+Esc rewind
Day 10-11: Customizable statusline
Day 12-13: Interactive /diff viewer
Day 14-15: /btw side questions + completion notification
```

**Deliverable**: Full Agent Teams, advanced CLI UI

### Sprint 6+: "Hardening & Differentiation" (Ongoing)

```
- Summarization caching
- Content-addressable checkpoints
- Stream resumption
- PII detection
- Windows sandbox
- ACP support
- Built-in specialized agents
- Gemini provider
```

---

## Part XI: Risk Assessment

| Risk                                      | Impact               | Probability | Mitigation                                         |
| ----------------------------------------- | -------------------- | ----------- | -------------------------------------------------- |
| grep_search ripgrep not installed         | Performance fallback | Medium      | Keep JS fallback, auto-detect `rg` in PATH         |
| MCP Tool Search breaks existing workflows | User disruption      | Low         | Feature flag + gradual rollout                     |
| shiki async init blocks rendering         | Startup delay        | Medium      | Dynamic import + eager singleton cache             |
| Checkpoint storage migration              | Data loss            | Low         | Versioned checkpoint format, auto-migrate          |
| 35 test fixes cascade                     | More broken tests    | Medium      | Fix in dependency order, run full suite after each |
| Agent Teams message flooding              | Token waste          | Medium      | Message rate limiting + queue depth control        |
| Windows sandbox complexity                | Platform issues      | High        | Phased approach, community testing                 |
| Context resumption state corruption       | Session loss         | Medium      | Validation + fallback to fresh state               |
| DEC Mode 2026 terminal compat             | Visual glitches      | Low         | Graceful fallback, terminal detection              |
| Multi-tokenizer accuracy gaps             | Bad compaction       | Medium      | Conservative estimates for unknown tokenizers      |

---

## Part XII: Metrics & Success Criteria

### Sprint 1 Success

- [ ] CI: 0 failing tests, all checks green
- [ ] StatusBar: Real-time `↑Nk ↓Mk $0.XX` token/cost display
- [ ] ToolCallBlock: Diff visible by default without verbose mode
- [ ] Spinner: "Thinking... (3s)" elapsed time display
- [ ] /context: Shows actual context % (not 0%)
- [ ] /commit and /review commands functional

### Sprint 2 Success

- [ ] grep_search: <100ms on 10K file repos (vs ~10s current)
- [ ] bash_exec: Output capped at 1MB with truncation notice
- [ ] Setup wizard: Provider selection → model selection flow

### Sprint 3 Success

- [ ] MCP tools: 85%+ token reduction in system prompt
- [ ] Session resume: Full context state restoration
- [ ] Provider failures: Circuit breaker prevents cascade

### Sprint 4 Success

- [ ] ! Bash mode: Direct shell execution working
- [ ] Permission deny: Feedback text reaches agent
- [ ] CI mode: Semantic exit codes + --auto-approve

### Sprint 5 Success

- [ ] Agent Teams: Shared task list with claim/complete
- [ ] Agent messaging: Mid-execution communication working
- [ ] Rewind: Esc+Esc shows checkpoint selection menu

---

## Appendix A: File Change Summary

### Files to Modify (30+)

| File                                      | Sprints | Changes                                                       |
| ----------------------------------------- | ------- | ------------------------------------------------------------- |
| `src/core/agent-loop.ts`                  | 1,3,4   | Retry headers, budget warning, deny feedback                  |
| `src/core/context-manager.ts`             | 3       | Adaptive threshold, summarization cache, semantic rehydration |
| `src/core/checkpoint-manager.ts`          | P2      | Content-addressable storage, auto-pruning                     |
| `src/core/system-prompt-builder.ts`       | 3       | Async git, deferred tools rendering                           |
| `src/core/session-manager.ts`             | 3       | Context state persistence                                     |
| `src/llm/responses-client.ts`             | 1       | Add retry logic                                               |
| `src/llm/model-capabilities.ts`           | 1       | Add modern models                                             |
| `src/llm/model-router.ts`                 | 3,P2    | Circuit breaker, health monitoring                            |
| `src/llm/providers/anthropic.ts`          | 1       | Fix abort leak, timeout refresh                               |
| `src/llm/cost-tracker.ts`                 | P2      | Budget alerts, unified pricing                                |
| `src/llm/token-counter.ts`                | P2      | Multi-tokenizer, larger cache                                 |
| `src/tools/definitions/grep-search.ts`    | 2       | ripgrep wrapper                                               |
| `src/tools/definitions/bash-exec.ts`      | 2       | Output size limit                                             |
| `src/tools/definitions/glob-search.ts`    | 2       | Result limit                                                  |
| `src/tools/definitions/file-edit.ts`      | 2       | Diff output                                                   |
| `src/tools/types.ts`                      | 2       | ToolMetadata interface                                        |
| `src/tools/registry.ts`                   | 2,3     | Metadata, deferred registration                               |
| `src/tools/executor.ts`                   | 2       | Concurrency limiter, timing metrics                           |
| `src/cli/components/ToolCallBlock.tsx`    | 1,4     | Diff default, word-level                                      |
| `src/cli/components/StatusBar.tsx`        | 1,5     | Token counter, responsive                                     |
| `src/cli/components/Spinner.tsx`          | 1       | Working timer                                                 |
| `src/cli/components/StreamingMessage.tsx` | 1       | Remove "assistant:"                                           |
| `src/cli/components/PermissionPrompt.tsx` | 4       | Deny feedback, "Always"                                       |
| `src/cli/components/UserInput.tsx`        | 4       | ! bash, Ctrl+R                                                |
| `src/cli/hooks/useAgentLoop.ts`           | 1,4     | Usage events, notification                                    |
| `src/cli/renderer/markdown.ts`            | 4       | Shiki integration                                             |
| `src/cli/App.tsx`                         | 1,5     | StatusBar wiring, keybindings                                 |
| `src/mcp/tool-bridge.ts`                  | 3       | Deferred loading                                              |
| `src/permissions/manager.ts`              | 4       | Category auto-approve, deny feedback                          |
| `src/config/schema.ts`                    | 4       | Category permissions, notification                            |
| `src/guardrails/command-filter.ts`        | 4       | Bypass hardening                                              |
| `src/index.ts`                            | 1       | Setup wizard, CostTracker wiring                              |
| `src/subagents/shared-state.ts`           | 5       | Task list, messaging                                          |

### New Files to Create (15+)

| File                                         | Sprint | Description                  |
| -------------------------------------------- | ------ | ---------------------------- |
| `src/tools/definitions/tool-search.ts`       | 3      | MCP Tool Search tool         |
| `src/tools/definitions/multi-file-edit.ts`   | P2     | Atomic multi-file edits      |
| `src/commands/commit.ts`                     | 1      | AI commit command            |
| `src/commands/review.ts`                     | 1      | Code review command          |
| `src/commands/test.ts`                       | P2     | Test runner command          |
| `src/commands/pr.ts`                         | P2     | PR creation command          |
| `src/llm/circuit-breaker.ts`                 | 3      | Circuit breaker pattern      |
| `src/llm/error-classifier.ts`                | 3      | Unified error classification |
| `src/guardrails/pii-scanner.ts`              | P2     | PII detection                |
| `src/guardrails/code-scanner.ts`             | P2     | OWASP vulnerability scanner  |
| `src/permissions/audit-log.ts`               | P2     | Audit trail                  |
| `src/cli/components/RewindMenu.tsx`          | 5      | Esc+Esc rewind overlay       |
| `src/cli/components/SideQuestionOverlay.tsx` | 5      | /btw overlay                 |
| `src/cli/components/DiffViewer.tsx`          | 5      | Interactive diff             |
| `test/helpers/mock-llm.ts`                   | 1      | Shared LLM mock factory      |

---

## Appendix B: Competitive Intelligence Sources (March 2026)

| Source                | Key Data                                |
| --------------------- | --------------------------------------- |
| Claude Code Changelog | Agent Teams, MCP Tool Search, ACP       |
| Codex CLI GitHub      | Rust/Ratatui rewrite, GPT-5.x           |
| Copilot CLI Blog      | GA Feb 2026, /fleet, specialized agents |
| Cline CLI 2.0 Launch  | Parallel agents, ACP, free models       |
| Gemini CLI Release    | 1M context, Conductor, open-source      |
| Cursor CLI            | 8 parallel agents, <200ms completions   |
| JetBrains ACP         | Agent Client Protocol standard          |

---

## Appendix C: Analysis Team

| Specialist           | Scope             | Files Analyzed              | Improvements Found        |
| -------------------- | ----------------- | --------------------------- | ------------------------- |
| core-architect       | Core Engine       | 8 files, ~3,000 lines       | 22                        |
| llm-specialist       | LLM Layer         | 12 files, ~2,500 lines      | 26                        |
| tools-expert         | Tool System       | 20 files, ~2,500 lines      | 12 + 5 new tools          |
| ui-renderer          | CLI UI/Rendering  | 17 files, ~2,500 lines      | 31 (23 validated + 8 new) |
| permissions-security | Security          | 22 files, ~2,200 lines      | 19 + 5 dead code items    |
| mcp-skills           | MCP/Skills/Agents | 22 files, ~2,200 lines      | 16                        |
| dx-competitive       | DX/Commands       | 7 files + web research      | 22 + competitive matrix   |
| testing-quality      | Testing/Quality   | 131 test files, 2,312 cases | 12 + CI improvements      |
| **Total**            | **Full codebase** | **27,287 lines**            | **160 improvements**      |
