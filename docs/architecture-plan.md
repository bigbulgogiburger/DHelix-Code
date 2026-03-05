# dbcode - AI Coding Assistant Architecture Plan v3.0

> 폐쇄망/외부망 LLM을 활용한 Claude Code 수준의 CLI 코딩 어시스턴트
> 플랫폼: **Windows + macOS** 크로스 플랫폼
> 런타임: **Node.js 20+ / TypeScript (ESM)**
> 최종 업데이트: 2026-03-05
> 변경 이력: v1.0 → v2.0 (에이전트 팀 리서치) → v3.0 (Gap Analysis + 경쟁사 분석)

---

## 1. 프로젝트 개요

### 1.1 목표

회사 내부 폐쇄망 또는 외부 LLM API를 통해 동작하는 Claude Code 수준의 AI 코딩 어시스턴트를 Node.js로 구축한다.

### 1.2 핵심 원칙

- **Tool-centric architecture**: 모든 기능은 LLM이 호출하는 도구(Tool)로 구현
- **Immutability**: 모든 상태는 불변 객체로 관리 (대화, 설정, 권한)
- **Defense-in-depth**: 6계층 보안 (OS Sandbox → Permission → Input → Output → Audit → Rate Limit)
- **Cross-platform**: Windows + macOS 동일한 경험 보장
- **Unix philosophy**: 파이프, 헤드리스 모드, JSON 출력, 조합 가능한 CLI 플래그

### 1.3 동작 모드

| 모드             | 설명                                      | 보안 수준                                          |
| ---------------- | ----------------------------------------- | -------------------------------------------------- |
| **Local LLM**    | 폐쇄망 내 Ollama/vLLM/llama.cpp           | 기본 (FS 보호 + 코드 실행 샌드박스)                |
| **External LLM** | 외부 API (OpenAI 호환)                    | 강화 (+ 시크릿 스캐닝 + TLS + 감사로그 + 속도제한) |
| **Hybrid**       | 작업별 모델 라우팅 (간단→로컬, 복잡→외부) | 작업별 보안 프로파일 적용                          |

---

## 2. 프로젝트 구조

```
dbcode/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── tsup.config.ts
├── .dbcodeignore                      # 시크릿 스캔 제외 패턴
│
├── bin/
│   └── dbcode.mjs                     # ESM entry point (#!/usr/bin/env node)
│
├── src/
│   ├── index.ts                       # CLI 부트스트랩 (commander)
│   ├── constants.ts                   # 버전, 기본 경로, 제한값
│   │
│   ├── cli/                           # ═══ Layer 1: 터미널 UI (Ink + React) ═══
│   │   ├── App.tsx                    # Root Ink component
│   │   ├── components/
│   │   │   ├── MessageList.tsx        # 대화 턴 렌더링 (Static + 활성 메시지)
│   │   │   ├── UserInput.tsx          # 멀티라인 입력 (\ 연속, Ctrl+E 토글)
│   │   │   ├── MentionAutocomplete.tsx  # @ 멘션 자동완성 드롭다운
│   │   │   ├── StreamingMessage.tsx   # 스트리밍 메시지 (블록 단위 점진 렌더링)
│   │   │   ├── ToolCallBlock.tsx      # 도구 호출 표시 (접기/펼치기)
│   │   │   ├── MarkdownBlock.tsx      # 마크다운 렌더링
│   │   │   ├── DiffView.tsx           # 유니파이드 diff 렌더링 (색상)
│   │   │   ├── Spinner.tsx            # 로딩 인디케이터 (ora 스타일)
│   │   │   ├── PermissionPrompt.tsx   # 권한 확인 [y/n/a] (세션 기억)
│   │   │   ├── StatusBar.tsx          # 토큰 사용량, 모델, 컨텍스트 %
│   │   │   ├── TaskListView.tsx       # 태스크 리스트 (Ctrl+T 토글)
│   │   │   ├── ErrorBanner.tsx        # 비차단 에러 배너
│   │   │   └── SlashCommandMenu.tsx   # 슬래시 명령어 메뉴
│   │   ├── hooks/
│   │   │   ├── useConversation.ts     # 대화 상태 바인딩
│   │   │   ├── useStreaming.ts        # 스트리밍 이벤트 구독
│   │   │   ├── useKeybindings.ts      # 커스텀 키바인딩 핸들러
│   │   │   ├── useInput.ts            # 멀티라인 입력 + 히스토리
│   │   │   └── usePermission.ts       # 권한 프롬프트 상태
│   │   └── renderer/
│   │       ├── markdown.ts            # marked + marked-terminal
│   │       └── syntax.ts             # shiki (codeToAnsi) 구문 강조
│   │
│   ├── core/                          # ═══ Layer 2: 비즈니스 로직 (UI 무의존) ═══
│   │   ├── agent-loop.ts             # ★ ReAct 에이전틱 루프
│   │   ├── conversation.ts           # 불변 대화 상태 머신
│   │   ├── context-manager.ts        # 컨텍스트 윈도우 관리 (압축/트렁케이션)
│   │   ├── session-manager.ts        # 세션 저장/복원/포크 (JSONL)
│   │   ├── checkpoint-manager.ts     # 파일 상태 체크포인팅 + 리와인드
│   │   ├── message-types.ts          # 메시지 타입 정의
│   │   ├── system-prompt-builder.ts  # 시스템 프롬프트 모듈러 조립
│   │   └── task-manager.ts           # 태스크 리스트 (생성/업데이트/의존성)
│   │
│   ├── llm/                          # ═══ Layer 3: LLM 클라이언트 ═══
│   │   ├── client.ts                 # OpenAI SDK 래퍼 (baseURL 설정)
│   │   ├── provider.ts               # Provider 추상화 인터페이스
│   │   ├── streaming.ts              # SSE 스트림 소비 + 청크 조립
│   │   ├── token-counter.ts          # js-tiktoken (정확) + tokenx (실시간)
│   │   ├── model-router.ts           # 작업별 모델 라우팅 (Hybrid 모드)
│   │   ├── tool-call-strategy.ts     # Strategy 인터페이스 + 자동 감지
│   │   └── strategies/
│   │       ├── native-function-calling.ts  # OpenAI style tool_calls
│   │       └── text-parsing.ts             # XML 기반 파싱 폴백
│   │
│   ├── tools/                        # ═══ Layer 4: 도구 시스템 ═══
│   │   ├── registry.ts               # 도구 등록/조회/실행/지연 로딩
│   │   ├── types.ts                  # Tool 인터페이스, ToolResult, PermissionLevel
│   │   ├── executor.ts               # 실행 래퍼 (타임아웃, AbortController)
│   │   ├── validation.ts             # Zod 스키마 → JSON Schema 변환
│   │   └── definitions/
│   │       ├── file-read.ts           # 파일 읽기 (라인 번호, 오프셋/리밋)
│   │       ├── file-write.ts          # 파일 생성/덮어쓰기 (읽기 선행 필수)
│   │       ├── file-edit.ts           # Search/Replace 편집 (유일성 검증)
│   │       ├── bash-exec.ts           # 셸 명령 실행 (백그라운드, 타임아웃)
│   │       ├── glob-search.ts         # glob 패턴 파일 검색
│   │       ├── grep-search.ts         # 정규식 내용 검색 (ripgrep 래퍼)
│   │       ├── ask-user.ts            # 사용자 질문 (선택지)
│   │       ├── web-fetch.ts           # URL 콘텐츠 가져오기 (P1)
│   │       └── web-search.ts          # 웹 검색 (P1)
│   │
│   ├── permissions/                  # ═══ Layer 5: 권한 시스템 ═══
│   │   ├── manager.ts                # 권한 검사 + 승인/거부
│   │   ├── rules.ts                  # 도구별 규칙 (glob 패턴 매칭)
│   │   ├── modes.ts                  # 권한 모드 (default/acceptEdits/plan/bypassPermissions)
│   │   └── session-store.ts          # 세션 내 승인 캐시
│   │
│   ├── guardrails/                   # ═══ Layer 6: 가드레일 시스템 ═══
│   │   ├── manager.ts               # 가드레일 오케스트레이터
│   │   ├── input-filter.ts          # 입력 필터 (민감정보 마스킹, 인젝션 방어)
│   │   ├── output-filter.ts         # 출력 필터 (유해 코드 차단)
│   │   ├── secret-scanner.ts        # 시크릿 유출 방지 (15+ 패턴 + 엔트로피)
│   │   ├── rate-limiter.ts          # 슬라이딩 윈도우 속도 제한
│   │   ├── token-budget.ts          # 토큰 예산 관리 (일일/세션 한도)
│   │   ├── audit-logger.ts          # 감사 로그 (SHA-256 해시 체인, 로테이션)
│   │   └── content-policy.ts        # 콘텐츠 정책 (커스텀 규칙 파일)
│   │
│   ├── sandbox/                      # ═══ OS 레벨 샌드박스 ═══
│   │   ├── manager.ts               # 플랫폼별 샌드박스 디스패치
│   │   ├── macos-seatbelt.ts        # macOS sandbox-exec 프로파일
│   │   ├── windows-appcontainer.ts  # Windows AppContainer + Job Objects
│   │   └── types.ts                 # SandboxConfig 통합 인터페이스
│   │
│   ├── auth/                         # ═══ 인증 시스템 ═══
│   │   ├── token-manager.ts         # 토큰 기반 인증 (Bearer/API-Key/Custom)
│   │   ├── token-store.ts           # 안전 저장 (환경변수/암호화 파일/키체인)
│   │   ├── token-refresh.ts         # 토큰 자동 갱신
│   │   └── types.ts
│   │
│   ├── config/                       # ═══ 설정 시스템 ═══
│   │   ├── loader.ts                # 5단계 계층적 로딩
│   │   ├── schema.ts                # Zod 전체 설정 스키마
│   │   ├── defaults.ts              # 기본값
│   │   └── types.ts                 # Config 타입 (Zod infer)
│   │
│   ├── instructions/                 # ═══ 프로젝트 지시사항 ═══
│   │   ├── loader.ts                # DBCODE.md / .dbcode/rules/ 로더
│   │   ├── parser.ts                # @import 구문 처리
│   │   └── path-matcher.ts          # 경로 기반 조건부 규칙 로딩
│   │
│   ├── hooks/                        # ═══ 훅 시스템 ═══
│   │   ├── runner.ts                # 훅 실행기 (command/http 핸들러)
│   │   ├── registry.ts              # 훅 등록/매칭 (regex 필터)
│   │   └── types.ts                 # PreToolUse, PostToolUse, Stop 이벤트
│   │
│   ├── skills/                       # ═══ 스킬/커맨드 시스템 ═══
│   │   ├── loader.ts                # SKILL.md 파일 로더 (YAML frontmatter)
│   │   ├── registry.ts              # 스킬 등록/조회 + 설명 예산 관리
│   │   ├── executor.ts              # 스킬 실행 (인자 치환, 컨텍스트 포크)
│   │   └── builtin/                 # 번들 스킬
│   │       ├── simplify/SKILL.md    # 3개 병렬 리뷰 에이전트
│   │       ├── batch/SKILL.md       # 대규모 병렬 변경 (워크트리)
│   │       └── debug/SKILL.md       # 세션 디버그 로그 분석
│   │
│   ├── mentions/                      # ═══ @ 멘션 시스템 ═══
│   │   ├── parser.ts                # @ 멘션 파싱 (입력 텍스트에서 추출)
│   │   ├── resolver.ts              # 멘션 → 실제 컨텐츠 해석
│   │   ├── autocomplete.ts          # 퍼지 매칭 자동완성 엔진
│   │   └── types.ts                 # MentionType, ResolvedMention
│   │
│   ├── commands/                     # ═══ 슬래시 명령어 ═══
│   │   ├── registry.ts              # 명령어 레지스트리
│   │   ├── clear.ts                 # /clear
│   │   ├── compact.ts               # /compact [focus]
│   │   ├── help.ts                  # /help
│   │   ├── model.ts                 # /model (+ effort 레벨 조절)
│   │   ├── config.ts                # /config (대화형 설정 UI)
│   │   ├── resume.ts                # /resume
│   │   ├── rewind.ts                # /rewind (체크포인트 복원 + 요약)
│   │   ├── diff.ts                  # /diff (대화형 diff 뷰어)
│   │   ├── cost.ts                  # /cost (토큰 사용량)
│   │   ├── doctor.ts                # /doctor (설치/설정 진단)
│   │   ├── init.ts                  # /init
│   │   ├── effort.ts                # /effort [low|medium|high|max]
│   │   ├── fast.ts                  # /fast (빠른 출력 모드 토글)
│   │   ├── rename.ts                # /rename [name] (세션 이름 지정)
│   │   ├── memory.ts                # /memory (자동 메모리 관리)
│   │   ├── stats.ts                 # /stats (사용량 시각화)
│   │   ├── context.ts               # /context (컨텍스트 사용량 그리드)
│   │   ├── copy.ts                  # /copy (코드 블록 선택 복사)
│   │   ├── export.ts                # /export [filename]
│   │   ├── fork.ts                  # /fork [name]
│   │   ├── output-style.ts          # /output-style (기본/설명/학습)
│   │   └── mcp.ts                   # /mcp (MCP 서버 관리)
│   │
│   ├── subagents/                    # ═══ 서브에이전트 시스템 ═══
│   │   ├── spawner.ts               # 서브에이전트 스폰 (컨텍스트 격리)
│   │   ├── types.ts                 # 에이전트 타입 정의
│   │   └── builtin/
│   │       ├── explore.ts            # 탐색 에이전트 (읽기 전용)
│   │       ├── plan.ts              # 계획 에이전트 (읽기 전용)
│   │       └── general.ts           # 범용 에이전트 (전체 도구 접근)
│   │
│   ├── mcp/                          # ═══ MCP (Model Context Protocol) ═══
│   │   ├── client.ts                # MCP 클라이언트 (stdio/HTTP/SSE 트랜스포트)
│   │   ├── registry.ts              # 서버 등록, 스코프 관리 (local/project/user)
│   │   ├── tool-bridge.ts           # MCP 도구 → dbcode 도구 레지스트리 브릿지
│   │   ├── resource-resolver.ts     # MCP 리소스 해석 (@server:uri 멘션)
│   │   ├── auth.ts                  # OAuth 2.0 플로우 (원격 MCP 서버)
│   │   ├── config.ts                # .mcp.json 파싱, 환경변수 확장
│   │   └── types.ts                 # MCPServer, MCPTool, MCPResource
│   │
│   ├── tasks/                        # ═══ 백그라운드 태스크 시스템 ═══
│   │   ├── background-runner.ts     # 백그라운드 명령 실행 (Ctrl+B)
│   │   ├── output-buffer.ts         # 출력 버퍼 + 검색
│   │   ├── task-output-tool.ts      # TaskOutput 도구 (결과 조회)
│   │   └── types.ts                 # TaskId, TaskStatus, BackgroundTask
│   │
│   ├── plugins/                      # ═══ 플러그인 시스템 ═══
│   │   ├── loader.ts                # 플러그인 디렉토리 스캔 + 로딩
│   │   ├── manifest.ts              # plugin.json 매니페스트 파싱
│   │   ├── namespace.ts             # 스킬 네임스페이싱 (/plugin:skill)
│   │   ├── marketplace.ts           # 원격 설치/업데이트
│   │   └── types.ts                 # PluginManifest, PluginScope
│   │
│   ├── telemetry/                    # ═══ 텔레메트리/모니터링 ═══
│   │   ├── otel-exporter.ts         # OpenTelemetry 메트릭 + 이벤트 내보내기
│   │   ├── metrics.ts               # 카운터 정의 (토큰, 세션, 도구 사용)
│   │   ├── events.ts                # 이벤트 스키마 (도구 결정, 에러)
│   │   └── config.ts                # OTEL 환경변수 설정
│   │
│   └── utils/
│       ├── logger.ts                # pino 구조화 로깅
│       ├── events.ts                # mitt 타입드 이벤트 버스
│       ├── diff.ts                  # diff 패키지 래퍼
│       ├── path.ts                  # 크로스 플랫폼 경로 (/ 정규화)
│       ├── error.ts                 # 커스텀 에러 클래스
│       ├── platform.ts             # OS 감지 + 플랫폼별 분기
│       └── ripgrep.ts              # ripgrep 바이너리 래퍼
│
├── test/
│   ├── unit/
│   │   ├── core/
│   │   ├── llm/
│   │   ├── tools/
│   │   ├── permissions/
│   │   ├── guardrails/
│   │   └── config/
│   └── integration/
│       ├── agent-loop.test.ts
│       ├── tool-execution.test.ts
│       └── permission-flow.test.ts
│
└── docs/
    ├── architecture-plan.md          # 이 문서
    ├── research-claude-code-features.md
    ├── research-agentic-patterns.md
    ├── research-security-guardrails.md
    ├── research-llm-integration.md
    └── research-cli-ux.md
```

