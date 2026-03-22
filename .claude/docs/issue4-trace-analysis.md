# Issue 4: Trace Log 분석 결과 — 서브에이전트 Circuit Breaker + 타임아웃 + Responses API 400

> 작성일: 2026-03-19
> 심각도: **P0 (프로덕션 블로커)**
> 근거: `DBCODE_VERBOSE=1` 트레이스 로그 실측 데이터

---

## 트레이스 로그 요약

```
[agent-loop] Iter 3: Executing 1 tool calls: [agent]
[subagent] Spawning explore: model=gpt-5.1-codex-mini, client=ResponsesAPIClient, agentId=a0bac9c4

[agent-loop] Loop complete: reason=circuit-breaker, iterations=5,
  cbReason=5 consecutive iterations with no file changes or output

[subagent] explore completed: iterations=5, response.length=0, aborted=false
                                             ^^^^^^^^^^^^^^^^^^
                                             빈 응답 반환!

[agent-loop] Iter 4: Executing 1 tool calls: [agent]
[subagent] Spawning explore: model=gpt-5.1-codex-mini, agentId=b7b11dd1
[subagent] explore FAILED: error=Request timed out or was aborted.

❌ Responses API error (400): No tool output found for function call call_7Np7...
```

---

## Issue 4-A: activeClient 수정 적용 확인

**결론: 수정이 정상 적용됨**

```
[subagent] Spawning explore: model=gpt-5.1-codex-mini, client=ResponsesAPIClient
```

서브에이전트가 `ResponsesAPIClient`를 사용하고 있음 (이전에는 죽은 로컬 서버의 `OpenAICompatibleClient`를 사용).
Issue 1의 activeClient 전파 수정이 **정상 동작** 확인됨.

---

## Issue 4-B: Circuit Breaker가 explore 서브에이전트를 잘못 종료 (핵심 버그)

### 근본 원인

```typescript
// circuit-breaker.ts:107
if (result.filesModified.size === 0 && !result.hasOutput) {
  this.consecutiveNoChangeCount++; // "진전 없음" 카운트 증가
}

// agent-loop.ts:1173
hasOutput: response.content.length > 0; // ← LLM 텍스트 출력이 있는지만 확인
```

**문제**: `hasOutput`은 `response.content.length > 0`으로 판단.
Codex 모델이 도구 호출 시 `content = ""`(빈 텍스트)로 응답하면 `hasOutput = false`.

**explore 서브에이전트의 전형적 패턴:**

```
Iter 1: content="" + toolCalls=[file_read] → hasOutput=false, filesModified=0 → noChange++
Iter 2: content="" + toolCalls=[grep_search] → hasOutput=false, filesModified=0 → noChange++
Iter 3: content="" + toolCalls=[list_dir] → hasOutput=false, filesModified=0 → noChange++
Iter 4: content="" + toolCalls=[file_read] → hasOutput=false, filesModified=0 → noChange++
Iter 5: content="" + toolCalls=[file_read] → hasOutput=false, filesModified=0 → noChange=5!
→ Circuit breaker OPEN → 루프 종료 → response.length=0 (빈 응답)
```

**모델은 도구를 잘 호출하고 있지만**, circuit breaker가 "파일 수정도 없고 텍스트 출력도 없음 = 진전 없음"으로 잘못 판단.

explore 타입은 **읽기 전용** — 파일을 수정하지 않고 텍스트 출력 없이 도구만 호출하는 것이 정상.

### 해결방안

**방안 A: `hasOutput`에 도구 호출도 "진전"으로 인정 (권장)**

```typescript
// agent-loop.ts:1171-1175
circuitBreaker.recordIteration({
  filesModified,
  hasOutput: response.content.length > 0 || extractedCalls.length > 0,
  //                                       ^^^^^^^^^^^^^^^^^^^^^^^^^ 추가
  error: results.some((r) => r.isError) ? results.find((r) => r.isError)?.output : undefined,
});
```

도구를 호출하는 것 자체가 "작업 진행 중"이므로 진전으로 인정.

**장점**: 1줄 수정, 근본 해결
**위험**: 도구 호출만 반복하고 실제 진전이 없는 무한루프 가능성 → 이미 duplicate tool call guard(MAX_DUPLICATE_TOOL_CALLS=3)로 방어됨

**방안 B: 서브에이전트용 circuit breaker 임계값 완화**

```typescript
// spawner.ts: executeSubagent 내부
const result = await runAgentLoop({
  // ...
  maxIterations: maxIterations, // 기존: 20
  circuitBreakerThreshold: 10, // 서브에이전트는 더 관대하게
});
```

**단점**: AgentLoopConfig에 새 필드 추가 필요

**방안 C: explore 타입에서 circuit breaker 비활성화**

explore는 읽기 전용이므로 무한루프 위험이 낮음. circuit breaker를 비활성화하거나 임계값을 높임.

---

## Issue 4-C: 서브에이전트 LLM 타임아웃 (30초)

### 근본 원인

```typescript
// responses-client.ts:482
this.timeout = config.timeout ?? 120_000; // 기본 120초

// responses-client.ts:586
const timeoutId = setTimeout(() => controller.abort(), this.timeout);
```

