# dhelix vs Claude Code 격차 분석 및 해소 방안

> **Version**: v2.0
> **Date**: 2026-03-13
> **Status**: v1 구현 완료 → 격차 분석 → v2 로드맵 수립
> **Base**: 3366 tests / Phase 1~5 구현 완료 / 0 TS errors / 0 circular deps

---

## 목차

1. [v1 구현 결과 요약](#v1-구현-결과-요약)
2. [핵심 코어 기능 비교](#핵심-코어-기능-비교)
3. [사용자 편의성 비교](#사용자-편의성-비교)
4. [격차 분석 (Critical → Nice-to-have)](#격차-분석)
5. [해소 로드맵](#해소-로드맵)

---

## v1 구현 결과 요약

| Phase    | 기능                                      | 상태    | 신규 파일    | 변경 파일      |
| -------- | ----------------------------------------- | ------- | ------------ | -------------- |
| 1        | Cost 시스템 (SSOT + 이벤트 연결)          | ✅ 완료 | 0            | 6              |
| 1.5      | AgentStatus (한국어 상태 메시지)          | ✅ 완료 | 2            | 1              |
| 2        | SelectList + Interactive /resume, /model  | ✅ 완료 | 2            | 7              |
| 3        | /tone + 한국어 기본 로캘 시스템           | ✅ 완료 | 4            | 7              |
| 4        | 저성능 모델 코어 (tier + JSON 복구 + CoT) | ✅ 완료 | 2            | 8              |
| 5        | 음성 입력 (SoX + Whisper)                 | ✅ 완료 | 9            | 3              |
| **합계** |                                           |         | **19 files** | **32 changes** |

---

## 핵심 코어 기능 비교

### 1. Agent Loop (ReAct Pattern)

| 기능                                   | Claude Code                    | dhelix        | 격차                     |
| -------------------------------------- | ------------------------------ | ------------- | ------------------------ |
| ReAct Loop (Observe → Think → Act)     | ✅ 완벽                        | ✅ 완벽       | ⬜ 없음                  |
| Max iterations + infinite loop 방지    | ✅ 50회                        | ✅ 50회       | ⬜ 없음                  |
| Tool timeout (bash 120s, file ops 30s) | ✅                             | ✅            | ⬜ 없음                  |
| Parallel tool execution (read-only)    | ✅                             | ✅            | ⬜ 없음                  |
| Auto-checkpoint before file writes     | ✅                             | ✅            | ⬜ 없음                  |
| **Agentic sub-task delegation**        | ✅ Agent tool → worktree       | ✅ agent tool | 🟡 worktree 미지원       |
| **Multi-turn plan mode**               | ✅ /plan으로 계획 수립 후 실행 | ✅ /plan 존재 | 🟡 plan 실행 자동화 부족 |
| **Extended thinking budget**           | ✅ 모델별 자동 조절            | ✅ Alt+T 토글 | 🟡 자동 예산 조절 없음   |

### 2. Context Management

| 기능                                                | Claude Code               | dhelix                       | 격차           |
| --------------------------------------------------- | ------------------------- | ---------------------------- | -------------- |
| 3-Layer compaction (micro → structured → rehydrate) | ✅                        | ✅                           | ⬜ 없음        |
| Auto-compaction at threshold (83.5%)                | ✅                        | ✅                           | ⬜ 없음        |
| Cold storage (content-addressable)                  | ✅                        | ✅                           | ⬜ 없음        |
| Post-compaction file rehydration                    | ✅                        | ✅ (recency/frequency/mixed) | ⬜ 없음        |
| **Tier-based compaction**                           | ❌ 불필요 (고성능 모델만) | ✅ v1에서 추가               | ⬜ dhelix 우위 |
| **Conversation fork/branch**                        | ✅ 대화 분기              | ✅ /fork 지원                | ⬜ 없음        |

### 3. Tool System

| 기능                                       | Claude Code            | dhelix                      | 격차          |
| ------------------------------------------ | ---------------------- | --------------------------- | ------------- |
| Built-in tools 수                          | ~15                    | 14                          | ⬜ 유사       |
| Zod schema validation                      | ✅                     | ✅                          | ⬜ 없음       |
| Permission levels (safe/confirm/dangerous) | ✅ (auto/allowlisted)  | ✅ (safe/confirm/dangerous) | ⬜ 유사       |
| MCP server support                         | ✅ (stdio + SSE)       | ✅ (stdio JSON-RPC)         | 🟡 SSE 미지원 |
| **Deferred tool loading**                  | ✅ lazy schema fetch   | ❌                          | 🔴 미구현     |
| **Tool result streaming**                  | ✅ 큰 출력 점진적 표시 | ❌ 전체 대기                | 🔴 미구현     |
| **Computer use (browser, desktop)**        | ✅ 실험적              | ❌                          | 🟡 로드맵     |

### 4. LLM Provider

| 기능                                            | Claude Code                | dhelix             | 격차           |
| ----------------------------------------------- | -------------------------- | ------------------ | -------------- |
| Multi-provider (Anthropic, OpenAI, etc.)        | ✅ Anthropic 네이티브      | ✅ OpenAI SDK 호환 | ⬜ 접근 다름   |
| Dual tool-call strategy (native + text-parsing) | ❌ native only             | ✅                 | ⬜ dhelix 우위 |
| **JSON 복구 (malformed output)**                | ❌ 불필요                  | ✅ v1에서 추가     | ⬜ dhelix 우위 |
| **Model capability tier system**                | ❌ 불필요                  | ✅ v1에서 추가     | ⬜ dhelix 우위 |
| **Streaming token counting**                    | ✅ 실시간                  | ✅ v1에서 수정     | ⬜ 없음        |
| **Token-level cost tracking**                   | ✅ 정확한 비용 추적        | ✅ v1에서 수정     | ⬜ 없음        |
| **Prompt caching**                              | ✅ Anthropic cache_control | ❌                 | 🔴 미구현      |

### 5. System Prompt

| 기능                                             | Claude Code    | dhelix         | 격차           |
| ------------------------------------------------ | -------------- | -------------- | -------------- |
| Priority-based modular sections                  | ✅             | ✅             | ⬜ 없음        |
| Per-section token budgets                        | ✅             | ✅             | ⬜ 없음        |
| Conditional sections (plan mode, subagent, etc.) | ✅             | ✅             | ⬜ 없음        |
| Git context detection                            | ✅             | ✅             | ⬜ 없음        |
| Project type detection                           | ✅             | ✅             | ⬜ 없음        |
| **Locale section**                               | ❌ (영어 전용) | ✅ v1에서 추가 | ⬜ dhelix 우위 |
| **Tone profiles**                                | ❌             | ✅ v1에서 추가 | ⬜ dhelix 우위 |
| **CoT scaffolding (low-tier)**                   | ❌             | ✅ v1에서 추가 | ⬜ dhelix 우위 |

---

## 사용자 편의성 비교

### UI/UX

| 기능                                       | Claude Code       | dhelix                 | 격차           |
| ------------------------------------------ | ----------------- | ---------------------- | -------------- |
| Progressive static flushing (anti-flicker) | ✅                | ✅                     | ⬜ 없음        |
| Synchronized output (DEC 2026)             | ✅                | ✅                     | ⬜ 없음        |
| **Rich status line (cost, tokens, model)** | ✅ 항상 정확      | ✅ v1에서 수정         | ⬜ 없음        |
| **AgentStatus (fun messages)**             | ✅ 영어           | ✅ 한국어 v1           | ⬜ dhelix 우위 |
| **Interactive selection (SelectList)**     | ✅                | ✅ v1에서 추가         | ⬜ 없음        |
| **Diff preview before edits**              | ✅ 패치 형태      | ✅ search/replace 표시 | ⬜ 유사        |
| **Image/PDF inline display**               | ✅ 멀티모달       | ✅ (file_read 지원)    | ⬜ 없음        |
| **Markdown rendering in terminal**         | ✅ rich rendering | 🟡 기본적              | 🟡 개선 필요   |
| **Syntax highlighting in output**          | ✅ 완벽           | 🟡 기본적              | 🟡 개선 필요   |

### Slash Commands

| 기능                        | Claude Code    | dhelix                | 격차              |
| --------------------------- | -------------- | --------------------- | ----------------- |
| 총 커맨드 수                | ~25            | 28 (v1 후)            | ⬜ dhelix 우위    |
| /compact (수동 compaction)  | ✅             | ✅                    | ⬜ 없음           |
| /resume (세션 복원)         | ✅ interactive | ✅ v1에서 interactive | ⬜ 없음           |
| /model (모델 전환)          | ✅ interactive | ✅ v1에서 interactive | ⬜ 없음           |
| /tone (응답 스타일)         | ❌             | ✅ v1에서 추가        | ⬜ dhelix 우위    |
| /voice (음성 입력)          | ❌             | ✅ v1에서 추가        | ⬜ dhelix 우위    |
| **/doctor (환경 진단)**     | ✅ 포괄적 진단 | ✅ 기본적             | 🟡 진단 범위 좁음 |
| **/bug (자동 이슈 리포트)** | ✅             | ❌                    | 🟡 미구현         |
| **/login (인증)**           | ✅ OAuth       | ❌ (API 키만)         | 🟡 미구현         |

### 설정 & 커스터마이징

| 기능                                | Claude Code  | dhelix          | 격차    |
| ----------------------------------- | ------------ | --------------- | ------- |
| CLAUDE.md / DHELIX.md 프로젝트 설정 | ✅           | ✅              | ⬜ 없음 |
| 5-level config hierarchy            | ✅           | ✅              | ⬜ 없음 |
| Custom keybindings                  | ✅           | ✅              | ⬜ 없음 |
| **Custom skills (user-invocable)**  | ✅           | ✅              | ⬜ 없음 |
| **Hooks (pre/post tool, stop)**     | ✅           | ✅              | ⬜ 없음 |
| **Global settings (~/.claude/)**    | ✅           | ✅ (~/.dhelix/) | ⬜ 없음 |
| **Auto-memory persistence**         | ✅ MEMORY.md | ✅ MEMORY.md    | ⬜ 없음 |

---

## 격차 분석

### 🔴 Critical (핵심 기능 격차)

| #   | 격차                      | Claude Code 구현                                                  | 영향도        | 구현 난이도 |
| --- | ------------------------- | ----------------------------------------------------------------- | ------------- | ----------- |
| C1  | **Prompt caching**        | `cache_control` breakpoints로 시스템 프롬프트 캐싱, 90% 비용 절감 | 높음 (비용)   | 중          |
| C2  | **Deferred tool loading** | 도구 스키마를 필요할 때만 로딩, context 절약                      | 높음 (성능)   | 중          |
| C3  | **Tool result streaming** | 큰 bash 출력을 점진적으로 표시                                    | 높음 (UX)     | 중          |
| C4  | **SSE transport for MCP** | Streamable HTTP 기반 MCP 서버 지원                                | 높음 (호환성) | 중          |

### 🟡 Important (경쟁력 격차)

| #   | 격차                                   | Claude Code 구현                                    | 영향도      | 구현 난이도 |
| --- | -------------------------------------- | --------------------------------------------------- | ----------- | ----------- |
| I1  | **Worktree isolation for sub-agents**  | `isolation: "worktree"` 옵션으로 에이전트 독립 작업 | 중          | 높          |
| I2  | **Rich markdown rendering**            | 터미널 내 코드 블록, 테이블, 링크 서식              | 중 (UX)     | 중          |
| I3  | **Syntax highlighting in tool output** | 코드 출력 시 언어별 구문 강조                       | 중 (UX)     | 낮          |
| I4  | **Extended thinking auto-budget**      | 모델별 thinking token 자동 조절                     | 중 (성능)   | 낮          |
| I5  | **Plan mode auto-execution**           | 계획 승인 후 자동 실행                              | 중 (UX)     | 중          |
| I6  | **OAuth/SSO 인증**                     | claude.ai 계정 기반 인증                            | 중 (접근성) | 높          |
| I7  | **/bug 자동 이슈 리포트**              | GitHub Issues에 자동 리포트                         | 낮          | 낮          |
| I8  | **/doctor 포괄적 진단**                | Node, Git, API, MCP 등 전체 환경 점검               | 낮          | 낮          |

### ⬜ dhelix 우위 영역

| 영역               | Claude Code에 없는 기능                                         |
| ------------------ | --------------------------------------------------------------- |
| 저성능 모델 지원   | CapabilityTier, JSON 복구, Two-stage tool call, CoT scaffolding |
| 다중 프로바이더    | OpenAI SDK 호환 → Ollama, DeepSeek, Mistral, Azure 모두 지원    |
| 한국어 네이티브    | 로캘 시스템, 한국어 상태 메시지, 톤 프로필                      |
| 음성 입력          | SoX + Whisper 기반 push-to-talk                                 |
| Dual tool strategy | Native + XML text-parsing 자동 전환                             |
| 비용 투명성        | SSOT 가격 테이블 + 실시간 비용 추적                             |

---

## 해소 로드맵

### Sprint 1: 비용 최적화 (1-2주)

**C1. Prompt Caching**

OpenAI SDK에서도 prompt caching이 지원되므로 (GPT-4o, GPT-5 계열), 시스템 프롬프트의 정적 부분에 cache breakpoint를 설정.

```
구현 포인트:
- src/llm/client.ts: 시스템 메시지에 cache_control 헤더 추가
- src/core/system-prompt-builder.ts: 정적/동적 섹션 분리
- ModelCapabilities에 supportsCaching 필드 추가
- 캐싱 히트율 metrics 추가
```

**예상 효과:** 시스템 프롬프트 토큰 비용 50-90% 절감

### Sprint 2: 성능 & UX (1-2주)

**C2. Deferred Tool Loading**

MCP 도구가 많을 때 시스템 프롬프트가 비대해지는 문제. 도구 스키마를 lazy-load.

```
구현 포인트:
- src/tools/deferred-registry.ts: 도구 이름/설명만 포함, 스키마는 사용 시 로드
- system-prompt-builder: deferred 도구는 이름만 나열
- agent-loop: 도구 호출 시 스키마 resolve
```

**C3. Tool Result Streaming**

```
구현 포인트:
- src/tools/definitions/bash-exec.ts: stdout 스트리밍 모드 추가
- ActivityFeed: streaming tool output 렌더링
- useAgentLoop: tool:output-delta 이벤트 처리
```

**I3. Syntax Highlighting**

```
구현 포인트:
- ink-syntax-highlight 또는 cli-highlight 라이브러리 도입
- ActivityFeed의 코드 블록에 적용
- /output-style에서 토글 가능
```

### Sprint 3: 인프라 확장 (2-3주)

**C4. SSE Transport for MCP**

```
구현 포인트:
- src/mcp/sse-transport.ts: EventSource 기반 MCP 클라이언트
- src/mcp/client.ts: transport 자동 감지 (stdio vs SSE)
- MCP config에 transport 필드 추가
```

**I1. Worktree Isolation**

```
구현 포인트:
- src/tools/definitions/agent.ts: isolation: "worktree" 옵션 추가
- git worktree add/remove 래퍼
- 워크트리 브랜치 자동 머지 유틸리티
```

**I4. Extended Thinking Auto-Budget**

```
구현 포인트:
- ModelCapabilities에 thinkingBudget?: number 추가
- agent-loop: 복잡도 감지 → 자동 thinking budget 조절
- /effort 커맨드와 연동
```

### Sprint 4: UX 완성 (1-2주)

**I2. Rich Markdown Rendering**

```
구현 포인트:
- marked + chalk 조합 또는 marked-terminal 도입
- ActivityFeed의 assistant-text 블록에 적용
- 테이블, 코드블록, 헤더, 링크 렌더링
```

**I5. Plan Mode Auto-Execution**

```
구현 포인트:
- /plan approve → 자동 실행 모드 진입
- 계획 단계별 진행상황 표시 (TaskListView 활용)
- 에러 시 중단 + 사용자 확인 요청
```

---

## 결론

### 현재 위치

v1 구현 완료 후 dhelix는 **핵심 코어 기능의 90% 이상**을 Claude Code와 동등하게 갖추고 있습니다.

**dhelix가 앞서는 영역:**

- 다중 LLM 프로바이더 지원 (OpenAI, Claude, Ollama, DeepSeek 등)
- 저성능 모델 적응 (tier 시스템 + JSON 복구)
- 한국어 네이티브 UX (로캘, 톤, 상태 메시지)
- 음성 입력
- 비용 투명성 (SSOT 가격 추적)

**Claude Code가 앞서는 영역:**

- Prompt caching (비용 최적화의 핵심)
- Tool result streaming (대용량 출력 UX)
- Rich markdown rendering
- SSE MCP transport
- Worktree agent isolation

### 우선순위

```
                높음
    ┌─────────────────────┐
    │  C1 Prompt Caching  │ ← 비용 50-90% 절감, ROI 최고
    │  C3 Tool Streaming  │ ← UX 체감 큰 개선
    ├─────────────────────┤
    │  C2 Deferred Tools  │ ← 대규모 MCP 환경 필수
    │  C4 SSE Transport   │ ← MCP 생태계 호환
    │  I2 Markdown Render │ ← UX 완성도
    ├─────────────────────┤
    │  I1 Worktree Agent  │ ← 고급 기능
    │  I4 Think Budget    │ ← 자동화
    │  I5 Plan Execute    │ ← 생산성
    └─────────────────────┘
                낮음
```

Sprint 1 (Prompt Caching)만 완성해도 dhelix의 실사용 비용이 Claude Code 수준으로 떨어지며, Sprint 2까지 완성하면 UX 격차가 사실상 해소됩니다.