---

## 3. 핵심 아키텍처

### 3.1 레이어 다이어그램

```
┌───────────────────────────────────────────────────────────────┐
│                    CLI Layer (Ink + React)                     │
│  App.tsx │ MessageList │ StreamingMessage │ PermissionPrompt   │
│  UserInput │ ToolCallBlock │ DiffView │ StatusBar │ TaskList   │
└──────────────────────────┬────────────────────────────────────┘
                           │ events (mitt)
┌──────────────────────────▼────────────────────────────────────┐
│                   Core Layer (Zero UI deps)                    │
│  agent-loop.ts │ conversation.ts │ context-manager.ts          │
│  session-manager.ts │ checkpoint-manager.ts │ task-manager.ts  │
│  system-prompt-builder.ts                                      │
└───┬──────────┬──────────┬──────────┬──────────┬───────────────┘
    │          │          │          │          │
┌───▼────┐ ┌──▼────┐ ┌───▼─────┐ ┌─▼────────┐ ┌▼───────────┐
│  LLM   │ │ Tools │ │ Perms   │ │ Hooks    │ │ Background │
│client  │ │ reg   │ │ modes   │ │ runner   │ │ Tasks      │
│provider│ │ exec  │ │ rules   │ │ registry │ │ runner     │
│stream  │ │ defs  │ │ session │ │ http     │ │ output-buf │
│strategy│ │ + MCP │ │         │ │ prompt   │ │            │
└───┬────┘ └───┬───┘ └─────────┘ └──────────┘ └────────────┘
    │          │
┌───▼────┐ ┌──▼──────────────────────────────────────────────┐
│ MCP    │ │              Guardrails Layer                     │
│ client │ │  input-filter │ output-filter │ secret-scanner    │
│ bridge │ │  rate-limiter │ token-budget │ audit-logger       │
│ config │ │  content-policy                                   │
└───┬────┘ └──────────────────────────┬──────────────────────┘
    │                                 │
┌───▼─────────────────────────────────▼──────────────────────┐
│              Sandbox Layer (OS-level enforcement)            │
│  macOS: sandbox-exec (Seatbelt)                              │
│  Windows: AppContainer + Job Objects                         │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                Auth + Telemetry Layer                        │
│  token-manager │ token-store │ otel-exporter │ metrics      │
└─────────────────────────────────────────────────────────────┘

Plugin Layer (횡단)
┌─────────────────────────────────────────────────────────────┐
│  loader │ manifest │ namespace │ marketplace                 │
│  Bundles: skills + hooks + agents + MCP servers + LSP        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 의존성 규칙

- **CLI** → Core, Utils (UI가 Core를 사용, 반대 불가)
- **Core** → LLM, Tools, Permissions, Hooks, Guardrails (오케스트레이션)
- **LLM** → Auth, Utils (인증 주입)
- **Tools** → Utils (파일/프로세스 작업)
- **Guardrails** → Utils (패턴 매칭, 로깅)
- **Utils** → 외부 의존성 없음 (leaf 모듈)
- **순환 의존성 절대 금지**

---

## 4. Agentic Loop (핵심 엔진)

### 4.1 ReAct 패턴 기반 루프

```typescript
// src/core/agent-loop.ts (의사코드)

async function runAgentLoop(
  config: AgentLoopConfig,
  conversation: Conversation,
): Promise<Conversation> {
  let current = conversation;
  let iteration = 0;

  while (iteration < config.maxIterations) {
    iteration++;

    // 1. 컨텍스트 준비 (트렁케이션/압축)
    const messages = config.contextManager.prepare(current, config.tokenBudget);

    // 2. 가드레일: 입력 필터링 (외부 LLM 모드)
    const filtered = await config.guardrails.filterInput(messages);

    // 3. Tool 정의 준비 (strategy에 따라)
    const request = config.toolCallStrategy.prepareRequest(filtered, config.tools);

    // 4. LLM 호출 (스트리밍)
    config.events.emit("llm:start", { iteration });
    const stream = await config.llmClient.stream(request);
    const response = await consumeStream(stream, {
      onTextDelta: (d) => config.events.emit("llm:text-delta", d),
      onToolCallDelta: (d) => config.events.emit("llm:tool-delta", d),
    });

    // 5. 가드레일: 출력 필터링
    const validatedResponse = await config.guardrails.filterOutput(response);

    // 6. 대화에 어시스턴트 응답 추가 (불변)
    current = current.appendAssistantMessage(validatedResponse);

    // 7. Tool call 추출
    const toolCalls = config.toolCallStrategy.extractToolCalls(validatedResponse);
    if (toolCalls.length === 0) break; // 도구 호출 없으면 종료

    // 8. 도구 실행 (순차: 쓰기 안전, 읽기는 향후 병렬화 가능)
    const results = [];
    for (const call of toolCalls) {
      // 8a. 권한 검사
      const perm = await config.permissions.check(call);
      if (perm.denied) {
        results.push({
          id: call.id,
          output: `Permission denied: ${perm.reason}`,
          isError: true,
        });
        continue;
      }

      // 8b. 실행
      config.events.emit("tool:start", call);
      const result = await config.tools.execute(call);
      config.events.emit("tool:complete", { call, result });
      results.push({
        id: call.id,
        output: result.output,
        isError: result.isError,
      });
    }

    // 9. 결과를 대화에 추가 (불변)
    current = current.appendToolResults(results);

    // 10. 감사 로그
    await config.guardrails.audit({ iteration, toolCalls, results });
  }

  return current;
}
```

### 4.2 루프 흐름 다이어그램

```
User Input
    │
    ▼
┌─────────────────────────┐
│ Context 준비            │ ← 토큰 카운팅, 오래된 메시지 트렁케이션
│ (context-manager)       │   자동 압축 (95% 임계값)
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 가드레일: 입력 필터     │ ← [외부 LLM만] 시크릿 마스킹, 인젝션 방어
│ (input-filter)          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ LLM 호출 (스트리밍)     │ ──► text-delta 이벤트 → UI 실시간 렌더링
│ (strategy: native/xml)  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 가드레일: 출력 필터     │ ← 유해 코드 차단, 응답 길이 제한
│ (output-filter)         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Tool Call 추출          │ ← strategy별: tool_calls 필드 or XML 파싱
│ (toolCallStrategy)      │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │ Tool    │
    │ calls?  │
    └────┬────┘
    No   │   Yes
    │    │    │
    ▼    │    ▼
  DONE   │  ┌──────────────────┐
  (표시)  │  │ Permission 확인  │ ← safe(자동) / confirm(y/n/a) / dangerous(경고)
         │  └────────┬─────────┘
         │           │
         │           ▼
         │  ┌──────────────────┐
         │  │ Tool 실행        │ ← 타임아웃, AbortController, 에러 캐치
         │  │ + Checkpoint     │ ← 파일 변경 시 체크포인트 생성
         │  └────────┬─────────┘
         │           │
         │           ▼
         │  ┌──────────────────┐
         │  │ 결과 → 대화 추가 │ ← 불변 Conversation.appendToolResults()
         │  │ + 감사 로그      │ ← 요청/응답/도구 호출 기록
         │  └────────┬─────────┘
         │           │
         └───────────┘ (루프 계속)
