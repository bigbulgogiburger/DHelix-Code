# /init 명령어 개선안

> dbcode `/init` vs Claude Code `/init` 비교 분석 및 개선 제안
> 작성일: 2026-03-18

---

## 1. 현재 상태 진단

### 1.1 dbcode `/init`의 현재 흐름

```
/init 입력
  → ensureConfigDir() — .dbcode/ 생성
  → ensureGitignoreEntry() — DBCODE.local.md를 .gitignore에 추가
  → buildAnalysisPrompt() — 프롬프트 구성
  → shouldInjectAsUserMessage: true — LLM에 주입
  → LLM이 도구로 분석 후 DBCODE.md 작성
  → refreshInstructions: true — 시스템 프롬프트 갱신
```

### 1.2 현재 분석 프롬프트가 지시하는 것 (5단계)

1. 프로젝트 설정 파일 읽기 (package.json, Cargo.toml 등)
2. 디렉토리 구조 탐색
3. README.md 확인
4. 핵심 소스 파일 읽기
5. Git 히스토리에서 커밋 규칙 확인

### 1.3 정적 템플릿 (CLI 폴백)

- package.json → name, build/test/lint 스크립트
- tsconfig.json, Cargo.toml, go.mod, pyproject.toml → 언어 감지
- 감지 실패 시 → 예시 플레이스홀더

---

## 2. Claude Code `/init`과의 GAP 분석

### 2.1 기능 비교 매트릭스

| 기능                    | Claude Code                     | dbcode                | GAP          |
| ----------------------- | ------------------------------- | --------------------- | ------------ |
| 기본 코드베이스 분석    | O                               | O                     | -            |
| 프로젝트 설정 파일 감지 | O                               | O                     | -            |
| Git 히스토리 분석       | O                               | O (프롬프트에만 언급) | **약함**     |
| .gitignore 자동 관리    | O                               | O                     | -            |
| 기존 파일 업데이트 모드 | O                               | O                     | -            |
| **인터랙티브 모드**     | O (`NEW_INIT=true`)             | X                     | **심각**     |
| **서브에이전트 탐색**   | O (별도 에이전트로 분석)        | X                     | **심각**     |
| **사전 리뷰 제안**      | O (쓰기 전 제안서 표시)         | X                     | **심각**     |
| **팔로업 질문**         | O (부족한 정보 사용자에게 질문) | X                     | **중요**     |
| **스킬/훅 함께 설정**   | O (CLAUDE.md + skills + hooks)  | X                     | **중요**     |
| **200줄 제한 권장**     | O (명시적 가이드라인)           | 400줄                 | **개선필요** |
| **@import 시스템**      | O (`@path/to/file` 구문)        | X                     | **중요**     |
| **path-scoped rules**   | O (YAML frontmatter)            | 부분적                | **개선필요** |
| 모노레포 감지           | O                               | X                     | **중요**     |
| CI/CD 감지              | O                               | X                     | **중요**     |
| 환경변수 감지 (.env)    | O                               | X                     | **개선필요** |
| Docker/컨테이너 감지    | O                               | X                     | **개선필요** |

### 2.2 GAP 심각도 분류

**심각 (Core UX Gap):**

- 인터랙티브 모드 없음 — 사용자가 뭘 생성할지 선택 불가
- 서브에이전트 탐색 없음 — 메인 컨텍스트에서 분석하므로 컨텍스트 낭비
- 사전 리뷰 없음 — 바로 파일 작성, 사용자 확인 없이

**중요 (Quality Gap):**

- 팔로업 질문 없음 — 애매한 것을 추측으로 채움
- 스킬/훅 연계 없음 — DBCODE.md만 생성
- @import 없음 — 큰 프로젝트에서 파일이 비대해짐
- 모노레포/CI 감지 없음 — 풀스택 프로젝트에서 정보 누락

**개선필요 (Polish Gap):**

- 200줄 가이드 vs 400줄 — 간결함 부족
- .env 감지 — 필요한 환경변수 문서화 누락
- Docker 감지 — 개발 환경 설정 누락

---

## 3. 개선 제안

### 3.1 Phase 1: 인터랙티브 모드 추가 (최우선)

Claude Code의 `CLAUDE_CODE_NEW_INIT=true` 모드를 참고하여 **4단계 인터랙티브 플로우** 구현.

#### 현재 (단일 단계)

```
/init → LLM이 알아서 분석 → 파일 작성 (끝)
```

#### 개선 후 (4단계)

