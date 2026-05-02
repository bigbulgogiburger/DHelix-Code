# dhelix vs Claude Code vs Codex CLI — Deep Dive 비교 분석

> **분석일**: 2026-05-02
> **이전 분석**: v9 (2026-03-11, Claude Code 단축 비교, 9.8/10)
> **이번 분석 차이점**: Codex CLI(OpenAI)를 3번째 축으로 추가, TUI/GUI/Wiring/완성도 4개 차원으로 재구성
> **Claude Code 기준**: 2026.02 기준 GitHub 공개 커밋 4% 점유 (~135K commits/일)
> **Codex CLI 기준**: codex-rs 기준 (~70 crates, ~95% Rust)
> **dhelix 기준**: main branch, GAL-1 Phase 5 머지 직후 (446 테스트 파일 / ~7,741 테스트)

---

## 0. TL;DR (한 줄 요약)

**dhelix는 wiring 깊이는 1티어, TUI는 1.5티어, GUI/완성도는 3티어.**

구조는 두 거인을 벤치마킹해서 따라잡았는데, 사용자에게 닿는 표면(GUI/배포/auth)은 비어 있고, "구조는 만들었는데 끝까지 안 이은" 흔적(TODO·stub·미연결 유틸)이 군데군데 있어서 실제 체감 완성도가 낮다. 반대로 Plasmid/Recombination 같은 우리만의 독창적 축은 시장에 존재하지 않는다.

---

## 1. TUI 측면

### 스택 자체 비교

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 런타임 | Node.js 20+ / TS / ESM | Node.js / TS | **Rust** (codex-rs, ~70 crates, ~95% Rust) |
| 렌더 | Ink 5.1 + React + Yoga | Ink + React + Yoga | ratatui 계열 (네이티브) |
| 시작 시간 | ~수백ms | ~수백ms | **~수십ms** (빠름) |
| 토큰/세션 효율 | 미측정 | 무거움(질 우선) | **4× 적게** (Terminal-Bench 2.0 77.3% 1위) |

**중요한 함의**: Claude Code도 우리와 같은 Ink/React 스택. 우리가 Claude Code 따라가는 데에는 구조적 핸디캡이 없음. 진짜 구조적 격차는 **Codex의 Rust 리라이트** — 시작 속도, 메모리, 토큰 효율 모두 우리가 따라잡기 어려운 영역.

### 우리 TUI의 강점 (실측)

- **9-stage 파이프라인의 시각화가 제일 풍부함**: `ActivityFeed`가 `<Static>` + 동적 영역으로 분리되어 anti-flicker, 연속 `file_read`는 `ReadGroupBlock`으로 자동 그룹핑("Read N files"). Codex/Claude Code의 공개 자료에서 이 정도 디테일은 안 보임.
- **DEC Mode 2026 atomic rendering**: `synchronized-output.ts`가 Ink 렌더 사이클을 `\x1b[?2026h/l`로 감싸서 깜빡임 제거. Claude Code도 안 함(공개자료 기준).
- **3-패널 시스템** (Approval/Job/Task): 조건부 mount. Claude Code는 hook + status 위주, Codex는 `/goal`·`/statusline`·`/title` 등 슬롯 단위로 채움. 우리는 패널을 더 명시적으로 분리해 둠.
- **Diff/Patch 렌더링**, **`ThinkingBlock` 접힘+토큰카운트+Ctrl+O 펼치기**: 동급.

### 우리 TUI의 약점 (실측)

| 항목 | 우리 상태 | Claude Code | Codex CLI |
|---|---|---|---|
| 키바인딩 커스터마이징 | `~/.dhelix/keybindings.json` 있음, **단축키 8개만** | 비슷 | **2026에 configurable TUI keymaps 추가** |
| 청크/리사이즈 reflow | useStdout polling | 동일 | **2026에 resize reflow 안정화 명시** |
| 슬래시 명령 팝업 | `SlashCommandMenu` 있음 | 동일 | **2026에 slash-command popup layout 개선** |
| Plan-mode nudge | 없음 | `Shift+Tab plan mode` | **2026 plan-mode nudges 추가** |
| Action-required 터미널 타이틀 | 없음 | 일부 | **2026 action-required terminal titles** |
| 포커스 트래버설 | `FocusManager` **유틸만 있고 Ink `useFocus`에 미연결** | 정상 | 정상 |
| Screen-reader | `screen-reader.ts` **포맷터만 있고 OS bridge 없음** | 일부 | 미상 |
| reduce-motion / NO_COLOR / FORCE_COLOR | **전부 미구현** | 일부 | 일부 |
| 마우스 / Windows ConPTY 케어 | **없음** | 부분 | 부분 |
| 보이스 입력 (`useVoice` Whisper, ko 기본) | **있음 — 우리만의 강점** | 없음 | 없음 |

