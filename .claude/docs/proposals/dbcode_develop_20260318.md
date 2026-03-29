# dhelix vs Claude Code 핵심 기능 격차 분석

> 작성일: 2026-03-18
> 목적: dhelix의 핵심 코어 기능과 사용자 편의성을 Claude Code와 비교하여 격차와 해소방법을 제시

---

## 1. 핵심 코어 기능 비교

### 1.1 Agent Loop

| 기능                         | Claude Code                         | dhelix                                                                                 | 격차                                      |
| ---------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| 기본 패턴                    | ReAct (Reasoning + Acting)          | ReAct (Reasoning + Acting)                                                             | 동등                                      |
| Extended Thinking            | 네이티브 지원, 예산 자동 조절       | 지원 (`thinking-budget.ts`, 컨텍스트 사용률 기반 동적 축소)                            | 동등                                      |
| Reasoning Effort (`/effort`) | low/medium/high 3단계               | low/medium/high 3단계 (`/effort` 명령어)                                               | 동등                                      |
| 최대 반복 횟수               | 200+ (실질적 제한 없음)             | 50회 (`AGENT_LOOP.maxIterations`)                                                      | **중요** — 복잡한 작업에서 조기 종료 가능 |
| 병렬 도구 실행               | 네이티브 병렬 (읽기/쓰기 충돌 방지) | 그룹 기반 병렬 (읽기 병렬, 같은 파일 쓰기 순차)                                        | 동등                                      |
| Circuit Breaker              | 있음 (무한 루프 감지)               | 시맨틱 진행 분석 — 3회 무변경, 5회 동일 에러 시 트립                                   | 동등                                      |
| 에러 복구 전략               | 자동 복구 (재시도, 프롬프트 수정)   | 6종 에러 유형별 전략 (`recovery-strategy.ts`) — compact/retry/fallback/strategy-switch | 동등                                      |
| 스트리밍 응답                | SSE 기반 실시간 출력                | SSE 스트리밍 + 비스트리밍 모두 지원                                                    | 동등                                      |
| 도구 호출 자동 교정          | 있음                                | 있음 (`tool-call-corrector.ts` — 경로 보정, 타입 변환)                                 | 동등                                      |
| 도구 결과 크기 제한          | 자동 잘라내기                       | 토큰/문자 기반 잘라내기                                                                | 동등                                      |
| Observation Masking          | 있음 (불필요한 도구 출력 마스킹)    | 있음 — file_read, grep, glob 등 재생성 가능 도구 출력 마스킹                           | 동등                                      |
| Dual-Model Routing           | 없음 (단일 모델)                    | **Architect/Editor 패턴** — 계획은 고성능 모델, 실행은 경량 모델                       | **dhelix 우위**                           |
| 텍스트 파싱 전략             | 없음 (네이티브 function calling만)  | **XML 태그 기반 폴백** — function calling 미지원 모델도 사용 가능                      | **dhelix 우위**                           |

**핵심 격차**: 최대 반복 횟수(50 vs 200+). 복잡한 대규모 리팩터링이나 다파일 수정 작업에서 dhelix가 조기에 "Maximum iterations reached" 에러를 내며 종료될 수 있음. Claude Code는 사실상 제한 없이 작업을 계속함.

**dhelix 강점**: Dual-Model Router는 Claude Code에 없는 고유 기능. 비용 대비 품질 최적화에 매우 유용. 텍스트 파싱 폴백으로 Llama, Phi, Gemma 등 로컬 모델도 도구 호출 가능.

### 1.2 컨텍스트 관리

| 기능                   | Claude Code              | dhelix                                                                     | 격차                          |
| ---------------------- | ------------------------ | -------------------------------------------------------------------------- | ----------------------------- |
| 자동 압축              | 임계값 도달 시 자동 요약 | 3-Layer 압축 (마이크로 → 자동 → 리하이드레이션)                            | **dhelix 우위** (더 정교)     |
| 압축 임계값            | ~80%                     | 83.5% (high), 75% (medium), 65% (low) — 티어별 적응                        | **dhelix 우위**               |
| Cold Storage           | 없음 (인라인만)          | 200토큰+ 도구 출력을 디스크 저장 (SHA-256 hash, 24h TTL)                   | **dhelix 우위**               |
| 리하이드레이션         | 없음                     | 압축 후 최근 5개 파일 자동 재읽기                                          | **dhelix 우위**               |
| 수동 압축 (`/compact`) | 있음                     | 있음                                                                       | 동등                          |
| Adaptive GC            | 없음                     | 컨텍스트 소비 속도 기반 동적 압축 주기 조정 (`adaptive-context.ts`)        | **dhelix 우위**               |
| 시스템 프롬프트 캐싱   | Anthropic prompt caching | SHA-256 + mtime 기반 캐시 (`system-prompt-cache.ts`) + Anthropic 캐싱 지원 | 동등                          |
| 컨텍스트 윈도우 크기   | 200K (Claude)            | 모델별 자동 감지 (최대 1M — GPT-4.1, GPT-5 등)                             | **dhelix 우위** (다양한 모델) |

