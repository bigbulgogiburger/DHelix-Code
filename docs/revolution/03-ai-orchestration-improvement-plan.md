# 03. AI Orchestration Improvement Plan

> **Scope**: Multi-agent architecture, LLM provider abstraction, model routing, session management
> **Status**: Replaces previous version (2026-04-04)
> **Priority**: P0 — orchestration은 DHelix Code의 핵심 경쟁력

---

## 1. Current Orchestration Assessment

### 1.1 DHelix가 이미 가진 것

DHelix는 기본 멀티에이전트 오케스트레이션 인프라를 갖추고 있다.
하지만 "있다"와 "성숙하다"의 차이가 크다.

| Component | File | 상태 | 완성도 |
|-----------|------|------|--------|
| Agent Loop | `src/core/agent-loop.ts` | ReAct + Circuit Breaker + Preemptive Compaction | 80% |
| Subagent Spawner | `src/subagents/spawner.ts` | spawn, resume, background, worktree isolation | 75% |
| Team Manager | `src/subagents/team-manager.ts` | DAG scheduling, topological sort, failure propagation | 70% |
| Agent Types | `src/subagents/definition-types.ts` | explore, general, plan + custom definitions | 60% |
| Dual-Model Router | `src/llm/dual-model-router.ts` | Architect/Editor 패턴 정의만 존재 | 35% |
| Model Capabilities | `src/llm/model-capabilities.ts` | 정적 레지스트리, 가격/티어/토크나이저 | 70% |
| LLM Client Factory | `src/llm/client-factory.ts` | Anthropic + OpenAI-compat + Responses API | 55% |
| Shared State | `src/subagents/shared-state.ts` | 병렬 에이전트 간 데이터 공유 | 65% |
| Cost Tracker | `src/llm/cost-tracker.ts` | 세션 내 비용 추적 | 60% |

**핵심 문제**: 개별 컴포넌트는 존재하지만 통합된 orchestration control plane이 없다.
각 컴포넌트가 독립적으로 동작하며, 상위 수준의 정책 관리와 상태 영속화가 부재하다.

### 1.2 주요 결함 영역

**A. Provider 확장성 한계**
- `client-factory.ts`는 3개 클라이언트만 하드코딩: `AnthropicProvider`, `OpenAICompatibleClient`, `ResponsesAPIClient`
- Google Gemini, AWS Bedrock, Azure OpenAI 등 주요 프로바이더 미지원
- Local model (Ollama, LMStudio) 통합 경로 없음
- Provider-specific feature (Google의 grounding, Anthropic의 caching)를 활용할 추상화 부재

**B. Dual-Model Router 미완성**
- `DualModelRouter` 클래스가 정의되어 있으나 `auto` 라우팅 전략이 구현되지 않음
- Task complexity 기반 모델 선택 로직 없음
- 비용 vs 품질 가중치 설정 불가
- A/B 테스트 인프라 전무

**C. Agent Manifest 비구조적**
- `AgentDefinition`이 존재하나 typed manifest 수준이 아님
- Per-agent model override는 `sonnet/opus/haiku/inherit` 문자열 수준
- Agent의 allowed tools, memory scope, isolation mode가 manifest에 선언적으로 관리되지 않음
- Agent 간 통신이 parent-child 단방향만 존재, peer-to-peer 없음

**D. Session 영속성 부족**
- Team DAG 상태가 메모리 상주 — 프로세스 종료 시 소실
- Session forking / branching 미지원
- Cross-session artifact 공유 메커니즘 없음
- Checkpoint 기반 resume 미구현 (히스토리 파일 수준만)

---

## 2. Competitive Analysis

### 2.1 Feature-Level Comparison Matrix

| Feature | OpenCode | Codex | Claude Code | DHelix Current | DHelix Target |
|---------|----------|-------|-------------|----------------|---------------|
| **Built-in Agents** | 5+ (build, plan, explore, general, compaction) | 3+ (root, sub, fork) | 2 (main, sub) | 3 (explore, general, plan) | 8+ |
| **Per-Agent Model Override** | Yes (model, temp, topP per agent) | No (global) | No | Partial (sonnet/opus/haiku) | Full (any model + params) |
| **Custom Agent Prompts** | Yes (full template) | No | No | Yes (definition-loader) | Yes + manifest schema |
| **Agent Permission Rules** | Per-agent rulesets | Depth-based | Session-level | Session-level | Per-agent + inherited |
| **Step Limits** | Per-agent configurable | Depth tracking | Token-based | Circuit breaker | Per-agent + global budget |
| **LLM Providers** | 20+ via Vercel AI SDK | OpenAI only | Anthropic only | 3 (Anthropic, OpenAI-compat, Responses) | 10+ |
| **Small Model Path** | Yes (summaries, titles) | No | No | No | Yes (compaction, titles, classification) |
| **Plugin Hooks** | chat.params, headers, system prompt transform | No | No | No | Pre/post hooks per phase |
| **Session Forking** | Yes (--fork from checkpoint) | Yes (spawn_forked_thread) | No | No | Yes (fork + branch + merge) |
| **Agent Communication** | Parent-child only | Parent-child + registry | Parent-child | Parent-child + shared state | Parent-child + peer-to-peer |
| **Streaming Reasoning** | Native ReasoningPart | No | Extended thinking | Extended thinking | Native reasoning + thinking |
| **Effect/DI System** | Effect.js layers | Custom | N/A | None | Provider-based DI |
| **Agent Depth Tracking** | No | Yes (prevents infinite recursion) | No | Yes (nested-depth limits) | Yes + budget-based |
| **Durable Orchestration** | No | Thread registry | No | No | Event-sourced store |
| **WebSocket Prewarm** | No | Yes | No | No | Connection pool + prewarm |
| **A/B Testing** | No | No | No | No | Yes (model routing) |

### 2.2 Competitive Insights

**OpenCode의 강점 — 유연한 에이전트 커스터마이징**
- 각 에이전트에 개별 모델, temperature, topP를 설정할 수 있음
- Plugin hook 시스템으로 LLM 요청/응답 파이프라인을 확장 가능
- Vercel AI SDK 덕분에 20+ 프로바이더를 zero-config로 지원
- Small model path로 비용 최적화 (요약/제목 생성에 저렴한 모델 사용)
- **DHelix 시사점**: Provider 추상화와 per-agent 설정 유연성을 최우선 확보해야 함

**Codex의 강점 — Thread 기반 격리 모델**
- AgentControl로 root/sub/fork thread를 명시적으로 관리
- Agent depth tracking으로 무한 재귀 방지
- spawn_forked_thread로 작업 분기 → 독립 실행 → 결과 수집
- WebSocket prewarm으로 cold start 레이턴시 최소화
- **DHelix 시사점**: Thread/session 수명주기 관리와 fork 모델이 필요함

**2026 트렌드 — Coherence > Autonomy**
- 에이전트 간 직접 통신 (parent 거치지 않는 peer-to-peer)
- 3-Tier orchestration: Local Interactive / Cloud Parallel / Automation
- Worktree isolation이 업계 표준화
- Conductor, Claude Squad, Antigravity 등 orchestration 전문 도구 등장
- **DHelix 시사점**: 오케스트레이션 coherence와 관찰 가능성이 핵심 차별점

---

## 3. Provider Expansion Plan

### 3.1 Architecture: Provider Abstraction Layer

현재 `client-factory.ts`의 if-else 분기를 제거하고, 플러그인 기반 프로바이더 시스템을 도입한다.

```
┌─────────────────────────────────────────────────┐
│              ProviderRegistry                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │Anthropic │ │ OpenAI   │ │ Google Gemini    │ │
│  │Provider  │ │ Provider │ │ Provider         │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │            │                │            │
│  ┌────┴────────────┴────────────────┴──────────┐ │
│  │         UnifiedLLMProvider interface         │ │
│  │  chat() | stream() | embed() | capabilities │ │
│  └─────────────────────────────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Azure    │ │ Bedrock  │ │ Ollama/LMStudio  │ │
│  │ OpenAI   │ │ Provider │ │ Local Provider   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

**핵심 인터페이스 설계**:

```typescript
// src/llm/providers/registry.ts
interface ProviderManifest {
  readonly id: string;                    // "anthropic", "google-gemini", "ollama"
  readonly displayName: string;           // "Google Gemini"
  readonly models: readonly ModelEntry[]; // supported models
  readonly authType: "api-key" | "oauth" | "iam" | "none";
  readonly features: ProviderFeatures;    // caching, grounding, etc.
}

interface ProviderFeatures {
  readonly supportsCaching: boolean;        // Anthropic prompt caching
  readonly supportsGrounding: boolean;      // Google search grounding
  readonly supportsImageInput: boolean;
  readonly supportsReasoningTrace: boolean; // o-series, Claude thinking
  readonly maxConcurrentRequests: number;
  readonly rateLimitStrategy: "token-bucket" | "sliding-window";
}

