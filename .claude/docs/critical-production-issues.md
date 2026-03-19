# Critical Production Issues — 진단 및 해결방안

> 작성일: 2026-03-19
> 심각도: **P0 (프로덕션 블로커)**
> 증상: 대화 중단, 서브에이전트 반복 실패

---

## Issue 1: Subagent (explore) 반복 실패

### 증상

```
✗ Agent
  ⎿  explore
     Agent (explore) failed: Subagent (explore) failed

✗ Agent (30.5s)
  ⎿  explore
     Agent (explore) failed: Subagent (explore) failed
```

- `/model` → ☁️ OpenAI로 전환 후에도 서브에이전트 실패
- 메인 대화는 정상 작동하지만, 서브에이전트만 실패
- 30~120초 대기 후 에러 (LLM 서버 타임아웃)
- 에러 메시지에 실제 원인이 표시되지 않음

### 근본 원인

**핵심: `createAgentTool`의 클로저가 초기 클라이언트를 캡처 — `/model` 전환이 서브에이전트에 전파되지 않음**

```
앱 시작 (src/index.ts:289-337):
  client = new OpenAICompatibleClient({ baseURL: LOCAL_API_BASE_URL })  ← 죽은 서버
  createAgentTool({ client })  ← 클로저에 초기 client 캡처 (line 331-336)

사용자가 /model → ☁️ OpenAI 전환:
  useAgentLoop: clientRef.current = new ResponsesAPIClient({ baseURL: OPENAI_BASE_URL })
  → 메인 대화는 새 클라이언트 사용 ✅
  → 하지만 createAgentTool의 deps.client는 여전히 옛날 LOCAL 클라이언트 ❌

서브에이전트 spawn (agent.ts:121-135):
  spawnSubagent({ client: deps.client })  ← 옛날 LOCAL 클라이언트!
  → LOCAL 서버 접근 불가 → timeout → 실패
```

**파일 경로와 핵심 라인**:

| 파일                             | 라인    | 역할                                                        |
| -------------------------------- | ------- | ----------------------------------------------------------- |
| `src/index.ts`                   | 331-336 | `createAgentTool({ client })` — 초기 client를 클로저에 캡처 |
| `src/tools/definitions/agent.ts` | 124     | `client: deps.client` — 캡처된 초기 client 전달             |
| `src/subagents/spawner.ts`       | 344-346 | `override` 없으면 부모 client 그대로 사용                   |
| `src/cli/hooks/useAgentLoop.ts`  | 698     | `/model` 전환 시 `clientRef.current`만 교체                 |

**결론**: `/model`로 프로바이더를 전환하면 `useAgentLoop.clientRef.current`는 업데이트되지만,
`createAgentTool`에 캡처된 `deps.client`는 **앱 시작 시의 초기 클라이언트 그대로** 유지됩니다.
서브에이전트는 이 오래된 클라이언트로 LLM 호출 → 죽은 서버 → 실패.

### 해결방안

#### 방안 A: ToolContext에 activeClient 전파 (권장, 근본 수정)

`agent.ts`에서 `context`를 통해 현재 활성 클라이언트를 받도록 수정:

```typescript
// 1. ToolContext 인터페이스 확장 (src/tools/types.ts)
export interface ToolContext {
  // ...기존 필드
  readonly activeClient?: LLMProvider;
  readonly activeModel?: string;
}

// 2. runAgentLoop에서 도구 실행 시 context에 현재 클라이언트 전달 (agent-loop.ts)
const context: ToolContext = {
  workingDirectory,
  abortSignal: signal,
  activeClient: config.client, // ← 현재 활성 클라이언트
  activeModel: config.model, // ← 현재 활성 모델
};

// 3. agent.ts에서 context 우선 사용
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const result = await spawnSubagent({
    client: context.activeClient ?? deps.client, // context 우선
    model: context.activeModel ?? deps.model, // context 우선
    // ...
  });
}
```

이 방식이면 `/model` 전환 → `clientRef.current` 업데이트 → `runAgentLoop({ client: clientRef.current })` → 도구 실행 시 `context.activeClient`로 전달 → 서브에이전트가 최신 클라이언트 사용.

**장점**: 기존 구조를 최소한으로 변경하면서 근본 해결
**영향 범위**: `types.ts`, `agent-loop.ts`, `agent.ts` 3개 파일

#### 방안 B: 앱 시작 시 LOCAL 헬스체크 + 자동 폴백 (빠른 수정)