```

### 4.3 안전 장치

- **maxIterations**: 기본 50회 (무한 루프 방지)
- **maxTokenBudget**: 컨텍스트 윈도우의 80% (응답용 20% 예약)
- **Tool 타임아웃**: bash 120초, 파일 작업 30초
- **AbortController**: 사용자 Ctrl+C 시 즉시 중단

---

## 5. Tool 시스템

### 5.1 Tool 인터페이스

```typescript
// src/tools/types.ts
interface ToolDefinition<TParams = unknown> {
  readonly name: string;
  readonly description: string;
  readonly parameterSchema: z.ZodSchema<TParams>;
  readonly permissionLevel: "safe" | "confirm" | "dangerous";
  readonly execute: (params: TParams, context: ToolContext) => Promise<ToolResult>;
}

interface ToolContext {
  readonly workingDirectory: string;
  readonly abortSignal: AbortSignal;
  readonly timeoutMs: number;
  readonly platform: "win32" | "darwin";
}

interface ToolResult {
  readonly output: string;
  readonly isError: boolean;
  readonly metadata?: Record<string, unknown>;
}
```

### 5.2 P0 도구 목록 (MVP 필수)

| 도구          | 설명                                              | 권한    |
| ------------- | ------------------------------------------------- | ------- |
| `file_read`   | 파일 읽기 (라인 번호, 오프셋/리밋, 이미지/PDF)    | safe    |
| `file_write`  | 파일 생성/덮어쓰기 (기존 파일은 읽기 선행)        | confirm |
| `file_edit`   | Search/Replace 편집 (유일성 검증, replace_all)    | confirm |
| `bash_exec`   | 셸 명령 실행 (백그라운드, 타임아웃, 작업디렉토리) | confirm |
| `glob_search` | 파일 패턴 검색 (수정시간 정렬)                    | safe    |
| `grep_search` | 정규식 내용 검색 (컨텍스트 라인, 파일 필터)       | safe    |
| `ask_user`    | 사용자에게 질문 (선택지, 멀티셀렉트)              | safe    |

### 5.3 P1 도구 목록 (v1.0)

| 도구                      | 설명                                      | 권한    |
| ------------------------- | ----------------------------------------- | ------- |
| `web_fetch`               | URL 콘텐츠 가져오기 (HTML→마크다운, 캐시) | safe    |
| `web_search`              | 웹 검색 (도메인 필터, 결과 요약)          | safe    |
| `sub_agent`               | 서브에이전트 스폰 (컨텍스트 격리)         | confirm |
| `task_create/update/list` | 태스크 관리                               | safe    |

### 5.4 Tool Registry 아키텍처

```typescript
class ToolRegistry {
  private readonly tools: ReadonlyMap<string, ToolDefinition>

  // LLM에 전달할 도구 정의 (native function calling용)
  getDefinitionsForLLM(): OpenAIToolDef[] { ... }

  // 시스템 프롬프트에 삽입할 도구 설명 (text-parsing 폴백용)
  getDefinitionsForPrompt(): string { ... }

  // 도구 실행 (Zod 검증 → 실행 → 결과)
  async execute(call: ToolCall): Promise<ToolResult> { ... }

  // 지연 로딩: 도구가 많을 때 검색으로 로드
  search(query: string): ToolDefinition[] { ... }
}
```

### 5.5 코드 편집 알고리즘 (Search/Replace)

**주 전략**: Claude Code 방식의 정확한 문자열 매칭

- `old_string`이 파일 내 유일해야 함 (아니면 에러 → 더 넓은 컨텍스트 요구)
- `replace_all` 옵션으로 전체 치환 가능
- 들여쓰기 보존

**폴백 (향후)**: 퍼지 매칭

- Levenshtein 거리 기반 유사 문자열 찾기
- 공백/줄바꿈 정규화 후 매칭
- Aider 벤치마크에서 85% 성공률

---

## 6. 이중 Tool Call 전략

### 6.1 Strategy 인터페이스

```typescript
interface ToolCallStrategy {
  readonly name: "native" | "text-parsing";
  prepareRequest(messages: ChatMessage[], tools: ToolDefinition[]): LLMRequest;
  extractToolCalls(response: LLMResponse): ExtractedToolCall[];
  formatToolResults(results: ToolCallResult[]): ChatMessage[];
}
```

### 6.2 Strategy A: Native Function Calling

```
┌─────────────┐     tools: [{ type: "function", function: { ... } }]
│ LLM Request │ ──► OpenAI API /v1/chat/completions
└─────────────┘
                    response.choices[0].message.tool_calls: [
┌─────────────┐       { id, function: { name, arguments } }
│ LLM Response│ ◄── ]
└─────────────┘

Tool results → role: "tool", tool_call_id: "..." 형태로 대화에 추가
```

**지원 서버**: vLLM (완전), Ollama (기본), llama.cpp (기본), LocalAI, LM Studio

### 6.3 Strategy B: Text Parsing Fallback (XML)

LLM이 function calling을 지원하지 않을 때, 시스템 프롬프트에 도구 설명과 XML 포맷을 주입:

```xml
<!-- LLM이 출력하는 포맷 -->
<tool_call>
<name>file_read</name>
<arguments>{"file_path": "/src/index.ts"}</arguments>
</tool_call>
```

- Regex로 `<tool_call>` 태그 추출
- XML이 JSON보다 에러 복구율 60% 높음 (Morph 벤치마크)
- 잘못된 JSON도 lenient 파싱 시도

### 6.4 자동 감지

```typescript
async function detectStrategy(client: LLMClient): Promise<ToolCallStrategy> {
  try {
    // probe 요청: 간단한 function calling 테스트
    const response = await client.chat({
      messages: [{ role: "user", content: "Say hello" }],
      tools: [{ type: "function", function: { name: "test", parameters: {} } }],
      max_tokens: 10,
    });
    return new NativeFunctionCallingStrategy();
  } catch {
    return new TextParsingStrategy();
  }
}
```

설정으로 강제 지정 가능: `toolCallStrategy: "native" | "text-parsing" | "auto"`

---

## 7. LLM 클라이언트 아키텍처

### 7.1 Provider 추상화

```typescript
// src/llm/provider.ts
interface LLMProvider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  countTokens(text: string): number;
}

// OpenAI 호환 API는 하나의 클래스로 커버
class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    private readonly client: OpenAI, // openai SDK
    private readonly config: ProviderConfig,
  ) {}
}
```

### 7.2 배포 시나리오별 설정

| 시나리오           | baseURL                       | 인증         | 모델              | 추천 서버     |
| ------------------ | ----------------------------- | ------------ | ----------------- | ------------- |
| 개인 개발 (로컬)   | `http://localhost:11434/v1`   | 불필요       | Qwen2.5-Coder-32B | Ollama        |
| 회사 내부망 (공유) | `http://llm.internal:8000/v1` | Bearer token | 회사 지정         | vLLM          |
| 외부 API           | `https://api.provider.com/v1` | API key      | GPT-4o, Claude    | -             |
| 에어갭 (완전 폐쇄) | `http://localhost:8080/v1`    | 불필요       | GGUF 모델         | llama.cpp     |
| 하이브리드         | 작업별 라우팅                 | 혼합         | 작업별 선택       | Ollama + 외부 |

### 7.3 모델 라우팅 (Hybrid 모드)

```typescript
// src/llm/model-router.ts
interface RoutingRule {
  condition: "simple_query" | "code_generation" | "complex_reasoning" | "default";
  provider: string; // 'local' | 'external'
  model: string;
}

// 설정 예시
const routes: RoutingRule[] = [
  { condition: "simple_query", provider: "local", model: "qwen2.5-coder:7b" },
  {
    condition: "code_generation",
    provider: "local",
    model: "qwen2.5-coder:32b",
  },
  { condition: "complex_reasoning", provider: "external", model: "gpt-4o" },
  { condition: "default", provider: "local", model: "qwen2.5-coder:14b" },
];
```

### 7.4 스트리밍 구현

```
LLM Server ──SSE──► streaming.ts ──events──► useStreaming.ts ──state──► StreamingMessage.tsx
                    (청크 조립)                (버퍼 관리)              (블록 단위 렌더링)
```

- **청크 조립**: text delta + tool_call delta를 완전한 메시지로 조립
- **블록 단위 렌더링**: 토큰이 50-100/초로 오므로 개별 토큰이 아닌 마크다운 블록 단위로 렌더링
  - 완료된 블록 → Ink `<Static>` (더 이상 리렌더 안 함)
  - 활성 블록만 실시간 업데이트 (플리커 방지)
- **백프레셔**: 렌더링이 느릴 때 토큰 버퍼링

### 7.5 토큰 카운팅

| 용도                 | 라이브러리  | 정확도 | 크기 |
| -------------------- | ----------- | ------ | ---- |
| 컨텍스트 관리 (정확) | js-tiktoken | ~100%  | ~4MB |
| 실시간 UI 표시       | tokenx      | ~96%   | ~2KB |

- 모델별 토크나이저 매핑 지원 (cl100k_base, o200k_base 등)
- 로컬 LLM은 정확한 토크나이저를 모를 수 있으므로 근사값 허용

---

## 8. 권한 시스템

### 8.1 권한 모드

| 모드                | 설명                                      | 사용 시나리오            |
| ------------------- | ----------------------------------------- | ------------------------ |
| `default`           | 모든 도구 사용 시 확인 요청               | 일반 사용                |
| `acceptEdits`       | 파일 편집 자동 승인                       | 신뢰할 수 있는 작업      |
| `plan`              | 읽기만 가능 (수정 차단)                   | 분석/계획 단계           |
| `dontAsk`           | 사전 승인된 도구만 자동 실행, 나머지 거부 | 자율적이지만 안전한 실행 |
| `bypassPermissions` | 모든 확인 건너뜀                          | 컨테이너/CI 환경 전용    |

### 8.2 권한 규칙 (Fine-grained)

```json
{
  "permissions": {
    "allow": [
      "file_read",
      "glob_search",
      "grep_search",
      "bash_exec(npm run *)",
      "bash_exec(git status)",
      "file_edit(/src/**/*.ts)"
    ],
    "deny": ["bash_exec(rm -rf *)", "bash_exec(git push --force*)", "file_write(/etc/**)"]
  }
}
```

- **평가 순서**: deny → ask → allow (첫 매칭 우선)
- **패턴**: glob 스타일 (bash 명령), gitignore 스타일 (파일 경로)
- **세션 기억**: `always allow` 선택 시 세션 동안 재확인 없음

### 8.3 위험 명령 자동 감지

```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+(-rf|--recursive)/,
  /git\s+push\s+--force/,
  /git\s+reset\s+--hard/,
  /DROP\s+(TABLE|DATABASE)/i,
  /DELETE\s+FROM/i,
  /mkfs\./,
  /:()\{\s*:\|:&\s*\};:/, // fork bomb
  />\s*\/dev\/sd/,
];
```

---

## 9. 가드레일 시스템

### 9.1 로컬 LLM vs 외부 LLM 보안 프로파일