interface UnifiedLLMProvider extends LLMProvider {
  readonly manifest: ProviderManifest;
  healthCheck(): Promise<ProviderHealthStatus>;
  estimateCost(tokens: TokenUsage): CostEstimate;
}
```

### 3.2 Phase 1: Google Gemini + Azure OpenAI (Week 1-3)

**Google Gemini Provider** (`src/llm/providers/google-gemini.ts`):
- Gemini 2.5 Pro/Flash 지원
- Google AI Studio API + Vertex AI 이중 엔드포인트
- Search grounding 지원 (web_search tool을 Gemini에 위임 가능)
- 긴 컨텍스트 윈도우 활용 (2M tokens)
- Native JSON mode + function calling
- Streaming with server-sent events

```typescript
// 구현 우선순위
const GEMINI_MODELS: ModelEntry[] = [
  { id: "gemini-2.5-pro",   tier: "high",   context: 2_000_000, pricing: { input: 1.25, output: 10.0 } },
  { id: "gemini-2.5-flash", tier: "medium", context: 1_000_000, pricing: { input: 0.15, output: 0.60 } },
  { id: "gemini-2.0-flash", tier: "medium", context: 1_000_000, pricing: { input: 0.10, output: 0.40 } },
];
```

**Azure OpenAI Provider** (`src/llm/providers/azure-openai.ts`):
- Azure 전용 엔드포인트 포맷 지원 (`{resource}.openai.azure.com/openai/deployments/{deployment}`)
- Azure AD / Managed Identity 인증
- `api-version` 쿼리 파라미터 관리
- Content filtering 응답 처리
- Region-based routing (latency 최적화)

**공통 작업**:
- `ProviderRegistry` 구현 — 런타임 프로바이더 등록/해제
- `model-capabilities.ts`의 `MODEL_OVERRIDES`를 프로바이더별 분리
- `/model` 슬래시 커맨드에서 프로바이더 목록 표시 + 자동완성
- Health check endpoint 통합 (연결 상태 확인)

### 3.3 Phase 2: AWS Bedrock + Mistral + Groq (Week 4-6)

**AWS Bedrock Provider** (`src/llm/providers/aws-bedrock.ts`):
- AWS SDK v3 (`@aws-sdk/client-bedrock-runtime`) 사용
- IAM role / profile credentials 자동 감지
- Claude via Bedrock, Llama, Titan 모델 접근
- Bedrock Guardrails 통합 (기존 guardrails 시스템과 병렬 운용)
- Cross-region inference profile 지원
- Converse API 사용으로 일관된 인터페이스 제공

**Mistral Provider** (`src/llm/providers/mistral.ts`):
- Mistral Large 2, Codestral, Pixtral 지원
- La Plateforme API 직접 연동
- Function calling + JSON mode 지원
- Code-specific 모델(Codestral)을 editor role에 활용 가능

**Groq Provider** (`src/llm/providers/groq.ts`):
- Groq Cloud API (OpenAI-compatible + 전용 확장)
- Ultra-low latency 특화 — compaction, classification에 최적
- Llama, Mixtral, Gemma 모델 접근
- Rate limit이 매우 엄격하므로 token-bucket 전략 필수

**공통 작업**:
- Provider-specific error mapping (429, 503 등을 통일된 `ProviderError`로)
- Retry 전략을 프로바이더별로 커스터마이즈 가능하게
- Fallback chain 구현: primary provider 실패 시 secondary로 자동 전환

### 3.4 Phase 3: Local & Custom Models — 종합 로컬 모델 전략 (Week 7-12)

> **범위**: Ollama, LMStudio, vLLM, llama.cpp, 임의 OpenAI-compatible 서버
> **벤치마킹 기반**: OpenCode (openai-compatible SDK + 에러 패턴 감지), Codex (Ollama/LMStudio 전용 Rust 클라이언트 + `CODEX_OSS_BASE_URL`)

---

#### 3.4.1 지원 대상 로컬 서버

| 서버 | 기본 포트 | API 형식 | Tool Calling | Chat Template |
|------|----------|---------|-------------|---------------|
| **Ollama** | 11434 | `/api/*` (네이티브) + `/v1/*` (OpenAI-compat) | 모델 종속 (llama3.1+, qwen2.5+) | 내장 (모델별 자동) |
| **LMStudio** | 1234 | `/v1/*` (OpenAI-compat) | 모델 종속 | GGUF 메타데이터에서 자동 감지 |
| **vLLM** | 8000 | `/v1/*` (OpenAI-compat) | `--enable-auto-tool-choice` 필요 | tokenizer_config.json Jinja2 |
| **llama.cpp server** | 8080 | `/v1/*` (OpenAI-compat) | 제한적 (`--jinja` 플래그) | `--chat-template` 인자 |
| **Custom** | 사용자 정의 | `/v1/*` (OpenAI-compat) | 서버 의존 | 서버 의존 |

---

#### 3.4.2 Local Provider 아키텍처

**파일**: `src/llm/providers/local.ts` (신규, ~600 LOC 예상)

```typescript
/**
 * 로컬/커스텀 모델 서버 통합 프로바이더
 * 
 * 설계 원칙:
 * 1. OpenAI-compatible API를 표준 인터페이스로 사용
 * 2. Ollama 네이티브 API는 모델 관리(pull/list)에만 사용
 * 3. Chat template 자동 감지로 사용자 설정 최소화
 * 4. Tool calling 미지원 시 text-parsing 전략 자동 폴백
 */

interface LocalProviderConfig {
  readonly type: "ollama" | "lmstudio" | "vllm" | "llama-cpp" | "custom";
  readonly endpoint: string;
  readonly apiKey?: string;                  // vLLM/custom 서버용
  readonly autoDetect: boolean;              // 서버 시작 시 모델 목록 자동 조회
  readonly gpuMemoryThreshold?: number;      // MB 단위, 이 이하면 경고
  readonly chatTemplate?: ChatTemplateOverride; // 자동 감지 오버라이드
  readonly toolCallParser?: ToolCallParserType; // vLLM tool call parser 지정
  readonly connectionTimeout?: number;       // ms, 기본 5000
  readonly streamIdleTimeout?: number;       // ms, 기본 300000
}

type ToolCallParserType = 
  | "auto"           // 서버가 결정 (기본값)
  | "hermes"         // NousResearch Hermes 형식
  | "mistral"        // Mistral 네이티브 형식
  | "llama3_json"    // Llama 3.1+ JSON 형식
  | "pythonic"       // Qwen 등 Python 호출 형식
  | "jinja"          // Jinja2 기반 커스텀
  | "text-parsing";  // DHelix XML 폴백 (기존 src/llm/strategies/text-parsing.ts)

interface ChatTemplateOverride {
  readonly format?: "chatml" | "llama3" | "mistral-instruct" | "gemma" | "phi3" | "command-r" | "custom";
  readonly jinja?: string;                   // 커스텀 Jinja2 템플릿 문자열
  readonly stopTokens?: string[];            // 커스텀 stop 토큰
  readonly bosToken?: string;                // Begin of sequence
  readonly eosToken?: string;                // End of sequence
}
```

---

#### 3.4.3 vLLM 직접 연동 — 상세 설계

> vLLM은 PagedAttention 기반 고처리량 추론 엔진으로, production 환경의 로컬 모델 서빙에 최적
> OpenAI-compatible API를 제공하지만, tool calling과 chat template에 특수 설정이 필요

**vLLM Provider** (`src/llm/providers/vllm.ts`, 신규, ~350 LOC):

```typescript
import { OpenAICompatibleClient } from "../client.js";

interface VLLMProviderConfig extends LocalProviderConfig {
  readonly type: "vllm";
  readonly endpoint: string;                   // 기본: http://localhost:8000/v1
  
  // vLLM 서버 설정 감지 (GET /v1/models 응답에서 추출)
  readonly serverInfo?: {
    readonly modelId: string;                  // e.g., "meta-llama/Llama-3.1-8B-Instruct"
    readonly maxModelLen: number;              // 서버 설정 context length
    readonly enableAutoToolChoice: boolean;    // --enable-auto-tool-choice 활성화 여부
    readonly toolCallParser: string;           // --tool-call-parser 값
    readonly chatTemplate: string;             // 적용 중인 chat template
  };
}

export class VLLMProvider extends OpenAICompatibleClient {
  
  /**
   * vLLM 서버 연결 및 설정 자동 감지
   * 
   * 1. GET /v1/models → 모델 ID 및 서버 설정 확인
   * 2. GET /health → 서버 상태 확인
   * 3. Tool calling 지원 여부 판단:
   *    - /v1/chat/completions 테스트 호출로 tool_choice 지원 확인
   *    - 미지원 시 text-parsing 전략으로 자동 폴백
   * 4. Chat template 유효성 검증
   */
  async initialize(): Promise<VLLMServerInfo> {
    // GET /v1/models
    const modelsResponse = await fetch(`${this.endpoint}/v1/models`);
    const models = await modelsResponse.json();
    
    // GET /health (vLLM 전용 엔드포인트)
    const healthResponse = await fetch(`${this.endpoint}/health`);
    
    // Tool calling 프로브: 최소 요청으로 테스트
    const toolProbe = await this.probeToolCalling(models.data[0].id);
    
    return {
      modelId: models.data[0].id,
      maxModelLen: models.data[0].max_model_len ?? 4096,
      enableAutoToolChoice: toolProbe.supported,
      toolCallParser: toolProbe.parser ?? "text-parsing",
      chatTemplate: models.data[0].chat_template ?? "unknown",
    };
  }
  
  /**
   * Tool calling 지원 여부 프로브
   * 
   * vLLM은 --enable-auto-tool-choice 없이 시작하면 tool 파라미터를 무시함.
   * 간단한 테스트 호출로 지원 여부를 판단:
   * - 지원 O → native function calling 사용
   * - 지원 X → DHelix text-parsing 전략 자동 폴백
   */
  private async probeToolCalling(modelId: string): Promise<{
    supported: boolean;
    parser?: string;
  }> {
    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: "test" }],
          tools: [{
            type: "function",
            function: { name: "test", parameters: { type: "object", properties: {} } }
          }],
          max_tokens: 1,
        }),
      });
      
      if (response.ok) {
        return { supported: true, parser: "auto" };
      }
      // 400/422 = tool calling 미지원
      return { supported: false };
    } catch {
      return { supported: false };
    }
  }
}
```

**vLLM 서버 시작 권장 명령어** (문서화 대상):

```bash
# Tool calling 활성화 + chat template 자동 감지
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --enable-auto-tool-choice \
  --tool-call-parser hermes \
  --port 8000

# 대형 모델 (tensor parallel)
vllm serve deepseek-ai/DeepSeek-Coder-V2-Instruct \
  --tensor-parallel-size 2 \
  --enable-auto-tool-choice \
  --tool-call-parser hermes \
  --max-model-len 32768

# 커스텀 chat template
vllm serve ./my-finetuned-model \
  --chat-template ./my-template.jinja \
  --enable-auto-tool-choice \
  --tool-call-parser pythonic
```

**DHelix config** (`.dhelix/providers.json`):

```json
{
  "providers": {
    "vllm-local": {
      "type": "vllm",
      "endpoint": "http://localhost:8000/v1",
      "autoDetect": true,
      "toolCallParser": "auto"
    },
    "vllm-remote": {
      "type": "vllm",
      "endpoint": "http://gpu-server.internal:8000/v1",
      "apiKey": "${VLLM_API_KEY}",
      "autoDetect": true
    }
  }
}
```

**vLLM 에러 패턴 감지** (OpenCode 벤치마킹):

```typescript
// src/llm/providers/error-patterns.ts (신규)
// OpenCode가 이미 구현한 패턴을 벤치마킹

const CONTEXT_OVERFLOW_PATTERNS = [
  /maximum context length is \d+ tokens/i,           // vLLM
  /context length is only \d+ tokens/i,               // vLLM  
  /input length.*exceeds.*context length/i,            // vLLM
  /exceeds the available context size/i,               // llama.cpp
  /greater than the context length/i,                  // LMStudio
  /prompt too long; exceeded (?:max )?context length/i, // Ollama
  /too large for model with \d+ maximum context length/i, // Mistral
];

const CONNECTION_PATTERNS = [
  /ECONNREFUSED/i,     // 서버 미실행
  /ECONNRESET/i,       // 연결 끊김
  /ETIMEDOUT/i,        // 타임아웃
  /fetch failed/i,     // 네트워크 오류
];
```

---

#### 3.4.4 모델 포맷 자동 감지 — Chat Template Detection Engine

> **핵심 문제**: 로컬 모델은 각각 다른 chat template를 사용함.
> ChatML, Llama3 format, Mistral [INST], Gemma, Phi3 등 — 잘못된 포맷은 성능 급격 저하.
> vLLM/Ollama는 서버 단에서 처리하지만, 커스텀 서버나 직접 연동 시 클라이언트 감지 필요.

**파일**: `src/llm/chat-template-detector.ts` (신규, ~400 LOC)

```typescript
/**
 * Chat Template 자동 감지 엔진
 * 
 * 감지 순서 (우선순위):
 * 1. 사용자 명시 설정 (providers.json의 chatTemplate 필드)
 * 2. 서버 응답 메타데이터 (vLLM /v1/models의 chat_template 필드)
 * 3. Ollama /api/show 응답의 template 필드
 * 4. 모델 ID 패턴 매칭 (휴리스틱)
 * 5. HuggingFace tokenizer_config.json 조회 (온라인/캐시)
 * 6. 기본값 폴백 (ChatML)
 */

