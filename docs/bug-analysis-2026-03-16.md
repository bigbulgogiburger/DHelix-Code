# dhelix 버그 분석 보고서 (2026-03-16)

## 로그 기반 증상 요약

| #   | 증상                                                               | 심각도       |
| --- | ------------------------------------------------------------------ | ------------ |
| 1   | 작업 도중 갑자기 멈춤 — "계속해줘"를 반복해야 진행                 | **CRITICAL** |
| 2   | Ctrl+O가 개별 블록 펼치기가 아닌 전역 Verbose 모드 토글            | **MEDIUM**   |
| 3   | Playwright MCP: `spawn npx ENOENT` + snapshot ref 오류 + 인자 누락 | **HIGH**     |
| 4   | `/init` 명령 시 DHELIX.md가 프로젝트 루트에 생성되지 않음          | **HIGH**     |

---

## Issue 1: 작업 도중 갑자기 멈춤 — "계속해줘" 반복 필요

### 로그 분석

```
> git branch feature/test-1234 라는 브랜치를 만들어서 체크아웃해줘.
> 그리고 나서 healthCheckController 의 테스트 코드를 작성하고,
> 실제로 테스트해줘. 실패하면 retry해줘

  ⠋ Searching "class\s+HealthCheckController"     ← 도구 1
   ⎿  No matches found.
  ⠋ Searching "HealthCheck"                        ← 도구 2
   ⎿  No matches found.
  ⠋ Listing src/main/java/com/suri/cs/health       ← 도구 3
   ⎿  └── HealthCheckController.java
(여기서 갑자기 멈춤)
> 계속해줘 왜 중간에 멈춘거야?                      ← 사용자가 재촉

  ⠋ Running git checkout -b feature/test-1234
  ⠋ Listing src/test/java
  ⠋ Reading SuriCsMobileBackApplicationTests.java
(또 멈춤)
> 계속해줘

  ⠋ Reading HealthCheckController.java
  ⠋ Writing HealthCheckControllerTest.java
  ⠋ Running ./gradlew test → exit 1
  ⠋ Searching "FeignAutoConfiguration"
  ⠋ Reading SuriCsMobileBackApplication.java
(또 멈춤)
> 계속해줘

  ⠋ Updating HealthCheckControllerTest.java
  ⠋ Running ./gradlew test → exit 1
  ⠋ Searching 2번
(또 멈춤)
> 계속해줘

  ⠋ Writing HealthCheckControllerTest.java
  ⠋ Running ./gradlew test → exit 0 ✓
  "테스트가 성공적으로 통과되었습니다."
```

**패턴:** 도구 2~3개 실행 → **갑자기 멈춤** → "계속해줘" → 반복 (총 4회 중단)

---

### 근본 원인 #1 (핵심): `maxTokens: 4096` 하드코딩 — 출력 토큰 부족

**이것이 가장 유력한 원인입니다.**

**파일**: `src/core/agent-loop.ts:556`

```typescript
const chatRequest = {
  model: activeModel,
  messages: prepared.messages,
  tools: prepared.tools,
  temperature: config.temperature ?? 0,
  maxTokens: config.maxTokens ?? 4096, // ← ⚠️ 항상 4096!
  signal: config.signal,
};
```

**파일**: `src/cli/hooks/useAgentLoop.ts:513-528` — 호출 측

```typescript
const result = await runAgentLoop(
  {
    client,
    model: activeModel,
    toolRegistry,
    strategy,
    events,
    useStreaming: true,
    maxContextTokens: modelCaps.maxContextTokens, // ← 입력 토큰은 전달
    // maxTokens: 전달 안 함!  ← modelCaps.maxOutputTokens를 써야 함
  },
  messages,
);
```

**결과:**

| 모델               | model-capabilities의 maxOutputTokens | 실제 전달되는 maxTokens | 사용률 |
| ------------------ | ------------------------------------ | ----------------------- | ------ |
| gpt-5.1-codex-mini | **100,000**                          | **4,096**               | 4.1%   |
| gpt-4o             | 16,384                               | 4,096                   | 25%    |
| claude-opus-4      | 16,384                               | 4,096                   | 25%    |

**왜 "계속해줘" 패턴이 발생하는가:**

```
1. 사용자: "branch 만들고 + 테스트 작성하고 + 실행하고 + retry해줘"
2. LLM 계획: Search → Read → Write(테스트 코드) → Bash(gradlew test) → ...
3. iteration 1: LLM이 Search 2개 + List 1개 tool call 생성 → 실행 → 결과 전달
4. iteration 2: LLM이 도구 결과를 받고 다음 tool call을 생성하려 함
   → 응답 생성 중 4096 토큰 도달 → finish_reason: "length"
   → tool call JSON이 중간에 잘림: {"file_path": "/src/main/ja...
   → 또는 tool call이 streaming 중 조립 미완료
5. extractToolCalls() → 불완전한 JSON 파싱:
   - NativeFunctionCallingStrategy line 64: JSON.parse 실패 → args = {}
   - 또는 스트리밍에서 toolCall 자체가 미완성 → toolCalls 배열에 미포함
6. extractedCalls.length === 0 → "도구 호출 없음 = 대화 완료" → 루프 종료
7. 사용자에게는 "도구 3개 실행 후 갑자기 멈춤"으로 보임
```

