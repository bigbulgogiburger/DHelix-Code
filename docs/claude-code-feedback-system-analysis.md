# Claude Code 피드백 시스템 심층 분석

> **Date**: 2026-03-15
> **Scope**: Claude Code 터미널 UI의 모든 피드백 유형 vs dbcode 구현 상태
> **Components**: 22개 컴포넌트, 3,466 LOC

---

## 1. 피드백 유형 전체 맵 (26개)

Claude Code의 터미널 UI에서 사용자에게 보여주는 모든 피드백을 6개 카테고리, 26개 유형으로 분류했다.

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code 피드백 시스템              │
├──────────────┬──────────────────────────────────────────┤
│ 텍스트 응답   │ Streaming Message, Intermediate Text     │
│ 도구 호출     │ Running, Complete, Error, Denied          │
│ 대화형 프롬프트│ Permission, AskUser, SelectList           │
│ 상태 표시     │ AgentStatus, Thinking, Retry, StatusBar   │
│ 에러/알림     │ ErrorBanner, Notification, InlineError    │
│ 보조 UI      │ Input, SlashMenu, ReadGroup, TaskList,    │
│              │ Logo, Voice, Teammate, DiffPreview,       │
│              │ MessageQueue, ContextViz, PromptSuggest   │
└──────────────┴──────────────────────────────────────────┘
```

---

## 2. 카테고리별 상세 분석

### 2.1 텍스트 응답 (2종)

#### Streaming Message (최종 응답)

LLM이 최종 답변을 스트리밍할 때 표시되는 텍스트.

```
함수를 리팩토링하고 테스트를 통과시켰습니다.
변경된 파일은 src/utils.ts입니다.▌
```

| 항목        | 상세                                               |
| ----------- | -------------------------------------------------- |
| 파일        | `src/cli/components/StreamingMessage.tsx` (99 LOC) |
| 렌더링      | 완료된 문단 = 마크다운, 미완성 문단 = 원시 텍스트  |
| 커서        | `▌` (U+258C) — 스트리밍 중 gray로 깜빡임           |
| 코드 블록   | ``` 쌍 카운트로 미완성 감지 → 원시 텍스트 유지     |
| 최적화      | React.memo, useMemo로 리렌더링 최소화              |
| dbcode 상태 | ✅ 구현 완료 — `assistant:` 접두어 제거 완료       |

#### Intermediate Text (중간 메시지)

도구 호출 사이에 LLM이 보내는 짧은 설명 텍스트.

```
⏺ 파일 구조를 먼저 확인하겠습니다.
```

| 항목          | 상세                                                    |
| ------------- | ------------------------------------------------------- |
| 파일          | `ActivityFeed.tsx`, `TurnBlock.tsx`                     |
| 아이콘        | `⏺` (U+23FA) — **cyan** 색상                           |
| 시점          | `agent:assistant-message` 이벤트의 `isFinal=false`일 때 |
| 프롬프트 의존 | 시스템 프롬프트 Communication style 섹션이 LLM에게 지시 |
| dbcode 상태   | ✅ 구현 완료 — 렌더링 + 시스템 프롬프트 규칙            |

---

### 2.2 도구 호출 블록 (4가지 상태)

하나의 `ToolCallBlock` 컴포넌트(222 LOC)가 4가지 상태를 렌더링한다.

#### Running (실행 중)

```
⠋ Reading src/cli/App.tsx
```

| 항목     | 상세                                                                   |
| -------- | ---------------------------------------------------------------------- |
| 아이콘   | 브레일 스피너 `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` — 10프레임, 500ms 간격                      |
| 색상     | **yellow** (도구별 상이)                                               |
| 동사     | 도구별 진행형: Reading, Running, Searching, Writing, Editing, Fetching |
| 스트리밍 | bash_exec는 마지막 8줄을 gray로 실시간 표시                            |

#### Complete (완료)

```
  Read src/cli/App.tsx (1.2s)
   ⎿  352 lines
```

