# dbcode

로컬/외부 LLM을 활용하는 CLI AI 코딩 어시스턴트. OpenAI 호환 API라면 어디서든 Claude Code급 코딩 지원을 받을 수 있습니다.

```
$ dbcode
   ____  ____   ____ ___  ____  _____
  |  _ \| __ ) / ___/ _ \|  _ \| ____|
  | | | |  _ \| |  | | | | | | |  _|
  | |_| | |_) | |__| |_| | |_| | |___
  |____/|____/ \____\___/|____/|_____|

  AI coding assistant for local/external LLMs
```

## 주요 기능

- **멀티 프로바이더 LLM** — OpenAI, Anthropic, Azure OpenAI, 또는 어떤 OpenAI 호환 API든 사용 가능 (Ollama, LM Studio, vLLM 등)
- **16개 내장 도구** — 파일 읽기/쓰기/편집, bash 실행, glob/grep 검색, 웹 검색, Jupyter 노트북 편집, 서브에이전트 스폰
- **ReAct 에이전트 루프** — 병렬 도구 실행 + 자동 체크포인팅
- **3단계 컨텍스트 압축** — 마이크로(콜드 스토리지) → 구조화 요약 → 재수화. 83.5% 사용 시 자동 트리거
- **인터랙티브 터미널 UI** — Ink/React 기반 CLI, 마크다운 렌더링, 구문 강조, diff 미리보기
- **안티 플리커 렌더링** — Progressive Static Flushing + DEC Mode 2026 원자적 프레임
- **확장 가능한 스킬 시스템** — 마크다운 파일로 커스텀 워크플로우 정의, 자동으로 슬래시 명령어로 등록
- **권한 시스템** — 5단계 모드 (엄격한 확인 → 전체 우회)
- **MCP 연동** — Model Context Protocol로 외부 도구 서버 연결
- **세션 관리** — 대화 저장, 이어하기, 포크
- **헤드리스 모드** — `--print` 플래그로 비대화형 실행 (CI/스크립팅용)
- **크로스 플랫폼** — Windows + macOS 지원

## 빠른 시작

### 사전 요구사항

- **Node.js 20 이상**
- **LLM API 키** (OpenAI, Azure, Anthropic, 또는 호환 프로바이더)

### 설치

```bash
# 소스에서 빌드
git clone https://github.com/bigbulgogiburger/dbcode.git
cd dbcode
npm install
npm run build
npm link    # 'dbcode' 명령어를 전역으로 등록

# 또는 직접 실행
node bin/dbcode.mjs
```

### 첫 실행

```bash
dbcode
```

처음 실행하면 **설정 마법사**가 안내합니다:
1. LLM 프로바이더 선택 (OpenAI / Azure / 커스텀)
2. API base URL 및 API 키 입력
3. 기본 모델 선택

설정은 `~/.dbcode/config.json`에 저장됩니다.

### 환경 변수 설정

환경 변수로도 설정할 수 있습니다:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.openai.com/v1"   # 선택
export OPENAI_MODEL="gpt-4o"                          # 선택

# dbcode 전용 오버라이드
export DBCODE_API_KEY="sk-..."
export DBCODE_BASE_URL="https://your-endpoint.com/v1"
export DBCODE_MODEL="your-model"
```

## 사용법

### 인터랙티브 모드

```bash
dbcode                          # 대화형 세션 시작
dbcode -m gpt-4o                # 특정 모델 사용
dbcode -u http://localhost:11434/v1  # 로컬 Ollama 사용
dbcode -c                       # 마지막 세션 이어하기
dbcode -r <session-id>          # 특정 세션 재개
dbcode --add-dir ../other-repo  # 추가 디렉토리 포함 (모노레포)
```

### 헤드리스 모드

```bash
dbcode -p "이 코드베이스를 설명해줘"                        # 결과 출력 후 종료
dbcode -p "TODO 주석 전부 찾아줘" --output-format json      # JSON 출력
```

### CLI 옵션

| 플래그 | 설명 |
|--------|------|
| `-m, --model <model>` | LLM 모델 이름 |
| `-u, --base-url <url>` | OpenAI 호환 API base URL |
| `-k, --api-key <key>` | API 키 |
| `-v, --verbose` | 상세 로깅 활성화 |
| `-c, --continue` | 가장 최근 세션 이어하기 |
| `-r, --resume <id>` | 특정 세션 ID로 재개 |
| `-p, --print <prompt>` | 헤드리스 모드: 프롬프트 실행 후 결과 출력 |
| `--output-format <fmt>` | 헤드리스 출력 형식: `text`, `json`, `stream-json` |
| `--add-dir <dirs...>` | 모노레포용 추가 디렉토리 |

### 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Esc` | 현재 에이전트 루프 취소 |
| `Shift+Tab` | 권한 모드 순환 |
| `Ctrl+O` | 상세 모드 토글 (전체 도구 출력 표시) |
| `Ctrl+D` | 종료 |
| `Alt+T` | 확장 사고(Extended Thinking) 토글 |

