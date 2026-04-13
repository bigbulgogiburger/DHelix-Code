# DHelix Code Deep Dive Analysis

> **2026-04-06** | Anthropic Claude Code Senior Developer 관점 심층 분석
> 4개 전문 감사 에이전트 병렬 실행 결과 종합

---

## Executive Summary

DHelix Code는 **아키텍처 설계 수준**에서는 경쟁사(Claude Code, OpenCode, Codex, Gemini CLI)와 대등하거나 우세하지만, **실제 런타임 연결(wiring)**과 **사용자 접점(UI/UX, IDE, 온보딩)**에서 격차가 존재합니다.

| 지표            | 현재 상태                                  |
| --------------- | ------------------------------------------ |
| 총 소스 LOC     | 106,317                                    |
| 소스 파일 수    | 384                                        |
| 테스트 파일 수  | 315 (6,475 tests)                          |
| 테스트 커버리지 | 80.11% (목표 85%)                          |
| 모듈 연결 상태  | 10개 중 3개 연결, 4개 미연결, 3개 부분연결 |

---

## 1. Wiring 미연결 영역

### 1.1 연결 상태 매트릭스

| #   | 모듈                                 | 상태         | 심각도   | 영향                                                    |
| --- | ------------------------------------ | ------------ | -------- | ------------------------------------------------------- |
| 1   | RuntimePipeline → agent-loop.ts      | **미연결**   | CRITICAL | 9-stage pipeline이 실제 동작하지 않음                   |
| 2   | ToolPipeline → agent-loop.ts         | **부분연결** | HIGH     | 함수 정의됨, 호출 안 됨                                 |
| 3   | ProviderRegistry → client-factory.ts | **연결됨**   | -        | 정상 동작                                               |
| 4   | 신규 도구 4개 → tool registry        | **미연결**   | HIGH     | apply_patch, batch_file_ops, code_mode, refactor 미등록 |
| 5   | Plugin system → hooks/tools          | **미연결**   | HIGH     | PluginRegistry 초기화 진입점 없음                       |
| 6   | Dashboard → core modules             | **미연결**   | MEDIUM   | 데이터 소스 미구현, CLI 명령 없음                       |
| 7   | Cloud runtime → subagents            | **미연결**   | LOW      | Job queue 관리 미구현                                   |
| 8   | MCP health monitor → MCP manager     | **미연결**   | MEDIUM   | 자동 재연결 미실행                                      |
| 9   | Hook event adapter → AppEventEmitter | **부분연결** | MEDIUM   | createHookAdapter() 미호출                              |
| 10  | Skill manifest/composer → loader     | **부분연결** | LOW      | Composer 미사용                                         |

### 1.2 핵심 문제: agent-loop.ts가 파이프라인을 사용하지 않음

```
현재:
  agent-loop.ts (1,302 LOC monolith)
    └── while 루프 직접 실행
        └── executeToolCall() 단건 호출

설계 의도:
  agent-loop.ts (~100 LOC wrapper)
    └── RuntimePipeline.executeIteration()
        ├── prepare-context
        ├── compact-context
        ├── resolve-tools
        ├── sample-llm
        ├── extract-calls
        ├── preflight-policy
        ├── execute-tools (→ ToolPipeline)
        ├── persist-results
        └── evaluate-continuation
```

### 1.3 Wiring 수정 우선순위

| 순위 | 작업                                  | 난이도 | 예상 시간 |
| ---- | ------------------------------------- | ------ | --------- |
| 1    | 신규 도구 4개 registry 등록           | 쉬움   | 10분      |
| 2    | MCP health monitor → manager 통합     | 쉬움   | 30분      |
| 3    | Hook event adapter 초기화             | 쉬움   | 20분      |
| 4    | ToolPipeline → agent-loop 통합        | 중간   | 2시간     |
| 5    | RuntimePipeline → agent-loop 리팩토링 | 높음   | 1일       |
| 6    | Plugin system 초기화                  | 중간   | 2시간     |
| 7    | Dashboard 데이터소스 구현             | 중간   | 4시간     |

---

## 2. 추가 개발 필요 영역

### 2.1 경쟁사 대비 기능 격차

