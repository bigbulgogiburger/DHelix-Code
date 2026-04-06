# dhelix 코드베이스 온보딩 가이드

> 주니어 개발자를 위한 코드 읽기 가이드. 어디서부터, 어떤 순서로, 무엇을 봐야 하는지 설명합니다.

---

## 1. dhelix가 뭔가요?

dhelix는 **터미널에서 동작하는 AI 코딩 어시스턴트**입니다.

사용자가 터미널에 질문이나 명령을 입력하면, AI(LLM)가 코드를 읽고, 수정하고, 명령을 실행하면서 개발 작업을 도와줍니다. ChatGPT 같은 대화형 인터페이스이지만, **파일 시스템과 셸에 직접 접근**할 수 있다는 점이 다릅니다.

**기술 스택:**

- **Node.js 20+** / **TypeScript 5.x** / **ESM** (ES Modules)
- **Ink 5.x** — React를 터미널 UI로 렌더링하는 라이브러리
- **Vitest** — 테스트 프레임워크
- **tsup** — 빌드 도구

---

## 2. 아키텍처 한눈에 보기

코드는 **4개 레이어**로 나뉘며, **위에서 아래로만** 의존할 수 있습니다.

```
┌─────────────────────────────────────────────────┐
│  Layer 1: CLI (src/cli/)                        │
│  터미널 UI — React 컴포넌트, 훅, 렌더링          │
├─────────────────────────────────────────────────┤
│  Layer 2: Core (src/core/)                      │
│  비즈니스 로직 — Agent Loop, 컨텍스트 관리        │
│  ⚠️ UI를 절대 import하지 않음                    │
├─────────────────────────────────────────────────┤
│  Layer 3: Infrastructure                        │
│  src/llm/        LLM 클라이언트                  │
│  src/tools/      도구 시스템 (파일 읽기/쓰기 등)  │
│  src/permissions/ 권한 관리                      │
│  src/guardrails/  보안 가드레일                   │
│  src/mcp/        MCP 외부 도구 연동               │
├─────────────────────────────────────────────────┤
│  Layer 4: Leaf Modules                          │
│  src/config/     설정          src/utils/ 유틸   │
│  src/skills/     스킬 시스템   src/memory/ 메모리 │
└─────────────────────────────────────────────────┘
```

**핵심 규칙:** Layer 3은 Layer 1을 import할 수 없고, Layer 4는 Layer 1~2를 import할 수 없습니다.
이렇게 하면 각 레이어를 **독립적으로 테스트**할 수 있습니다.

---

## 3. 코드 읽기 로드맵

아래 순서로 읽으면 자연스럽게 전체 구조를 이해할 수 있습니다.

### Phase 1: 진입점 — "프로그램이 어떻게 시작하나?"

| 순서 | 파일             | 왜 봐야 하나                                                                                                       |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | `bin/dhelix.mjs` | 실제 실행 파일. `node bin/dhelix.mjs`로 프로그램 시작                                                              |
| 2    | `src/index.ts`   | **부트스트랩 전체 과정**. 설정 로딩 → LLM 클라이언트 생성 → 도구 등록 → UI 렌더링까지 10단계를 순서대로 볼 수 있음 |

`src/index.ts`를 읽으면 프로젝트의 모든 주요 모듈이 어디서 어떻게 조립되는지 한눈에 보입니다.

### Phase 2: AI의 두뇌 — "AI가 어떻게 생각하고 행동하나?"

| 순서 | 파일                                | 왜 봐야 하나                                                                |
| ---- | ----------------------------------- | --------------------------------------------------------------------------- |
| 3    | `src/core/agent-loop.ts`            | **가장 중요한 파일.** AI의 사고 루프(ReAct 패턴) 구현. 아래에서 자세히 설명 |
| 4    | `src/core/system-prompt-builder.ts` | AI에게 "너는 이런 역할이야"라고 알려주는 시스템 프롬프트 조립기             |
| 5    | `src/core/context-manager.ts`       | 대화가 길어지면 토큰을 어떻게 관리하는지 — 3단계 압축 전략                  |

