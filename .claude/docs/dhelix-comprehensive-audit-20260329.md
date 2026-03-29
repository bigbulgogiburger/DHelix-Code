# DHelix Code v0.2.0 — Comprehensive Audit & Development Roadmap

> 작성: 2026-03-29 | Coding Agent 전문 기획자/개발자 분석
> 목표: Claude Code / OpenCode 수준의 스펙 달성 후 DNA Engine 개발 진입

---

## Executive Summary

DHelix Code는 **74개 주요 기능 중 56개 구현(76%), 5개 부분 구현, 7개 미구현** 상태입니다.
Core Agent Loop, Tool System, Guardrails는 Claude Code 대비 동등 이상이나,
**VS Code Extension, LSP 통합, CI/CD 네이티브 연동, 테스트 안정화**가 주요 격차입니다.

| 영역 | 완성도 | 한줄 평가 |
|------|--------|----------|
| Core Agent Loop | 90% | 3-Layer Compaction, Circuit Breaker 등 업계 최고 수준 |
| Tool System | 85% | 15개 빌트인 + MCP + Adaptive Schema |
| Permissions & Guardrails | 95% | 5모드 + 28패턴 시크릿 스캐너 + 인젝션 탐지 |
| CLI UX/UI | 85% | 37 슬래시 명령 + 음성 + 테마 + 키바인딩 |
| Config/Memory/Skills | 80% | 5계층 설정 + 프로젝트 메모리 + 스킬 시스템 |
| Test & Infra | 70% | 216 테스트 파일, 10개 실패(브랜딩 업데이트 누락) |
| IDE/CI 통합 | 10% | VS Code 확장 없음, CI 템플릿 없음 |

---

## Part 1: Critical Blockers (즉시 수정 필요)

### 1.1 빌드 파이프라인 차단 이슈

| # | 이슈 | 파일 | 영향 | 수정 난이도 |
|---|------|------|------|------------|
| B1 | OpenAI SDK 타입 불일치 (v4 vs v6) | `src/llm/client.ts:586` | typecheck 실패 → CI 차단 | LOW |
| B2 | ESLint 에러 3건 (조건부 훅, 불필요한 이스케이프) | `StreamingMessage.tsx`, `export.ts` | lint 차단 | LOW |
| B3 | 테스트 10건 실패 (브랜딩 미반영) | `doctor-enhanced`, `export-enhanced`, `TaskViewPanel`, `TeammateStatus`, `notification-triggers`, `system-prompt-builder` | 색상값 #00E5FF, 표시명 "Dhelix Code" 미반영 | LOW |
| B4 | React Hook deps 경고 3건 | `ActivityFeed.tsx`, `useAgentLoop.ts` | 런타임 버그 가능성 | LOW |

**예상 소요**: 1-2시간 (전체 자동화 가능)

### 1.2 보안 취약점

| # | 이슈 | 파일 | 심각도 |
|---|------|------|--------|
| S1 | Guardrail 정규식 ReDoS 가능성 | `injection-detector.ts` | HIGH |
| S2 | MCP 도구 출력 시크릿 미스캔 (빌트인만 적용) | `mcp/tool-bridge.ts` | HIGH |
| S3 | Symlink TOCTOU 레이스 컨디션 | `guardrails/path-filter.ts` | MEDIUM |

---

## Part 2: Core Engine 분석

### 2.1 Agent Loop (src/core/agent-loop.ts) — 90%

**강점:**
- ReAct 루프 + Circuit Breaker (NO_CHANGE=5, SAME_ERROR=5, MAX_ITER=50)
- 듀얼 폴백 도구 추출 (strategy → direct fallback)
- Permission denial 추적 (MAX_DENIALS=2)
- AbortSignal 전체 통합

**격차:**
| 기능 | 상태 | 설명 |
|------|------|------|
| 선제적 컴팩션 | ❌ | 85% 도달 시 LLM 호출 전 컴팩션 트리거 필요 |
| 스트리밍 타임아웃 | ❌ | 청크 간 최대 대기 시간 없음 (무한 행 가능) |
| 도구 호출별 재시도 | ❌ | 현재 전체 or nothing, 개별 도구 재시도 필요 |
| 동적 Thinking 예산 | ⚠️ | calculateThinkingBudget 존재하지만 루프 내 미적용 |

### 2.2 Context Manager — 95%

**3-Layer 아키텍처 (업계 최고 수준):**
- Layer 1: Microcompaction (Cold Storage, HOT_TAIL=5)
- Layer 2: Auto-Compaction (83.5% 트리거, 모델별 임계값)
- Layer 3: Rehydration (recency/frequency/mixed 전략)