export interface ChatTemplateInfo {
  readonly format: ChatTemplateFormat;
  readonly jinja?: string;              // Jinja2 template 원문
  readonly stopTokens: string[];        // 모델별 stop 시퀀스
  readonly supportsSystemRole: boolean; // system 메시지 지원 여부
  readonly supportsToolUse: boolean;    // tool_use 역할 지원 여부
  readonly source: "user" | "server" | "ollama" | "heuristic" | "huggingface" | "default";
}

type ChatTemplateFormat = 
  | "chatml"              // <|im_start|>system\n...<|im_end|>
  | "llama3"              // <|begin_of_text|><|start_header_id|>system<|end_header_id|>
  | "mistral-instruct"    // [INST] ... [/INST]
  | "gemma"               // <start_of_turn>user\n...<end_of_turn>
  | "phi3"                // <|system|>\n...<|end|>
  | "command-r"           // <|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|>
  | "deepseek"            // DeepSeek 전용 포맷
  | "qwen"                // Qwen 시리즈 포맷
  | "zephyr"              // <|system|>\n...<|endoftext|>
  | "custom";             // 사용자 정의 Jinja2

export class ChatTemplateDetector {
  
  // 캐시: 모델 ID → 감지된 template (디스크 캐시 포함)
  private cache = new Map<string, ChatTemplateInfo>();
  private diskCachePath: string; // ~/.dhelix/cache/chat-templates.json
  
  /**
   * 1단계: 모델 ID 기반 휴리스틱 감지
   * 
   * 대부분의 경우 모델 이름으로 포맷을 결정할 수 있음.
   * 정규식 패턴을 model-capabilities.ts의 기존 패턴과 통합.
   */
  detectFromModelId(modelId: string): ChatTemplateFormat | null {
    const PATTERNS: Array<[RegExp, ChatTemplateFormat]> = [
      // Llama 3.x
      [/llama[-_]?3(\.[1-9])?/i, "llama3"],
      [/llama[-_]?4/i, "llama3"],           // Llama 4도 동일 포맷
      
      // Mistral / Mixtral
      [/mistral|mixtral/i, "mistral-instruct"],
      [/codestral/i, "mistral-instruct"],
      
      // Qwen
      [/qwen[_-]?[12345]/i, "qwen"],
      
      // DeepSeek
      [/deepseek/i, "deepseek"],
      
      // Google Gemma
      [/gemma/i, "gemma"],
      
      // Microsoft Phi
      [/phi[-_]?[34]/i, "phi3"],
      
      // Cohere Command-R
      [/command[-_]?r/i, "command-r"],
      
      // ChatML 기본 (OpenHermes, Nous 등)
      [/hermes|nous|openhermes|dolphin|neural[-_]chat/i, "chatml"],
      
      // Zephyr
      [/zephyr/i, "zephyr"],
    ];
    
    for (const [pattern, format] of PATTERNS) {
      if (pattern.test(modelId)) return format;
    }
    return null; // 매칭 실패 → 다음 단계로
  }
  
  /**
   * 2단계: vLLM 서버 메타데이터에서 감지
   * 
   * vLLM의 GET /v1/models 응답에 chat_template 필드가 포함됨.
   * 이것은 tokenizer_config.json의 chat_template 값과 동일.
   */
  async detectFromVLLMServer(endpoint: string, modelId: string): Promise<ChatTemplateInfo | null> {
    try {
      const resp = await fetch(`${endpoint}/v1/models`);
      const data = await resp.json();
      const model = data.data?.find((m: any) => m.id === modelId);
      if (model?.chat_template) {
        return this.parseJinjaTemplate(model.chat_template);
      }
    } catch { /* 연결 실패 → 다음 단계 */ }
    return null;
  }
  
  /**
   * 3단계: Ollama /api/show에서 template 추출
   */
  async detectFromOllama(endpoint: string, modelName: string): Promise<ChatTemplateInfo | null> {
    try {
      const resp = await fetch(`${endpoint}/api/show`, {
        method: "POST",
        body: JSON.stringify({ name: modelName }),
      });
      const data = await resp.json();
      if (data.template) {
        return this.parseOllamaTemplate(data.template);
      }
    } catch { /* 연결 실패 → 다음 단계 */ }
    return null;
  }
  
  /**
   * 4단계: HuggingFace Hub에서 tokenizer_config.json 조회
   * 
   * HF Hub API로 chat_template 필드를 가져옴.
   * 결과는 디스크 캐시에 저장 (TTL 7일).
   * 오프라인 시 캐시 사용 또는 기본값 폴백.
   */
  async detectFromHuggingFace(modelId: string): Promise<ChatTemplateInfo | null> {
    // 캐시 확인
    const cached = this.getDiskCache(modelId);
    if (cached) return cached;
    
    try {
      const url = `https://huggingface.co/${modelId}/resolve/main/tokenizer_config.json`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) return null;
      
      const config = await resp.json();
      if (config.chat_template) {
        const info = this.parseJinjaTemplate(config.chat_template);
        this.setDiskCache(modelId, info); // 7일 TTL
        return info;
      }
    } catch { /* 오프라인 → 기본값 */ }
    return null;
  }
  
  /**
   * Jinja2 template 분석 → ChatTemplateFormat 결정
   * 
   * 템플릿 문자열에서 특징적인 토큰을 찾아 포맷을 판별:
   * - "<|im_start|>" → ChatML
   * - "<|start_header_id|>" → Llama3
   * - "[INST]" → Mistral
   * - "<start_of_turn>" → Gemma
   * 등
   */
  private parseJinjaTemplate(jinja: string): ChatTemplateInfo {
    const format = this.identifyFormatFromJinja(jinja);
    const supportsSystem = jinja.includes("system") || jinja.includes("SYSTEM");
    const supportsTool = jinja.includes("tool") || jinja.includes("function");
    
    return {
      format,
      jinja,
      stopTokens: STOP_TOKENS[format],
      supportsSystemRole: supportsSystem,
      supportsToolUse: supportsTool,
      source: "huggingface",
    };
  }
  
  private identifyFormatFromJinja(jinja: string): ChatTemplateFormat {
    if (jinja.includes("<|im_start|>")) return "chatml";
    if (jinja.includes("<|start_header_id|>")) return "llama3";
    if (jinja.includes("[INST]")) return "mistral-instruct";
    if (jinja.includes("<start_of_turn>")) return "gemma";
    if (jinja.includes("<|system|>")) return "phi3";
    if (jinja.includes("START_OF_TURN_TOKEN")) return "command-r";
    return "chatml"; // 기본 폴백
  }
}

// 포맷별 stop 토큰 사전
const STOP_TOKENS: Record<ChatTemplateFormat, string[]> = {
  "chatml":            ["<|im_end|>"],
  "llama3":            ["<|eot_id|>", "<|end_of_text|>"],
  "mistral-instruct":  ["</s>"],
  "gemma":             ["<end_of_turn>"],
  "phi3":              ["<|end|>", "<|endoftext|>"],
  "command-r":         ["<|END_OF_TURN_TOKEN|>"],
  "deepseek":          ["<|end▁of▁sentence|>"],
  "qwen":              ["<|im_end|>", "<|endoftext|>"],
  "zephyr":            ["</s>", "<|endoftext|>"],
  "custom":            [],
};
```

**메시지 포맷 변환** (`src/llm/message-formatter.ts`, 신규, ~250 LOC):

```typescript
/**
 * Chat template에 맞게 메시지를 변환
 * 
 * OpenAI-compatible API 사용 시 서버가 처리하므로 불필요.
 * 직접 연동(llama.cpp, custom) 또는 서버의 template가 잘못된 경우 사용.
 * 
 * OpenCode 벤치마킹:
 * - provider/transform.ts에서 Mistral, Claude 포맷별 메시지 정규화 구현
 * - tool call ID 스크러빙, 더미 assistant 메시지 삽입 등
 */
export class MessageFormatter {
  
  constructor(private template: ChatTemplateInfo) {}
  
  /**
   * provider-specific 메시지 변환
   * 
   * Mistral: tool call ID를 9자 영숫자로 정규화
   * Llama3: tool 응답을 ipython 역할로 변환
   * ChatML: 표준 OpenAI 형식 유지
   */
  formatMessages(messages: ChatMessage[]): ChatMessage[] {
    switch (this.template.format) {
      case "mistral-instruct":
        return this.formatMistral(messages);
      case "llama3":
        return this.formatLlama3(messages);
      default:
        return messages; // 대부분의 모델은 OpenAI 형식 그대로
    }
  }
  
  /**
   * Mistral 포맷 변환 (OpenCode 벤치마킹)
   * - tool call ID → 9자 영숫자 (Mistral API 제약)
   * - tool 메시지가 user 다음에 올 수 없음 → 더미 assistant 삽입
   */
  private formatMistral(messages: ChatMessage[]): ChatMessage[] {
    // ... Mistral 특화 변환
  }
  
  /**
   * Llama3 포맷 변환
   * - tool 응답 역할: "tool" → "ipython"
   * - system 메시지 위치 강제 (첫 번째)
   */
  private formatLlama3(messages: ChatMessage[]): ChatMessage[] {
    // ... Llama3 특화 변환
  }
}
```

---

#### 3.4.5 Tool Calling 전략 자동 선택

> **현재 DHelix 강점**: `src/llm/strategies/text-parsing.ts`에 XML 기반 폴백이 이미 구현됨.
> 이를 확장하여 로컬 모델의 tool calling 능력에 따라 자동으로 최적 전략을 선택.

```typescript
// src/llm/tool-call-strategy-resolver.ts (신규)

/**
 * 모델의 tool calling 능력에 따라 최적 전략을 자동 선택
 * 
 * 판단 기준:
 * 1. model-capabilities.ts의 supportsTools 플래그
 * 2. vLLM probeToolCalling() 결과
 * 3. Ollama /api/show의 tools 지원 여부
 * 4. 실제 테스트 호출 결과 (최후의 수단)
 */
export function resolveToolCallStrategy(
  modelId: string,
  capabilities: ModelCapabilities,
  serverInfo?: LocalServerInfo,
): ToolCallStrategyType {
  
  // 1. 명시적으로 tool calling 지원하는 모델
  if (capabilities.supportsTools) {
    // vLLM 서버에서 parser 정보가 있으면 활용
    if (serverInfo?.type === "vllm" && serverInfo.enableAutoToolChoice) {
      return "native-function-calling"; // vLLM이 tool call 처리
    }
    return "native-function-calling";
  }
  
  // 2. Tool calling 미지원이지만 JSON 출력 가능한 모델
  if (capabilities.supportsJsonMode) {
    return "two-stage-tool-call"; // JSON schema 기반 2단계
  }
  
  // 3. 최종 폴백: XML text-parsing (기존 DHelix 전략)
  return "text-parsing";
}