**증거:**

1. **매번 도구 2~3개 후 멈춤** — 시스템 프롬프트 + 대화 기록 + 도구 결과 입력만으로 이미 수천 토큰. 4096 출력으로는 다음 tool call JSON을 완성하기 부족
2. **특히 file_write가 필요한 작업에서 심함** — 테스트 코드 전체를 arguments에 담아야 하므로 4096 토큰으로 불가능
3. **"계속해줘"로 재개되는 이유** — 새 turn이 시작되면 새 4096 예산이 주어짐. 이전 대화에서 이미 중간 진행 상태를 알고 있으므로 이어서 진행 가능

---

### 근본 원인 #2: `finishReason: "length"` 무시

**파일**: `src/core/agent-loop.ts:593-598`

```typescript
response = {
  content: accumulated.text,
  toolCalls: accumulated.toolCalls,
  usage: accumulated.usage ?? { ... },
  finishReason: accumulated.partial ? "length" : "stop",
  //            ↑ 네트워크 에러가 아닌 경우 무조건 "stop"으로 설정
};
```

**문제:**

- API가 `finish_reason: "length"` (토큰 제한 도달)를 반환해도, 스트리밍이 정상 완료되면 `"stop"`으로 덮어씀
- `finishReason`이 설정된 후 **어디에서도 사용되지 않음** — agent-loop.ts 전체 검색 결과 `finishReason`을 확인하는 코드 없음
- 토큰 제한에 걸려서 응답이 잘렸는지 감지할 방법이 없음

---

### 근본 원인 #3: 불완전 tool call의 무음 처리

**파일**: `src/llm/strategies/native-function-calling.ts:64-75`

```typescript
try {
  args = JSON.parse(tc.arguments); // ← 잘린 JSON이면 파싱 실패
} catch {
  args = {}; // ← 빈 객체로 대체 (필수 인자 누락)
}
```

**파일**: `src/core/agent-loop.ts:327-346`

```typescript
export function filterValidToolCalls(calls, events) {
  for (const call of calls) {
    if (isValidToolCall(call)) {
      valid.push(call);
    } else {
      events.emit("llm:error", { ... });   // ← 경고만, 대체 행동 없음
    }
  }
  return valid;
  // 모든 call이 무효면 빈 배열 → 루프 종료
}
```

---

### 근본 원인 #4: Circuit Breaker 낮은 임계값 (보조)

**파일**: `src/core/circuit-breaker.ts:56`

```typescript
const NO_CHANGE_THRESHOLD = 3; // 파일 변경 없이 3회 반복하면 차단
```

---

### 해결 방안

#### Fix 1-A: maxOutputTokens 전달 (P0 — 핵심 수정)

**파일**: `src/cli/hooks/useAgentLoop.ts:513`

```typescript
const result = await runAgentLoop(
  {
    client,
    model: activeModel,
    toolRegistry,
    strategy,
    events,
    useStreaming: true,
    maxContextTokens: modelCaps.maxContextTokens,
    maxTokens: modelCaps.maxOutputTokens, // ← 추가!
    checkPermission,
    checkpointManager,
    sessionId,
    thinking: thinkingConfig,
    signal: controller.signal,
  },
  messages,
);
```

**효과:** `gpt-5.1-codex-mini`에서 4096 → 100,000 토큰으로 확장.
LLM이 도구 호출 JSON을 완성할 충분한 공간을 확보합니다.

#### Fix 1-B: finishReason "length" 감지 시 자동 재시도

**파일**: `src/core/agent-loop.ts:593` 부근

```typescript
// 스트리밍에서 실제 finish_reason 전달
response = {
  content: accumulated.text,
  toolCalls: accumulated.toolCalls,
  usage: accumulated.usage ?? { ... },
  finishReason: accumulated.finishReason ?? (accumulated.partial ? "length" : "stop"),
};

// line 713 부근: finish_reason이 "length"이면 자동 재시도
if (extractedCalls.length === 0 && response.finishReason === "length") {
  config.events.emit("llm:error", {
    error: new Error("Response truncated due to token limit, retrying with continuation..."),
  });
  // 이전 응답의 텍스트를 보존하고 계속 생성 요청
  const continuationMessage: ChatMessage = {
    role: "user",
    content: "[System] Your response was cut off due to token limit. Please continue from where you left off.",
  };
  messages.push(continuationMessage);
  continue;
}
```

