# dhelix UI Improvement Plan v2 — Production Roadmap

> Author: Claude (Anthropic Claude Code 책임 기획자 & Codex 책임 기획자)
> Date: 2026-03-12 (v2 revised)
> Status: **Approved — Ready for Implementation**
> Priority: High

---

## Executive Summary

Claude Code, Codex CLI (v0.105+), GitHub Copilot CLI, Cline CLI 2.0 등
**주요 경쟁 CLI 도구**를 전수 조사한 뒤, dhelix의 **현재 코드베이스 상태**를
정밀 분석하여 **실제 구현이 필요한 항목만** 선별했습니다.

- 기존 41개 항목 → **8개 삭제** → **33개 확정**
- 삭제 기준: Aider/Codex/Amazon Q **단독** 기능이면서 기존 인프라로 이미 대체 가능한 것
- 이미 구현된 것으로 밝혀진 기능은 상태를 **"확인 완료"**로 업데이트

### 삭제된 항목과 사유

| 삭제 항목              | 원 Source  | 삭제 사유                                                              |
| ---------------------- | ---------- | ---------------------------------------------------------------------- |
| Architect/Editor Split | Aider 단독 | `/plan` 모드 + subagent 2-phase가 이미 동일 역할 수행                  |
| /run Auto-Fix Loop     | Aider 단독 | 에이전트 루프의 ReAct 패턴이 "실행→실패→수정→재실행"을 자연스럽게 수행 |
| Auto-Lint After Edit   | Aider 단독 | `hooks/` PostToolUse 시스템으로 이미 구현 가능. 사용자 설정 영역       |
| /personality           | Codex 단독 | `/output-style` 명령이 이미 존재 (Default/Explanatory/Learning)        |
| Voice Input            | Codex 단독 | CLI 도구에서 음성 입력은 니치. 외부 의존성(Wispr) 필요                 |
| Feature Flags          | Codex 단독 | 5-level config 시스템으로 충분. 실험 기능 없는 현 단계에서 시기상조    |
| Shell Completion       | Codex 단독 | Commander.js 12.x 내장 자동완성으로 충분                               |
| Paste Burst Detection  | Codex 단독 | Ink 5.x의 React reconciliation이 이미 합리적으로 처리                  |

### 현재 코드베이스에서 이미 구현된 기능 (확인 완료)

| 기능                        | 상태             | 위치                                     |
| --------------------------- | ---------------- | ---------------------------------------- |
| @File Mentions              | ✅ 구현 완료     | `src/mentions/parser.ts` + `resolver.ts` |
| /output-style               | ✅ 구현 완료     | `src/commands/output-style.ts`           |
| /permissions                | ✅ 구현 완료     | `src/commands/permissions.ts` (10KB)     |
| PermissionPrompt 3-option   | ✅ 구현 완료     | Allow once / Allow session / Deny        |
| Syntax highlighting (shiki) | ✅ 의존성 설치됨 | `package.json` → shiki 3.2.1             |
| /stats                      | ✅ 구현 완료     | `src/commands/stats.ts`                  |
| TaskManager                 | ✅ 구현 완료     | `src/core/task-manager.ts`               |
| Tab 자동완성                | ✅ 구현 완료     | `UserInput.tsx` (파일 glob, 10개 제안)   |

---

## 개발 방향 (Development Direction)

### 핵심 원칙

1. **"보이는 것을 먼저 고친다"** — 사용자가 매 턴마다 보는 UI부터 개선
2. **"인프라가 있으면 바로 연결"** — 이벤트/컴포넌트가 존재하나 미연결된 것 우선
3. **"경쟁 도구와의 격차 해소"** — Claude Code/Codex 대비 가장 큰 UX 격차부터 해소
4. **"기존 코드 재활용"** — shiki, mentions/, task-manager 등 이미 있는 인프라 활용

### Sprint 계획

