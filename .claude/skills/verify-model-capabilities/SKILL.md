---
name: verify-model-capabilities
description: ModelCapabilities 인터페이스, 모델 오버라이드, 클라이언트 파라미터 분기의 일관성 검증. LLM 관련 코드 또는 기본 모델 변경 후 사용.
---

## Purpose

1. **ModelCapabilities 필드 사용 일관성** — 인터페이스에 정의된 모든 필드가 client.ts에서 실제 분기에 사용되는지
2. **기본 모델 동기화** — `constants.ts`, `defaults.ts`, `schema.ts`의 기본 모델값이 일치하는지
3. **max_completion_tokens vs max_tokens 분기** — `useMaxCompletionTokens` 플래그에 따른 API 파라미터 분기가 chat과 stream 모두에 적용되는지
4. **temperature 분기** — `supportsTemperature` 플래그에 따라 temperature 파라미터가 올바르게 제외되는지

## When to Run

- `src/llm/model-capabilities.ts`에서 ModelCapabilities 인터페이스나 MODEL_OVERRIDES를 변경했을 때
- `src/llm/client.ts`에서 API 요청 파라미터를 변경했을 때
- `src/constants.ts`, `src/config/defaults.ts`, `src/config/schema.ts`에서 기본 모델을 변경했을 때
- 새 모델 지원을 추가했을 때

## Related Files

| File                               | Purpose                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `src/llm/model-capabilities.ts`    | ModelCapabilities 인터페이스, DEFAULTS, MODEL_OVERRIDES |
| `src/llm/client.ts`                | API 요청 생성 (\_chatOnce, \_streamOnce)                |
| `src/llm/token-counter.ts`         | 토크나이저 인코딩 선택                                  |
| `src/constants.ts`                 | LLM_DEFAULTS.model, TOKEN_DEFAULTS.defaultModel         |
| `src/config/defaults.ts`           | DEFAULT_CONFIG.llm.model                                |
| `src/config/schema.ts`             | Zod 스키마 기본값                                       |
| `src/cli/setup-wizard.ts`          | 설정 마법사 모델 프리셋                                 |
| `src/cli/components/StatusBar.tsx` | 모델별 가격 정보                                        |

## Workflow

### Step 1: ModelCapabilities 인터페이스 필드 확인

```bash
grep -A20 "export interface ModelCapabilities" src/llm/model-capabilities.ts
```

**PASS:** `useMaxCompletionTokens`, `supportsTemperature`, `supportsTools`, `supportsSystemMessage`, `supportsStreaming`, `maxContextTokens`, `maxOutputTokens`, `tokenizer`, `useDeveloperRole` 모두 존재
**FAIL:** 필드 누락 시 분기 로직과 불일치

### Step 2: useMaxCompletionTokens 분기가 chat과 stream 모두에 적용되는지

```bash
grep -c "useMaxCompletionTokens" src/llm/client.ts
```

**PASS:** 2회 이상 (chat + stream 각각)
**FAIL:** 1회만이면 한쪽에서 잘못된 파라미터 사용

```bash
grep -B2 -A4 "max_completion_tokens\|max_tokens" src/llm/client.ts
```

**PASS:** `caps.useMaxCompletionTokens` 조건으로 분기하여 `max_completion_tokens` 또는 `max_tokens` 사용
**FAIL:** 하드코딩된 `max_tokens`가 남아있으면 GPT-5 등에서 API 에러

### Step 3: supportsTemperature 분기 확인

```bash
grep "supportsTemperature" src/llm/client.ts
```

**PASS:** temperature 파라미터 설정 시 `caps.supportsTemperature` 체크 존재
**FAIL:** GPT-5, o-series 등에서 temperature 에러 발생

### Step 4: 기본 모델값 동기화

```bash
grep -n "gpt-" src/constants.ts src/config/defaults.ts src/config/schema.ts | grep -i "default\|model"
```

**PASS:** 모든 파일에서 동일한 기본 모델 (현재 `gpt-5-mini`)
**FAIL:** 불일치 시 설정 우선순위에 따라 예기치 않은 모델 사용

### Step 5: token-counter 인코딩이 기본 모델과 일치하는지

```bash
grep "getEncoding\|encoding" src/llm/token-counter.ts
```

**PASS:** 기본 모델의 토크나이저와 일치하는 인코딩 사용 (GPT-5 → o200k_base)
**FAIL:** 토큰 카운트가 부정확해져 컨텍스트 관리에 오류

### Step 6: MODEL_OVERRIDES에서 새 모델 패턴이 기존 패턴과 충돌하지 않는지

```bash
grep -oP '\[/\^[^/]+/' src/llm/model-capabilities.ts
```

**PASS:** 각 정규식 패턴이 서로 겹치지 않음 (첫 매칭 반환이므로 순서 중요)
**FAIL:** 잘못된 순서로 의도하지 않은 모델이 먼저 매칭

### Step 7: StatusBar 가격 정보에 기본 모델이 포함되는지

```bash
grep "gpt-5-mini" src/cli/components/StatusBar.tsx
```

**PASS:** 기본 모델의 가격 엔트리 존재
**FAIL:** 비용 표시 불가

## Output Format

| Check                       | Status    | Detail                |
| --------------------------- | --------- | --------------------- |
| ModelCapabilities 필드      | PASS/FAIL | 누락 필드             |
| useMaxCompletionTokens 분기 | PASS/FAIL | chat/stream 적용 여부 |
| supportsTemperature 분기    | PASS/FAIL | 조건 체크 존재        |
| 기본 모델 동기화            | PASS/FAIL | 불일치 파일           |
| 토크나이저 인코딩           | PASS/FAIL | 모델-인코딩 매칭      |
| 패턴 충돌                   | PASS/FAIL | 겹치는 패턴           |
| StatusBar 가격              | PASS/FAIL | 엔트리 존재           |

## Exceptions

1. **환경변수 오버라이드** — `.env`의 `OPENAI_MODEL`이 기본값과 다른 것은 정상 (사용자 설정)
2. **Claude 모델 via proxy** — Claude 모델은 OpenAI API 호환 프록시를 통해 사용되므로 `useMaxCompletionTokens: true`가 적용되어도 실제로는 프록시가 처리
3. **Ollama 로컬 모델** — Ollama의 llama3 등은 `supportsTools: false`여서 도구 호출이 불가한 것은 의도된 동작