// 전략별 특성
const STRATEGY_INFO = {
  "native-function-calling": {
    description: "서버/모델이 OpenAI function calling API 지원",
    reliability: "high",
    latencyOverhead: "none",
  },
  "two-stage-tool-call": {
    description: "JSON mode로 도구 호출 추출 후 실행",
    reliability: "medium",
    latencyOverhead: "low (2x LLM call)",
  },
  "text-parsing": {
    description: "XML 태그로 도구 호출을 텍스트에 포함하여 파싱",
    reliability: "medium-low",
    latencyOverhead: "none (1x LLM call, regex parsing)",
  },
} as const;
```

---

#### 3.4.6 로컬 모델 벤치마크 프레임워크

> **목적**: 사용자가 로컬 모델의 coding agent 성능을 객관적으로 평가할 수 있는 내장 벤치마크 제공.
> **벤치마킹 기반**: SWE-bench, Aider Polyglot, BFCL (Berkeley Function Calling Leaderboard)

**파일**: `src/benchmark/` (신규 디렉토리)

```
src/benchmark/
├── runner.ts              # 벤치마크 실행 엔진
├── suites/
│   ├── tool-calling.ts    # Tool calling 정확도 (BFCL 기반)
│   ├── code-editing.ts    # 코드 편집 능력 (Aider Polyglot 기반)
│   ├── reasoning.ts       # 코딩 추론 능력
│   └── latency.ts         # 지연 시간 및 처리량
├── problems/
│   ├── tool-calling/      # 20개 tool calling 시나리오
│   ├── code-editing/      # 30개 코드 편집 문제 (6개 언어)
│   └── reasoning/         # 15개 추론 문제
├── reporter.ts            # 결과 리포팅 (터미널 + JSON)
├── comparator.ts          # 모델 간 비교
└── types.ts               # 공통 타입 정의
```

**벤치마크 스위트 상세**:

##### Suite 1: Tool Calling 정확도 (BFCL 벤치마킹)

```typescript
// src/benchmark/suites/tool-calling.ts

/**
 * Tool Calling Benchmark Suite
 * 
 * BFCL (Berkeley Function Calling Leaderboard) 방법론 기반:
 * - Serial call: 단일 도구 호출 정확도
 * - Parallel call: 동시 다중 도구 호출
 * - Multi-turn: 대화 이어가기 중 도구 호출
 * - Argument accuracy: 인자 타입/값 정확도
 * 
 * 20개 시나리오, 각각 expected output과 비교
 */
interface ToolCallingBenchmark {
  readonly scenarios: ToolCallingScenario[];
  readonly metrics: {
    readonly callAccuracy: number;       // 올바른 도구 선택 비율
    readonly argAccuracy: number;        // 인자 정확도
    readonly formatCompliance: number;   // JSON 포맷 준수율
    readonly parallelSuccess: number;    // 병렬 호출 성공률
    readonly multiTurnRetention: number; // 다회차 대화에서 컨텍스트 유지율
  };
}

const TOOL_CALLING_SCENARIOS: ToolCallingScenario[] = [
  {
    name: "single_file_read",
    description: "단일 파일 읽기 도구 호출",
    userMessage: "src/index.ts 파일을 읽어줘",
    expectedTool: "file_read",
    expectedArgs: { file_path: /src\/index\.ts/ },
    difficulty: "easy",
  },
  {
    name: "parallel_grep_glob",
    description: "검색 + 파일 찾기 동시 호출",
    userMessage: "프로젝트에서 'TODO' 주석을 찾고, test 디렉토리의 모든 .test.ts 파일 목록을 알려줘",
    expectedTools: ["grep_search", "glob_search"],
    difficulty: "medium",
  },
  {
    name: "multi_turn_edit",
    description: "여러 턴에 걸친 파일 편집",
    conversation: [
      { role: "user", content: "src/utils.ts에서 formatDate 함수를 찾아줘" },
      { role: "assistant", toolCalls: [{ name: "grep_search", args: { pattern: "formatDate" } }] },
      { role: "user", content: "이제 그 함수의 반환 타입을 string에서 Date로 바꿔줘" },
    ],
    expectedTool: "file_edit",
    difficulty: "hard",
  },
  // ... 17개 추가 시나리오
];
```

##### Suite 2: 코드 편집 능력 (Aider Polyglot 벤치마킹)

```typescript
// src/benchmark/suites/code-editing.ts

/**
 * Code Editing Benchmark Suite
 * 
 * Aider Polyglot 방법론 기반:
 * - 6개 언어: TypeScript, Python, Go, Rust, Java, JavaScript
 * - 언어별 5문제 (총 30문제)
 * - 난이도: easy(함수 구현), medium(리팩토링), hard(버그 수정)
 * 
 * 평가 기준:
 * - pass@1: 첫 시도 성공률
 * - edit_accuracy: diff 형식 준수율
 * - test_pass: 편집 후 테스트 통과율
 * - token_efficiency: 문제 해결당 토큰 소비량
 */
interface CodeEditingBenchmark {
  readonly problems: CodeEditingProblem[];
  readonly metrics: {
    readonly passAt1: number;            // 첫 시도 성공률
    readonly editAccuracy: number;       // 편집 정확도
    readonly testPassRate: number;       // 테스트 통과율
    readonly avgTokensPerProblem: number; // 평균 토큰 사용량
    readonly avgLatencyMs: number;       // 평균 지연 시간
    readonly costPerProblem: number;     // 문제당 비용 ($0 for local)
  };
  readonly perLanguage: Record<string, {
    passAt1: number;
    avgLatency: number;
  }>;
}
```

##### Suite 3: 지연 시간 및 처리량

```typescript
// src/benchmark/suites/latency.ts

/**
 * Latency & Throughput Benchmark
 * 
 * 측정 항목:
 * - TTFT (Time To First Token): 첫 토큰까지 지연 시간
 * - TPS (Tokens Per Second): 초당 토큰 생성 속도
 * - E2E Latency: 전체 응답 완료 시간
 * - Context Loading: 긴 컨텍스트 로딩 시간 (4K, 8K, 16K, 32K)
 * - Tool Call Overhead: tool calling 사용 시 추가 오버헤드
 */
interface LatencyBenchmark {
  readonly measurements: {
    readonly ttftMs: { p50: number; p95: number; p99: number };
    readonly tps: { mean: number; p50: number; min: number };
    readonly e2eMs: { short: number; medium: number; long: number };
    readonly contextLoadMs: Record<"4k" | "8k" | "16k" | "32k", number>;
    readonly toolCallOverheadMs: number;
  };
  readonly systemInfo: {
    readonly gpu: string;
    readonly vram: string;
    readonly quantization: string;
    readonly contextLength: number;
  };
}
```

**CLI 명령어**:

```bash
# 전체 벤치마크 실행
dhelix benchmark --model llama3.1:8b --provider ollama

# Tool calling만 테스트
dhelix benchmark --suite tool-calling --model deepseek-coder-v2:16b

# 코드 편집 (특정 언어만)
dhelix benchmark --suite code-editing --languages typescript,python

# 지연 시간 측정
dhelix benchmark --suite latency --model qwen2.5-coder:32b --provider vllm

# 모델 비교
dhelix benchmark compare --models "llama3.1:8b,qwen2.5:32b,deepseek-coder-v2:16b"

# 결과 내보내기
dhelix benchmark --output json --file benchmark-results.json
```

**결과 출력 예시**:

```
╔══════════════════════════════════════════════════════════════╗
║  DHelix Local Model Benchmark — llama3.1:8b-instruct-q4_k_m ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Tool Calling     ████████████░░░░  72% (14/20 passed)      ║
║  Code Editing     ██████████░░░░░░  63% (19/30 passed)      ║
║  Reasoning        ████████░░░░░░░░  53% (8/15 passed)       ║
║                                                              ║
║  TTFT (p50):      342ms                                      ║
║  TPS:             48.3 tok/s                                 ║
║  Context Load:    4K=120ms  8K=240ms  16K=890ms             ║
║                                                              ║
║  System: NVIDIA RTX 4090, 24GB VRAM, Q4_K_M                 ║
║                                                              ║
║  Verdict: ⚠️ MEDIUM — Tool calling 부분 지원, 간단한 작업 가능   ║
║           복잡한 멀티턴 에이전트 작업에는 부족                    ║
╚══════════════════════════════════════════════════════════════╝
```

**Verdict 기준**:

| 등급 | Tool Calling | Code Editing | 권장 사용법 |
|------|-------------|-------------|-----------|
| ✅ **EXCELLENT** | ≥90% | ≥80% | 풀 에이전트 모드, 프로덕션 사용 가능 |
| 🟢 **GOOD** | ≥75% | ≥65% | 대부분의 작업 가능, 복잡한 작업은 주의 |
| ⚠️ **MEDIUM** | ≥60% | ≥50% | 간단한 작업만, 복잡한 멀티턴은 부적합 |
| 🔴 **LOW** | <60% | <50% | 코드 생성/완성에만 사용, 에이전트 부적합 |

---

#### 3.4.7 Local-Specific 고려사항

**Compaction 공격적 모드**:
- 로컬 모델은 context window가 작음 (8K-32K 일반적, 128K 드묾)
- 기존 83.5% 임계점 대신 **65% 임계점**으로 선제 압축
- Cold storage rehydration도 제한 (최대 3개 파일만)

**Tool Schema 최소화** (기존 Adaptive Schema 활용):
- `model-capabilities.ts`의 `capabilityTier: "low"`인 모델에 대해
- 도구 설명을 짧게, 파라미터 설명을 최소화
- Hot tools만 노출 (6개), 나머지는 요청 시 lazy load

**UI 인디케이터**:
- "Local model — 응답 대기 중" 표시
- TPS 실시간 표시 (초당 토큰 수)
- 예상 완료 시간 표시 (남은 토큰 / TPS)
- GPU 메모리 사용량 표시 (가능한 경우)

**Ollama 모델 관리**:
- `dhelix models list` — Ollama 로컬 모델 목록
- `dhelix models pull <model>` — 모델 다운로드 (진행률 표시)
- `dhelix models info <model>` — 모델 상세 정보 + chat template 감지 결과

---

#### 3.4.8 Env Variable & Config 확장

| Provider | Env Key | Fallback | 비고 |
|----------|---------|----------|------|
| Ollama | `DHELIX_OLLAMA_ENDPOINT` | `http://localhost:11434` | 네이티브 + OpenAI-compat |
| LMStudio | `DHELIX_LMSTUDIO_ENDPOINT` | `http://localhost:1234/v1` | OpenAI-compat only |
| vLLM | `DHELIX_VLLM_ENDPOINT` | `http://localhost:8000/v1` | OpenAI-compat only |
| llama.cpp | `DHELIX_LLAMACPP_ENDPOINT` | `http://localhost:8080/v1` | OpenAI-compat only |
| Custom | `DHELIX_LOCAL_ENDPOINT` | - | 임의 OpenAI-compat |
| Custom | `DHELIX_LOCAL_API_KEY` | - | 인증 필요 시 |

**Config 확장** (`.dhelix/providers.json`):