| 기능            | Claude Code            | OpenCode       | Codex           | Gemini           | DHelix         | 격차     |
| --------------- | ---------------------- | -------------- | --------------- | ---------------- | -------------- | -------- |
| Tool 수         | ~24                    | ~7             | 비공개          | ~12              | 29             | **우세** |
| Provider 수     | 1                      | 75+            | 1               | 1                | 8              | 우세     |
| TUI 성능        | Screen buffer 최적화   | Zig+60fps      | Rust native     | TS 기본          | Ink 5.x        | **열세** |
| Diff viewer     | StructuredDiff + /diff | 전용 컴포넌트  | 기본            | 기본             | 201줄 기본     | **열세** |
| IDE 확장        | VS Code 공식           | 없음           | 없음            | VS Code          | 개발중         | **열세** |
| 이미지 붙여넣기 | 지원                   | 없음           | 멀티모달        | Alt+V            | 미지원         | 열세     |
| 무료 접근성     | 유료                   | 무료 모델 포함 | 유료            | 1000req/day 무료 | 로컬 가능      | 중간     |
| 온보딩          | /powerup 레슨          | 없음           | 없음            | 없음             | setup-wizard만 | 열세     |
| Session 공유    | 없음                   | URL 공유       | cloud traces    | 없음             | 없음           | 열세     |
| MCP Server 모드 | 클라이언트             | 클라이언트     | 서버+클라이언트 | 클라이언트       | 클라이언트     | 열세     |

### 2.2 즉시 개발 필요 항목

| #   | 항목                                                    | 우선순위 | 예상 LOC |
| --- | ------------------------------------------------------- | -------- | -------- |
| 1   | VS Code Extension 완성 (vscode-extension/ 미완성)       | P0       | +2,000   |
| 2   | DiffViewer 고도화 (side-by-side, syntax highlight 강화) | P0       | +500     |
| 3   | 로컬 모델 원클릭 설정 (Ollama auto-detect + 가이드)     | P1       | +300     |
| 4   | 이미지 붙여넣기 (멀티모달 입력)                         | P1       | +400     |
| 5   | /powerup 인터랙티브 온보딩                              | P1       | +500     |
| 6   | Session URL 공유                                        | P2       | +300     |
| 7   | MCP Server 모드 (자체를 MCP 서버로 노출)                | P2       | +500     |

---

## 3. 리팩토링 필요 영역

### 3.1 초대형 파일 (1,000 LOC+)

| 파일                       | LOC   | 문제                                   | 권장                           |
| -------------------------- | ----- | -------------------------------------- | ------------------------------ |
| `agent-loop.ts`            | 1,302 | 핵심 로직 집중, RuntimePipeline 미적용 | **Pipeline으로 분해** (최우선) |
| `code-outline.ts`          | 1,278 | AST 분석 + 렌더링 혼합                 | 분석/렌더링 분리               |
| `context-manager.ts`       | 1,274 | 압축+저장+토큰관리 혼합                | 3개 모듈로 분리                |
| `spawner.ts`               | 1,202 | 서브에이전트 생성+실행+관리            | 생성/실행/관리 분리            |
| `anthropic.ts`             | 1,118 | 프로바이더 단독                        | Base provider 클래스 추출      |
| `template-generator.ts`    | 1,077 | 프로젝트 템플릿                        | 템플릿별 분리                  |
| `system-prompt-builder.ts` | 1,073 | 동적 프롬프트                          | 섹션별 빌더 분리               |
| `tool-display.ts`          | 1,028 | 모든 도구 렌더링                       | **도구별 렌더러 분리**         |

### 3.2 아키텍처 강점 (유지)

- 순환 의존성 0건 (`madge --circular` 통과)
- 4-Layer 구조 건전 (CLI → Core → Infra → Leaf)
- Zod 기반 타입 안전 설정
- Named exports only 규칙 준수

---

## 4. Terminal GUI/UX — Claude Code 최신 대비 부족한 점

### 4.1 현재 구현 완성도

| 항목                                | 상태 | 평가 |
| ----------------------------------- | ---- | ---- |
| ShellLayout 구조화                  | 완성 | 5/5  |
| 토큰 사용량 실시간 표시             | 완성 | 5/5  |
| 모델 선택 UI                        | 완성 | 5/5  |
| 권한 프롬프트 (5-mode cycle)        | 완성 | 5/5  |
| 내장 명령어 (42개)                  | 완성 | 5/5  |
| 입력 (자동완성, 히스토리, 멀티라인) | 완성 | 5/5  |
| 코드 하이라이트 (Shiki)             | 완성 | 4/5  |
| 에러 표시 (ErrorBanner)             | 완성 | 4/5  |
| 접근성 (키보드, 스크린리더)         | 부분 | 3/5  |

### 4.2 Claude Code 최신 대비 부족한 점

