# Source Reference 문서화 계획

> 작성일: 2026-03-21
> dbcode 프로젝트의 모든 핵심 TypeScript 모듈을 초보자도 이해할 수 있도록 구조화된 문서로 작성하는 계획입니다.

---

## 1. 전체 모듈 계층 다이어그램

### 1-1. 최상위 오케스트레이션 흐름

```mermaid
graph TD
    INDEX["🚀 index.ts<br/>Bootstrap Entry Point"]

    INDEX --> APP["🖥️ App.tsx<br/>CLI Root Component"]
    INDEX --> HEADLESS["📋 headless.ts<br/>--print 모드"]
    INDEX --> CONFIG_LOAD["⚙️ config/loader.ts<br/>5-Layer 설정 병합"]
    INDEX --> MCP_MGR["🔌 mcp/manager.ts<br/>MCP 서버 연결"]

    APP --> HOOK_AL["useAgentLoop"]
    APP --> HOOK_CV["useConversation"]
    APP --> HOOK_KB["useKeybindings"]

    HOOK_AL --> AGENT["🧠 agent-loop.ts<br/>ReAct 메인 루프"]

    AGENT --> LLM["📡 llm/client.ts"]
    AGENT --> TOOLS_EXEC["⚡ tools/executor.ts"]
    AGENT --> PERM["🔐 permissions/manager.ts"]
    AGENT --> CTX["📦 context-manager.ts"]
    AGENT --> GUARD["🛡️ guardrails/"]
    AGENT --> CIRCUIT["🔄 circuit-breaker.ts"]
    AGENT --> RECOVER["🚑 recovery-executor.ts"]
    AGENT --> OBS["👁️ observation-masking.ts"]
    AGENT --> CKPT["💾 checkpoint-manager.ts"]

    style INDEX fill:#1a2035,stroke:#64748b,color:#f1f5f9
    style AGENT fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
    style APP fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9
    style CTX fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
```

### 1-2. Agent Loop 중심 — 하위 모듈 의존 관계

```mermaid
graph TD
    subgraph CORE["⚙️ Layer 2: Core"]
        AGENT["🧠 agent-loop.ts<br/>━━━━━━━━━━━━━<br/>ReAct 패턴 메인 루프<br/>모든 실행의 허브"]
        CTX["📦 context-manager.ts<br/>━━━━━━━━━━━━━<br/>3-Layer 압축<br/>Cold Storage"]
        CIRCUIT["🔄 circuit-breaker.ts<br/>━━━━━━━━━━━━━<br/>무한 루프 감지<br/>closed/open 상태"]
        RECOVER["🚑 recovery-executor.ts<br/>━━━━━━━━━━━━━<br/>에러 유형별 복구<br/>compact/retry/fallback"]
        PROMPT["📝 system-prompt-builder.ts<br/>━━━━━━━━━━━━━<br/>동적 프롬프트 조립<br/>SHA-256 캐시"]
        CKPT["💾 checkpoint-manager.ts<br/>━━━━━━━━━━━━━<br/>파일 상태 스냅샷<br/>/undo, /rewind"]
        OBS["👁️ observation-masking.ts<br/>━━━━━━━━━━━━━<br/>읽기 전용 출력 마스킹<br/>컨텍스트 절약"]
        SESSION["📋 session-manager.ts<br/>세션 상태 관리"]
        TASK["✅ task-manager.ts<br/>태스크 추적"]
        ACTIVITY["📊 activity.ts<br/>활동 수집"]
        AUTO_MEM["🧠 auto-memory.ts<br/>자동 메모리 수집"]
        REVIEW["🔍 code-review-agent.ts<br/>코드 리뷰 프롬프트"]
    end

    AGENT --> CTX
    AGENT --> CIRCUIT
    AGENT --> RECOVER
    AGENT --> OBS
    AGENT --> CKPT
    CTX --> PROMPT

    style CORE fill:#0d0d1a,stroke:#8b5cf6,color:#f1f5f9
    style AGENT fill:#3b1e6e,stroke:#a78bfa,color:#f1f5f9
    style CTX fill:#2a1e4a,stroke:#8b5cf6,color:#f1f5f9
```

### 1-3. LLM 클라이언트 계층