```typescript
// src/index.ts: 클라이언트 생성 후 헬스체크
const client = createClient(config);
try {
  await client.chat({ model: config.llm.model, messages: [{ role: "user", content: "ping" }] });
} catch {
  console.warn("⚠️ Primary LLM server unreachable, falling back to OPENAI...");
  client = createFallbackClient(); // OPENAI_BASE_URL + OPENAI_API_KEY
}
```

**장점**: 즉시 적용 가능
**단점**: 앱 시작 시간 증가, 서버가 나중에 죽으면 대응 불가

#### 방안 C: 에러 메시지 개선 (최소 수정)

```typescript
// spawner.ts: SubagentError에 원인 포함
throw new SubagentError(`Subagent (${type}) failed: ${error.message}`, { ... });
```

현재 에러 메시지가 `"Subagent (explore) failed"`로만 나오는데,
실제 원인 (`ECONNREFUSED`, `timeout` 등)을 포함시켜야 디버깅 가능.

---

## Issue 2: 스트리밍 중 대화 끊김/멈춤

### 증상

1. LLM이 응답을 스트리밍하다가 **중간에 멈춤**
2. **streaming → ready 상태**로 UI가 바뀌는데, 실제로는 도구 호출이 아직 진행 중
3. 사용자가 메시지를 보내도 **반응이 없다가 갑자기 여러 도구 호출이 한꺼번에 진행**됨
4. 특히 **도구 실행이 오래 걸리는 경우** (네트워크 요청, 큰 파일 읽기 등)에 자주 발생

### 근본 원인 분석

#### 원인 1: `isStreamingFinal` 상태 — React 배칭으로 인한 UI 불일치

> 참고: "경쟁 조건"이 아님. Node.js 단일 스레드에서 event emitter는 순차 처리됨.
> 실제 문제는 React 18의 자동 배칭(automatic batching)으로 `setState` 반영이 지연되는 것.

**파일**: `src/cli/hooks/useAgentLoop.ts` (line 292-333)

```typescript
// agent-loop.ts에서 emit:
config.events.emit("agent:assistant-message", {
  isFinal: extractedCalls.length === 0,  // 도구 호출 없으면 true
});

// useAgentLoop.ts에서 수신:
const onAssistantMessage = ({ isFinal, ... }) => {
  setIsStreamingFinal(isFinal);  // ← 중간 응답에서 false → UI가 "대기 중"으로 오인
};
```

**시나리오**:

1. LLM이 "파일을 읽어보겠습니다" + `file_read` 도구 호출 → `isFinal=false`
2. `setIsStreamingFinal(false)` → UI: 스트리밍 중이 아님
3. 도구 실행 중 → `isProcessing=true`이지만 `isStreamingFinal=false`
4. **UI가 "도구 실행 중" 상태인지 "대기 중" 상태인지 구분하지 못함**

#### 원인 2: 도구 완료 → LLM 재호출 사이 상태 공백

**파일**: `src/core/agent-loop.ts` (line 967-1017)

```
[도구 완료] → events.emit("tool:complete")
   ↓ (상태 이벤트 없음!)
[메시지 배열에 도구 결과 추가]
   ↓ (상태 이벤트 없음!)
[while 루프 다음 반복 시작]
   ↓
[LLM 호출] → 서버 응답 대기 중...
```

도구 완료 후 LLM 재호출까지의 구간에서:

- `streamingText = ""`, `isStreamingFinal = false`, `isProcessing = true`
- **하지만 UI에 표시할 진행 상태 이벤트가 없음** → 사용자에게 "멈춤"으로 보임

#### 원인 3: React 배칭(Batching)으로 인한 상태 업데이트 지연

React 18에서 `setState` 호출은 자동으로 배칭됩니다.

```typescript
// 빠른 연속 이벤트:
onToolComplete → syncCurrentTurn()   // state update 1
onAssistantMessage → setIsStreamingFinal() // state update 2
onTextDelta → appendText()           // state update 3
// React가 이를 배칭하면, 중간 상태가 UI에 반영되지 않음
```

#### 원인 4: `llm:start` 이벤트가 UI 상태에 미반영

> 참고: `llm:start` 이벤트는 이미 존재함 (`agent-loop.ts:563`).
> `useAgentLoop.ts:355-357`에서 구독하지만, **retry 카운트다운 해제에만 사용**.
> `isStreamingFinal`이나 AgentStatus 상태 갱신에는 사용되지 않음.

LLM 서버가 느릴 때:

1. `client.chat()` 호출 → 서버 응답 대기 (수 초)
2. `llm:start` 이벤트는 emit되지만, UI 상태 변경 로직이 없음
3. 사용자에게는 "멈춤"으로 보임

**수정**: `onLlmStart`에서 `setRetryInfo(null)` 외에 UI 상태도 갱신해야 함.