`~/.dbcode/keybindings.json`에서 커스터마이즈 가능합니다.

## 슬래시 명령어

대화 중 `/`를 입력하면 사용 가능한 명령어 목록이 표시됩니다.

| 명령어 | 설명 |
|--------|------|
| `/help` | 전체 명령어 보기 |
| `/model` | LLM 모델 전환 |
| `/commit` | AI 기반 git 커밋 (컨벤셔널 메시지 자동 생성) |
| `/review` | 현재 diff에 대한 코드 리뷰 |
| `/compact` | 컨텍스트 강제 압축 |
| `/clear` | 대화 초기화 |
| `/undo` | 마지막 파일 변경 되돌리기 |
| `/rewind` | 이전 체크포인트로 되감기 |
| `/diff` | 보류 중인 변경사항 표시 |
| `/cost` | 토큰 사용량 및 비용 표시 |
| `/stats` | 세션 통계 |
| `/config` | 설정 조회/수정 |
| `/permissions` | 권한 규칙 관리 |
| `/memory` | 영구 메모리 관리 |
| `/init` | 프로젝트에 DBCODE.md 초기화 |
| `/export` | 대화 내보내기 |
| `/resume` | 이전 세션 재개 |
| `/plan` | 계획 모드 진입 |
| `/mcp` | MCP 서버 관리 |
| `/doctor` | 설정 문제 진단 |

## 내장 도구

AI 에이전트가 대화 중 사용할 수 있는 도구입니다:

| 도구 | 권한 | 설명 |
|------|------|------|
| `file_read` | safe | 파일 읽기 (이미지, PDF, Jupyter 노트북 지원) |
| `file_write` | confirm | 파일 생성/덮어쓰기 |
| `file_edit` | confirm | 검색/치환 (diff 미리보기 포함) |
| `bash_exec` | confirm | 셸 명령어 실행 (120초 타임아웃) |
| `glob_search` | safe | 파일 패턴 매칭 |
| `grep_search` | safe | 정규식 콘텐츠 검색 (ripgrep 기반, JS 폴백) |
| `list_dir` | safe | 디렉토리 목록 + 메타데이터 |
| `web_fetch` | confirm | HTTP 요청 (15분 캐시) |
| `web_search` | confirm | 웹 검색 (Brave + DuckDuckGo) |
| `notebook_edit` | confirm | Jupyter 노트북 셀 편집 |
| `agent` | confirm | 서브에이전트 스폰 (explore/plan/general) |
| `todo_write` | safe | 작업 추적 |

**권한 레벨:**
- `safe` — 확인 없이 실행 (읽기 전용 작업)
- `confirm` — 사용자 승인 필요 (권한 모드에 따라 자동 승인 가능)

## 프로젝트 설정

### DBCODE.md

프로젝트 루트에 `DBCODE.md` 파일을 생성하면 AI에게 코드베이스 정보를 제공할 수 있습니다:

```bash
dbcode init    # DBCODE.md + .dbcode/ 디렉토리 생성
```

수동으로 만들 수도 있습니다:

```markdown
# DBCODE.md

## 프로젝트 개요
- 런타임: Node.js 20 / TypeScript
- 테스트: Jest
- 빌드: webpack

## 코딩 규칙
- named export만 사용
- 함수형 컴포넌트 우선
```

### 지시 우선순위 (낮은 순 → 높은 순)

1. `~/.dbcode/DBCODE.md` — 전역 사용자 지시
2. `~/.dbcode/rules/*.md` — 전역 규칙
3. 상위 디렉토리 `DBCODE.md` 파일들 (cwd에서 위로 탐색)
4. 프로젝트 루트 `DBCODE.md`
5. `.dbcode/rules/*.md` — 프로젝트 규칙
6. `DBCODE.local.md` — 로컬 오버라이드 (`.gitignore`에 추가 권장)