| 항목          | 상세                                                    |
| ------------- | ------------------------------------------------------- |
| 아이콘        | 없음 (스피너 사라짐)                                    |
| 동사          | 도구별 완료형: Read, Bash, Search, Write, Update, Fetch |
| 시간          | 괄호 안 dimColor — `(1.2s)`, `(350ms)`                  |
| 서브텍스트    | `⎿` (U+238E) 트리 커넥터로 결과 요약 표시               |
| Diff 미리보기 | file_edit 시 `+` (green), `-` (red) 라인 표시           |

#### Error (에러)

```
✗ Bash ls /nonexistent (1.1s)
   ⎿  No such file or directory
```

| 항목   | 상세                             |
| ------ | -------------------------------- |
| 아이콘 | `✗` (U+2717) — **red**           |
| 색상   | 헤더 전체가 **red**로 오버라이드 |

#### Denied (거부)

```
! Bash rm -rf /
   ⎿  Permission denied by user
```

| 항목   | 상세                                         |
| ------ | -------------------------------------------- |
| 아이콘 | `!` — **red**                                |
| 시점   | 사용자가 PermissionPrompt에서 "Deny" 선택 시 |

#### 도구별 디스플레이 설정

`tool-display.ts` (805 LOC)에서 도구마다 색상과 동사를 매핑한다.

| 도구        | 진행 동사     | 완료 동사 | 헤더 색상   |
| ----------- | ------------- | --------- | ----------- |
| file_read   | Reading       | Read      | **blue**    |
| file_write  | Writing       | Write     | **cyan**    |
| file_edit   | Updating      | Update    | **cyan**    |
| bash_exec   | Running       | Bash      | **yellow**  |
| glob_search | Searching     | Search    | **magenta** |
| grep_search | Searching     | Search    | **magenta** |
| web_fetch   | Fetching      | Fetch     | **magenta** |
| web_search  | Searching web | WebSearch | **magenta** |
| list_dir    | Listing       | List      | **blue**    |
| agent       | Running agent | Agent     | **green**   |
| ask_user    | Asking        | Ask       | **yellow**  |
| kill_shell  | Terminating   | Kill      | **red**     |

| dbcode 상태 | ✅ 4가지 상태 + 12개 도구 디스플레이 완전 구현 |
| ----------- | ---------------------------------------------- |

---

### 2.3 대화형 프롬프트 (3종)

#### Permission Prompt (권한 요청)

```
╭──────────────────────────────────────╮
│ Permission required                  │
│ Tool: bash_exec                      │
│ Arguments: {"command": "rm -rf /"}   │
│                                      │
│ ▸ Allow once  Allow for session  Deny│
╰──────────────────────────────────────╯
```

| 항목        | 상세                                                                |
| ----------- | ------------------------------------------------------------------- |
| 파일        | `PermissionPrompt.tsx` (92 LOC)                                     |
| 테두리      | 노란색 둥근 테두리 (`borderStyle="round"`, `borderColor="yellow"`)  |
| 선택 옵션   | Allow once / Allow for session / Deny — `←→` 탐색, `Enter` 확인     |
| 선택 UI     | 선택됨 = **cyan + bold + underline + `▸`**, 미선택 = **gray + dim** |
| 3가지 응답  | `"yes"` (1회), `"always"` (세션 전체), `"no"` (거부)                |
| dbcode 상태 | ✅ 완전 구현                                                        |

#### Ask User Question (에이전트 질문)

```
? 어떤 프레임워크를 사용할까요?
```

| 항목        | 상세                                                               |
| ----------- | ------------------------------------------------------------------ |
| 파일        | `ask-user.ts` (도구), `App.tsx` (UI)                               |
| 자유 입력   | `?` (cyan) + 질문 (bold) → 일반 입력창에서 답변                    |
| 선택지      | 선택지가 있으면 `SelectList` 컴포넌트로 렌더링                     |
| 대기 방식   | 이벤트 기반 Promise 대기 (`ask_user:prompt` / `ask_user:response`) |
| AbortSignal | Esc 키로 취소 가능                                                 |
| dbcode 상태 | ✅ 구현 완료 (이번 세션에서 리팩토링)                              |

#### Select List (대화형 선택)

```
┌────────────────────────────────────────┐
│ ▸ gpt-4o — OpenAI GPT-4o              │
│   claude-sonnet-4 — Anthropic Sonnet     │
│   gpt-4o-mini — OpenAI Mini            │
│   ↓ more                               │
└────────────────────────────────────────┘
```

