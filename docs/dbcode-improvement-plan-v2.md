# dbcode 개선 개발 기획서 v2

> **작성일**: 2026-03-07
> **참조 기준**: Anthropic Claude Code (설치된 버전)
> **범위**: CLI UX, Slash Command 시스템, Agent Loop, E2E 테스트, 전반적 품질

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [Critical Bugs — 즉시 수정 필요](#2-critical-bugs)
3. [Slash Command 시스템 전면 개편](#3-slash-command-시스템-전면-개편)
4. [입력 UX 개선](#4-입력-ux-개선)
5. [Agent Loop 안정성](#5-agent-loop-안정성)
6. [E2E 테스트 프레임워크 개선](#6-e2e-테스트-프레임워크-개선)
7. [Claude Code 대비 기능 Gap 분석](#7-claude-code-대비-기능-gap-분석)
8. [구현 우선순위 및 로드맵](#8-구현-우선순위-및-로드맵)

---

## 1. Executive Summary

dbcode는 현재 기본적인 CLI AI 코딩 어시스턴트 기능을 갖추고 있으나, 실 사용 테스트에서 다음의 핵심 문제가 발견됨:

| 구분 | 문제                                                    | 심각도   | 상태          |
| ---- | ------------------------------------------------------- | -------- | ------------- |
| P0   | Slash command 입력 시 키보드 완전 freeze                | Critical | 미수정        |
| P0   | `/init` 명령어 미등록                                   | Critical | 미수정        |
| P1   | Slash command 실시간 필터링 미지원                      | High     | 미수정        |
| P1   | Slash menu 스크롤 뷰포트 미지원 (전체 목록 한번에 표시) | High     | 미수정        |
| P1   | Enter 키 newline으로 동작                               | High     | **수정 완료** |
| P2   | E2E 테스트 안정성 (타임아웃, 레이트리밋)                | Medium   | 미수정        |
| P2   | DBCODE.md 자동 참조 부재                                | Medium   | 미수정        |

---

## 2. Critical Bugs

### 2.1 Slash Command 입력 시 키보드 Freeze

**현상**: `/`를 입력하면 SlashCommandMenu가 표시되면서 이후 모든 키 입력이 불가능해짐.

**근본 원인** (`src/cli/App.tsx:479`):

```tsx
<UserInput
  onSubmit={handleSubmit}
  onChange={setInputValue}
  isDisabled={slashMenuVisible} // ← 이것이 문제
/>
```

`slashMenuVisible`이 true가 되면 `UserInput`의 `useInput`이 `isActive: false`로 비활성화되어,
추가 문자 입력이 전혀 불가능해짐. 즉, `/`를 입력한 뒤 `h`, `e`, `l`, `p` 등을 이어서 타이핑할 수 없음.

**Claude Code 동작**: `/` 입력 후에도 자유롭게 타이핑 가능. 입력한 문자에 따라 메뉴가 실시간 필터링됨. Tab/Enter로 선택, Escape로 취소.

**수정 방안**:

1. `isDisabled={slashMenuVisible}` 제거 — UserInput은 항상 활성 상태 유지
2. SlashCommandMenu는 `onChange`로 전달되는 `inputValue`에 반응하여 필터링만 수행
3. SlashCommandMenu의 `useInput`은 navigation(↑↓) 및 selection(Tab/Enter)만 처리
4. Enter는 UserInput에서 정상적으로 submit → 이미 `commandRegistry.isCommand()`로 라우팅됨

**변경 파일**:

- `src/cli/App.tsx` — `isDisabled` 로직 변경
- `src/cli/components/SlashCommandMenu.tsx` — 캐릭터 입력 처리 제거 (이미 없음, 구조만 확인)
- `src/cli/components/UserInput.tsx` — isDisabled 조건 조정 불필요 (항상 활성)

### 2.2 `/init` 명령어 누락

**현상**: `/init`이 slash command 목록에 나타나지 않음.

**근본 원인**: `src/commands/init.ts`는 `initProject()` 함수만 export하며, `SlashCommand` 인터페이스를 구현하지 않음. `src/index.ts:222-247`의 등록 목록에도 없음.

**수정 방안**:

```typescript
// src/commands/init.ts 에 추가
export const initCommand: SlashCommand = {
  name: "init",
  description: "Initialize dbcode project (creates DBCODE.md, .dbcode/ directory)",
  usage: "/init",
  execute: async (_args, context) => {
    const result = await initProject(context.workingDirectory);
    if (result.created) {
      return { output: `Project initialized at ${result.path}`, success: true };
    }
    return { output: `Already initialized at ${result.path}`, success: true };
  },
};
```

`src/index.ts`의 commands 배열에 `initCommand` 추가.

---

## 3. Slash Command 시스템 전면 개편

### 3.1 현재 상태 vs Claude Code

| 기능                                | Claude Code           | dbcode        | Gap       |
| ----------------------------------- | --------------------- | ------------- | --------- |
| 등록된 명령어 수                    | 70+                   | 22            | 확장 필요 |
| 실시간 필터링                       | O                     | X             | **필수**  |
| 입력 중 타이핑                      | O                     | X (freeze)    | **필수**  |
| 스크롤 뷰포트 (N개만 표시 + 스크롤) | O (5-8개 윈도우)      | X (전체 나열) | **필수**  |
| 메뉴 위치                           | 입력줄 아래           | 입력줄 위     | **필수**  |
| Tab 자동완성                        | O                     | O             | 동일      |
| Escape 취소                         | O                     | O             | 동일      |
| `/init`                             | O                     | X             | **필수**  |
| 인자 처리                           | O (예: /model sonnet) | O             | 동일      |
| 명령어 별칭                         | 일부 지원             | X             | P3        |

### 3.2 실시간 필터링 구현

**현재**: `prefix`가 `App.tsx`의 `inputValue`에서 전달되지만, `slashMenuVisible` 조건이 `!inputValue.includes(" ")`이므로 오직 `/` 뒤에 공백이 없을 때만 메뉴 표시. 하지만 입력이 freeze되어 필터링 자체가 불가능.

**수정 후 동작 흐름**:

```
1. 사용자가 `/` 입력
2. inputValue = "/" → slashMenuVisible = true → 전체 명령어 목록 표시
3. 사용자가 `h` 입력 → inputValue = "/h" → 필터: /help, /history 등
4. 사용자가 `e` 입력 → inputValue = "/he" → 필터: /help
5. Tab 또는 Enter → /help 선택 및 실행
6. 또는 `/help arg` 입력 → 공백 감지 → 메뉴 닫힘 → Enter로 직접 submit
```

**핵심 변경**:

- `App.tsx`: `isDisabled` prop 제거 또는 `false` 고정
- `SlashCommandMenu.tsx`: `getMatchingCommands()`는 이미 올바르게 필터링함 — 변경 불필요
- `UserInput`과 `SlashCommandMenu`가 동시에 `useInput` 활성화되는 충돌 해결:
  - 방법 A: SlashCommandMenu에서 `useInput` 제거, 대신 UserInput이 `↑↓Tab` 이벤트를 SlashCommandMenu로 전달
  - 방법 B (권장): UserInput 항상 활성, SlashCommandMenu는 별도 `useInput`으로 `↑↓Tab Escape`만 처리. Ink 5.x는 여러 `useInput` 훅이 공존 가능 — 둘 다 이벤트를 받되, UserInput은 `↑↓`를 slash menu가 보일 때 무시하고 일반 문자만 처리.

### 3.3 useInput 충돌 해결 전략

Ink 5.x에서는 여러 컴포넌트가 동시에 `useInput`을 사용할 수 있으나, 키 이벤트가 모든 활성 훅에 브로드캐스트됨.

**해결 패턴** (Claude Code 참조):

```tsx
// UserInput에서: slash menu가 보일 때 ↑↓ 키를 무시
if (slashMenuVisible && (key.upArrow || key.downArrow || key.tab)) {
  return; // SlashCommandMenu가 처리
}
```

```tsx
// SlashCommandMenu에서: 문자 입력은 무시 (UserInput이 처리)
useInput(
  (_input, key) => {
    if (key.upArrow) {
      /* navigate */
    }
    if (key.downArrow) {
      /* navigate */
    }
    if (key.tab || key.return) {
      /* select */
    }
    if (key.escape) {
      /* close */
    }
    // 문자 입력(_input)은 무시 → UserInput으로 흘러감
  },
  { isActive: visible },
);
```

### 3.4 스크롤 뷰포트 + 메뉴 위치 개선

#### 현재 문제

1. **전체 목록 한번에 표시**: `/`를 입력하면 등록된 22개 명령어가 전부 화면에 나열됨. 명령어가 늘어날수록 화면을 가득 채움.
2. **메뉴가 입력줄 위에 표시**: 현재 SlashCommandMenu가 `<UserInput>` 위에 렌더링됨. Claude Code는 입력줄 아래에 드롭다운처럼 표시.

#### Claude Code 동작 (목표)

```
> /he█                          ← 입력줄
┌─────────────────────────────┐
│ ▸ /help — Show help         │  ← 선택 포인터 (▸)
│   /help-search — Search...  │
│   /help-tips — Quick tips   │
└─────────────────────────────┘
                                  ← 최대 5~8개만 표시
```

- **뷰포트 윈도우**: 한 번에 최대 `MAX_VISIBLE` 개 (5~8개)만 표시
- **스크롤**: ↓ 방향키로 마지막 항목을 넘어가면 목록이 스크롤되어 다음 항목이 보임
- **포인터 이동**: `▸` 포인터가 현재 선택 항목 옆에 표시되고, ↑↓로 이동
- **순환 없음**: 맨 위에서 ↑ → 움직이지 않음, 맨 아래에서 ↓ → 움직이지 않음 (Claude Code 동작)
- **메뉴 위치**: 입력줄 바로 **아래**에 표시 (드롭다운 패턴)

#### 구현 설계

```tsx
const MAX_VISIBLE = 6; // 한 번에 보이는 최대 명령어 수

function SlashCommandMenu({ commands, prefix, ... }) {
  const filtered = getMatchingCommands(prefix, commands);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 뷰포트 계산: selectedIndex가 항상 보이도록 scrollOffset 조정
  const scrollOffset = useMemo(() => {
    if (filtered.length <= MAX_VISIBLE) return 0;
    // 선택이 뷰포트 아래로 벗어나면 스크롤
    if (selectedIndex >= scrollOffset + MAX_VISIBLE) {
      return selectedIndex - MAX_VISIBLE + 1;
    }
    // 선택이 뷰포트 위로 벗어나면 스크롤
    if (selectedIndex < scrollOffset) {
      return selectedIndex;
    }
    return scrollOffset;
  }, [selectedIndex, filtered.length]);

  const visibleItems = filtered.slice(scrollOffset, scrollOffset + MAX_VISIBLE);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + MAX_VISIBLE < filtered.length;

  return (
    <Box flexDirection="column" borderStyle="single">
      {hasMoreAbove && <Text color="gray">  ↑ more</Text>}
      {visibleItems.map((cmd, i) => {
        const isSelected = scrollOffset + i === selectedIndex;
        return (
          <Box key={cmd.name}>
            <Text>{isSelected ? "▸ " : "  "}</Text>
            <Text>{"/" + cmd.name}</Text>
            <Text> — {cmd.description}</Text>
          </Box>
        );
      })}
      {hasMoreBelow && <Text color="gray">  ↓ more</Text>}
    </Box>
  );
}
```

#### 메뉴 위치 변경 (App.tsx 렌더링 순서)

**현재** (메뉴가 위, 입력이 아래):

```tsx
{slashMenuVisible && <SlashCommandMenu ... />}  // ← 위
<UserInput ... />                                  // ← 아래
```

**수정** (입력이 위, 메뉴가 아래 = 드롭다운):

```tsx
<UserInput ... />                                  // ← 위 (입력줄)
{slashMenuVisible && <SlashCommandMenu ... />}  // ← 아래 (드롭다운)
```

### 3.5 누락 명령어 추가 계획

Claude Code에 있으나 dbcode에 없는 주요 명령어:

| 명령어            | 설명                 | 우선순위  |
| ----------------- | -------------------- | --------- |
| `/init`           | 프로젝트 초기화      | P0 — 즉시 |
| `/status`         | 현재 세션 상태       | P2        |
| `/permissions`    | 권한 설정 보기/변경  | P2        |
| `/logout`         | 인증 해제            | P3        |
| `/memory`         | 세션 메모리 관리     | P3        |
| `/plan`           | 구현 계획 모드       | P2        |
| `/undo`           | 마지막 변경 되돌리기 | P2        |
| `/terminal-setup` | 터미널 설정 가이드   | P3        |

---

## 4. 입력 UX 개선

### 4.1 Enter 키 Submit 문제 (수정 완료)

**문제**: 일부 터미널에서 Enter가 `\n`(linefeed)으로 전달되는데, Ink의 `parseKeypress`가 `\r` → `name='return'`, `\n` → `name='enter'`로 다르게 매핑. `key.return`만 체크하면 `\n` 전송 터미널에서 Enter가 submit되지 않음.

**수정 완료** (`src/cli/components/UserInput.tsx:52`):

```typescript
const isEnter = key.return || input === "\n" || input === "\r";
```

테스트 3건 추가 (`test/unit/cli/components/UserInput.test.ts`): 36/36 통과.

### 4.2 추가 입력 개선 사항

| 항목                  | 설명                                               | 우선순위       |
| --------------------- | -------------------------------------------------- | -------------- |
| 한글 조합 입력        | IME 조합 중인 한글이 커서 위치와 맞지 않을 수 있음 | P2             |
| 붙여넣기 (multi-char) | 한 번에 여러 문자 붙여넣기 시 올바르게 삽입        | P1 — 확인 필요 |
| Ctrl+W (단어 삭제)    | readline 표준 단축키 미지원                        | P2             |
| Ctrl+L (화면 클리어)  | 터미널 클리어 미지원                               | P3             |
| Alt+←/→ (단어 이동)   | 단어 단위 커서 이동 미지원                         | P2             |
| Ctrl+D (EOF/exit)     | 빈 줄에서 exit, 문자 있으면 delete forward         | P2             |
| Home/End 키           | Home → 줄 시작, End → 줄 끝 (Ctrl+A/E와 동일)      | P3             |

---

## 5. Agent Loop 안정성

### 5.1 E2E 테스트에서 발견된 문제

Spring Boot + React E2E 테스트 (9턴) 결과: **5 pass / 4 fail**

| 턴  | 이름                 | 결과 | 원인                                           |
| --- | -------------------- | ---- | ---------------------------------------------- |
| 0   | DBCODE.md 초기화     | PASS |                                                |
| 1   | Backend scaffold     | FAIL | `gradle init` 사용 → 예상과 다른 디렉토리 구조 |
| 2   | REST API             | PASS |                                                |
| 3   | Frontend scaffold    | PASS |                                                |
| 4   | Frontend components  | PASS |                                                |
| 5   | Integration          | PASS |                                                |
| 6   | Build validation     | FAIL | Turn 1 구조 문제의 연쇄 효과                   |
| 7   | Tests + coverage     | FAIL | 300초 타임아웃 (Gradle 테스트 느림)            |
| 8   | DBCODE.md compliance | FAIL | OpenAI 429 레이트 리밋 (65회 API 호출 후)      |

### 5.2 DBCODE.md 자동 참조 부재

**심각한 문제**: E2E 세션 동안 DBCODE.md를 **한 번도 읽지 않았음** (`metrics.dbcodeReads: 0`).

프롬프트에 "Refer to DBCODE.md"라고 명시해도 agent가 자발적으로 file_read를 호출하지 않는 경우가 있음.

**수정 방안**:

1. **시스템 프롬프트에 DBCODE.md 내용 삽입**: `buildSystemPrompt()`에서 DBCODE.md가 존재하면 내용을 자동으로 시스템 프롬프트에 포함
2. **이미 `projectInstructions` 기능 존재** — `loadInstructions()`가 DBCODE.md를 읽어서 `buildSystemPrompt()`에 전달하고 있음
3. **문제**: E2E 테스트의 `buildSystemPrompt()` 호출에서 `projectInstructions`를 전달하지 않음
4. **E2E 테스트 수정**: `sendTurn()` 전에 DBCODE.md를 읽어서 `systemPrompt`에 포함

### 5.3 Agent Loop 개선 사항

| 항목                    | 설명                                                    | 우선순위 |
| ----------------------- | ------------------------------------------------------- | -------- |
| 레이트 리밋 재시도      | 429 응답 시 exponential backoff 재시도                  | P1       |
| 컨텍스트 압축           | 긴 세션에서 이전 턴 요약 → 토큰 절약                    | P1       |
| 도구 실행 타임아웃 조정 | Gradle/Maven은 120초 부족할 수 있음 → 설정 가능하게     | P2       |
| 중간 체크포인트         | 각 턴 완료 후 자동 세이브 → 실패 시 재개 가능           | P2       |
| maxIterations 제어      | 턴당 25회 반복 제한은 복잡한 빌드 작업에 부족할 수 있음 | P2       |

---

## 6. E2E 테스트 프레임워크 개선

### 6.1 현재 구조

```
test/e2e/project-6-springboot-react-session.test.ts
  ├── beforeAll: 프로젝트 디렉토리 생성, 도구 등록
  ├── Turn 0-8: sendTurn() → runAgentLoop() → 검증
  └── afterAll: 리포트 출력
```

### 6.2 발견된 문제 및 수정

| 문제                                        | 수정 방안                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Turn 1에서 `gradle init` 사용 → 비표준 구조 | 프롬프트에 "Do NOT use gradle init. Write build.gradle.kts manually." 명시 |
| Turn 7 타임아웃 300초                       | 빌드+테스트 턴은 600초로 증가                                              |
| Turn 8 레이트 리밋 429                      | config에 `retryOn429: true, maxRetries: 3` 추가 (agent-loop 수정 필요)     |
| DBCODE.md 미참조                            | `projectInstructions`를 시스템 프롬프트에 포함                             |
| 메트릭에 args 누락                          | `toolCalls` 배열에 `args` 필드 추가 (이미 test-harness.md에 있으나 미적용) |

### 6.3 추가 스택 테스트 계획

| ID  | 스택                             | 상태                |
| --- | -------------------------------- | ------------------- |
| 1   | Spring MVC + JSP + JavaScript    | 미작성              |
| 2   | Spring Boot + React (TypeScript) | 작성 완료, 4/9 실패 |
| 3   | Spring Boot + Vue 3 (TypeScript) | 미작성              |
| 4   | Spring Boot + Flutter (Dart)     | 미작성              |
| 5   | Flutter WebView + Spring Boot    | 미작성              |

---

## 7. Claude Code 대비 기능 Gap 분석

### 7.1 Core Features

| 기능                     | Claude Code | dbcode         | Gap 수준 |
| ------------------------ | ----------- | -------------- | -------- |
| Slash commands           | 70+         | 22             | Medium   |
| `/init` (CLAUDE.md 생성) | O           | X (CLI만 가능) | High     |
| 실시간 필터링 메뉴       | O           | X (freeze)     | Critical |
| 멀티턴 대화              | O           | O              | 동일     |
| 도구 호출 (ReAct)        | O           | O              | 동일     |
| 스트리밍 출력            | O           | O              | 동일     |
| 권한 관리                | O           | O              | 동일     |
| 세션 저장/복원           | O           | O              | 동일     |
| Context 압축             | O           | 기본 구현      | Low      |
| MCP 지원                 | O           | O              | 동일     |
| Subagent 지원            | O           | 기본 구현      | Medium   |

### 7.2 UX Features

| 기능              | Claude Code | dbcode        | Gap 수준  |
| ----------------- | ----------- | ------------- | --------- |
| Activity Feed     | O           | O (신규 구현) | 동일      |
| 도구 실행 표시    | 상세        | 기본          | Medium    |
| Markdown 렌더링   | O           | O             | 동일      |
| 코드 하이라이팅   | O           | O             | 동일      |
| 토큰 사용량 표시  | O           | O             | 동일      |
| 대화 중 입력 큐잉 | O           | O             | 동일      |
| 키보드 단축키     | 풍부        | 기본 readline | Medium    |
| 한글 입력 (IME)   | O           | 미확인        | 확인 필요 |

### 7.3 Developer Experience

| 기능                | Claude Code                      | dbcode                  | Gap 수준 |
| ------------------- | -------------------------------- | ----------------------- | -------- |
| CLAUDE.md/DBCODE.md | 자동 로드 + 시스템 프롬프트 삽입 | 자동 로드 (구현됨)      | 동일     |
| .claude/rules/      | O                                | .dbcode/rules/ (구현됨) | 동일     |
| Hooks 시스템        | O                                | O                       | 동일     |
| Skills 시스템       | O                                | 미구현                  | High     |
| Git 통합            | O                                | bash_exec로 가능        | Low      |
| `/compact` 지능     | 핵심 정보 보존                   | 기본 구현               | Medium   |

---

## 8. 구현 우선순위 및 로드맵

### Phase 1: Critical Fixes (1-2일)

> 현재 사용 불가능한 기능을 정상화

- [ ] **P0**: Slash command 입력 freeze 해결
  - `App.tsx`에서 `isDisabled={slashMenuVisible}` 제거
  - UserInput에 `onUpArrow`/`onDownArrow` 콜백 추가 또는 조건부 무시
  - SlashCommandMenu와 UserInput의 `useInput` 공존 전략 구현
- [ ] **P0**: `/init` 명령어를 SlashCommand로 래핑 및 등록
  - `src/commands/init.ts`에 `initCommand` export 추가
  - `src/index.ts`의 commands 배열에 추가
- [ ] **P0**: 실시간 필터링 동작 확인 (freeze 수정 후 자동 작동할 수 있음)
- [ ] **P0**: Slash menu 스크롤 뷰포트 구현
  - `MAX_VISIBLE = 6` 개만 표시, 나머지는 ↑↓ 스크롤
  - 포인터(`▸`)가 선택 항목을 따라 이동
  - 위/아래에 더 있으면 `↑ more` / `↓ more` 표시
- [ ] **P0**: Slash menu 위치를 입력줄 **아래**로 변경 (드롭다운 UX)
  - `App.tsx` 렌더링 순서: `<UserInput>` → `<SlashCommandMenu>` 으로 변경

### Phase 2: Stability (3-5일)

> Agent loop 안정성 및 E2E 테스트 신뢰성 확보

- [ ] **P1**: Agent loop에 429 레이트 리밋 재시도 로직 추가
  - `src/llm/client.ts`에 exponential backoff (1초, 2초, 4초, 최대 3회)
- [ ] **P1**: E2E 테스트 프롬프트 개선
  - Turn 1: "Do NOT use gradle init" 명시
  - Turn 7: 타임아웃 600초로 증가
  - 시스템 프롬프트에 DBCODE.md 내용 자동 포함
- [ ] **P1**: 붙여넣기 입력 검증 (multi-char input handling)

### Phase 3: UX Enhancement (1-2주)

> Claude Code 수준의 사용자 경험 구현

- [ ] **P2**: 추가 readline 단축키 (Ctrl+W, Ctrl+D, Alt+←/→)
- [ ] **P2**: 누락 slash commands 추가 (/status, /permissions, /plan, /undo)
- [ ] **P2**: 한글 IME 입력 테스트 및 수정
- [ ] **P2**: 도구 실행 표시 개선 (파일 경로, 크기, 소요 시간)
- [ ] **P2**: Context 압축 지능 향상 (핵심 정보 보존 규칙)

### Phase 4: Advanced Features (2-4주)

> 경쟁력 있는 기능 확장

- [ ] **P3**: Skills 시스템 구현 (SKILL.md 로딩, 트리거링)
- [ ] **P3**: 명령어 별칭 지원
- [ ] **P3**: `/terminal-setup` 가이드 명령어
- [ ] **P3**: Agent loop 중간 체크포인트 및 재개 기능

---

## 부록 A: 파일별 변경 매트릭스

| 파일                                         | Phase | 변경 내용                                                                              |
| -------------------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| `src/cli/App.tsx`                            | 1     | `isDisabled` 제거, 렌더링 순서 변경 (메뉴를 입력줄 아래로), UserInput과 SlashMenu 공존 |
| `src/cli/components/UserInput.tsx`           | 1     | slash menu 보일 때 ↑↓Tab 키 무시 로직                                                  |
| `src/cli/components/SlashCommandMenu.tsx`    | 1     | 스크롤 뷰포트 (MAX_VISIBLE), `↑↓ more` 표시, 포인터 이동                               |
| `src/commands/init.ts`                       | 1     | `initCommand: SlashCommand` export 추가                                                |
| `src/index.ts`                               | 1     | commands 배열에 `initCommand` 추가                                                     |
| `src/llm/client.ts`                          | 2     | 429 retry 로직 추가                                                                    |
| `src/core/agent-loop.ts`                     | 2     | retry config 전달, 타임아웃 설정 확장                                                  |
| `test/e2e/project-6-*.test.ts`               | 2     | 프롬프트 개선, 타임아웃 증가                                                           |
| `test/unit/cli/components/UserInput.test.ts` | 1     | slash menu 공존 테스트 추가                                                            |

## 부록 B: 핵심 코드 참조

### B.1 문제의 코드 — App.tsx:476-480

```tsx
<UserInput
  onSubmit={handleSubmit}
  onChange={setInputValue}
  isDisabled={slashMenuVisible} // ← 이 줄이 모든 문제의 시작
/>
```

### B.2 문제의 조건 — App.tsx:111

```typescript
const slashMenuVisible =
  !isProcessing && !pendingPermission && inputValue.startsWith("/") && !inputValue.includes(" ");
```

`/` 입력 → `slashMenuVisible = true` → `isDisabled = true` → 키보드 freeze → 영원히 true 유지

### B.3 Ink 5.x useInput 키 매핑 — parse-keypress.js

```
\r (0x0D) → key.name = 'return'  → key.return = true   ✓ submit 정상
\n (0x0A) → key.name = 'enter'   → key.return = false  ✗ submit 실패 (수정 완료)
```
