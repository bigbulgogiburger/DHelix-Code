# dbcode UI 개선 기획서 v3 — Claude Code 수준 UX 달성

> **작성일**: 2026-03-12
> **목표**: Claude Code의 세 가지 핵심 UX 패턴을 dbcode에 구현

---

## 목차

1. [Issue 1: @ Mention 자동완성 — 화살표 탐색 + 선택 후 공백](#issue-1-mention-자동완성)
2. [Issue 2: file: 접두사 제거](#issue-2-file-접두사-제거)
3. [Issue 3: Tool Call 출력 — Rich Display + 접기/펼치기](#issue-3-tool-call-rich-display)
4. [구현 우선순위](#구현-우선순위)
5. [참고 자료](#참고-자료)

---

## Issue 1: @ Mention 자동완성

### 현재 문제

| 증상                                                                | 원인 위치               |
| ------------------------------------------------------------------- | ----------------------- |
| `@` 입력 후 파일 목록이 뜨지만 **화살표 키를 누르면 목록이 사라짐** | `UserInput.tsx:283-307` |
| 선택 후 **공백이 추가되지 않아** 다음 텍스트와 붙음                 | `UserInput.tsx:246`     |
| Tab만 동작, 화살표 키 탐색 불가                                     | `UserInput.tsx:203-207` |

### 근본 원인 분석

**`src/cli/components/UserInput.tsx` 283-307행:**

```typescript
// Up arrow — navigate history
if (key.upArrow) {
  // isMentioning 여부를 전혀 체크하지 않음!
  if (savedInputRef.current === null) {
    savedInputRef.current = value;
  }
  const prev = navigateUp(); // ← 히스토리 탐색 실행
  if (prev !== undefined) {
    updateValue(prev, prev.length); // ← value 변경 → useEffect 트리거
  }
  return;
}
```

**문제 체인:**

1. 화살표 ↓ 누름 → `navigateDown()` 호출 → `updateValue()` 실행
2. `value`와 `cursorOffset` 변경 → useEffect(77-103행) 재실행
3. `extractMentionToken()` 호출 → 새 value에서 `@` 토큰 매칭 실패
4. `isMentioning = false` → 드롭다운 사라짐

### Claude Code의 동작 방식

| 기능           | Claude Code               | dbcode (현재)             |
| -------------- | ------------------------- | ------------------------- |
| `@` 트리거     | 파일/디렉토리 목록 표시   | ✅ 동일                   |
| 화살표 키 탐색 | ↑↓로 목록 탐색            | ❌ 히스토리 탐색으로 빠짐 |
| Tab 탐색       | 순환 탐색                 | ✅ 동작                   |
| Enter 선택     | 파일 삽입 + **공백 추가** | ❌ 공백 없음              |
| Esc 취소       | 드롭다운 닫기             | ✅ 동작                   |
| 디렉토리 선택  | 해당 디렉토리로 drill-in  | ❌ 미구현                 |

> **참고**: Claude Code도 `@` autocomplete에서 여러 버그를 겪었음 ([#4826](https://github.com/anthropics/claude-code/issues/4826), [#23287](https://github.com/anthropics/claude-code/issues/23287), [#25353](https://github.com/anthropics/claude-code/issues/25353))

### 구현 계획

#### Phase 1: 화살표 키가 mention 목록을 탐색하도록 수정

**파일**: `src/cli/components/UserInput.tsx`

**변경 1 — 화살표 키 핸들러에 mention 분기 추가 (283-307행):**

```typescript
// Up arrow
if (key.upArrow) {
  // ★ mention 활성 시 → 목록 위로 탐색
  if (isMentioning && mentionSuggestions.length > 0) {
    setMentionIndex((prev) => (prev <= 0 ? mentionSuggestions.length - 1 : prev - 1));
    return;
  }
  // 기존 히스토리 탐색
  if (savedInputRef.current === null) {
    savedInputRef.current = value;
  }
  const prev = navigateUp();
  if (prev !== undefined) {
    updateValue(prev, prev.length);
  }
  return;
}

// Down arrow
if (key.downArrow) {
  // ★ mention 활성 시 → 목록 아래로 탐색
  if (isMentioning && mentionSuggestions.length > 0) {
    setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
    return;
  }
  // 기존 히스토리 탐색
  const next = navigateDown();
  // ...
}
```

**변경 2 — 선택 후 공백 추가 (246행):**

```typescript
// 기존
const insertion = `@file:${selected}`;

// 수정 — 공백 추가
const insertion = `@${selected} `; // file: 접두사 제거 + 공백 추가
```

#### Phase 2: 도움말 텍스트 업데이트

```typescript
// 기존 (458행)
<Text color="gray" dimColor>Tab: cycle | Enter/Space: select | Esc: cancel</Text>

// 수정
<Text color="gray" dimColor>↑↓: navigate | Tab: cycle | Enter: select | Esc: cancel</Text>
```

#### Phase 3: 디렉토리 drill-in (선택적)

선택한 항목이 디렉토리인 경우 → 선택 시 해당 디렉토리 내부 파일 목록으로 전환:

```typescript
if (selected.endsWith("/")) {
  // 디렉토리 drill-in: 입력을 @dir/로 업데이트, 하위 파일 목록 재로드
  const insertion = `@${selected}`;
  updateValue(before + insertion, before.length + insertion.length);
  // mentionSuggestions가 useEffect에 의해 자동 재계산됨
  return;
}
```

### 테스트 계획

```typescript
// test/unit/cli/components/UserInput.test.ts 에 추가

describe("@ mention arrow key navigation", () => {
  it("should navigate down in mention list on arrow down", () => { ... });
  it("should navigate up in mention list on arrow up", () => { ... });
  it("should wrap around from last to first", () => { ... });
  it("should NOT navigate history when mention list is active", () => { ... });
  it("should add space after mention selection", () => { ... });
});
```

---

## Issue 2: file: 접두사 제거

### 현재 문제

| 위치                                | 코드                | 영향                                   |
| ----------------------------------- | ------------------- | -------------------------------------- |
| `UserInput.tsx:454` (드롭다운 표시) | `@file:${item}`     | 사용자가 보는 제안 목록에 `file:` 표시 |
| `UserInput.tsx:246` (삽입)          | `@file:${selected}` | 입력창에 `@file:path` 형태로 삽입      |

### Claude Code의 동작

Claude Code에서는 `@` 뒤에 바로 파일 경로가 표시됨:

```
@ src/index.ts
@ src/cli/App.tsx
@ package.json
```

MCP 리소스만 접두사를 사용: `@github:issue://123`

### 구현 계획

**파일**: `src/cli/components/UserInput.tsx`

**변경 1 — 드롭다운 표시에서 접두사 제거 (454행):**

```typescript
// 기존
{
  isMentioning ? `@file:${item}` : item;
}

// 수정 — 깔끔하게 파일 경로만 표시
{
  isMentioning ? `@${item}` : item;
}
```

**변경 2 — 삽입 시에도 접두사 제거 (246행):**

```typescript
// 기존
const insertion = `@file:${selected}`;

// 수정
const insertion = `@${selected} `; // file: 제거 + 공백 추가 (Issue 1과 병합)
```

**변경 3 — mention parser가 두 형식 모두 인식하는지 확인:**

`src/mentions/parser.ts` — 이미 `@file:path`와 `@path` 둘 다 파싱 가능:

```typescript
// parser.ts line 107
value = raw.startsWith("@file:") ? raw.slice(6) : raw.slice(1);
```

→ 하위 호환성 유지됨. `@file:` 형식으로 직접 타이핑하면 여전히 동작.

### 테스트 계획

```typescript
describe("@ mention display format", () => {
  it("should display suggestions without file: prefix", () => { ... });
  it("should insert mention without file: prefix", () => { ... });
  it("should still parse @file:path format for backward compatibility", () => { ... });
});
```

---

## Issue 3: Tool Call Rich Display + 접기/펼치기

### 현재 문제

**dbcode 현재 출력:**

```
  ⠋ Reading
  Read (16ms)
   ⎿  72 lines
```

**Claude Code 출력:**

```
● Read(src/components/Header.tsx)
  ⎿  Read 72 lines (ctrl+o to expand)
```

**핵심 차이점:**

| 항목               | Claude Code                           | dbcode (현재)        |
| ------------------ | ------------------------------------- | -------------------- |
| 도구 이름          | `Read(file_path)` — 인자 포함         | `Read` — 인자 없음   |
| 실행 중            | `⠋ Reading src/file.tsx`              | `⠋ Reading`          |
| 완료 후 헤더       | `Read(src/file.tsx)`                  | `Read (16ms)`        |
| 결과 서브텍스트    | 파일명 + 줄 수 + `(ctrl+o to expand)` | 줄 수 또는 시간만    |
| Bash 출력          | 첫 3줄 미리보기 + `+N lines`          | 없음                 |
| 접기/펼치기        | ctrl+o로 토글                         | 미구현               |
| Edit diff 미리보기 | 컬러 diff (+/- 줄)                    | 미구현 (코드는 존재) |

### 근본 원인 분석

**Critical Bug**: `ActivityFeed.tsx:140` 에서 `metadata`를 전달하지 않음

```tsx
// ActivityFeed.tsx — ❌ metadata 누락
<ToolCallBlock
  name={String(entry.data.name ?? "")}
  status={status}
  args={entry.data.args as Record<string, unknown> | undefined}
  output={typeof entry.data.output === "string" ? entry.data.output : undefined}
  isExpanded={isExpanded}
  startTime={startTime}
  // ❌ metadata 프롭 없음!
/>
```

반면 `TurnBlock.tsx:92-104`는 metadata를 올바르게 전달:

```tsx
// TurnBlock.tsx — ✅ metadata 전달
const metadata =
  entry.type === "tool-start"
    ? findMetadata(allEntries, toolId)
    : (entry.data.metadata as Readonly<Record<string, unknown>> | undefined);

<ToolCallBlock
  metadata={metadata} // ✅ 올바르게 전달
/>;
```

**결과**: ActivityFeed가 메인 디스플레이(Progressive Static)인데, metadata가 빠져서:

- 파일 경로 표시 불가
- Edit diff 미리보기 불가
- Bash 출력 미리보기 불가
- Grep/Glob 매치 수 표시 불가

### 이미 구현된 (하지만 사용 안 되는) 인프라

`tool-display.ts`에 이미 풍부한 포맷팅 로직이 존재:

| 도구          | 표시 가능 정보 (metadata 기반)                                         |
| ------------- | ---------------------------------------------------------------------- |
| `file_read`   | 파일 경로, 총 줄 수, 범위(readFrom-readTo), 이미지 크기, PDF 페이지 수 |
| `file_write`  | 파일 경로, 줄 수, 바이트 크기                                          |
| `file_edit`   | 파일 경로, 줄 변경(+3 -1), ±3줄 컨텍스트 diff                          |
| `bash_exec`   | 전체 명령어, 종료 코드, 첫 5줄 미리보기                                |
| `glob_search` | 패턴, 파일 수                                                          |
| `grep_search` | 패턴, 검색 경로, 매치 수                                               |
| `list_dir`    | 디렉토리 경로, 항목 수                                                 |

`ToolCallBlock.tsx`에 `DiffPreview` 컴포넌트(52-91행)도 이미 구현되어 있음.

### 구현 계획

#### Phase 1: metadata 전달 버그 수정 (Critical — 즉시 효과)

**파일**: `src/cli/components/ActivityFeed.tsx`

```tsx
// 기존 (line 140)
<ToolCallBlock
  name={String(entry.data.name ?? "")}
  status={status}
  args={entry.data.args as Record<string, unknown> | undefined}
  output={typeof entry.data.output === "string" ? entry.data.output : undefined}
  isExpanded={isExpanded}
  startTime={startTime}
/>

// 수정 — metadata 전달 추가
<ToolCallBlock
  name={String(entry.data.name ?? "")}
  status={status}
  args={entry.data.args as Record<string, unknown> | undefined}
  output={typeof entry.data.output === "string" ? entry.data.output : undefined}
  metadata={entry.data.metadata as Readonly<Record<string, unknown>> | undefined}
  isExpanded={isExpanded}
  startTime={startTime}
/>
```

> **이것만으로도** `tool-display.ts`의 기존 포맷팅 로직이 작동하여 파일 경로, 줄 수, diff 미리보기 등이 표시됨.

#### Phase 2: 헤더 형식 개선 — Claude Code 스타일

**목표 출력 형식:**

```
⠋ Reading src/components/Header.tsx          ← 실행 중
Read src/components/Header.tsx (72 lines)     ← 완료
 ⎿  72 lines from line 1 to 72

⠋ Bash: git status                            ← 실행 중
Bash (exit 0, 15ms)                            ← 완료
 ⎿  On branch main
    Your branch is up to date.
    … +5 lines (ctrl+o to expand)

Edit src/index.ts (+3 -1) (45ms)              ← 완료
 ⎿  @@ line 42 @@
    + const newLine = "added";
    - const oldLine = "removed";
```

**파일**: `src/cli/renderer/tool-display.ts`

현재 `getToolHeaderInfo()`가 반환하는 형식을 개선:

```typescript
// 실행 중 상태 — 파일 경로 포함
function getRunningLabel(name: string, args?: Record<string, unknown>): string {
  const verb = TOOL_VERBS[name]?.running ?? "Processing";
  const arg = extractHeaderArg(name, args);
  return arg ? `${verb} ${arg}` : verb;
  // 결과: "Reading src/index.ts", "Executing git status"
}

// 완료 상태 — 인자 + 결과 요약
function getCompletedHeader(name: string, args, metadata, duration): string {
  const verb = TOOL_VERBS[name]?.completed ?? "Done";
  const arg = extractHeaderArg(name, args, metadata);
  const detail = extractDetail(name, metadata);
  const dur = duration ? ` (${duration}ms)` : "";
  return `${verb} ${arg}${detail ? ` ${detail}` : ""}${dur}`;
  // 결과: "Read src/index.ts (72 lines) (16ms)"
}
```

#### Phase 3: 출력 접기/펼치기 구현

**Claude Code 스타일:**

```
Bash (exit 0, 85ms)
 ⎿  line 1 of output
    line 2 of output
    line 3 of output
    … +25 lines (ctrl+o to expand)
```

> **참고**: Claude Code에서도 ctrl+o 펼치기는 [오랫동안 버그였음](https://github.com/anthropics/claude-code/issues/8214). 최근 버전에서 "(ctrl+o to expand)" 텍스트 자체가 제거됨. 하지만 기본 3줄 미리보기 패턴은 여전히 유용.

**구현:**

**3-a. ToolCallBlock에 접기/펼치기 상태 추가:**

```tsx
// src/cli/components/ToolCallBlock.tsx

interface ToolCallBlockProps {
  // ... 기존 props
  maxPreviewLines?: number;  // 기본값: 3
}

function ToolCallBlock({ output, maxPreviewLines = 3, ...props }) {
  const lines = output?.split("\n") ?? [];
  const isLong = lines.length > maxPreviewLines;
  const previewLines = isLong ? lines.slice(0, maxPreviewLines) : lines;
  const hiddenCount = lines.length - maxPreviewLines;

  return (
    <Box flexDirection="column">
      <Header ... />
      <Box marginLeft={1}>
        <Text dimColor> ⎿  </Text>
        <Box flexDirection="column">
          {previewLines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          {isLong && (
            <Text dimColor>
              … +{hiddenCount} lines (ctrl+o to expand)
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
```

**3-b. Verbose 모드(ctrl+o)에서 전체 출력 표시:**

기존 `isExpanded` prop을 활용 — verbose 모드(ctrl+o)가 토글되면 모든 도구 출력을 펼침:

```typescript
// maxPreviewLines를 verbose 모드에서 Infinity로 설정
const maxPreview = isExpanded ? Infinity : 3;
```

**3-c. 도구별 미리보기 전략:**

| 도구          | 기본 미리보기            | 접기 대상        |
| ------------- | ------------------------ | ---------------- |
| `bash_exec`   | 첫 3줄 stdout            | 나머지 stdout    |
| `file_read`   | "(줄 수) lines" 텍스트만 | 파일 내용        |
| `file_edit`   | diff 미리보기 (±3줄)     | 없음 (항상 표시) |
| `grep_search` | 첫 3개 매치              | 나머지 매치      |
| `glob_search` | 첫 5개 파일              | 나머지 파일      |
| `web_fetch`   | 첫 3줄                   | 나머지           |

#### Phase 4: Spinner 진행 중 파일 경로 표시

**현재**: `⠋ Reading`
**목표**: `⠋ Reading src/components/Header.tsx`

**파일**: `src/cli/components/ToolCallBlock.tsx` 또는 `ActivityFeed.tsx`

실행 중 상태에서 `args`에서 파일 경로를 추출하여 spinner 옆에 표시:

```typescript
function getSpinnerLabel(name: string, args?: Record<string, unknown>): string {
  switch (name) {
    case "file_read":
    case "file_write":
    case "file_edit":
      return `${getRunningVerb(name)} ${args?.file_path ?? args?.path ?? ""}`;
    case "bash_exec":
      return `Running ${truncate(String(args?.command ?? ""), 60)}`;
    case "grep_search":
      return `Searching ${args?.pattern ?? ""}`;
    case "glob_search":
      return `Finding ${args?.pattern ?? ""}`;
    case "list_dir":
      return `Listing ${args?.path ?? "."}`;
    default:
      return getRunningVerb(name);
  }
}
```

---

## 구현 우선순위

| 순서  | 작업                       | 파일                | 난이도   | 영향도       | 비고                      |
| ----- | -------------------------- | ------------------- | -------- | ------------ | ------------------------- |
| **1** | ActivityFeed metadata 전달 | `ActivityFeed.tsx`  | 🟢 1줄   | 🔴 매우 높음 | 기존 인프라 즉시 활성화   |
| **2** | `file:` 접두사 제거        | `UserInput.tsx`     | 🟢 2줄   | 🟡 중간      | 사용성 직접 개선          |
| **3** | 화살표 키 mention 탐색     | `UserInput.tsx`     | 🟡 ~20줄 | 🔴 매우 높음 | 핵심 UX 버그 수정         |
| **4** | 선택 후 공백 추가          | `UserInput.tsx`     | 🟢 1줄   | 🟡 중간      | Issue 2와 동시 수정       |
| **5** | 도구 헤더 형식 개선        | `tool-display.ts`   | 🟡 ~30줄 | 🔴 높음      | 정보 밀도 향상            |
| **6** | 출력 접기/펼치기           | `ToolCallBlock.tsx` | 🟠 ~50줄 | 🟡 중간      | Claude Code도 버그 있었음 |
| **7** | Spinner 파일 경로          | `ToolCallBlock.tsx` | 🟡 ~15줄 | 🟡 중간      | 작업 가시성 향상          |

### 추정 총 작업량

- **Phase 1** (Items 1-4): ~2시간 — 버그 수정 + 즉각적 UX 개선
- **Phase 2** (Items 5-7): ~4시간 — Rich display 완성

---

## 참고 자료

### Claude Code 공식

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code Changelog](https://code.claude.com/docs/en/changelog)

### Claude Code 이슈 (벤치마크)

- [#8214 — ctrl+o expand doesn't work for Read](https://github.com/anthropics/claude-code/issues/8214) — Claude Code도 expand 기능에 버그가 있었고, 결국 "(ctrl+o to expand)" 힌트 텍스트를 제거
- [#26954 — Bash output truncated, ctrl+o doesn't expand](https://github.com/anthropics/claude-code/issues/26954) — 첫 3줄 표시 + "+N lines" 패턴 확인
- [#4826 — @ autocomplete broken](https://github.com/anthropics/claude-code/issues/4826) — `@` 자동완성 회귀 버그
- [#23287 — @ suggestions disappear in subdirectories](https://github.com/anthropics/claude-code/issues/23287) — 서브디렉토리 탐색 시 제안 사라짐
- [#25353 — Enter submits instead of accepting suggestion](https://github.com/anthropics/claude-code/issues/25353) — Enter 키 우선순위 문제

### 아키텍처 참고

- [Claude Code Internals Part 11: Terminal UI](https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016) — Ink/React 기반 TUI 아키텍처 분석
- [Claude Code Tool System Explained](https://callsphere.tech/blog/claude-code-tool-system-explained) — 도구 시스템 설명

### dbcode 내부 파일 참조

| 파일                                   | 역할                                        |
| -------------------------------------- | ------------------------------------------- |
| `src/cli/components/UserInput.tsx`     | @ mention 입력, 자동완성, 키보드 핸들링     |
| `src/cli/components/ToolCallBlock.tsx` | 개별 도구 호출 렌더링 (DiffPreview 포함)    |
| `src/cli/components/ActivityFeed.tsx`  | Progressive Static 플러싱 (메인 디스플레이) |
| `src/cli/renderer/tool-display.ts`     | 도구별 표시 설정 (verb, header, subtext 등) |
| `src/mentions/parser.ts`               | `@file:path` 및 `@path` 파싱                |
| `src/mentions/resolver.ts`             | 파일/URL 멘션 콘텐츠 로딩                   |
| `src/core/activity.ts`                 | ActivityCollector — turn/entry 추적         |