| 영역                | Claude Code                                          | DHelix                    | 격차                           |
| ------------------- | ---------------------------------------------------- | ------------------------- | ------------------------------ |
| **렌더링 성능**     | Screen buffer + typed-array 최적화                   | Ink 기본 렌더러           | **큼** — 대용량 출력 시 체감   |
| **Diff 표시**       | StructuredDiff + /diff 전용 뷰어 + 파일별 네비게이션 | 201줄 기본 인라인 diff    | **큼** — 코딩 에이전트 핵심 UX |
| **Command Palette** | Ctrl+P 기반 검색 + 카테고리                          | SlashCommandMenu만        | 중간                           |
| **Agent 전환**      | @agent 멘션 + 탭 전환                                | AgentTabs 구현됨 (미연결) | 중간                           |
| **Progress 표시**   | 단계별 진행 상태 + 예상 시간                         | Spinner + StatusBar       | 중간                           |
| **이미지 입력**     | 클립보드 붙여넣기 지원                               | 미지원                    | 높음                           |
| **Context 시각화**  | 토큰 바 + 파일 목록                                  | 텍스트 기반               | 중간                           |

---

## 5. Skill-Creator 개발 계획

### 5.1 현재 스킬 시스템 현황

- **12개 스킬** 완전 구현 (빈 파일 0개)
- **로딩 파이프라인**: 파일 읽기 → frontmatter 파싱 → Zod 검증 → body 추출
- **실행 파이프라인**: 동적 컨텍스트 → 변수 치환 → 실행 결과 반환
- **SkillManifest + Composer**: 타입 검증 + DAG 실행 (v0.5에서 구현)

### 5.2 Skill-Creator 기능 요구사항

```
Phase 1: 기본 생성 (P0)
├── /skill create <name> — 인터랙티브 스킬 생성 위저드
│   ├── 이름, 설명, 컨텍스트 모드 입력
│   ├── frontmatter 자동 생성
│   ├── 본문 템플릿 제공
│   └── SKILL.md 파일 저장
├── /skill validate <path> — 스킬 유효성 검증
│   ├── Zod 스키마 검증
│   ├── 참조 도구 존재 확인
│   └── 의존성 검사
└── /skill test <path> — 스킬 드라이런 테스트

Phase 2: 고도화 (P1)
├── /skill list — 모든 스킬 목록 + 상태
├── /skill edit <name> — 기존 스킬 수정
├── /skill compose — 여러 스킬 조합 (Composer 활용)
└── /skill export — 스킬 패키지 내보내기

Phase 3: 커뮤니티 (P2)
├── /skill install <url> — 원격 스킬 설치
├── /skill share — 스킬 공유
└── /skill marketplace — 스킬 검색/발견
```

### 5.3 구현 예상

| 컴포넌트           | 파일                      | LOC        | 기존 인프라                 |
| ------------------ | ------------------------- | ---------- | --------------------------- |
| SkillBuilder class | `src/skills/builder.ts`   | +200       | manifest.ts 재사용          |
| SkillValidator     | `src/skills/validator.ts` | +150       | loader.ts + types.ts 재사용 |
| SkillTester        | `src/skills/tester.ts`    | +150       | executor.ts 재사용          |
| /skill 명령어      | `src/commands/skill.ts`   | +200       | 기존 명령어 패턴            |
| 스킬 템플릿        | `src/skills/templates/`   | +300       | -                           |
| **합계**           |                           | **~1,000** | 80% 인프라 완성             |

---

## 6. 껍데기 Commands/Skills 점검

### 6.1 Commands: 모두 실질적 구현

- **45개 명령어 파일**, 0개 스텁
- 분류:
  - **프롬프트 생성** (14개): `/batch`, `/simplify`, `/debug`, `/plan` 등 → LLM에 구조화된 프롬프트 주입
  - **상태 변경** (12개): `/fork`, `/tone`, `/voice`, `/model` 등 → 시스템 상태 직접 변경
  - **정보 조회** (10개): `/help`, `/config`, `/context`, `/cost` 등
  - **실행 제어** (9개): `/clear`, `/compact`, `/export`, `/agents` 등

### 6.2 Skills: 12개 모두 완전 구현

- 빈 파일/placeholder: **0개**
- 모든 스킬이 유효한 frontmatter + 실질적 본문 포함

### 6.3 미등록 신규 도구 (4개)

| 도구             | 파일                                      | 상태                        |
| ---------------- | ----------------------------------------- | --------------------------- |
| `apply_patch`    | `src/tools/definitions/apply-patch.ts`    | 정의됨, **registry 미등록** |
| `batch_file_ops` | `src/tools/definitions/batch-file-ops.ts` | 정의됨, **registry 미등록** |
| `code_mode`      | `src/tools/definitions/code-mode.ts`      | 정의됨, **registry 미등록** |
| `refactor`       | `src/tools/definitions/refactor.ts`       | 정의됨, **registry 미등록** |