**핵심 평가**: 컨텍스트 관리는 dhelix가 Claude Code보다 정교함. 3-Layer 압축, Cold Storage, Adaptive GC 등 세밀한 전략이 적용되어 있어 장시간 세션에서 효율적. 다만 Claude Code는 Anthropic의 네이티브 prompt caching 활용이 더 최적화되어 있을 수 있음 (서버 측 캐싱).

### 1.3 도구 시스템 (Tool System)

| 기능                     | Claude Code                                    | dhelix                                                                                        | 격차            |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| 내장 도구 수             | ~15개 (Read, Write, Edit, Bash, Glob, Grep 등) | 16개 (file_read, file_write, file_edit, bash_exec 등 + notebook_edit, ask_user)               | 동등            |
| Adaptive Schema          | 없음 (모든 모델에 동일 스키마)                 | 3-Tier 적응형 (HIGH=전체, MEDIUM=필수만, LOW=최소+few-shot)                                   | **dhelix 우위** |
| 지연 로딩 (Lazy Loading) | MCP 도구만                                     | MCP 도구 + MEDIUM/LOW 티어 내장 도구                                                          | **dhelix 우위** |
| 도구 타임아웃            | bash 120s                                      | bash 120s, file ops 30s                                                                       | 동등            |
| 도구 재시도/자가치유     | 기본 재시도                                    | Levenshtein 경로 교정 + JSON 자동 복구 (`tool-retry.ts`)                                      | **dhelix 우위** |
| 백그라운드 프로세스      | 있음 (bash background)                         | 있음 (bash_exec background + bash_output + kill_shell)                                        | 동등            |
| 자동 체크포인트          | 있음 (파일 수정 전)                            | 있음 (`checkpoint-manager.ts` — /undo, /rewind 기반)                                          | 동등            |
| 도구 표시 파이프라인     | 내장 (헤더, 상세, 프리뷰)                      | `tool-display.ts` — extractHeader, extractDetail, extractPreview, extractSubtext              | 동등            |
| Hot Tools                | 없음 (모든 도구 항상 포함)                     | 6개 핫 도구 항상 포함 (file_read, file_write, file_edit, bash_exec, glob_search, grep_search) | **dhelix 우위** |

**핵심 평가**: 도구 시스템은 dhelix가 Adaptive Schema와 Lazy Loading으로 다양한 모델에 최적화된 점이 강점. Claude Code는 Claude 모델에 최적화되어 별도 적응 전략이 불필요.

### 1.4 MCP 통합

| 기능                    | Claude Code                    | dhelix                                               | 격차          |
| ----------------------- | ------------------------------ | ---------------------------------------------------- | ------------- |
| MCP 프로토콜 버전       | 최신                           | JSON-RPC 2.0 기반                                    | 동등          |
| 트랜스포트              | stdio, http, sse               | stdio, http, sse                                     | 동등          |
| 설정 스코프             | 3-scope (user, project, local) | 3-scope (user, project, local) — 동일 구조           | 동등          |
| OAuth 인증              | 있음                           | 있음 (`oauth.ts`)                                    | 동등          |
| 도구 필터링             | include/exclude                | include/exclude (`tool-filter.ts`)                   | 동등          |
| Deferred Tool Loading   | 있음                           | 있음 (`tool-search.ts`)                              | 동등          |
| MCP Resources           | 있음                           | 있음 (`ReadMcpResourceTool`, `ListMcpResourcesTool`) | 동등          |
| 핫 리로드 (재시작 없이) | 일부 지원                      | 미지원 — 서버 추가 후 재시작 필요                    | **중요**      |
| Sampling 지원           | 있음                           | 미확인                                               | **확인 필요** |
| MCP 장애 복구           | 있음                           | 있음 (이전 커밋에서 추가)                            | 동등          |

**핵심 격차**: MCP 서버를 `/mcp add`로 추가한 후 재시작 없이 즉시 사용할 수 있는 핫 리로드가 없음. Claude Code는 MCP 서버를 동적으로 연결/해제 가능.

### 1.5 서브에이전트 / 에이전트 팀

