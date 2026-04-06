# LLM Providers & Optimization

> 참조 시점: 새 프로바이더 추가, 모델 라우팅 변경, 벤치마크 실행 시

## 프로바이더 목록 (8개)

| Provider | File | Auth Env | Model Patterns |
|----------|------|----------|---------------|
| Anthropic | `providers/anthropic.ts` | `ANTHROPIC_API_KEY` | `claude-*` |
| OpenAI Compatible | `client.ts` | `OPENAI_API_KEY` | `gpt-*`, `o1-*`, `o3-*` |
| Responses API | `responses-client.ts` | `OPENAI_API_KEY` | `gpt-5-codex` |
| Google Gemini | `providers/google-gemini.ts` | `DHELIX_GOOGLE_API_KEY` | `gemini-*` |
| Azure OpenAI | `providers/azure-openai.ts` | `DHELIX_AZURE_API_KEY` | `azure-*` |
| AWS Bedrock | `providers/aws-bedrock.ts` | `AWS_ACCESS_KEY_ID` | `bedrock-*`, `nova-*` |
| Mistral | `providers/mistral.ts` | `MISTRAL_API_KEY` | `mistral-*`, `codestral*` |
| Groq | `providers/groq.ts` | `GROQ_API_KEY` | `llama-*`, `mixtral-*` |
| Local (Ollama/LMStudio) | `providers/local.ts` | none | `ollama:*`, `local:*` |

## ProviderRegistry (`providers/registry.ts`)

- `resolve(modelName)` — 패턴 매칭으로 프로바이더 자동 선택
- `register(manifest, factory)` — 런타임 프로바이더 등록
- 인스턴스 캐싱 (lazy singleton)

## Routing & Optimization

- **TaskClassifier** (`task-classifier.ts`) — plan/execute/review 자동 분류
- **DualModelRouter** (`dual-model-router.ts`) — architect/editor 모델 라우팅
- **WeightedModelSelector** (`weighted-selector.ts`) — cost/quality/latency 가중치
- **ABTestManager** (`ab-testing.ts`) — Welch's t-test 기반 모델 비교
- **ConnectionPool** (`connection-pool.ts`) — endpoint별 연결 재사용
- **ChatTemplate** (`chat-template.ts`) — 로컬 모델 8개 템플릿 자동 감지
- **BenchmarkSuite** (`benchmark.ts`) — tool call/code edit/latency 벤치마크