### Phase 3: 도구 시스템 — "AI가 어떻게 파일을 읽고 쓰나?"

| 순서 | 파일                                    | 왜 봐야 하나                                                |
| ---- | --------------------------------------- | ----------------------------------------------------------- |
| 6    | `src/tools/types.ts`                    | `ToolDefinition` 인터페이스 — 모든 도구의 공통 구조         |
| 7    | `src/tools/definitions/` 아무 파일 하나 | 실제 도구 구현 예시 (예: `file-read.ts`)                    |
| 8    | `src/tools/registry.ts`                 | 모든 도구를 등록하고 관리하는 중앙 레지스트리               |
| 9    | `src/tools/executor.ts`                 | 도구 실행 파이프라인: 검증 → 권한 확인 → 실행 → 결과 필터링 |

### Phase 4: LLM 통신 — "어떻게 AI 모델과 대화하나?"

| 순서 | 파일                            | 왜 봐야 하나                                             |
| ---- | ------------------------------- | -------------------------------------------------------- |
| 10   | `src/llm/provider.ts`           | LLM 요청/응답 타입 정의 (ChatMessage, ChatRequest 등)    |
| 11   | `src/llm/client.ts`             | OpenAI 호환 API 클라이언트 — 스트리밍, 재시도, 에러 처리 |
| 12   | `src/llm/model-capabilities.ts` | 모델별 기능 차이 (어떤 모델이 thinking을 지원하는지 등)  |

### Phase 5: UI — "터미널에 어떻게 표시하나?"

| 순서 | 파일                            | 왜 봐야 하나                                  |
| ---- | ------------------------------- | --------------------------------------------- |
| 13   | `src/cli/App.tsx`               | 루트 React 컴포넌트 — 모든 UI가 여기서 조합됨 |
| 14   | `src/cli/hooks/useAgentLoop.ts` | Agent Loop을 React와 연결하는 핵심 훅         |
| 15   | `src/cli/components/` 둘러보기  | MessageList, UserInput, ToolCallBlock 등      |

### Phase 6: 나머지 시스템 (필요할 때 읽기)

| 영역         | 시작 파일                    | 설명                                                                 |
| ------------ | ---------------------------- | -------------------------------------------------------------------- |
| 권한         | `src/permissions/manager.ts` | 사용자에게 "이 작업 허용할까요?" 물어보는 시스템                     |
| 설정         | `src/config/loader.ts`       | 5단계 설정 병합 (기본값 → 사용자 → 프로젝트 → 환경변수 → CLI 플래그) |
| 보안         | `src/guardrails/`            | 비밀키 스캔, 위험한 명령 차단, 프롬프트 인젝션 방어                  |
| MCP          | `src/mcp/client.ts`          | 외부 MCP 서버 연동 (JSON-RPC 2.0)                                    |
| 스킬         | `src/skills/manager.ts`      | `/commit`, `/debug` 같은 슬래시 명령 시스템                          |
| 서브에이전트 | `src/subagents/spawner.ts`   | 하위 에이전트 생성 및 병렬 실행                                      |
| 메모리       | `src/memory/manager.ts`      | 대화 간 기억 저장 (~/.dhelix/projects/)                              |

---

## 4. Agent Loop 상세 — 이 프로젝트의 심장

dhelix의 핵심 동작 원리는 **ReAct (Reasoning + Acting) 패턴**입니다.