```
Sprint 1 (3일) — "즉시 체감" [Tier 1]
  ├── Rich Tool Display (diff 기본 표시, 헤더 포맷 통일)
  ├── Live Token Counter (이벤트 연결만으로 동작)
  ├── Working Timer (Spinner에 경과 시간 추가)
  └── Syntax Highlighting (shiki 이미 설치됨)

Sprint 2 (5일) — "입력 경험" [Tier 2a]
  ├── ! Bash Mode (셸 직접 실행)
  ├── @ File Mentions 강화 (드롭다운 UI, 현재는 @file:path 수동)
  ├── Ctrl+R Reverse Search
  ├── Ctrl+G External Editor
  └── /new Command

Sprint 3 (5일) — "피드백 & 권한" [Tier 2b]
  ├── Inline Permission Feedback (deny with reason)
  ├── Word-Level Diff Highlighting
  ├── Approval Always Policy (영구 저장 추가)
  ├── Notification on Completion
  └── Smart Task Output

Sprint 4 (7일) — "고급 UI" [Tier 3]
  ├── /btw Side Questions
  ├── Customizable Statusline
  ├── Interactive /diff Viewer
  ├── /context Grid Visualization
  ├── Esc+Esc Rewind Menu
  └── Task List Ctrl+T Toggle

Sprint 5+ (장기) — "차별화" [Tier 4]
  ├── Granular Auto-Approve
  ├── /theme Picker
  ├── Prompt Suggestions
  ├── /copy Code Block Picker
  └── 기타
```

---

## Part I: 경쟁 분석 요약

### 1. Claude Code (Primary Reference)

가장 성숙한 CLI AI 도구. dhelix의 주요 벤치마크 대상.

| 카테고리       | 핵심 기능                                  | dhelix 현황                     | 격차 |
| -------------- | ------------------------------------------ | ------------------------------- | ---- |
| **비용 추적**  | Customizable Statusline (JSON→셸 스크립트) | 고정 StatusBar                  | 높음 |
| **비용 추적**  | /cost 세션 비용                            | /cost 존재, 비용 미연결         | 중간 |
| **비용 추적**  | 실시간 context % (70% 노랑, 90% 빨강)      | % 표시하나 실시간 아님          | 중간 |
| **입력**       | ! Bash Mode                                | 없음                            | 높음 |
| **입력**       | @ File Mentions                            | ✅ 구현됨 (드롭다운 UI 미흡)    | 낮음 |
| **입력**       | Ctrl+R 역검색                              | 없음                            | 중간 |
| **입력**       | Ctrl+G 외부 에디터                         | 없음                            | 낮음 |
| **대화**       | /btw 사이드 질문                           | 없음                            | 중간 |
| **대화**       | Esc+Esc 되돌리기 메뉴                      | /rewind만 존재                  | 중간 |
| **디스플레이** | Syntax Highlighting                        | shiki 설치됨, 미연결            | 낮음 |
| **디스플레이** | /theme 테마 선택                           | 없음                            | 낮음 |
| **PR/Git**     | PR Review Status Footer                    | 없음                            | 낮음 |
| **PR/Git**     | Interactive /diff                          | /diff 있으나 인터랙티브 아님    | 중간 |
| **고급**       | Task List (Ctrl+T)                         | TaskManager 있으나 UI 토글 없음 | 낮음 |
| **고급**       | Prompt Suggestions                         | 없음                            | 낮음 |
| **고급**       | /context 컬러 그리드                       | /context 있으나 그리드 없음     | 낮음 |

### 2. Codex CLI (v0.105+, Rust/Ratatui)

| 카테고리       | 핵심 기능                                             | dhelix 현황            | 격차 |
| -------------- | ----------------------------------------------------- | ---------------------- | ---- |
| **피드백**     | Working Timer ("Working 3s")                          | Spinner에 시간 없음    | 중간 |
| **피드백**     | Notification on Completion (OSC9/BEL)                 | 없음                   | 중간 |
| **피드백**     | Fast Mode Badge                                       | /fast 있으나 뱃지 없음 | 낮음 |
| **권한**       | Approval y/n/a/s (영구 저장)                          | Allow/Session/Deny 3개 | 낮음 |
| **권한**       | Exec Policy (패턴 기반 자동 승인)                     | 없음                   | 낮음 |
| **디스플레이** | Syntax-Highlighted Diffs (syntect)                    | 없음                   | 중간 |
| **디스플레이** | /review (Critical/Important/Suggestion 분류)          | 없음                   | 낮음 |
| **디스플레이** | Reasoning Display Config (auto/concise/detailed/none) | Alt+T 토글만           | 낮음 |
| **대화**       | /new (터미널 유지 새 대화)                            | /clear만               | 낮음 |