```mermaid
graph TD
    subgraph LLM["📡 Layer 3: LLM"]
        PROVIDER["🔌 provider.ts<br/>━━━━━━━━━━━<br/>LLMProvider 인터페이스<br/>ChatMessage, ChatRequest"]
        CLIENT["📡 client.ts<br/>━━━━━━━━━━━<br/>OpenAI 호환 클라이언트<br/>스트리밍, 재시도, URL 정규화"]
        RESP_CLIENT["📡 responses-client.ts<br/>Responses API 클라이언트"]
        FACTORY["🏭 client-factory.ts<br/>클라이언트 인스턴스 생성"]
        ROUTER["🔀 model-router.ts<br/>모델 선택 라우팅"]
        DUAL["🔀 dual-model-router.ts<br/>━━━━━━━━━━━<br/>Architect/Editor 전환<br/>키워드 기반 Phase 감지"]
        STRATEGY["🎯 tool-call-strategy.ts<br/>━━━━━━━━━━━<br/>도구 호출 전략 선택<br/>native/text-parsing/two-stage"]
        CAPS["📊 model-capabilities.ts<br/>모델별 기능 매트릭스"]
        TOKEN["🔢 token-counter.ts<br/>토큰 계산"]
        COST["💰 cost-tracker.ts<br/>비용 추적"]
        STREAM["🌊 streaming.ts<br/>SSE 스트림 처리"]
        THINKING["🧠 thinking-budget.ts<br/>Thinking 토큰 제한"]
    end

    subgraph STRATEGIES["전략 구현체"]
        NATIVE["native-function-calling.ts"]
        TEXT_PARSE["text-parsing.ts"]
        TWO_STAGE["two-stage-tool-call.ts"]
    end

    FACTORY --> CLIENT
    FACTORY --> RESP_CLIENT
    CLIENT --> PROVIDER
    RESP_CLIENT --> PROVIDER
    DUAL --> FACTORY
    STRATEGY --> NATIVE & TEXT_PARSE & TWO_STAGE
    CLIENT --> CAPS
    CLIENT --> TOKEN

    style LLM fill:#0d0d1a,stroke:#3b82f6,color:#f1f5f9
    style PROVIDER fill:#1e2a4a,stroke:#60a5fa,color:#f1f5f9
    style CLIENT fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9
```

### 1-4. Tool System 계층

```mermaid
graph TD
    subgraph TOOLS["🔧 Layer 3: Tools"]
        TYPES["📋 types.ts<br/>━━━━━━━━━━━<br/>ToolDefinition<br/>ToolContext, ToolResult"]
        REGISTRY["📚 registry.ts<br/>━━━━━━━━━━━<br/>도구 등록/조회<br/>Hot Tools + Deferred"]
        EXECUTOR["⚡ executor.ts<br/>━━━━━━━━━━━<br/>도구 실행 엔진<br/>Zod 검증, 재시도"]
        ADAPTIVE["📐 adaptive-schema.ts<br/>모델 티어별 스키마 조절"]
        CORRECTOR["🔧 tool-call-corrector.ts<br/>Low Tier 자동 교정"]
        RETRY["♻️ tool-retry.ts<br/>일시적 에러 재시도"]
        LAZY["💤 lazy-tool-loader.ts<br/>MCP 도구 지연 로딩"]
        VALID["✅ validation.ts<br/>Zod → JSON Schema 변환"]
    end

    subgraph DEFS["📦 16 Built-in Tools"]
        FILE_R["file_read"]
        FILE_W["file_write"]
        FILE_E["file_edit"]
        BASH["bash_exec"]
        GLOB["glob_search"]
        GREP["grep_search"]
        WEB_F["web_fetch"]
        WEB_S["web_search"]
        ASK["ask_user"]
        AGENT_T["agent"]
        TODO["todo_write"]
        OTHERS["mkdir, list_dir,<br/>kill_shell, bash_output,<br/>notebook_edit"]
    end

    REGISTRY --> TYPES
    EXECUTOR --> REGISTRY
    EXECUTOR --> CORRECTOR
    EXECUTOR --> RETRY
    ADAPTIVE --> TYPES
    LAZY --> REGISTRY
    DEFS --> TYPES

    style TOOLS fill:#0d0d1a,stroke:#10b981,color:#f1f5f9
    style REGISTRY fill:#0d2a1a,stroke:#10b981,color:#f1f5f9
    style EXECUTOR fill:#0d2a1a,stroke:#10b981,color:#f1f5f9
```

### 1-5. Permission + Guardrails + MCP 계층