---

## 7. Sub-Agent 가동 여부

### 7.1 판정: 완전 가동

| 컴포넌트               | 상태     | 핵심 증거                                       |
| ---------------------- | -------- | ----------------------------------------------- |
| spawner.ts             | **가동** | `runAgentLoop()` 직접 호출 → 독립 LLM 세션 생성 |
| team-manager.ts        | **가동** | 위상 정렬 + maxConcurrency 병렬 실행            |
| message-bus.ts         | **가동** | P2P 메시징 + topic glob + waitForReply          |
| orchestration-store.ts | **가동** | 6종 이벤트 소싱 (인메모리)                      |
| agent-manifest.ts      | **가동** | 8개 built-in manifest 정의 + 검증               |

### 7.2 서브에이전트 실행 흐름

```
spawnSubagent(config)
  ├── 도구 필터링 (allowedTools + blocklist)
  ├── 모델 결정 (modelOverride → resolveModelForSubagent)
  ├── 시스템 프롬프트 로드
  ├── runAgentLoop() ← 독립 LLM 세션
  │   ├── 독립 EventEmitter
  │   ├── 독립 ContextManager
  │   └── 5분 타임아웃
  ├── 결과 수집 (AgentLoopResult)
  └── 히스토리 영속화 (~/.dhelix/agent-history/)
```

### 7.3 팀 실행 흐름

```
AgentTeamManager.executeTeam(teamId, executor)
  ├── 위상 정렬 (Kahn 알고리즘)
  ├── Level 1: 독립 멤버 병렬 실행
  ├── Level 2: 의존성 충족 후 실행
  ├── 실패 전파: 한 멤버 실패 → 후속 멤버 자동 취소
  └── 결과 수집: TeamMemberResult[]
```

---

## 8. Tool Call — 최신 Coding Agent 대비 비교

### 8.1 Tool 수 비교

| Agent       | Built-in Tools | DHelix 차이            |
| ----------- | -------------- | ---------------------- |
| Claude Code | ~24            | DHelix 29개로 **우세** |
| OpenCode    | ~7             | DHelix **대폭 우세**   |
| Codex CLI   | 비공개 (소수)  | DHelix **우세**        |
| Gemini CLI  | ~12            | DHelix **우세**        |

### 8.2 Tool Call 패턴 비교

| 패턴                 | 경쟁사 현황                        | DHelix 현황                                      | 평가                     |
| -------------------- | ---------------------------------- | ------------------------------------------------ | ------------------------ |
| Deferred Loading     | Claude Code: `defer_loading: true` | lazy-tool-loader.ts                              | **동등**                 |
| Tool Call Correction | 일부 내장                          | tool-call-corrector.ts (Levenshtein/JSON repair) | **동등**                 |
| Adaptive Schema      | 없음                               | model-capabilities 기반 스키마 조정              | **DHelix 고유 강점**     |
| Hot Tool Loading     | 없음                               | 6개 핵심 도구 즉시, 나머지 lazy                  | **DHelix 고유 강점**     |
| Parallel Execution   | Claude Code 지원                   | Pipeline scheduler 정의됨 (미연결)               | **부분**                 |
| 4-Stage Pipeline     | 없음                               | preflight→schedule→execute→postprocess           | **DHelix 고유** (미연결) |
| Error Hierarchy      | 기본                               | 10-kind classifyError + RetryEngine              | **DHelix 우세**          |
| Streaming            | 기본                               | ToolStreamEmitter + SSE 어댑터                   | **동등**                 |

### 8.3 Tool 등록률

- 정의된 도구: **29개** (definitions/ 디렉토리)
- 실제 등록된 도구: **25개** (index.ts registerAll)
- 미등록 도구: **4개** (apply_patch, batch_file_ops, code_mode, refactor)
- **등록률: 86%** (→ 100% 필요)

---

## 9. 사용자 경험 (UX) 불편 사항

### 9.1 현재 UX 강점

| 항목                  | 구현 상태 | 비고              |
| --------------------- | --------- | ----------------- |
| 히스토리 탐색 (↑↓)    | 완성      | -                 |
| 탭 파일 자동완성      | 완성      | -                 |
| @ 파일 멘션           | 완성      | -                 |
| 다중 줄 입력 (Ctrl+J) | 완성      | -                 |
| Emacs 스타일 편집     | 완성      | Ctrl+A/E/K/U/W    |
| 슬래시 명령어 메뉴    | 완성      | 42개 명령어       |
| 토큰 사용량 표시      | 완성      | 실시간 + 80% 경고 |
| 비용 계산             | 완성      | 모델별 가격 기반  |