#### Fix 1-C: 무효 tool call 시 LLM에 피드백 주입

**파일**: `src/core/agent-loop.ts:703` 후

```typescript
const extractedCalls = filterValidToolCalls(rawExtractedCalls, config.events);

if (rawExtractedCalls.length > 0 && extractedCalls.length === 0) {
  const droppedNames = rawExtractedCalls.map((tc) => tc.name).join(", ");
  const errorFeedback: ChatMessage = {
    role: "user",
    content:
      `[System] Your tool calls (${droppedNames}) had invalid/incomplete JSON arguments ` +
      `and were dropped. Please retry with valid, complete JSON arguments.`,
  };
  messages.push(errorFeedback);
  continue; // 루프 계속
}
```

#### Fix 1-D: Circuit Breaker 임계값 상향

**파일**: `src/core/circuit-breaker.ts:56`

```typescript
const NO_CHANGE_THRESHOLD = 5; // 3 → 5
```

---

## Issue 2: Ctrl+O가 Verbose Mode 토글로 동작

### 근본 원인

**설계 불일치**: 개별 블록 펼치기 기능이 없고 전역 verbose 토글만 존재.
ToolCallBlock.tsx:267의 `(ctrl+o to expand)` 텍스트가 개별 펼치기를 암시하지만,
실제로는 모든 collapsed 블록을 한꺼번에 펼치는 전역 토글.

### 해결 방안

- Fix 2-A (P2): 힌트 텍스트를 `(ctrl+o to show all)`로 수정
- Fix 2-B (P3): 개별 블록 펼치기 구현 (큰 리팩터링 필요)

---

## Issue 3: Playwright MCP 동작 불량

### 3-1: `spawn npx ENOENT` (Windows)

`shell: true` 설정에도 불구하고 간헐적으로 PATH에서 `npx` 미발견.
세션마다 다른 결과 → 환경 의존적 간헐 문제.

### 3-2: Snapshot Ref 오류

LLM hallucination — dhelix 버그 아님.

### 3-3: 필수 인자 누락

MCP deferred loading으로 LLM이 full schema를 못 받을 가능성.

---

## Issue 4: `/init` 명령 시 DHELIX.md 미생성

### 근본 원인

**Issue 1과 동일한 원인.** `/init`은 LLM에 분석 프롬프트를 주입하여
코드베이스를 탐색한 후 `file_write`로 DHELIX.md를 생성하게 합니다.

로그에서 LLM이 Read/List 도구만 반복 실행하고 `file_write`를 호출하지 못한 것은,
**4096 토큰 제한** 때문에 긴 DHELIX.md 내용을 담은 `file_write` tool call을
완성하지 못했기 때문입니다.

Fix 1-A (maxOutputTokens 전달)로 해결됩니다.

---

## 우선순위별 수정 로드맵

| 순위 | Fix                                    | 파일                 | 효과                        | 난이도 |
| ---- | -------------------------------------- | -------------------- | --------------------------- | ------ |
| P0   | 1-A: maxOutputTokens 전달              | `useAgentLoop.ts`    | **핵심 — 멈춤 현상 해소**   | 낮음   |
| P0   | 1-B: finishReason "length" 감지/재시도 | `agent-loop.ts`      | 토큰 제한 시 자동 계속      | 중간   |
| P0   | 1-C: 무효 tool call 피드백 주입        | `agent-loop.ts`      | JSON 파싱 실패 시 자동 복구 | 낮음   |
| P1   | 1-D: Circuit Breaker 임계값            | `circuit-breaker.ts` | 장시간 안정성               | 낮음   |
| P1   | 3-1: Windows npx ENOENT                | `stdio.ts`           | MCP 연결 안정성             | 낮음   |
| P2   | 3-3: Deferred tool schema              | `tool-search.ts`     | MCP 도구 정확도             | 중간   |
| P2   | 2-A: Ctrl+O 힌트 텍스트 수정           | `ToolCallBlock.tsx`  | UX 혼란 방지                | 낮음   |
| P3   | 2-B: 개별 블록 펼치기                  | 다수 파일            | UX 개선                     | 높음   |

---

## 핵심 요약

**"계속해줘" 멈춤 현상의 진짜 원인:**

```
agent-loop.ts:556  →  maxTokens: config.maxTokens ?? 4096
useAgentLoop.ts:513  →  maxTokens 미전달

결과: 모든 모델에서 출력 토큰이 4096으로 제한됨
→ 도구 호출 JSON이 잘림 → 루프 조기 종료 → "계속해줘" 필요
```

**1줄 수정으로 핵심 문제 해결:**

```typescript
// useAgentLoop.ts:513 — runAgentLoop 호출 시
maxTokens: modelCaps.maxOutputTokens,    // ← 이 한 줄 추가
```