```mermaid
graph TD
    subgraph PERM["🔐 Permissions"]
        PERM_MGR["manager.ts<br/>5단계 결정 트리"]
        MODES["modes.ts<br/>모드별 검사"]
        RULES["rules.ts<br/>규칙 매칭"]
        SESSION_S["session-store.ts<br/>세션 승인 저장"]
        PERSIST_S["persistent-store.ts<br/>영속 규칙 저장"]
        PATTERN["pattern-parser.ts<br/>패턴 파싱"]
        AUDIT["audit-log.ts<br/>감사 로그"]
    end

    subgraph GUARD["🛡️ Guardrails"]
        SECRET["secret-scanner.ts<br/>비밀 키 감지"]
        ENTROPY["entropy-scanner.ts<br/>고엔트로피 감지"]
        INJECT["injection-detector.ts<br/>프롬프트 인젝션"]
        PATH_F["path-filter.ts<br/>경로 검증"]
        CMD_F["command-filter.ts<br/>명령 검증"]
        OUT_LIM["output-limiter.ts<br/>출력 제한"]
    end

    subgraph MCP["🔌 MCP"]
        MCP_MGR["manager.ts<br/>서버 수명주기"]
        MCP_CONN["manager-connector.ts<br/>연결 핸들러"]
        MCP_CLIENT["client.ts<br/>JSON-RPC 통신"]
        MCP_BRIDGE["tool-bridge.ts<br/>MCP → 내부 도구 변환"]
        MCP_SEARCH["tool-search.ts<br/>지연 도구 검색"]
        MCP_SCOPE["scope-manager.ts<br/>3-Scope 설정"]
        MCP_TRANS["transports/<br/>stdio, http, sse"]
    end

    PERM_MGR --> MODES & RULES & SESSION_S & PERSIST_S & PATTERN & AUDIT
    MCP_MGR --> MCP_CONN --> MCP_CLIENT --> MCP_TRANS
    MCP_CONN --> MCP_BRIDGE --> MCP_SEARCH

    style PERM fill:#0d0d1a,stroke:#f59e0b,color:#f1f5f9
    style GUARD fill:#0d0d1a,stroke:#ef4444,color:#f1f5f9
    style MCP fill:#0d0d1a,stroke:#ec4899,color:#f1f5f9
```

### 1-6. Leaf Layer (Config, Instructions, Memory, Utils)

```mermaid
graph TD
    subgraph LEAF["🍃 Layer 4: Leaf Modules"]
        subgraph CFG["Config"]
            CFG_LOAD["loader.ts<br/>5-Layer 병합"]
            CFG_DEF["defaults.ts<br/>기본값"]
            CFG_SCH["schema.ts<br/>Zod 검증"]
        end
        subgraph INSTR["Instructions"]
            INSTR_LOAD["loader.ts<br/>6단계 DBCODE.md 로딩"]
            INSTR_PARSE["parser.ts<br/>import 구문 해석"]
            INSTR_PATH["path-matcher.ts<br/>경로 조건부 규칙"]
        end
        subgraph MEM["Memory"]
            MEM_MGR["manager.ts<br/>메모리 CRUD"]
            MEM_LOAD["loader.ts<br/>파일 읽기"]
            MEM_WRITE["writer.ts<br/>파일 쓰기"]
            MEM_PATH["paths.ts<br/>해시 기반 경로"]
        end
        subgraph SKILL["Skills"]
            SKILL_MGR["manager.ts<br/>스킬 레지스트리"]
            SKILL_EXEC["executor.ts<br/>스킬 실행"]
            SKILL_LOAD["loader.ts<br/>동적 로딩"]
            SKILL_BRIDGE["command-bridge.ts<br/>명령어 변환"]
        end
        subgraph UTIL["Utils"]
            UTIL_ERR["error.ts<br/>에러 계층"]
            UTIL_LOG["logger.ts<br/>Pino 로거"]
            UTIL_PATH["path.ts<br/>경로 유틸"]
            UTIL_EVT["events.ts<br/>이벤트 버스"]
            UTIL_PLAT["platform.ts<br/>OS 감지"]
        end
    end

    style LEAF fill:#0d0d1a,stroke:#f59e0b,color:#f1f5f9
```

### 1-7. CLI Layer (컴포넌트 + 훅)