```json
{
  "providers": {
    "ollama": {
      "type": "ollama",
      "endpoint": "http://localhost:11434",
      "autoDetect": true,
      "preferredModels": ["qwen2.5-coder:32b", "deepseek-coder-v2:16b"]
    },
    "vllm-local": {
      "type": "vllm",
      "endpoint": "http://localhost:8000/v1",
      "autoDetect": true,
      "toolCallParser": "hermes",
      "chatTemplate": {
        "format": "auto"
      }
    },
    "vllm-remote": {
      "type": "vllm",
      "endpoint": "http://gpu-cluster.internal:8000/v1",
      "apiKey": "${VLLM_REMOTE_KEY}",
      "autoDetect": true
    },
    "llama-cpp": {
      "type": "llama-cpp",
      "endpoint": "http://localhost:8080/v1",
      "chatTemplate": {
        "format": "llama3"
      }
    }
  },
  "fallbackChain": ["anthropic", "vllm-local", "ollama"],
  "benchmark": {
    "autoRunOnNewModel": true,
    "suites": ["tool-calling", "latency"],
    "cacheResults": true
  }
}
```

---

#### 3.4.9 구현 로드맵 (Phase 3 내부)

| Week | 작업 | 산출물 | LOC |
|------|------|--------|-----|
| 7 | Local provider 기초 + Ollama/LMStudio 연동 | `providers/local.ts`, `providers/ollama.ts`, `providers/lmstudio.ts` | +400 |
| 8 | vLLM 직접 연동 + tool call probing | `providers/vllm.ts`, `providers/error-patterns.ts` | +350 |
| 9 | Chat template 자동 감지 엔진 | `chat-template-detector.ts`, `message-formatter.ts` | +650 |
| 10 | Tool call strategy resolver 통합 | `tool-call-strategy-resolver.ts` + 기존 strategy 수정 | +200 |
| 11 | 벤치마크 프레임워크 (suites + runner) | `benchmark/` 디렉토리 전체 | +800 |
| 12 | CLI 명령어 + 결과 리포터 + 테스트 | `commands/benchmark.ts`, `benchmark/reporter.ts` | +400 |
| | **합계** | | **+2,800** |

### 3.5 Provider Abstraction Layer — 상세 설계

**ProviderRegistry 동작 흐름**:

```
사용자 설정 (DHELIX_MODEL=gemini-2.5-pro)
    ↓
ProviderRegistry.resolve("gemini-2.5-pro")
    ↓
1. 모델명 패턴 매칭 → GoogleGeminiProvider 선택
2. 인증 정보 조회 (env: GOOGLE_API_KEY or DHELIX_GOOGLE_API_KEY)
3. Provider 인스턴스 생성 + health check
4. ModelCapabilities 조회 (프로바이더가 제공하는 정적 정보 + 런타임 감지)
    ↓
UnifiedLLMProvider 인스턴스 반환
```

**Env Variable Convention**:

| Provider | Env Key | Fallback |
|----------|---------|----------|
| Anthropic | `DHELIX_ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` |
| OpenAI | `DHELIX_OPENAI_API_KEY` | `OPENAI_API_KEY` |
| Google | `DHELIX_GOOGLE_API_KEY` | `GOOGLE_API_KEY`, `GEMINI_API_KEY` |
| Azure | `DHELIX_AZURE_API_KEY` + `DHELIX_AZURE_ENDPOINT` | `AZURE_OPENAI_API_KEY` |
| AWS | `DHELIX_AWS_PROFILE` | AWS SDK default chain |
| Mistral | `DHELIX_MISTRAL_API_KEY` | `MISTRAL_API_KEY` |
| Groq | `DHELIX_GROQ_API_KEY` | `GROQ_API_KEY` |
| Ollama | `DHELIX_OLLAMA_ENDPOINT` | `http://localhost:11434` |

**Config 파일 지원** (`.dhelix/providers.json`):

```json
{
  "providers": {
    "google-gemini": {
      "apiKey": "${GOOGLE_API_KEY}",
      "defaultModel": "gemini-2.5-flash",
      "region": "us-central1"
    },
    "ollama": {
      "endpoint": "http://localhost:11434",
      "autoDetect": true,
      "preferredModels": ["qwen3:32b", "deepseek-coder-v2:16b"]
    }
  },
  "fallbackChain": ["anthropic", "google-gemini", "ollama"]
}
```

---

## 4. Multi-Agent Architecture Evolution

### 4.1 Typed Agent Manifests

현재 `AgentDefinition` (`src/subagents/definition-types.ts`)을 확장하여
완전한 typed manifest 시스템을 구축한다.

**현재 AgentDefinition**:
```typescript
// 현재: 문자열 기반, 선언적이지 않음
interface AgentDefinition {
  name: string;
  type: string;        // "explore" | "general" | "plan"
  model: AgentModel;   // "sonnet" | "opus" | "haiku" | "inherit"
  prompt: string;
  // ... 제한적인 필드
}
```

**목표 AgentManifest**:
```typescript
// src/orchestration/agent-manifest.ts
interface AgentManifest {
  /** 고유 식별자 — 전역적으로 유일 */
  readonly id: string;

  /** 에이전트의 목적에 대한 구조화된 설명 */
  readonly purpose: AgentPurpose;

  /** 허용된 도구 목록 — 명시적 allowlist */
  readonly allowedTools: readonly string[];

  /** 차단된 도구 목록 — allowedTools와 상호 배타적 */
  readonly blockedTools?: readonly string[];

  /** 메모리 스코프 — 에이전트가 접근할 수 있는 메모리 범위 */
  readonly memoryScope: AgentMemoryScope;

  /** 격리 모드 — 파일시스템 접근 격리 수준 */
  readonly isolationMode: AgentIsolationMode;

  /** 모델 설정 — 어떤 모델을 어떤 파라미터로 사용할지 */
  readonly modelConfig: AgentModelConfig;

  /** 권한 모드 — 도구 실행 시 승인 정책 */
  readonly permissionMode: AgentPermissionMode;

  /** 최대 실행 단계 수 (circuit breaker) */
  readonly maxSteps: number;

  /** 최대 토큰 예산 (input + output 합계) */
  readonly maxTokenBudget: number;

  /** 백그라운드 실행 가능 여부 */
  readonly backgroundCapable: boolean;

  /** 검증 프로필 — 실행 완료 후 어떤 검증을 수행할지 */
  readonly verificationProfile?: VerificationProfile;

  /** UI 표시 힌트 */
  readonly uiHints: AgentUIHints;

  /** 실행 시 주입할 시스템 프롬프트 템플릿 */
  readonly systemPromptTemplate: string;

  /** 커스텀 hooks */
  readonly hooks?: AgentHooks;
}

interface AgentPurpose {
  readonly shortDescription: string;   // UI 표시용, 50자 이내
  readonly detailedDescription: string; // 시스템 프롬프트에 포함
  readonly category: "research" | "implementation" | "review" | "testing" | "planning" | "general";
}

type AgentMemoryScope = "session" | "project" | "global" | "none";

type AgentIsolationMode =
  | "shared"           // 메인 워크트리 공유
  | "worktree"         // git worktree로 격리
  | "sandbox"          // 읽기 전용 + 임시 디렉토리
  | "container";       // 향후 컨테이너 격리

interface AgentModelConfig {
  readonly preferredModel: string;       // "claude-sonnet-4-20250514"
  readonly fallbackModel?: string;       // "gemini-2.5-flash"
  readonly temperature?: number;         // 0.0 - 2.0
  readonly topP?: number;               // 0.0 - 1.0
  readonly reasoningEffort?: "low" | "medium" | "high";
  readonly maxOutputTokens?: number;
}

interface VerificationProfile {
  readonly runTests: boolean;
  readonly typeCheck: boolean;
  readonly lint: boolean;
  readonly customChecks?: readonly string[];  // bash 명령어
}

interface AgentUIHints {
  readonly badge?: string;       // "🔍" or "explorer"
  readonly color?: string;       // hex color for UI
  readonly showInStatus: boolean;
  readonly showProgress: boolean;
}

interface AgentHooks {
  readonly onSpawn?: string;      // hook script path
  readonly onComplete?: string;
  readonly onError?: string;
  readonly onMessage?: string;    // peer-to-peer 메시지 수신 시
}
```

**내장 에이전트 manifest 확장**:

| Agent ID | Purpose | Isolation | Model Config | Max Steps |
|----------|---------|-----------|--------------|-----------|
| `dhelix:explore` | 코드 탐색, 구조 분석 | shared | inherit (read-heavy이므로 flash 가능) | 30 |
| `dhelix:plan` | 구현 계획 수립 | shared | high-tier (opus/pro) | 20 |
| `dhelix:implement` | 코드 구현 | worktree | mid-tier (sonnet/flash) | 50 |
| `dhelix:review` | 코드 리뷰 | shared (read-only) | high-tier | 15 |
| `dhelix:test` | 테스트 작성/실행 | worktree | mid-tier | 40 |
| `dhelix:build` | 빌드 오류 해결 | shared | mid-tier | 25 |
| `dhelix:security` | 보안 분석 | sandbox | high-tier | 20 |
| `dhelix:compact` | 컨텍스트 압축 | none | low-tier (flash/haiku) | 5 |

### 4.2 Agent Communication Protocols

**현재**: Parent-child 단방향 + SharedAgentState 통한 간접 통신

**목표**: 3가지 통신 패턴 지원

#### Pattern 1: Parent-Child (기존 강화)

```
Parent Agent
  ├── spawn(child_a, task_a) → result_a
  ├── spawn(child_b, task_b) → result_b
  └── synthesize(result_a, result_b)
```

강화 사항:
- 부모가 자식에게 중간 지시를 보낼 수 있는 `sendDirective(agentId, message)` 추가
- 자식이 부모에게 진행 상황을 보고하는 `reportProgress(percentage, status)` 추가
- 자식 실패 시 부모가 재시도/대체 전략을 선택할 수 있는 `onChildFailure` 핸들러

#### Pattern 2: Peer-to-Peer Messaging (신규)

```
Agent A ←→ Agent B
  │              │
  ├─ broadcast("schema-changed", payload)
  │              │
  │              └─ onMessage: update local context
  │
  └─ request(agentB.id, "review-this", payload) → response
```

구현 방식:
- `AgentMessageBus` — 에이전트 간 비동기 메시지 교환
- Publish-Subscribe: 특정 토픽에 관심 있는 에이전트가 구독
- Request-Response: 특정 에이전트에게 요청하고 응답 대기
- Message queue per agent — 에이전트가 처리할 준비가 될 때까지 큐에 보관

```typescript
// src/orchestration/message-bus.ts
interface AgentMessageBus {
  /** 특정 에이전트에게 메시지 전송 */
  send(targetAgentId: string, message: AgentMessage): Promise<void>;

  /** 브로드캐스트 — 모든 활성 에이전트에게 전송 */
  broadcast(topic: string, payload: unknown): Promise<void>;

  /** 요청-응답 패턴 */
  request(targetAgentId: string, message: AgentMessage, timeoutMs?: number): Promise<AgentMessage>;

  /** 메시지 구독 */
  subscribe(topic: string, handler: MessageHandler): Unsubscribe;

  /** 에이전트의 메시지 큐 조회 */
  getQueue(agentId: string): readonly AgentMessage[];
}

interface AgentMessage {
  readonly id: string;
  readonly from: string;       // sender agent ID
  readonly to: string | "*";   // target agent ID or broadcast
  readonly topic: string;
  readonly payload: unknown;
  readonly timestamp: number;
  readonly replyTo?: string;   // request-response correlation
}
```