| 항목        | 상세                                                 |
| ----------- | ---------------------------------------------------- |
| 파일        | `SelectList.tsx` (138 LOC)                           |
| 탐색        | `↑↓` 이동, `Enter` 선택, `Esc` 취소                  |
| 스크롤      | maxVisible (기본 8) 초과 시 `↑ more` / `↓ more` 표시 |
| 선택 UI     | **cyan + bold + `▸`**                                |
| dbcode 상태 | ✅ 완전 구현                                         |

---

### 2.4 상태 표시 (4종)

#### Agent Status (처리 중 스피너)

```
✦ 코드 분석 중… 근데 이제 AI를 곁들인 (3분 2초 · ↓ 45,678 tokens)
```

| 항목          | 상세                                            |
| ------------- | ----------------------------------------------- |
| 파일          | `AgentStatus.tsx` (117 LOC)                     |
| 별 애니메이션 | `✦`/`✧` 토글, 400ms, **bold magenta**           |
| 메시지        | 26개 한국어 메시지 중 랜덤 1회 선택 (순환 없음) |
| 메타 정보     | `(경과시간 · ↓ 토큰수)` — dimColor              |
| 표시 조건     | `isProcessing && !isStreamingFinal`             |
| dbcode 상태   | ✅ 구현 완료 (이번 세션에서 개선)               |

#### Thinking Block (확장 사고)

```
접힘: | Thinking... (14,567 tokens)
펼침: / Thinking (14,567 tokens):
        Step 1: 코드베이스 구조 분석...
        Step 2: 관련 파일 식별...
```

| 항목        | 상세                                         |
| ----------- | -------------------------------------------- |
| 파일        | `ThinkingBlock.tsx` (88 LOC)                 |
| 접힘/펼침   | Ctrl+O로 토글                                |
| 스피너      | ASCII `\|/-\\` 회전, 200ms (스트리밍 중에만) |
| 토큰        | `toLocaleString()` 포맷                      |
| 최대 표시   | 펼침 시 20줄까지                             |
| dbcode 상태 | ✅ 완전 구현                                 |

#### Retry Countdown (재시도 카운트다운)

```
⏳ 재시도까지 5초...
```

| 항목        | 상세                           |
| ----------- | ------------------------------ |
| 파일        | `RetryCountdown.tsx` (52 LOC)  |
| 아이콘      | `⏳` (U+23F3) — dimColor       |
| 카운트      | 1초 간격, 0 이하이면 자동 소멸 |
| dbcode 상태 | ✅ 완전 구현                   |

#### Status Bar (하단 상태 바)

```
┌─────────────────────────────────────────────────────┐
│ gpt-4o v0.1.0  [####-----------] 25%  $0.12         │
│                [Default] [Verbose] [Thinking] ready  │
└─────────────────────────────────────────────────────┘
```

| 항목        | 상세                                                         |
| ----------- | ------------------------------------------------------------ |
| 파일        | `StatusBar.tsx` (133 LOC)                                    |
| 사용률 바   | `[#####----------]` — green(<60%), yellow(60-80%), red(>80%) |
| 비용        | `$0.12` (cyan, 2자리 소수)                                   |
| 태그        | `[Default]` green, `[Verbose]` yellow, `[Thinking]` cyan     |
| 테두리      | 사용률 80% 초과 시 **red**으로 변경                          |
| dbcode 상태 | ✅ 완전 구현                                                 |

---

### 2.5 에러/알림 (3종)

#### Error Banner (에러 배너)

```
╭──────────────────────────────────────╮
│ ⏳ Error: Rate limit exceeded (429)   │
│ API 사용량이 초과되었습니다.            │
╰──────────────────────────────────────╯
```