### 권한 모드

세션 중 `Shift+Tab`으로 순환:

| 모드 | 동작 |
|------|------|
| `default` | 위험한 작업만 확인 |
| `acceptEdits` | 파일 편집 자동 승인, bash는 확인 |
| `plan` | 읽기 전용 — AI가 변경을 제안하면 사용자가 승인 |
| `dontAsk` | 위험한 작업 외 전부 자동 승인 |
| `bypassPermissions` | 모든 작업 자동 승인 |

## 스킬 시스템

스킬은 마크다운 파일로 작성되며, dbcode에 커스텀 워크플로우를 추가합니다. 다음 경로에서 자동 로드됩니다:

```
.dbcode/commands/    # 프로젝트 명령어 (git으로 팀 공유)
.dbcode/skills/      # 프로젝트 스킬 (git으로 팀 공유)
~/.dbcode/commands/  # 전역 사용자 명령어
~/.dbcode/skills/    # 전역 사용자 스킬
```

### 스킬 만들기

`.dbcode/skills/my-skill/SKILL.md` 파일을 생성합니다:

```markdown
---
name: my-skill
description: X를 요청할 때 유용한 작업을 수행합니다
argument-hint: "[파일 경로]"
---

## 지시사항

이 스킬이 호출되면 다음을 수행합니다:

1. $ARGUMENTS 경로의 파일을 읽습니다
2. 패턴을 분석합니다
3. 결과를 보고합니다
```

스킬은 `/my-skill` 슬래시 명령어로 자동 등록됩니다.

### 프론트매터 옵션

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `name` | string | 필수 | 스킬 식별자 |
| `description` | string | 필수 | 트리거 조건 + 기능 설명 |
| `argument-hint` | string | — | 도움말에 표시되는 사용법 힌트 |
| `user-invocable` | boolean | `true` | `/name` 명령어로 사용 가능 여부 |
| `disable-model-invocation` | boolean | `false` | AI 자동 호출 방지 |
| `context` | `inline` / `fork` | `inline` | 실행 컨텍스트 |
| `agent` | `explore` / `plan` / `general` | — | 서브에이전트 타입 (`context: fork` 시) |
| `allowed-tools` | array | — | 이 스킬에서 사용 가능한 도구 화이트리스트 |

### 내장 스킬

| 스킬 | 설명 |
|------|------|
| `sprint-execution` | 개선 계획으로부터 Agent Teams를 활용한 병렬 팀 오케스트레이션 |
| `dbcode-e2e-test` | E2E 테스트 프레임워크 |
| `verify-implementation` | 전체 검증 스킬 일괄 실행 |
| `verify-model-capabilities` | 모델 캐퍼빌리티 동기화 검증 |
| `verify-tool-metadata-pipeline` | 도구 메타데이터 파이프라인 검증 |

## 아키텍처

```
CLI (Ink/React)  →  Core  →  LLM / Tools / Permissions / Hooks  →  Utils
```

엄격한 단방향 의존성 — 순환 임포트는 금지입니다.

```
src/
├── index.ts              # CLI 진입점 (Commander + Ink)
├── cli/                  # 터미널 UI (Ink 컴포넌트 + React 훅)
├── core/                 # 에이전트 루프, 컨텍스트/세션/체크포인트 매니저
├── llm/                  # LLM 클라이언트 (OpenAI 호환 + Anthropic)
├── tools/                # 16개 내장 도구 + 권한 시스템
├── commands/             # 34개 슬래시 명령어
├── skills/               # 스킬 로더, 실행기, 명령어 브릿지
├── config/               # 5단계 계층적 설정 (Zod 스키마)
├── permissions/          # 권한 매니저 (5가지 모드)
├── instructions/         # DBCODE.md 로더 (6단계 병합)
├── guardrails/           # 보안 (시크릿 스캐닝, I/O 필터링)
├── hooks/                # 도구 실행 전/후 훅
├── subagents/            # 에이전트 스폰 (worktree 격리)
├── mcp/                  # Model Context Protocol 연동
├── auth/                 # 토큰 기반 인증
└── utils/                # 로거(pino), 이벤트(mitt), 에러, 경로
```

### 핵심 설계 원칙

- **ESM 전용** — CommonJS 없음, 모든 임포트에 `.js` 확장자
- **불변 상태** — `readonly` 프로퍼티, 변경 시 스프레드 복사
- **Zod 스키마** — 모든 외부 입력 검증 (설정, 도구 파라미터, API 응답)
- **AbortController** — 취소 가능한 모든 작업에 AbortSignal 사용
- **`any` 금지** — 대신 `unknown` + 타입 가드 사용

