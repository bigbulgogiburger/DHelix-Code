# LLM Providers & Routing

> 참조 시점: 새 프로바이더 추가, 모델 라우팅 변경, 로컬 모델 템플릿 조정 시

## 프로바이더 목록 (8개)

| Provider              | File                         | Auth                                                       | Model Patterns                   |
| --------------------- | ---------------------------- | ---------------------------------------------------------- | -------------------------------- |
| Anthropic             | `providers/anthropic.ts`     | `ANTHROPIC_API_KEY`                                        | `claude-*`                       |
| OpenAI Compatible     | `client.ts`                  | `OPENAI_API_KEY` / `LOCAL_API_KEY`                         | `gpt-*`, `o1-*`, `o3-*`          |
| Responses API         | `responses-client.ts`        | `OPENAI_API_KEY`                                           | `gpt-5-codex`, Responses-enabled |
| Google Gemini         | `providers/google-gemini.ts` | `DHELIX_GOOGLE_API_KEY`                                    | `gemini-*`                       |
| Azure OpenAI          | `providers/azure-openai.ts`  | `DHELIX_AZURE_API_KEY`                                     | `azure-*`                        |
| AWS Bedrock           | `providers/aws-bedrock.ts`   | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`              | `bedrock-*`, `nova-*`            |
| Mistral               | `providers/mistral.ts`       | `MISTRAL_API_KEY`                                          | `mistral-*`, `codestral*`        |
| Groq                  | `providers/groq.ts`          | `GROQ_API_KEY`                                             | `llama-*`, `mixtral-*`           |
| Local (OpenAI-compat) | `providers/local.ts`         | `LOCAL_API_KEY` (custom header via `LOCAL_API_KEY_HEADER`) | `LOCAL_MODEL` env                |

## ProviderRegistry (`providers/registry.ts`)

- `resolve(modelName)` — 패턴 매칭으로 프로바이더 자동 선택
- `register(manifest, factory)` — 런타임 프로바이더 등록
- 인스턴스 캐싱 (lazy singleton)

## Routing & Optimization (실제 구현 파일만)

| 구성요소          | 파일                    | 역할                                               |
| ----------------- | ----------------------- | -------------------------------------------------- |
| TaskClassifier    | `task-classifier.ts`    | plan/execute/review 자동 분류                      |
| ModelRouter       | `model-router.ts`       | 기본 라우팅 + 실패 시 fallback 체인                |
| DualModelRouter   | `dual-model-router.ts`  | architect(계획) ↔ editor(실행) 자동 전환          |
| ModelCapabilities | `model-capabilities.ts` | 모델별 context limit / 기능 tier (HIGH/MEDIUM/LOW) |
| ThinkingBudget    | `thinking-budget.ts`    | Extended thinking 토큰 예산                        |
| ChatTemplate      | `chat-template.ts`      | 로컬 모델 템플릿 자동 감지 (8개 패밀리)            |
| CostTracker       | `cost-tracker.ts`       | 실행별 비용 합산 + `/cost` / `/analytics` 노출     |
| TokenCounter      | `token-counter.ts`      | `js-tiktoken` + LRU 캐시                           |
| ToolCallStrategy  | `tool-call-strategy.ts` | native / text-parsing / two-stage 선택             |
| Streaming         | `streaming.ts`          | SSE 소비 + backpressure                            |
| ClientFactory     | `client-factory.ts`     | Provider-aware client 조립                         |

## Local Provider 사용

```bash
# .env 예시
LOCAL_API_BASE_URL=https://models.example.com/v1
LOCAL_MODEL=GLM45AirFP8
LOCAL_API_KEY=xxxx
LOCAL_API_KEY_HEADER=model-api-key   # (선택) Bearer 대신 custom header
```

- `client.ts`는 URL 말미의 `/chat/completions`를 자동 제거 (중복 방지)
- `LOCAL_MODEL`은 서버가 광고하는 실제 모델 ID와 정확히 일치해야 함 (`GET /v1/models`로 확인)

## 주의사항

- 기본 타임아웃 120초 (`config/defaults.ts`) — 로컬 GPU 서버 느림 대응
- 새 프로바이더 추가 시 `providers/registry.ts`에 manifest + factory 등록 필수
- Responses API(`responses-client.ts`)는 o1/o3/gpt-5-codex 등 Responses-지원 모델에서만 사용
- 모델 capability 변경 시 `verify-model-capabilities` 스킬로 검증