### 3. 기타 도구 (핵심만)

| Source          | 기능                                        | dhelix 현황 | 격차 |
| --------------- | ------------------------------------------- | ----------- | ---- |
| **Copilot CLI** | Inline Permission Feedback (거부 사유 입력) | Deny만 가능 | 높음 |
| **Copilot CLI** | Word-Level Diff Highlighting                | 줄 단위만   | 중간 |
| **Copilot CLI** | Smart Task Output (성공=요약, 실패=전체)    | 전체 출력만 | 낮음 |
| **Cline 2.0**   | Granular Per-Category Auto-Approve          | 전체 모드만 | 중간 |

---

## Part II: 구현 상세 — Tier 1 (Sprint 1, 3일)

> 인프라가 이미 존재. 연결 또는 소규모 변경만으로 즉시 효과.

### 1.1 Rich Tool Display (diff 기본 표시 + 헤더 포맷)

**현재 문제**: diff 미리보기가 verbose 모드(`isExpanded`)에서만 표시됨.

**변경 파일**: `src/cli/components/ToolCallBlock.tsx`, `src/cli/renderer/tool-display.ts`

```
Before:  ⠋ Updating(src/llm/client.ts)
           ⎿  Added 3 lines, removed 1 line (ctrl+o to expand)

After:   ✓ Update src/llm/client.ts (+3 -1)
           ⎿  Added 3 lines, removed 1 line
            45  - const old = "before";
            45  + const updated = "after";
            46  + const added = "new line";
```

**핵심 변경**:

1. `ToolCallBlock.tsx` (line ~137): `isExpanded` → `isExpanded || shouldShowPreview`
2. file_edit 완료 시 항상 diff 표시 (최대 8줄 → 접기)
3. bash_exec 완료 시 출력 처음 3줄 기본 표시
4. 헤더 포맷: `Verb(arg)` → `Verb arg` (Claude Code 스타일)
5. 파일 경로: CWD 기준 상대 경로

### 1.2 Live Token Counter (실시간 토큰 + 비용)

**현재 문제**: `StatusBar.tsx`에 `inputTokens`/`outputTokens` props 정의되어 있으나,
`App.tsx`에서 전달하지 않음. `agent:usage-update` 이벤트가 emit되지만 UI에서 구독 안 함.

**변경 파일**: `src/cli/hooks/useAgentLoop.ts`, `src/cli/App.tsx`, `src/cli/components/StatusBar.tsx`

```
Before:  [Model: gpt-5.1-codex-mini] [###--------] 12%  $0.00
After:   [Model: gpt-5.1-codex-mini] ↑1.2k ↓384  [###--------] 12%  $0.04
```

**핵심 변경**:

1. `useAgentLoop.ts`: `turnUsage`/`cumulativeUsage` state 추가, `agent:usage-update` + `llm:usage` 이벤트 구독
2. `App.tsx`: StatusBar에 `inputTokens`, `outputTokens`, `cost` props 전달
3. `StatusBar.tsx`: 실시간 토큰 포매팅 (`formatTokenCount()` — 1234→"1.2k")

### 1.3 Working Timer (경과 시간 표시)

**현재 문제**: Spinner가 "Thinking..." 고정 텍스트만 표시.

**변경 파일**: `src/cli/components/Spinner.tsx`

```
Before:  ⠋ Thinking...
After:   ⠋ Thinking... (3s)
```

**핵심 변경**:

1. `startTime` prop 또는 내부 `useState(Date.now())`
2. 500ms `setInterval`로 경과 시간 업데이트
3. tool 실행 중: `"Running bash... (2s)"`

### 1.4 Syntax Highlighting (shiki 연결)

**현재 상태**: `shiki 3.2.1` 이미 설치됨. `src/cli/renderer/syntax.ts` 존재.
`markdown.ts`에서 `marked-terminal`로 변환하지만 코드 블록에 하이라이팅 미적용.

**변경 파일**: `src/cli/renderer/markdown.ts`