```mermaid
graph TD
    subgraph CLI["🖥️ Layer 1: CLI"]
        APP["App.tsx<br/>루트 컴포넌트"]

        subgraph HOOKS["React Hooks"]
            H_AL["useAgentLoop<br/>Agent Loop 브릿지"]
            H_CV["useConversation<br/>대화 상태"]
            H_KB["useKeybindings<br/>키보드 단축키"]
            H_PP["usePermissionPrompt<br/>권한 프롬프트"]
            H_ST["useStreaming<br/>스트림 렌더링"]
            H_TB["useTextBuffering<br/>텍스트 버퍼링"]
            H_VC["useVoice<br/>음성 입력"]
        end

        subgraph COMP["22 Components"]
            C_AF["ActivityFeed"]
            C_TB["TurnBlock"]
            C_TC["ToolCallBlock"]
            C_SM["StreamingMessage"]
            C_SB["StatusBar"]
            C_UI["UserInput"]
            C_TH["ThinkingBlock"]
            C_PP["PermissionPrompt"]
            C_EB["ErrorBoundary"]
            C_ETC["... 13 more"]
        end
    end

    APP --> HOOKS
    APP --> COMP

    style CLI fill:#0d0d1a,stroke:#3b82f6,color:#f1f5f9
    style APP fill:#1e2a4a,stroke:#3b82f6,color:#f1f5f9
```

---

## 2. 문서화 순서 (의존성 기반 Bottom-Up)

문서는 **의존성이 적은 Leaf 모듈부터 시작하여 Hub 모듈로** 올라가는 순서로 작성합니다.
이유: 하위 모듈을 먼저 문서화하면, 상위 모듈 문서에서 "관련 문서" 링크를 걸 수 있습니다.

### Phase 1: Foundation (Leaf — 의존성 0)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 1 | Circuit Breaker | `src/core/circuit-breaker.ts` | `/docs/circuit-breaker` | ★☆☆ | 짧음 |
| 2 | Token Counter | `src/llm/token-counter.ts` | `/docs/token-counter` | ★☆☆ | 짧음 |
| 3 | Model Capabilities | `src/llm/model-capabilities.ts` | `/docs/model-capabilities` | ★☆☆ | 중간 |
| 4 | Cost Tracker | `src/llm/cost-tracker.ts` | `/docs/cost-tracker` | ★☆☆ | 짧음 |
| 5 | Error Hierarchy | `src/utils/error.ts` | `/docs/error-types` | ★☆☆ | 중간 |
| 6 | Event Bus | `src/utils/events.ts` | `/docs/events` | ★☆☆ | 짧음 |

### Phase 2: Security & Validation (독립적 필터)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 7 | Secret Scanner | `src/guardrails/secret-scanner.ts` | `/docs/secret-scanner` | ★☆☆ | 짧음 |
| 8 | Injection Detector | `src/guardrails/injection-detector.ts` | `/docs/injection-detector` | ★★☆ | 중간 |
| 9 | Path Filter | `src/guardrails/path-filter.ts` | `/docs/path-filter` | ★☆☆ | 짧음 |
| 10 | Command Filter | `src/guardrails/command-filter.ts` | `/docs/command-filter` | ★☆☆ | 짧음 |
| 11 | Guardrails Index | `src/guardrails/index.ts` | `/docs/guardrails` | ★★☆ | 중간 |

### Phase 3: Config & Loading (설정 계층)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 12 | Config Defaults | `src/config/defaults.ts` | `/docs/config-defaults` | ★☆☆ | 짧음 |
| 13 | Config Loader | `src/config/loader.ts` | `/docs/config-loader` | ★★☆ | 중간 |
| 14 | Instruction Loader | `src/instructions/loader.ts` | `/docs/instruction-loader` | ★★☆ | 중간 |
| 15 | Skill Manager | `src/skills/manager.ts` | `/docs/skill-manager` | ★★☆ | 중간 |
| 16 | Memory Manager | `src/memory/manager.ts` | `/docs/memory-manager` | ★★☆ | 중간 |

### Phase 4: LLM Client (API 통신 계층)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 17 | LLM Provider Interface | `src/llm/provider.ts` | `/docs/llm-provider` | ★★☆ | 중간 |
| 18 | LLM Client | `src/llm/client.ts` | `/docs/llm-client` | ★★★ | 긴 |
| 19 | Streaming Handler | `src/llm/streaming.ts` | `/docs/streaming` | ★★☆ | 중간 |
| 20 | Tool Call Strategy | `src/llm/tool-call-strategy.ts` | `/docs/tool-call-strategy` | ★★★ | 긴 |
| 21 | Dual Model Router | `src/llm/dual-model-router.ts` | `/docs/dual-model-router` | ★★☆ | 중간 |