| 기능              | Claude Code               | dhelix                                                        | 격차                          |
| ----------------- | ------------------------- | ------------------------------------------------------------- | ----------------------------- |
| 서브에이전트 생성 | agent tool로 생성         | agent tool로 생성 (`spawner.ts`)                              | 동등                          |
| 에이전트 타입     | explore, plan, general 등 | explore, plan, general + 커스텀 (`.dhelix/agents/*.md`)       | **dhelix 우위** (커스텀 정의) |
| Git Worktree 격리 | 있음                      | 있음 (`isolation: "worktree"`, orphaned worktree 자동 정리)   | 동등                          |
| 팀 오케스트레이션 | 없음                      | **Team Manager** — 태스크 분배, 병렬 실행, 공유 상태          | **dhelix 우위**               |
| 에이전트 메모리   | 없음 (세션 메모리만)      | 에이전트별 메모리 영속화 (`agent-memory.ts`)                  | **dhelix 우위**               |
| 백그라운드 실행   | 있음                      | 있음 (`run_in_background: true`)                              | 동등                          |
| 도구 제한         | 읽기 전용 등              | 타입별 도구 필터링 (explore/plan = 읽기 전용, general = 전체) | 동등                          |
| Code Review Agent | 없음 (별도 도구)          | Generator-Critic 패턴 (`code-review-agent.ts`)                | **dhelix 우위**               |
| 슬래시 명령어     | 없음                      | `/agents`, `/team` (코드 존재, 미등록 상태)                   | **개선 필요**                 |

**핵심 평가**: 서브에이전트/팀 시스템은 dhelix가 구조적으로 우위. Team Manager, Agent Memory, Custom Agent Definition 등이 독자 기능. 다만 `/agents`와 `/team` 명령어가 아직 미등록 상태라 사용자 접근성이 떨어짐.

### 1.6 인스트럭션 시스템 (CLAUDE.md / DHELIX.md)

| 기능                   | Claude Code                                                            | dhelix                                                                        | 격차               |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| 인스트럭션 파일명      | CLAUDE.md                                                              | DHELIX.md                                                                     | 동등 (자체 브랜딩) |
| 로딩 계층              | 6-layer (global → rules → parent dirs → project → local rules → local) | 6-layer 동일 구조                                                             | 동등               |
| Path-Conditional Rules | `.claude/rules/*.md` + YAML frontmatter의 `path_patterns`              | `.dhelix/rules/*.md` + `path-matcher.ts`                                      | 동등               |
| @import 시스템         | `@path/to/file` 구문으로 파일 참조                                     | 지원 (instructions loader에서 처리)                                           | 동등               |
| 로컬 오버라이드        | CLAUDE.local.md (gitignored)                                           | DHELIX.local.md (gitignored)                                                  | 동등               |
| 부모 디렉토리 탐색     | 있음 (git root까지 상위 순회)                                          | 있음 (cwd에서 위로 순회하며 DHELIX.md 수집)                                   | 동등               |
| 제외 패턴              | 없음                                                                   | `dhelixMdExcludes` 설정으로 특정 규칙 파일 무시 가능                          | **dhelix 우위**    |
| 응답 언어 설정         | 없음 (모델 기본)                                                       | `locale` 설정 ("ko", "en" 등)                                                 | **dhelix 우위**    |
| 응답 톤 설정           | 없음                                                                   | 6종 톤 프로필 (`tone-profiles.ts` — normal/cute/senior/friend/mentor/minimal) | **dhelix 우위**    |

**핵심 평가**: 인스트럭션 시스템은 대등하며, dhelix가 제외 패턴, 응답 언어/톤 설정에서 추가 기능을 제공.

### 1.7 Init 명령어 (이번 개선 포함)

| 기능                          | Claude Code                   | dhelix (개선 후)                                                      | 격차 |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------- | ---- |
| 기본 분석                     | 코드베이스 자동 분석          | 12단계 분석 프롬프트                                                  | 동등 |
| 정적 템플릿                   | 있음                          | 15+ 감지 (Node/Rust/Go/Python/Java/Ruby 등)                           | 동등 |
| 인터랙티브 모드               | `NEW_INIT=true` 플래그        | `/init -i` — 4단계 플로우 (선택→탐색→질문→확인)                       | 동등 |
| 서브에이전트 탐색             | 별도 에이전트로 분석          | 인터랙티브 모드에서 서브에이전트 생성 권장                            | 동등 |
| 사전 리뷰/확인                | 쓰기 전 초안 표시             | Phase 4에서 미리보기 + 사용자 확인                                    | 동등 |
| 팔로업 질문                   | 부족한 정보 사용자에게 질문   | Phase 3에서 분석 결과 기반 명확화 질문                                | 동등 |
| 200줄 가이드라인              | 명시적 200줄 제한             | 200줄 제한 가이드라인 (기존 400줄에서 축소)                           | 동등 |
| 분석 항목                     | 기본 (빌드, 아키텍처, 스타일) | 7개 (빌드, 아키텍처, 코드스타일, 기술결정, 개발환경, CI/CD, 모노레포) | 동등 |
| 기존 파일 업데이트            | 있음                          | 있음 (업데이트 모드 프롬프트)                                         | 동등 |
| `.dhelix/` 디렉토리 자동 생성 | `.claude/` 자동 생성          | `.dhelix/` + settings.json + rules/ 생성                              | 동등 |
| .gitignore 자동 관리          | 있음                          | 있음 (DHELIX.local.md 추가)                                           | 동등 |