**핵심 변경**:

1. `marked-terminal` 옵션에서 코드 블록 렌더러를 shiki로 교체
2. 다크/라이트 자동 감지 (터미널 배경)
3. dynamic import로 lazy loading (시작 시간 영향 최소화)

---

## Part III: 구현 상세 — Tier 2 (Sprint 2-3, 10일)

### 2.1 ! Bash Mode

> Claude Code + Codex 공통. `!` 접두어로 LLM 거치지 않고 셸 직접 실행.

**변경 파일**: `src/cli/components/UserInput.tsx`, `src/cli/hooks/useAgentLoop.ts`

1. UserInput에서 `!` 접두어 감지
2. `child_process.spawn` 직접 실행
3. 출력을 conversation에 user 메시지로 추가 (LLM이 결과 참조 가능)

### 2.2 @ File Mentions 드롭다운 강화

> 현재 `@file:path` 수동 입력 + Tab 완성은 동작함. 드롭다운 UI가 부족.

**변경 파일**: `src/cli/components/UserInput.tsx`

1. `@` 입력 시 fuzzy search 드롭다운 표시 (현재는 Tab 완성만)
2. 상하 화살표로 탐색, Enter로 선택
3. 선택 시 파일 내용 자동 첨부

### 2.3 Ctrl+R Reverse History Search

> Claude Code. 이전 입력을 인터랙티브 검색.

**변경 파일**: `src/cli/hooks/useInput.ts`, `src/cli/components/UserInput.tsx`

1. `useInput` 훅에 reverse search 모드 추가
2. 검색어 입력 → 히스토리 필터링 → 매치 하이라이팅
3. Ctrl+R 반복 시 이전 매치로 이동

### 2.4 Ctrl+G External Editor

> Claude Code + Codex 공통. 프롬프트를 $EDITOR에서 편집.

**변경 파일**: `src/cli/App.tsx`, `src/cli/components/UserInput.tsx`

1. Ctrl+G → 현재 입력을 임시 파일에 저장
2. `$EDITOR` 또는 `$VISUAL` 실행 (기본: vi)
3. 에디터 종료 후 파일 내용을 프롬프트로 로드

### 2.5 /new Command

> Codex CLI. `/clear`와 구분 — 터미널 출력 유지, 대화만 리셋.

**변경 파일**: `src/commands/new.ts` (NEW)

1. 대화 히스토리 리셋, 새 세션 ID 생성
2. 터미널 스크롤백 보존

### 2.6 Inline Permission Feedback (deny with reason)

> Copilot CLI. 거부 시 사유 입력 → 에이전트가 다른 접근법 시도.

**현재 상태**: PermissionPrompt에서 Allow once / Allow session / Deny 3개 옵션.
거부 시 에러로 처리됨.

**변경 파일**: `src/cli/components/PermissionPrompt.tsx`, `src/core/agent-loop.ts`

1. "Deny" 선택 시 텍스트 입력란 표시 (선택적)
2. 피드백을 tool result에 포함: `{ isError: true, output: "User denied: [사유]. Try a different approach." }`
3. 에이전트가 피드백 반영하여 대안 시도

### 2.7 Word-Level Diff Highlighting

> Copilot CLI + Cursor CLI. 줄 단위가 아닌 문자/단어 수준 변경 강조.

**변경 파일**: `src/cli/components/ToolCallBlock.tsx`

```
Before:  45  - const old = "before";
         45  + const updated = "after";

After:   45  - const ███ = "██████";
         45  + const ███████ = "█████";
         (███ = 변경된 부분만 진한 색상/밑줄)
```

1. old/new 라인 쌍 비교 (diff-match-patch 또는 자체 구현)
2. 변경된 부분만 더 진한 배경색 + 밑줄
3. 전체 추가/삭제 줄은 기존 +/- 유지

### 2.8 Approval "Always" 영구 저장

> Codex CLI. 현재 "Allow session"까지만 가능. "Always" 옵션 추가.

**현재 상태**: PermissionPrompt에 3개 옵션 (Allow once / Allow session / Deny).
`session-store.ts`에 세션 캐시 있음. 영구 저장 없음.

**변경 파일**: `src/cli/components/PermissionPrompt.tsx`, `src/permissions/manager.ts`