#### Pattern 3: Artifact Sharing (신규)

에이전트가 생산한 artifact (파일, 분석 결과, 계획 문서)를 다른 에이전트가 참조할 수 있는 구조.

```typescript
// src/orchestration/artifact-registry.ts
interface ArtifactRegistry {
  /** 아티팩트 등록 */
  publish(artifact: AgentArtifact): Promise<string>;  // returns artifact ID

  /** 아티팩트 조회 */
  get(artifactId: string): Promise<AgentArtifact | null>;

  /** 태그/에이전트 기준 검색 */
  search(query: ArtifactQuery): Promise<readonly AgentArtifact[]>;
}

interface AgentArtifact {
  readonly id: string;
  readonly producerAgentId: string;
  readonly type: "file" | "analysis" | "plan" | "test-result" | "review";
  readonly path?: string;         // 파일 경로 (type=file인 경우)
  readonly content?: string;      // 인라인 콘텐츠
  readonly metadata: Record<string, unknown>;
  readonly tags: readonly string[];
  readonly createdAt: number;
}
```

### 4.3 Orchestration Control Plane

개별 컴포넌트를 통합 관리하는 중앙 제어 계층.

```
┌─────────────────────────────────────────────┐
│           OrchestrationControlPlane          │
├─────────────────────────────────────────────┤
│  SpawnPolicy     │  QuotaManager            │
│  - max concurrency│  - token budget per team │
│  - depth limits   │  - cost ceiling          │
│  - isolation rules│  - rate limiting         │
├──────────────────┼──────────────────────────┤
│  HealthMonitor   │  EventStore              │
│  - agent liveness│  - event sourcing        │
│  - progress track│  - replay/resume         │
│  - timeout detect│  - audit trail           │
├──────────────────┼──────────────────────────┤
│  ModelBudget     │  PlacementStrategy       │
│  - per-agent     │  - local vs cloud        │
│  - per-team      │  - GPU availability      │
│  - global ceiling│  - latency requirements  │
└─────────────────────────────────────────────┘
```

**SpawnPolicy** (`src/orchestration/spawn-policy.ts`):

```typescript
interface SpawnPolicy {
  /** 동시에 활성 상태인 에이전트 최대 수 */
  readonly maxConcurrentAgents: number;     // default: 5

  /** 에이전트 중첩 깊이 제한 */
  readonly maxAgentDepth: number;           // default: 3

  /** 팀 내 최대 멤버 수 */
  readonly maxTeamSize: number;             // default: 10

  /** 동일 에이전트 유형의 동시 인스턴스 제한 */
  readonly maxInstancesPerType: number;     // default: 3

  /** 새 에이전트 생성 전 검증 */
  validate(request: SpawnRequest): SpawnValidationResult;

  /** 대기 큐 — 동시성 한도 초과 시 큐에 등록 */
  enqueue(request: SpawnRequest): Promise<SpawnTicket>;
}

interface SpawnRequest {
  readonly manifest: AgentManifest;
  readonly parentAgentId?: string;
  readonly teamId?: string;
  readonly priority: "critical" | "high" | "normal" | "low";
  readonly estimatedDuration?: number;   // ms
}
```

**QuotaManager** (`src/orchestration/quota-manager.ts`):

```typescript
interface QuotaManager {
  /** 에이전트별 토큰 예산 조회 */
  getRemainingBudget(agentId: string): TokenBudget;

  /** 팀별 총 비용 조회 */
  getTeamCost(teamId: string): CostSummary;

  /** 글로벌 비용 한도 확인 */
  isWithinGlobalLimit(): boolean;

  /** 예산 소진 시 정책 */
  readonly exhaustionPolicy: "stop" | "downgrade-model" | "notify-and-continue";

  /** 모델 다운그레이드 체인 (exhaustionPolicy=downgrade-model일 때) */
  readonly downgradeChain: readonly string[];
  // 예: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "gemini-2.5-flash", "stop"]
}

interface TokenBudget {
  readonly totalAllocated: number;
  readonly consumed: number;
  readonly remaining: number;
  readonly estimatedCostUSD: number;
}
```

**HealthMonitor** (`src/orchestration/health-monitor.ts`):

```typescript
interface HealthMonitor {
  /** 에이전트 상태 조회 */
  getAgentHealth(agentId: string): AgentHealthStatus;

  /** 모든 활성 에이전트 상태 조회 */
  getAllActive(): readonly AgentHealthStatus[];

  /** 타임아웃 감지 — 지정 시간 내 progress 없으면 알림 */
  setTimeout(agentId: string, timeoutMs: number): void;

  /** Heartbeat 수신 */
  heartbeat(agentId: string, progress?: ProgressInfo): void;

  /** 비정상 에이전트 자동 정리 */
  cleanupStale(thresholdMs: number): Promise<readonly string[]>;
}

interface AgentHealthStatus {
  readonly agentId: string;
  readonly status: "healthy" | "slow" | "stalled" | "crashed";
  readonly lastHeartbeat: number;
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly memoryUsageMB: number;
  readonly tokenUsage: TokenBudget;
}
```

### 4.4 Agent Depth Limits and Recursion Prevention

Codex의 depth tracking 패턴을 참조하되, 예산 기반으로 확장한다.

```typescript
// src/orchestration/depth-tracker.ts
interface DepthTracker {
  /** 현재 에이전트의 깊이 */
  getCurrentDepth(agentId: string): number;

  /** spawn 가능 여부 확인 — depth + budget 복합 검증 */
  canSpawn(parentAgentId: string, childManifest: AgentManifest): DepthCheckResult;

  /** 에이전트 트리 시각화 (디버깅용) */
  getAgentTree(): AgentTreeNode;
}

interface DepthCheckResult {
  readonly allowed: boolean;
  readonly currentDepth: number;
  readonly maxDepth: number;
  readonly reason?: string;
  /** 허용되지 않을 경우 대안 제안 */
  readonly suggestion?: string;
  // 예: "depth limit 3 exceeded — consider merging tasks or using peer communication"
}

interface AgentTreeNode {
  readonly agentId: string;
  readonly manifest: AgentManifest;
  readonly depth: number;
  readonly status: AgentHealthStatus;
  readonly children: readonly AgentTreeNode[];
}
```

**재귀 방지 전략**:
1. Hard depth limit: 기본 3, 최대 5 (설정 가능)
2. Total agent count limit: 세션당 최대 20개 에이전트
3. Same-purpose guard: 동일 purpose의 에이전트가 자식을 spawn하면 경고
4. Token budget cascade: 자식 에이전트의 예산은 부모 잔여 예산의 subset
5. Cycle detection: agent 간 의존성 그래프에 cycle이 있으면 spawn 거부

---

## 5. Model Router Enhancement

### 5.1 Dual-Model Auto-Routing 완성

현재 `DualModelRouter`의 `auto` 전략을 실제 구현한다.

**Task Classification Engine**:

```typescript
// src/llm/task-classifier.ts
interface TaskClassifier {
  /**
   * 메시지와 컨텍스트를 분석하여 TaskPhase를 결정
   * 
   * 분류 기준:
   * - 키워드 분석: "plan", "design", "architect" → plan phase
   * - 도구 호출 패턴: file_write, bash_exec → execute phase
   * - 대화 히스토리: 이전 계획 존재 + 코드 생성 요청 → execute phase
   * - 메시지 길이/복잡도: 긴 분석 요청 → plan phase
   */
  classify(context: ClassificationContext): TaskClassification;
}

interface ClassificationContext {
  readonly currentMessage: string;
  readonly recentHistory: readonly ChatMessage[];   // 최근 5개
  readonly pendingToolCalls: readonly string[];     // 대기 중인 도구 호출
  readonly sessionPhase: "initial" | "mid" | "late";
  readonly fileChangesCount: number;                // 이 세션에서 수정한 파일 수
}

interface TaskClassification {
  readonly phase: TaskPhase;       // "plan" | "execute" | "review"
  readonly confidence: number;     // 0.0 - 1.0
  readonly reasoning: string;      // 분류 근거 (디버깅용)
  readonly suggestedModel: string; // 추천 모델
}
```

**분류 규칙 (Rule-based + Heuristic)**:

| Signal | Weight | Phase |
|--------|--------|-------|
| 첫 메시지 (no history) | 0.8 | plan |
| "계획", "설계", "분석", "리뷰" 키워드 | 0.7 | plan |
| "구현", "코드", "작성", "수정" 키워드 | 0.6 | execute |
| 이전 턴에 plan 결과 있음 + 현재 "진행해줘" | 0.9 | execute |
| file_write/file_edit 도구 호출 직후 | 0.7 | execute |
| "확인", "검토", "테스트" 키워드 | 0.6 | review |
| 10+ 파일 수정 후 | 0.5 | review |
| Confidence < 0.5 | fallback | architect model (안전 선택) |

**Auto-routing 동작 흐름**:

```
User message 수신
    ↓
TaskClassifier.classify(context)
    ↓
confidence >= 0.6?
  ├── Yes → 분류된 phase의 모델 사용
  └── No  → architect model (더 비싸지만 안전)
    ↓
DualModelRouter.selectProvider(phase)
    ↓
LLM 호출
    ↓
응답 분석 → 다음 턴의 phase 힌트 업데이트
```

### 5.2 Weighted Model Selection

비용 vs 품질 트레이드오프를 사용자가 제어할 수 있게 한다.

```typescript
// src/llm/model-selector.ts
interface ModelSelector {
  /**
   * 주어진 작업에 최적의 모델을 선택
   * 
   * @param task - 작업 설명 및 요구사항
   * @param preferences - 사용자 선호도 (비용 vs 품질 가중치)
   * @returns 선택된 모델과 근거
   */
  select(task: TaskDescription, preferences: SelectionPreferences): ModelSelection;
}

interface SelectionPreferences {
  /** 비용 가중치 (0.0=비용 무시, 1.0=비용 최우선) — default 0.3 */
  readonly costWeight: number;

  /** 품질 가중치 (0.0=품질 무시, 1.0=품질 최우선) — default 0.7 */
  readonly qualityWeight: number;

  /** 속도 가중치 (0.0=속도 무시, 1.0=속도 최우선) — default 0.2 */
  readonly speedWeight: number;

  /** 비용 상한 (USD, 이 작업에 대해) */
  readonly maxCostPerTask?: number;

  /** 선호 프로바이더 (있으면 우선) */
  readonly preferredProviders?: readonly string[];

  /** 제외 프로바이더 */
  readonly excludedProviders?: readonly string[];
}

interface ModelSelection {
  readonly modelId: string;
  readonly provider: string;
  readonly score: number;          // 종합 점수 (0-100)
  readonly costEstimate: number;   // USD
  readonly qualityTier: CapabilityTier;
  readonly reasoning: string;      // 선택 근거
  readonly alternatives: readonly ModelAlternative[];  // 차선책 2-3개
}
```