### Phase 5: Tool System (도구 파이프라인)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 22 | Tool Types | `src/tools/types.ts` | `/docs/tool-types` | ★★☆ | 중간 |
| 23 | Tool Registry | `src/tools/registry.ts` | `/docs/tool-registry` | ★★★ | 긴 |
| 24 | Tool Executor | `src/tools/executor.ts` | `/docs/tool-executor` | ★★★ | 긴 |
| 25 | Adaptive Schema | `src/tools/adaptive-schema.ts` | `/docs/adaptive-schema` | ★★☆ | 중간 |
| 26 | Built-in Tools (일괄) | `src/tools/definitions/` | `/docs/builtin-tools` | ★★☆ | 긴 |

### Phase 6: Permission & MCP (접근 제어 + 외부 연동)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 27 | Permission Manager | `src/permissions/manager.ts` | `/docs/permission-manager` | ★★★ | 긴 |
| 28 | Audit Logger | `src/permissions/audit-log.ts` | `/docs/audit-log` | ★☆☆ | 짧음 |
| 29 | MCP Client | `src/mcp/client.ts` | `/docs/mcp-client` | ★★★ | 긴 |
| 30 | MCP Tool Bridge | `src/mcp/tool-bridge.ts` | `/docs/mcp-tool-bridge` | ★★☆ | 중간 |
| 31 | MCP Manager | `src/mcp/manager.ts` | `/docs/mcp-manager` | ★★★ | 긴 |

### Phase 7: Core Engine (핵심 오케스트레이션 — 최후)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 32 | Observation Masking | `src/core/observation-masking.ts` | `/docs/observation-masking` | ★★☆ | 중간 |
| 33 | Checkpoint Manager | `src/core/checkpoint-manager.ts` | `/docs/checkpoint-manager` | ★★☆ | 중간 |
| 34 | Recovery Executor | `src/core/recovery-executor.ts` | `/docs/recovery-executor` | ★★★ | 중간 |
| 35 | System Prompt Builder | `src/core/system-prompt-builder.ts` | `/docs/system-prompt-builder` | ★★★ | 긴 |
| 36 | Context Manager | `src/core/context-manager.ts` | `/docs/context-manager` | ★★★ | 긴 |
| 37 | **Agent Loop** | `src/core/agent-loop.ts` | `/docs/agent-loop` | ★★★ | 매우 긴 |

### Phase 8: CLI Layer (UI — 선택적)

| # | 모듈 | 파일 | 문서 slug | 난이도 | 예상 분량 |
|---|------|------|-----------|--------|----------|
| 38 | useAgentLoop Hook | `src/cli/hooks/useAgentLoop.ts` | `/docs/use-agent-loop` | ★★★ | 긴 |
| 39 | useConversation Hook | `src/cli/hooks/useConversation.ts` | `/docs/use-conversation` | ★★☆ | 중간 |
| 40 | ActivityFeed | `src/cli/components/ActivityFeed.tsx` | `/docs/activity-feed` | ★★☆ | 중간 |
| 41 | App.tsx (루트) | `src/cli/App.tsx` | `/docs/app` | ★★★ | 긴 |

---

## 3. 각 문서 페이지 작성 가이드

### 페이지 구조 (모든 모듈 동일)

```
📄 [모듈명]
├── 1. 개요 (Overview)
│   ├── 한 줄 설명 + 레이어 배지
│   ├── 역할 설명 (2-3문장)
│   └── 🔹 Mermaid: 아키텍처 위치 (이 모듈 강조 + 직접 연결 모듈)
│
├── 2. 레퍼런스 (Reference)
│   ├── 클래스/함수 시그니처
│   ├── 📋 파라미터 테이블 (이름 | 타입 | 필수 | 설명)
│   ├── 반환값 설명
│   └── ⚠️ Caveats (주의사항 목록)
│
├── 3. 사용법 (Usage)
│   ├── 🟢 기본 사용법 (가장 흔한 케이스)
│   ├── 🔵 고급 사용법 1
│   ├── 🟣 고급 사용법 2
│   ├── ⚠️ Pitfall: 흔한 실수 (최소 1개)
│   └── 🔬 Deep Dive: 설계 결정 배경 (접을 수 있게)
│
├── 4. 내부 구현 (Internals)
│   ├── 🔹 Mermaid: 내부 상태 흐름 / 데이터 파이프라인
│   ├── 핵심 코드 발췌 (20-30줄) + 라인별 설명
│   └── 상태 변수 목록 (변수명 | 타입 | 역할)
│
├── 5. 트러블슈팅 (Troubleshooting)
│   ├── "X가 동작하지 않아요" (3-5개)
│   └── 각 항목: 원인 → 해결책 → 예방법
│
└── 6. 관련 문서 (See Also)
    ├── 이 모듈을 사용하는 상위 모듈
    ├── 이 모듈이 의존하는 하위 모듈
    └── 같은 레이어의 형제 모듈
```