**진단**: TUI 코어 렌더는 동급, 하지만 Codex가 2026 들어 reflow·keymap·plan-nudge·action-title·status-update 같은 *손에 닿는* 라스트마일을 빠르게 채웠고, 우리는 안 했음. WCAG 주장은 유틸 단계에서 멈췄음(연결되지 않은 `FocusManager`, 미연결 `screen-reader`, `prefers-reduced-motion` 미감지).

---

## 2. GUI 측면 — 가장 큰 격차

### Claude Code (Anthropic)

- **VS Code 네이티브 익스텐션**: 사이드바 패널, inline diff, command palette, Extension API로 워크스페이스 직접 조작
- **JetBrains 익스텐션**
- **Web IDE** (claude.ai/code) — 원격 제어
- **Desktop 앱** (Mac/Windows) — parallel sessions
- **Cowork 기능** — 코딩 외 영역 확장
- 2026.02 기준 GitHub 공개 커밋의 **4%가 Claude Code 작성** (~135K commits/일)

### Codex CLI (OpenAI)

- **클라우드 우선 모델**: 여러 sandboxed environment를 병렬로 띄움. 각 task가 별개 클라우드 컨테이너.
- **GitHub Copilot 통합**: 같은 구독으로 Claude·Codex 에이전트를 로컬/클라우드에서 실행
- **VS Code 통합**: Copilot 채널을 통해 IDE에 노출
- **Plugin marketplace**: 2026 — remote bundle caching, remote uninstall, plugin-bundled hooks
- AGENTS.md — 크로스툴 공통 포맷 (벤더 락인 회피)

### dhelix (우리)

- **VS Code 익스텐션**: 있긴 한데 **순수 IPC+LSP 브리지**. UDS 소켓 + JSON-RPC 2.0 + 12개 LSP 메서드 + diagnostics forwarder. **사이드바·webview·inline diff 전부 없음.** 익스텐션 사용자는 IDE에서 dhelix와 대화할 수 없고, 단지 dhelix가 IDE의 LSP를 빌려 쓰는 구조.
- **Dashboard**: `src/dashboard/server.ts`, 포트 18120. REST(7개 엔드포인트) + SSE. 실제로는 *WebSocket이 아니라 SSE*인데 파일명이 `websocket.ts`로 잘못 붙어 있음. **인증 없음, CORS 와일드카드.** 외부에 노출하면 안 됨.
- **Web/Desktop 앱**: 없음

### 격차 요약

| | Claude Code | Codex CLI | dhelix |
|---|---|---|---|
| IDE 사이드바 채팅 | O | O (Copilot) | **X** |
| Inline diff in IDE | O | O | **X** |
| 데스크톱 앱 | O | — | **X** |
| 웹 앱 / 원격 제어 | O | O (cloud) | **X** |
| 클라우드 병렬 실행 | 부분 | **O (강점)** | X (cloud/job-queue 인메모리 stub) |
| 익스텐션이 하는 일 | UI + bridge | UI + bridge | **bridge만** |

**진단**: Claude Code는 "터미널 ↔ IDE ↔ 데스크톱 ↔ 웹" 4면 다 메웠고, Codex는 "터미널 + 클라우드 fan-out"으로 경쟁 우위를 만들었음. 우리는 **터미널 1면**. VS Code 익스텐션이 있는데도 사용자에게 GUI를 안 줌 — 잘못된 자원 배분으로 보임.

---

## 3. Wiring 측면 — 우리가 강함

### Pipeline 깊이

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 메인 루프 | **9-stage RuntimePipeline + MetricsCollector(stage-별 latency)** | QueryEngine + Tool System (단계 비공개) | **ToolRouter + UnifiedExecProcessManager** |
| 파이프라인 단계 정의의 가시성 | 매우 높음 | 중간 | 높음 |
| 스테이지 메트릭 | O | 부분 | O |