1. 4번째 옵션 추가: "Allow always" (`a` 키)
2. `.dhelix/permissions.json`에 영구 저장
3. 다음 세션부터 자동 승인

### 2.9 Notification on Completion

> Codex CLI. 작업 완료 시 터미널 알림. 긴 작업 후 사용자 주의 환기.

**변경 파일**: `src/cli/hooks/useAgentLoop.ts`, `src/config/schema.ts`

1. agent-loop 완료 시 알림
2. OSC9: `\x1b]9;Task completed\x07`
3. BEL 폴백: `\x07`
4. 설정: `ui.notification = { enabled: false, method: "osc9" | "bel" }`

### 2.10 Smart Task Output

> Copilot CLI. bash 성공 시 요약, 실패 시 전체 출력.

**변경 파일**: `src/cli/renderer/tool-display.ts`

1. bash_exec 완료 시 exit code 확인
2. 성공(0): 출력 처음 3줄만 표시 (펼치기 가능)
3. 실패(non-0): 전체 출력 표시

### 2.11 Reasoning Display Config

> Codex CLI. 추론 과정 표시 수준을 설정으로 제어.

**현재 상태**: `ThinkingBlock.tsx`로 표시. Alt+T로 토글. 수준 설정 없음.

**변경 파일**: `src/config/schema.ts`, `src/cli/components/ThinkingBlock.tsx`

1. 설정: `ui.reasoning = "auto" | "concise" | "detailed" | "none"`
2. none: 숨김, concise: 요약만, detailed: 전체
3. Alt+T는 기존대로 런타임 토글

---

## Part IV: 구현 상세 — Tier 3 (Sprint 4, 7일)

### 3.1 /btw Side Questions

> Claude Code 고유. 대화 히스토리 오염 없이 빠른 질문.

**변경 파일**: `src/commands/btw.ts` (NEW), `src/cli/components/SideQuestionOverlay.tsx` (NEW)

1. `/btw <question>` 명령 등록
2. 현재 컨텍스트로 LLM 호출 (도구 없이)
3. 응답을 dismissible overlay로 표시
4. 대화 히스토리에 추가하지 않음

### 3.2 Customizable Statusline

> Claude Code. JSON→셸 스크립트 파이핑으로 완전한 커스터마이징.

**변경 파일**: `src/cli/components/CustomStatusLine.tsx` (NEW), `src/config/schema.ts`

1. StatusLine JSON Schema 정의 (Claude Code 호환):

```json
{
  "model": { "id": "gpt-5.1-codex-mini" },
  "cost": { "total_cost_usd": 0.55, "total_lines_added": 156 },
  "context_window": { "used_percentage": 8 },
  "session_id": "abc123"
}
```

2. 설정: `statusLine.command = "~/.dhelix/statusline.sh"`
3. 하이브리드: 설정 있으면 커스텀, 없으면 기존 StatusBar

### 3.3 Interactive /diff Viewer

> Claude Code + Codex. 좌우 탭으로 turn별 diff 전환.

**변경 파일**: `src/commands/diff.ts`, `src/cli/components/DiffViewer.tsx` (NEW)

1. 좌우 화살표: "Git Diff" ↔ "Turn 1" ↔ "Turn 2" ...
2. 상하 스크롤: 파일 목록 탐색
3. CheckpointManager의 체크포인트별 diff 계산

### 3.4 /context Grid Visualization

> Claude Code. 토큰 할당을 컬러 바로 시각화.

**변경 파일**: `src/commands/context.ts`

```
Context Window: 128,000 tokens
[████████░░░░░░░░░░░░░░░░░░░░░░] 12% used

  system   ████ 3,200 (2.5%)
  tools    ██ 1,800 (1.4%)
  messages ██████████ 9,500 (7.4%)
  free     ░░░░░░░░░░░░░░░ 113,500 (88.7%)
```

### 3.5 Esc+Esc Rewind Menu

> Claude Code + Codex. 스크롤 가능한 체크포인트 목록.

**변경 파일**: `src/cli/App.tsx`, `src/cli/components/RewindMenu.tsx` (NEW)