| 에러 유형       | 아이콘 | 감지 키워드               | 가이드 메시지                        |
| --------------- | ------ | ------------------------- | ------------------------------------ |
| rate_limit      | ⏳     | "429", "rate limit"       | API 사용량 초과. 잠시 후 재시도...   |
| network         | 🔌     | "ECONNREFUSED", "timeout" | 네트워크 확인. `--base-url <url>`    |
| token_limit     | 📏     | "too many tokens"         | 대화가 깁니다. `/compact`로 압축     |
| auth            | 🔑     | "401", "api key"          | API 키 확인. `--api-key`             |
| model_not_found | 🤖     | "404" + "model"           | 모델을 찾을 수 없음. `/model`로 변경 |
| unknown         | ❌     | (폴백)                    | —                                    |

| 파일        | `ErrorBanner.tsx` (123 LOC) |
| ----------- | --------------------------- |
| dbcode 상태 | ✅ 완전 구현                |

#### Notification (알림 배너)

```
Permission mode: Plan
```

| 항목        | 상세                                                              |
| ----------- | ----------------------------------------------------------------- |
| 색상        | **yellow**                                                        |
| 지속시간    | 2초 후 자동 소멸 (`setTimeout`)                                   |
| 트리거      | 키보드 단축키 (Shift+Tab 모드, Ctrl+O 상세, Alt+T 사고, Esc 취소) |
| dbcode 상태 | ✅ 완전 구현                                                      |

#### Inline Error (인라인 에러)

| 항목        | 상세                              |
| ----------- | --------------------------------- |
| 색상        | **red**                           |
| 위치        | ActivityFeed 내, `marginLeft={2}` |
| 시점        | 비치명적 에러 (활동 피드에 삽입)  |
| dbcode 상태 | ✅ 구현                           |

---

### 2.6 보조 UI (10종)

| 컴포넌트                | 파일                     | LOC | 역할                                                         | dbcode |
| ----------------------- | ------------------------ | --- | ------------------------------------------------------------ | ------ |
| **UserInput**           | `UserInput.tsx`          | 528 | 전체 readline 에뮬레이션 — Tab 완성, @멘션, 다중줄, 히스토리 | ✅     |
| **SlashCommandMenu**    | `SlashCommandMenu.tsx`   | 149 | `/` 입력 시 명령어 자동완성 메뉴                             | ✅     |
| **ReadGroupBlock**      | `ReadGroupBlock.tsx`     | 91  | 연속 파일 읽기 2개 이상 → "Read N files"로 그룹화            | ✅     |
| **DiffPreview**         | `ToolCallBlock.tsx` 내   | —   | file_edit 결과의 `+`(green) `-`(red) 라인 미리보기           | ✅     |
| **TaskListView**        | `TaskListView.tsx`       | 113 | 계층적 작업 트리 — `○◐●✕⊘` 상태 아이콘                       | ✅     |
| **Logo**                | `Logo.tsx`               | 113 | 24비트 컬러 유니코드 블록 아트 브랜딩                        | ✅     |
| **VoiceIndicator**      | `VoiceIndicator.tsx`     | 48  | 녹음(`●` red) / 변환(`◌` yellow) 상태 표시                   | ✅     |
| **TeammateStatus**      | `TeammateStatus.tsx`     | 261 | 멀티에이전트 팀 진행 상황 — **Claude Code 초과 기능**        | ✅     |
| **MessageQueue**        | `App.tsx` 내             | —   | `(3 message(s) queued)` gray 텍스트                          | ✅     |
| **Synchronized Output** | `synchronized-output.ts` | 104 | DEC Mode 2026 깜빡임 방지 — **Claude Code 초과 기능**        | ✅     |

---

## 3. 사용된 유니코드 문자 총정리