**격차:**
- Cold Storage 고아 파일 미정리
- 병렬 컴팩션 가드 없음 (동시 트리거 시 충돌 가능)
- Rehydration 전략 세션 중 변경 불가

### 2.3 LLM Layer — 75%

**강점:** OpenAI SDK 호환, 40+ 모델 레지스트리, Dual-Model Router, Thinking Budget

**주요 격차:**
| 기능 | 상태 | 우선순위 |
|------|------|----------|
| Anthropic 네이티브 클라이언트 | ❌ | CRITICAL — cache_control, prompt caching 미지원 |
| Gemini 네이티브 프로바이더 | ❌ | HIGH — OpenAI 호환 래퍼로만 접근 |
| Ollama/LM Studio 전용 지원 | ⚠️ | HIGH — baseURL로 가능하나 최적화 없음 |
| 모델별 토크나이저 | ⚠️ | MEDIUM — o200k_base만 사용, cl100k/llama 미지원 |
| 스트리밍 타임아웃 | ❌ | HIGH — 30초 기본값 필요 |

### 2.4 Subagents — 85%

**강점:** 3타입(explore/plan/general) + 워크트리 격리 + 병렬 실행 + 공유 상태

**격차:**
- SharedAgentState 동시성 락 없음
- 워크트리 실패 시 폴백 없음 (git 미설치 환경)
- 서브에이전트 프로파일링 없음 (토큰/시간 추적)

---

## Part 3: Tool System 분석

### 3.1 빌트인 도구 (15개)

| 도구 | 권한 | 특이사항 |
|------|------|----------|
| file_read | safe | 이미지/PDF/Jupyter 지원, .env 시크릿 마스킹 |
| file_write | confirm | 디렉토리 자동 생성 |
| file_edit | confirm | 안전한 문자열 치환 |
| bash_exec | confirm | 백그라운드 실행, 타임아웃, 인터랙티브 차단 |
| bash_output | safe | 읽기 전용 셸 실행 |
| glob_search | safe | 파일 패턴 매칭 |
| grep_search | safe | 정규식 콘텐츠 검색 |
| list_dir | safe | 디렉토리 목록 |
| web_search | safe | Brave + DuckDuckGo 폴백 |
| web_fetch | safe | 웹 페이지 분석 |
| ask_user | safe | 사용자 입력 프롬프트 |
| todo_write | confirm | 태스크 리스트 관리 |
| notebook_edit | confirm | Jupyter 셀 편집 |
| agent | confirm | 서브에이전트 생성 |
| mkdir | confirm | 디렉토리 생성 |

**Claude Code 대비 누락 도구:**
- `kill_shell` — 실행 중인 프로세스 종료 (bash_exec 내장으로 대체 가능)
- 네이티브 Git 도구 — bash_exec로 대체 중이나 전용 도구가 안전

### 3.2 Tool Execution Pipeline — 95%

- Zod 스키마 검증 + 자동 보정 (Git Bash 경로, 타입 강제 변환)
- AbortController + 타임아웃 + 백그라운드 프로세스 매니저
- Adaptive Schema (HIGH/MEDIUM/LOW 모델 티어별 스키마 축소) — **경쟁사 없는 차별점**

### 3.3 MCP — 90%

- 3-Scope 설정 (local/project/user)
- 3 트랜스포트 (stdio/http/sse) + OAuth
- Deferred Loading + Tool Search
- MCP Server 모드 **미완성** (serve.ts stub)

---

## Part 4: CLI UX/UI 분석

### 4.1 컴포넌트 인벤토리 (22개)

**입력:** UserInput, SlashCommandMenu, SelectList, PermissionPrompt
**출력:** StreamingMessage, ActivityFeed, ToolCallBlock, TurnBlock, ReadGroupBlock, ThinkingBlock
**상태:** StatusBar, AgentStatus, VoiceIndicator
**지원:** ErrorBanner, RetryCountdown, TaskListView, TeammateStatus, Logo, ErrorBoundary

### 4.2 슬래시 명령어 (37개) — 업계 최다

세션(5) + 모델(6) + 컨텍스트(5) + 권한(4) + 코드(6) + 시스템(5) + 고급(6)

### 4.3 UX 강점 (Claude Code 대비 우위)

| 기능 | DHelix | Claude Code |
|------|--------|------------|
| 음성 입력 (Whisper) | ✅ | ❌ |
| 확장 사고 표시 (Ctrl+T) | ✅ | ❌ |
| 4 테마 (dark/light/auto/colorblind) | ✅ | 2 테마 |
| 5 권한 모드 + /permissions 규칙 | ✅ | 4 모드 |
| 수동 컴팩션 (/compact) | ✅ | ❌ |
| MCP 관리 (/mcp) | ✅ | ❌ |
| 팀/듀얼 모델 (/agents, /dual) | ✅ | ❌ |
| 키바인딩 커스터마이징 | ✅ | ❌ |