1. Esc 2회 연속 (300ms 이내) 감지
2. 인터랙티브 목록: 세션의 각 프롬프트 타임라인
3. 액션: 코드+대화 복원 / 대화만 복원 / 해당 지점부터 요약 / 취소

### 3.6 Task List Ctrl+T Toggle

> Claude Code. 현재 TaskManager + TaskListView 있으나 토글 미연결.

**변경 파일**: `src/cli/App.tsx`

1. Ctrl+T 키바인딩으로 TaskListView 토글
2. `useAgentLoop`에서 todo_write 결과를 React 상태로 추적
3. 터미널 높이에 따라 최대 10개 표시

### 3.7 Granular Per-Category Auto-Approve

> Cline CLI 2.0. 카테고리별 세분화된 자동 승인.

**변경 파일**: `src/permissions/manager.ts`, `src/permissions/modes.ts`

1. 카테고리: reads (auto), writes (confirm), bash (confirm), network (confirm), agent (confirm)
2. `/permissions` 명령에서 카테고리별 토글 UI
3. 설정 파일에 저장

---

## Part V: 구현 상세 — Tier 4 (Sprint 5+, 장기)

### 4.1 /theme Color Theme Picker

> Claude Code + Codex. 라이트/다크/접근성 테마.

### 4.2 Prompt Suggestions

> Claude Code. git 히스토리 기반 ghost text 제안.

### 4.3 /copy Code Block Picker

> Claude Code + Codex. 인터랙티브 코드 블록 선택.

### 4.4 PR Review Status Footer

> Claude Code. 풋터에 PR 상태 컬러 코딩.

### 4.5 /stats Usage Visualization

> Claude Code. ASCII 차트로 사용량 시각화.

### 4.6 /security-review

> Claude Code. git diff 기반 OWASP 보안 분석.

### 4.7 /insights Session Analysis

> Claude Code. 세션 분석 보고서.

### 4.8 Vim Mode

> Claude Code. /vim으로 vim 네비게이션 토글.

### 4.9 Agent Teams

> Claude Code + Codex. 다중 인스턴스 병렬 실행.

### 4.10 /pr-comments

> Claude Code. GitHub PR 코멘트 가져오기.

---

## Part VI: 우선순위 테이블 (최종)

### Tier 1 — 즉시 구현 (3일, Sprint 1)

| #   | Feature             | Effort | Impact | 핵심 변경                              |
| --- | ------------------- | ------ | ------ | -------------------------------------- |
| 1   | Rich Tool Display   | 1일    | ★★★★★  | ToolCallBlock.tsx: diff 기본 표시      |
| 2   | Live Token Counter  | 1일    | ★★★★★  | useAgentLoop→App→StatusBar 이벤트 연결 |
| 3   | Working Timer       | 0.5일  | ★★★★☆  | Spinner.tsx: 경과 시간 추가            |
| 4   | Syntax Highlighting | 0.5일  | ★★★★☆  | markdown.ts: shiki 연결                |

### Tier 2 — 높은 임팩트 (10일, Sprint 2-3)

| #   | Feature                     | Effort | Impact | Source               |
| --- | --------------------------- | ------ | ------ | -------------------- |
| 5   | ! Bash Mode                 | 0.5일  | ★★★★☆  | Claude Code + Codex  |
| 6   | @ Mentions 드롭다운 강화    | 1일    | ★★★★☆  | Claude Code + Codex  |
| 7   | Ctrl+R Reverse Search       | 1일    | ★★★★☆  | Claude Code          |
| 8   | Ctrl+G External Editor      | 0.5일  | ★★★☆☆  | Claude Code + Codex  |
| 9   | /new Command                | 0.25일 | ★★★☆☆  | Codex CLI            |
| 10  | Inline Permission Feedback  | 0.5일  | ★★★★★  | Copilot CLI          |
| 11  | Word-Level Diff             | 1일    | ★★★★☆  | Copilot CLI + Cursor |
| 12  | Approval "Always" 영구 저장 | 0.5일  | ★★★★☆  | Codex CLI            |
| 13  | Notification on Completion  | 0.5일  | ★★★★☆  | Codex CLI            |
| 14  | Smart Task Output           | 0.5일  | ★★★☆☆  | Copilot CLI          |
| 15  | Reasoning Display Config    | 0.5일  | ★★★☆☆  | Codex CLI            |