```
/init
  → Phase 1: 사용자에게 생성할 항목 질문
      "다음 중 생성할 항목을 선택하세요:
       [x] DBCODE.md (프로젝트 가이드)
       [ ] .dbcode/rules/ (코딩 규칙 파일)
       [ ] .dbcode/skills/ (커스텀 스킬)
       [ ] .dbcode/hooks/ (자동 훅)"

  → Phase 2: 서브에이전트로 코드베이스 탐색
      - 메인 컨텍스트를 오염시키지 않음
      - 탐색 결과만 요약하여 반환

  → Phase 3: 부족한 정보 팔로업 질문
      "다음 사항을 확인해주세요:
       1. 테스트 실행 시 특별한 환경 설정이 필요한가요?
       2. 이 프로젝트의 배포 대상은? (AWS, GCP, 자체 서버)
       3. PR 리뷰 프로세스가 있나요?"

  → Phase 4: 리뷰 가능한 제안서 표시
      "다음 내용으로 DBCODE.md를 생성하겠습니다:
       [제안 내용 미리보기]
       계속하시겠습니까? (y/n/수정사항 입력)"
```

#### 구현 포인트

```typescript
// src/commands/init.ts — execute 함수 개선 방향

export const initCommand: SlashCommand = {
  name: "init",
  execute: async (_args, context) => {
    const mode = _args?.includes("--interactive") || _args?.includes("-i") ? "interactive" : "auto";

    if (mode === "interactive") {
      // Phase 1: ask_user 도구로 선택지 제시
      // Phase 2: 서브에이전트 탐색 (shouldSpawnSubagent: true)
      // Phase 3: 팔로업 질문
      // Phase 4: 리뷰 후 작성
      return buildInteractivePrompt(context);
    }

    // 기존 자동 모드 (현재 로직)
    return buildAutoPrompt(context);
  },
};
```

### 3.2 Phase 2: 분석 프롬프트 강화

#### 현재 프롬프트의 분석 지시 (5단계)

```
1. 프로젝트 설정 파일 읽기
2. 디렉토리 구조 탐색
3. README.md 확인
4. 핵심 소스 파일 읽기
5. Git 히스토리 커밋 규칙
```

#### 개선된 분석 지시 (12단계)

```
1.  프로젝트 설정 파일 읽기 (기존)
2.  디렉토리 구조 탐색 (기존)
3.  README.md 확인 (기존)
4.  핵심 소스 파일 읽기 (기존)
5.  Git 히스토리 커밋 규칙 (기존)
6.  [NEW] 모노레포 감지 — workspaces, lerna.json, nx.json, turbo.json
7.  [NEW] CI/CD 파이프라인 — .github/workflows/, .gitlab-ci.yml, Jenkinsfile
8.  [NEW] 환경변수 — .env.example, .env.sample에서 필수 변수 추출
9.  [NEW] Docker/컨테이너 — Dockerfile, docker-compose.yml
10. [NEW] 테스트 구조 — test/, __tests__/, *.test.*, *.spec.* 패턴 분석
11. [NEW] 기존 .dbcode/rules/ 파일 확인 — 중복 방지
12. [NEW] 의존성 그래프 핵심 — 진입점(entry point)부터 주요 모듈 흐름 추적
```

#### 프롬프트 변경 (buildAnalysisPrompt 개선)

```typescript
const instructions = `## What to include

1. **Build/Test/Lint commands** — commonly used commands, how to run a single test.
   Include package manager commands and relevant scripts.
2. **High-level architecture** — code structure requiring reading multiple files to
   understand. Dependency direction, layer separation, key abstractions.
3. **Code style conventions** — import patterns, naming, error handling, project-specific
   rules that differ from language defaults.
4. **Key technical decisions** — framework choices, important patterns, constraints.
5. **[NEW] Development environment** — required env vars, Docker setup, prerequisite
   services (DB, Redis, etc.)
6. **[NEW] CI/CD workflow** — how to pass CI, required checks, deployment process.
7. **[NEW] Monorepo structure** — if applicable, workspace layout, shared packages,
   inter-package dependencies.

## Analysis steps

1.  Read project config files (package.json, Cargo.toml, go.mod, etc.)
2.  Explore top-level directory structure
3.  Check README.md for non-obvious information
4.  Read key source files for patterns and conventions
5.  Check git log (last 20 commits) for commit conventions
6.  [NEW] Detect monorepo (workspaces, nx.json, turbo.json, lerna.json)
7.  [NEW] Read CI/CD configs (.github/workflows/, .gitlab-ci.yml)
8.  [NEW] Read .env.example or .env.sample for required env vars
9.  [NEW] Check Dockerfile / docker-compose.yml for dev environment
10. [NEW] Analyze test directory structure and test runner config
11. [NEW] Check existing .dbcode/rules/ to avoid duplication
12. [NEW] Trace entry point → main modules for dependency flow