### 4.4 UX 격차

| 기능 | 상태 | 우선순위 |
|------|------|----------|
| 이미지 붙여넣기 (클립보드) | ❌ | HIGH |
| 도구 실행 중 실시간 출력 스트리밍 | ❌ | HIGH |
| 대화 내 검색 (Ctrl+F) | ❌ | MEDIUM |
| 진행 바 (스피너만 존재) | ❌ | MEDIUM |
| 세션 히스토리 검색 | ❌ | MEDIUM |
| Side-by-side Diff 뷰 | ❌ | LOW |

---

## Part 5: Config/Memory/Skills/Instructions/Hooks

### 5.1 Config (5-Layer Merge) — 90%
defaults → ~/.dhelix/config.json → .dhelix/config.json → ENV → CLI flags

**격차:** 라이브 리로드 없음, 설정 변경 알림 없음

### 5.2 Memory — 75%
프로젝트 해시 기반 격리 + MEMORY.md + 토픽 파일 오버플로

**격차:**
- 메모리 검색 API 없음 (LLM이 "예전에 배운 X" 제안 불가)
- 메모리 만료/감쇠 없음
- 동시 쓰기 잠금 없음

### 5.3 Skills — 85%
YAML frontmatter + markdown body + 변수 치환 + fork 실행

**최근 수정:** 셸 인젝션 방어 (실행 순서 반전), fork 리스너 연결, modelOverride 적용

### 5.4 Instructions (6-Layer) — 90%
global → global rules → parent dirs → project → path rules → local override

**경쟁사 대비 우위:** 경로 기반 규칙 매칭 (Claude Code보다 정교)

### 5.5 Hooks (17 이벤트, 4 핸들러 타입) — 85%
command/http/prompt/agent 핸들러 + 안전한 validator (eval 미사용)

**격차:** Hook 결과 LLM 전달 없음, 실행 순서 제어 없음

---

## Part 6: Test & Infrastructure

### 6.1 현재 상태

| 지표 | 값 | 상태 |
|------|---|------|
| 소스 파일 | 252 | - |
| 테스트 파일 | 216 | Good |
| 테스트 통과율 | 99.8% (4074/4084) | Excellent |
| 빌드 시간 | 80ms | Excellent |
| TypeScript strict | Yes | Excellent |
| `as any` 사용 | 2건 | Excellent |

### 6.2 테스트 커버리지 약점

| 모듈 | 커버리지 | 누락 |
|------|----------|------|
| auth/ | 33% | token-manager 미테스트 |
| commands/ | 58% | 19개 명령어 미테스트 |
| memory/ | 50% | writer 엣지 케이스 |
| voice/ | 67% | 오디오 플로우 |

### 6.3 CI/CD

- GitHub Actions 2개 (ci.yml + publish.yml)
- Node 20/22 매트릭스
- **현재 CI 차단** (타입 에러 + lint 에러 + 테스트 실패)

---

## Part 7: 경쟁사 대비 전략적 격차

### 7.1 Critical (반드시 필요)

| # | 기능 | 경쟁사 현황 | 예상 공수 |
|---|------|------------|----------|
| C1 | **VS Code Extension** | Cline 15M+ 설치, OpenCode 확장 | 2-3주 (CLI 래핑 방식) |
| C2 | **Anthropic 네이티브 클라이언트** | Claude Code 핵심 | 1주 (cache_control, prompt caching) |
| C3 | **CI/CD 템플릿** | Claude Code, Codex, Cursor | 2-3일 (GitHub Actions 패키징) |

### 7.2 High Priority

| # | 기능 | 설명 | 예상 공수 |
|---|------|------|----------|
| H1 | LSP 통합 | go-to-definition, symbol lookup → 에이전트 정확도 향상 | 2주 |
| H2 | Gemini/Ollama 네이티브 프로바이더 | OpenAI 호환 래퍼가 아닌 전용 지원 | 1주/각 |
| H3 | 이미지 붙여넣기 | 클립보드에서 스크린샷 직접 입력 | 3일 |
| H4 | 도구 실시간 출력 스트리밍 | bash_exec 실행 중 출력 표시 | 3일 |
| H5 | 메모리 검색 API | "이전에 배운 X" LLM 제안 기능 | 3일 |
| H6 | MCP Server 모드 완성 | serve.ts stub → 완전한 MCP 서버 | 1주 |

### 7.3 Medium Priority