### Tier 3 — 중간 임팩트 (7일, Sprint 4)

| #   | Feature                  | Effort | Impact | Source              |
| --- | ------------------------ | ------ | ------ | ------------------- |
| 16  | /btw Side Questions      | 1일    | ★★★★☆  | Claude Code         |
| 17  | Customizable Statusline  | 2일    | ★★★★☆  | Claude Code         |
| 18  | Interactive /diff Viewer | 2일    | ★★★★☆  | Claude Code + Codex |
| 19  | /context Grid            | 1일    | ★★★☆☆  | Claude Code         |
| 20  | Esc+Esc Rewind Menu      | 1.5일  | ★★★★☆  | Claude Code + Codex |
| 21  | Task List Ctrl+T         | 0.5일  | ★★★☆☆  | Claude Code         |
| 22  | Granular Auto-Approve    | 1.5일  | ★★★★★  | Cline CLI 2.0       |

### Tier 4 — 장기 로드맵 (15일+, Sprint 5+)

| #   | Feature                           | Effort | Impact | Source              |
| --- | --------------------------------- | ------ | ------ | ------------------- |
| 23  | /theme Picker                     | 2일    | ★★★☆☆  | Claude Code + Codex |
| 24  | Prompt Suggestions                | 2일    | ★★★★☆  | Claude Code         |
| 25  | /copy Code Block Picker           | 0.5일  | ★★★☆☆  | Claude Code + Codex |
| 26  | PR Review Status Footer           | 1일    | ★★★☆☆  | Claude Code         |
| 27  | /stats Visualization              | 1.5일  | ★★☆☆☆  | Claude Code         |
| 28  | /security-review                  | 1일    | ★★★☆☆  | Claude Code         |
| 29  | /insights Session Analysis        | 2일    | ★★☆☆☆  | Claude Code         |
| 30  | Vim Mode                          | 3일    | ★★☆☆☆  | Claude Code         |
| 31  | /pr-comments                      | 0.5일  | ★★☆☆☆  | Claude Code         |
| 32  | Agent Teams                       | 5일    | ★★★★★  | Claude Code + Codex |
| 33  | /review (Critical/Important 분류) | 1.5일  | ★★★☆☆  | Codex CLI           |

---

## Part VII: 변경 파일 총괄

### 기존 파일 수정 (14개)

| File                                      | Sprint | Changes                               |
| ----------------------------------------- | ------ | ------------------------------------- |
| `src/cli/components/ToolCallBlock.tsx`    | 1, 2   | diff 기본 표시 + word-level diff      |
| `src/cli/renderer/tool-display.ts`        | 1, 2   | 상대경로, 헤더 포맷, smart output     |
| `src/cli/renderer/markdown.ts`            | 1      | shiki 구문 강조 연결                  |
| `src/cli/components/StatusBar.tsx`        | 1, 3   | 토큰 카운터 + 커스텀 statusline 폴백  |
| `src/cli/components/Spinner.tsx`          | 1      | 경과 시간 카운터                      |
| `src/cli/hooks/useAgentLoop.ts`           | 1, 2   | usage 구독 + ! bash + notification    |
| `src/cli/App.tsx`                         | 1-4    | StatusBar 연결, 키바인딩, 오버레이    |
| `src/cli/components/UserInput.tsx`        | 2      | !, @ 드롭다운, Ctrl+R/G               |
| `src/cli/hooks/useInput.ts`               | 2      | reverse search 상태 머신              |
| `src/cli/components/PermissionPrompt.tsx` | 2      | deny feedback + always 옵션           |
| `src/permissions/manager.ts`              | 2, 4   | 영구 정책 + 카테고리별                |
| `src/commands/diff.ts`                    | 3      | 인터랙티브 모드                       |
| `src/commands/context.ts`                 | 3      | 그리드 시각화                         |
| `src/config/schema.ts`                    | 2, 3   | notification + statusLine + reasoning |

### 신규 파일 (6개)