## Guidelines

- Do NOT include instructions that can be derived by reading the code itself
- Do NOT list every file — only document what requires reading MULTIPLE files
- Do NOT make up information not backed by actual project files
- Do NOT include generic practices any experienced developer would know
- **Keep it under 200 lines** — split to .dbcode/rules/ if needed
- Use the project's actual structure, not hypothetical ones
- **Prioritize "what Claude can't guess"** over comprehensive documentation
- Write instructions that are concrete enough to verify`;
```

### 3.3 Phase 3: 서브에이전트 기반 탐색

현재는 `/init` 프롬프트가 메인 에이전트 루프에서 실행되어 **컨텍스트 윈도우를 대량 소비**합니다.

#### 개선: 탐색 전용 서브에이전트 분리

```typescript
// 개선된 init 프롬프트 구조
function buildAnalysisPrompt(isUpdate: boolean, configDirCreated: boolean): string {
  return `
${contextLines}

## Execution strategy

**Step 1**: Spawn a subagent to explore the codebase:
\`\`\`
Subagent task: "Analyze this project's structure, build system, test setup,
CI/CD, environment requirements, and coding conventions. Return a structured
summary with specific file paths and code examples."
\`\`\`

**Step 2**: Based on the subagent's findings, draft DBCODE.md content.

**Step 3**: Present the draft to the user for review before writing.

**Step 4**: After user approval, write DBCODE.md and split large sections
into .dbcode/rules/ files if over 200 lines.

${instructions}
`;
}
```

#### 이점

- 메인 컨텍스트가 탐색 중간 결과로 오염되지 않음
- 서브에이전트가 수십 개 파일을 읽어도 요약만 반환
- 이후 대화에서 컨텍스트 여유가 더 많음

### 3.4 Phase 4: 정적 템플릿 (generateTemplate) 강화

현재 `generateTemplate()`은 너무 빈약합니다.

#### 현재 감지 항목 (5개)

| 파일           | 감지 내용                      |
| -------------- | ------------------------------ |
| package.json   | name, build/test/lint 스크립트 |
| tsconfig.json  | "Language: TypeScript"         |
| Cargo.toml     | "Language: Rust"               |
| go.mod         | "Language: Go"                 |
| pyproject.toml | "Language: Python"             |

#### 개선 감지 항목 (15+개)

| 파일                     | 감지할 내용                                                  |
| ------------------------ | ------------------------------------------------------------ |
| package.json             | name, scripts, type(module/commonjs), engines, workspaces    |
| tsconfig.json            | strict mode, target, module, paths aliases                   |
| Cargo.toml               | name, edition, workspace members, features                   |
| go.mod                   | module path, go version, key dependencies                    |
| pyproject.toml           | name, python version, build system (poetry/hatch/setuptools) |
| **pom.xml**              | Java version, spring boot version, modules                   |
| **build.gradle**         | Kotlin/Groovy, plugins, subprojects                          |
| **Gemfile**              | Ruby version, rails version                                  |
| **.github/workflows/**   | CI 존재 여부, 주요 job 이름                                  |
| **Dockerfile**           | base image, exposed ports                                    |
| **docker-compose.yml**   | services (db, redis, etc.)                                   |
| **.env.example**         | 필수 환경변수 목록                                           |
| **nx.json / turbo.json** | 모노레포 도구                                                |
| **Makefile**             | 주요 타겟 목록                                               |
| **vitest/jest config**   | 테스트 프레임워크, 커버리지 설정                             |

### 3.5 Phase 5: 출력 구조 개선

#### 현재 DBCODE.md 출력 구조 (비정형)

프롬프트에서 `Required format`은 헤더 한 줄만 지정:

```markdown
# DBCODE.md

This file provides guidance to dbcode...
```

나머지는 LLM 재량 — 품질이 일관적이지 않음.

#### 개선: 권장 섹션 템플릿 (Claude Code 스타일)

````markdown
# DBCODE.md — {project-name}

{1-2줄 프로젝트 설명}

## Commands

```bash
npm run build        # 빌드
npm test             # 전체 테스트
npm test -- -t "name" # 단일 테스트
npm run lint         # 린트
npm run typecheck    # 타입 체크
```
````

## Architecture

{아키텍처 다이어그램 또는 핵심 계층 설명}
{의존성 방향: top → bottom only}

## Code Style

- {import 패턴}
- {네이밍 규칙}
- {에러 처리 패턴}
- {프로젝트 특유 규칙}

## Development

- {필수 환경변수}
- {로컬 개발 서버 실행법}
- {DB/서비스 의존성}

````

#### 핵심 원칙 (Claude Code에서 차용)

1. **"Claude가 추측할 수 없는 것"만 포함** — 코드를 읽으면 알 수 있는 건 제외
2. **200줄 이하** — 넘으면 `.dbcode/rules/`로 분리
3. **검증 가능한 지시** — "깔끔하게 작성" (X) → "2-space indent 사용" (O)
4. **Bash 명령어 우선** — 빌드/테스트/린트 명령어가 가장 유용

### 3.6 Phase 6: @import 시스템 도입

큰 프로젝트에서 DBCODE.md가 비대해지는 것을 방지.

```markdown
# DBCODE.md