**우리가 더 정교**: `prepare-context → compact-context → resolve-tools → sample-llm → extract-calls → preflight-policy → execute-tools → persist-results → evaluate-continuation` — 9단계가 명시 enum이고 각 단계 latency가 수집됨. Codex의 ToolRouter는 강력하지만 더 단순한 라우터 모델.

### LLM Provider 다양성

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 공식 지원 | **8 (Anthropic, OpenAI-compat, Bedrock, Azure, Gemini, Groq, Mistral, Local)** | 1 (Anthropic, MCP 제외) | 1 (OpenAI) |
| 로컬 모델 | **O (template detection)** | X | X |
| Bedrock SigV4 자체 구현 | **O (SDK 없이)** | — | — |

**여기가 우리만의 진짜 우위**. Claude Code/Codex는 둘 다 자기 모델 락인. 우리는 8 provider + 로컬 + 듀얼모델 라우팅(architect/editor)이 구조에 들어가 있음. **시장에서 이걸 우리만큼 진지하게 한 곳 없음.**

### Tool System

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 빌트인 도구 수 | **29** | 비공개(추정 ~15-20) | 핵심 적음 + plugin marketplace |
| Tool pipeline 단계 | **4 (preflight/scheduler/execute/postprocess)** | hook 시스템(17 lifecycle events)으로 대체 | ToolRouter (단일 게이트) |
| Adaptive schema (HIGH/MED/LOW) | **O** | — | — |
| Output truncation 전략 | head-tail + spillover file | 단순 truncate | UnifiedExec |
| LSP 통합 | **on-demand + IDE bridge (Tier 1/2 분리)** | 부분 | 부분 |
| Tree-Sitter 10개 언어 | **O** | — | — |

**우리가 도구 깊이는 더 크지만**, Claude Code는 hook 17종으로 *외부에서 도구 동작을 가로채고 변형*하는 능력을 더 멀리 끌고 갔음. 우리는 hook 8개(설명에선 8개로 표기되지만 실제론 그건 React hook이고, *lifecycle hook 시스템은 구조적으로 없음* — **숨은 큰 갭**).

### MCP

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| MCP 클라이언트 | O | O (1급) | O |
| Scope 분리 | **3-scope (user/project/local)** | 비슷 | 비슷 |
| OAuth PKCE | **O (S256 자체 구현)** | O | O |
| dhelix-as-MCP-server | **O (단, "stub")** | O | O |
| A2A | **인메모리만** (transport 없음) | — | — |
| Tool bridge naming | `mcp__server__tool` | 동일 | 동일 |

3-scope는 좋은데 A2A는 사실상 데모 수준.

### Permissions / Sandbox

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 권한 모델 | **Trust T0-T3 (4 tier)** + ApprovalDB(SQLite TTL) | hooks 기반 (PreToolUse 등으로 직접 정책) | **3 mode** (read-only / workspace-write / danger-full-access) + approval policy(untrusted/permissive/...) |
| Sandbox backend | **4 (Seatbelt / Bubblewrap / Container / Env-sanitizer)** | 부분 | 2-3 (Apple Seatbelt + Linux Landlock/seccomp) |
| 영속 승인 | **SQLite + TTL** | 일부 | TOML config |
| SIEM export | **architecture diagram 상에는 있으나 실제 push 엔드포인트 미구현** | 일부 | — |

**여기서도 우리가 모델은 더 풍부**한데, Codex는 Landlock+seccomp로 *Linux 보안 깊이*가 더 깊고, Claude Code는 hooks로 *유연성*이 더 큼.

### Subagents

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 병렬 spawn | **O** | **O (4% commit 점유의 핵심 동력)** | O |
| Worktree 격리 | **O** | O | 부분 |
| Agent memory | **O (200줄 cap)** | O | 부분 |
| P2P MessageBus | **O (인메모리, SharedAgentState)** | — | — |
| 최대 nesting | 3 | — | — |

거의 동급.

### Context Management

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| Layer 1 microcompaction (cold storage) | **O (CAS gzip, 24h TTL, 100MB LRU)** | 부분 | — |
| Layer 2 structured summary | **O (83.5% threshold, 모델별 차등)** | O | **O (CompactTask in codex-core)** |
| Async (non-blocking) | **O** | 부분 | O |
| Adaptive | **O (`adaptive-context.ts`)** | — | — |
| Rehydration | **5 recent files** | 부분 | 부분 |