```
사용자 입력
   │
   ▼
┌──────────────────────────┐
│ 시스템 프롬프트 구성       │  ← DHELIX.md + 스킬 + 메모리 + 레포 맵
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐
│ LLM 호출 (스트리밍)       │  ← OpenAI 호환 API
└──────────┬───────────────┘
           ▼
    ┌──────┴──────┐
    │ 도구 호출?   │
    └──────┬──────┘
      No   │   Yes
       │   ▼
       │  ┌────────────────────┐
       │  │ 권한 확인            │  ← 사용자에게 허용 여부 질문
       │  ├────────────────────┤
       │  │ 입력 가드레일        │  ← 위험한 명령/경로 차단
       │  ├────────────────────┤
       │  │ 도구 실행            │  ← 파일 읽기, 셸 실행 등
       │  ├────────────────────┤
       │  │ 출력 가드레일        │  ← 비밀키 스캔, 크기 제한
       │  ├────────────────────┤
       │  │ 결과를 LLM에 전달    │
       │  └────────┬───────────┘
       │           │
       │           ▼
       │  ┌────────────────────┐
       │  │ 서킷 브레이커 검사   │  ← 무한 루프 방지 (최대 50회)
       │  └────────┬───────────┘
       │           │
       │           ▼
       │      LLM 재호출 ───→ (반복)
       │
       ▼
  최종 응답 반환
```

**한 문장으로:** AI가 "생각 → 행동 → 관찰 → 생각 → ..."을 반복하면서 문제를 해결합니다.

---

## 5. 주요 구현 목록

### 5.1 도구 (Tools) — AI가 할 수 있는 행동들

| 도구            | 권한 수준 | 하는 일                         |
| --------------- | --------- | ------------------------------- |
| `file_read`     | safe      | 파일 내용 읽기                  |
| `file_write`    | confirm   | 새 파일 생성 또는 전체 덮어쓰기 |
| `file_edit`     | confirm   | 파일 부분 수정 (old → new 교체) |
| `bash_exec`     | confirm   | 셸 명령 실행                    |
| `glob_search`   | safe      | 파일명 패턴으로 검색 (\*.ts 등) |
| `grep_search`   | safe      | 파일 내용에서 텍스트 검색       |
| `list_dir`      | safe      | 디렉토리 목록 조회              |
| `web_fetch`     | confirm   | URL에서 웹 페이지 가져오기      |
| `web_search`    | confirm   | 웹 검색                         |
| `ask_user`      | safe      | 사용자에게 질문하기             |
| `notebook_edit` | confirm   | Jupyter 노트북 셀 편집          |
| `mkdir`         | confirm   | 디렉토리 생성                   |
| `agent`         | confirm   | 하위 에이전트 생성              |
| `todo_write`    | safe      | 태스크 목록 관리                |

### 5.2 슬래시 명령어 — 사용자가 직접 쓰는 명령

| 명령         | 설명                      |
| ------------ | ------------------------- |
| `/help`      | 도움말                    |
| `/model`     | LLM 모델 변경             |
| `/compact`   | 컨텍스트 수동 압축        |
| `/cost`      | API 비용 확인             |
| `/clear`     | 대화 초기화               |
| `/resume`    | 이전 세션 복원            |
| `/init`      | 프로젝트에 DHELIX.md 생성 |
| `/commit`    | Git 커밋 생성             |
| `/debug`     | 디버깅 모드               |
| `/plan`      | Plan 모드 (실행 전 확인)  |
| `/diff`      | 변경사항 비교             |
| `/mcp`       | MCP 서버 관리             |
| `/memory`    | 메모리 관리               |
| `/doctor`    | 설정 진단                 |
| `/stats`     | 세션 통계                 |
| `/analytics` | 상세 분석 대시보드        |

### 5.3 권한 시스템 — 5단계 모드

```
default       사용자에게 매번 확인 (기본값)
acceptEdits   파일 수정은 자동 허용
plan          실행 전 계획만 보여줌 (dry-run)
dontAsk       모든 작업 자동 허용
bypassPermissions  제한 없음
```

권한 판단 순서: 영구 거부 → 세션 승인 → 영구 허용 → 명시적 규칙 → 모드 기반

### 5.4 컨텍스트 관리 — 대화가 길어져도 동작하게

| 단계          | 언제          | 무엇을                                 |
| ------------- | ------------- | -------------------------------------- |
| 마이크로 압축 | 상시          | 큰 도구 출력(200토큰+)을 디스크로 이동 |
| 자동 압축     | 83.5% 도달 시 | 오래된 대화를 요약으로 교체            |
| 재수화        | 압축 후       | 최근 수정한 파일 내용 다시 로드        |