| 문자         | 이름                                | 코드        | 용도                     | 색상        |
| ------------ | ----------------------------------- | ----------- | ------------------------ | ----------- |
| `▌`          | Left Half Block                     | U+258C      | 스트리밍 커서            | gray        |
| `⏺`         | Black Circle for Record             | U+23FA      | 중간 메시지 마커         | cyan        |
| `✦` `✧`      | Black/White 4-Pointed Star          | U+2726/2727 | AgentStatus 애니메이션   | magenta     |
| `✗`          | Ballot X                            | U+2717      | 도구 에러                | red         |
| `⎿`          | Dentistry Symbol                    | U+23BF      | 트리 커넥터 (서브텍스트) | dim         |
| `▸`          | Black Right-Pointing Small Triangle | U+25B8      | 선택 마커                | cyan        |
| `⏳`         | Hourglass                           | U+23F3      | 재시도/Rate Limit        | dim         |
| `○`          | White Circle                        | U+25CB      | 작업 대기                | gray        |
| `◐`          | Circle with Left Half Black         | U+25D0      | 작업 진행 중             | yellow      |
| `●`          | Black Circle                        | U+25CF      | 작업 완료 / 녹음         | green / red |
| `✕`          | Multiplication X                    | U+2715      | 작업 실패                | red         |
| `⊘`          | Circled Division Slash              | U+2298      | 작업 취소                | gray        |
| `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | Braille Patterns                    | U+2800-28FF | 스피너 프레임 (10개)     | yellow      |
| `\|/-\\`     | ASCII                               | —           | Thinking 스피너 (4개)    | dim         |

---

## 4. 터미널 레이아웃 순서 (위 → 아래)

`App.tsx`의 렌더링 순서:

```
 1. ActivityFeed          완료된 턴(Static) + 라이브 턴(Dynamic)
 2. AgentStatus           ✦ 코드 분석 중… (isProcessing && !isStreamingFinal)
 3. PermissionPrompt      노란 테두리 권한 요청 박스
 4. SelectList            대화형 선택 (interactiveSelect)
 5. AskUser Question      ? 질문 텍스트 (pendingAskUser)
 6. CommandOutput         슬래시 명령 결과 텍스트
 7. VoiceIndicator        ● Recording... / ◌ Transcribing...
 8. ErrorBanner           빨간 테두리 에러 박스
 9. Notification          노란 텍스트 (2초 자동 소멸)