```typescript
interface SecurityProfile {
  mode: "local" | "external" | "hybrid";

  // 공통 (양쪽 모두)
  fileSystemProtection: true; // 항상 활성
  codeExecutionSandbox: true; // 항상 활성
  outputValidation: true; // 유해 코드 차단

  // 외부 LLM 전용
  secretScanning: boolean; // 외부: 필수, 로컬: 선택
  inputRedaction: boolean; // 외부: 필수, 로컬: 비활성
  auditLogging: "full" | "minimal"; // 외부: full, 로컬: minimal
  rateLimiting: boolean; // 외부: 필수, 로컬: 선택
  tlsPinning: boolean; // 외부: 권장
  tokenBudget: boolean; // 외부: 필수 (비용 관리)
}
```

### 9.2 6계층 방어 모델

```
Layer 6: Rate Limiting       ← 요청 빈도 + 토큰 사용량 제한
Layer 5: Audit Logging        ← SHA-256 해시 체인, 모든 상호작용 기록
Layer 4: Output Validation    ← 유해 코드 패턴 차단, 응답 길이 제한
Layer 3: Input Validation     ← 시크릿 마스킹, 프롬프트 인젝션 방어
Layer 2: Permission System    ← 도구별 승인/거부, 위험 명령 감지
Layer 1: OS Sandbox           ← 파일시스템 격리, 프로세스 제한
```

### 9.3 시크릿 스캐너 (15+ 패턴)

```typescript
const SECRET_PATTERNS = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub Token", pattern: /ghp_[a-zA-Z0-9]{36}/ },
  { name: "JWT", pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/ },
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "Generic API Key",
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9]{20,})/,
  },
  // ... 10+ 추가 패턴
];
```

- **Shannon 엔트로피 기반 감지**: 높은 엔트로피 문자열 (>4.5) 경고
- **동작**: 외부 LLM → 자동 `[REDACTED]` 치환 / 로컬 LLM → 경고만

### 9.4 감사 로그

```typescript
interface AuditEntry {
  timestamp: string; // ISO 8601
  sessionId: string;
  iteration: number;
  action: "llm_request" | "llm_response" | "tool_call" | "tool_result" | "permission";
  model: string;
  tokensUsed: { prompt: number; completion: number };
  toolName?: string;
  toolArgs?: Record<string, unknown>; // 시크릿 제거됨
  hash: string; // SHA-256(이전 hash + 현재 entry) - 변조 감지
}
```

- 저장: `~/.dbcode/audit/YYYY-MM-DD.jsonl`
- 로테이션: 7일 기본 (설정 가능)
- 형식: JSONL (한 줄 = 한 엔트리, append-only)

---

## 10. OS 레벨 샌드박스

### 10.1 크로스 플랫폼 전략

| 플랫폼      | 메커니즘                   | 기능                                                     |
| ----------- | -------------------------- | -------------------------------------------------------- |
| **macOS**   | sandbox-exec (Seatbelt)    | 파일 쓰기 CWD 제한, 읽기 허용 (거부 목록), 네트워크 필터 |
| **Windows** | AppContainer + Job Objects | 프로세스 격리, 파일 접근 제어, CPU/메모리 제한           |
| **폴백**    | Docker (양 플랫폼)         | 완전 격리 (권장: CI/CD 환경)                             |

### 10.2 통합 인터페이스

```typescript
interface SandboxConfig {
  allowWrite: string[]; // 쓰기 허용 경로 (기본: CWD)
  denyWrite: string[]; // 쓰기 거부 경로
  denyRead: string[]; // 읽기 거부 경로 (기본: [])
  allowedDomains: string[]; // 네트워크 허용 도메인 (외부 LLM 모드)
  cpuLimit?: number; // CPU 제한 (%) - Windows Job Objects
  memoryLimit?: number; // 메모리 제한 (MB)
}
```

---

## 11. 설정 시스템

### 11.1 5단계 계층 (우선순위 높→낮)

```
1. 관리형 설정 (Enterprise) ← 시스템 수준 정책 (MDM/Registry/plist)
2. CLI 플래그              ← --model, --base-url, --temperature
3. 로컬 설정               ← .dbcode/settings.local.json (gitignored)
4. 프로젝트 설정           ← .dbcode/settings.json (공유)
5. 사용자 설정             ← ~/.dbcode/settings.json (개인)
```

### 11.2 전체 설정 스키마

```typescript
const configSchema = z.object({
  // ═══ LLM 설정 ═══
  llm: z.object({
    baseUrl: z.string().url().default("http://localhost:11434/v1"),
    model: z.string().default("qwen2.5-coder:14b"),
    apiKey: z.string().default(""),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().default(4096),
    contextWindow: z.number().int().positive().default(128_000),
    toolCallStrategy: z.enum(["native", "text-parsing", "auto"]).default("auto"),
    timeout: z.number().int().positive().default(120_000),
    fallbackModel: z.string().optional(),
    fallbackBaseUrl: z.string().url().optional(),
  }),

  // ═══ 보안 프로파일 ═══
  security: z.object({
    mode: z.enum(["local", "external", "hybrid"]).default("local"),
    secretScanning: z.boolean().default(false), // external 시 자동 true
    auditLogging: z.enum(["full", "minimal", "off"]).default("minimal"),
    rateLimiting: z
      .object({
        requestsPerMinute: z.number().default(60),
        tokensPerDay: z.number().default(1_000_000),
      })
      .optional(),
    sandbox: z.object({
      enabled: z.boolean().default(true),
      allowWrite: z.array(z.string()).default([]),
      denyRead: z.array(z.string()).default([]),
    }),
  }),

  // ═══ 인증 ═══
  auth: z.object({
    type: z.enum(["bearer", "api-key", "custom-header", "none"]).default("none"),
    tokenSource: z.enum(["env", "file", "keychain", "prompt"]).default("env"),
    envVariable: z.string().default("DBCODE_API_KEY"),
    headerName: z.string().default("Authorization"),
    refreshUrl: z.string().url().optional(),
  }),

  // ═══ 권한 ═══
  permissions: z.object({
    mode: z.enum(["default", "acceptEdits", "plan", "bypassPermissions"]).default("default"),
    allow: z.array(z.string()).default([]),
    deny: z.array(z.string()).default([]),
  }),

  // ═══ 도구 설정 ═══
  tools: z.object({
    bashTimeout: z.number().default(120_000),
    maxFileSize: z.number().default(2_000_000),
    bashShell: z.string().optional(), // 기본: 플랫폼별 자동 감지
  }),

  // ═══ UI 설정 ═══
  ui: z.object({
    markdown: z.boolean().default(true),
    syntaxHighlighting: z.boolean().default(true),
    maxOutputLines: z.number().default(200),
    theme: z.enum(["dark", "light", "auto"]).default("auto"),
    language: z.string().default("auto"),
  }),

  // ═══ 세션 설정 ═══
  session: z.object({
    autoSave: z.boolean().default(true),
    maxAge: z.number().default(30), // 일
    autoCompactPct: z.number().min(50).max(100).default(95),
  }),

  // ═══ 훅 ═══
  hooks: z.object({
    sessionStart: z.array(hookSchema).default([]),
    userPromptSubmit: z.array(hookSchema).default([]),
    preToolUse: z.array(hookSchema).default([]),
    postToolUse: z.array(hookSchema).default([]),
    postToolUseFailure: z.array(hookSchema).default([]),
    notification: z.array(hookSchema).default([]),
    stop: z.array(hookSchema).default([]),
    preCompact: z.array(hookSchema).default([]),
    configChange: z.array(hookSchema).default([]),
    // Agent Teams 전용
    teammateIdle: z.array(hookSchema).default([]),
    taskCompleted: z.array(hookSchema).default([]),
  }),

  // ═══ Extended Thinking ═══
  thinking: z.object({
    defaultEffort: z.enum(["low", "medium", "high", "max"]).default("high"),
    maxThinkingTokens: z.number().default(32_000),
    enableToggle: z.boolean().default(true),
  }),

  // ═══ MCP ═══
  mcp: z.object({
    servers: z
      .record(
        z.object({
          command: z.string().optional(),
          args: z.array(z.string()).optional(),
          url: z.string().optional(),
          transport: z.enum(["stdio", "http", "sse"]).default("stdio"),
          env: z.record(z.string()).optional(),
        }),
      )
      .default({}),
    maxOutputTokens: z.number().default(10_000),
    deferThreshold: z.number().default(0.1), // 컨텍스트 10% 초과 시 디퍼
  }),

  // ═══ 텔레메트리 ═══
  telemetry: z.object({
    enabled: z.boolean().default(false),
    exporter: z.enum(["otlp", "prometheus", "console", "off"]).default("off"),
    endpoint: z.string().optional(),
    resourceAttributes: z.record(z.string()).optional(),
  }),

  // ═══ 헤드리스/SDK ═══
  headless: z.object({
    maxBudgetUsd: z.number().optional(),
    maxTurns: z.number().optional(),
    outputFormat: z.enum(["text", "json", "stream-json"]).default("text"),
    jsonSchema: z.string().optional(), // 구조화된 출력 JSON Schema
  }),

  // ═══ 알림 ═══
  notifications: z.object({
    enabled: z.boolean().default(true),
    sound: z.boolean().default(false),
  }),

  // ═══ 시스템 ═══
  system: z.object({
    maxAgentIterations: z.number().default(50),
    systemPrompt: z.string().optional(),
    systemPromptFile: z.string().optional(),
    additionalDirectories: z.array(z.string()).default([]), // --add-dir
  }),
});
```

---

## 12. 프로젝트 지시사항 시스템

### 12.1 DBCODE.md

Claude Code의 `CLAUDE.md`에 대응하는 프로젝트별 지시사항 파일:

```
우선순위 (높→낮):
1. 관리형: /Library/Application Support/dbcode/DBCODE.md (macOS)
          %PROGRAMDATA%\dbcode\DBCODE.md (Windows)
2. 프로젝트: ./DBCODE.md 또는 ./.dbcode/DBCODE.md
3. 사용자: ~/.dbcode/DBCODE.md
4. 로컬: ./DBCODE.local.md (gitignored)
5. 하위 디렉토리: 해당 디렉토리 파일 읽을 때 on-demand 로딩
```

### 12.2 규칙 디렉토리

```
.dbcode/rules/
├── coding-style.md          # 코딩 스타일 가이드
├── git-workflow.md          # Git 워크플로우
├── security.md              # 보안 규칙
└── api-patterns.md          # API 패턴 (paths: "src/api/**")
```

- YAML frontmatter의 `paths` 필드로 경로 기반 조건부 로딩
- `@path/to/import` 구문으로 다른 파일 임포트 (최대 5홉)

---

## 13. 컨텍스트 관리

### 13.1 자동 압축

```
컨텍스트 사용률이 95%에 도달 시 자동 압축 트리거:

1. 시스템 프롬프트: 항상 유지
2. 최근 N턴: 항상 유지 (기본: 최근 5턴)
3. 중간 턴: 요약 → 1개 메시지로 압축
4. 도구 결과: 중요도 기반 트렁케이션
5. 태스크 리스트: 압축 후에도 유지 (별도 관리)
```

### 13.2 4대 전략 (Anthropic Context Engineering)

| 전략         | 설명                             | 구현                                    |
| ------------ | -------------------------------- | --------------------------------------- |
| **Write**    | 중요 정보를 지속적 저장소에 기록 | DBCODE.md, 태스크 리스트, 세션 파일     |
| **Select**   | 관련 정보만 선택적 로딩          | 경로 기반 규칙, 지연 도구 로딩, @import |
| **Compress** | 기존 컨텍스트를 요약             | 자동 압축, /compact 명령                |
| **Isolate**  | 독립된 컨텍스트에서 작업         | 서브에이전트, 워크트리 격리             |

---

## 14. 세션 관리

### 14.1 저장 형식: JSONL

