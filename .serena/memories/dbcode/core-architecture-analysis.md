# DBCODE Core Architecture Analysis Summary

**Date:** 2026-03-11
**Overall Readiness:** 82% (vs Claude Code: 95%)

## 10 Core Components (Production Readiness)

| Component | Status | Readiness | Key Gap |
|-----------|--------|-----------|---------|
| Agent Loop (600 LOC) | ✓ | 85% | Needs error context in LLM |
| Context Manager (450 LOC) | ✓ | 88% | **Compaction blocks agent loop** |
| Session Manager (400 LOC) | ✓ | 82% | **No cleanup—accumulates forever** |
| Checkpoint Manager (350 LOC) | ✓ | 87% | No compression (should gzip) |
| System Prompt Builder (300 LOC) | ✓ | 93% | Rebuilt every iteration (minor) |
| Tool System (2500 LOC, 14 tools) | ✓ | 87% | **Result truncation loses context** |
| Subagents (800 LOC) | ⚠️ | 78% | **History in-memory only** |
| MCP Integration (400 LOC) | ⚠️ | 65% | **Only stdio transport** |
| Streaming (250 LOC) | ✓ | 84% | No backoff on reconnect |
| Guardrails (300 LOC) | ⚠️ | 58% | **Missing injection detection** |

## Top Production Gaps (Ranked by Impact)

1. **Guardrails Completeness** — Missing SQL injection, path traversal, XSS, code injection
2. **MCP Transport Support** — Only stdio; needs WebSocket/SSE
3. **Session Cleanup** — No retention policy; sessions accumulate
4. **Subagent History Persistence** — Doesn't survive restart (in-memory only)
5. **Checkpoint Compression** — No gzip compression
6. **Compaction Observability** — No metrics on compression
7. **Tool Caching** — No file-based cache for repeated operations
8. **Streaming Reconnect** — No exponential backoff
9. **System Prompt Caching** — Rebuilt every iteration
10. **Tool Semantic Summarization** — Truncation loses context

## Architecture Strengths

✅ Modular layering (agent → context → session → checkpoint)
✅ Event-driven (mitt-based)
✅ Cross-platform (macOS, Windows)
✅ Type-safe (TypeScript + Zod)
✅ Immutable state
✅ Timeout-safe (AbortSignal threading)
✅ Token-aware budgeting

## Architecture Weaknesses

⚠️ Blocking compaction (freezes agent loop)
⚠️ Memory leaks (no cleanup)
⚠️ Limited guardrails (only secret + command)
⚠️ No isolation for tools
⚠️ No observability/metrics

## Key Implementation Details

**Agent Loop (runAgentLoop):**
- Max iterations: 50
- Retry strategy: classify-retry-fallback (transient/overload/permanent)
- Tool grouping: read-only parallel, file writes sequential by path
- Parallel execution: Promise.allSettled with per-tool timeouts
- Preflight checks: Permission + input guardrails
- Auto-checkpoint: Before file-modifying tools
- Result truncation: Token-aware with binary search

**Context Manager (3-layer):**
- Layer 1: Cold storage (file_read, bash_exec, grep_search, glob_search outputs)
- Layer 2: LLM-based summarization at 83.5% threshold
- Layer 3: Rehydration of 5 most recent file results
- Trigger: maxContextTokens config
- **Gap:** Blocking (should be background async)

**Session Manager:**
- Format: JSONL append-only (durable)
- Structure: ~/.dbcode/sessions/{sessionId}/messages.jsonl
- Atomic: write-temp + rename
- Locking: mkdir-based with stale detection (5s timeout)
- **Gap:** No cleanup policy

**Tool System (14 tools):**
- Timeouts: bash=2min, default=30s
- Validation: Zod schema at boundaries
- Guardrails: Input (command filter, secret scan) + output (truncate, redact)
- Execution: Promise.allSettled with AbortSignal
- **Gap:** Result truncation can be lossy

## Recommendations (Tier 1: Must Have)

- [ ] Complete guardrails (OWASP injection detection)
- [ ] Session cleanup + retention policy
- [ ] MCP WebSocket/SSE transports
- [ ] Subagent history persistence (disk-based)

## Full Report

See: `/Users/pyeondohun/development/dbcode/CORE_ARCHITECTURE_ANALYSIS.md` (40+ pages)