### 5.5 LLM 클라이언트 — 다양한 모델 지원

- **OpenAI 호환 API**: GPT-4o, Claude, Ollama, vLLM, llama.cpp 등
- **Responses API**: o1, o3 모델 전용
- 자동 재시도 (지수 백오프), 429 Rate Limit 핸들링
- 스트리밍 지원 (실시간 글자 출력)
- 모델별 기능 자동 감지 (thinking 지원 여부 등)

### 5.6 보안 가드레일

| 가드레일                | 방어 대상                                      |
| ----------------------- | ---------------------------------------------- |
| `secret-scanner.ts`     | API 키, 비밀번호 등 유출 방지                  |
| `entropy-scanner.ts`    | 고엔트로피 문자열 (잠재적 비밀키) 감지         |
| `command-filter.ts`     | `rm -rf /`, `dd` 등 위험 명령 차단             |
| `path-filter.ts`        | `/etc/passwd`, `~/.ssh` 등 민감 경로 접근 차단 |
| `injection-detector.ts` | 프롬프트 인젝션 시도 감지                      |
| `output-limiter.ts`     | 도구 출력 크기 제한                            |

### 5.7 MCP (Model Context Protocol) 연동

외부 MCP 서버와 JSON-RPC 2.0으로 통신하여 도구를 확장합니다.

- stdio, HTTP, SSE 3가지 전송 방식 지원
- 외부 도구를 내부 도구처럼 등록하여 사용
- OAuth 인증 지원

### 5.8 스킬 시스템

마크다운 파일로 정의된 재사용 가능한 프롬프트 템플릿입니다.

```markdown
---
name: "debug"
userInvocable: true
---

문제를 단계적으로 디버깅해주세요...
```

4개 디렉토리에서 로드: `~/.dhelix/skills/`, `~/.dhelix/commands/`, `.dhelix/skills/`, `.dhelix/commands/`

### 5.9 서브에이전트

복잡한 작업을 하위 에이전트에게 위임합니다.

- `explore` — 코드베이스 탐색 전용
- `plan` — 구현 계획 수립
- `general` — 범용 작업 처리
- Git worktree 격리 실행 지원
- 백그라운드/병렬 실행 가능

---

## 6. 핵심 디자인 패턴

### 6.1 Named Export Only

```typescript
// ✅ Good
export function createClient() { ... }
export const DEFAULT_MODEL = 'gpt-4o-mini';

// ❌ Bad
export default function createClient() { ... }
```

### 6.2 Immutable State

```typescript
// ✅ Good — 새 객체를 만들어서 반환
const updated = { ...state, count: state.count + 1 };

// ❌ Bad — 직접 변경
state.count += 1;
```

### 6.3 ESM Import with .js Extension

```typescript
// ✅ Good
import { logger } from "./utils/logger.js";

// ❌ Bad
import { logger } from "./utils/logger";
```

### 6.4 Zod로 외부 입력 검증

```typescript
import { z } from "zod";

const FileReadParams = z.object({
  path: z.string().describe("읽을 파일 경로"),
  offset: z.number().optional(),
  limit: z.number().optional(),
});
```

### 6.5 AbortController로 취소 처리

```typescript
const controller = new AbortController();
await fetchFromLLM(prompt, { signal: controller.signal });
// 사용자가 Esc 누르면 → controller.abort()
```

---

## 7. 개발 환경 세팅 & 자주 쓰는 명령어

```bash
# 의존성 설치
npm install

# 개발 모드 (파일 변경 감지)
npm run dev

# 빌드
npm run build

# 테스트 실행
npm test

# 타입 체크만
npm run typecheck

# 린트
npm run lint

# 전체 검증 (typecheck + lint + test + build)
npm run check
```

---

## 8. 테스트 구조

```
test/
├── unit/           # 단위 테스트 — 모듈 하나씩 테스트
├── integration/    # 통합 테스트 — 여러 모듈 조합 테스트
├── e2e/            # E2E 테스트 — 전체 시나리오
├── fixtures/       # 테스트용 데이터
└── mocks/          # Mock 객체 (OpenAI 등)
```