10. TaskListView          ○◐●✕⊘ 작업 트리
11. UserInput             > 입력 프롬프트
12. SlashCommandMenu      / 명령어 자동완성
13. MessageQueue          (N message(s) queued)
14. StatusBar             모델 | 사용률 | 비용 | 모드 (항상 최하단)
```

---

## 5. 시스템 프롬프트 커뮤니케이션 규칙

`system-prompt-builder.ts`에 정의된 LLM 행동 규칙:

### Communication Style (텍스트 응답 규칙)

| 규칙             | 상세                                                                |
| ---------------- | ------------------------------------------------------------------- |
| 항상 텍스트 포함 | 도구 호출만으로 응답하지 않음 — 반드시 설명 텍스트 동반             |
| 도구 호출 전     | 1문장으로 의도 설명. 예: "파일 구조를 먼저 확인하겠습니다."         |
| 도구 호출 후     | 2-3문장으로 결과 요약. 예: "리팩토링 완료. 변경 파일: src/utils.ts" |
| 멀티스텝 중간    | 상태 업데이트. 예: "타입체크 통과. 이제 빌드를 실행합니다."         |
| 작업 완료 시     | 명확한 완료 메시지로 마무리                                         |

### Error Recovery (에러 복구 규칙)

| 단계         | 행동                                     |
| ------------ | ---------------------------------------- |
| 1. 인정      | 에러를 간결하게 설명 — 무엇이 잘못됐는지 |
| 2. 대안 설명 | 다음에 시도할 방법을 안내                |
| 3. 즉시 실행 | 대안을 바로 실행                         |
| 금지         | 같은 실패를 설명 없이 조용히 재시도      |

에러별 복구 예시:

| 에러                  | 복구 메시지                                         | 다음 행동        |
| --------------------- | --------------------------------------------------- | ---------------- |
| File not found        | "경로를 찾을 수 없습니다. 오타 확인하겠습니다."     | glob_search      |
| Command failed        | "빌드 실패. 에러를 분석하고 수정하겠습니다."        | 에러 분석 → 수정 |
| Permission denied     | "권한이 필요합니다. 다른 접근 방식을 시도합니다."   | 대안 실행        |
| Edit string not found | "문자열을 찾지 못했습니다. 파일을 다시 읽겠습니다." | file_read        |

---

## 6. dbcode 구현 상태 총괄

### 완전 구현 (22/26)

| #   | 피드백 유형              | 컴포넌트                 | LOC | 품질  |
| --- | ------------------------ | ------------------------ | --- | ----- |
| 1   | Streaming Message        | StreamingMessage.tsx     | 99  | 9/10  |
| 2   | Intermediate Text (`⏺`) | ActivityFeed + TurnBlock | —   | 9/10  |
| 3   | Tool Running             | ToolCallBlock.tsx        | 222 | 10/10 |
| 4   | Tool Complete            | ToolCallBlock.tsx        | —   | 10/10 |
| 5   | Tool Error               | ToolCallBlock.tsx        | —   | 10/10 |
| 6   | Tool Denied              | ToolCallBlock.tsx        | —   | 10/10 |
| 7   | Permission Prompt        | PermissionPrompt.tsx     | 92  | 9/10  |
| 8   | Ask User Question        | ask-user.ts + App.tsx    | —   | 8/10  |
| 9   | Select List              | SelectList.tsx           | 138 | 9/10  |
| 10  | Agent Status             | AgentStatus.tsx          | 117 | 9/10  |
| 11  | Thinking Block           | ThinkingBlock.tsx        | 88  | 9/10  |
| 12  | Retry Countdown          | RetryCountdown.tsx       | 52  | 8/10  |
| 13  | Status Bar               | StatusBar.tsx            | 133 | 9/10  |
| 14  | Error Banner             | ErrorBanner.tsx          | 123 | 8/10  |
| 15  | Notification             | App.tsx 내               | —   | 8/10  |
| 16  | Inline Error             | ActivityFeed.tsx 내      | —   | 7/10  |
| 17  | User Input               | UserInput.tsx            | 528 | 10/10 |
| 18  | Slash Command Menu       | SlashCommandMenu.tsx     | 149 | 9/10  |
| 19  | Read Group               | ReadGroupBlock.tsx       | 91  | 9/10  |
| 20  | Task List                | TaskListView.tsx         | 113 | 9/10  |
| 21  | Logo                     | Logo.tsx                 | 113 | 9/10  |
| 22  | Voice Indicator          | VoiceIndicator.tsx       | 48  | 7/10  |

### Claude Code 초과 기능 (2개)

| #   | 기능            | 파일                   | LOC | 상세                                             |
| --- | --------------- | ---------------------- | --- | ------------------------------------------------ |
| 23  | Teammate Status | TeammateStatus.tsx     | 261 | 멀티에이전트 팀 진행 상황 시각화                 |
| 24  | DEC Mode 2026   | synchronized-output.ts | 104 | 터미널 깜빡임 방지 (Ghostty/iTerm2/WezTerm 지원) |

### 미구현 (2개)

| #   | 기능                      | 상세                                    | 영향도 | 구현 난이도                                  |
| --- | ------------------------- | --------------------------------------- | ------ | -------------------------------------------- |
| 25  | **Prompt Suggestions**    | 입력창에 고스트 텍스트로 다음 명령 제안 | Medium | High — LLM 기반 자동완성 필요                |
| 26  | **Context Visualization** | `/context` 명령으로 컬러 그리드 시각화  | Low    | Low — `/context` 명령은 존재하나 텍스트 기반 |

---

## 7. 개선 로드맵

### Phase 1: 즉시 (이번 세션 완료)

- [x] Intermediate Text 렌더링 (`⏺`)
- [x] Communication Style 시스템 프롬프트
- [x] Error Recovery 시스템 프롬프트
- [x] ask_user 이벤트 기반 대기
- [x] AgentStatus 메시지 고정 (순환 제거)
- [x] AgentStatus isStreamingFinal 조건
- [x] StreamingMessage `assistant:` 접두어 제거

### Phase 2: 단기 (1-2주)

- [ ] Prompt Suggestions — 대화 히스토리 기반 고스트 텍스트 자동완성
- [ ] Context Visualization — `/context` 컬러 그리드 강화
- [ ] VoiceIndicator — 실제 녹음 로직 연결 완성
- [ ] ErrorBanner 정규식 엣지케이스 보강

### Phase 3: 중기 (1개월)

- [ ] 접근성(A11Y) — ARIA 속성 추가
- [ ] 도구 출력 스트리밍 그룹화 — 카테고리별 접기/펼치기
- [ ] 도구별 아이콘 추가 — 현재 텍스트만, 아이콘 추가 가능