### 증상별 매핑

| 증상                   | 원인                  | 발생 조건                   |
| ---------------------- | --------------------- | --------------------------- |
| 응답 중간에 멈춤       | 원인 2 (상태 공백)    | 도구 완료 → LLM 재호출 사이 |
| ready인데 도구 실행 중 | 원인 1 (isFinal 경쟁) | 다수 도구 호출이 이어질 때  |
| 갑자기 여러 결과 표시  | 원인 3 (React 배칭)   | 빠른 연속 도구 완료 시      |
| 긴 무응답 후 진행      | 원인 4 (LLM 대기)     | 서버 응답 지연 시           |

### 해결방안

#### 수정 1: `llm:call-start` 이벤트 추가 (Critical)

```typescript
// agent-loop.ts: while 루프에서 LLM 호출 직전
config.events.emit("llm:call-start", { iteration: iterations });
// ... LLM 호출
```

```typescript
// useAgentLoop.ts:
events.on("llm:call-start", () => {
  setIsStreamingFinal(false);
  // AgentStatus에 "Thinking..." 표시
});
```

#### 수정 2: 도구 실행 중 상태 명시 (High)

```typescript
// agent-loop.ts: 도구 그룹 실행 전/후
config.events.emit("agent:tools-executing", {
  toolNames: groups.flat().map((tc) => tc.name),
  count: groups.flat().length,
});

// 도구 그룹 완료 후, LLM 재호출 전
config.events.emit("agent:tools-done", {
  count: results.length,
  nextAction: "llm-call",
});
```

#### 수정 3: `agentPhase` 상태 통합 (근본 해결)

```typescript
type AgentPhase = "idle" | "llm-thinking" | "llm-streaming" | "tools-running" | "tools-done";

const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle");

// 이벤트 매핑:
// llm:call-start              → "llm-thinking"
// llm:text-delta              → "llm-streaming"
// agent:assistant-message (isFinal=false) → "tools-running"
// agent:assistant-message (isFinal=true)  → "idle"
// tool:start                  → "tools-running"
// agent:tools-done            → "llm-thinking"
```

---

## 우선순위 정리

| #   | 수정                                  | 영향              | 난이도 | 우선순위 |
| --- | ------------------------------------- | ----------------- | ------ | -------- |
| 1   | ToolContext에 activeClient 전파       | Issue 1 근본 해결 | M      | **P0**   |
| 2   | `llm:call-start` 이벤트 추가          | Issue 2 핵심 개선 | S      | **P0**   |
| 3   | SubagentError에 실제 원인 포함        | 디버깅 개선       | S      | P1       |
| 4   | `agent:tools-executing/done` 이벤트   | Issue 2 보완      | M      | P1       |
| 5   | `agentPhase` 상태 통합                | Issue 2 근본 해결 | L      | P2       |
| 6   | 앱 시작 시 LOCAL 헬스체크 + 자동 폴백 | Issue 1 UX 개선   | M      | P2       |

### 즉시 적용 가능한 워크어라운드

1. `.env`에서 `LOCAL_API_BASE_URL` 주석 처리 → OPENAI가 기본 서버로 사용됨
2. 또는 `/model` → ☁️ OpenAI Default 선택 후 사용
   - **주의**: 이 경우에도 서브에이전트는 여전히 초기 LOCAL 클라이언트를 사용하므로 실패함
   - Issue 1 방안 A를 적용해야 완전 해결

---

## 재현 방법

### Issue 1 재현

```bash
# .env에 접근 불가한 LOCAL 서버 + 정상 OPENAI 서버 설정
LOCAL_API_BASE_URL=http://10.0.0.1:9999
LOCAL_MODEL=test-model
OPENAI_API_KEY=valid-key
OPENAI_MODEL=gpt-5.1-codex-mini
OPENAI_BASE_URL=https://valid-azure-endpoint.com/openai/responses

# dbcode 실행 → /model → ☁️ OpenAI 전환 → 코드 탐색 요청
node dist/index.js
> /model
> (☁️ OpenAI Default 선택)
> 이 프로젝트의 구조를 분석해줘
# → 메인 대화는 OpenAI로 정상 동작
# → explore 서브에이전트는 LOCAL(10.0.0.1:9999)로 연결 시도 → 실패
```

### Issue 2 재현

```bash
# 느린 LLM 서버 또는 대량 도구 호출이 필요한 작업
node dist/index.js
> src/ 디렉토리의 모든 .ts 파일에서 console.log를 찾아서 각각 설명해줘
# → 다수의 file_read + grep_search 호출 중 UI 멈춤 현상
```