```
~/.dbcode/sessions/
├── index.json               # 세션 목록 (id, name, created, lastUsed)
├── {session-id}/
│   ├── transcript.jsonl     # 대화 기록 (한 줄 = 한 메시지)
│   ├── checkpoints/         # 파일 상태 스냅샷
│   │   ├── cp-001.json
│   │   └── cp-002.json
│   └── metadata.json        # 세션 메타데이터
```

### 14.2 세션 명령어

| 명령            | 기능                                                        |
| --------------- | ----------------------------------------------------------- |
| `--continue`    | 가장 최근 세션 이어서                                       |
| `--resume <id>` | 특정 세션 복원                                              |
| `/rewind`       | 체크포인트 목록 → 선택적 복원 (코드+대화 / 대화만 / 코드만) |
| `/fork`         | 현재 세션 분기                                              |
| `/export`       | 대화 텍스트 내보내기                                        |

---

## 15. CLI 인터페이스

### 15.1 기술 스택

| 라이브러리                   | 용도                 | 선택 이유                                                |
| ---------------------------- | -------------------- | -------------------------------------------------------- |
| **Ink**                      | 터미널 UI 프레임워크 | React 모델, GitHub Copilot CLI가 사용, 스트리밍 네이티브 |
| **Shiki**                    | 구문 강조            | VS Code와 동일한 출력 (codeToAnsi)                       |
| **marked + marked-terminal** | 마크다운 렌더링      | 완성된 블록용                                            |
| **chalk**                    | 터미널 색상          | 크로스 플랫폼, 자동 색상 감지                            |
| **commander**                | CLI 인자 파싱        | 업계 표준, 서브커맨드 지원                               |
| **diff**                     | 유니파이드 diff      | 파일 편집 미리보기                                       |

### 15.2 UI 컴포넌트 구조

```
<App>
├── <StatusBar />                  # 모델명 │ 토큰: 1.2K/128K │ 컨텍스트: 12%
├── <MessageList>                  # Static (확정된 턴)
│   ├── <UserMessage />
│   ├── <AssistantMessage>
│   │   ├── <MarkdownBlock />      # 렌더링된 마크다운
│   │   └── <ToolCallBlock />      # ▶ file_read("src/index.ts") → 성공
│   └── ...
├── <StreamingMessage />           # 활성 스트리밍 (이것만 리렌더)
├── <Spinner />                    # ⠋ Thinking... / ⠋ Running file_read...
├── <PermissionPrompt />           # Allow bash_exec("npm test")? [y/n/a]
└── <UserInput />                  # > 사용자 입력 (멀티라인, 히스토리)
```

### 15.3 키바인딩

| 키          | 동작                                | 컨텍스트 |
| ----------- | ----------------------------------- | -------- |
| `Enter`     | 메시지 전송                         | 입력     |
| `\` + Enter | 멀티라인 연속                       | 입력     |
| `Ctrl+C`    | 현재 작업 중단 / 종료               | 전역     |
| `Ctrl+D`    | 세션 종료                           | 전역     |
| `Ctrl+T`    | 태스크 리스트 토글                  | 전역     |
| `Ctrl+B`    | 실행 중 명령을 백그라운드로         | 실행 중  |
| `Ctrl+R`    | 히스토리 역방향 검색                | 입력     |
| `Ctrl+G`    | 외부 에디터에서 입력 편집 ($EDITOR) | 입력     |
| `Ctrl+O`    | 상세 출력 토글 (verbose)            | 전역     |
| `Alt+T`     | Extended Thinking 토글              | 전역     |
| `↑` / `↓`   | 입력 히스토리 탐색                  | 입력     |
| `Esc+Esc`   | /rewind                             | 전역     |

### 15.5.1 `!` Bash 모드

`!` 접두사로 셸 명령을 직접 실행 (LLM 해석 없이):

```
> ! npm test
(npm test 실행, 출력을 대화 컨텍스트에 추가)

> ! git log --oneline -5
(최근 5개 커밋 표시)
```

- 출력이 자동으로 대화 컨텍스트에 포함 → LLM이 결과 참조 가능
- Tab 자동완성: 명령어 히스토리 기반
- 권한 확인 없이 즉시 실행 (사용자가 직접 입력한 것이므로)

### 15.5.2 메시지 큐잉

LLM이 응답 중일 때도 다음 지시를 타이핑할 수 있다:

```
[LLM 실행 중... ▶ Running bash_exec("npm test")]

> (사용자가 다음 지시를 미리 입력)
│ "테스트 통과하면 커밋해줘"
```

- 현재 작업 완료 후 큐에서 자동 전송
- 여러 메시지 큐잉 가능 (FIFO)
- Esc로 큐 취소

### 15.5.3 디버그/Verbose 모드

```bash
dbcode --debug "api,mcp"        # 카테고리별 디버그 출력
dbcode --debug "!file,!statsig" # 부정 패턴 (해당 카테고리 제외)
dbcode --verbose                # 전체 턴별 상세 출력
```

### 15.5.4 알림 시스템

LLM이 응답을 완료하고 사용자 입력을 기다릴 때 알림 발송:

- **터미널 알림**: iTerm2, Kitty, Ghostty 네이티브 알림
- **커스텀 훅**: Notification 이벤트로 소리 재생, Slack 메시지 등
- **설정**: `notifications.enabled`, `notifications.sound`

### 15.4 Windows 호환성 주의사항

- **Shift+Enter**: 일부 Windows 터미널에서 감지 불안정 → `\` 연속 또는 Ctrl+E 토글 모드 우선
- **ANSI 색상**: Windows Terminal (완전 지원), PowerShell (지원), cmd.exe (16색 제한)
- **경로**: 내부적으로 `/`로 정규화, 표시 시 플랫폼별 구분자
- **셸**: Windows에서 bash 대신 PowerShell/cmd 자동 감지 (Git Bash 우선)
- **유니코드**: Windows Terminal 완전 지원, 레거시 cmd는 코드페이지 이슈 가능

---

## 15.5 @ 멘션 시스템

### 지원 멘션 유형

| 문법              | 기능                         | 예시                | 우선순위 |
| ----------------- | ---------------------------- | ------------------- | -------- |
| `@파일경로`       | 파일 내용을 컨텍스트에 첨부  | `@src/index.ts`     | P0       |
| `@파일:라인-라인` | 특정 라인 범위만 첨부        | `@src/app.ts:10-50` | P1       |
| `@디렉토리/`      | 디렉토리 구조 트리 첨부      | `@src/components/`  | P1       |
| `@*.확장자`       | glob 패턴으로 여러 파일 첨부 | `@src/**/*.test.ts` | P2       |

### 자동완성 동작

```
사용자 입력: "@src/co"

┌─────────────────────────────┐
│ 📄 src/components/App.tsx   │ ← 퍼지 매칭 결과
│ 📄 src/config/loader.ts     │
│ 📄 src/core/agent-loop.ts   │
│ 📁 src/components/          │
└─────────────────────────────┘
  Tab/Enter로 선택, Esc로 닫기
```

### 구현 구조

```typescript
// src/mentions/parser.ts
interface ParsedMention {
  raw: string; // "@src/index.ts:10-20"
  type: "file" | "directory" | "glob" | "line-range";
  path: string; // "src/index.ts"
  lineStart?: number; // 10
  lineEnd?: number; // 20
}

// 입력 텍스트에서 @ 멘션을 추출
function parseMentions(input: string): {
  text: string;
  mentions: ParsedMention[];
};

// src/mentions/resolver.ts
// 멘션을 실제 컨텐츠로 해석하여 시스템 메시지로 주입
async function resolveMentions(mentions: ParsedMention[]): Promise<ResolvedContent[]>;

// src/mentions/autocomplete.ts
// 퍼지 매칭 기반 파일 경로 자동완성
function getCompletions(partial: string, cwd: string): CompletionItem[];
```

### 컨텍스트 주입 방식

멘션된 파일 내용은 사용자 메시지에 자동 첨부:

````
[사용자가 입력한 내용]

---
Referenced files:

File: src/index.ts (lines 10-20)
```typescript
// 해당 라인 내용
````

````

---

## 15.6 파일 드래그앤드롭 & 이미지 첨부

### 터미널 드래그앤드롭

| 기능 | 동작 | 지원 터미널 | 우선순위 |
|------|------|-----------|---------|
| **파일 드래그** | 파일을 터미널에 끌어다 놓으면 경로가 자동 입력 → `@경로`로 변환되어 컨텍스트 첨부 | Windows Terminal, iTerm2, VS Code Terminal | P1 |
| **이미지 드래그** | 이미지 파일을 끌면 base64로 변환하여 LLM에 multimodal 입력으로 전송 | iTerm2 (네이티브), Windows Terminal (경로 기반) | P1 |
| **클립보드 이미지** | Ctrl+V로 클립보드 이미지 붙여넣기 → base64 변환 후 LLM 전송 | 제한적 (터미널 의존) | P2 |

### 구현 구조