## 개발 가이드

### 개발 환경 셋업

```bash
git clone https://github.com/bigbulgogiburger/dbcode.git
cd dbcode
npm install
```

### 주요 명령어

```bash
npm run dev            # 워치 모드 (변경 시 자동 리빌드)
npm run build          # 프로덕션 빌드 (tsup)
npm run typecheck      # TypeScript 타입 검사 (strict)
npm run lint           # ESLint 검사
npm run format         # Prettier 포맷팅
npm test               # 전체 테스트 실행 (Vitest)
npm run test:watch     # 테스트 워치 모드
npm run test:coverage  # 커버리지 리포트
npm run ci             # 전체 파이프라인: typecheck → lint → test:coverage → build
```

### 로컬 실행

```bash
npm run build
node bin/dbcode.mjs                    # 소스에서 실행
node bin/dbcode.mjs -p "Hello"         # 헤드리스 테스트
```

### 테스트

**Vitest**를 사용하며, 테스트 중 실제 LLM API 호출은 하지 않습니다 (모킹 사용).

```bash
npm test                                    # 전체 테스트
npx vitest run test/unit/llm/              # 특정 디렉토리
npx vitest run test/unit/tools/            # 도구 테스트만
npx vitest run --coverage                  # 커버리지 포함
```

**테스트 구조:**
```
test/
├── unit/          # 단위 테스트 (빠름, 격리됨)
│   ├── cli/       # 컴포넌트 + 렌더러 테스트
│   ├── core/      # 에이전트 루프, 컨텍스트 매니저
│   ├── llm/       # LLM 클라이언트 테스트
│   ├── tools/     # 도구 정의 테스트
│   ├── commands/  # 슬래시 명령어 테스트
│   ├── config/    # 설정 로더/스키마 테스트
│   └── utils/     # 유틸리티 테스트
├── integration/   # 통합 테스트
└── e2e/           # E2E CLI 테스트
```

### 커밋 규칙

```
<type>(<scope>): <description>
```

타입: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### 아키텍처 검증

```bash
npx madge --circular src/    # 순환 의존성 검사 (반드시 클린해야 함)
```

## 파일 위치

### 전역 (사용자별)

| 경로 | 용도 |
|------|------|
| `~/.dbcode/config.json` | 사용자 설정 |
| `~/.dbcode/debug.log` | 디버그 로그 |
| `~/.dbcode/sessions/` | 저장된 세션 |
| `~/.dbcode/input-history.json` | 입력 히스토리 (최대 500개, 세션 간 유지) |
| `~/.dbcode/keybindings.json` | 커스텀 키보드 단축키 |
| `~/.dbcode/memory/` | 영구 메모리 |
| `~/.dbcode/DBCODE.md` | 전역 지시 |
| `~/.dbcode/rules/*.md` | 전역 규칙 |
| `~/.dbcode/skills/` | 전역 스킬 |

### 프로젝트 (레포별)

| 경로 | 용도 |
|------|------|
| `DBCODE.md` | 프로젝트 지시 |
| `DBCODE.local.md` | 로컬 오버라이드 (gitignore) |
| `.dbcode/` | 프로젝트 설정 디렉토리 |
| `.dbcode/rules/*.md` | 프로젝트 규칙 |
| `.dbcode/skills/` | 프로젝트 스킬 |
| `.dbcode/memory/` | 프로젝트 메모리 |

## 지원 LLM 프로바이더

| 프로바이더 | Base URL | 비고 |
|-----------|----------|------|
| **OpenAI** | `https://api.openai.com/v1` | 기본 프로바이더 |
| **Azure OpenAI** | `https://{resource}.openai.azure.com/openai?api-version=...` | Codex 모델용 Responses API 지원 |
| **Anthropic** | 프록시 경유 | Claude 모델 Extended Thinking 지원 |
| **Ollama** | `http://localhost:11434/v1` | 로컬 모델 |
| **LM Studio** | `http://localhost:1234/v1` | 로컬 모델 |
| **vLLM** | `http://localhost:8000/v1` | 셀프 호스팅 추론 |
| **기타 OpenAI 호환** | 커스텀 URL | 호환 엔드포인트면 어디든 가능 |

## 라이선스

MIT
