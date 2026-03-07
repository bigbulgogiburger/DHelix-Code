# dbcode 개발 계획서

> **작성일**: 2026-03-07
> **작성자**: AI Agent Architecture Review
> **대상**: dbcode v0.1.0 → v1.0.0 로드맵
> **현재 상태**: ~11,710 LOC / TypeScript / Ink 5.x / 7 P0 Tools / 26 Slash Commands

---

## 목차

1. [현황 진단](#1-현황-진단)
2. [Critical Issues (사용자 보고)](#2-critical-issues-사용자-보고)
3. [DBCODE.md 프로젝트 인스트럭션 시스템](#issue-6-dbcodemd-프로젝트-인스트럭션-시스템-고도화)
4. [Agent Activity Feed — 에이전트 작업 내역 UI](#3-agent-activity-feed--에이전트-작업-내역-ui)
5. [Gap Analysis: Claude Code 대비 부족한 부분](#4-gap-analysis-claude-code-대비-부족한-부분)
5. [Phase별 개발 계획](#5-phase별-개발-계획)
6. [상세 구현 명세](#6-상세-구현-명세)
7. [아키텍처 변경 사항](#7-아키텍처-변경-사항)
8. [테스트 전략](#8-테스트-전략)
9. [우선순위 매트릭스](#9-우선순위-매트릭스)

---

## 1. 현황 진단

### 잘 구현된 부분

| 영역 | 상태 | 비고 |
|------|------|------|
| Agent Loop (ReAct) | 완성 | 50 iteration 제한, 에러 복구, 스트리밍 |
| LLM Client | 완성 | OpenAI 호환, 듀얼 tool-call 전략 |
| Tool System | 완성 | 7 P0 tools, Registry, Executor, Zod validation |
| Session 관리 | 완성 | JSONL 형식, resume, fork 지원 |
| Context 관리 | 완성 | 토큰 예산, 95% 자동 compaction |
| Config 시스템 | 완성 | 5-level 계층적 설정, Zod 스키마 |
| Slash Commands | 골격 완성 | 26개 커맨드 등록, registry 존재 |

### 문제가 있는 부분

| 영역 | 상태 | 심각도 |
|------|------|--------|
| 텍스트 입력 (커서 이동) | **미구현** | CRITICAL |
| Permission UI | **Y/N 텍스트 입력** | HIGH |
| Slash Command 자동완성 | **메뉴가 안 뜸** | HIGH |
| 로고 표시 | **사라짐** | MEDIUM |
| 폴더 생성 (mkdir) | **전용 도구 없음** | MEDIUM |
| Git 통합 | **bash_exec 의존** | LOW (동작은 함) |

---

## 2. Critical Issues (사용자 보고)

### Issue #1: 폴더 생성 불가 & Git 명령 가능 여부

**현재 상태:**
- `file_write` 도구에서 `mkdir(dirname(filePath), { recursive: true })`로 부모 디렉토리 자동 생성은 되지만, **빈 폴더만 생성하는 전용 도구가 없음**
- Git 명령은 `bash_exec`를 통해 **이미 가능**하지만, 사용자에게 이 사실이 명확하지 않음

**해결 방안:**
```
A) mkdir 전용 도구 추가 (src/tools/definitions/mkdir.ts)
B) Git 전용 도구 추가 또는 시스템 프롬프트에 git 사용법 명시
C) /git slash command 추가 (status, diff, commit, push 등 서브커맨드)
```

**구현 우선순위:** P1

---

### Issue #2: Permission UI 개선

**현재 상태 (`src/cli/components/PermissionPrompt.tsx`):**
```
┌─────────────────────────────┐
│ Permission required         │
│ Tool: bash_exec             │
│ Arguments: {"command":...}  │
│ Allow? [y]es / [n]o / [a]lways │  ← 키보드 타이핑 필요
└─────────────────────────────┘
```

**목표 (Claude Code 스타일):**
```
┌─────────────────────────────────────────────┐
│  bash_exec                                  │
│  command: git status                        │
│                                             │
│  ▸ Allow once    Allow session    Deny      │  ← 방향키로 선택
└─────────────────────────────────────────────┘
```

**해결 방안:**
- `useInput`의 `key.leftArrow` / `key.rightArrow`로 탭 네비게이션 구현
- 선택된 항목 하이라이트 (bold + underline + 색상 변경)
- Enter로 확정
- 선택지: `Allow once` | `Allow for session` | `Deny`

**구현 우선순위:** P0 (UX 핵심)

---

### Issue #3: Slash Command 자동완성 메뉴가 안 뜸

**현재 상태 (`src/cli/components/SlashCommandMenu.tsx`):**
- `SlashCommandMenu` 컴포넌트는 존재
- `getMatchingCommands()`로 필터링 로직 있음
- **문제:** `App.tsx`에서 메뉴 렌더링 조건이 충족되지 않거나, 입력 상태와 메뉴 표시 간 연동이 끊어져 있을 가능성

**해결 방안:**
1. `UserInput` → `App.tsx`로 현재 입력값 실시간 전달 (onChange 콜백)
2. `/`로 시작하면 `SlashCommandMenu` 렌더링
3. 위/아래 방향키로 항목 탐색
4. Tab 또는 Enter로 선택 → 입력란에 자동 완성
5. Escape로 메뉴 닫기
6. 스페이스 입력 시 메뉴 자동 닫기

**구현 우선순위:** P0

---

### Issue #4: 텍스트 입력 시 커서 이동 불가

**현재 상태 (`src/cli/components/UserInput.tsx`, 61줄):**
- `useInput`으로 키 입력 캡처
- **커서 위치(cursorOffset) 상태가 없음** — 항상 문자열 끝에 append만 됨
- 방향키 핸들러가 없어서 좌/우 이동 불가

**해결 방안 (두 가지 접근):**

**Option A: `ink-text-input` 또는 `@inkjs/ui TextInput` 채택**
- 장점: 커서 이동, 제거, 삽입 등 모든 기본 기능 내장
- 단점: 커스텀 기능(멀티라인, vim 모드 등) 추가 어려움

**Option B: 커스텀 구현 (권장)**
- `cursorOffset` 상태 추가
- 방향키 핸들러 구현
- `Ctrl+A` (Home), `Ctrl+E` (End), `Alt+B/F` (단어 이동) 지원
- 향후 멀티라인, 히스토리 탐색, vim 모드 확장 가능

```typescript
// 핵심 상태
const [value, setValue] = useState('')
const [cursorOffset, setCursorOffset] = useState(0)

// 방향키 핸들링
if (key.leftArrow) setCursorOffset(prev => Math.max(0, prev - 1))
if (key.rightArrow) setCursorOffset(prev => Math.min(value.length, prev + 1))

// 문자 삽입 (커서 위치에)
const newValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset)
setValue(newValue)
setCursorOffset(prev => prev + input.length)
```

**구현 우선순위:** P0 (가장 기본적인 UX)

---

### Issue #5: 로고 사라짐

**현재 상태:**
- `src/cli/components/Logo.tsx`에 Doge 픽셀아트 로고가 구현되어 있음
- `App.tsx`에서 `<Logo />` 렌더링 조건 확인 필요
- 가능한 원인:
  1. 조건부 렌더링에서 로고가 제외됨
  2. 터미널 크기(columns/rows) 감지 실패
  3. 스트리밍 시작 시 로고가 clear됨
  4. headless 모드에서 로고 비활성화가 일반 모드에 영향

**해결 방안:**
1. `App.tsx`에서 로고 렌더링 로직 디버깅
2. 앱 시작 시 항상 로고 표시되도록 보장
3. 로고 아래에 버전 번호 + 모델명 표시
4. `--no-logo` 플래그로 선택적 비활성화

**구현 우선순위:** P1

---

### Issue #6: DBCODE.md 프로젝트 인스트럭션 시스템 고도화

> `dbcode init` → `DBCODE.md` 생성 → 대화 시 자동 참조 — Claude Code의 CLAUDE.md처럼.

#### 6-1. Claude Code의 CLAUDE.md 시스템 (레퍼런스)

Claude Code는 프로젝트 인스트럭션을 **계층적으로 발견, 로드, 주입**하는 정교한 시스템을 갖고 있다:

**파일 발견 계층 (위에서 아래로 로드, 아래가 우선):**

```
1. 관리 정책 (OS-level, MDM)
   ├─ macOS: /Library/Application Support/ClaudeCode/CLAUDE.md
   ├─ Linux: /etc/claude-code/CLAUDE.md
   └─ Windows: C:\Program Files\ClaudeCode\CLAUDE.md

2. 사용자 글로벌
   ├─ ~/.claude/CLAUDE.md          ← 모든 프로젝트에 적용
   └─ ~/.claude/rules/*.md         ← 토픽별 규칙 (글로벌)

3. 상위 디렉토리 탐색 (CWD → / 까지 상향 순회)
   └─ 경로 상의 모든 CLAUDE.md

4. 프로젝트 루트
   ├─ ./CLAUDE.md                  ← 팀 공유 (git 커밋)
   ├─ ./.claude/CLAUDE.md          ← 대안 위치
   └─ ./.claude/rules/*.md         ← 토픽별 규칙 (프로젝트)

5. 로컬 개인
   └─ ./CLAUDE.local.md            ← 개인용 (.gitignore)
```

**핵심 기능들:**

| 기능 | 설명 |
|------|------|
| **@import 지시자** | `@README.md`, `@docs/guide.md`로 다른 파일 참조 (최대 5단계 재귀) |
| **경로 조건부 규칙** | `.claude/rules/*.md`에 YAML frontmatter로 glob 패턴 지정 → 해당 파일 작업 시만 로드 |
| **지연 로딩** | 하위 디렉토리 CLAUDE.md는 해당 디렉토리 파일 접근 시에만 로드 |
| **Compaction 생존** | `/compact` 후 CLAUDE.md를 디스크에서 **다시 읽어** 재주입 (절대 소실 안 됨) |
| **병합 방식** | 모든 파일이 **연결(concatenate)** — 덮어쓰기 아님 |
| **크기 권장** | 파일당 200줄 이하, 전체 ~5,000 토큰 이하 |
| **`/init` 커맨드** | 코드베이스를 분석하여 맞춤형 CLAUDE.md 자동 생성 |
| **InstructionsLoaded 훅** | 어떤 파일이 왜 로드되었는지 디버깅 가능 |

**CLAUDE.md vs CLAUDE.local.md:**

| | CLAUDE.md | CLAUDE.local.md |
|---|-----------|-----------------|
| 용도 | 팀 공유 규칙 | 개인 설정 |
| Git | 커밋 | .gitignore |
| 예시 | 코딩 표준, 빌드 명령 | 개인 sandbox URL, 테스트 데이터 |

---

#### 6-2. dbcode 현재 구현 상태 (이미 상당 부분 구현됨!)

분석 결과, dbcode에는 **놀랍게도 이미 정교한 인스트럭션 시스템이 존재**한다:

| 컴포넌트 | 파일 | 상태 |
|----------|------|------|
| DBCODE.md 로딩 | `src/instructions/loader.ts` | **완성** — 프로젝트 루트 + `.dbcode/` 탐색 |
| @import 지시자 | `src/instructions/parser.ts` | **완성** — 재귀 해석, 순환 참조 방지 (10단계) |
| 경로 조건부 규칙 | `src/instructions/path-matcher.ts` | **완성** — `.dbcode/rules/*.md` + glob 매칭 |
| 시스템 프롬프트 주입 | `src/core/system-prompt-builder.ts` | **완성** — priority 70으로 주입 |
| Interactive 모드 연동 | `src/cli/App.tsx` | **완성** — useEffect로 로드 |
| Headless 모드 연동 | `src/cli/headless.ts` | **완성** — 에이전트 루프 전 로드 |
| `dbcode init` | `src/commands/init.ts` | **기본** — DBCODE.md + settings.json 생성 |
| 훅 시스템 | `src/hooks/` | **완성** — 17개 이벤트, `InstructionsLoaded` 포함 |

**실제 로딩 흐름 (이미 구현됨):**

```
dbcode 시작
  → loadInstructions(workingDirectory)
    → DBCODE.md 또는 .dbcode/DBCODE.md 찾기
    → @import 지시자 재귀 해석
    → .dbcode/rules/*.md 로드 + glob 필터링
    → { projectInstructions, pathRules, combined } 반환
  → buildSystemPrompt({ projectInstructions: combined })
    → 6개 섹션 조합 (identity, tasks, environment, tools, conventions, instructions)
    → 우선순위 정렬 → "---" 구분자로 결합
  → LLM에 시스템 프롬프트로 전달
```

---

#### 6-3. Claude Code 대비 Gap 분석

| 기능 | Claude Code | dbcode | Gap |
|------|-------------|--------|-----|
| 프로젝트 루트 DBCODE.md | O | O | - |
| `.dbcode/DBCODE.md` | O | O | - |
| @import 지시자 | O (5단계) | O (10단계) | - (dbcode가 더 관대) |
| 경로 조건부 규칙 | O | O | - |
| 시스템 프롬프트 주입 | O | O | - |
| `InstructionsLoaded` 훅 | O | O | - |
| **사용자 글로벌** `~/.dbcode/DBCODE.md` | O | **X** | **HIGH** |
| **상위 디렉토리 상향 탐색** | O (CWD→/) | **X** | MEDIUM |
| **DBCODE.local.md** (개인용, gitignore) | O | **X** | **HIGH** |
| **Compaction 시 재로딩** | O | **X** | **HIGH** |
| **`/init` 코드베이스 분석** | O (AI가 분석) | **X** (템플릿만) | **HIGH** |
| 하위 디렉토리 지연 로딩 | O | X | MEDIUM |
| 관리 정책 (OS-level) | O | X | LOW (엔터프라이즈용) |
| `/memory` 디버그 커맨드 | O | X | MEDIUM |

---

#### 6-4. 구현 계획

##### P0: `/init` 코드베이스 분석 기능 (Phase 1)

**현재:** 고정 템플릿만 생성
**목표:** Claude Code처럼 **LLM이 프로젝트를 분석하여 맞춤형 DBCODE.md 생성**

```
dbcode init
  1. 프로젝트 파일 스캔:
     - package.json, Cargo.toml, go.mod, pyproject.toml, pom.xml 등 감지
     - README.md, .gitignore, tsconfig.json 등 읽기
     - src/ 디렉토리 구조 파악
  2. LLM에게 분석 요청:
     "이 프로젝트를 분석하고 DBCODE.md를 생성해줘:
      - 런타임, 프레임워크, 테스트/빌드 명령
      - 코딩 컨벤션 (감지된 패턴 기반)
      - 디렉토리 구조 요약"
  3. 생성된 DBCODE.md를 사용자에게 보여주고 확인 후 저장
  4. 기존 DBCODE.md가 있으면 개선 제안 (덮어쓰기 X)
```

**파일:** `src/commands/init.ts` 수정

##### P0: 사용자 글로벌 인스트럭션 (`~/.dbcode/DBCODE.md`)

**파일:** `src/instructions/loader.ts` 수정

```typescript
// 현재: 프로젝트 루트만 탐색
// 목표: 글로벌 + 프로젝트 로드 후 병합

async function loadInstructions(cwd: string): Promise<LoadedInstructions> {
  const layers: string[] = []

  // 1. 사용자 글로벌
  const globalMd = await tryRead(join(homedir(), '.dbcode', 'DBCODE.md'))
  if (globalMd) layers.push(globalMd)

  // 2. 사용자 글로벌 규칙
  const globalRules = await loadRules(join(homedir(), '.dbcode', 'rules'))
  if (globalRules) layers.push(globalRules)

  // 3. 프로젝트 DBCODE.md (기존 로직)
  const projectMd = await findProjectInstructions(cwd)
  if (projectMd) layers.push(await resolveImports(projectMd.content, projectMd.dir))

  // 4. 프로젝트 규칙 (기존 로직)
  const projectRules = await loadPathRules(cwd)
  if (projectRules) layers.push(projectRules)

  // 5. DBCODE.local.md (신규)
  const localMd = await tryRead(join(cwd, 'DBCODE.local.md'))
  if (localMd) layers.push(localMd)

  return {
    combined: layers.join('\n\n---\n\n'),
    // ...
  }
}
```

##### P1: DBCODE.local.md 지원

**목표:** 개인 설정용 파일 (git에 커밋하지 않음)

**변경 사항:**
1. `loader.ts`에서 `DBCODE.local.md` 로드 추가 (최고 우선순위)
2. `dbcode init`에서 `.gitignore`에 `DBCODE.local.md` 자동 추가
3. 템플릿:
```markdown
# DBCODE.local.md — Personal Settings (not committed to git)

# Add your personal preferences here:
# - Custom test data paths
# - Personal workflow preferences
# - Local environment specifics
```

##### P1: Compaction 시 인스트럭션 재로딩

**현재 문제:** Context compaction 시 DBCODE.md 내용이 요약되어 정보 손실 가능

**해결:** `context-manager.ts`의 compaction 로직에서:

```typescript
async function compactContext(messages, config) {
  // 1. 디스크에서 DBCODE.md 다시 읽기
  const freshInstructions = await loadInstructions(config.workingDirectory)

  // 2. 시스템 프롬프트 재구성
  const systemPrompt = buildSystemPrompt({
    ...config,
    projectInstructions: freshInstructions.combined,
  })

  // 3. 대화 내역만 요약 (시스템 프롬프트는 fresh)
  const compacted = [
    { role: 'system', content: systemPrompt },
    ...summarizeMessages(messages.slice(1)),  // 시스템 제외 요약
    ...messages.slice(-5),                     // 최근 5턴 유지
  ]

  return compacted
}
```

##### P2: 상위 디렉토리 상향 탐색

```typescript
// CWD에서 / 까지 올라가며 DBCODE.md 수집
function findInstructionsUpward(cwd: string): string[] {
  const results: string[] = []
  let dir = cwd
  while (dir !== dirname(dir)) {  // 루트에 도달할 때까지
    const md = tryReadSync(join(dir, 'DBCODE.md'))
    if (md) results.unshift(md)   // 상위가 앞에 (낮은 우선순위)
    dir = dirname(dir)
  }
  return results
}
```

##### P2: `/memory` 디버그 커맨드

```
/memory
  Loaded instruction files:
  ├─ ~/.dbcode/DBCODE.md (global, 45 lines)
  ├─ ./DBCODE.md (project, 120 lines)
  ├─   └─ @imported: ./docs/conventions.md (28 lines)
  ├─ ./.dbcode/rules/auth.md (path: src/auth/**, 15 lines)
  └─ ./DBCODE.local.md (local, 8 lines)

  Total: 216 lines (~1,850 tokens, 1.4% of context)
```

---

#### 6-5. `dbcode init` 개선된 흐름 (최종 목표)

```
$ dbcode init

  Analyzing project structure...

  Detected:
  ├─ Runtime: Node.js 20+ (package.json)
  ├─ Language: TypeScript 5.8
  ├─ Framework: Ink 5.x (React for CLI)
  ├─ Build: tsup (ESM)
  ├─ Test: vitest
  ├─ Lint: eslint + prettier

  Generating DBCODE.md...

  Created:
  ├─ .dbcode/DBCODE.md (72 lines)
  ├─ .dbcode/settings.json
  └─ .dbcode/rules/ (empty, add rules here)

  Added to .gitignore:
  └─ DBCODE.local.md

  ✓ Project initialized. Edit .dbcode/DBCODE.md to customize.
```

**생성되는 DBCODE.md 예시 (AI가 프로젝트 분석 후 자동 생성):**

```markdown
# DBCODE.md — dbcode Project Instructions

## Project
- CLI AI coding assistant built with Node.js 20+ / TypeScript 5.8 / Ink 5.x
- ESM only, JSX runtime = ink

## Commands
- Build: `npm run build` (tsup)
- Test: `npm test` (vitest)
- Lint: `npm run lint` (eslint + prettier)
- Typecheck: `npm run typecheck`

## Architecture
- src/cli/ — Terminal UI (Ink/React components)
- src/core/ — Business logic (ZERO UI imports)
- src/llm/ — LLM client (OpenAI-compatible)
- src/tools/ — Tool system (7 P0 tools)

## Conventions
- Named exports only (no default exports)
- ESM imports with .js extension
- No circular dependencies
- All async — no sync fs operations
- No `any` type — use `unknown` + type guards

## Commit Style
- Conventional: feat(module), fix(module), test(module)
```

---

#### 6-6. 우선순위 요약

| # | 작업 | Phase | 우선순위 |
|---|------|-------|----------|
| 1 | `/init` AI 코드베이스 분석 | Phase 1 | **P0** |
| 2 | `~/.dbcode/DBCODE.md` 글로벌 인스트럭션 | Phase 1 | **P0** |
| 3 | Compaction 시 인스트럭션 재로딩 | Phase 1 | **P0** |
| 4 | `DBCODE.local.md` 지원 | Phase 1 | P1 |
| 5 | 상위 디렉토리 상향 탐색 | Phase 2 | P2 |
| 6 | `/memory` 디버그 커맨드 | Phase 2 | P2 |
| 7 | 하위 디렉토리 지연 로딩 | Phase 3 | P2 |

---

#### 6-7. 참고 자료

| 자료 | 내용 |
|------|------|
| [How Claude remembers your project](https://code.claude.com/docs/en/memory) | 공식 CLAUDE.md 문서 |
| [Using CLAUDE.MD files](https://claude.com/blog/using-claude-md-files) | Anthropic 블로그 |
| [CLAUDE.md Mastery Guide](https://claudefa.st/blog/guide/mechanics/claude-md-mastery) | 커뮤니티 심층 가이드 |
| [How to Write a Good CLAUDE.md](https://www.builder.io/blog/claude-md-guide) | Builder.io 가이드 |
| [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) | 공식 권장사항 |
| [Rules Directory Guide](https://claudefa.st/blog/guide/mechanics/rules-directory) | .claude/rules/ 상세 가이드 |

---

## 3. Agent Activity Feed — 에이전트 작업 내역 UI

> Claude Code에서 프롬프트를 입력하면 에이전트가 수행하는 모든 작업이 위에서 아래로 실시간 스크롤되며 표시된다.
> 이것이 "Agent Activity Feed"이다. dbcode에서 이를 구현하기 위한 완전한 명세.

### 3.1 Activity Feed란 무엇인가

Claude Code에서 사용자가 프롬프트를 보내면, 터미널에 다음이 **시간순으로 위에서 아래로 스크롤**되며 나타난다:

```
┌─────────────────────────────────────────────────────────────┐
│ > 사용자가 입력한 프롬프트                                      │
│                                                             │
│ ⠋ Thinking...                    ← 스피너 + 사유 표시기       │
│                                                             │
│ 스트리밍 텍스트가 한 글자씩 나타남...▌  ← 블록 커서 (생성 중)     │
│                                                             │
│ ⠋ Reading src/core/agent-loop.ts  ← 도구 실행 중 (현재시제)    │
│                                                             │
│ ✓ Read 3 files                    ← 도구 완료 (과거시제 요약)   │
│                                                             │
│ ⠋ Editing src/cli/App.tsx         ← 다음 도구 실행 중          │
│ ┌──────────────────────────────┐                             │
│ │ - const old = 'before'       │  ← 인라인 diff (빨간 배경)    │
│ │ + const new = 'after'        │  ← 인라인 diff (초록 배경)    │
│ └──────────────────────────────┘                             │
│ ✓ Edited src/cli/App.tsx                                     │
│                                                             │
│ ⠋ Running npm test              ← bash 실행 중               │
│ ✓ Ran npm test                  ← bash 완료                  │
│                                                             │
│ 최종 어시스턴트 응답 (마크다운 렌더링)...                        │
│                                                             │
│ ─────────────────────────────────────────────                │
│ [model: gpt-4o] [tokens: 12,456/128K ████░░ 9.7%] [3.2s]   │
└─────────────────────────────────────────────────────────────┘
```

**핵심 개념:** 완료된 메시지는 Ink의 `<Static>` 컴포넌트에 들어가 **다시 렌더링되지 않고** 위로 밀려 올라간다. 현재 활성 영역(스트리밍 텍스트 + 실행 중인 도구)만 동적으로 재렌더링된다.

---

### 3.2 Claude Code의 Activity Feed 구성 요소

#### A. 스피너 + Thinking 표시기

| 요소 | 설명 |
|------|------|
| 스피너 문자 | 브레일 패턴 `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` (80ms 간격 회전) |
| 스피너 라벨 | "Thinking...", "Analyzing...", 또는 커스텀 verb (설정 가능) |
| 시머 효과 | Extended Thinking 중 "Thinking..." 텍스트에 애니메이션 적용 |
| 색상 | 시안(cyan) |
| 고정 폭 | 브레일 문자는 고정 폭으로 애니메이션 시 레이아웃 떨림 방지 |

#### B. 스트리밍 텍스트

| 요소 | 설명 |
|------|------|
| 전달 방식 | SSE `content_block_delta` → `text_delta` 청크 단위 |
| 렌더링 | 버퍼링된 청크 단위 표시 (순수 문자 단위 아님) |
| 커서 | 생성 중일 때 끝에 회색 블록 커서 `▌` 표시 |
| 마크다운 | 스트리밍 중에는 raw 텍스트, **완료 후** 마크다운 렌더링으로 전환 |
| 코드 블록 | Tree-sitter 기반 구문 하이라이팅 (완료 후) |

#### C. Tool Call 표시 — 핵심 패턴

**실행 중 (현재시제 동사 + 현재 대상):**
```
⠋ Reading src/core/agent-loop.ts
⠋ Editing src/cli/App.tsx
⠋ Running npm test
⠋ Searching for "pattern"
⠋ Searching for *.ts
```

**완료 (과거시제 동사 + 개수 요약):**
```
✓ Read 3 files
✓ Edited src/cli/App.tsx
✓ Ran npm test
✓ Searched for "pattern"
✓ Found 12 files
```

**에러:**
```
✗ Failed to read /etc/shadow
```

**거부됨:**
```
! Denied: bash_exec (rm -rf /)
```

**도구별 표시 규칙:**

| 도구 | 실행 중 | 완료 | 비고 |
|------|---------|------|------|
| file_read | `Reading {path}` | `Read {N} files` | 복수 파일 시 개수 요약 |
| file_write | `Writing {path}` | `Wrote {path}` | |
| file_edit | `Editing {path}` | `Edited {path}` | + 인라인 diff 표시 |
| bash_exec | `Running {command}` | `Ran {command}` | 명령어 축약 (50자) |
| glob_search | `Searching for {pattern}` | `Found {N} files` | |
| grep_search | `Searching for "{pattern}"` | `Searched for "{pattern}"` | |
| ask_user | `Waiting for user input` | `Got user response` | |
| mkdir | `Creating {path}` | `Created {path}` | |

#### D. Diff 표시 (파일 편집 시)

```
┌──────────────────────────────────────────┐
│  src/cli/components/UserInput.tsx        │  ← 파일명 헤더
│ -  const [value, setValue] = useState('')│  ← 빨간/마룬 배경 (삭제)
│ +  const [value, setValue] = useState('')│  ← 초록 배경 (추가)
│ +  const [cursor, setCursor] = useState(0)│
└──────────────────────────────────────────┘
```

- **형식:** Unified diff (인라인, side-by-side 아님)
- **삭제 줄:** 어두운 빨간/마룬 배경 + `-` 접두사
- **추가 줄:** 어두운 초록 배경 + `+` 접두사
- **구문 하이라이팅:** diff 내부에서도 코드 하이라이팅 유지
- **컨텍스트 줄:** 변경 없는 주변 줄 2~3줄 표시 (회색)

#### E. 접기/펼치기 (Collapse/Expand)

- 도구 결과는 **기본적으로 접힌 한 줄 요약**으로 표시
- `✓ Read 3 files` — 개별 파일 목록은 보이지 않음
- `--verbose` 플래그 시 raw JSON 출력 (디버그용)
- Thinking 블록은 `Ctrl+O`로 토글 가능
- Context compaction 후 "Compacted chat" 카드가 접힌 상태로 표시

#### F. Sub-agent 표시

```
⠋ Agent (explore): Analyzing codebase structure
  ↳ Tool uses: 12 | Tokens: 8,234 | Duration: 4.2s

✓ Agent completed
  ↳ Tool uses: 23 | Tokens: 15,678 | Duration: 12.1s
```

#### G. Permission 프롬프트 (Activity Feed 내 인라인)

```
┌─ bash_exec ──────────────────────────────┐
│ command: rm -rf node_modules             │
│                                          │
│ ▸ Allow once   Allow session   Deny      │
└──────────────────────────────────────────┘
```

Activity feed 스크롤이 멈추고 사용자 응답을 기다림. 응답 후 feed 재개.

#### H. Status Bar (하단 고정)

```
[gpt-4o] [████████░░░░ 67%] [cost: $0.12] [streaming...]
```

| 요소 | 설명 |
|------|------|
| 모델명 | 파란색 |
| 토큰 사용량 바 | 0-60% 초록, 60-80% 노랑, 80%+ 빨강 |
| 비용 | 누적 API 비용 |
| 스트리밍 표시기 | 활성 시 "streaming..." |
| 소요 시간 | `showTurnDuration` 설정 시 표시 |

---

### 3.3 dbcode 현재 상태 vs. Claude Code Activity Feed

| 컴포넌트 | Claude Code | dbcode 현재 | Gap |
|----------|-------------|-------------|-----|
| `<Static>` 완료 메시지 | O (스크롤백) | O (`MessageList.tsx`) | - |
| 스트리밍 텍스트 + 커서 | O | O (`StreamingMessage.tsx`) | - |
| 스피너 | O (커스텀 verb) | O (`Spinner.tsx`, 고정 라벨) | MEDIUM |
| Tool Call 상태 아이콘 | O (✓/✗/!) | △ (`ToolCallBlock.tsx`, `...`/`+`/`x`/`!`) | **HIGH** |
| 현재시제→과거시제 전환 | O | X (이름만 표시) | **HIGH** |
| 도구 결과 개수 요약 | O ("Read 3 files") | X | **HIGH** |
| 인라인 Diff 표시 | O (빨강/초록 배경) | X | **CRITICAL** |
| Thinking/시머 표시 | O | X | MEDIUM |
| Sub-agent 진행 표시 | O | X | MEDIUM |
| 접기/펼치기 | O | △ (`isExpanded` prop 있음) | MEDIUM |
| Status Bar 비용 표시 | O | △ (토큰만, 비용 없음) | LOW |
| 이벤트 시스템 | O | O (`mitt` 기반) | - |

**핵심 Gap:** dbcode의 `ToolCallBlock.tsx`는 도구 이름과 상태 아이콘만 표시한다. Claude Code처럼 **현재 작업 대상(파일명, 명령어)을 실시간 표시**하고, **완료 시 과거시제 요약으로 전환**하는 패턴이 없다.

---

### 3.4 구현 계획

#### Phase 0-5: ToolCallBlock 고도화 (P0)

**현재 `ToolCallBlock.tsx`:**
```tsx
// 단순히 이름 + 상태 아이콘
<Text color={statusColor}>{statusIcon} {name}</Text>
```

**목표:**
```tsx
// 실행 중
<Text color="yellow">
  <Spinner /> Reading src/core/agent-loop.ts
</Text>

// 완료
<Text color="green">✓ Read 3 files</Text>

// 에러
<Text color="red">✗ Failed to read /etc/shadow</Text>
```

**필요한 변경:**

1. **`ToolCallDisplay` 타입 확장** (`App.tsx` 또는 `message-types.ts`):

```typescript
interface ToolCallDisplay {
  id: string
  name: string
  status: 'running' | 'complete' | 'error' | 'denied'
  // 신규 필드:
  args?: Record<string, unknown>    // 도구 인자 (파일경로, 명령어 등)
  output?: string                    // 도구 결과
  startedAt?: number                 // 시작 시간
  completedAt?: number               // 완료 시간
  isError?: boolean
}
```

2. **도구별 표시 문구 매퍼** (`src/cli/renderer/tool-display.ts` 신규):

```typescript
interface ToolDisplayText {
  running: string   // "Reading src/file.ts"
  complete: string  // "Read 3 files"
  error: string     // "Failed to read /etc/shadow"
}

export function getToolDisplayText(
  name: string,
  status: 'running' | 'complete' | 'error',
  args?: Record<string, unknown>,
  output?: string
): string {
  switch (name) {
    case 'file_read':
      if (status === 'running') return `Reading ${args?.file_path}`
      if (status === 'complete') return `Read ${args?.file_path}`
      return `Failed to read ${args?.file_path}`

    case 'file_edit':
      if (status === 'running') return `Editing ${args?.file_path}`
      if (status === 'complete') return `Edited ${args?.file_path}`
      return `Failed to edit ${args?.file_path}`

    case 'file_write':
      if (status === 'running') return `Writing ${args?.file_path}`
      if (status === 'complete') return `Wrote ${args?.file_path}`
      return `Failed to write ${args?.file_path}`

    case 'bash_exec':
      const cmd = truncate(String(args?.command), 50)
      if (status === 'running') return `Running ${cmd}`
      if (status === 'complete') return `Ran ${cmd}`
      return `Command failed: ${cmd}`

    case 'glob_search':
      if (status === 'running') return `Searching for ${args?.pattern}`
      // output에서 매칭 개수 파싱
      if (status === 'complete') return `Found ${countMatches(output)} files`
      return `Search failed: ${args?.pattern}`

    case 'grep_search':
      if (status === 'running') return `Searching for "${args?.pattern}"`
      if (status === 'complete') return `Searched for "${args?.pattern}"`
      return `Search failed: "${args?.pattern}"`

    case 'mkdir':
      if (status === 'running') return `Creating ${args?.path}`
      if (status === 'complete') return `Created ${args?.path}`
      return `Failed to create ${args?.path}`

    default:
      if (status === 'running') return `Running ${name}`
      if (status === 'complete') return `Completed ${name}`
      return `Failed: ${name}`
  }
}
```

3. **이벤트 페이로드 확장** (`tool:start` 이벤트에 args 포함):

```typescript
// agent-loop.ts에서
config.events.emit('tool:start', {
  name: toolCall.name,
  id: toolCall.id,
  args: toolCall.arguments,  // 신규: 도구 인자 전달
})

config.events.emit('tool:complete', {
  name: toolCall.name,
  id: toolCall.id,
  isError: result.isError,
  output: result.output,     // 신규: 결과 전달
})
```

4. **App.tsx 이벤트 핸들러 업데이트:**

```typescript
events.on('tool:start', ({ name, id, args }) => {
  setToolCalls(prev => [...prev, {
    id, name, status: 'running',
    args,            // 신규
    startedAt: Date.now(),
  }])
})

events.on('tool:complete', ({ id, isError, output }) => {
  setToolCalls(prev => prev.map(tc =>
    tc.id === id
      ? { ...tc, status: isError ? 'error' : 'complete', output, completedAt: Date.now() }
      : tc
  ))
})
```

#### Phase 1-9: DiffView 컴포넌트 (P1)

**파일:** `src/cli/components/DiffView.tsx` (신규)

```typescript
interface DiffViewProps {
  filePath: string
  oldContent: string
  newContent: string
}
```

**렌더링:**
```tsx
<Box flexDirection="column" borderStyle="round" borderColor="gray">
  <Text bold dimColor> {filePath}</Text>
  {diffLines.map((line, i) => {
    if (line.type === 'add')
      return <Text key={i} backgroundColor="green" color="white"> + {line.text}</Text>
    if (line.type === 'remove')
      return <Text key={i} backgroundColor="red" color="white"> - {line.text}</Text>
    return <Text key={i} dimColor>   {line.text}</Text>  // context
  })}
</Box>
```

**Diff 라이브러리:** `diff` npm 패키지 사용 (`diffLines` 함수)

#### Phase 1-10: CollapsedToolGroup 컴포넌트 (P1)

연속된 같은 종류의 도구 호출을 하나로 그룹화:

```
✓ Read 3 files        ← 펼치면:
  ↳ src/cli/App.tsx
  ↳ src/core/agent-loop.ts
  ↳ src/llm/streaming.ts
```

```typescript
interface CollapsedToolGroupProps {
  tools: ToolCallDisplay[]
  isExpanded: boolean
  onToggle: () => void
}
```

#### Phase 2-9: ThinkingBlock 컴포넌트 (P2)

Extended Thinking 출력을 접힌 블록으로 표시:

```
▶ Thinking... (2.3s, 1,234 tokens)   ← 접힌 상태
▼ Thinking... (2.3s, 1,234 tokens)   ← 펼친 상태
  I need to analyze the agent loop...
  The key issue is that...
```

---

### 3.5 Activity Feed 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                        App.tsx                          │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ <Static>  ← 완료된 메시지 (다시 렌더링 안 됨)       │  │
│  │  ├─ UserMessage (파란 라벨)                        │  │
│  │  ├─ ToolCallBlock (✓ 완료 상태, 접힌 요약)         │  │
│  │  ├─ DiffView (파일 편집 시 인라인 diff)            │  │
│  │  ├─ AssistantMessage (마크다운 렌더링)              │  │
│  │  ├─ ThinkingBlock (접힌 사유 블록)                  │  │
│  │  └─ ... (시간순 반복)                               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Dynamic area  ← 현재 활성 영역 (재렌더링 O)        │  │
│  │  ├─ ToolCallBlock (⠋ 실행 중, 스피너 회전)         │  │
│  │  ├─ StreamingMessage (텍스트 + ▌ 커서)             │  │
│  │  └─ Spinner ("Thinking...")                        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ PermissionPrompt (필요 시만 — feed 일시 중단)       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ UserInput (항상 하단)                               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ StatusBar (모델, 토큰, 비용, 상태)                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**데이터 흐름:**

```
Agent Loop (core)
  ├→ emit('llm:text-delta')     → StreamingMessage 업데이트
  ├→ emit('tool:start')         → ToolCallBlock 추가 (running)
  ├→ emit('tool:complete')      → ToolCallBlock 업데이트 (complete)
  ├→ emit('llm:complete')       → StreamingMessage → Static으로 이동
  └→ emit('permission:request') → PermissionPrompt 표시

App.tsx (상태 관리)
  ├→ completedItems[]    → <Static> (불변, 스크롤백)
  ├→ activeToolCalls[]   → Dynamic area (재렌더링)
  ├→ streamingText       → StreamingMessage (재렌더링)
  └→ pendingPermission   → PermissionPrompt (모달)
```

**핵심 구현 원칙:**

1. **`<Static>` vs Dynamic 분리**: 완료된 항목은 `<Static>`으로 이동하여 성능 유지
2. **이벤트 기반 업데이트**: `mitt` 이벤트로 Core ↔ UI 디커플링
3. **도구별 표시 문구**: `tool-display.ts` 매퍼로 일관된 UX
4. **점진적 렌더링**: 스트리밍 중 raw 텍스트 → 완료 후 마크다운

---

### 3.6 Phase별 Activity Feed 구현 로드맵

| Phase | 작업 | 예상 LOC | 우선순위 |
|-------|------|----------|----------|
| **0-5** | ToolCallBlock에 도구 인자/결과 표시, 현재시제→과거시제 전환 | +100 | **P0** |
| **0-6** | `tool-display.ts` 도구별 표시 문구 매퍼 | +80 | **P0** |
| **0-7** | `tool:start`/`tool:complete` 이벤트에 args/output 추가 | +30 | **P0** |
| **1-9** | `DiffView.tsx` 인라인 diff 컴포넌트 | +120 | **P1** |
| **1-10** | `CollapsedToolGroup.tsx` 도구 그룹 접기 | +80 | **P1** |
| **1-11** | Static/Dynamic 영역 분리 리팩토링 | +60 | **P1** |
| **2-9** | `ThinkingBlock.tsx` 사유 표시 블록 | +70 | **P2** |
| **2-10** | Sub-agent 진행 표시 | +50 | **P2** |
| **2-11** | Status Bar 비용 + 소요시간 표시 | +40 | **P2** |

---

### 3.7 참고: Claude Code Activity Feed 출처

| 자료 | 내용 |
|------|------|
| [DeepWiki: UI/UX & Terminal Integration](https://deepwiki.com/anthropics/claude-code/3.9-uiux-and-terminal-integration) | Ink 컴포넌트 구조, Static/Dynamic 분리 |
| [Pragmatic Engineer: How Claude Code is Built](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built) | 아키텍처 개요, Yoga WASM, React Compiler |
| [Medium: Claude Code Internals Part 11 - Terminal UI](https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016) | 상세 터미널 UI 분석 |
| [Official: How Claude Code Works](https://code.claude.com/docs/en/how-claude-code-works) | 공식 아키텍처 문서 |
| [claude-devtools](https://www.claude-dev.tools/) | 세션 로그 분석 도구 (활동 내역 시각화) |
| [claude-esp](https://github.com/phiat/claude-esp) | 숨겨진 출력 스트리머 |
| [OpenCode Terminal UI](https://deepwiki.com/opencode-ai/opencode/4-terminal-ui-system) | 경쟁 제품 UI 구현 참고 |

---

## 4. Gap Analysis: Claude Code 대비 부족한 부분

### 입력 시스템

| 기능 | Claude Code | dbcode | Gap |
|------|-------------|--------|-----|
| 커서 좌/우 이동 | O | X | **CRITICAL** |
| Ctrl+A/E (Home/End) | O | X | HIGH |
| Alt+B/F (단어 이동) | O | X | MEDIUM |
| Ctrl+K (줄 끝까지 삭제) | O | X | MEDIUM |
| Ctrl+U (줄 전체 삭제) | O | X | MEDIUM |
| 입력 히스토리 (위/아래 방향키) | O | X | HIGH |
| 멀티라인 입력 | O (Shift+Enter) | X | HIGH |
| Vim 모드 | O (/vim) | X | LOW |
| 파일 경로 자동완성 (@) | O | X | MEDIUM |
| Reverse search (Ctrl+R) | O | X | LOW |

### Permission 시스템

| 기능 | Claude Code | dbcode | Gap |
|------|-------------|--------|-----|
| 방향키 선택 UI | O | X | **CRITICAL** |
| Session-level 승인 | O | O (일부) | - |
| 프로젝트별 규칙 | O | O | - |
| Shift+Tab 모드 전환 | O | X | MEDIUM |
| /permissions 커맨드 | O | X | MEDIUM |

### Git 통합

| 기능 | Claude Code | dbcode | Gap |
|------|-------------|--------|-----|
| git 명령 실행 | O | O (bash_exec) | - |
| 자동 체크포인트 | O (매 수정 전 스냅샷) | X | **HIGH** |
| /diff 커맨드 | O (인터랙티브 뷰어) | 정의만 있음 | HIGH |
| Esc+Esc Rewind | O | X | MEDIUM |
| 커밋 메시지 자동 생성 | O | X | MEDIUM |
| PR 생성 | O (gh CLI) | X | LOW |

### Agent 기능

| 기능 | Claude Code | dbcode | Gap |
|------|-------------|--------|-----|
| Sub-agent 실행 | O | 골격만 존재 | HIGH |
| Background task | O | X | MEDIUM |
| MCP 서버 연동 | O | 골격만 존재 | HIGH |
| Hooks 시스템 | O | 골격 있음 | MEDIUM |
| Skills/Plugins | O | 골격만 존재 | LOW |

### 도구(Tools) 시스템

| 기능 | Claude Code | dbcode | Gap |
|------|-------------|--------|-----|
| file_read | O | O | - |
| file_write | O | O | - |
| file_edit | O | O | - |
| bash_exec | O | O | - |
| glob_search | O | O | - |
| grep_search | O | O | - |
| ask_user | O | O | - |
| mkdir | 암묵적 (bash_exec) | 암묵적 (file_write) | MEDIUM |
| WebFetch | O | X | MEDIUM |
| WebSearch | O | X | LOW |
| notebook_edit | O | X | LOW |

---

## 5. Phase별 개발 계획

### Phase 0: Critical UX Fix (1주)

> **목표:** 기본적인 사용성 확보 — 이것 없이는 도구로서 기능하지 못함

| # | 작업 | 파일 | 예상 LOC |
|---|------|------|----------|
| 0-1 | **텍스트 입력 커서 이동** 구현 | `UserInput.tsx` | +80 |
| 0-2 | **Permission UI** 방향키 선택으로 전환 | `PermissionPrompt.tsx` | +60 |
| 0-3 | **Slash Command 메뉴** 연동 수정 | `App.tsx`, `SlashCommandMenu.tsx`, `UserInput.tsx` | +40 |
| 0-4 | **로고 복구** + 시작 화면 정리 | `App.tsx`, `Logo.tsx` | +20 |
| 0-5 | **ToolCallBlock 고도화** — 도구 인자 표시, 현재→과거시제 전환 | `ToolCallBlock.tsx`, `App.tsx` | +100 |
| 0-6 | **tool-display.ts** 도구별 표시 문구 매퍼 | 신규 `cli/renderer/tool-display.ts` | +80 |
| 0-7 | **이벤트 페이로드 확장** — tool:start/complete에 args/output 추가 | `agent-loop.ts`, `utils/events.ts` | +30 |

**검증 기준:**
- [ ] 입력 중 좌/우 방향키로 커서 이동 가능
- [ ] Permission 프롬프트에서 방향키로 선택지 탐색 + Enter 확정
- [ ] `/` 입력 시 커맨드 메뉴 표시, 위/아래 탐색, Tab/Enter 선택
- [ ] 앱 시작 시 로고 정상 표시
- [ ] 도구 실행 시 `⠋ Reading src/file.ts` 형태로 표시, 완료 시 `✓ Read 3 files`로 전환

---

### Phase 1: 핵심 기능 강화 (2주)

> **목표:** 실제 개발 작업에서 생산적으로 사용 가능한 수준

| # | 작업 | 파일 | 예상 LOC |
|---|------|------|----------|
| 1-1 | **입력 히스토리** (위/아래 방향키) | `UserInput.tsx`, 신규 `input-history.ts` | +60 |
| 1-2 | **멀티라인 입력** (Shift+Enter) | `UserInput.tsx` | +40 |
| 1-3 | **Readline 단축키** (Ctrl+A/E/K/U/W) | `UserInput.tsx` | +50 |
| 1-4 | **mkdir 전용 도구** 추가 | 신규 `tools/definitions/mkdir.ts` | +35 |
| 1-5 | **Git 체크포인트** (파일 수정 전 스냅샷) | 신규 `core/checkpoint-manager.ts` | +120 |
| 1-6 | **/diff 커맨드** 실제 구현 | `commands/diff.ts` | +80 |
| 1-7 | **Shift+Tab 모드 전환** (Normal → Auto-Accept → Plan) | `App.tsx`, `permissions/` | +40 |
| 1-8 | **로고 + Welcome 화면** 완성 | `Logo.tsx`, 신규 `WelcomeScreen.tsx` | +60 |

**검증 기준:**
- [ ] 이전 입력을 위/아래 키로 탐색
- [ ] 긴 프롬프트를 여러 줄에 걸쳐 입력 가능
- [ ] `mkdir` 도구가 LLM에 노출되어 폴더 생성 가능
- [ ] 파일 수정 전 자동 체크포인트 생성
- [ ] `/diff`로 현재 변경사항 확인 가능

---

### Phase 2: Agent 고도화 (2주)

> **목표:** 진정한 AI Agent 수준의 자율성과 도구 활용

| # | 작업 | 파일 | 예상 LOC |
|---|------|------|----------|
| 2-1 | **시스템 프롬프트 고도화** — git/mkdir 사용법, 코딩 컨벤션 주입 | `system-prompt-builder.ts` | +100 |
| 2-2 | **@파일경로 자동완성** | `UserInput.tsx`, 신규 `FileCompleter.tsx` | +80 |
| 2-3 | **Sub-agent 실행** 구현 | `subagents/` | +200 |
| 2-4 | **MCP 서버 연동** 구현 | `mcp/` | +250 |
| 2-5 | **WebFetch 도구** 추가 | `tools/definitions/web-fetch.ts` | +60 |
| 2-6 | **/rewind 커맨드** (Esc+Esc 체크포인트 복원) | `commands/rewind.ts`, `App.tsx` | +80 |
| 2-7 | **커밋 메시지 자동 생성** | 신규 `git/commit-message.ts` | +60 |
| 2-8 | **Hooks 시스템** 완성 (pre-tool, post-tool 이벤트) | `hooks/` | +100 |

**검증 기준:**
- [ ] LLM이 자발적으로 git status/commit 수행
- [ ] `@src/` 입력 시 파일 경로 자동완성
- [ ] MCP 서버 연결 및 도구 목록 조회
- [ ] 체크포인트에서 이전 상태로 복원 가능

---

### Phase 3: 안정화 & 확장 (2주)

> **목표:** 프로덕션 품질 + 확장 가능한 플러그인 생태계

| # | 작업 | 파일 | 예상 LOC |
|---|------|------|----------|
| 3-1 | **macOS Seatbelt 샌드박스** 구현 | `sandbox/` | +150 |
| 3-2 | **Skills/Plugins** 시스템 구현 | `skills/` | +200 |
| 3-3 | **Telemetry** (opt-in 사용 통계) | `telemetry/` | +80 |
| 3-4 | **E2E 테스트** 스위트 완성 | `test/e2e/` | +300 |
| 3-5 | **/doctor** 시스템 진단 구현 | `commands/doctor.ts` | +60 |
| 3-6 | **성능 최적화** (startup time, 메모리) | 전반 | +50 |
| 3-7 | **문서화** (README, 사용 가이드) | `docs/` | +500 |

---

## 6. 상세 구현 명세

### 5.1 텍스트 입력 리팩토링 (Phase 0-1)

**파일:** `src/cli/components/UserInput.tsx`

```typescript
// 현재 (문제)
const [value, setValue] = useState('')
// cursorOffset 없음 — 항상 끝에서만 편집

// 목표
const [value, setValue] = useState('')
const [cursorOffset, setCursorOffset] = useState(0)

// 키 핸들링 확장
useInput((input, key) => {
  // 이동
  if (key.leftArrow)  setCursorOffset(o => Math.max(0, o - 1))
  if (key.rightArrow) setCursorOffset(o => Math.min(value.length, o + 1))

  // Readline 단축키 (Phase 1)
  if (key.ctrl && input === 'a') setCursorOffset(0)              // Home
  if (key.ctrl && input === 'e') setCursorOffset(value.length)   // End
  if (key.ctrl && input === 'k') setValue(value.slice(0, cursorOffset)) // Kill to EOL
  if (key.ctrl && input === 'u') { setValue(''); setCursorOffset(0) }   // Kill line

  // 문자 삽입 (커서 위치에)
  if (input && !key.ctrl && !key.meta) {
    const next = value.slice(0, cursorOffset) + input + value.slice(cursorOffset)
    setValue(next)
    setCursorOffset(o => o + input.length)
  }

  // Backspace (커서 앞 문자 삭제)
  if (key.backspace && cursorOffset > 0) {
    const next = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset)
    setValue(next)
    setCursorOffset(o => o - 1)
  }

  // Delete (커서 뒤 문자 삭제)
  if (key.delete && cursorOffset < value.length) {
    const next = value.slice(0, cursorOffset) + value.slice(cursorOffset + 1)
    setValue(next)
  }
})

// 렌더링: 커서 위치에 블록 커서 표시
const before = value.slice(0, cursorOffset)
const cursor = value[cursorOffset] ?? ' '
const after  = value.slice(cursorOffset + 1)
return <Text>
  <Text color="blue">{"> "}</Text>
  <Text>{before}</Text>
  <Text inverse>{cursor}</Text>
  <Text>{after}</Text>
</Text>
```

---

### 5.2 Permission UI 리팩토링 (Phase 0-2)

**파일:** `src/cli/components/PermissionPrompt.tsx`

```typescript
// 현재: y/n/a 텍스트 입력
// 목표: 방향키 탭 선택

const options = [
  { label: 'Allow once',        value: 'once'    },
  { label: 'Allow for session', value: 'session' },
  { label: 'Deny',              value: 'deny'    },
] as const

const [selectedIndex, setSelectedIndex] = useState(0)

useInput((input, key) => {
  if (key.leftArrow)  setSelectedIndex(i => Math.max(0, i - 1))
  if (key.rightArrow) setSelectedIndex(i => Math.min(options.length - 1, i + 1))
  if (key.return) {
    const choice = options[selectedIndex].value
    if (choice === 'once')    onApprove()
    if (choice === 'session') onApproveAll()
    if (choice === 'deny')    onDeny()
  }
})

// 렌더링
return <Box flexDirection="column" borderStyle="round" borderColor="yellow">
  <Text bold> {toolName}</Text>
  <Text dimColor> {formatArgs(args)}</Text>
  <Box gap={2} marginTop={1}>
    {options.map((opt, i) => (
      <Text key={opt.value}
        bold={i === selectedIndex}
        color={i === selectedIndex ? 'cyan' : 'gray'}
        underline={i === selectedIndex}>
        {i === selectedIndex ? '▸ ' : '  '}{opt.label}
      </Text>
    ))}
  </Box>
</Box>
```

---

### 5.3 Slash Command 메뉴 연동 (Phase 0-3)

**핵심 문제:** `UserInput`의 현재 입력값이 `App.tsx`로 전달되지 않아 `SlashCommandMenu`가 렌더링되지 않음

**수정 흐름:**

```
UserInput (onChange) → App.tsx (inputValue state)
  → inputValue.startsWith('/') && !inputValue.includes(' ')
    → <SlashCommandMenu prefix={inputValue} />

SlashCommandMenu에서 선택 시:
  → onSelect(commandName) → App.tsx → UserInput의 value를 교체
```

**UserInput에 추가할 prop:**
```typescript
interface UserInputProps {
  onSubmit: (value: string) => void
  onChange?: (value: string) => void     // 신규: 실시간 입력값 전달
  onSlashSelect?: (command: string) => void  // 신규: 메뉴에서 선택 시
  disabled?: boolean
}
```

**SlashCommandMenu 개선:**
```typescript
// 위/아래 방향키로 항목 탐색
useInput((input, key) => {
  if (key.upArrow)   setSelectedIndex(i => Math.max(0, i - 1))
  if (key.downArrow) setSelectedIndex(i => Math.min(items.length - 1, i + 1))
  if (key.tab || key.return) onSelect(items[selectedIndex].name)
  if (key.escape) onClose()
})
```

---

### 5.4 mkdir 도구 (Phase 1-4)

**파일:** `src/tools/definitions/mkdir.ts`

```typescript
import { z } from 'zod'
import { mkdir } from 'node:fs/promises'
import type { ToolDefinition } from '../types.js'

export const mkdirTool: ToolDefinition = {
  name: 'mkdir',
  description: 'Create a directory and all necessary parent directories.',
  parameterSchema: z.object({
    path: z.string().describe('Absolute path of the directory to create'),
  }),
  permissionLevel: 'confirm',
  execute: async (params) => {
    await mkdir(params.path, { recursive: true })
    return { output: `Created directory: ${params.path}`, isError: false }
  },
}
```

---

### 5.5 Git 체크포인트 시스템 (Phase 1-5)

**파일:** `src/core/checkpoint-manager.ts`

**설계:**
```
매 파일 수정 tool 실행 전:
  1. git stash create → stash ref 획득 (working tree 오염 없음)
  2. checkpoint = { id, timestamp, stashRef, toolName, filePath, turnIndex }
  3. checkpoints[] 배열에 push (최대 20개, FIFO)

복원 시 (/rewind):
  1. 사용자가 체크포인트 선택
  2. git stash apply <stashRef>
  3. conversation을 해당 turnIndex까지 truncate
```

**주의사항:**
- `git stash create`는 working tree를 변경하지 않음 (stash push와 다름)
- `git log`에 흔적을 남기지 않음
- 30일 후 자동 만료 (gc)

---

### 5.6 시스템 프롬프트 강화 (Phase 2-1)

**현재 문제:** LLM이 폴더 생성, git 명령 등을 자발적으로 수행하지 않음

**추가할 내용 (`system-prompt-builder.ts`):**

```markdown
## Available Tools Usage Guide

### File System Operations
- Use `file_write` to create files (parent directories are auto-created)
- Use `mkdir` to create empty directories
- Use `bash_exec` for complex file operations (mv, cp, rm, chmod)

### Git Operations
- You have full git access via `bash_exec`
- ALWAYS check `git status` before committing
- Generate meaningful commit messages following conventional commits
- Use `git diff` to review changes before committing
- Create branches for feature work: `git checkout -b feat/description`

### Best Practices
- Read files before modifying them
- Use `grep_search` to understand codebase before making changes
- Ask the user when requirements are ambiguous
```

---

## 7. 아키텍처 변경 사항

### 6.1 입력 시스템 아키텍처

```
현재:
  UserInput (단순 append)
    → onSubmit(value)
      → App processes

목표:
  UserInput (cursorOffset + readline shortcuts)
    ├→ onChange(value)     → App → SlashCommandMenu / FileCompleter
    ├→ onSubmit(value)     → App → Agent Loop
    └→ InputHistory        → 위/아래 방향키로 이전 입력 탐색
         └→ ~/.dbcode/input-history.json (최근 100개)
```

### 6.2 Permission 시스템 아키텍처

```
현재:
  PermissionPrompt (y/n/a 텍스트)
    → manager.approve/deny

목표:
  PermissionPrompt (방향키 선택)
    ├→ Allow once     → manager.approve(toolName, args)
    ├→ Allow session  → manager.approveAll(toolName)
    └→ Deny           → manager.deny(toolName)

  + Shift+Tab 글로벌 모드 전환:
    Normal ──→ Auto-Accept ──→ Plan ──→ Normal
      │            │              │
    confirm시    자동 승인      읽기 전용
    프롬프트     (file edit)    (tool 차단)
```

### 6.3 Slash Command 아키텍처

```
현재:
  "/" 입력 → SlashCommandMenu (렌더링 안 됨)

목표:
  "/" 입력 → onChange로 App에 전달
    → <SlashCommandMenu visible prefix={input}>
        ├→ 필터링된 커맨드 목록
        ├→ 위/아래 방향키 탐색
        ├→ Tab/Enter 선택 → input 교체
        └→ Esc 닫기

  "@" 입력 (Phase 2):
    → <FileCompleter visible prefix={afterAt}>
        ├→ glob 결과 실시간 표시
        ├→ Tab 자동완성
        └→ 선택된 파일 내용이 context에 추가
```

---

## 8. 테스트 전략

### Phase 0 테스트

```typescript
// UserInput 테스트
describe('UserInput cursor movement', () => {
  it('should move cursor left/right with arrow keys')
  it('should insert character at cursor position')
  it('should delete character at cursor position with backspace')
  it('should handle Ctrl+A (home) and Ctrl+E (end)')
})

// PermissionPrompt 테스트
describe('PermissionPrompt selection', () => {
  it('should cycle options with left/right arrows')
  it('should confirm selection with Enter')
  it('should highlight selected option')
})

// SlashCommandMenu 테스트
describe('SlashCommandMenu', () => {
  it('should show when input starts with "/"')
  it('should filter commands by prefix')
  it('should navigate with up/down arrows')
  it('should select with Tab/Enter')
  it('should close with Escape')
})
```

### E2E 시나리오

```
1. 앱 시작 → 로고 표시 확인
2. "Create a new directory called test-project" 입력
   → LLM이 mkdir 도구 호출
   → Permission 프롬프트 표시 → 방향키로 Allow 선택
   → 디렉토리 생성 확인
3. "/help" 입력 → 메뉴에서 help 선택 → 도움말 표시
4. 텍스트 입력 후 좌측 방향키 → 커서 이동 → 중간에 문자 삽입
```

---

## 9. 우선순위 매트릭스

```
              Impact
              HIGH ┃ Phase 0-1  Phase 0-2  Phase 1-5
                   ┃ (커서이동)  (Permission) (체크포인트)
                   ┃
                   ┃ Phase 0-3  Phase 1-1  Phase 2-1
                   ┃ (메뉴연동)  (히스토리)  (시스템프롬프트)
                   ┃
              LOW  ┃ Phase 0-4  Phase 1-4  Phase 3-6
                   ┃ (로고복구)  (mkdir)     (최적화)
                   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    LOW         Effort         HIGH
```

### 즉시 실행 (이번 주)

1. **UserInput 커서 이동** — 모든 CLI 도구의 기본 중의 기본
2. **PermissionPrompt 방향키 선택** — 사용자 경험의 핵심
3. **SlashCommandMenu 연동** — 기능 접근성의 관문
4. **로고 복구** — 브랜딩 + 첫인상

### 다음 스프린트

5. 입력 히스토리
6. 멀티라인 입력
7. mkdir 도구
8. Git 체크포인트
9. 시스템 프롬프트 강화

---

## 부록: 참고 자료

### Ink 생태계

| 패키지 | 용도 | URL |
|--------|------|-----|
| ink-text-input | 텍스트 입력 (커서 이동 내장) | github.com/vadimdemedes/ink-text-input |
| @inkjs/ui | TextInput, Select, ConfirmInput 등 | github.com/vadimdemedes/ink-ui |
| ink-select-input | 선택 목록 (위/아래 방향키) | github.com/vadimdemedes/ink-select-input |

### 경쟁 제품 분석

| 제품 | Permission UI | Input | Slash Commands | Git 통합 |
|------|--------------|-------|----------------|----------|
| Claude Code | 탭 선택 | readline+vim | 40+ 자동완성 | 체크포인트 |
| Cline | 버튼 (VS Code) | VS Code 내장 | 없음 | 없음 |
| OpenCode (Go) | 미확인 | 커스텀 | 미확인 | 미확인 |
| Aider | 텍스트 | readline | /commands | git 자동커밋 |

---

> **핵심 메시지:** Phase 0의 4개 작업이 완료되면 dbcode는 "사용 가능한" 도구가 됩니다.
> Phase 1까지 완료되면 "생산적인" 도구가 됩니다.
> Phase 2까지 완료되면 Claude Code에 근접한 "자율적 AI Agent"가 됩니다.