### 9.2 개선 필요 UX

| #   | 불편 사항                          | 심각도 | 개선 방안                                   |
| --- | ---------------------------------- | ------ | ------------------------------------------- |
| 1   | 한국어 IME 이슈 (Shift+Enter 불가) | HIGH   | Ctrl+J 대안 존재하나 비직관적               |
| 2   | 로컬 모델 설정 복잡                | HIGH   | 원클릭 Ollama 감지 + 가이드 UI              |
| 3   | Diff 표시 기본적                   | HIGH   | side-by-side, hunk navigation, apply/reject |
| 4   | 이미지 입력 미지원                 | MEDIUM | 클립보드 붙여넣기 + 파일 경로 drag          |
| 5   | 온보딩/튜토리얼 부재               | MEDIUM | /powerup 인터랙티브 레슨                    |
| 6   | IDE 통합 미완성                    | HIGH   | VS Code Extension 완성 필요                 |
| 7   | 대용량 출력 시 느림                | MEDIUM | windowed rendering (구현됨, 연결 필요)      |
| 8   | Context 시각화 부족                | LOW    | 파일 목록 + 토큰 바 시각화                  |

---

## 10. 기타 개발/고도화 사항

### 10.1 테스트 커버리지 갭

```
현재: 80.11% (Statements)
목표: 85%+
갭:   4.89% 포인트
```

커버리지 부족 영역:

- CLI 컴포넌트 (tsx 파일 테스트 제외 설정)
- 서브에이전트 시스템 (제외 설정)
- MCP 클라이언트 실제 연결 로직

### 10.2 성능 최적화

| 영역          | 현재               | 목표                          |
| ------------- | ------------------ | ----------------------------- |
| CLI 렌더링    | Ink 기본           | dirty-rect 또는 Screen buffer |
| 빌드 시간     | ~80ms (tsup)       | 유지                          |
| 테스트 실행   | ~17s (6,475 tests) | 유지                          |
| 컨텍스트 압축 | async (구현됨)     | 연결 필요                     |

### 10.3 엔터프라이즈 준비

| 항목              | 구현 상태 | 연결 상태  |
| ----------------- | --------- | ---------- |
| SIEM audit log    | 구현됨    | **미연결** |
| OTLP metrics      | 구현됨    | **미연결** |
| SSO/SAML          | 구현됨    | **미연결** |
| Container sandbox | 구현됨    | **미연결** |
| Policy bundles    | 구현됨    | **미연결** |

---

## 개발 계획 (우선순위 순)

### Sprint A: Critical Wiring (1-2일)

```
1. 신규 도구 4개 registry 등록 (10분)
2. MCP health monitor → manager 통합 (30분)
3. Hook event adapter 초기화 (20분)
4. ToolPipeline → agent-loop 통합 (2시간)
5. agent-loop.ts → RuntimePipeline 리팩토링 (1일)
```

### Sprint B: UX 격차 해소 (3-5일)

```
1. DiffViewer 고도화 — side-by-side, hunk nav, apply/reject (2일)
2. VS Code Extension 완성 — inline diff, diagnostics (3일)
3. 로컬 모델 원클릭 설정 — Ollama auto-detect (1일)
```

### Sprint C: Skill-Creator + 기능 확장 (3-5일)

```
1. /skill create 위저드 (1일)
2. /skill validate + /skill test (1일)
3. Plugin system 초기화 + wiring (1일)
4. Dashboard 데이터소스 + /dashboard 명령어 (2일)
```

### Sprint D: 품질 + 릴리스 (2-3일)

```
1. 테스트 커버리지 80% → 85% (1일)
2. 초대형 파일 리팩토링 (tool-display, agent-loop) (1일)
3. v1.0.0 릴리스 기준 검증 (1일)
```

---

## 결론

DHelix Code는 **설계 우수, 연결 부족**입니다.

- **아키텍처**: 9-Stage Pipeline, 8 Providers, Trust Tiers, MCP A2A 등 경쟁사 최고 수준
- **문제**: 60,000+ LOC의 신규 모듈이 기존 런타임에 연결되지 않은 상태
- **우선**: Sprint A (Critical Wiring)만 완료하면 **실제 동작하는 프로덕트**로 전환 가능
- **경쟁력**: DiffViewer 고도화 + VS Code Extension + 로컬 모델 원클릭이 가장 빠른 격차 해소 경로

```
현재 위치: "promising architecture" (유망한 설계)
Sprint A 후: "functional product" (동작하는 제품)
Sprint B 후: "competitive product" (경쟁력 있는 제품)
Sprint C+D 후: "production-grade platform" (v1.0.0 릴리스)
```