**핵심 평가**: 이번 개선으로 Init 명령어의 주요 격차가 거의 해소됨. 12단계 분석, 인터랙티브 모드, 200줄 가이드라인, 서브에이전트 탐색 권장 등이 추가되어 Claude Code와 기능적으로 대등.

---

## 2. 사용자 편의성 비교

### 2.1 스킬/슬래시 명령어

| 기능                  | Claude Code         | dhelix                                                                              | 격차            |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------- | --------------- |
| 내장 슬래시 명령어 수 | ~20개               | 42개 (39 등록 + 3 미등록)                                                           | **dhelix 우위** |
| 커스텀 스킬           | `.claude/commands/` | `.dhelix/commands/` + `.dhelix/skills/` (4개 로드 디렉토리)                         | **dhelix 우위** |
| 스킬 변수 치환        | `$ARGUMENTS`        | `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `${DHELIX_SESSION_ID}`                         | **dhelix 우위** |
| 스킬 자동 명령 변환   | 있음                | 있음 (`command-bridge.ts` — user_invocable 스킬 자동 등록)                          | 동등            |
| Verification 스킬     | 없음                | 3종 (verify-tool-metadata-pipeline, verify-model-capabilities, verify-architecture) | **dhelix 우위** |
| Development 스킬      | 없음                | 3종 (add-slash-command, add-tool, debug-test-failure)                               | **dhelix 우위** |
| 음성 입력             | 없음                | `/voice` — OpenAI Whisper + 로컬 STT (`voice-config.ts`)                            | **dhelix 우위** |
| 분석 대시보드         | 없음                | `/analytics` — 토큰 사용량, 도구 빈도, 비용 분석                                    | **dhelix 우위** |
| 듀얼 모델 토글        | 없음                | `/dual-model` — Architect/Editor 패턴 활성화/설정                                   | **dhelix 우위** |

**핵심 평가**: dhelix가 명령어 수와 기능 다양성에서 우위. 음성 입력, 분석 대시보드, 듀얼 모델 등은 Claude Code에 없는 기능. 다만 `/agents`, `/team`, `/permissions` 3개 명령어가 미등록 상태인 점은 개선 필요.

### 2.2 세션 관리

| 기능                            | Claude Code       | dhelix                                             | 격차 |
| ------------------------------- | ----------------- | -------------------------------------------------- | ---- |
| 세션 저장                       | 자동 (JSONL)      | 자동 (`session-auto-save.ts` — JSONL, 원자적 쓰기) | 동등 |
| 세션 복원 (`/resume`)           | 있음              | 있음 — 세션 인덱스 + 메타데이터 기반 복원          | 동등 |
| 세션 분기 (`/fork`)             | 있음              | 있음 — 트랜스크립트 복사                           | 동등 |
| 세션 이름 변경 (`/rename`)      | 있음              | 있음                                               | 동등 |
| 파일 변경 되돌리기 (`/undo`)    | 있음              | 있음 — CheckpointManager 기반                      | 동등 |
| 체크포인트 되돌리기 (`/rewind`) | 있음              | 있음                                               | 동등 |
| 파일 잠금 (동시 접근 방지)      | 있음              | 있음 (LOCK_TIMEOUT 5s, stale lock 30s 자동 정리)   | 동등 |
| 세션 목록/검색                  | `--resume` 플래그 | `/resume` 명령어 내 목록 표시                      | 동등 |

**핵심 평가**: 세션 관리는 양쪽이 대등. 핵심 기능(저장, 복원, 분기, 되돌리기)이 모두 구현됨.

### 2.3 권한 시스템

| 기능                 | Claude Code                                                  | dhelix                                                                | 격차            |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- | --------------- |
| 권한 모드            | 5종 (default, acceptEdits, plan, dontAsk, bypassPermissions) | 5종 동일                                                              | 동등            |
| 영구 allow/deny 규칙 | 있음 (`allowedTools` in settings.json)                       | 있음 — glob 패턴 매칭 (`"Bash(npm *)"`, `"Edit(/src/**)"`), deny 우선 | 동등            |
| 세션 승인 저장       | 있음                                                         | 있음 (`SessionApprovalStore`)                                         | 동등            |
| 감사 로그            | 없음                                                         | **JSONL 감사 로그** (`audit-log.ts` — 타임스탬프, 도구, 결정, 파일)   | **dhelix 우위** |
| 모드 전환 단축키     | Shift+Tab                                                    | Shift+Tab                                                             | 동등            |
| 도구별 권한 수준     | safe/confirm/dangerous                                       | safe/confirm/dangerous                                                | 동등            |

**핵심 평가**: 대등하며, dhelix의 감사 로그가 보안 감사 요구사항을 충족하는 추가 기능.

### 2.4 키보드 단축키 & UI

| 기능                       | Claude Code           | dhelix                                                            | 격차            |
| -------------------------- | --------------------- | ----------------------------------------------------------------- | --------------- |
| Esc (취소)                 | 있음                  | 있음                                                              | 동등            |
| Shift+Tab (권한 모드 전환) | 있음                  | 있음                                                              | 동등            |
| Ctrl+D (종료)              | 있음                  | 있음                                                              | 동등            |
| Ctrl+O (verbose 토글)      | 있음                  | 있음                                                              | 동등            |
| Alt+T (thinking 토글)      | 없음                  | 있음                                                              | **dhelix 우위** |
| 키바인딩 커스터마이징      | 없음                  | 있음 (`~/.dhelix/keybindings.json`, `/keybindings` 명령어)        | **dhelix 우위** |
| 입력 히스토리              | 있음 (Up/Down 화살표) | 있음 (500개, 중복 제거, 세션 간 유지)                             | 동등            |
| Anti-Flicker 렌더링        | 있음                  | DEC Mode 2026 (synchronized-output) + Progressive Static Flushing | 동등            |
| 상태바                     | 있음                  | 있음 (모델, 토큰, MCP 상태 통합)                                  | 동등            |
| 마크다운 렌더링            | 있음                  | 있음 (구문 강조 포함)                                             | 동등            |
| 테마                       | dark만                | auto/dark/light 3종                                               | **dhelix 우위** |
| 렌더링 프레임워크          | 자체 구현             | Ink 5.x (React for CLI) — 22 컴포넌트, 7 훅                       | 동등            |

**핵심 평가**: dhelix가 키바인딩 커스터마이징, Alt+T 단축키, 테마 선택에서 우위. 전반적 UI 완성도는 대등.

### 2.5 Headless 모드

| 기능                 | Claude Code                          | dhelix                               | 격차 |
| -------------------- | ------------------------------------ | ------------------------------------ | ---- |
| 프롬프트 모드 (`-p`) | 있음                                 | 있음                                 | 동등 |
| 텍스트 출력          | 있음                                 | 있음                                 | 동등 |
| JSON 출력            | 있음 (`--output-format json`)        | 있음                                 | 동등 |
| Stream JSON 출력     | 있음 (`--output-format stream-json`) | 있음                                 | 동등 |
| stdin 파이프 입력    | 있음                                 | 있음                                 | 동등 |
| CI/CD 통합           | 있음                                 | 있음                                 | 동등 |
| 비대화형 자동 승인   | `--yes` 플래그                       | `--yes` + `DHELIX_HOOK_AUTO_APPROVE` | 동등 |

### 2.6 Git 워크플로우

| 기능                  | Claude Code                          | dhelix                                                | 격차            |
| --------------------- | ------------------------------------ | ----------------------------------------------------- | --------------- |
| 커밋 생성 (`/commit`) | 도구 기반 (bash로 git 호출)          | `/commit` 슬래시 명령어                               | 동등            |
| PR 생성               | 도구 기반 (gh CLI)                   | 도구 기반 (bash + gh CLI)                             | 동등            |
| Git 상태 감지         | 시스템 프롬프트에 branch/status 포함 | 시스템 프롬프트에 branch/status + project type 감지   | 동등            |
| Worktree 관리         | 서브에이전트 격리용                  | 서브에이전트 격리용 + orphaned worktree 자동 정리     | 동등            |
| 코드 리뷰             | 도구로 직접 수행                     | `/review` + `code-review-agent.ts` (Generator-Critic) | **dhelix 우위** |
| Diff 확인             | 도구 기반                            | `/diff` 명령어                                        | 동등            |

### 2.7 메모리 시스템

| 기능              | Claude Code                 | dhelix                                                                                                 | 격차            |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ | --------------- |
| 자동 메모리 수집  | 있음 (파일 기반, MEMORY.md) | 있음 (`auto-memory.ts` — 8 카테고리, 신뢰도 점수, 중복 체크)                                           | 동등            |
| 메모리 카테고리   | 비구조적                    | 8종 (architecture, patterns, debugging, preferences, infrastructure, conventions, dependencies, files) | **dhelix 우위** |
| 주제별 파일 분산  | 없음 (단일 MEMORY.md)       | 메인 MEMORY.md 200줄 초과 시 주제별 파일로 자동 분산                                                   | **dhelix 우위** |
| 글로벌 메모리     | 있음                        | 있음 (`readGlobalMemory`)                                                                              | 동등            |
| 세션당 최대 항목  | 제한 없음                   | 20개 (무한 증가 방지)                                                                                  | 동등            |
| 최소 신뢰도       | 없음                        | 0.7 (70% 이상만 수집)                                                                                  | **dhelix 우위** |
| `/memory` 명령어  | 없음                        | 있음 (메모리 조회/관리)                                                                                | **dhelix 우위** |
| 에이전트별 메모리 | 없음                        | 있음 (`agent-memory.ts` — 에이전트별 독립 영속화)                                                      | **dhelix 우위** |

**핵심 평가**: dhelix의 메모리 시스템이 더 정교. 카테고리 분류, 신뢰도 점수, 주제별 분산, 에이전트별 메모리 등이 추가적.

---

## 3. 핵심 격차 요약 (Top 10)

| 순위 | 격차                                                                | 심각도 | 해소 난이도 | 우선순위 |
| ---- | ------------------------------------------------------------------- | ------ | ----------- | -------- |
| 1    | Agent Loop 최대 반복 횟수 (50 vs 200+)                              | 심각   | 낮음        | **P0**   |
| 2    | MCP 핫 리로드 미지원 (서버 추가 후 재시작 필요)                     | 중요   | 중간        | **P1**   |
| 3    | 미등록 명령어 3개 (/agents, /team, /permissions)                    | 중요   | 낮음        | **P1**   |
| 4    | Anthropic 네이티브 캐싱 최적화 부족 (cache_control breakpoint 전략) | 중요   | 중간        | **P1**   |
| 5    | 모델 갤러리 / 모델 추천 시스템 부재                                 | 보통   | 중간        | **P2**   |
| 6    | Telemetry / Usage Analytics 서버 연동 부재                          | 보통   | 높음        | **P2**   |
| 7    | OAuth / API Key 관리 통합 (로그인 플로우)                           | 보통   | 높음        | **P2**   |
| 8    | 다국어 시스템 프롬프트 (현재 영어 하드코딩)                         | 보통   | 중간        | **P2**   |
| 9    | 프로젝트 간 메모리 공유 메커니즘 부재                               | 낮음   | 중간        | **P3**   |
| 10   | 플러그인/확장 시스템 (MCP 외 네이티브 확장)                         | 낮음   | 높음        | **P3**   |

---

## 4. 격차 해소 로드맵

### Phase 1: Quick Wins (1-2주)

상수/설정 변경 또는 기존 코드 등록만으로 해소 가능한 항목.

| 항목                        | 작업 내용                                                                                                                                   | 예상 시간 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Agent Loop 반복 횟수 증가   | `constants.ts`의 `AGENT_LOOP.maxIterations`를 50 → 200으로 변경. 설정 파일로 오버라이드 가능하게 `configSchema`에 `maxIterations` 필드 추가 | 2시간     |
| 미등록 명령어 등록          | `/agents`, `/team`, `/permissions` 3개 명령어를 `registry.ts`에 등록                                                                        | 4시간     |
| 모델 가격 정보 업데이트     | `model-capabilities.ts`의 MODEL_OVERRIDES에 최신 가격 반영 + Google Gemini, xAI Grok 등 신규 모델 추가                                      | 4시간     |
| 시스템 프롬프트 locale 적용 | `system-prompt-builder.ts`에서 `config.locale` 기반으로 응답 언어 지시 섹션 추가                                                            | 3시간     |

### Phase 2: Core Improvements (2-4주)

기존 아키텍처 내에서 중간 규모 코드 수정이 필요한 항목.

| 항목                             | 작업 내용                                                                                                                                                                                           | 예상 시간 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| MCP 핫 리로드                    | `MCPManager`에 `addServer()`/`removeServer()` 메서드 추가. `/mcp add` 시 즉시 연결 시도. 기존 `connectAll()` 부트스트랩 로직과 병행                                                                 | 1주       |
| Anthropic 캐싱 최적화            | `anthropic.ts`에서 system prompt의 안정적인 부분(인스트럭션, 도구 정의)에 `cache_control: { type: "ephemeral" }` breakpoint를 전략적으로 배치. 캐시 적중률 모니터링 (`llm:cache-stats` 이벤트 활용) | 3일       |
| Agent Loop 중간 저장/복구        | 50회 이상 장시간 루프에서 중간 상태를 세션에 자동 저장. 중단 후 `/resume`으로 이어서 작업 가능                                                                                                      | 1주       |
| 컨텍스트 사용량 실시간 표시 개선 | 상태바에 토큰 사용 비율 + 압축 예정 경고 실시간 업데이트                                                                                                                                            | 3일       |
| 도구 실행 진행률 표시            | 장시간 bash 실행 시 경과 시간 + 예상 잔여 시간 표시                                                                                                                                                 | 2일       |

### Phase 3: Major Features (1-2개월)

새로운 기능 구현이 필요한 항목.

| 항목                   | 작업 내용                                                                                                                                                                | 예상 시간 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 모델 갤러리 시스템     | `/model gallery` — 사용 가능한 모델 목록을 카테고리(코딩/범용/추론/로컬)별로 표시, 벤치마크 점수와 가격 비교, 원클릭 모델 전환. 모델 데이터는 원격 JSON + 로컬 캐시 구조 | 2주       |
| 프로젝트 템플릿 시스템 | `/init --template react-ts` — 프로젝트 유형별 사전 정의 DHELIX.md + rules + skills 세트 제공. 커뮤니티 템플릿 저장소 연동                                                | 2주       |
| 실시간 협업 모드       | 두 개의 dhelix 세션이 같은 프로젝트에서 동시 작업 시 변경 사항 충돌 감지 + 알림. 파일 잠금 확장                                                                          | 3주       |
| Structured Output 강화 | `structured-output.ts` 확장 — JSON Schema 기반 구조화된 응답 생성으로 tool call 신뢰성 향상                                                                              | 1주       |

### Phase 4: Advanced Capabilities (2-3개월)

시스템 수준의 아키텍처 변경이 필요한 항목.

| 항목                 | 작업 내용                                                                                                                               | 예상 시간 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 네이티브 확장 시스템 | MCP 외에 TypeScript 기반 네이티브 확장 API. `~/.dhelix/extensions/`에 npm 패키지 형태로 설치. 도구, 훅, 명령어, UI 컴포넌트를 확장 가능 | 1개월     |
| OAuth 통합 로그인    | `dhelix login` — OpenAI, Anthropic, Google 등 주요 API 제공자의 OAuth 플로우 통합. API 키 자동 저장 및 갱신                             | 3주       |
| 원격 세션 동기화     | 세션 데이터를 클라우드 (S3, GCS 등)에 동기화. 여러 기기에서 세션 이어서 작업 가능                                                       | 1개월     |
| 분산 에이전트 실행   | Team Manager의 Worker 에이전트를 원격 머신에서 실행 가능하게 확장. SSH 또는 Docker 기반 원격 실행 환경                                  | 2개월     |

---

## 5. 이번 Init 개선으로 해소된 격차

2026-03-18 Init 명령어 개선 작업(`.claude/docs/proposals/init-command-improvement.md` 기반)으로 해소된 항목:

### 5.1 해소된 격차 목록

| 이전 격차                   | 해소 방법                                                                                                             | 해소 수준     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| 분석 항목 부족 (4개 → 12개) | `analysis-prompt.ts` — 12단계 분석 절차 (모노레포, CI/CD, 환경변수, Docker, 테스트, 기존 규칙 중복 방지, 진입점 추적) | **완전 해소** |
| 프로젝트 유형 감지 부족     | `template-generator.ts` — 15+ 프로젝트 유형 감지 (Node/Rust/Go/Python/Java/Ruby/PHP/Elixir/C# 등)                     | **완전 해소** |
| 인터랙티브 모드 부재        | `interactive-flow.ts` — `/init -i` 4단계 플로우 (선택→탐색→질문→확인)                                                 | **완전 해소** |
| 200줄 가이드라인 부재       | `analysis-prompt.ts`의 가이드라인 섹션에서 200줄 제한 명시                                                            | **완전 해소** |
| 서브에이전트 탐색 부재      | 인터랙티브 모드 Phase 2에서 서브에이전트 생성 권장 (50+ 파일 프로젝트)                                                | **완전 해소** |
| 사전 리뷰/확인 부재         | 인터랙티브 모드 Phase 4에서 미리보기 + 사용자 확인 단계                                                               | **완전 해소** |
| 팔로업 질문 부재            | 인터랙티브 모드 Phase 3에서 분석 결과 기반 명확화 질문                                                                | **완전 해소** |
| 분석 대상 확장 부족         | 7가지 분석 항목 (빌드, 아키텍처, 코드 스타일, 기술 결정, 개발 환경, CI/CD, 모노레포)                                  | **완전 해소** |

### 5.2 기존에 이미 동등했던 기능

- **@import 시스템**: 인스트럭션 로더에서 이미 지원 (`instructions/loader.ts`)
- **path-conditional rules**: `.dhelix/rules/*.md` + `path-matcher.ts`로 이미 구현
- **.gitignore 자동 관리**: `ensureGitignoreEntry()`로 이미 구현
- **기존 파일 업데이트 모드**: `buildContextSection()`의 `isUpdate` 분기로 이미 구현

### 5.3 개선 후 잔여 격차

| 잔여 항목                    | 현재 상태                                                        | 우선순위 |
| ---------------------------- | ---------------------------------------------------------------- | -------- |
| 스킬/훅 연계 생성            | 인터랙티브 모드에서 프롬프트로 권장하지만, 자동 생성 로직은 없음 | P2       |
| 생성된 DHELIX.md의 품질 검증 | LLM 출력에 의존, 구조/길이 자동 검증 없음                        | P3       |

---

## 6. 다음 우선순위 작업 제안

### 즉시 실행 (이번 주)

1. **Agent Loop maxIterations 증가**

   - 파일: `src/constants.ts` → `AGENT_LOOP.maxIterations = 200`
   - 추가: `src/config/schema.ts`에 `maxIterations: z.number().positive().default(200)` 필드 추가
   - 사용자가 설정으로 조절 가능하게 변경
   - 예상: 2시간

2. **미등록 명령어 3개 등록**
   - `/agents`, `/team`, `/permissions`를 `src/commands/registry.ts`에 등록
   - 이미 핸들러 코드가 존재하므로 등록만 하면 됨
   - 예상: 4시간

### 다음 스프린트 (1-2주)

3. **MCP 핫 리로드 구현**

   - `MCPManager`에 `addServerRuntime()` 메서드 추가
   - `/mcp add` 명령 실행 시 설정 저장 + 즉시 연결 + 도구 등록
   - 재시작 없이 새 MCP 서버 사용 가능

4. **Anthropic 프롬프트 캐싱 breakpoint 최적화**
   - `anthropic.ts`의 `toAnthropicMessages()`에서 시스템 프롬프트 첫 번째 블록에 `cache_control` 추가
   - 캐시 적중률 모니터링을 `/analytics`에 통합

### 중기 계획 (1개월)

5. **모델 갤러리 시스템**

   - `/model gallery` 명령어 추가
   - 모델 카테고리/가격/컨텍스트 비교 표
   - 원클릭 전환 + 성능 벤치마크

6. **에이전트 팀 UX 완성**
   - `/team` 명령어 등록 + 대화형 팀 구성 UI
   - 팀 실행 중 실시간 진행 상황 표시
   - 팀 결과 병합 및 리포트 생성

---

## 부록: dhelix 고유 강점 (Claude Code에 없는 기능)

dhelix가 Claude Code 대비 차별화되는 고유 기능을 정리합니다. 이 기능들은 dhelix의 핵심 가치 제안(value proposition)을 구성합니다.

| 기능                      | 설명                                                                                  | 가치                                                             |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **멀티 LLM 프로바이더**   | OpenAI, Anthropic, Ollama, vLLM, llama.cpp, Azure 등 OpenAI 호환 API 모두 지원        | 벤더 종속 탈피, 로컬 모델 사용 가능                              |
| **Dual-Model Router**     | Architect(설계) + Editor(실행) 역할 분담                                              | 비용 최적화 (고성능 모델은 설계만, 경량 모델이 코딩)             |
| **텍스트 파싱 폴백**      | Function calling 미지원 모델도 XML 태그 기반 도구 호출                                | Llama, Phi, Gemma 등 로컬 모델 완전 지원                         |
| **Adaptive Schema**       | 모델 능력 티어별 도구 스키마 자동 조절                                                | 저사양 모델에서도 안정적 도구 호출                               |
| **3-Layer 컨텍스트 압축** | 마이크로 → 자동 → 리하이드레이션                                                      | 장시간 세션에서 정보 보존 최적화                                 |
| **Cold Storage**          | 대용량 도구 출력을 디스크에 보관 (SHA-256 hash, 24h TTL)                              | 컨텍스트 윈도우 효율적 사용                                      |
| **Team Manager**          | 다수 에이전트 병렬 조율, 공유 태스크/상태                                             | 대규모 작업의 병렬 처리                                          |
| **커스텀 에이전트 정의**  | `.dhelix/agents/*.md`로 에이전트 타입 정의                                            | 팀별 전문 에이전트 구축                                          |
| **에이전트 메모리**       | 에이전트별 학습 패턴 영속화                                                           | 에이전트가 세션 간 학습 축적                                     |
| **감사 로그**             | JSONL 형식 권한 감사 로그                                                             | 기업 보안 감사 요구사항 충족                                     |
| **음성 입력**             | Whisper API + 로컬 STT                                                                | 핸즈프리 코딩                                                    |
| **톤 프로필**             | 6종 응답 톤 (normal/cute/senior/friend/mentor/minimal)                                | 사용자 선호에 맞춘 UX                                            |
| **분석 대시보드**         | 토큰/도구/비용 실시간 분석                                                            | 사용 패턴 최적화                                                 |
| **키바인딩 커스터마이징** | `~/.dhelix/keybindings.json`                                                          | 개인 워크플로우 최적화                                           |
| **35+ 모델 오버라이드**   | GPT-4o, Claude, Llama, Mistral, DeepSeek, Qwen, Phi, Gemma 등                         | 모델 전환 시 자동 최적화                                         |
| **17종 훅 이벤트**        | SessionStart부터 WorktreeRemove까지 17개 라이프사이클 훅                              | Claude Code의 3종(PreToolUse, PostToolUse, Stop)보다 세밀한 제어 |
| **7종 보안 가드레일**     | 비밀키 스캔, 엔트로피 분석, 명령 필터, 경로 필터, 인젝션 감지, 감사 로그, 로거 리댁션 | 엔터프라이즈급 보안                                              |