**가중치 계산 공식**:

```
Score = (qualityWeight * qualityScore) + (costWeight * costScore) + (speedWeight * speedScore)

where:
  qualityScore = tierToScore(model.capabilityTier)   // high=100, medium=70, low=40
  costScore = 100 - normalize(model.pricing, minPrice, maxPrice) * 100
  speedScore = 100 - normalize(model.avgLatency, minLatency, maxLatency) * 100
```

**프리셋 프로필**:

| Profile | Cost | Quality | Speed | Use Case |
|---------|------|---------|-------|----------|
| `quality-first` | 0.1 | 0.8 | 0.1 | 중요한 아키텍처 결정 |
| `balanced` | 0.3 | 0.5 | 0.2 | 일반 개발 작업 |
| `cost-efficient` | 0.6 | 0.3 | 0.1 | 대량 반복 작업 |
| `speed-first` | 0.1 | 0.2 | 0.7 | 인터랙티브 탐색 |
| `local-only` | 0.0 | 0.3 | 0.7 | 오프라인, 프라이버시 우선 |

### 5.3 Adaptive Model Switching

실행 중 작업 복잡도 변화에 따라 동적으로 모델을 전환한다.

**전환 트리거**:

| Trigger | Action | 예시 |
|---------|--------|------|
| 단순 질문 감지 (짧은 응답 예상) | Downgrade | "이 함수 이름 뭐야?" → flash model |
| 복잡한 리팩토링 감지 | Upgrade | 10+ 파일 수정 계획 → opus model |
| 연속 도구 호출 실패 (3회+) | Upgrade | 모델이 문제 해결 못함 → 더 강한 모델로 |
| 토큰 예산 80% 소진 | Downgrade | 예산 절약을 위해 저렴한 모델로 |
| 사용자가 "더 자세히" 요청 | Upgrade | 현재 모델의 응답이 불충분 |
| Compaction 발생 | Downgrade | 컨텍스트 압축은 flash 모델로 충분 |

**구현 인터페이스**:

```typescript
// src/llm/adaptive-switcher.ts
interface AdaptiveModelSwitcher {
  /** 현재 모델 조회 */
  getCurrentModel(): string;

  /** 메시지 분석 후 모델 전환 필요 여부 판단 */
  evaluateSwitch(context: SwitchContext): SwitchDecision;

  /** 전환 실행 */
  executeSwitch(decision: SwitchDecision): Promise<void>;

  /** 전환 이력 조회 (디버깅/분석용) */
  getSwitchHistory(): readonly SwitchRecord[];
}

interface SwitchDecision {
  readonly shouldSwitch: boolean;
  readonly fromModel: string;
  readonly toModel: string;
  readonly trigger: string;
  readonly confidence: number;
}
```

### 5.4 A/B Testing Infrastructure

모델 라우팅 전략의 효과를 측정하기 위한 실험 프레임워크.

```typescript
// src/llm/ab-testing.ts
interface ABTestManager {
  /** 실험 정의 */
  defineExperiment(config: ExperimentConfig): string;  // experiment ID

  /** 현재 세션에 실험 배정 */
  assign(sessionId: string, experimentId: string): ExperimentVariant;

  /** 결과 기록 */
  recordOutcome(sessionId: string, outcome: ExperimentOutcome): void;

  /** 실험 결과 조회 */
  getResults(experimentId: string): ExperimentResults;
}

interface ExperimentConfig {
  readonly name: string;
  readonly description: string;

  /** 실험 변형 (최소 2개: control + treatment) */
  readonly variants: readonly ExperimentVariant[];

  /** 트래픽 분할 비율 (합계 = 1.0) */
  readonly trafficSplit: readonly number[];

  /** 측정 지표 */
  readonly metrics: readonly MetricDefinition[];

  /** 실험 기간 */
  readonly startDate: string;
  readonly endDate: string;
}

interface ExperimentVariant {
  readonly id: string;
  readonly name: string;
  readonly modelConfig: Partial<AgentModelConfig>;
  readonly routingOverride?: Partial<DualModelConfig>;
}

interface MetricDefinition {
  readonly name: string;
  readonly type: "latency" | "cost" | "quality" | "completion-rate" | "user-satisfaction";
  readonly aggregation: "mean" | "median" | "p95" | "sum";
}

interface ExperimentOutcome {
  readonly variantId: string;
  readonly metrics: Record<string, number>;
  readonly metadata?: Record<string, unknown>;
}
```

**초기 실험 후보**:

| Experiment | Control | Treatment | Primary Metric |
|-----------|---------|-----------|----------------|
| Auto-routing accuracy | Manual phase selection | TaskClassifier auto | Task completion rate |
| Flash for compaction | Sonnet for compaction | Flash for compaction | Cost per compaction |
| Adaptive switching | Fixed model | Adaptive switcher | Overall cost + quality |
| Local fallback | Cloud-only | Cloud + local fallback | Availability + latency |

---

## 6. Session Management Evolution

### 6.1 Session Forking / Branching

OpenCode의 `--fork`와 Codex의 `spawn_forked_thread`를 참조하여 구현.

**개념 모델**:

```
Session A (main)
    ├── Message 1
    ├── Message 2
    ├── Message 3  ← checkpoint
    │   ├── Fork B (from checkpoint 3)
    │   │   ├── Message B1 (다른 접근 방식 시도)
    │   │   └── Message B2
    │   └── Fork C (from checkpoint 3)
    │       ├── Message C1 (또 다른 접근)
    │       └── Message C2
    ├── Message 4 (main 계속)
    └── Merge (Fork B 결과를 main에 통합)
```

**구현 인터페이스**:

```typescript
// src/orchestration/session-manager.ts
interface SessionManager {
  /** 현재 세션에서 분기 생성 */
  fork(options: ForkOptions): Promise<SessionFork>;

  /** 분기 목록 조회 */
  listForks(sessionId: string): Promise<readonly SessionFork[]>;

  /** 분기를 메인 세션에 병합 */
  merge(forkId: string, strategy: MergeStrategy): Promise<MergeResult>;

  /** 특정 체크포인트로 세션 복원 */
  restoreCheckpoint(checkpointId: string): Promise<void>;

  /** 세션 간 전환 */
  switchSession(sessionId: string): Promise<void>;
}

interface ForkOptions {
  /** 분기할 체크포인트 (없으면 현재 시점) */
  readonly fromCheckpoint?: string;

  /** 분기 설명 */
  readonly description: string;

  /** 분기 전용 모델 오버라이드 */
  readonly modelOverride?: string;

  /** Git worktree도 함께 분기할지 */
  readonly forkWorktree: boolean;

  /** 부모 세션의 도구 실행 결과를 복사할지 */
  readonly inheritToolResults: boolean;
}

interface SessionFork {
  readonly id: string;
  readonly parentSessionId: string;
  readonly parentCheckpointId: string;
  readonly description: string;
  readonly createdAt: number;
  readonly status: "active" | "merged" | "abandoned";
  readonly messageCount: number;
  readonly worktreePath?: string;
}

type MergeStrategy =
  | "adopt-all"        // 분기의 모든 변경사항을 메인에 적용
  | "cherry-pick"      // 선택적으로 변경사항 적용
  | "summary-only";    // 분기 결과 요약만 메인 컨텍스트에 추가
```

### 6.2 Resumable Sessions with Checkpoint

프로세스 재시작/크래시 후에도 세션을 이어갈 수 있는 체크포인트 시스템.

**Checkpoint 구조**:

```typescript
// src/orchestration/checkpoint.ts
interface SessionCheckpoint {
  readonly id: string;
  readonly sessionId: string;
  readonly timestamp: number;

  /** 대화 히스토리 (compacted 포함) */
  readonly messages: readonly ChatMessage[];

  /** 현재 에이전트 상태 */
  readonly agentState: AgentStateSnapshot;

  /** 활성 팀 상태 (있는 경우) */
  readonly teamState?: TeamSessionSnapshot;

  /** 수정된 파일 목록 + diff */
  readonly fileChanges: readonly FileChange[];

  /** 도구 실행 결과 캐시 */
  readonly toolResultCache: Record<string, unknown>;

  /** 환경 정보 (working directory, git branch 등) */
  readonly environment: EnvironmentSnapshot;

  /** 모델 라우팅 상태 (현재 phase, 전환 이력) */
  readonly routingState: RoutingStateSnapshot;

  /** 비용 추적 상태 */
  readonly costState: CostSnapshot;
}

interface CheckpointManager {
  /** 자동 체크포인트 생성 (매 N턴 또는 중요 이벤트 시) */
  readonly autoCheckpointInterval: number;  // default: 5 turns

  /** 수동 체크포인트 생성 */
  createCheckpoint(label?: string): Promise<string>;

  /** 체크포인트 목록 조회 */
  listCheckpoints(sessionId: string): Promise<readonly CheckpointSummary[]>;

  /** 체크포인트에서 세션 복원 */
  restore(checkpointId: string): Promise<RestoredSession>;

  /** 오래된 체크포인트 정리 */
  prune(retentionPolicy: RetentionPolicy): Promise<number>;
}
```

**자동 체크포인트 트리거**:

| Event | 체크포인트 생성 | 이유 |
|-------|---------------|------|
| 5턴마다 | Auto | 정기적 안전망 |
| Team execution 시작 전 | Auto | 팀 실행은 비용이 크므로 롤백 가능하게 |
| 10+ 파일 수정 후 | Auto | 대규모 변경 전 상태 보존 |
| 사용자 `/checkpoint` 명령 | Manual | 명시적 저장점 |
| Model switch 발생 | Auto | 전환 전 상태 기록 |
| Compaction 직전 | Auto | 원본 컨텍스트 보존 |

**저장 전략**:
- 최근 10개 체크포인트는 전체 보존
- 이전 체크포인트는 delta 형태로 압축 (이전 대비 변경분만)
- 24시간 이상 지난 체크포인트는 메시지 요약본만 보존
- 저장 위치: `~/.dhelix/sessions/{sessionId}/checkpoints/`

### 6.3 Cross-Session Artifact Sharing

서로 다른 세션에서 생산된 artifact를 재사용할 수 있는 시스템.

```typescript
// src/orchestration/session-artifacts.ts
interface SessionArtifactStore {
  /** 현재 세션의 아티팩트를 글로벌 스토어에 발행 */
  publish(artifact: SessionArtifact): Promise<string>;

  /** 다른 세션의 아티팩트를 현재 세션으로 가져오기 */
  import(artifactId: string): Promise<SessionArtifact>;

  /** 프로젝트 내 모든 세션의 아티팩트 검색 */
  search(query: ArtifactSearchQuery): Promise<readonly SessionArtifact[]>;

  /** 아티팩트 만료 정책 관리 */
  setRetention(policy: ArtifactRetentionPolicy): void;
}

interface SessionArtifact {
  readonly id: string;
  readonly sessionId: string;
  readonly type: "analysis" | "plan" | "code-snippet" | "test-result" | "decision";
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly projectPath: string;    // 어떤 프로젝트에서 생성되었는지
  readonly createdAt: number;
  readonly expiresAt?: number;
}
```