```typescript
// src/cli/hooks/useFileDrop.ts
// 터미널 드래그앤드롭은 실제로 "경로 텍스트 붙여넣기"로 동작
// - Windows Terminal: 파일 드래그 시 경로 문자열이 stdin에 입력됨
// - iTerm2: OSC 52 시퀀스로 파일 내용 전달 가능

function useFileDrop(): {
  // 붙여넣기된 텍스트가 파일 경로인지 감지
  detectFilePath(text: string): string | null
  // 파일이면 자동으로 @멘션으로 변환
  convertToMention(filePath: string): ParsedMention
}

// src/cli/hooks/useImageAttach.ts
interface AttachedImage {
  type: 'file' | 'clipboard'
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  base64: string
  displayName: string
}

function useImageAttach(): {
  // 이미지 파일 경로를 base64로 변환
  attachImage(filePath: string): Promise<AttachedImage>
  // LLM 메시지에 이미지 포함 (multimodal)
  toMessageContent(image: AttachedImage): MessageContent
}
````

### 지원 파일 형식

| 유형          | 형식                    | 동작                                                   |
| ------------- | ----------------------- | ------------------------------------------------------ |
| **코드 파일** | .ts, .js, .py, .java 등 | 내용을 텍스트로 읽어 컨텍스트 첨부                     |
| **이미지**    | .png, .jpg, .gif, .webp | base64 인코딩 → multimodal 메시지 (LLM이 비전 지원 시) |
| **PDF**       | .pdf                    | 텍스트 추출 (페이지 범위 지정, 최대 20페이지)          |
| **Jupyter**   | .ipynb                  | 셀 내용 + 출력 결합하여 텍스트로 변환                  |
| **기타**      | .json, .yaml, .md 등    | 텍스트로 읽어 첨부                                     |

### 크로스 플랫폼 주의사항

| 플랫폼                 | 드래그앤드롭              | 클립보드 이미지 | 비고                                                |
| ---------------------- | ------------------------- | --------------- | --------------------------------------------------- |
| **Windows Terminal**   | 경로 텍스트 입력됨 (지원) | 제한적          | PowerShell에서는 정상, cmd.exe는 경로에 따옴표 포함 |
| **iTerm2**             | OSC 52 지원 (최고)        | 지원            | 이미지 인라인 표시도 가능                           |
| **macOS Terminal.app** | 경로 텍스트 입력됨        | 미지원          | 기본 동작                                           |
| **VS Code Terminal**   | 경로 텍스트 입력됨        | 미지원          | VS Code 확장으로 보완 가능                          |

---

## 16. 훅 시스템

### 16.1 훅 이벤트 (17개)

| 이벤트               | 실행 시점                 | 용도                                  |
| -------------------- | ------------------------- | ------------------------------------- |
| `SessionStart`       | 세션 시작/재개 시         | 환경 설정, 전제조건 검증              |
| `UserPromptSubmit`   | 사용자 프롬프트 제출 직후 | 전처리, 로깅, 입력 검증               |
| `PreToolUse`         | 도구 실행 전              | 검증, 파라미터 수정, 승인/거부        |
| `PermissionRequest`  | 권한 프롬프트 표시 시     | 커스텀 승인 플로우                    |
| `PostToolUse`        | 도구 실행 성공 후         | 자동 포맷팅, 린트, 타입체크           |
| `PostToolUseFailure` | 도구 실행 실패 후         | 에러 분석, 알림                       |
| `Notification`       | 알림 발송 시              | 소리 재생, 데스크톱 알림, 메시지 전송 |
| `SubagentStart`      | 서브에이전트 스폰 시      | 로깅, 리소스 할당                     |
| `SubagentStop`       | 서브에이전트 종료 시      | 정리, 결과 검증                       |
| `Stop`               | 응답 완료 시              | 최종 검증 (console.log 감사 등)       |
| `TeammateIdle`       | 팀원 에이전트 유휴 시     | exit 2로 작업 계속 지시               |
| `TaskCompleted`      | 태스크 완료 표시 시       | 품질 게이트, exit 2로 완료 거부       |
| `ConfigChange`       | 설정 파일 변경 시         | 설정 전파, 핫리로드                   |
| `PreCompact`         | 컨텍스트 압축 전          | 보존할 내용 영향                      |
| `InstructionsLoaded` | DBCODE.md/rules 로드 시   | 지시사항 후처리                       |
| `WorktreeCreate`     | 워크트리 생성 시          | VCS 비종속적 격리 구현                |
| `WorktreeRemove`     | 워크트리 삭제 시          | 정리, 브랜치 관리                     |

### 16.2 훅 핸들러

```json
{
  "hooks": {
    "postToolUse": [
      {
        "matcher": "file_edit|file_write",
        "hooks": [
          {
            "type": "command",
            "command": "prettier --write $FILE_PATH"
          }
        ]
      }
    ]
  }
}
```

- **command**: 셸 명령 (stdin에 JSON, exit code로 제어)
- **http**: POST JSON → URL, 응답 JSON 수신 (서버리스/웹훅 통합)
- **prompt**: 단일 턴 LLM 평가 (시맨틱 검증용)
- **agent**: 서브에이전트 스폰 (도구 접근 가능한 AI 기반 검증)
- **exit 0**: 통과 / **exit 2**: 차단 (이유를 stdout에)

### 16.3 훅 출력 → 컨텍스트 주입

훅 stdout 출력을 대화 컨텍스트에 주입 가능. 동적 컨텍스트 보강에 활용:

- PreToolUse 훅에서 관련 문서 자동 첨부
- PostToolUse 훅에서 린트 결과를 LLM에 전달

---

## 17. MCP (Model Context Protocol) 아키텍처

### 17.1 개요

MCP는 AI 도구 통합의 사실상 표준으로, 외부 서비스(DB, API, 파일시스템 등)를 LLM 도구로 연결한다.

### 17.2 트랜스포트

| 트랜스포트 | 용도               | 설명                                              |
| ---------- | ------------------ | ------------------------------------------------- |
| **stdio**  | 로컬 프로세스      | 자식 프로세스의 stdin/stdout으로 통신 (가장 흔함) |
| **HTTP**   | 원격 서버 (권장)   | JSON-RPC over HTTP, OAuth 2.0 인증                |
| **SSE**    | 원격 서버 (레거시) | Server-Sent Events, deprecated                    |

### 17.3 서버 스코프

| 스코프      | 위치                        | 공유 | 용도                 |
| ----------- | --------------------------- | ---- | -------------------- |
| **local**   | `.dbcode/mcp.local.json`    | 개인 | 개인 도구, 로컬 DB   |
| **project** | `.mcp.json` (프로젝트 루트) | VCS  | 팀 공유 도구         |
| **user**    | `~/.dbcode/mcp.json`        | 개인 | 크로스 프로젝트 도구 |

### 17.4 MCP → dbcode 도구 브릿지

```typescript
// src/mcp/tool-bridge.ts
// MCP 서버의 도구를 dbcode Tool Registry에 자동 등록
class MCPToolBridge {
  // MCP 도구 정의를 dbcode ToolDefinition으로 변환
  bridgeTool(mcpTool: MCPToolDef): ToolDefinition { ... }

  // 지연 로딩: MCP 도구가 컨텍스트 10% 초과 시 자동 디퍼
  // ToolSearch로 필요할 때만 로드
  shouldDeferTools(totalTokens: number): boolean { ... }

  // list_changed 알림 처리 (도구 동적 업데이트)
  handleListChanged(serverId: string): void { ... }
}
```

### 17.5 MCP 리소스 멘션

`@server:protocol://resource/path` 형태로 MCP 리소스를 멘션에서 참조:

```
사용자: @postgres:sql://users/schema 이 테이블 구조 설명해줘
→ MCP 서버 'postgres'에서 리소스 조회 → 컨텍스트에 첨부
```

### 17.6 환경변수 확장

`.mcp.json`에서 `${VAR}` 및 `${VAR:-default}` 구문 지원:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "pg-mcp",
      "env": { "DB_URL": "${DATABASE_URL:-postgresql://localhost:5432/dev}" }
    }
  }
}
```

### 17.7 MCP 출력 제한

- 10,000 토큰 초과 시 경고
- `MAX_MCP_OUTPUT_TOKENS` 환경변수로 제한 설정
- 비정상적으로 큰 MCP 응답에 의한 컨텍스트 소모 방지

### 17.8 CLI 관리 명령어

```bash
dbcode mcp add <name> <command> [args...]    # 서버 추가
dbcode mcp add --transport http <name> <url>  # HTTP 서버 추가
dbcode mcp remove <name>                      # 서버 제거
dbcode mcp list                               # 서버 목록
dbcode mcp get <name>                         # 서버 상세 정보
dbcode mcp serve                              # dbcode를 MCP 서버로 노출
```

---

## 18. 백그라운드 태스크 시스템

### 18.1 개요

빌드, 테스트, 개발 서버 등 장시간 실행 명령을 백그라운드에서 돌리면서 대화를 계속할 수 있다.

### 18.2 사용 흐름

```
Ctrl+B (실행 중 명령을 백그라운드로)
  │
  ▼
┌──────────────────────┐
│ BackgroundRunner     │ ← 고유 TaskId 부여
│ - stdout/stderr 버퍼 │ ← OutputBuffer에 저장
│ - 상태 추적          │ ← running / completed / failed
│ - 자동 정리          │ ← 세션 종료 시
└──────────────────────┘
  │
  ▼ (완료 시 알림)
LLM: TaskOutput 도구로 결과 조회
```

### 18.3 TaskOutput 도구

```typescript
// src/tasks/task-output-tool.ts
// LLM이 백그라운드 태스크 결과를 조회하는 도구
interface TaskOutputParams {
  taskId: string;
  block?: boolean; // 완료까지 대기 (기본 true)
  timeout?: number; // 대기 최대 시간 (ms)
}
```

### 18.4 `run_in_background` 옵션

bash_exec 도구에 `run_in_background: true` 파라미터 추가:

- 명령을 즉시 백그라운드로 실행
- TaskId 반환
- 완료 시 자동 알림

---

## 19. Extended Thinking / Effort 제어

### 19.1 사고 깊이 레벨

| 레벨                 | 설명               | 토큰 예산 | 용도                  |
| -------------------- | ------------------ | --------- | --------------------- |
| `low`                | 최소 사고          | 1,000     | 단순 질문, 파일 읽기  |
| `medium`             | 기본 사고          | 8,000     | 일반 코딩 작업        |
| `high`               | 심층 사고 (기본값) | 32,000    | 복잡한 버그, 아키텍처 |
| `max` / `ultrathink` | 최대 사고          | 모델 한도 | 극도로 복잡한 추론    |

### 19.2 구현

```typescript
// 설정 스키마에 추가
thinking: z.object({
  defaultEffort: z.enum(["low", "medium", "high", "max"]).default("high"),
  maxThinkingTokens: z.number().default(32_000),
  enableToggle: z.boolean().default(true), // Alt+T 토글
});
```

### 19.3 전략

- LLM이 extended thinking을 지원하면: API의 thinking 파라미터 활용
- 미지원 시: 시스템 프롬프트에 "Think step by step" 변형 주입 + 응답 길이 조절
- `/effort [level]` 슬래시 명령으로 런타임 변경

---

## 20. 텔레메트리 / 모니터링

### 20.1 OpenTelemetry 통합

```typescript
// src/telemetry/metrics.ts
const metrics = {
  // 세션 메트릭
  sessionCount: counter("dbcode.sessions.total"),
  sessionDuration: histogram("dbcode.sessions.duration_seconds"),

  // 토큰 메트릭
  tokensUsed: counter("dbcode.tokens.total", { labels: ["type", "model"] }),
  tokenCost: counter("dbcode.cost.usd"),

  // 도구 메트릭
  toolInvocations: counter("dbcode.tools.invocations", {
    labels: ["tool", "status"],
  }),
  toolDuration: histogram("dbcode.tools.duration_ms"),
  toolDecisions: counter("dbcode.tools.decisions", {
    labels: ["tool", "decision"],
  }),

  // 에이전트 메트릭
  agentIterations: histogram("dbcode.agent.iterations_per_task"),
  linesOfCode: counter("dbcode.code.lines", { labels: ["action"] }), // added/removed/modified
};
```

### 20.2 내보내기 옵션

| 방법           | 용도                | 설정                               |
| -------------- | ------------------- | ---------------------------------- |
| **OTLP**       | Grafana, Datadog 등 | `OTEL_EXPORTER_OTLP_ENDPOINT`      |
| **Prometheus** | 자체 모니터링       | `OTEL_METRICS_EXPORTER=prometheus` |
| **Console**    | 디버깅              | `OTEL_METRICS_EXPORTER=console`    |
| **Off**        | 비활성화            | `DISABLE_TELEMETRY=true`           |

### 20.3 프롬프트 상관관계 (prompt.id)

각 사용자 프롬프트에 UUID를 부여하여 해당 프롬프트에서 발생한 모든 API 호출, 도구 실행, 에러를 추적 가능.

### 20.4 기업용 리소스 속성

```bash
OTEL_RESOURCE_ATTRIBUTES="department=engineering,team=backend,cost_center=CC-1234"
```

---

## 21. 기술 스택 총정리

### 런타임 & 빌드

| 패키지                          | 용도              |
| ------------------------------- | ----------------- |
| `typescript`                    | 언어              |
| `tsup`                          | ESM 빌드/번들링   |
| `vitest`                        | 테스트 프레임워크 |
| `eslint` + `@typescript-eslint` | 린팅              |
| `prettier`                      | 코드 포맷팅       |

### 핵심 의존성

| 패키지                       | 용도                                                 | 크기                  |
| ---------------------------- | ---------------------------------------------------- | --------------------- |
| `openai`                     | LLM 클라이언트 (baseURL 변경으로 모든 호환 API 지원) | ~100KB                |
| `ink` + `react`              | 터미널 UI                                            | ~200KB                |
| `zod`                        | 스키마 검증 (설정 + 도구 파라미터)                   | ~60KB                 |
| `zod-to-json-schema`         | Zod → JSON Schema (function calling)                 | ~10KB                 |
| `marked` + `marked-terminal` | 마크다운 터미널 렌더링                               | ~100KB                |
| `shiki`                      | 구문 강조 (VS Code 수준)                             | ~2MB (테마/문법 포함) |
| `commander`                  | CLI 인자 파싱                                        | ~30KB                 |
| `js-tiktoken`                | 토큰 카운팅 (정확)                                   | ~4MB                  |
| `mitt`                       | 타입드 이벤트 버스                                   | ~200B                 |
| `pino`                       | 구조화 로깅                                          | ~30KB                 |
| `glob`                       | 파일 패턴 검색                                       | ~30KB                 |
| `diff`                       | 유니파이드 diff 생성                                 | ~20KB                 |
| `chalk`                      | 터미널 색상                                          | ~10KB                 |
| `ora`                        | 스피너 (참고용, Ink 내장 가능)                       | ~15KB                 |

### 선택 의존성 (P1)

| 패키지                                              | 용도                                         |
| --------------------------------------------------- | -------------------------------------------- |
| `@vscode/ripgrep`                                   | ripgrep 바이너리 (크로스 플랫폼 grep)        |
| `tree-sitter-wasm`                                  | AST 기반 코드 분석 (repo map, 크로스 플랫폼) |
| `keytar`                                            | OS 키체인 접근 (토큰 안전 저장)              |
| `@modelcontextprotocol/sdk`                         | MCP 클라이언트 SDK                           |
| `@opentelemetry/api` + `@opentelemetry/sdk-metrics` | OpenTelemetry 메트릭                         |
| `http-proxy`                                        | 네트워크 샌드박스 (도메인 필터 프록시)       |

---

## 22. 스킬 시스템 상세

### 22.1 SKILL.md Frontmatter

```yaml
---
name: simplify
description: "변경된 파일의 코드 품질, 재사용성, 효율성을 리뷰"
argument-hint: "[파일 경로]"
user-invocable: true
disable-model-invocation: false # true면 사용자만 호출 가능 (/deploy 등)
allowed-tools: # 이 스킬이 사용할 수 있는 도구 제한
  - file_read
  - grep_search
  - glob_search