`ResponsesAPIClient`의 개별 API 호출 타임아웃이 120초. 하지만 트레이스에서는 ~30초에 타임아웃됨.

**가능한 원인:**

1. Azure 서버 측 타임아웃 (Azure에서 30초 제한)
2. 서브에이전트의 `signal`이 부모 AbortController에서 전파됨
3. 네트워크 레벨 타임아웃

**참고**: 서브에이전트 전체 타임아웃(SUBAGENT_TIMEOUT_MS)은 300초(5분)이지만, 개별 LLM 호출 타임아웃은 클라이언트의 120초.

### 해결방안

트레이스 로그에 **타임아웃 값**을 추가하여 정확한 원인 파악:

```typescript
// responses-client.ts: chat() 메서드
trace("responses-api", `chat() starting: timeout=${this.timeout}ms, model=${request.model}`);
```

---

## Issue 4-D: Responses API 400 에러 — "No tool output found"

### 근본 원인 분석

에러: `No tool output found for function call call_7Np7jOiIfQjLldNLIbdHruL1`

이 에러는 Responses API가 대화 히스토리에서 `function_call` 아이템에 대응하는 `function_call_output`을 찾지 못했을 때 발생.

**의심 포인트: ID 체인의 일관성**

```
Responses API 응답:
  output_item.added → id: "fc_xxx", call_id: "call_xxx"

우리가 저장:
  toolCalls[0].id = call_id ?? id = "call_xxx"

도구 결과 포맷:
  { role: "tool", toolCallId: "call_xxx" }

다음 요청에서 재구성:
  function_call:        { call_id: "call_xxx" }  ← tc.id
  function_call_output: { call_id: "call_xxx" }  ← msg.toolCallId
```

ID 체인은 일관됨. 하지만 Responses API가 `function_call` 아이템의 `id` 필드도 요구할 수 있음.

**의심 포인트 2: 스트리밍에서 id 매핑**

```typescript
// responses-client.ts:811
const callId = (item.call_id ?? item.id ?? "") as string;
// 여기서 callId = "call_xxx" (call_id 우선)

// streaming.ts에서 축적될 때:
// id: existing?.id = "call_xxx"
```

이 부분은 일관됨. 하지만 **스트리밍 도중 연결이 끊기면** partial tool call이 남을 수 있음.

**의심 포인트 3: 에러 후 메시지 불일치**

서브에이전트가 실패하면:

1. `agent` 도구가 에러 결과 반환: `{ id: "call_xxx", output: "Agent failed...", isError: true }`
2. `formatToolResults`: `{ role: "tool", toolCallId: "call_xxx", content: "Error: Agent failed..." }`
3. 다음 LLM 호출에서 `toResponsesInput`이 이를 `function_call_output`으로 변환

이 흐름은 올바름. **하지만** 에러가 발생한 후 메인 에이전트 루프가 continue/retry하면서 메시지 순서가 꼬일 가능성이 있음.

### 해결방안

**방안 A: toResponsesInput에 검증 로그 추가**

```typescript
function toResponsesInput(messages: readonly ChatMessage[]): unknown[] {
  const functionCallIds = new Set<string>();
  const functionOutputIds = new Set<string>();

  // 첫 번째 패스: ID 수집
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.toolCalls) {
      for (const tc of msg.toolCalls) functionCallIds.add(tc.id);
    }
    if (msg.role === "tool" && msg.toolCallId) {
      functionOutputIds.add(msg.toolCallId);
    }
  }

  // 불일치 검증
  for (const callId of functionCallIds) {
    if (!functionOutputIds.has(callId)) {
      trace("responses-api", `⚠️ function_call ${callId} has no matching output!`);
    }
  }
  // ... 기존 로직
}
```

**방안 B: 누락된 function_call_output 자동 생성**

검증에서 불일치가 발견되면, 빈 `function_call_output`을 자동 생성:

```typescript
for (const callId of functionCallIds) {
  if (!functionOutputIds.has(callId)) {
    input.push({
      type: "function_call_output",
      call_id: callId,
      output: "[No output — tool execution may have been interrupted]",
    });
  }
}
```

---

## 우선순위 정리

| #         | 수정                                      | 심각도 | 난이도   | 근거                                    |
| --------- | ----------------------------------------- | ------ | -------- | --------------------------------------- |
| **4-B**   | **hasOutput에 도구 호출 포함**            | **P0** | XS (1줄) | circuit breaker가 정상 작업을 죽이는 중 |
| **4-D-B** | **누락된 function_call_output 자동 생성** | **P0** | S        | Responses API 400 에러 방지             |
| 4-D-A     | toResponsesInput 검증 로그                | P1     | S        | 진단용                                  |
| 4-C       | 타임아웃 트레이스 추가                    | P2     | XS       | 진단용 (Azure 측 원인 가능)             |

---

## 검증 체크리스트

수정 후:

- [ ] `DBCODE_VERBOSE=1`로 실행
- [ ] `/init` → explore 서브에이전트가 5회 이상 반복하는지 확인
- [ ] circuit breaker가 도구 호출 중에는 발동하지 않는지 확인
- [ ] 서브에이전트 실패 후 메인 루프가 400 에러 없이 계속하는지 확인
- [ ] 상태바에 "tools running..." 표시되는지 확인
