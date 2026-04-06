# Issue 3: 에이전트 루프 조기 종료 — 심층 분석 (수정판)

> 작성일: 2026-03-19 (v2 — 초기 분석 오류 수정)
> 심각도: **P0 (프로덕션 블로커)**
> 증상: `/init` 등 복잡한 작업 시 3~4번 도구 호출 후 대화 조기 종료
> 영향: `gpt-5.1-codex-mini` 및 모든 Responses API 전용 모델

---

## 증상

```
사용자: /init 실행
dhelix: 파일 몇 개 읽고 (3~4번) → 갑자기 종료
상태바: "ready" (완료된 것처럼 보임)
사용자: 작업이 끝난 건지 기다려야 하는 건지 알 수 없음
```

- explore 서브에이전트: "I'm sorry, but I cannot assist with that request." (5분 11초)
- 도구 호출이 간헐적으로 3~4번 성공 후 중단
- `agent:complete`에 종료 이유 없음 → UI에서 구분 불가능

---

## 분석 수정 이력

> **초기 분석 오류**: `supportsTools`가 미설정이라 TextParsingStrategy가 선택된다고 판단함.
> **수정**: DEFAULTS에 `supportsTools: true`가 있고 spread merge로 상속됨 → **NativeFunctionCallingStrategy가 올바르게 선택됨**.
> 따라서 "전략 불일치로 tool call이 드롭된다"는 초기 가설은 **틀렸음**.

---

## 진짜 원인 후보 (확률순)

### 후보 1: 모델 자체가 도구 호출을 중단 (가장 유력)

`gpt-5.1-codex-mini`가 3~4번 도구 호출 후 텍스트만 반환 → agent-loop.ts:764에서 정상 종료.

**근거:**

- Codex 모델은 **코딩 특화** — 탐색/분석 프롬프트에 약할 수 있음
- explore 서브에이전트가 "I cannot assist" 반환 — 모델이 프롬프트를 거부
- `/init`의 12단계 분석 프롬프트가 모델에게 너무 복잡할 수 있음

**확인 방법**: 에이전트 루프에 트레이스 로그 추가하여 실제 response.toolCalls 확인

### 후보 2: 스트리밍 tool-call-delta 누락 (코드 버그 가능성)

ResponsesAPIClient.stream()에서 SSE 이벤트 순서 문제:

```typescript
// responses-client.ts:798-808
// response.output_item.added → functionCalls Map에 등록 (name 포함)

// responses-client.ts:813-835
// response.function_call_arguments.delta → Map에서 조회하여 name 사용
// BUT: added 이벤트가 누락되면 name = "" → 폴백 경로

// streaming.ts:187
if (id && name) {  // name이 "" (falsy)이면 도구 호출 드롭!
  return { ...state, toolCalls: [...state.toolCalls, ...] };
}
return state;  // ← 도구 호출이 조용히 사라짐
```

**시나리오**: `response.output_item.added` SSE 이벤트가 파싱 실패하면:

1. `functionCalls` Map에 등록되지 않음
2. arguments delta에서 `existing = undefined`
3. 폴백: `name: (parsed.name ?? "") as string` → `""` (delta 이벤트에는 name이 없으므로)
4. streaming.ts에서 `if (id && name)` → `name = ""` → falsy → **도구 호출 드롭**
5. `extractedCalls = []` → 루프 종료

**확인 방법**: ResponsesAPIClient.stream()에 SSE 이벤트 로그 추가

### 후보 3: finishReason 매핑 문제

```typescript
// responses-client.ts:290
finishReason: result.status === "completed" ? "stop" : (result.status ?? "stop"),
```

Azure Responses API가 `status: "incomplete"` 또는 예상치 못한 값을 반환하면,
`finishReason`이 비표준 값이 되어 truncation 감지(agent-loop.ts:766)가 작동하지 않음.

### 후보 4: Non-streaming ResponsesAPIClient.chat()의 arguments 타입 불일치

```typescript
// responses-client.ts:275
arguments: item.arguments ?? "",  // API가 object를 반환하면 "[object Object]"
```

Azure API가 `arguments`를 문자열이 아닌 객체로 반환하면:

- `item.arguments` → 객체 → NativeFunctionCallingStrategy에서 `JSON.parse(object)` 실패
- catch에서 `args = {}` → 빈 인자로 도구 실행 → 에러 → 루프 종료

---

## 확실한 문제 (코드 결함)

### 3-A: 상태바 "ready" 문제

```typescript
// StatusBar.tsx:135
{
  isStreaming ? "streaming..." : "ready";
}

// App.tsx:491
isStreaming = { isProcessing };
```

`isProcessing=false`가 되면 무조건 "ready". `agentPhase` 연결 필요.

### 3-B: 종료 이유 미포함

```typescript
// 정상 완료 (agent-loop.ts:782-788)
config.events.emit("agent:complete", { iterations, aborted: false });
// maxIterations 도달 (agent-loop.ts:1088-1093) → 동일 형태!
// → UI에서 구분 불가능
```

### 3-C: 트레이스 로깅 부재