여기는 우리가 가장 깊다고 할 수 있음.

### dhelix만의 독보적 축

- **Plasmid + Recombination + Cure 거버넌스**: 컨텐츠 어드레서블 객체 스토어, I-8 hermeticity (런타임 프롬프트 격리), 8-stage 컴파일 파이프라인, 3-way merge 기반 cure(역연산), 7-gate challenge ceremony, cooldown
- **TaskClassifier + DualModelRouter**: phase 자동 분류해서 architect/editor 모델로 라우팅
- **Recovery Executor + Circuit Breaker** (의미적 progress 분석으로 5회 무변화 감지)
- **Voice 입력** (Whisper, 한국어 기본)

**Claude Code/Codex는 이 축이 없음.** 우리만 있는 진짜 차별화.

### Slash Commands

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 공식 등록 | **40+** | ~30 | 점진 증가 (`/goal`, `/statusline`, `/title`, `/plan` …) |
| Skill→Command bridge | **O (`createSkillCommands`)** | O (skills 시스템) | plugin |
| 미등록 파편 (`agents.ts`/`permissions.ts`/`team.ts`) | **있음 (barrel 누락)** | — | — |

명령 양은 우리가 가장 많은데 **파일은 있는데 barrel에 빠져 있어서 닿지 않는 명령들**이 있음. 곧 완성도 신호.

---

## 4. 완성도 측면 — 가장 약함

### 정량 신호

| | dhelix | Claude Code | Codex CLI |
|---|---|---|---|
| 테스트 파일 | **446** | 비공개 | 비공개 |
| 테스트 수 | **~7,741** | — | — |
| 단위 vs 통합 vs E2E | **407 / 14 / 25** | — | — |
| 커버리지 임계값 | **CI에 미설정** | — | — |
| CI 게이트 | check / quality / ci 3단계 | — | — |
| 공개 GitHub 커밋 점유 | **0%** | **4% (~135K/day, 13개월 42,896×)** | 빠르게 추격 중 |
| 벤치마크 | 미측정 | 코드 품질 67% 승률 | **Terminal-Bench 2.0 1위 77.3%** |

**테스트 7,741개는 내부적으로 매우 많은데**, 통합 테스트 14개 vs 단위 407개의 비대칭이 위험. Recombination 8-stage·9-stage Pipeline·MCP scope resolution·full agent loop 같은 *cross-module critical path*가 14개로 다 커버될 리 없음.

### 폴리시/완성 갭 (실측 — agent grep으로 찾은 실제 TODO)

`recombination/executor.ts:323` — `// TODO(phase-3): wire Ink prompt via RuntimePipeline message bus`
→ 인터랙티브 grace period 프롬프트가 auto로만 동작, Ink 미연결

`recombination/cure/restorer.ts:68` — `// TODO (Phase 5): promote 'mergeMode' into CureOptions proper`
→ 내부 파라미터가 옵션 표면에 안 올라옴

`recombination/cure/restorer.ts:185` — `// TODO (Phase 5): emit a CureWarning{kind:"manual-edit"}`
→ 수동 편집 경고가 이벤트로 안 흘러감

`skills/creator/evals/runner.ts:305` — `// TODO(D4): /skill-eval 명령에서…RunnerDeps.spawn`
→ skill eval 러너 spawn 미연결

`plasmids/interview-mode.ts:187` — `// dispatch to Quick mode (skeleton stub in Phase 1)`
→ Quick mode가 skeleton

**research-mode 프로덕션 stub**: `defaultDeps.runResearch = undefined` — `/plasmid --research`가 프로덕션에선 "not enabled in this build"라고 뜨고 fallback. Phase 6에서 LLM seam을 잇기로 되어 있는 미완 기능.

`plasmids/generators.ts:96` — `// TODO: add 2-3 concrete constraints` — 템플릿 미완.

### 문서 ↔ 코드 모순 (4건 이상)

| 항목 | 문서 주장 | 실제 코드 |
|---|---|---|
| Circuit breaker 임계값 | "3회 무변화 trip" | `NO_CHANGE_THRESHOLD = 5` |
| Dashboard 전송 | "REST + WebSocket + SSE Bridge" | SSE만 (파일명만 `websocket.ts`) |
| SIEM Export | architecture diagram에 명시 | 로컬 JSONL만, push 엔드포인트 없음 |
| WCAG Accessibility | "WCAG 준수" | `FocusManager`/`screen-reader` 유틸만 있고 Ink/OS 미연결 |