### 모듈 유형별 작성 전략

#### 🧠 Hub 모듈 (agent-loop, context-manager, permission-manager, mcp-manager)

핵심 오케스트레이터이므로 가장 상세하게 작성:
- **개요**: 전체 실행 흐름에서의 역할을 강조
- **레퍼런스**: Config 인터페이스 + Result 인터페이스 모두 문서화
- **사용법**: 실제 호출 시나리오 3개 이상
- **내부 구현**: stateDiagram으로 상태 전이 시각화
- **트러블슈팅**: 5개 이상 (실제 사용자 이슈 기반)

#### 🔌 인터페이스 모듈 (provider.ts, types.ts, tool-call-strategy.ts)

구현체가 아닌 계약을 정의하므로:
- **개요**: 이 인터페이스를 구현하는 구현체 목록 나열
- **레퍼런스**: 인터페이스의 모든 메서드/프로퍼티 설명
- **사용법**: "새 구현체를 만드는 방법" 가이드
- **내부 구현**: 구현체 비교표 (각 구현체의 차이점)

#### ⚡ 유틸리티 모듈 (token-counter, circuit-breaker, cost-tracker)

독립적이고 단순하므로:
- **개요**: 1-2문장으로 충분
- **레퍼런스**: 함수 시그니처만 간결하게
- **사용법**: 1-2개 예시
- **내부 구현**: 알고리즘이 있는 경우만 (예: Shannon 엔트로피)
- **트러블슈팅**: 1-2개 또는 생략

#### 🛡️ 보안 모듈 (guardrails/*)

보안 도메인이므로:
- **개요**: 왜 이 보안 검사가 필요한지 (위협 시나리오)
- **레퍼런스**: 탐지 패턴 목록 (정규식 등)
- **사용법**: 정상 입력 vs 차단 입력 비교 예시
- **내부 구현**: 탐지 알고리즘 설명
- **트러블슈팅**: "정상인데 차단되는 경우" (false positive 대응)

#### 🖥️ CLI 컴포넌트/훅 (Layer 1)

React 컴포넌트이므로:
- **개요**: 어떤 UI를 담당하는지 스크린샷 또는 ASCII 예시
- **레퍼런스**: Props 인터페이스 문서화
- **사용법**: JSX 사용 예시
- **내부 구현**: 상태 관리 흐름 (useState, useEffect 패턴)
- **트러블슈팅**: 렌더링 이슈, 깜빡임 등 UI 버그

---

## 4. 진행 추적

문서 작성 시 이 파일의 Phase별 테이블에서 status를 업데이트합니다:

- `planned` → 작성 예정
- `wip` → 작성 중
- `review` → 검토 중
- `ready` → 완료

완료된 문서는 `guide/src/app/docs/[slug]/page.tsx`에 생성되며,
`guide/src/app/docs/page.tsx`의 해당 모듈 status를 `"ready"`로 변경합니다.

---

## 5. 예상 일정

| Phase | 모듈 수 | 예상 시간 | 비고 |
|-------|---------|----------|------|
| Phase 1: Foundation | 6개 | ★ 빠름 | 독립 모듈, 짧은 문서 |
| Phase 2: Security | 5개 | ★ 빠름 | 패턴 유사, 일괄 가능 |
| Phase 3: Config | 5개 | ★★ 보통 | 계층 이해 필요 |
| Phase 4: LLM | 5개 | ★★★ 오래 | 복잡한 스트리밍/전략 |
| Phase 5: Tools | 5개 | ★★★ 오래 | 16개 도구 일괄 정리 |
| Phase 6: Perm + MCP | 5개 | ★★★ 오래 | 복잡한 결정 트리 |
| Phase 7: Core | 6개 | ★★★★ 매우 오래 | 핵심 엔진, 최고 상세도 |
| Phase 8: CLI | 4개 | ★★ 보통 | React 컴포넌트 |
| **합계** | **41개** | | |