어떤 지점에도 디버그 로그가 없어서 런타임 문제 진단 불가능.

---

## 수정 계획 (로깅 우선)

### Phase 1: 광범위한 트레이스 로깅 추가 (최우선)

로그가 없으면 후보 1~4 중 어느 것이 진짜 원인인지 확인 불가능.

**로깅 위치:**

| 위치              | 파일                      | 내용                                                                            |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------- | ----- | ------- | -------------------------- |
| 전략 선택         | tool-call-strategy.ts:104 | `[strategy] Selected: {name} for model: {model}`                                |
| LLM 호출 전       | agent-loop.ts:563         | `[agent-loop] Iteration {n}: LLM call starting`                                 |
| LLM 응답 후       | agent-loop.ts:690         | `[agent-loop] Iteration {n}: response.toolCalls.length={n}, content.length={n}` |
| 도구 추출 후      | agent-loop.ts:717         | `[agent-loop] Iteration {n}: extractedCalls={n}, rawCalls={n}`                  |
| 루프 종료 시      | agent-loop.ts:788         | `[agent-loop] Loop ended: reason={no-tools                                      | abort | circuit | max-iter}, iterations={n}` |
| SSE 이벤트        | responses-client.ts:786   | `[responses-sse] Event: {type}, parsed keys: {keys}`                            |
| 스트리밍 도구     | streaming.ts:187          | `[streaming] tool-call-delta: id={id}, name={name}, dropped={!id \|\| !name}`   |
| 서브에이전트      | spawner.ts:717            | `[subagent] Spawning {type}: client={class}, model={model}`                     |
| 서브에이전트 종료 | spawner.ts:848            | `[subagent] {type} ended: iterations={n}, response.length={n}`                  |

**로그 조건**: `DHELIX_VERBOSE=1` 또는 `--verbose` 플래그 시에만 출력 (stderr)

### Phase 2: 진짜 원인 확인 후 코드 수정

로그로 확인한 결과에 따라:

- 후보 1 (모델 행동) → 프롬프트 개선 또는 모델 전환 권장
- 후보 2 (스트리밍 드롭) → streaming.ts name 검증 완화
- 후보 3 (finishReason) → Responses API status 매핑 개선
- 후보 4 (arguments 타입) → typeof 체크 + stringify 폴백

### Phase 3: 방어적 개선 (모델 변경에도 안전)

1. **TextParsingStrategy에 네이티브 toolCalls 폴백** — 어떤 전략이든 도구 호출을 놓치지 않음
2. **selectStrategy()에 isResponsesOnlyModel 가드** — Responses API 모델은 항상 네이티브
3. **agent:complete에 reason 필드** — 종료 이유 추적
4. **StatusBar에 agentPhase 연결** — 실시간 상태 표시

---

## 모델 독립적 안전장치 (모든 모델에 적용)

```
┌─────────────────────────────────────────────────────┐
│ 1단계: selectStrategy()                              │
│   └→ isResponsesOnlyModel? → NativeStrategy (강제)  │
│   └→ supportsTools? → NativeStrategy                 │
│   └→ fallback → TextParsingStrategy                  │
│                                                      │
│ 2단계: extractToolCalls() (모든 전략)                │
│   └→ primary: 전략 고유 방식으로 추출                │
│   └→ fallback: primary 결과 0이면 다른 방식 시도    │
│   └→ 로그: 추출 결과 0이지만 response.toolCalls > 0 │
│          이면 WARNING 로그                           │
│                                                      │
│ 3단계: agent-loop 종료                               │
│   └→ extractedCalls === 0 && response.toolCalls > 0  │
│      → "도구 호출이 감지되었으나 추출 실패" 경고     │
│      → continue (드롭 방지)                          │
│                                                      │
│ 4단계: 트레이스 로깅 (VERBOSE 모드)                  │
│   └→ 매 이터레이션: 입력/출력/추출 결과 기록        │
│   └→ 종료 시: 사유 기록                              │
└─────────────────────────────────────────────────────┘
```

---

## 우선순위 종합 (Issue 1~3, 수정판)

| #      | 수정                                     | 심각도 | 난이도 | 상태               |
| ------ | ---------------------------------------- | ------ | ------ | ------------------ |
| **3E** | **에이전트 루프 트레이스 로깅**          | **P0** | M      | 미적용 (진단 필수) |
| **3G** | **agent-loop: toolCalls 드롭 방지 가드** | **P0** | S      | 미적용             |
| 3B     | selectStrategy에 Responses API 가드      | P0     | S      | 미적용             |
| 1      | ToolContext에 activeClient 전파          | P0     | M      | ✅ 적용됨          |
| 2      | agentPhase 상태 머신 + 이벤트            | P0     | M      | ✅ 적용됨          |
| 3C     | StatusBar에 agentPhase 연결              | P1     | S      | 미적용             |
| 3D     | agent:complete에 reason 추가             | P1     | S      | 미적용             |
| 3F     | SubagentError 원인 포함                  | P1     | S      | ✅ 적용됨          |