### 기타 폴리시 갭

- `cloud/job-queue.ts`: 인메모리, "replace with Redis/SQS in future" 주석 — 프로세스 재시작 시 사라짐
- `mcp/serve.ts`: "stub" 주석 — dhelix-as-MCP-server는 기본만
- Dashboard: **인증 zero, CORS wildcard** — 외부 노출 시 보안 사고
- `prefers-reduced-motion`/`NO_COLOR`/`FORCE_COLOR` 미감지
- 색맹 테마는 있는데 contrast 자동 검증은 빌드/런타임에 미연결
- builtin-commands.ts barrel에서 `agents.ts`/`permissions.ts`/`team.ts` 누락 — *파일은 있는데 사용자가 못 호출*

### Documentation

문서량 자체는 우리가 많음 — `.claude/docs/reference/` 17개 + `docs/` 90+. 하지만 전부 **내부용**. 사용자 진입 문서·튜토리얼·website가 없음. Claude Code는 [code.claude.com/docs](https://code.claude.com/docs)에 풀 사이트, Codex는 [developers.openai.com/codex](https://developers.openai.com/codex)에 changelog까지.

---

## 5. 종합 — 어디서 이기고 어디서 지는가

### 우리가 명백히 이김

1. **Provider 다양성**: 8개 + 로컬 + Bedrock SigV4 자체 구현. Claude Code/Codex는 1개씩 락인.
2. **Pipeline 명시성**: 9-stage enum + stage-level metrics. 가장 가시적.
3. **Plasmid/Recombination/Cure**: 시장에 없는 거버넌스 계층. **우리의 진짜 moat.**
4. **Context 압축 깊이**: Layer 1 cold storage(CAS gzip + LRU) + Layer 2 + adaptive + async. 가장 정교.
5. **Sandbox 백엔드 폭**: 4종(seatbelt/bubblewrap/container/env). Codex는 2-3, Claude Code는 부분.
6. **Trust T0-T3**: 4-tier 권한 모델 + ApprovalDB. 가장 풍부.
7. **TaskClassifier + DualModelRouter**: phase 기반 자동 모델 라우팅. 둘 다 없음.
8. **Voice (Whisper, ko)**: 둘 다 없음.

### 비등

- Subagents (다 있음. 우리 P2P MessageBus는 인메모리라 가산점 작음)
- MCP 클라이언트 (3-scope는 +α이지만 A2A는 인메모리)
- Tool 수 (우리가 더 많은데 Claude Code는 hook으로 보완)

### 우리가 명백히 짐

1. **GUI 표면**: Claude Code는 VS Code 사이드바 + 데스크톱 + 웹IDE + Cowork, Codex는 클라우드 fan-out. **우리는 IPC bridge + auth 없는 dashboard.** 가장 큰 갭.
2. **Hook 라이프사이클 시스템**: Claude Code는 17개 lifecycle hook으로 *외부 사용자가 동작을 변형* 가능. 우리는 React hook(8)만 있고 *시스템적 hook 없음*.
3. **속도/효율**: Codex는 Rust + 4× 적은 토큰. 따라잡기 어려움.
4. **배포/공식 docs/벤치마크**: 0% 점유 vs Claude Code 4%, Codex Terminal-Bench 1위.
5. **라스트마일 polish**: configurable keymap, plan-mode nudge, action-required title, resize reflow, prefers-reduced-motion, NO_COLOR, FocusManager 실제 연결 — 다 미흡.
6. **문서 ↔ 코드 정합성**: WCAG 주장·SIEM·WebSocket·circuit-breaker 임계값 등 4건 이상 모순.
7. **자기-MCP, A2A, cloud job queue**: 셋 다 stub 수준.

---

## 6. 가장 솔직한 평가

> **"훌륭한 엔진을 만들었는데 차체와 핸들이 없다."**

9-stage pipeline, 8 provider, plasmid 거버넌스, 4-backend sandbox — 이런 코어는 Claude Code/Codex가 갖고 있지 않은 깊이. 그런데:

- 사용자는 터미널 1면에서만 만남 (GUI 부재)
- 인증/문서/외부노출/배포 같은 *닿는* 부분이 비어 있음
- 코어조차 마지막 1마일이 stub/TODO로 끝나는 게 많음 (research-mode prod stub, A2A transport, cloud queue 인메모리, FocusManager 미연결, dashboard auth, SIEM)
- 문서가 코드보다 자신감 있게 쓰여 있음 — 위험 신호

**Phase 6이 GUI/배포/완성 라스트마일에 가야 한다.** 또 한 번 코어를 확장하면 Claude Code/Codex가 닿은 곳에 영원히 못 닿음. 코어는 이제 충분.

---

## 7. Phase 6 우선순위 권고 (비용 대비 임팩트 순)

### P0 — 사용자 표면 (GUI / 배포)

1. **VS Code 사이드바 webview**: 기존 IPC bridge 위에 chat panel + inline diff 패널 추가. 익스텐션을 진짜 GUI로 승격.
2. **Dashboard 인증**: bearer token 또는 OS keychain 기반 최소 인증. CORS wildcard 제거. 외부 노출 가능 상태로.
3. **공식 사이트 + Quickstart**: 1페이지라도 좋으니 사용자 진입로.

### P1 — 시스템 hook 라이프사이클

4. **Lifecycle hook 시스템 도입**: PreToolUse / PostToolUse / Stop / SubagentStop / Notification 등 Claude Code의 구조 차용. *외부 사용자가 동작을 변형*할 수 있게 하는 게 생태계의 출발점.

### P2 — 라스트마일 polish

5. **TODO 해소 5건** (recombination Ink prompt, cure restorer mergeMode/warning, skill-eval spawn, interview-mode Quick).
6. **research-mode 프로덕션 활성화** (LLM seam 연결).
7. **FocusManager → Ink useFocus 실제 연결**, screen-reader OS 브리지, `NO_COLOR`/`FORCE_COLOR`/`prefers-reduced-motion` 감지.
8. **builtin-commands.ts barrel 누락 명령 등록** (agents/permissions/team).
9. **문서 ↔ 코드 정합성** 4건 수정 (circuit breaker 임계값, dashboard 전송, SIEM, WCAG 주장).

### P3 — 인프라 영속화

10. **cloud/job-queue 영속 백엔드** (Redis/SQS).
11. **A2A transport** (인메모리 → stdio/HTTP).
12. **mcp/serve.ts** stub → 풀 MCP 서버 스펙.

### P4 — 측정·증거

13. **Terminal-Bench / SWE-bench 측정** — 0% 점유 상태에서 벤치마크 점수가 첫 번째 사용자 신뢰 신호.
14. **통합 테스트 비대칭 해소** (14 → 50+, 특히 9-stage pipeline, recombination, MCP scope, full agent loop).
15. **커버리지 임계값 CI 게이트** 설정.

---

## Sources

- [Inside Claude Code: Architecture Behind Tools, Memory, Hooks, MCP](https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/)
- [Claude Code 2026 Cheat Sheet — Slash Commands, MCP, Hooks](https://techbytes.app/posts/claude-code-2026-cheat-sheet-hooks-mcp-commands/)
- [Claude Code overview (official)](https://code.claude.com/docs/en/overview)
- [Inside Claude Code: An Architecture Deep Dive — Zain Hasan](https://zainhas.github.io/blog/2026/inside-claude-code-architecture/)
- [Use Claude Code in VS Code (official)](https://code.claude.com/docs/en/vs-code)
- [The codex-rs Architecture: How OpenAI Rewrote Codex CLI in Rust](https://codex.danielvaughan.com/2026/03/28/codex-rs-rust-rewrite-architecture/)
- [Codex CLI Features (official)](https://developers.openai.com/codex/cli/features)
- [Codex Changelog (official)](https://developers.openai.com/codex/changelog)
- [Codex CLI Sandbox & Approval Modes](https://developers.openai.com/codex/agent-approvals-security)
- [Claude Code vs Codex CLI 2026 — NxCode](https://www.nxcode.io/resources/news/claude-code-vs-codex-cli-terminal-coding-comparison-2026)
- [Codex vs Claude Code — Builder.io](https://www.builder.io/blog/codex-vs-claude-code)
- [Codex CLI Sandbox Analysis — Agent Safehouse](https://agent-safehouse.dev/docs/agent-investigations/codex)

---

**Last Updated**: 2026-05-02
**Next Review**: Phase 6 착수 시점