model: null # 특정 모델 강제 (비용 절약)
context: fork # 서브에이전트에서 격리 실행
agent: explore # context: fork 시 사용할 에이전트
hooks: [] # 스킬 범위 훅 (해당 스킬 실행 중에만)
---
```

### 22.2 동적 컨텍스트 주입

스킬 본문에서 `` `!command` `` 구문으로 셸 명령 결과를 동적 삽입:

```markdown
현재 git diff:
`!git diff --cached`

PR 정보:
`!gh pr view --json title,body`
```

- 스킬 활성화 시 명령 실행 → 결과로 치환 → LLM에 전달
- 실시간 데이터가 필요한 스킬에 필수 (PR 리뷰, 배포 상태 등)

### 22.3 인자 치환

| 변수                                | 설명               |
| ----------------------------------- | ------------------ |
| `$ARGUMENTS`                        | 전체 인자 문자열   |
| `$0`, `$1`, `$2`...                 | 위치별 인자        |
| `$ARGUMENTS[0]`, `$ARGUMENTS[1]`... | 위치별 인자 (배열) |
| `${DBCODE_SESSION_ID}`              | 현재 세션 ID       |
| `${DBCODE_SKILL_DIR}`               | 스킬 디렉토리 경로 |
| `${DBCODE_PROJECT_DIR}`             | 프로젝트 루트 경로 |

### 22.4 설명 예산 관리

- 스킬 설명은 컨텍스트 윈도우의 2%까지만 사용 (폴백: 16,000자)
- `SKILL_DESCRIPTION_CHAR_BUDGET` 환경변수로 오버라이드
- Frontmatter만 초기 로딩 (~100 토큰), 활성화 시 전체 본문 로딩
- 스킬이 많을 때 컨텍스트 비대화 방지

### 22.5 번들 스킬

| 스킬        | 기능                        | 구현                                     |
| ----------- | --------------------------- | ---------------------------------------- |
| `/simplify` | 변경 파일의 코드 품질 리뷰  | 3개 병렬 에이전트 (품질, 재사용, 효율성) |
| `/batch`    | 대규모 병렬 코드베이스 변경 | 5-30개 유닛으로 분해, 워크트리 격리      |
| `/debug`    | 세션 디버그 로그 분석       | 디버그 로그 읽고 문제 진단               |

### 22.6 Agent Skills 표준

dbcode 스킬은 [agentskills.io](https://agentskills.io) 오픈 표준을 따라, Claude Code, Codex CLI, Gemini CLI 등 다른 도구와 스킬 호환 가능.

---

## 23. Repository Map (코드베이스 인덱싱)

### 23.1 개요

tree-sitter AST를 활용하여 전체 코드베이스의 구조(클래스, 함수, 호출 관계)를 토큰 예산 내에서 최적화된 맵으로 생성한다.

### 23.2 구현 전략

```
소스 코드 → tree-sitter 파싱 → AST 추출 → 그래프 구축 → PageRank 랭킹
                                                              │
                                                    토큰 예산 내 상위 N개
                                                              │
                                                    시스템 프롬프트에 주입
```

### 23.3 핵심 컴포넌트

```typescript
// src/indexing/repo-map.ts (P1 - v1.0)
interface RepoMapConfig {
  maxTokens: number; // 맵에 할당할 최대 토큰 (기본: 2048)
  languages: string[]; // 지원 언어 (tree-sitter grammar)
  excludePatterns: string[]; // .gitignore + 커스텀 제외
}