테스트 파일은 소스와 같은 구조로 배치됩니다.
예: `src/tools/executor.ts` → `test/unit/tools/executor.test.ts`

---

## 9. 설정 파일 위치

| 파일                         | 용도                               |
| ---------------------------- | ---------------------------------- |
| `DHELIX.md` (프로젝트 루트)  | 프로젝트별 AI 지시사항             |
| `DHELIX.local.md`            | 로컬 전용 (gitignored)             |
| `.dhelix/settings.json`      | 프로젝트 설정                      |
| `~/.dhelix/settings.json`    | 사용자 전역 설정                   |
| `~/.dhelix/config.json`      | 사용자 전역 설정 (모델, API 키 등) |
| `~/.dhelix/keybindings.json` | 키보드 단축키 커스터마이징         |
| `~/.dhelix/mcp.json`         | MCP 서버 설정                      |

---

## 10. "처음 코드를 고치고 싶다면" 실전 가이드

### 새 도구(Tool) 추가하기

1. `src/tools/definitions/`에 새 파일 생성
2. `ToolDefinition` 인터페이스에 맞게 구현
3. `src/tools/registry.ts`에서 등록
4. `test/unit/tools/`에 테스트 추가

### 새 슬래시 명령어 추가하기

1. `src/commands/`에 새 파일 생성
2. `SlashCommand` 인터페이스에 맞게 구현
3. `src/commands/registry.ts`에서 등록

### 새 UI 컴포넌트 추가하기

1. `src/cli/components/`에 React 컴포넌트 생성 (Ink 사용)
2. `src/cli/App.tsx`에서 조합

### 새 LLM 프로바이더 추가하기

1. `src/llm/providers/`에 새 파일 생성
2. `src/llm/provider.ts`의 인터페이스 구현
3. `src/llm/model-router.ts`에서 라우팅 추가

---

## 11. 용어 정리

| 용어                | 의미                                                        |
| ------------------- | ----------------------------------------------------------- |
| **Agent Loop**      | AI가 "생각→행동→관찰"을 반복하는 메인 루프                  |
| **ReAct**           | Reasoning + Acting 패턴. AI가 추론하고 도구를 호출하는 방식 |
| **Tool**            | AI가 실행할 수 있는 기능 단위 (파일 읽기, 셸 실행 등)       |
| **MCP**             | Model Context Protocol. 외부 도구를 표준 프로토콜로 연결    |
| **Guardrail**       | 위험한 행동을 자동으로 차단하는 안전 장치                   |
| **Circuit Breaker** | 무한 루프를 감지하고 멈추는 보호 장치                       |
| **Compaction**      | 대화가 길어졌을 때 토큰을 줄이기 위한 요약 처리             |
| **Cold Storage**    | 큰 도구 출력을 디스크에 저장하고 참조만 남기는 것           |
| **Skill**           | 마크다운으로 정의된 재사용 가능한 프롬프트                  |
| **Ink**             | React를 터미널에서 렌더링하는 라이브러리                    |
| **Subagent**        | 복잡한 작업을 분담하기 위해 생성되는 하위 AI 에이전트       |
| **Dual-Model**      | 계획용/실행용 모델을 분리하여 사용하는 패턴                 |

---

## 더 깊이 보고 싶다면

| 문서                   | 경로                                             |
| ---------------------- | ------------------------------------------------ |
| 디렉토리 구조 상세     | `.claude/docs/reference/directory-structure.md`  |
| 아키텍처 심층 분석     | `.claude/docs/reference/architecture-deep.md`    |
| 인터페이스 & 도구 상세 | `.claude/docs/reference/interfaces-and-tools.md` |
| 설정 시스템            | `.claude/docs/reference/config-system.md`        |
| 스킬 & 명령어          | `.claude/docs/reference/skills-and-commands.md`  |
| 코딩 컨벤션            | `.claude/docs/reference/coding-conventions.md`   |