| File                                         | Sprint | Description              |
| -------------------------------------------- | ------ | ------------------------ |
| `src/commands/new.ts`                        | 2      | /new 명령                |
| `src/commands/btw.ts`                        | 3      | /btw 사이드 질문         |
| `src/cli/components/SideQuestionOverlay.tsx` | 3      | /btw 오버레이 UI         |
| `src/cli/components/CustomStatusLine.tsx`    | 3      | 커스텀 statusline 렌더러 |
| `src/cli/components/DiffViewer.tsx`          | 3      | 인터랙티브 diff 뷰어     |
| `src/cli/components/RewindMenu.tsx`          | 3      | Esc+Esc 되돌리기 메뉴    |

---

## Part VIII: 위험 요소 및 대응

| Risk                              | Impact                       | Mitigation                                |
| --------------------------------- | ---------------------------- | ----------------------------------------- |
| Diff 기본 표시 시 화면 과다 점유  | UX 저하                      | 기본 8줄 제한 + 접기, 긴 diff는 축약      |
| usage 이벤트 미발생 (모델별 차이) | 토큰 카운터 0 표시           | 로컬 token-counter 폴백 유지              |
| Responses API usage 지연          | 스트리밍 중 0 → 완료 시 갱신 | `response.completed` 시점에 일괄 반영     |
| shiki 초기 로딩 시간              | 시작 느림                    | dynamic import + lazy loading             |
| 터미널 폭 부족                    | statusline 잘림              | `process.stdout.columns` 기반 반응형      |
| anti-flicker 충돌                 | 빠른 업데이트 깜빡임         | 100ms throttle (기존 text buffering 동일) |
| OSC9 미지원 터미널                | 알림 무동작                  | BEL 폴백 + 설정 비활성화 기본             |
| 커스텀 statusline 스크립트 오류   | 상태바 공백                  | try/catch + 기존 StatusBar 폴백           |

---

## Part IX: 성공 지표

### Sprint 1 완료 기준

1. ✅ file_edit 완료 시 diff가 기본 표시된다 (verbose 불필요)
2. ✅ 스트리밍 중 StatusBar에 `↑Nk ↓Mk` 토큰 카운터가 실시간 업데이트된다
3. ✅ 세션 누적 비용($)이 StatusBar에 표시된다
4. ✅ LLM 대기 중 "Thinking... (3s)" 경과 시간이 표시된다
5. ✅ 코드 블록에 언어별 구문 강조가 적용된다

### Sprint 2-3 완료 기준

6. ✅ `!ls` 입력 시 LLM 호출 없이 직접 실행, 출력이 컨텍스트에 추가
7. ✅ `@` 입력 시 파일 자동완성 드롭다운이 표시된다
8. ✅ Ctrl+R로 이전 입력을 인터랙티브 검색
9. ✅ 도구 거부 시 사유를 입력하면 에이전트가 대안을 시도
10. ✅ diff에서 변경된 문자/단어가 진하게 강조된다
11. ✅ 권한 "Always" 승인이 다음 세션에도 유지된다

### Sprint 4 완료 기준

12. ✅ `/btw` 질문이 오버레이로 표시, 대화에 추가 안 됨
13. ✅ `/diff`에서 좌우 화살표로 turn별 diff 전환
14. ✅ `/context`에서 토큰 할당이 컬러 바로 시각화
15. ✅ Esc+Esc로 체크포인트 목록 열기, 선택 가능

---

## Appendix: 이벤트 흐름 다이어그램

```
[LLM Stream]
    │
    ├─ text-delta ──────────→ useTextBuffering → StreamingMessage
    │
    ├─ usage (from chunk) ──→ llm:usage event ──→ useAgentLoop.turnUsage
    │                                               │
    │                                               ↓
    │                                          App.tsx → StatusBar (↑/↓ tokens, $cost)
    │
    └─ stream complete ─────→ agent-loop
                                 │
                                 ├─ agent:usage-update ──→ useAgentLoop.cumulativeUsage
                                 │
                                 ├─ tool:start ──→ Spinner ("Running bash... (2s)")
                                 │
                                 ├─ tool:complete ──→ ToolCallBlock (diff preview)
                                 │
                                 └─ turn complete ──→ Notification (OSC9/BEL)
                                                      StatusBar 비용 갱신
```
