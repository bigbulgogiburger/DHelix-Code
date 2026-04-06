# LLM 통합 아키텍처 리서치

> dhelix CLI를 위한 로컬/외부 LLM 통합 전략 종합 리서치
> 작성일: 2026-03-05

---

## 목차

1. [OpenAI 호환 API 서버 비교](#1-openai-호환-api-서버-비교)
2. [Function Calling 지원 현황](#2-function-calling-지원-현황)
3. [코딩 특화 로컬 LLM 모델 비교](#3-코딩-특화-로컬-llm-모델-비교)
4. [인증 패턴](#4-인증-패턴)
5. [로컬 vs 외부 LLM 설정 차이](#5-로컬-vs-외부-llm-설정-차이)
6. [모델 라우팅 전략](#6-모델-라우팅-전략)
7. [스트리밍 구현](#7-스트리밍-구현)
8. [에어갭 배포](#8-에어갭-배포)
9. [토큰 카운팅](#9-토큰-카운팅)
10. [폴백 전략](#10-폴백-전략)
11. [Provider 추상화 레이어 설계](#11-provider-추상화-레이어-설계)
12. [권장 기본 구성](#12-권장-기본-구성)

---

## 1. OpenAI 호환 API 서버 비교

### 서버별 특성 비교표

| 항목                 | Ollama            | vLLM             | llama.cpp server    | LocalAI         | LM Studio           | TGI         |
| -------------------- | ----------------- | ---------------- | ------------------- | --------------- | ------------------- | ----------- |
| **OpenAI API 호환**  | O (v1 엔드포인트) | O (완전 호환)    | O (기본 지원)       | O (드롭인 교체) | O (v1 엔드포인트)   | 부분        |
| **설치 난이도**      | 매우 쉬움         | 중간             | 중간                | 쉬움            | 매우 쉬움 (GUI)     | 어려움      |
| **Windows 지원**     | O (.exe 설치)     | 제한적 (WSL2)    | O (네이티브)        | O (Docker)      | O (네이티브)        | Docker 필요 |
| **macOS 지원**       | O (.dmg)          | O (pip)          | O (네이티브)        | O (Docker)      | O (.dmg)            | Docker 필요 |
| **GPU 지원**         | CUDA, Metal       | CUDA, ROCm       | CUDA, Metal, Vulkan | CUDA, Metal     | CUDA, Metal, Vulkan | CUDA        |
| **Function Calling** | O (제한적)        | O (완전)         | O                   | O               | O (제한적)          | 부분        |
| **스트리밍**         | O                 | O                | O                   | O               | O                   | O           |
| **동시 요청 처리**   | 제한적            | 우수 (PagedAttn) | 보통                | 보통            | 단일 사용자         | 우수        |
| **메모리 효율**      | 보통              | 우수             | 매우 우수           | 보통            | 보통                | 우수        |
| **양자화 지원**      | GGUF              | AWQ, GPTQ, GGUF  | GGUF                | GGUF            | GGUF                | AWQ, GPTQ   |
| **모델 관리**        | 자동 (pull)       | 수동             | 수동                | 자동            | GUI 기반            | 수동        |

### 성능 벤치마크 (단일 사용자 기준)

| 메트릭             | Ollama | vLLM      | llama.cpp |
| ------------------ | ------ | --------- | --------- |
| 최대 TPS (단일)    | ~41    | ~793      | 중간      |
| P99 지연시간       | ~673ms | ~80ms     | 중간      |
| 동시 사용자 확장성 | 제한적 | 35x+ 우위 | 중간      |
| 콜드 스타트 시간   | 빠름   | 느림      | 매우 빠름 |
| RAM 사용량         | 보통   | 높음      | 낮음      |

### dhelix를 위한 서버 선택 가이드

**개발/개인 사용 (권장: Ollama)**

- 원클릭 설치, Windows/macOS 네이티브
- `ollama pull` 명령으로 간단한 모델 관리
- 기본 포트 11434에서 OpenAI 호환 API 제공
- CLI 명령: `ollama serve` → `http://localhost:11434/v1`

**프로덕션/다중 사용자 (권장: vLLM)**

- PagedAttention으로 최적화된 메모리 관리
- 35배 이상의 동시 처리 성능
- 완전한 OpenAI API 호환 (tool_calls 포함)
- GPU 서버 필요 (CUDA)

**에어갭/리소스 제한 환경 (권장: llama.cpp)**

- 최소 의존성, 바이너리 단독 실행
- Vulkan을 통한 iGPU 활용 가능
- 극히 낮은 메모리 사용량
- 크로스 플랫폼 네이티브 빌드

---

## 2. Function Calling 지원 현황

### 서버별 Function Calling 기능 비교

| 기능                     | vLLM                            | Ollama | llama.cpp | LocalAI | LM Studio |
| ------------------------ | ------------------------------- | ------ | --------- | ------- | --------- |
| **tool_calls 응답 형식** | O (완전)                        | O      | O         | O       | O         |
| **병렬 함수 호출**       | O                               | X      | 부분      | 부분    | X         |
| **tool_choice 파라미터** | O                               | X      | 부분      | O       | X         |
| **스트리밍 tool_calls**  | O                               | X      | 부분      | O       | X         |
| **Hermes 파서**          | O                               | 자동   | O         | O       | 자동      |
| **자동 도구 선택**       | O (`--enable-auto-tool-choice`) | 자동   | 설정 필요 | O       | 자동      |

### Function Calling에 적합한 모델

| 모델                   | 파라미터          | Function Calling 품질 | 지원 파서 | 비고                             |
| ---------------------- | ----------------- | --------------------- | --------- | -------------------------------- |
| **Qwen2.5-Instruct**   | 3B/7B/14B/32B/72B | 매우 우수             | Hermes    | 코딩+도구 호출 모두 강력         |
| **Qwen3**              | 다양              | 매우 우수             | Hermes    | 최신, thinking 모드              |
| **Llama 3.1/3.3**      | 8B/70B/405B       | 우수                  | llama3    | Meta 공식 도구 호출 지원         |
| **Mistral Large/Nemo** | 다양              | 우수                  | mistral   | Mistral 공식                     |
| **Hermes 2 Pro**       | 7B                | 우수                  | Hermes    | 도구 호출 특화 파인튜닝          |
| **DeepSeek-V2/V3**     | 다양              | 보통                  | 커스텀    | MoE, 효율적이나 도구 호출 제한적 |

### dhelix의 이중 전략 구현 상세

```
┌─────────────────────────────────────────────┐
│           ToolCallStrategy Interface         │
│  extractToolCalls(response): ToolCall[]      │
│  formatToolsForPrompt(tools): any            │
│  supportsStreaming(): boolean                │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌──────────────────┐
│ NativeFC     │ │ TextParsing      │
│              │ │                  │
│ tool_calls   │ │ XML 태그 추출    │
│ tool_choice  │ │ <tool_call>      │
│ 스트리밍 지원 │ │ regex 파싱       │
│              │ │ 에러 복구 용이    │
└──────────────┘ └──────────────────┘
```

**자동 감지 로직 (auto-detect)**:

1. 시작 시 probe 요청: `tools` 파라미터 포함한 간단한 완성 요청 전송
2. 응답에 `tool_calls` 필드가 있으면 → NativeFC
3. 없거나 에러 → TextParsing 폴백
4. 설정으로 강제 지정 가능: `toolCallStrategy: "native" | "text-parsing" | "auto"`

---

## 3. 코딩 특화 로컬 LLM 모델 비교

### 벤치마크 비교 (2024-2025)

| 모델                       | 크기             | HumanEval  | MBPP   | Spider SQL | Aider Bench | VRAM 요구 (Q4) | 비고                        |
| -------------------------- | ---------------- | ---------- | ------ | ---------- | ----------- | -------------- | --------------------------- |
| **Qwen2.5-Coder-32B**      | 32B              | 92.7%      | 90.2%  | 82.0%      | GPT-4o급    | ~20GB          | **최강 오픈소스 코딩 모델** |
| **Qwen2.5-Coder-14B**      | 14B              | 89.5%      | 87.1%  | -          | -           | ~10GB          | 성능/효율 밸런스            |
| **Qwen2.5-Coder-7B**       | 7B               | 88.4%      | 83.5%  | -          | -           | ~5GB           | 7B 최강                     |
| **Qwen2.5-Coder-3B**       | 3B               | 76.8%      | -      | -          | -           | ~2.5GB         | 가벼운 작업용               |
| **DeepSeek-Coder-V2-Lite** | 16B(2.4B active) | 81.1%      | 80.4%  | -          | -           | ~5GB           | MoE, 효율적                 |
| **Codestral**              | 22B              | 81.1%      | 78.2%  | 76.6%      | -           | ~14GB          | Mistral 코딩 특화           |
| **CodeLlama**              | 7B/13B/34B       | 62.2%(34B) | -      | -          | -           | 다양           | 구세대, 비추천              |
| **StarCoder2**             | 3B/7B/15B        | 보통       | 보통   | -          | -           | 다양           | 저자원 언어에 강점          |
| **Qwen3**                  | 다양             | 최상위     | 최상위 | -          | -           | 다양           | 최신(2025), thinking 모드   |

### 모델 선택 가이드

| 시나리오                  | 추천 모델               | 이유                               |
| ------------------------- | ----------------------- | ---------------------------------- |
| **8GB VRAM 이하**         | Qwen2.5-Coder-7B (Q4)   | 7B 클래스 최고 성능, ~5GB VRAM     |
| **16GB VRAM**             | Qwen2.5-Coder-14B (Q4)  | 성능/효율 최적 밸런스              |
| **24GB+ VRAM**            | Qwen2.5-Coder-32B (Q4)  | GPT-4o급 코딩 성능                 |
| **CPU 전용**              | Qwen2.5-Coder-3B (Q4)   | 경량, CPU에서도 실용적             |
| **Function Calling 중심** | Qwen2.5-Instruct 시리즈 | 도구 호출 학습 포함                |
| **최신 최강**             | Qwen3 시리즈            | 2025 최신, thinking + non-thinking |

### 양자화별 성능 영향

| 양자화 | 크기 감소 | 성능 손실 | 권장 사용처          |
| ------ | --------- | --------- | -------------------- |
| FP16   | 없음      | 없음      | GPU 메모리 충분할 때 |
| Q8_0   | ~50%      | ~1%       | 최적 밸런스          |
| Q5_K_M | ~65%      | ~2-3%     | 대부분의 경우 권장   |
| Q4_K_M | ~75%      | ~3-5%     | VRAM 제한 시         |
| Q3_K_M | ~80%      | ~5-10%    | 극한 제한 시         |
| Q2_K   | ~85%      | ~15%+     | 비추천               |

---

## 4. 인증 패턴

### 인증 방식별 비교

| 방식              | 구현 난이도 | 보안 수준 | 사용처                        | Node.js 구현                     |
| ----------------- | ----------- | --------- | ----------------------------- | -------------------------------- |
| **Bearer Token**  | 쉬움        | 중간      | OpenAI, Anthropic, 대부분 API | `Authorization: Bearer <token>`  |
| **API Key**       | 쉬움        | 중간      | OpenAI, 내부 서비스           | 커스텀 헤더 또는 쿼리 파라미터   |
| **OAuth2**        | 중간        | 높음      | 엔터프라이즈 인증             | `openid-client` 또는 수동 구현   |
| **mTLS**          | 어려움      | 매우 높음 | 폐쇄망 보안 통신              | `https.Agent({ cert, key, ca })` |
| **Custom Header** | 쉬움        | 다양      | 내부 API 게이트웨이           | 설정 가능한 헤더명/값            |

### dhelix 인증 구현 설계

```typescript
// src/llm/auth.ts - 유연한 인증 인터페이스
interface AuthProvider {
  readonly type: string;
  getHeaders(): Promise<Record<string, string>>;
  isExpired(): boolean;
  refresh(): Promise<void>;
}

// Bearer Token
class BearerAuthProvider implements AuthProvider {
  type = "bearer" as const;
  // token을 env, file, keychain, prompt에서 가져옴
}

// API Key (OpenAI 스타일)
class ApiKeyAuthProvider implements AuthProvider {
  type = "api-key" as const;
  // API 키를 Authorization 헤더에 설정
}

// Custom Header (내부 게이트웨이)
class CustomHeaderAuthProvider implements AuthProvider {
  type = "custom-header" as const;
  // 설정 파일에서 헤더명/값 읽기
}

// mTLS (인증서 기반)
class MtlsAuthProvider implements AuthProvider {
  type = "mtls" as const;
  // Node.js https.Agent에 cert/key/ca 주입
}

// No Auth (로컬 LLM)
class NoAuthProvider implements AuthProvider {
  type = "none" as const;
  getHeaders() {
    return Promise.resolve({});
  }
}
```

### 토큰 저장소 우선순위

| 저장소                 | 보안 수준         | 크로스 플랫폼                               | 의존성                     |
| ---------------------- | ----------------- | ------------------------------------------- | -------------------------- |
| **OS 키체인** (keytar) | 매우 높음         | Windows(Credential Vault) / macOS(Keychain) | `keytar` 네이티브 바이너리 |
| **암호화 파일**        | 높음              | O                                           | `crypto` 내장 모듈         |
| **환경변수**           | 중간              | O                                           | 없음                       |
| **설정 파일 (평문)**   | 낮음              | O                                           | 없음                       |
| **실행 시 프롬프트**   | 높음 (저장 안 함) | O                                           | 없음                       |

**권장**: 환경변수 → OS 키체인 → 암호화 파일 순으로 폴백

---

## 5. 로컬 vs 외부 LLM 설정 차이

### 특성 비교

| 항목                | 로컬 LLM               | 외부 LLM                      |
| ------------------- | ---------------------- | ----------------------------- |
| **인증**            | 불필요 (NoAuth)        | 필수 (Bearer/API Key)         |
| **지연시간**        | 낮음 (10-100ms TTFT)   | 높음 (200-2000ms TTFT)        |
| **모델 크기**       | 하드웨어 제한 (3B-70B) | 제한 없음 (GPT-4o, Claude 등) |
| **Rate Limit**      | 없음                   | 있음 (RPM, TPM)               |
| **비용**            | 전기료만               | 토큰당 과금                   |
| **가드레일**        | 선택적                 | 필수                          |
| **네트워크**        | localhost              | 인터넷/내부망                 |
| **가용성**          | 항상 (서버 가동 시)    | 프로바이더 의존               |
| **프라이버시**      | 완전 로컬              | 데이터 전송 필요              |
| **컨텍스트 윈도우** | 제한적 (4K-128K)       | 넓음 (128K-1M)                |

### 설정 구조 설계

```typescript
// src/config/schema.ts
interface LLMProviderConfig {
  // 공통
  name: string; // 표시 이름
  baseURL: string; // API 엔드포인트
  model: string; // 모델 식별자
  maxTokens?: number; // 최대 생성 토큰
  temperature?: number; // 온도
  contextWindow?: number; // 컨텍스트 윈도우 크기

  // 인증 (로컬은 생략 가능)
  auth?: {
    type: "none" | "bearer" | "api-key" | "custom-header" | "mtls";
    token?: string; // 직접 지정 또는
    tokenEnv?: string; // 환경변수명
    tokenFile?: string; // 파일 경로
    headerName?: string; // 커스텀 헤더명
    certPath?: string; // mTLS 인증서
    keyPath?: string; // mTLS 키
  };

  // 도구 호출
  toolCallStrategy?: "native" | "text-parsing" | "auto";

  // 가드레일 (외부 LLM 시 활성화)
  guardrails?: {
    enabled: boolean;
    inputFilter?: boolean;
    outputFilter?: boolean;
    secretScanning?: boolean;
    rateLimiting?: {
      requestsPerMinute?: number;
      tokensPerDay?: number;
    };
    auditLog?: boolean;
  };

  // 네트워크
  timeout?: number; // 요청 타임아웃 (ms)
  retries?: number; // 재시도 횟수
  proxy?: string; // HTTP 프록시
}
```

### 환경별 기본 설정 예시

```jsonc
// .dhelix.json - 로컬 Ollama 설정
{
  "provider": {
    "name": "local-ollama",
    "baseURL": "http://localhost:11434/v1",
    "model": "qwen2.5-coder:14b",
    "auth": { "type": "none" },
    "toolCallStrategy": "auto",
    "guardrails": { "enabled": false },
    "timeout": 120000,
  },
}
```

```jsonc
// .dhelix.json - 외부 OpenAI 호환 API 설정
{
  "provider": {
    "name": "company-llm",
    "baseURL": "https://llm-gateway.company.com/v1",
    "model": "gpt-4o",
    "auth": {
      "type": "bearer",
      "tokenEnv": "DHELIX_API_TOKEN",
    },
    "toolCallStrategy": "native",
    "guardrails": {
      "enabled": true,
      "inputFilter": true,
      "outputFilter": true,
      "secretScanning": true,
      "rateLimiting": {
        "requestsPerMinute": 30,
        "tokensPerDay": 500000,
      },
      "auditLog": true,
    },
    "timeout": 60000,
    "retries": 3,
  },
}
```

---

## 6. 모델 라우팅 전략

### 라우팅 방식

```
┌─────────────────┐
│   사용자 요청     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Task Classifier │ ← 요청 복잡도 분석
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Simple │ │Complex │
│ Tasks  │ │ Tasks  │
└───┬────┘ └───┬────┘
    ▼          ▼
┌────────┐ ┌────────┐
│Small   │ │Large   │
│Model   │ │Model   │
│(3B/7B) │ │(32B+)  │
└────────┘ └────────┘
```

### 작업 유형별 라우팅 규칙

| 작업 유형              | 복잡도    | 추천 모델 크기 | 예시                   |
| ---------------------- | --------- | -------------- | ---------------------- |
| **코드 완성/자동완성** | 낮음      | 3B-7B          | 함수 완성, 변수명 제안 |
| **간단한 질문**        | 낮음      | 3B-7B          | "이 함수의 역할은?"    |
| **코드 리뷰**          | 중간      | 7B-14B         | 코드 품질 검토         |
| **버그 수정**          | 중간-높음 | 14B-32B        | 복잡한 디버깅          |
| **리팩토링**           | 높음      | 32B+           | 대규모 코드 구조 변경  |
| **아키텍처 설계**      | 높음      | 32B+ / 외부    | 시스템 설계            |
| **Multi-file 편집**    | 높음      | 32B+ / 외부    | 여러 파일 동시 수정    |

### 라우팅 구현 (Phase 2+ 기능)

```typescript
// src/llm/router.ts
interface ModelRouter {
  route(request: ChatRequest): ProviderConfig;
}

// 규칙 기반 라우터 (초기 구현)
class RuleBasedRouter implements ModelRouter {
  route(request: ChatRequest): ProviderConfig {
    const complexity = this.estimateComplexity(request);

    if (complexity === "low") return this.config.models.small;
    if (complexity === "medium") return this.config.models.medium;
    return this.config.models.large;
  }

  private estimateComplexity(request: ChatRequest): string {
    // 휴리스틱 기반:
    // - 메시지 길이
    // - 도구 호출 이력 수
    // - 키워드 ("refactor", "architecture", "debug" → 높음)
    // - 파일 수 (multi-file → 높음)
  }
}
```

### 비용 절감 효과

연구에 따르면 적절한 모델 라우팅을 통해:

- MT-Bench 기준 **85% 이상** 비용 절감 가능
- MMLU 기준 **45%** 비용 절감
- 품질 저하 없이 대부분의 간단한 요청을 소형 모델로 처리

---

## 7. 스트리밍 구현

### OpenAI Node.js SDK를 활용한 스트리밍

```typescript
// src/llm/streaming.ts
import OpenAI from "openai";

interface StreamOptions {
  baseURL: string;
  apiKey: string; // 로컬 LLM은 'ollama' 등 더미값
  model: string;
  messages: ChatMessage[];
  tools?: Tool[];
  onToken: (token: string) => void;
  onToolCall: (toolCall: ToolCall) => void;
  onDone: (response: CompletionResult) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal; // 취소 지원
}

async function streamCompletion(options: StreamOptions): Promise<void> {
  const client = new OpenAI({
    baseURL: options.baseURL,
    apiKey: options.apiKey,
  });

  const stream = await client.chat.completions.create({
    model: options.model,
    messages: options.messages,
    tools: options.tools,
    stream: true,
  });

  // 청크 조립
  let contentBuffer = "";
  const toolCallBuffers: Map<number, PartialToolCall> = new Map();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    // 텍스트 스트리밍
    if (delta?.content) {
      contentBuffer += delta.content;
      options.onToken(delta.content);
    }

    // 도구 호출 스트리밍 (청크 조립)
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        // 점진적 조립 후 완성 시 콜백
      }
    }
  }
}
```

### SSE (Server-Sent Events) 처리 방식

| 방식                       | 장점                        | 단점                   | 사용처              |
| -------------------------- | --------------------------- | ---------------------- | ------------------- |
| **OpenAI SDK 내장**        | 코드 최소화, 자동 청크 조립 | SDK 의존성             | 기본 구현 (권장)    |
| **fetch + ReadableStream** | 의존성 없음                 | 수동 SSE 파싱 필요     | SDK 없이 구현 시    |
| **eventsource-parser**     | SSE 파싱 전용               | 추가 의존성            | 커스텀 SSE 처리 시  |
| **WebSocket**              | 양방향 통신                 | 서버 지원 필요, 비표준 | 실시간 협업 확장 시 |

### 스트리밍 아키텍처

```
OpenAI SDK (stream: true)
    │
    ▼ for await (chunk of stream)
┌──────────────────────┐
│  StreamAssembler     │
│  - contentBuffer     │  ← 텍스트 청크 조립
│  - toolCallBuffers   │  ← tool_call 청크 조립
│  - usageAccumulator  │  ← 토큰 사용량 누적
└──────────┬───────────┘
           │ events
           ▼
┌──────────────────────┐
│  EventBus (mitt)     │
│  'token'  → UI 렌더  │
│  'tool'   → 실행      │
│  'done'   → 완료      │
│  'error'  → 에러 처리  │
└──────────────────────┘
```

### 크로스 플랫폼 고려사항

- **Windows**: `fetch` API는 Node.js 18+에서 기본 지원. OpenAI SDK는 내부적으로 `node-fetch`/`undici` 사용
- **macOS**: 동일하게 Node.js 내장 `fetch` 사용
- **프록시**: `HTTPS_PROXY` 환경변수 또는 설정의 `proxy` 필드로 처리. OpenAI SDK는 `httpAgent` 옵션 지원

---

## 8. 에어갭 배포

### 에어갭 환경의 구성 요소

```
┌─────────────────────────────────────────────────┐
│              Air-Gapped Network                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ dhelix   │  │ Ollama   │  │ LLM Model     │  │
│  │ CLI      │→ │ Server   │→ │ (GGUF file)   │  │
│  │          │  │          │  │               │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│       ↑                                          │
│  ┌──────────┐                                    │
│  │ npm      │                                    │
│  │ packages │  ← 사전 준비된 오프라인 패키지       │
│  └──────────┘                                    │
└─────────────────────────────────────────────────┘
```

### 오프라인 npm 패키지 전략

| 방법                              | 난이도 | 설명                                                                         |
| --------------------------------- | ------ | ---------------------------------------------------------------------------- |
| **npm pack + 수동 복사**          | 쉬움   | `npm pack`으로 .tgz 생성 → 에어갭 머신에 복사 → `npm install *.tgz`          |
| **Verdaccio 프라이빗 레지스트리** | 중간   | 인터넷 연결된 머신에서 캐시 → 캐시 디렉토리를 에어갭 머신의 Verdaccio에 복사 |
| **npm-offline-cache**             | 쉬움   | `npm ci --cache ./npm-cache` → 캐시 디렉토리를 복사                          |
| **단일 바이너리 빌드**            | 어려움 | `pkg` 또는 `sea` (Node.js Single Executable)로 단일 바이너리 생성            |

### 에어갭 설치 스크립트 예시

```bash
# 인터넷 연결된 머신에서 준비
npm pack                           # dhelix-1.0.0.tgz 생성
npm install --global-style         # flat node_modules
tar czf dhelix-offline.tar.gz \
  dhelix-1.0.0.tgz \
  node_modules/

# 에어갭 머신에서 설치
tar xzf dhelix-offline.tar.gz
npm install -g dhelix-1.0.0.tgz --offline

# Ollama 모델 준비 (인터넷 머신에서)
ollama pull qwen2.5-coder:14b
# ~/.ollama/models/ 디렉토리 복사

# 에어갭 머신에서 Ollama + 모델 설정
# Ollama 바이너리 복사 + 모델 디렉토리 복사
ollama serve
```

### Node.js Single Executable Application (SEA)

Node.js 20+에서는 SEA를 통해 단일 실행 파일 생성 가능:

- Windows: `.exe` 파일 생성
- macOS: 바이너리 생성
- 의존성 포함, npm 불필요
- dhelix의 에어갭 배포 시 가장 이상적인 방식

---

## 9. 토큰 카운팅

### 토크나이저별 비교

| 라이브러리               | 모델 호환      | 정확도 | 번들 크기 | Node.js 지원 | 비고                  |
| ------------------------ | -------------- | ------ | --------- | ------------ | --------------------- |
| **tiktoken** (WASM)      | OpenAI 모델    | 100%   | ~4MB      | O            | OpenAI 공식           |
| **js-tiktoken**          | OpenAI 모델    | 100%   | ~2MB      | O            | 순수 JS 구현          |
| **tokenx**               | 범용           | ~96%   | ~2KB      | O            | 근사치, 초경량        |
| **transformers.js**      | 대부분         | 100%   | ~50MB+    | O            | 무거움, 풀 토크나이저 |
| **SentencePiece (WASM)** | Llama, Mistral | 100%   | ~1MB      | O            | SP 모델 필요          |

### dhelix 토큰 카운팅 전략

```typescript
// src/llm/token-counter.ts
interface TokenCounter {
  count(text: string): number;
  countMessages(messages: ChatMessage[]): number;
}

// 계층적 전략
class AdaptiveTokenCounter implements TokenCounter {
  // 1순위: 모델별 정확한 토크나이저
  //   - OpenAI 모델 → tiktoken
  //   - Llama 모델 → SentencePiece
  //   - Qwen 모델 → tiktoken (cl100k_base 호환)
  // 2순위: 범용 근사치 (토크나이저 없을 때)
  //   - 영어: chars / 4 (약 75% 정확도)
  //   - 코드: chars / 3.5
  //   - 한국어: chars / 1.5
  // 메시지 오버헤드: 메시지당 +4 토큰 (role marker 등)
}
```

### 정확도 vs 성능 트레이드오프

| 접근법                     | 정확도 | 속도                   | 사용 시점                       |
| -------------------------- | ------ | ---------------------- | ------------------------------- |
| **정확한 토크나이저**      | 100%   | 느림 (1-5ms/1K chars)  | 컨텍스트 윈도우 관리, 비용 추정 |
| **빠른 근사치**            | 75-90% | 빠름 (<0.1ms/1K chars) | 실시간 UI 표시, 사전 체크       |
| **서버 응답** (usage 필드) | 100%   | 응답 시                | 정확한 사후 기록                |

**권장 전략**:

- UI 표시용: 근사치 (tokenx)
- 컨텍스트 트렁케이션: tiktoken/js-tiktoken (정확)
- 사용량 기록: 서버 응답의 `usage` 필드 (가장 정확)

---

## 10. 폴백 전략

### 다층 폴백 아키텍처

```
요청 ──→ Primary Provider ──성공──→ 응답
              │
              실패 (timeout/5xx/rate-limit)
              │
              ▼
         Retry (exponential backoff)
         최대 3회, 200ms → 400ms → 800ms
              │
              실패
              │
              ▼
         Secondary Provider ──성공──→ 응답
              │
              실패
              │
              ▼
         Tertiary Provider ──성공──→ 응답
              │
              실패
              │
              ▼
         Graceful Degradation
         (오프라인 모드, 캐시된 응답)
```

### 핵심 패턴

#### 1. Exponential Backoff with Jitter

```typescript
function calculateDelay(attempt: number, baseDelay: number): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * exponential * 0.1;
  return Math.min(exponential + jitter, 30000); // 최대 30초
}
```

#### 2. Circuit Breaker

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number; // 연속 실패 임계값 (기본: 5)
  resetTimeoutMs: number; // 회복 대기 시간 (기본: 60000)
  halfOpenRequests: number; // 반열림 상태에서 허용할 요청 수
}

// 상태 전이:
// CLOSED → (failureThreshold 초과) → OPEN → (resetTimeout 경과) → HALF_OPEN
//   ↑                                                                │
//   └──── (성공) ────────────────────────────────────────────────────┘
//                                                          (실패) → OPEN
```

#### 3. Provider Failover

```typescript
interface ProviderChain {
  providers: ProviderConfig[]; // 우선순위 순서
  strategy: "failover" | "round-robin" | "weighted";
}

// 예시 설정
const chain: ProviderChain = {
  strategy: "failover",
  providers: [
    { name: "primary", baseURL: "https://llm.company.com/v1" },
    { name: "secondary", baseURL: "http://localhost:11434/v1" }, // 로컬 폴백
    { name: "tertiary", baseURL: "https://api.openai.com/v1" }, // 외부 폴백
  ],
};
```

### Graceful Degradation 전략

| 상태         | 동작                                | 사용자 경험              |
| ------------ | ----------------------------------- | ------------------------ |
| **정상**     | 전체 기능                           | 스트리밍 응답, 도구 호출 |
| **느림**     | 타임아웃 증가                       | "응답이 느립니다" 표시   |
| **제한적**   | 도구 호출 비활성화, 텍스트만        | "제한 모드" 배너         |
| **오프라인** | 캐시된 시스템 프롬프트, 로컬 도구만 | "오프라인 모드" 표시     |

---

## 11. Provider 추상화 레이어 설계

### 설계 원칙

1. **단일 인터페이스**: 모든 LLM 프로바이더를 하나의 인터페이스로 통일
2. **OpenAI SDK 기반**: `openai` npm 패키지의 `baseURL` 변경으로 대부분 커버
3. **확장성**: 새 프로바이더 추가 시 최소 코드 변경
4. **관심사 분리**: 인증, 스트리밍, 도구 호출, 가드레일을 독립 모듈로

### 레퍼런스: 기존 프로젝트의 접근법

| 프로젝트          | 접근법                    | 장점                                 | 단점               |
| ----------------- | ------------------------- | ------------------------------------ | ------------------ |
| **Aider**         | LiteLLM (Python)          | 100+ 프로바이더 지원                 | Python 전용        |
| **Continue.dev**  | BaseLLM + Provider 클래스 | TypeScript 네이티브, 확장 용이       | 복잡한 상속 트리   |
| **Vercel AI SDK** | Provider 패턴 + 어댑터    | 깔끔한 TS 인터페이스, 20+ 프로바이더 | 웹 프레임워크 중심 |
| **LiteLLMjs**     | JS 포팅                   | LiteLLM 호환                         | 미성숙             |

### dhelix 추상화 레이어 아키텍처

```
┌───────────────────────────────────────────────────────┐
│                     LLMProvider Interface              │
│                                                        │
│  chat(messages, options): AsyncIterable<StreamChunk>   │
│  complete(prompt, options): AsyncIterable<StreamChunk> │
│  countTokens(text): number                            │
│  getModelInfo(): ModelInfo                            │
│  supportsToolCalls(): boolean                         │
│  healthCheck(): Promise<boolean>                      │
└──────────────────────┬────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
   ┌─────────────────┐  ┌─────────────────────┐
   │ OpenAICompatible │  │ CustomProvider       │
   │ Provider         │  │ (향후 확장용)         │
   │                  │  │                      │
   │ - Ollama         │  │ - Anthropic 직접     │
   │ - vLLM           │  │ - 자체 프로토콜       │
   │ - llama.cpp      │  │                      │
   │ - OpenAI         │  │                      │
   │ - LM Studio      │  │                      │
   │ - LocalAI        │  │                      │
   └────────┬─────────┘  └──────────────────────┘
            │
            ▼
   ┌─────────────────┐
   │ OpenAI Node SDK  │
   │ (baseURL 변경)   │
   │                  │
   │ - 스트리밍       │
   │ - tool_calls     │
   │ - 인증 헤더      │
   └─────────────────┘
```

### 핵심 인터페이스 설계

```typescript
// src/llm/provider.ts

interface StreamChunk {
  type: "text" | "tool_call" | "usage" | "done" | "error";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  error?: Error;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  signal?: AbortSignal;
}

interface LLMProvider {
  // 핵심 메서드
  chat(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<StreamChunk>;

  // 유틸리티
  countTokens(text: string): number;
  getModelInfo(): ModelInfo;
  supportsToolCalls(): boolean;
  healthCheck(): Promise<boolean>;
}

interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsImages: boolean;
}
```

### Provider Factory

```typescript
// src/llm/provider-factory.ts

function createProvider(config: LLMProviderConfig): LLMProvider {
  // OpenAI 호환 서버는 모두 동일한 구현 사용
  // baseURL만 다르게 설정
  return new OpenAICompatibleProvider({
    baseURL: config.baseURL,
    apiKey: config.auth?.token || "not-needed",
    model: config.model,
    // auth, guardrails 등을 미들웨어로 주입
  });
}
```

### 미들웨어 패턴 (관심사 분리)

```
요청 흐름:

User Request
    │
    ▼
┌────────────────┐
│ GuardrailsMiddleware │ ← 입력 필터링, 시크릿 스캐닝
└────────┬───────┘
         ▼
┌────────────────┐
│ AuthMiddleware  │ ← 인증 헤더 주입
└────────┬───────┘
         ▼
┌────────────────┐
│ RetryMiddleware │ ← 재시도, 폴백
└────────┬───────┘
         ▼
┌────────────────┐
│ LogMiddleware   │ ← 감사 로그
└────────┬───────┘
         ▼
┌────────────────┐
│ LLMProvider     │ ← 실제 API 호출
└────────────────┘
```

---

## 12. 권장 기본 구성

### 시나리오별 권장 구성

#### A. 개인 개발자 (로컬 LLM)

```jsonc
{
  "provider": {
    "baseURL": "http://localhost:11434/v1",
    "model": "qwen2.5-coder:14b",
    "auth": { "type": "none" },
    "toolCallStrategy": "auto",
    "guardrails": { "enabled": false },
  },
}
```

- **서버**: Ollama (Windows/macOS 원클릭 설치)
- **모델**: Qwen2.5-Coder-14B (16GB VRAM 권장)
- **인증**: 불필요
- **가드레일**: 선택적

#### B. 회사 내부망 (중앙 관리 LLM 서버)

```jsonc
{
  "provider": {
    "baseURL": "https://llm.company.internal/v1",
    "model": "qwen2.5-coder-32b",
    "auth": {
      "type": "bearer",
      "tokenEnv": "COMPANY_LLM_TOKEN",
    },
    "toolCallStrategy": "native",
    "guardrails": {
      "enabled": true,
      "inputFilter": true,
      "outputFilter": true,
      "secretScanning": true,
      "auditLog": true,
    },
  },
}
```

- **서버**: vLLM (GPU 서버, 다중 사용자)
- **모델**: Qwen2.5-Coder-32B
- **인증**: Bearer 토큰
- **가드레일**: 전체 활성화

#### C. 외부 API (OpenAI/Anthropic)

```jsonc
{
  "provider": {
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "auth": {
      "type": "api-key",
      "tokenEnv": "OPENAI_API_KEY",
    },
    "toolCallStrategy": "native",
    "guardrails": {
      "enabled": true,
      "inputFilter": true,
      "secretScanning": true,
      "rateLimiting": {
        "requestsPerMinute": 20,
        "tokensPerDay": 1000000,
      },
      "auditLog": true,
    },
  },
}
```

#### D. 에어갭 환경 (완전 폐쇄망)

```jsonc
{
  "provider": {
    "baseURL": "http://localhost:11434/v1",
    "model": "qwen2.5-coder:7b",
    "auth": { "type": "none" },
    "toolCallStrategy": "auto",
    "guardrails": {
      "enabled": false,
    },
    "timeout": 180000,
  },
}
```

- **서버**: Ollama (사전 설치된 바이너리)
- **모델**: Qwen2.5-Coder-7B (하드웨어 제약 고려)
- **npm**: 사전 패키징된 오프라인 설치 또는 SEA 바이너리
- **모델 파일**: 사전 다운로드된 GGUF 파일

#### E. 하이브리드 (라우팅)

```jsonc
{
  "routing": {
    "strategy": "complexity-based",
    "providers": {
      "small": {
        "baseURL": "http://localhost:11434/v1",
        "model": "qwen2.5-coder:3b",
      },
      "large": {
        "baseURL": "http://localhost:11434/v1",
        "model": "qwen2.5-coder:32b",
      },
      "external": {
        "baseURL": "https://api.openai.com/v1",
        "model": "gpt-4o",
        "auth": { "type": "api-key", "tokenEnv": "OPENAI_API_KEY" },
      },
    },
    "fallback": ["large", "external"],
  },
}
```

---

## 크로스 플랫폼 주의사항 (Windows + macOS)

| 항목              | Windows                 | macOS                                  | 대응 방안                            |
| ----------------- | ----------------------- | -------------------------------------- | ------------------------------------ |
| **경로 구분자**   | `\`                     | `/`                                    | `path.join()`, `path.resolve()` 사용 |
| **설정 경로**     | `%APPDATA%\dhelix`      | `~/Library/Application Support/dhelix` | `env-paths` npm 패키지               |
| **키체인**        | Credential Vault        | Keychain                               | `keytar` (네이티브 바인딩)           |
| **셸**            | cmd.exe / PowerShell    | bash / zsh                             | 도구 실행 시 셸 감지                 |
| **줄바꿈**        | `\r\n`                  | `\n`                                   | 파일 쓰기 시 정규화                  |
| **Ollama 경로**   | `%USERPROFILE%\.ollama` | `~/.ollama`                            | 환경별 기본 경로                     |
| **프로세스 관리** | `taskkill`              | `kill`                                 | Node.js `process.kill()` 사용        |
| **네이티브 모듈** | MSVC 빌드               | clang 빌드                             | 가능하면 WASM/순수 JS 선호           |

### 네이티브 의존성 최소화 전략

- `tiktoken` → `js-tiktoken` (순수 JS) 또는 WASM 빌드
- `keytar` → 선택적 의존성 (`optionalDependencies`)으로 설정, 없으면 암호화 파일 폴백
- 셸 명령 → `execa` 패키지로 크로스 플랫폼 프로세스 실행

---

## 구현 우선순위 (architecture-plan.md Phase 연동)

### Phase 1 (Foundation)

- [x] OpenAI SDK 기반 LLM 클라이언트 (`baseURL` 설정 가능)
- [x] 기본 스트리밍 (SSE via OpenAI SDK)
- [x] 인증 인터페이스 (NoAuth + Bearer)
- [x] 근사치 토큰 카운팅

### Phase 2 (Tool System)

- [ ] Native Function Calling 전략
- [ ] Tool Call 스트리밍 청크 조립
- [ ] ToolCallStrategy 자동 감지

### Phase 3 (Guardrails + Fallback)

- [ ] Text-parsing 폴백 전략
- [ ] 가드레일 미들웨어 체인
- [ ] Retry + Circuit Breaker
- [ ] Provider 폴백 체인

### Phase 4 (Polish)

- [ ] 정확한 토크나이저 (tiktoken/js-tiktoken)
- [ ] 모델 라우팅 (규칙 기반)
- [ ] 에어갭 배포 패키징 (SEA)
- [ ] 다중 Provider 설정 UI

---

## 참고 자료

- [Ollama 공식 사이트](https://ollama.com/)
- [vLLM 문서](https://docs.vllm.ai/)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [Continue.dev 아키텍처](https://deepwiki.com/continuedev/continue/4.1-extension-architecture)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [Qwen2.5-Coder 기술 보고서](https://arxiv.org/html/2409.12186v3)
- [RouteLLM 프레임워크](https://lmsys.org/blog/2024-07-01-routellm/)
- [LLM 라우팅 가이드 (Portkey)](https://portkey.ai/blog/task-based-llm-routing/)
- [로컬 LLM 호스팅 가이드 2025](https://medium.com/@rosgluk/local-llm-hosting-complete-2025-guide-ollama-vllm-localai-jan-lm-studio-more-f98136ce7e4a)
- [Ollama vs vLLM 벤치마크 (Red Hat)](https://developers.redhat.com/articles/2025/08/08/ollama-vs-vllm-deep-dive-performance-benchmarking)
- [에어갭 Node.js 설치](https://blog.hardill.me.uk/2024/11/04/installing-nodejs-applications-on-air-gapped-networks/)
- [토큰 카운팅 가이드 2025](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025)
- [LLM 폴백 전략 (Portkey)](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/)