**사용 시나리오**:
1. Session A에서 "보안 분석" 수행 → 분석 결과를 artifact로 발행
2. Session B에서 "보안 수정" 작업 시 → Session A의 분석 결과를 import하여 컨텍스트로 활용
3. 반복적인 프로젝트 분석 결과(아키텍처 다이어그램, 의존성 그래프)를 캐시하여 재사용

---

## 7. Implementation Roadmap

### 7.1 Phase Overview

| Phase | Period | Focus | Key Deliverables |
|-------|--------|-------|------------------|
| Phase 1 | Week 1-3 | Provider Foundation | ProviderRegistry, Gemini, Azure OpenAI |
| Phase 2 | Week 4-6 | Provider Expansion | Bedrock, Mistral, Groq, fallback chain |
| Phase 3 | Week 7-9 | Local + Router | Ollama/LMStudio, auto-routing, task classifier |
| Phase 4 | Week 10-12 | Agent Manifests | Typed manifests, 8 built-in agents, message bus |
| Phase 5 | Week 13-15 | Control Plane | SpawnPolicy, QuotaManager, HealthMonitor |
| Phase 6 | Week 16-18 | Session Evolution | Forking, checkpoints, artifact sharing |
| Phase 7 | Week 19-21 | A/B + Adaptive | A/B testing, adaptive switching, weighted selection |

### 7.2 Detailed Task Breakdown

**Phase 1: Provider Foundation (Week 1-3)**

```
Week 1:
  ├── [P0] ProviderRegistry 인터페이스 + 기본 구현
  ├── [P0] UnifiedLLMProvider 인터페이스 정의
  ├── [P0] 기존 AnthropicProvider를 새 인터페이스에 적응
  └── [P1] Provider health check 메커니즘

Week 2:
  ├── [P0] GoogleGeminiProvider 구현 (chat + stream)
  ├── [P0] Gemini function calling 매핑
  ├── [P1] Gemini search grounding 통합
  └── [P1] model-capabilities.ts에 Gemini 모델 추가

Week 3:
  ├── [P0] AzureOpenAIProvider 구현
  ├── [P0] Azure AD 인증 지원
  ├── [P1] /model 커맨드에 프로바이더 표시
  └── [P1] providers.json 설정 파일 지원
```

**Phase 2: Provider Expansion (Week 4-6)**

```
Week 4:
  ├── [P0] AWSBedrockProvider 구현
  ├── [P0] AWS credential chain 통합
  └── [P1] Bedrock Guardrails 연동

Week 5:
  ├── [P0] MistralProvider 구현
  ├── [P0] GroqProvider 구현
  └── [P1] Rate limit 관리 (token-bucket)

Week 6:
  ├── [P0] Provider fallback chain 구현
  ├── [P0] 통합 에러 매핑 (ProviderError)
  ├── [P1] Provider-specific retry 전략
  └── [P1] 프로바이더 전환 시 컨텍스트 호환성 검증
```

**Phase 3: Local Models + Router (Week 7-9)**

```
Week 7:
  ├── [P0] LocalProvider (Ollama + LMStudio)
  ├── [P0] 모델 자동 감지
  └── [P1] GPU 메모리 모니터링

Week 8:
  ├── [P0] TaskClassifier 구현 (rule-based)
  ├── [P0] DualModelRouter auto 전략 완성
  └── [P1] Small model path (compaction, titles)

Week 9:
  ├── [P0] ModelSelector (weighted selection)
  ├── [P1] Selection 프리셋 프로필
  └── [P1] /model-profile 슬래시 커맨드
```

### 7.3 File-Level Change Map

| New File | Module | Purpose |
|----------|--------|---------|
| `src/llm/providers/registry.ts` | LLM | ProviderRegistry, ProviderManifest |
| `src/llm/providers/google-gemini.ts` | LLM | Google Gemini provider |
| `src/llm/providers/azure-openai.ts` | LLM | Azure OpenAI provider |
| `src/llm/providers/aws-bedrock.ts` | LLM | AWS Bedrock provider |
| `src/llm/providers/mistral.ts` | LLM | Mistral provider |
| `src/llm/providers/groq.ts` | LLM | Groq provider |
| `src/llm/providers/local.ts` | LLM | Ollama/LMStudio provider |
| `src/llm/task-classifier.ts` | LLM | Task phase classification |
| `src/llm/model-selector.ts` | LLM | Weighted model selection |
| `src/llm/adaptive-switcher.ts` | LLM | Dynamic model switching |
| `src/llm/ab-testing.ts` | LLM | A/B experiment framework |
| `src/orchestration/agent-manifest.ts` | Orchestration | Typed agent manifests |
| `src/orchestration/message-bus.ts` | Orchestration | Agent communication |
| `src/orchestration/artifact-registry.ts` | Orchestration | Artifact sharing |
| `src/orchestration/control-plane.ts` | Orchestration | Central control layer |
| `src/orchestration/spawn-policy.ts` | Orchestration | Spawn validation |
| `src/orchestration/quota-manager.ts` | Orchestration | Token/cost budgets |
| `src/orchestration/health-monitor.ts` | Orchestration | Agent liveness |
| `src/orchestration/depth-tracker.ts` | Orchestration | Recursion prevention |
| `src/orchestration/session-manager.ts` | Orchestration | Fork/branch/merge |
| `src/orchestration/checkpoint.ts` | Orchestration | Resumable sessions |
| `src/orchestration/session-artifacts.ts` | Orchestration | Cross-session sharing |
| `src/orchestration/event-store.ts` | Orchestration | Event sourcing |

| Modified File | Changes |
|---------------|---------|
| `src/llm/client-factory.ts` | ProviderRegistry 기반으로 리팩토링 |
| `src/llm/model-capabilities.ts` | 프로바이더별 capabilities 분리 |
| `src/llm/dual-model-router.ts` | TaskClassifier 통합, auto 전략 완성 |
| `src/llm/cost-tracker.ts` | QuotaManager 통합 |
| `src/subagents/spawner.ts` | SpawnPolicy + DepthTracker 통합 |
| `src/subagents/team-manager.ts` | EventStore 통합, durable state |
| `src/subagents/definition-types.ts` | AgentManifest로 확장 |
| `src/subagents/shared-state.ts` | MessageBus 통합 |
| `src/core/agent-loop.ts` | AdaptiveSwitcher 통합, checkpoint hook |

---

## 8. Success Metrics

### 8.1 Provider Expansion Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Supported providers | 3 | 10+ | Provider registry count |
| Provider switch time | N/A (manual) | < 2s | Hot-switch latency |
| Fallback recovery rate | 0% | > 95% | Auto-recovery on provider failure |
| Local model detection | 0% | > 90% | Auto-detect accuracy |
| Config-to-working | N/A | < 30s | API key 설정 후 첫 응답까지 |

### 8.2 Multi-Agent Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Parallel task completion rate | ~70% | > 90% | Team execution success |
| Resume integrity | 0% (no resume) | > 95% | Checkpoint restore accuracy |
| Artifact reuse rate | 0% | > 30% | Cross-agent artifact references |
| Agent spawn overhead | ~3s | < 1s | Time from spawn request to first message |
| Max concurrent agents | ~3 (practical) | 8+ | Stress test max |
| Recursion prevention | Basic depth | 100% | Zero infinite recursion incidents |

### 8.3 Model Router Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Auto-routing accuracy | 0% (no auto) | > 80% | Correct phase classification |
| Cost reduction (vs fixed high-tier) | 0% | 30-50% | USD per session |
| Quality regression (vs fixed high-tier) | N/A | < 5% | Task completion quality score |
| Model switch latency | N/A | < 500ms | Time to switch mid-conversation |
| A/B experiment throughput | 0 | 3+ concurrent | Active experiments |

### 8.4 Session Management Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Session recovery rate | 0% | > 95% | Successful checkpoint restore |
| Fork creation time | N/A | < 1s | Fork latency |
| Merge success rate | N/A | > 85% | Fork merge without conflicts |
| Checkpoint storage overhead | N/A | < 10MB/session | Disk usage |
| Cross-session artifact hit rate | 0% | > 20% | Reuse of previous session artifacts |

### 8.5 Competitive Parity Checkpoints

| Milestone | OpenCode Parity | Codex Parity | Timeline |
|-----------|----------------|--------------|----------|
| 10+ providers | Yes | N/A | Phase 3 (Week 9) |
| Per-agent model config | Yes | N/A | Phase 4 (Week 12) |
| Session forking | Yes | Yes | Phase 6 (Week 18) |
| Peer-to-peer messaging | Exceeds | Exceeds | Phase 4 (Week 12) |
| Orchestration control plane | Exceeds | Exceeds | Phase 5 (Week 15) |
| A/B testing | Exceeds | Exceeds | Phase 7 (Week 21) |
| Durable orchestration store | Exceeds | Partial | Phase 5 (Week 15) |

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Provider API 불안정 (breaking changes) | High | Medium | 버전 고정 + integration test suite |
| Local model 품질 편차 | Medium | High | Capability tier 기반 자동 프롬프트 조정 |
| Checkpoint 크기 폭발 | Medium | Medium | Delta 압축 + retention policy |
| Agent 간 메시지 순서 보장 | High | Low | Lamport timestamp + vector clock |
| A/B 실험 간 간섭 | Medium | Medium | Isolation 보장 + 한 세션 당 하나의 실험 |

### 9.2 Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| 비용 폭주 (expensive model 과다 사용) | High | Medium | QuotaManager + hard ceiling |
| Agent 무한 생성 | Critical | Low | SpawnPolicy + depth tracker + total limit |
| Provider 인증 정보 노출 | Critical | Low | 기존 guardrails secret scanning 활용 |
| 체크포인트 손상 | High | Low | Checksum 검증 + 이중 저장 |

---

## 10. Strategic Outcome

DHelix의 오케스트레이션 전략은 "기능 복제"가 아니라 **"관찰 가능하고 제어 가능한 AI 팀"**을 목표로 한다.

**Core Differentiators**:

1. **Provider Agnosticism**: 10+ 프로바이더를 config 하나로 전환 — vendor lock-in 제거
2. **Typed Agent Manifests**: 에이전트의 능력/제약/비용을 선언적으로 관리 — 예측 가능한 동작
3. **Orchestration Control Plane**: 중앙 제어 계층으로 스폰, 쿼타, 헬스를 통합 관리
4. **Adaptive Model Routing**: 작업 복잡도에 따라 모델을 자동 전환 — 비용 30-50% 절감
5. **Durable Sessions**: 체크포인트 기반 resume + fork/merge — 장시간 작업 안전망
6. **Agent Communication**: Parent-child + peer-to-peer — coherence 극대화

**경쟁 포지셔닝**:
- OpenCode 대비: 동등한 프로바이더 지원 + 더 강한 오케스트레이션 제어
- Codex 대비: 더 개방적인 모델 선택 + 더 유연한 에이전트 구성
- Claude Code 대비: 멀티 프로바이더 + 에이전트 팀 + 세션 관리

DHelix가 이 계획을 실행하면, **"가장 유연하고 관찰 가능한 AI 코딩 오케스트레이터"**라는 포지션을 확보할 수 있다.