프로젝트 기본 가이드는 @README.md 참조.

## Commands
...

## Architecture
상세 아키텍처: @.dbcode/docs/architecture.md

## Rules
@.dbcode/rules/code-style.md
@.dbcode/rules/testing.md
@.dbcode/rules/security.md
````

#### 구현 위치

`src/instructions/loader.ts`에 `@path` 구문 파싱 및 재귀 로딩 추가.

```typescript
// @import 파싱 (최대 5단계 재귀)
function resolveImports(content: string, basePath: string, depth = 0): string {
  if (depth > 5) return content;
  return content.replace(/@([^\s]+\.md)/g, (_, importPath) => {
    const resolved = resolve(basePath, importPath);
    const imported = readFileSync(resolved, "utf-8");
    return resolveImports(imported, dirname(resolved), depth + 1);
  });
}
```

---

## 4. 구현 우선순위

| 우선순위 | 항목                              | 난이도 | 임팩트 | 예상 작업량                   |
| -------- | --------------------------------- | ------ | ------ | ----------------------------- |
| **P0**   | 분석 프롬프트 강화 (12단계)       | 낮음   | 높음   | 프롬프트 텍스트만 수정        |
| **P0**   | 200줄 가이드라인 + 권장 섹션 구조 | 낮음   | 높음   | 프롬프트 텍스트만 수정        |
| **P1**   | 정적 템플릿 감지 항목 확장 (15+)  | 중간   | 중간   | generateTemplate() 확장       |
| **P1**   | 서브에이전트 탐색 분리            | 중간   | 높음   | 프롬프트에 subagent 지시 추가 |
| **P2**   | 인터랙티브 모드 (`/init -i`)      | 높음   | 높음   | 4단계 플로우 구현             |
| **P2**   | 사전 리뷰 (작성 전 확인)          | 중간   | 중간   | 프롬프트에 리뷰 단계 추가     |
| **P3**   | @import 시스템                    | 높음   | 중간   | loader.ts 파서 추가           |
| **P3**   | 스킬/훅 연계 생성                 | 높음   | 낮음   | 전체 init 플로우 재설계       |

---

## 5. 즉시 적용 가능한 Quick Win

아래 2개는 **프롬프트 텍스트만 수정**하면 됩니다 (코드 변경 최소).

### Quick Win 1: buildAnalysisPrompt() 분석 단계 확장

`src/commands/init.ts`의 `buildAnalysisPrompt()` 함수에서 분석 지시를 5단계 → 12단계로 확장.

### Quick Win 2: 가이드라인 강화

```diff
- Keep it concise — aim for under 400 lines. Prefer brevity over verbosity
+ Keep it under 200 lines. If more detail is needed, create separate files
+   in .dbcode/rules/ (e.g., code-style.md, testing.md, security.md).
+ Prioritize "what the AI can't guess from reading the code" — build commands,
+   env vars, non-obvious constraints, team conventions.
+ Write instructions that are concrete enough to verify
+   (e.g., "2-space indent" not "format properly").
```

---

## 6. 참고: Claude Code /init의 핵심 철학

> "There's no required format for CLAUDE.md files, but keep it short and human-readable."

> "Include bash commands Claude can't guess, code style rules that differ from defaults,
> and repository etiquette. Exclude anything Claude can figure out by reading code."

Claude Code의 `/init`이 우수한 이유는 **"무엇을 포함하지 말 것인가"**에 대한 가이드가 명확하기 때문입니다. dbcode의 프롬프트도 이 철학을 더 강하게 반영해야 합니다.

---

## 7. 결론

dbcode의 `/init`은 **기본 골격은 갖추고 있지만**, Claude Code 대비 3가지 핵심 차이가 있습니다:

1. **일방적 생성** vs **인터랙티브 확인** — 사용자 참여 부족
2. **얕은 분석** vs **깊은 탐색** — CI/CD, Docker, env, 모노레포 누락
3. **길고 장황** vs **짧고 핵심적** — 400줄 허용 vs 200줄 권장

**P0 (프롬프트만 수정)**부터 시작하면 코드 변경 없이도 품질을 크게 올릴 수 있습니다.