| # | 기능 | 설명 |
|---|------|------|
| M1 | 스트리밍 타임아웃 (30초 기본) | 무한 행 방지 |
| M2 | 선제적 컴팩션 (85% 트리거) | 컨텍스트 소진 방지 |
| M3 | SharedAgentState 동시성 락 | 병렬 서브에이전트 안전성 |
| M4 | Cold Storage 고아 정리 | 디스크 공간 낭비 방지 |
| M5 | Hook 결과 LLM 전달 | 린터 결과 → AI 반영 |
| M6 | 대화 내 검색 | Ctrl+F 검색 UI |
| M7 | 모델별 토크나이저 | cl100k/llama 지원 |

---

## Part 8: DHelix Code 차별점 (경쟁 우위)

다른 경쟁사에 없거나 DHelix가 최고 수준인 기능:

| 차별점 | 설명 |
|--------|------|
| **3-Layer Context Compaction + Cold Storage** | 마이크로컴팩션 → 구조화 요약 → Rehydration. 업계 가장 정교한 컨텍스트 관리 |
| **Adaptive Tool Schema** | 모델 티어(HIGH/MEDIUM/LOW)에 따라 도구 스키마 자동 축소 |
| **Tool Auto-Correction** | Levenshtein 경로 수정 + JSON 복구 + 타입 강제 변환 |
| **4-Strategy Recovery Executor** | compact/retry/fallback/strategy-switch 에러 유형별 복구 |
| **Prompt Injection Detection** | 8패턴 전용 가드레일 (role_hijack, system_spoof 등) |
| **Permission Audit Log (JSONL)** | 엔터프라이즈급 컴플라이언스 |
| **Team Orchestration + Shared State** | /team + 공유 태스크 리스트 + 공유 변수 |
| **Agent-Level Memory** | 서브에이전트별 세션 간 기억 |
| **42 Slash Commands** | 경쟁사 중 최다 명령어 세트 |
| **Custom API Key Headers** | 사내/온프레미스 LLM 연결 (경쟁사 미지원) |
| **Tone Profiles** | 대화 스타일 커스터마이징 (경쟁사 없음) |
| **Code Review Agent (Generator-Critic)** | 빌트인 자기 리뷰 패턴 |

---

## Part 9: 개발 로드맵

### Phase 0: 안정화 (1-2일)

- [ ] B1: OpenAI SDK 타입 수정 (`npm install` + client.ts 타입 업데이트)
- [ ] B2: ESLint 에러 3건 수정
- [ ] B3: 테스트 10건 브랜딩 업데이트 (색상 hex, 표시명)
- [ ] B4: React Hook deps 경고 수정
- [ ] S1: Guardrail 정규식 ReDoS 타임아웃 추가

### Phase 1: Claude Code 패리티 (2-3주)

- [ ] C2: Anthropic 네이티브 클라이언트 (cache_control, prompt caching)
- [ ] C3: GitHub Actions CI/CD 템플릿
- [ ] H2: Gemini 네이티브 프로바이더
- [ ] H3: 이미지 붙여넣기
- [ ] H4: 도구 실시간 출력 스트리밍
- [ ] H5: 메모리 검색 API
- [ ] M1: 스트리밍 타임아웃
- [ ] M2: 선제적 컴팩션

### Phase 2: 차별화 (3-4주)

- [ ] C1: VS Code Extension (CLI 래핑)
- [ ] H1: LSP 통합
- [ ] H6: MCP Server 모드 완성
- [ ] M3: SharedAgentState 동시성 락
- [ ] M5: Hook 결과 LLM 전달
- [ ] 테스트 커버리지 90% 달성

### Phase 3: DNA Engine 진입 (Phase 2 완료 후)

- [ ] Project DNA Engine — 코딩 컨벤션/패턴 자동 학습
- [ ] Semantic Context Ranking — 시맨틱 중요도 기반 컴팩션
- [ ] Policy-as-Code — .dhelix/policy.yaml 팀 보안 정책

---

## Part 10: 최종 점수표

| 영역 | 현재 | Phase 0 후 | Phase 1 후 | Phase 2 후 |
|------|------|-----------|-----------|-----------|
| Core Engine | 90 | 90 | 95 | 95 |
| Tool System | 85 | 85 | 90 | 95 |
| Permissions & Safety | 95 | 97 | 97 | 98 |
| CLI UX/UI | 85 | 85 | 92 | 95 |
| Multi-Provider | 65 | 65 | 85 | 90 |
| Config/Memory/Skills | 80 | 80 | 88 | 92 |
| Test & Infra | 70 | 85 | 90 | 95 |
| IDE/CI 통합 | 10 | 10 | 30 | 70 |
| **종합** | **73** | **75** | **83** | **91** |

> Claude Code 추정 종합: ~88, OpenCode 추정 종합: ~78
> Phase 1 완료 시 OpenCode 추월, Phase 2 완료 시 Claude Code 근접