// 출력 예시:
// src/core/agent-loop.ts
//   ├── runAgentLoop(config, conversation) → Conversation
//   ├── consumeStream(stream, handlers) → LLMResponse
// src/tools/registry.ts
//   ├── class ToolRegistry
//   │   ├── getDefinitionsForLLM() → OpenAIToolDef[]
//   │   ├── execute(call) → ToolResult
```

### 23.4 벤치마크 (Aider 참조)

- Aider의 repo-map: 컨텍스트 효율성 40% 향상
- 파일 100개+ 프로젝트에서 관련 코드 식별 정확도 대폭 개선
- tree-sitter-wasm 사용으로 네이티브 바이너리 없이 크로스 플랫폼 지원

---

## 24. 구현 로드맵

### Phase 1: Foundation (기초) — 주 1-2

**목표**: 최소 동작하는 채팅 CLI

| #   | 작업                   | 산출물                                         |
| --- | ---------------------- | ---------------------------------------------- |
| 1   | 프로젝트 스캐폴딩      | package.json, tsconfig, tsup, ESM, `--version` |
| 2   | Config 시스템          | schema.ts, loader.ts, defaults.ts              |
| 3   | Auth 시스템            | token-manager.ts, token-store.ts               |
| 4   | LLM 클라이언트         | client.ts, streaming.ts, provider.ts           |
| 5   | 기본 Ink CLI           | App.tsx, UserInput, StreamingMessage           |
| 6   | 대화 상태              | conversation.ts (불변)                         |
| 7   | 마크다운 렌더링        | markdown.ts, syntax.ts                         |
| 8   | Extended Thinking 기본 | effort 레벨 설정, 시스템 프롬프트 조절         |

**검증**: `npx dbcode` → 메시지 입력 → 스트리밍 응답 마크다운 렌더링, `dbcode --version` 출력

### Phase 2: Tool System (도구) — 주 3-4

**목표**: LLM이 도구를 호출하여 코드를 읽고 수정 가능

| #   | 작업                      | 산출물                                        |
| --- | ------------------------- | --------------------------------------------- |
| 1   | Tool 타입 + Registry      | types.ts, registry.ts, validation.ts          |
| 2   | 7개 P0 도구 구현          | definitions/ 디렉토리                         |
| 3   | Tool Executor             | executor.ts (타임아웃, 에러 핸들링)           |
| 4   | Native Function Calling   | native-function-calling.ts                    |
| 5   | Agentic Loop              | agent-loop.ts (ReAct while-loop)              |
| 6   | Permission 시스템 (5모드) | manager.ts, rules.ts, modes.ts (dontAsk 포함) |
| 7   | ToolCallBlock UI          | ToolCallBlock.tsx, PermissionPrompt.tsx       |
| 8   | 시스템 프롬프트 빌더      | system-prompt-builder.ts                      |
| 9   | `!` Bash 모드             | ! 접두사 직접 실행, 출력 컨텍스트 첨부        |
| 10  | 백그라운드 태스크 기본    | run_in_background, Ctrl+B, TaskOutput 도구    |

**검증**: "이 파일을 읽고 함수 이름을 바꿔줘" → LLM이 file_read → file_edit 순서로 호출

### Phase 3: Resilience (안정성) — 주 5-6

**목표**: 세션 영속성, 컨텍스트 관리, 폴백 전략

| #   | 작업                  | 산출물                                                            |
| --- | --------------------- | ----------------------------------------------------------------- |
| 1   | 세션 저장/복원        | session-manager.ts (JSONL)                                        |
| 2   | 세션 이름 지정/검색   | /rename, 자동 이름 생성                                           |
| 3   | 컨텍스트 매니저       | context-manager.ts (자동 압축 + 타겟 요약)                        |
| 4   | 체크포인팅 + 리와인드 | checkpoint-manager.ts ("여기서부터 요약" 포함)                    |
| 5   | Text Parsing 폴백     | text-parsing.ts (XML)                                             |
| 6   | 전략 자동 감지        | tool-call-strategy.ts                                             |
| 7   | DBCODE.md 로더        | instructions/loader.ts, @import 구문                              |
| 8   | 슬래시 명령어 (P0)    | /clear, /compact, /help, /model, /resume, /rewind, /effort, /fast |
| 9   | 에러 복구             | classify-retry-fallback 패턴                                      |
| 10  | 폴백 모델 자동 전환   | 오버로드 감지 → fallbackModel 전환                                |
| 11  | 메시지 큐잉           | 실행 중 다음 지시 타이핑 → FIFO 큐                                |

**검증**: 세션 종료 후 `--continue`로 재개, /rewind "여기서부터 요약", 메시지 큐잉 동작

### Phase 4: Security (보안) — 주 7-8

**목표**: 프로덕션 수준의 보안 가드레일

| #   | 작업                       | 산출물                                  |
| --- | -------------------------- | --------------------------------------- |
| 1   | 시크릿 스캐너              | secret-scanner.ts (15+ 패턴 + 엔트로피) |
| 2   | 입력/출력 필터             | input-filter.ts, output-filter.ts       |
| 3   | 감사 로그                  | audit-logger.ts (SHA-256 해시 체인)     |
| 4   | 속도 제한 + 토큰 예산      | rate-limiter.ts, token-budget.ts        |
| 5   | OS 샌드박스 (macOS)        | macos-seatbelt.ts                       |
| 6   | OS 샌드박스 (Windows)      | windows-appcontainer.ts                 |
| 7   | 네트워크 샌드박스 (프록시) | 도메인 허용 목록 기반 프록시 필터링     |
| 8   | .dbcodeignore              | 시크릿 스캔 제외 패턴                   |
| 9   | 보안 프로파일 분기         | local vs external 자동 전환             |
| 10  | USD 예산 한도              | `--max-budget-usd` (헤드리스 모드)      |

**검증**: 외부 LLM 모드에서 API 키 포함 파일 읽기 → 자동 마스킹, 네트워크 프록시 차단 확인

### Phase 5: Extensibility (확장성) — 주 9-11

**목표**: 훅, 스킬, 서브에이전트, MCP, 태스크 관리

| #   | 작업                            | 산출물                                            |
| --- | ------------------------------- | ------------------------------------------------- |
| 1   | 훅 시스템 (17 이벤트, 4 핸들러) | hooks/runner.ts (command, http, prompt, agent)    |
| 2   | 스킬 시스템 (frontmatter 전체)  | skills/loader.ts, executor.ts, 동적 컨텍스트 주입 |
| 3   | 번들 스킬                       | /simplify, /batch, /debug                         |
| 4   | 서브에이전트                    | spawner.ts, explore.ts, plan.ts, general.ts       |
| 5   | 태스크 매니저                   | task-manager.ts, TaskListView.tsx                 |
| 6   | MCP 클라이언트                  | mcp/client.ts (stdio, HTTP, SSE 트랜스포트)       |
| 7   | MCP 도구 브릿지                 | mcp/tool-bridge.ts (지연 로딩, list_changed)      |
| 8   | MCP CLI 관리                    | dbcode mcp add/remove/list/serve                  |
| 9   | 모델 라우팅 (Hybrid)            | model-router.ts                                   |
| 10  | 규칙 디렉토리                   | .dbcode/rules/ 경로 기반 로딩                     |
| 11  | @ 멘션 시스템 + MCP 리소스      | mentions/ + MCP 리소스 멘션                       |
| 12  | 키바인딩 커스터마이징           | useKeybindings.ts + 설정 파일                     |
| 13  | 헤드리스 모드 (-p)              | print mode, stream-json, 구조화 출력              |
| 14  | 알림 시스템                     | Notification 훅, 터미널 알림                      |
| 15  | 디버그/Verbose 모드             | --debug (카테고리), --verbose                     |

**검증**: MCP 서버 연결 → 도구 자동 등록, 번들 스킬 /simplify 실행, HTTP 훅 동작

### Phase 6: Intelligence (지능) — 주 12-13

**목표**: Repository Map, 텔레메트리, 코드 인텔리전스

| #   | 작업                      | 산출물                                           |
| --- | ------------------------- | ------------------------------------------------ |
| 1   | Repository Map            | indexing/repo-map.ts (tree-sitter + 그래프 랭킹) |
| 2   | OpenTelemetry 통합        | telemetry/otel-exporter.ts (OTLP, Prometheus)    |
| 3   | /config 대화형 UI         | commands/config.ts (설정 탐색/수정)              |
| 4   | /diff 대화형 뷰어         | 좌우 화살표, 파일 탐색                           |
| 5   | /doctor 진단              | 설치/설정/연결 검증                              |
| 6   | /stats 사용량 시각화      | 일별 사용량, 세션, 모델 선호                     |
| 7   | /context 시각화           | 컨텍스트 사용량 컬러 그리드                      |
| 8   | 출력 스타일               | /output-style (기본, 설명, 학습, 커스텀)         |
| 9   | 자동 린트+테스트 루프     | PostToolUse → 린트 실행 → 실패 시 LLM에 피드백   |
| 10  | `--add-dir` 다중 디렉토리 | 모노레포/멀티레포 지원                           |

**검증**: repo-map이 토큰 예산 내 관련 코드 자동 선택, OTel 메트릭 내보내기 확인

### Phase 7: Polish & Testing (마무리) — 주 14-16

**목표**: 테스트 80%+, 문서화, 배포, 고급 기능

| #   | 작업                 | 산출물                                           |
| --- | -------------------- | ------------------------------------------------ |
| 1   | 단위 테스트          | 모든 모듈 80%+ 커버리지                          |
| 2   | 통합 테스트          | agent-loop, permission-flow, tool-execution, MCP |
| 3   | E2E 테스트           | 주요 사용자 시나리오                             |
| 4   | StatusBar 완성       | 토큰 사용량, 컨텍스트 %, 모델, effort 레벨       |
| 5   | 테마 시스템          | dark/light/auto/colorblind-accessible            |
| 6   | dbcode update 명령   | 자동 업데이트                                    |
| 7   | npm 배포             | bin/dbcode.mjs, package.json bin 필드            |
| 8   | 에어갭 배포          | npm pack + 오프라인 설치 가이드                  |
| 9   | GitHub Actions 래퍼  | CI/CD에서 dbcode 실행                            |
| 10  | 플러그인 시스템 기초 | plugins/loader.ts, manifest.ts (P2)              |

**검증**: `vitest --coverage` 80%+, `npm pack` → 에어갭 환경 설치/실행, GitHub Actions 동작

---

## 25. 크로스 플랫폼 체크리스트

| 영역              | Windows                             | macOS                | 해결 방법                          |
| ----------------- | ----------------------------------- | -------------------- | ---------------------------------- |
| 경로 구분자       | `\`                                 | `/`                  | 내부: `/` 정규화, path.ts 유틸     |
| 셸                | PowerShell/cmd/Git Bash             | bash/zsh             | `tools.bashShell` 설정 + 자동 감지 |
| 샌드박스          | AppContainer + Job Objects          | sandbox-exec         | platform.ts 분기                   |
| 네트워크 샌드박스 | 프록시 (도메인 필터)                | 프록시 (도메인 필터) | 동일한 프록시 기반 구현            |
| 키체인            | Credential Manager                  | Keychain             | keytar 패키지                      |
| ANSI 색상         | Windows Terminal (전체), cmd (16색) | 전체 지원            | chalk 자동 감지                    |
| 멀티라인 입력     | Shift+Enter 불안정                  | 정상                 | `\` 연속 우선                      |
| 파일 잠금         | 엄격한 잠금                         | 유연                 | 재시도 + 에러 핸들링               |
| ripgrep           | @vscode/ripgrep 바이너리            | 동일                 | 크로스 플랫폼 npm 패키지           |
| tree-sitter       | tree-sitter-wasm                    | tree-sitter-wasm     | WASM으로 네이티브 바이너리 불필요  |
| 유니코드          | Windows Terminal (OK), cmd (이슈)   | OK                   | fallback ASCII 문자                |
| 관리형 설정       | Windows Registry                    | plist / MDM          | platform.ts 분기                   |

---

## 26. 검증 기준

### MVP (Phase 1-2 완료)

- [ ] `npx dbcode` 실행하여 대화형 CLI 진입
- [ ] `dbcode --version` 버전 출력
- [ ] 스트리밍 응답이 마크다운 + 구문 강조로 렌더링
- [ ] LLM이 file_read, file_edit, bash_exec 도구를 호출하여 코드 수정
- [ ] 권한 확인 프롬프트 [y/n/a] 동작 (5개 모드)
- [ ] ! bash 모드로 직접 명령 실행
- [ ] Ctrl+B 백그라운드 태스크
- [ ] Windows + macOS 양 플랫폼에서 동일 동작

### v1.0 (Phase 1-5 완료)

- [ ] 세션 저장/복원/리와인드/이름 지정 동작
- [ ] 자동 컨텍스트 압축 (95% 임계값) + 타겟 요약
- [ ] 외부 LLM 모드에서 시크릿 마스킹 + 감사 로그 + 네트워크 프록시
- [ ] OS 샌드박스 (macOS + Windows)
- [ ] function calling 미지원 LLM에서 XML 폴백 동작
- [ ] MCP 서버 연결 및 도구 자동 등록
- [ ] 17개 훅 이벤트 + 4개 핸들러 타입
- [ ] 스킬 시스템 + 번들 스킬 (/simplify, /batch, /debug)
- [ ] 서브에이전트 (Explore, Plan, General)
- [ ] 헤드리스 모드 (-p, stream-json, --json-schema)
- [ ] --max-budget-usd, --max-turns

### v2.0 (Phase 1-7 완료)

- [ ] Repository Map (tree-sitter 기반 코드 인텔리전스)
- [ ] OpenTelemetry 메트릭 내보내기
- [ ] 자동 린트+테스트 피드백 루프
- [ ] GitHub Actions CI/CD 통합
- [ ] 테마 시스템 (colorblind-accessible 포함)
- [ ] 플러그인 시스템 기초
- [ ] 단위 테스트 80%+ 커버리지
- [ ] npm 배포 + 에어갭 설치

### v3.0 (향후)

- [ ] 플러그인 마켓플레이스
- [ ] Agent Teams (다중 세션 협업)
- [ ] VS Code 확장
- [ ] Chrome 브라우저 통합
- [ ] Vim 모드
- [ ] 원격 제어

---

## 27. CLI 경쟁사 분석 요약

### 주요 경쟁사 차별점 (CLI 도구만)

| 경쟁사         | 핵심 차별화                                                        | dbcode 대응                                                 |
| -------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Aider**      | Architect/Editor 이중 모델, repo-map (tree-sitter), 자동 린트+수정 | Phase 6 repo-map, Hybrid 모델 라우팅, PostToolUse 린트 루프 |
| **Codex CLI**  | Agent Skills 표준 공유, CSV fan-out 다중 에이전트                  | 22.6 agentskills.io 표준 준수                               |
| **Gemini CLI** | Google Search 내장, 1M 토큰 컨텍스트, 무료 티어                    | MCP 검색 도구로 대응, 로컬 LLM 무제한                       |
| **Cline CLI**  | ACP 크로스 에디터 프로토콜, stdin/stdout 파이프라인                | 헤드리스 모드 + 파이프 입력                                 |
| **Goose**      | Recipes (YAML 워크플로우), 25+ LLM 프로바이더                      | 스킬 시스템으로 대응, OpenAI 호환으로 다수 지원             |
| **OpenHands**  | 이벤트 소싱 상태, 컨테이너 격리, Software Agent SDK                | 샌드박스 + 서브에이전트 격리                                |
| **SWE-Agent**  | ACI (코드 특화 인터페이스), 클라우드 원격 실행                     | 도구 시스템 + 폐쇄망 배포                                   |
| **Amazon Q**   | 셸 명령 자동완성, AWS 네이티브 통합                                | ! bash 모드 + 히스토리 기반 자동완성                        |

### 업계 공통 패턴 (6개+ 도구에서 채택)

| 패턴                                  | 채택 도구 수 | dbcode 상태                    |
| ------------------------------------- | ------------ | ------------------------------ |
| MCP (Model Context Protocol)          | 7+           | ✅ Phase 5에 포함              |
| 프로젝트 지시사항 파일 (CLAUDE.md 등) | 4+           | ✅ DBCODE.md 설계 완료         |
| 멀티 모델 / 벤더 비종속               | 6+           | ✅ OpenAI 호환 + Hybrid 라우팅 |
| Git 네이티브 워크플로우               | 4+           | ✅ 도구 기반 Git 지원          |
| Plan 모드 / 승인 게이팅               | 3+           | ✅ plan 권한 모드              |
| 로컬 모델 지원 (Ollama)               | 4+           | ✅ 핵심 설계 원칙              |
| 샌드박스 / 권한 승인                  | 3+           | ✅ 6계층 보안 모델             |
| CI/CD 헤드리스 모드                   | 4+           | ✅ Phase 5, Phase 7            |
| 자동 린트/테스트 피드백 루프          | 2+           | ✅ Phase 6                     |
| 세션 메모리 지속성                    | 3+           | ✅ DBCODE.md + 자동 메모리     |

---

## 부록 A: 참고 리서치 문서

| 문서                                    | 내용                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| `docs/research-claude-code-features.md` | Claude Code 100+ 기능 분석 및 P0/P1/P2 우선순위                 |
| `docs/research-agentic-patterns.md`     | ReAct, Plan-Execute, 오픈소스 에이전트 비교, 코드 편집 알고리즘 |
| `docs/research-security-guardrails.md`  | OWASP LLM Top 10, 위협 모델, 6계층 방어, 크로스 플랫폼 샌드박스 |
| `docs/research-llm-integration.md`      | OpenAI 호환 서버 비교, 코딩 LLM 벤치마크, 에어갭 배포           |
| `docs/research-cli-ux.md`               | 터미널 UI 프레임워크, 스트리밍 렌더링, Windows 호환성           |
| `docs/gap-analysis.md`                  | Claude Code + CLI 경쟁사 대비 Gap 분석 (v3.0)                   |

## 부록 B: 버전 히스토리

| 버전 | 날짜       | 변경                                                                                                                        |
| ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| v1.0 | 2026-03-05 | 초기 아키텍처 플랜                                                                                                          |
| v2.0 | 2026-03-05 | 5인 에이전트 팀 리서치 기반 고도화                                                                                          |
| v3.0 | 2026-03-05 | Gap Analysis 반영 (MCP, 백그라운드 태스크, 텔레메트리, Extended Thinking, 스킬 상세, Repo Map, 경쟁사 분석, 훅 17개 이벤트) |
