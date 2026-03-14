# Sprint 5: Core Maturity + Model Efficiency (Production Readiness & Low-Model Optimization)

> **Version**: 3.0 (Agent Loop 전문가 감사 + LLM Client CRITICAL 이슈 반영)
> **Date**: 2026-03-14
> **Base**: Sprint 4 완료 — 3605 tests / 0 TS errors / 36 commands
> **Scope**: Agent Loop 안정화 + LLM Client 버그 수정 + 미연결 모듈 통합 + 저성능 모델 최적화 + 상용화 준비

---

## 목차

1. [Agent Loop & LLM Client 전문가 감사](#agent-loop--llm-client-전문가-감사)
2. [코드베이스 심층 감사 결과 (미연결 모듈)](#코드베이스-심층-감사-결과)
3. [Phase 0: Critical Bug Fixes (즉시 수정)](#phase-0-critical-bug-fixes)
4. [Phase A: Foundation Wiring (미연결 모듈 통합)](#phase-a-foundation-wiring)
5. [Phase B: Model Efficiency (저성능 모델 최적화)](#phase-b-model-efficiency)
6. [Phase C: Production Readiness (상용화 준비)](#phase-c-production-readiness)
7. [구현 순서 및 일정](#구현-순서-및-일정)
8. [검증 기준](#검증-기준)

---

## Agent Loop & LLM Client 전문가 감사

Claude Code 아키텍처 전문가 관점에서 Agent Loop (714줄), useAgentLoop Hook (530줄), LLM Client Layer (1600줄+)를 전수 감사했습니다.

### Agent Loop (`src/core/agent-loop.ts`) — 아키텍처 평가: A

| 항목 | 상태 | 비고 |
|------|------|------|
| ReAct 루프 구조 | ✅ 완전 | while(iterations < max) + tool call 감지 → 종료 |
| 에러 분류 | ✅ 3-class | transient (재시도) / overload (즉시 실패) / permanent (즉시 실패) |
| 재시도 로직 | ✅ 지수 백오프 | 1s → 2s → 4s, maxRetries 설정 가능 |
| 도구 병렬 실행 | ✅ 정교 | 읽기 도구 병렬, 같은 파일 쓰기는 순차, 경로 충돌 감지 |
| 컨텍스트 관리 | ✅ 자동 compaction | `contextManager.prepare()` 통합 |
| 스트리밍 | ✅ partial recovery | 스트림 중단 시 축적된 부분 콘텐츠 활용 |
| 가드레일 | ✅ 입력+출력 | 도구 실행 전 입력, 실행 후 출력 검증 |
| 체크포인트 | ✅ 자동 | 파일 수정 도구 실행 전 스냅샷 |
| 취소 | ✅ AbortSignal | 루프 시작, LLM 호출, 도구 실행, 재시도 대기 모두 대응 |
| 파일 추적 | ✅ 구현 | file_read/edit/write 시 trackFileAccess() 호출 |
| TODO/미완성 | ✅ 없음 | 완전한 구현, 플레이스홀더 없음 |

**결론**: Agent Loop 자체는 프로덕션 등급입니다. 문제는 **상위 레이어 통합**에 있습니다.

---

### useAgentLoop Hook (`src/cli/hooks/useAgentLoop.ts`) — 통합 이슈 7건

| # | 심각도 | 이슈 | 영향 |
|---|--------|------|------|
| **H1** | 🔴 HIGH | **AbortController 미전달** — `runAgentLoop()`에 signal 미전달. 사용자가 Esc 눌러도 LLM 호출 취소 불가 | 사용자 경험 저하 + 리소스 낭비 |
| **H2** | 🟠 MEDIUM | **MCP 레이스 컨디션** — `useEffect`로 MCP tool search 등록이 mount 후 비동기 실행. `processMessage`가 먼저 호출되면 MCP 도구 미발견 | 첫 번째 메시지에서 MCP 도구 누락 가능 |
| **H3** | 🟠 MEDIUM | **세션 저장 fire-and-forget** — `void sessionManager.appendMessages()`. 저장 실패 시 무시, 재시도 없음 | 크래시 시 대화 유실 |
| **H4** | 🟠 MEDIUM | **인스트럭션/메모리 로드 실패 무시** — catch에서 아무 로그 없이 무시 | 디버깅 불가, 사용자 혼란 |
| **H5** | 🟡 LOW | **ModelCapabilities 중복 호출** — `getModelCapabilities()` 2회 호출 (line 249, 293) | 성능 (미미) |
| **H6** | 🟡 LOW | **언마운트 시 정리 불완전** — ActivityCollector 등 리소스 미해제 | 메모리 누수 가능 |
| **H7** | 🟡 LOW | **메시지 큐 무제한 증가** — 처리 중 제출 시 큐에 쌓이나 상한 없음 | 극단적 경우에만 문제 |

---

### LLM Client Layer — CRITICAL 이슈 2건 + HIGH 4건

| # | 심각도 | 파일 | 이슈 | 영향 |
|---|--------|------|------|------|
| **L1** | 🔴 **CRITICAL** | `client.ts` | **AbortSignal 이벤트 리스너 누적** — 스트림 재시도 시 이전 리스너 미제거. 재시도마다 리스너 누적 → 메모리 누수 | 장시간 세션에서 메모리 증가 |
| **L2** | 🔴 **CRITICAL** | `providers/anthropic.ts` | **스트림 타임아웃 레이스 컨디션** — 응답 수신 후 스트림 파싱 시작 전에 타임아웃 발동 가능 | 정상 스트림 중단 → 사용자 에러 |
| **L3** | 🟠 HIGH | `client.ts` | **Responses API JSON 파싱 실패 무시** — `arguments: item.arguments ?? "{}"`. 파싱 실패 시 빈 객체로 대체, 로그 없음 | 도구 호출 실패 원인 추적 불가 |
| **L4** | 🟠 HIGH | `streaming.ts` | **도구 호출 ID 매칭 로직 혼란** — `tc.id === id && id` 의 `&& id`는 불필요, 의도 불명확 | 코드 유지보수 어려움 |
| **L5** | 🟠 HIGH | `strategies/text-parsing.ts` | **도구 호출 ID 충돌 위험** — `Date.now() + counter`는 밀리초 단위. 동시 호출 시 충돌 가능 | 도구 결과 매칭 오류 가능 |
| **L6** | 🟠 HIGH | `providers/anthropic.ts` | **SSE 파싱 에러 무시** — `catch {}` 로 JSON 파싱 실패 무시 | 도구 호출/텍스트 유실 가능 |

---

### 기능 통합 현황 매트릭스

```
Agent Loop (core) ←──── useAgentLoop (hook) ←──── App.tsx (UI)
     │                       │                        │
     │ ✅ 에러 분류           │ ❌ AbortController     │ ✅ Esc 키 바인딩
     │ ✅ 재시도 로직          │ ❌ MCP 레이스 컨디션    │ ✅ 스트리밍 표시
     │ ✅ 도구 병렬 실행       │ ⚠️ 세션 저장 불안정    │ ✅ 퍼미션 프롬프트
     │ ✅ 가드레일             │ ⚠️ 에러 무시 로그      │ ✅ 체크포인트 UI
     │ ✅ 스트리밍 recovery    │ ✅ thinking 통합       │ ✅ StatusBar
     │ ✅ 체크포인트            │ ✅ 시스템 프롬프트 빌드 │
     │ ✅ 파일 추적             │ ✅ 메트릭 수집         │
     └─────────────────────────┘                       │
             │                                         │
     LLM Client Layer                                  │
     │ ❌ AbortSignal 메모리 누수                       │
     │ ❌ 스트림 타임아웃 레이스                         │
     │ ⚠️ JSON 파싱 에러 무시                          │
     │ ⚠️ 도구 호출 ID 충돌 위험                       │
```

---

## 코드베이스 심층 감사 결과

Sprint 5 v1.0 계획을 코드베이스 실제 상태와 대조한 결과, **구현은 되어 있으나 연결되지 않은 모듈**이 다수 발견되었습니다. 새로운 기능을 추가하기 전에 이 기반을 단단하게 하는 것이 우선입니다.

### 미연결 모듈 전수 조사

| 모듈 | 파일 | 상태 | 문제 |
|------|------|------|------|
| **Repo Map** | `src/indexing/repo-map.ts` (205줄) | 완성, 테스트 있음 | 프로덕션 코드에서 **import 0건** |
| **Thinking Budget** | `src/llm/thinking-budget.ts` (27줄) | 완성, 테스트 있음 | `useAgentLoop.ts`에서 호출하나 **contextUsagePercent 미전달** (항상 0) |
| **MCP Connector** | `src/mcp/manager-connector.ts` (6개 서브모듈 오케스트레이션) | 완성 | `index.ts:405`에서 **`mcpConnector: undefined`** 하드코딩 |
| **Cost Tracker** | `src/llm/cost-tracker.ts` (139줄) | 완성 | `/cost` 커맨드가 **CostTracker 클래스를 사용하지 않고** metrics counter만 참조 |

### 이미 구현된 기능 (v1.0 계획에서 과대 추정)

| v1.0 항목 | 가정 | 실제 | 수정 |
|-----------|------|------|------|
| **M2 Smart Context Eng** | 대폭 확장 필요 | `system-prompt-builder.ts`에 **PromptSection, priority, tokenBudget, condition 모두 구현 완료** (696줄) | → 범위 대폭 축소: tier별 예산 배분만 추가 |
| **M3 Repo Map** | 인덱서 구축 필요 | `repo-map.ts`에 **buildRepoMap, renderRepoMap 완전 구현** | → 범위 변경: 통합(wiring) 작업만 |
| **M4 Prompt Compress** | 신규 모듈 | M2와 기능 중복 심각 | → M2에 통합, 별도 모듈 불필요 |

### 의존성 레이어 위반 검사

```
현재 아키텍처: CLI → Core → Infra → Leaf (순방향만 허용)
위반 사항: 없음 (madge --circular 통과)
단, 미연결 노드가 3개 존재 (repo-map, thinking-budget contextUsage, MCP connector)
```

---

## Phase 0: Critical Bug Fixes (즉시 수정)

**목표**: 상용화를 막는 CRITICAL/HIGH 버그를 최우선으로 수정합니다. 새로운 기능 추가 이전에 반드시 완료해야 합니다.

### P0-1. AbortSignal 메모리 누수 수정 (CRITICAL — L1)

**문제**: `src/llm/client.ts`와 `src/llm/providers/anthropic.ts`에서 스트림 재시도 시 `AbortSignal.addEventListener`가 호출되지만 `removeEventListener`가 없음. 재시도마다 리스너가 누적되어 장시간 세션에서 메모리 누수.

**수정**:
```typescript
// src/llm/client.ts — 스트림 재시도 루프 내부
// 수정 전:
request.signal?.addEventListener("abort", () => controller.abort());

// 수정 후:
const onAbort = () => controller.abort();
request.signal?.addEventListener("abort", onAbort, { once: true });
// 또는 AbortController 자체를 매 시도마다 새로 생성
```

```typescript
// src/llm/providers/anthropic.ts — 동일 패턴 수정
const onAbort = () => controller.abort();
signal?.addEventListener("abort", onAbort, { once: true });
// finally 블록에서:
signal?.removeEventListener("abort", onAbort);
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/client.ts` | 리스너 정리 | ~5줄 |
| `src/llm/providers/anthropic.ts` | 리스너 정리 | ~5줄 |
| 테스트 | 메모리 누수 검증 | ~20줄 |

---

### P0-2. Anthropic 스트림 타임아웃 레이스 컨디션 수정 (CRITICAL — L2)

**문제**: 응답 수신 후(line 510) 스트림 바디 파싱 시작(line 525) 사이에 타임아웃이 발동할 수 있음. 정상적으로 스트리밍 중인데 타임아웃 에러 발생.

**수정**:
```typescript
// src/llm/providers/anthropic.ts
// 수정 전: 타임아웃이 응답 전체에 적용
const timeout = setTimeout(() => controller.abort(), timeoutMs);

// 수정 후: 스트림 chunk 수신 시마다 타임아웃 리셋
let timeout = setTimeout(() => controller.abort(), timeoutMs);

for await (const chunk of parseSSEStream(response.body)) {
  clearTimeout(timeout);
  timeout = setTimeout(() => controller.abort(), timeoutMs); // 리셋
  yield chunk;
}
clearTimeout(timeout);
```

이 패턴은 "idle timeout" — 마지막 chunk 수신 후 N초 동안 새 chunk 없으면 타임아웃. Claude Code도 이 패턴 사용.

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/providers/anthropic.ts` | idle timeout 패턴 | ~10줄 |
| 테스트 | 타임아웃 시나리오 | ~20줄 |

---

### P0-3. useAgentLoop에 AbortController 전달 (HIGH — H1)

**문제**: `useAgentLoop.ts`에서 `runAgentLoop()`에 `signal`을 전달하지 않음. 사용자가 Esc를 눌러도 진행 중인 LLM 호출이 취소되지 않고 토큰과 시간을 낭비.

**수정**:
```typescript
// src/cli/hooks/useAgentLoop.ts

// AbortController 관리
const abortControllerRef = useRef<AbortController | null>(null);

// processMessage에서:
const controller = new AbortController();
abortControllerRef.current = controller;

const result = await runAgentLoop(
  {
    ...config,
    signal: controller.signal,  // ← 추가
  },
  messages,
);

// 취소 핸들러:
const handleCancel = useCallback(() => {
  abortControllerRef.current?.abort();
}, []);
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/cli/hooks/useAgentLoop.ts` | AbortController 통합 | ~15줄 |
| 테스트 | 취소 시나리오 | ~15줄 |

---

### P0-4. 도구 호출 ID 충돌 방지 (HIGH — L5)

**문제**: `text-parsing.ts`에서 `tc_text_${Date.now()}_${counter}` 형식의 ID 생성. 밀리초 정밀도에서 동시 호출 시 충돌 가능.

**수정**:
```typescript
// src/llm/strategies/text-parsing.ts
// 수정 전:
return `tc_text_${Date.now()}_${callIdCounter}`;

// 수정 후:
import { randomUUID } from "node:crypto";
return `tc_text_${randomUUID().slice(0, 8)}`;
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/strategies/text-parsing.ts` | crypto UUID | ~3줄 |

---

### P0-5. JSON 파싱 에러 로깅 추가 (HIGH — L3, L6)

**문제**: LLM 응답의 JSON 파싱 실패가 모든 레이어에서 무시됨. 도구 호출 실패 원인 추적 불가.

**수정**:
```typescript
// src/llm/strategies/native-function-calling.ts
// 수정 전:
try { args = JSON.parse(tc.arguments); } catch { args = {}; }

// 수정 후:
try {
  args = JSON.parse(tc.arguments);
} catch (parseError) {
  args = {};
  // 구조화된 경고 — 디버그 모드에서만 출력
  if (process.env.DBCODE_VERBOSE) {
    process.stderr.write(`Warning: Invalid tool call JSON for ${tc.name}: ${String(parseError)}\n`);
  }
}
```

```typescript
// src/llm/providers/anthropic.ts — SSE 파싱
// 수정 전:
try { yield JSON.parse(data); } catch { /* Skip */ }

// 수정 후:
try {
  yield JSON.parse(data) as AnthropicStreamEvent;
} catch {
  if (process.env.DBCODE_VERBOSE) {
    process.stderr.write(`Warning: Unparseable SSE event: ${data.slice(0, 100)}\n`);
  }
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/strategies/native-function-calling.ts` | 파싱 에러 로깅 | ~5줄 |
| `src/llm/providers/anthropic.ts` | SSE 에러 로깅 | ~5줄 |
| `src/llm/client.ts` | Responses API 에러 로깅 | ~5줄 |

---

### P0-6. MCP 레이스 컨디션 해결 (MEDIUM — H2)

**문제**: `useEffect`에서 MCP tool search를 비동기로 등록하지만, `processMessage`가 먼저 호출될 수 있음.

**수정**:
```typescript
// src/cli/hooks/useAgentLoop.ts
// 수정 전: 별도 useEffect에서 비동기 등록

// 수정 후: processMessage 시작 시 MCP 준비 상태 확인
const mcpReadyRef = useRef(false);

useEffect(() => {
  if (mcpConnector) {
    toolRegistry.setToolSearch(mcpConnector.getToolSearch());
    mcpReadyRef.current = true;
  }
}, [mcpConnector, toolRegistry]);

// processMessage에서:
if (mcpConnector && !mcpReadyRef.current) {
  toolRegistry.setToolSearch(mcpConnector.getToolSearch());
  mcpReadyRef.current = true;
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/cli/hooks/useAgentLoop.ts` | 동기 초기화 폴백 | ~8줄 |

---

### P0-7. 세션 저장 안정성 강화 (MEDIUM — H3)

**문제**: `void sessionManager.appendMessages()` — fire-and-forget. 저장 실패 시 데이터 유실.

**수정**:
```typescript
// 수정 전:
void sessionManager.appendMessages(sessionId, newMessages);

// 수정 후:
sessionManager.appendMessages(sessionId, newMessages).catch((err) => {
  process.stderr.write(`Warning: Failed to save session: ${err instanceof Error ? err.message : String(err)}\n`);
  // 다음 턴에서 재시도 (메시지는 메모리에 유지됨)
});
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/cli/hooks/useAgentLoop.ts` | 에러 핸들링 추가 | ~5줄 |

---

### Phase 0 요약

| # | 심각도 | 수정 | 파일 수 | 총 변경 규모 |
|---|--------|------|---------|-------------|
| P0-1 | CRITICAL | AbortSignal 리스너 정리 | 2 | ~10줄 |
| P0-2 | CRITICAL | Idle timeout 패턴 | 1 | ~10줄 |
| P0-3 | HIGH | AbortController 전달 | 1 | ~15줄 |
| P0-4 | HIGH | crypto UUID | 1 | ~3줄 |
| P0-5 | HIGH | JSON 파싱 로깅 | 3 | ~15줄 |
| P0-6 | MEDIUM | MCP 레이스 컨디션 | 1 | ~8줄 |
| P0-7 | MEDIUM | 세션 저장 안정성 | 1 | ~5줄 |
| **합계** | | | **10 파일** | **~66줄** |

---

## Phase A: Foundation Wiring (미연결 모듈 통합)

**목표**: 구현되어 있으나 연결되지 않은 모듈을 프로덕션 코드에 통합하여 기반을 단단하게 합니다.

### A1. Repo Map → System Prompt 통합

**현재 상태**: `buildRepoMap()`과 `renderRepoMap()`이 완전히 구현되어 있으나, 프로덕션 코드 어디에서도 호출되지 않습니다.

**수정 대상**: `src/cli/hooks/useAgentLoop.ts` + `src/core/system-prompt-builder.ts`

```typescript
// src/core/system-prompt-builder.ts — 신규 섹션 추가
// priority 35 (tools: 85, instructions: 60 보다 낮음)
{
  id: "repo-map",
  content: repoMapContent,  // renderRepoMap() 결과
  priority: 35,
  tokenBudget: tierBudgets[tier],  // HIGH: 5000, MEDIUM: 2000, LOW: 500
  condition: () => repoMapContent.length > 0,
}
```

```typescript
// src/cli/hooks/useAgentLoop.ts — 초기화 시 repo map 빌드 (비동기, 비차단)
useEffect(() => {
  import("../../indexing/repo-map.js").then(async ({ buildRepoMap, renderRepoMap }) => {
    const map = await buildRepoMap(workingDirectory);
    const tierBudget = { high: 5000, medium: 2000, low: 500 }[modelCaps.capabilityTier];
    setRepoMapContent(renderRepoMap(map, tierBudget));
  }).catch(() => {}); // 실패 시 무시 — 선택적 기능
}, [workingDirectory]);
```

**Tier별 Repo Map 예산**:
- **HIGH** (128K+): 5000 토큰 — 파일명 + 심볼 시그니처 + import 관계
- **MEDIUM** (32K-128K): 2000 토큰 — 파일명 + exported 심볼만
- **LOW** (<32K): 500 토큰 — 디렉토리 트리만 (심볼 제외)

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/system-prompt-builder.ts` | repo-map 섹션 추가 | ~15줄 |
| `src/cli/hooks/useAgentLoop.ts` | 초기화 시 빌드 | ~20줄 |
| `src/indexing/repo-map.ts` | tier별 렌더링 옵션 추가 | ~30줄 |
| 테스트 | 통합 테스트 | ~30줄 |

---

### A2. Thinking Budget — contextUsagePercent 실제 전달

**현재 상태**: `calculateThinkingBudget(caps, contextUsagePercent)` 시그니처가 `contextUsagePercent`를 받지만, 호출부(`useAgentLoop.ts:333`)에서 **인자 없이 호출**하여 항상 0 (디폴트값).

```typescript
// 현재 (useAgentLoop.ts:332-333):
const thinkingConfig = thinkingEnabled && modelCaps.supportsThinking
  ? { type: "enabled" as const, budget_tokens: calculateThinkingBudget(modelCaps) }
  //                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                                          contextUsagePercent 미전달! 항상 기본값 0
  : undefined;
```

**수정**:
```typescript
// 수정 후:
const contextUsage = contextManager.getUsage();
const usagePercent = contextUsage.usageRatio * 100;
const thinkingConfig = thinkingEnabled && modelCaps.supportsThinking
  ? { type: "enabled" as const, budget_tokens: calculateThinkingBudget(modelCaps, usagePercent) }
  : undefined;
```

**효과**: 컨텍스트 70%+ 사용 시 thinking budget이 자동으로 50% 감소 → 컨텍스트 오버플로 방지.

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/cli/hooks/useAgentLoop.ts` | contextUsagePercent 전달 | ~5줄 |
| 테스트 | 검증 | ~10줄 |

---

### A3. MCP Connector 실제 초기화

**현재 상태**: `MCPManagerConnector` 클래스가 완전히 구현되어 있으나 (6개 서브모듈 오케스트레이션 포함), `index.ts:405`에서 `mcpConnector: undefined`로 하드코딩.

```typescript
// 현재 (index.ts:405):
mcpConnector: undefined,  // MCP initialization is a future task — wiring only
```

**수정**: MCP 설정이 있을 때만 초기화. 설정이 없으면 undefined 유지.

```typescript
// src/index.ts — MCP 초기화 추가
let mcpConnector: MCPManagerConnector | undefined;

// MCP config 파일이 존재하면 초기화
const mcpConfigPath = join(process.cwd(), ".dbcode", "mcp.json");
if (existsSync(mcpConfigPath)) {
  const { MCPManagerConnector } = await import("./mcp/manager-connector.js");
  const mcpConfig = JSON.parse(await readFile(mcpConfigPath, "utf-8"));
  mcpConnector = new MCPManagerConnector(mcpConfig);
  await mcpConnector.connectAll().catch((err) => {
    // MCP 연결 실패는 경고만 — 앱 종료하지 않음
    process.stderr.write(`Warning: MCP connection failed: ${err.message}\n`);
  });
}
```

**안전성**: MCP 설정이 없거나 연결 실패 시에도 앱이 정상 동작.

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/index.ts` | 조건부 MCP 초기화 | ~20줄 |
| 테스트 | MCP 없는 경우 기존 동작 검증 | ~15줄 |

---

### A4. Graceful Shutdown + 세션 자동 저장

**현재 상태**: 프로세스 시그널 핸들링 **완전 부재**. `SIGINT`(Ctrl+C) 시 세션 저장 없이 즉시 종료.

**수정**: `src/index.ts`에 시그널 핸들러 추가.

```typescript
// 시그널 핸들링
function setupGracefulShutdown(
  sessionManager: SessionManager,
  hookRunner: HookRunner,
  sessionId: string,
): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return; // 중복 호출 방지
    shuttingDown = true;

    try {
      // SessionEnd 훅 실행
      await hookRunner.run("SessionEnd", {
        event: "SessionEnd",
        workingDirectory: process.cwd(),
        sessionId,
      });
    } catch { /* 훅 실패는 무시 */ }

    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
```

**세션 자동 저장** (30초 간격):

```typescript
// src/core/session-auto-save.ts (신규)
export function setupAutoSave(
  sessionManager: SessionManager,
  intervalMs: number = 30_000,
): { readonly stop: () => void } {
  const timer = setInterval(() => {
    sessionManager.saveCurrentState().catch(() => {});
  }, intervalMs);
  timer.unref(); // 프로세스 종료를 막지 않음

  return { stop: () => clearInterval(timer) };
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/index.ts` | 시그널 핸들링 | ~25줄 |
| `src/core/session-auto-save.ts` | **신규** | ~25줄 |
| 테스트 | 신규 | ~30줄 |

---

## Phase B: Model Efficiency (저성능 모델 최적화)

**목표**: LOW/MEDIUM tier 모델에서도 실용적인 코딩 작업이 가능하도록 최적화합니다.

### B1. Dual-Model Router (Architect/Editor 패턴)

**배경**: Aider의 Architect/Editor 패턴은 SOTA 벤치마크 결과를 달성합니다. Claude Code의 `opusplan` 설정도 유사한 접근입니다.

**기존 인프라 활용**: `ModelRouter` (296줄)가 이미 fallback 라우팅을 지원합니다. M1은 이 위에 **phase-aware** 라우팅을 추가합니다.

```typescript
// src/llm/dual-model-router.ts (신규)

/** Phase-aware model routing for architect/editor pattern */
export interface DualModelConfig {
  readonly architectModel: string;
  readonly editorModel: string;
  readonly routingStrategy: "auto" | "plan-execute" | "manual";
}

type TaskPhase = "plan" | "execute" | "review";

/**
 * 기존 ModelRouter를 감싸서 phase-aware 라우팅 추가.
 *
 * 기존 ModelRouter: Primary → Fallback (에러 기반 전환)
 * DualModelRouter: Architect → Editor (phase 기반 전환)
 *
 * routingStrategy:
 *   "auto" — 입력 분석하여 자동 결정 (계획 → architect, 코드 생성 → editor)
 *   "plan-execute" — plan mode에서 architect, 일반 모드에서 editor
 *   "manual" — 사용자가 /architect, /editor로 수동 전환
 */
export class DualModelRouter {
  constructor(
    private readonly config: DualModelConfig,
    private readonly architectClient: LLMProvider,
    private readonly editorClient: LLMProvider,
  ) {}

  getClientForPhase(phase: TaskPhase): {
    readonly client: LLMProvider;
    readonly model: string;
    readonly role: "architect" | "editor";
  } {
    const isArchitectPhase = phase === "plan" || phase === "review";
    return isArchitectPhase
      ? { client: this.architectClient, model: this.config.architectModel, role: "architect" }
      : { client: this.editorClient, model: this.config.editorModel, role: "editor" };
  }
}
```

**커맨드**: `/architect <model>`, `/editor <model>`, `/dual on|off`

**agent-loop.ts 변경**: 현재 `phase` 추적이 없으므로, 간단한 phase 감지 추가:

```typescript
// agent-loop.ts에 추가
function detectPhase(messages: readonly ChatMessage[]): TaskPhase {
  const lastUser = messages.findLast(m => m.role === "user");
  if (!lastUser) return "execute";

  const content = lastUser.content.toLowerCase();
  const planKeywords = ["plan", "설계", "분석", "리뷰", "review", "architecture", "design"];
  return planKeywords.some(k => content.includes(k)) ? "plan" : "execute";
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/dual-model-router.ts` | **신규** | ~100줄 |
| `src/commands/dual-model.ts` | **신규** (`/architect`, `/editor`, `/dual`) | ~80줄 |
| `src/core/agent-loop.ts` | phase 감지 추가 | ~20줄 |
| `src/config/schema.ts` | dualModel config 추가 | ~15줄 |
| `src/index.ts` | 커맨드 등록 + 라우터 생성 | ~15줄 |
| 테스트 | 신규 | ~80줄 |

---

### B2. Tier-Based System Prompt Budget

**기존 인프라**: `system-prompt-builder.ts`에 `totalTokenBudget`, `capabilityTier`, `PromptSection.tokenBudget`이 **이미 구현되어 있습니다**. 단, tier별 **구체적 예산 배분 정책**이 없습니다.

**수정**: tier별 예산 상수 테이블 추가.

```typescript
// src/core/system-prompt-builder.ts에 추가

/** Tier-based system prompt budget allocation */
const TIER_BUDGETS: Record<CapabilityTier, {
  readonly totalBudget: number;
  readonly toolDescriptionBudget: number;
  readonly instructionsBudget: number;
  readonly repoMapBudget: number;
  readonly skillsBudget: number;
}> = {
  high: {
    totalBudget: 12_000,
    toolDescriptionBudget: 4_000,
    instructionsBudget: 3_000,
    repoMapBudget: 5_000,
    skillsBudget: 2_000,
  },
  medium: {
    totalBudget: 8_000,
    toolDescriptionBudget: 2_500,
    instructionsBudget: 2_000,
    repoMapBudget: 2_000,
    skillsBudget: 1_000,
  },
  low: {
    totalBudget: 4_000,
    toolDescriptionBudget: 1_500,  // 도구 설명 압축 필수
    instructionsBudget: 1_000,
    repoMapBudget: 500,
    skillsBudget: 500,
  },
};
```

**도구 설명 압축 (LOW tier 전용)**:

```typescript
/**
 * LOW tier: 도구 설명을 1줄로 압축, 필수 파라미터만 유지.
 *
 * Before (HIGH): "Read a file from the filesystem. Supports text files up to 2000 lines..."
 * After  (LOW):  "Read file. params: {path: string}"
 */
function compressToolDescription(tool: ToolDefinition, tier: CapabilityTier): ToolDefinition {
  if (tier !== "low") return tool;
  // 첫 문장만 유지 + 필수 파라미터만
  const shortDesc = tool.description.split(".")[0] + ".";
  return { ...tool, description: shortDesc };
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/system-prompt-builder.ts` | tier별 예산 배분 | ~40줄 |
| `src/tools/registry.ts` | LOW tier 도구 설명 압축 | ~25줄 |
| 테스트 | 신규 | ~40줄 |

---

### B3. Tool Call Correction (도구 호출 교정)

**배경**: 저성능 모델은 도구 호출 시 흔한 실수를 합니다:
- 상대 경로 사용 (`./src/index.ts` 대신 `/Users/.../src/index.ts`)
- 파라미터 이름 오류 (`filepath` 대신 `file_path`)
- 타입 불일치 (`"true"` 대신 `true`)

**수정**: `src/tools/executor.ts`에 교정 레이어 추가.

```typescript
// src/tools/tool-call-corrector.ts (신규)

/**
 * 저성능 모델의 도구 호출 오류를 자동 교정합니다.
 * HIGH tier에서는 바이패스하여 오버헤드 없음.
 */
export function correctToolCall(
  args: Record<string, unknown>,
  schema: ZodSchema,
  workingDirectory: string,
  tier: CapabilityTier,
): Record<string, unknown> {
  if (tier === "high") return args; // 바이패스

  const corrected = { ...args };

  // 1. 상대 경로 → 절대 경로
  for (const [key, value] of Object.entries(corrected)) {
    if (typeof value === "string" && isPathLikeKey(key) && !path.isAbsolute(value)) {
      corrected[key] = path.resolve(workingDirectory, value);
    }
  }

  // 2. 타입 교정
  for (const [key, value] of Object.entries(corrected)) {
    if (typeof value === "string") {
      if (value === "true") corrected[key] = true;
      else if (value === "false") corrected[key] = false;
      else if (/^\d+$/.test(value) && isNumberKey(key, schema)) {
        corrected[key] = parseInt(value, 10);
      }
    }
  }

  // 3. 파라미터명 퍼지 매칭 (Levenshtein distance ≤ 2)
  const schemaKeys = Object.keys(schema.shape ?? {});
  for (const [key, value] of Object.entries(corrected)) {
    if (!schemaKeys.includes(key)) {
      const closest = findClosestKey(key, schemaKeys);
      if (closest) {
        corrected[closest] = value;
        delete corrected[key];
      }
    }
  }

  return corrected;
}
```

**executor.ts 통합**:
```typescript
// executor.ts에서 Zod 검증 전에 교정 레이어 삽입
const correctedArgs = correctToolCall(args, tool.parameterSchema, workingDirectory, tier);
const validatedArgs = parseToolArguments(tool.parameterSchema, correctedArgs);
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/tools/tool-call-corrector.ts` | **신규** | ~80줄 |
| `src/tools/executor.ts` | 교정 레이어 통합 | ~5줄 |
| 테스트 | 신규 | ~60줄 |

---

### B4. LOW Tier 도구 사용 가이드

**배경**: LOW tier 모델은 도구 스키마만으로는 올바른 호출을 생성하기 어렵습니다. 명시적 사용 예시가 필요합니다.

```typescript
// src/core/system-prompt-builder.ts에 LOW tier 전용 섹션 추가

const LOW_TIER_TOOL_GUIDE = `
# Tool Usage Guide
You have these tools available. Always use absolute paths.

## Reading files
Call file_read: {"file_path": "/absolute/path/to/file.ts"}

## Editing files
Call file_edit: {"file_path": "/absolute/path", "old_string": "exact text to find", "new_string": "replacement"}

## Searching
Call grep_search: {"pattern": "search term", "path": "/absolute/path/to/dir"}
Call glob_search: {"pattern": "**/*.ts", "path": "/absolute/path/to/dir"}

## Running commands
Call bash_exec: {"command": "npm test"}

Important: Always use the file_read tool before file_edit.
`;
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/system-prompt-builder.ts` | LOW tier 가이드 섹션 | ~30줄 |
| 테스트 | 섹션 포함 검증 | ~15줄 |

---

## Phase C: Production Readiness (상용화 준비)

### C1. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build
      - name: Check circular dependencies
        run: npx madge --circular src/

  publish:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci && npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**v1.0 대비 개선점**:
- `push: [main]` + `pull_request` 분리 (매 push마다 publish하지 않음)
- **Tag 기반 publish** (`refs/tags/v*`) — 안전한 릴리스 제어
- `npm ci` + 캐싱 (`cache: 'npm'`)
- `madge --circular` 의존성 검사 추가
- npm provenance 지원 (`--provenance`)

| 파일 | 변경 | 규모 |
|------|------|------|
| `.github/workflows/ci.yml` | **신규** | ~45줄 |

---

### C2. npm Publish 준비

```json
// package.json 수정 사항
{
  "description": "AI coding assistant for local/external LLMs",
  "keywords": ["ai", "coding", "assistant", "cli", "llm", "agent"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/bigbulgogiburger/dbcode"
  },
  "files": ["dist/", "bin/", "README.md", "LICENSE", "CHANGELOG.md"],
  "engines": { "node": ">=20" },
  "publishConfig": {
    "access": "public"
  }
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `package.json` | publish 메타데이터 | ~15줄 변경 |
| `LICENSE` | **신규** MIT | 표준 |
| `CHANGELOG.md` | **신규** | ~50줄 |

---

### C3. 에러 복구 전략 강화

**기존 상태**: `agent-loop.ts`에 에러 분류(transient/overload/permanent)와 재시도 로직이 있으나, **recovery strategy 테이블**이 없음.

```typescript
// src/core/recovery-strategy.ts (신규)

/** 에러 유형별 복구 전략 레지스트리 */
export const RECOVERY_STRATEGIES: readonly RecoveryStrategy[] = [
  // 컨텍스트 오버플로 → 자동 compaction 후 재시도
  {
    errorPattern: /request too large|context.*exceed|token.*limit/i,
    action: "compact",
    maxRetries: 1,
    description: "Context overflow — auto-compact and retry",
  },
  // 도구 실행 타임아웃 → 더 짧은 타임아웃으로 재시도
  {
    errorPattern: /ETIMEDOUT|timeout|timed out/i,
    action: "retry",
    maxRetries: 2,
    backoffMs: 2000,
    description: "Tool timeout — retry with backoff",
  },
  // LLM 응답 파싱 실패 → 텍스트 파싱 폴백
  {
    errorPattern: /parse.*error|invalid.*json|unexpected token/i,
    action: "fallback-strategy",
    maxRetries: 1,
    description: "Response parse error — fallback to text parsing",
  },
  // 파일 잠금 충돌 → stale lock 체크 후 재시도
  {
    errorPattern: /ELOCK|lock.*exist|locked/i,
    action: "retry",
    maxRetries: 3,
    backoffMs: 1000,
    description: "File lock — wait and retry",
  },
];

export function findRecoveryStrategy(error: Error): RecoveryStrategy | undefined {
  return RECOVERY_STRATEGIES.find(s => s.errorPattern.test(error.message));
}
```

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/core/recovery-strategy.ts` | **신규** | ~60줄 |
| `src/core/agent-loop.ts` | recovery strategy 통합 | ~15줄 |
| 테스트 | 신규 | ~40줄 |

---

## 구현 순서 및 일정

### 에이전트 배정 (7명)

```
Agent 1: "critical-fixes"      → P0-1~P0-5 (CRITICAL + HIGH 버그 수정)
Agent 2: "hook-stabilize"      → P0-3 AbortController + P0-6 MCP 레이스 + P0-7 세션 저장
Agent 3: "repo-map-wiring"     → A1 Repo Map 통합 + A2 Thinking Budget
Agent 4: "mcp-shutdown"        → A3 MCP Connector 초기화 + A4 Graceful Shutdown
Agent 5: "dual-model"          → B1 Dual-Model Router + 커맨드
Agent 6: "tier-budgets"        → B2 Tier-Based Budget + B4 LOW Tier 가이드
Agent 7: "tool-correct-cicd"   → B3 Tool Call Correction + C1 CI/CD + C3 Recovery
```

### 의존성 그래프

```
Phase 0 (최우선 — Day 1):
  P0-1 (AbortSignal 누수) ──→ 독립 (client.ts, anthropic.ts)
  P0-2 (타임아웃 레이스)   ──→ 독립 (anthropic.ts)
  P0-3 (AbortController)  ──→ P0-1 이후 (signal 정상 동작 전제)
  P0-4 (ID 충돌)          ──→ 독립
  P0-5 (JSON 로깅)        ──→ 독립
  P0-6 (MCP 레이스)       ──→ 독립
  P0-7 (세션 저장)        ──→ 독립

Phase A (Day 1-2):
  A1 (Repo Map)  ──┐
  A2 (Thinking)  ─→ B2 (Tier Budgets)
  A3 (MCP)       ──┘
  A4 (Shutdown)  ──→ 독립

Phase B+C (Day 2-3):
  B1 (Dual Model)  ──→ 독립
  B3 (Tool Correct) ──→ 독립
  C1 (CI/CD)       ──→ 독립
  C3 (Recovery)    ──→ 독립
```

### 일정

```
Day 1    │  Agent 1+2 (Phase 0: Critical Fixes) — 최우선
         │  Agent 3+4 (Phase A: Foundation) — 병렬 실행
         │  → 버그 수정 + 미연결 모듈 통합
Day 2    │  Agent 5+6+7 (Phase B+C: Efficiency + Production)
         │  → Dual-Model + Tier Budgets + CI/CD
Day 3    │  통합 테스트 + 벤치마크 + 전체 검증
         │  → 3605+ 테스트 통과 + 커밋
```

**총 예상: 3일**

---

## 검증 기준

### Phase 0 검증 (Critical Bug Fixes)

- [ ] AbortSignal 리스너: 재시도 10회 후에도 리스너 수 ≤1 (메모리 누수 없음)
- [ ] Anthropic 스트림: 60초 이상 스트리밍에서 타임아웃 발생하지 않음
- [ ] Esc 키 취소: LLM 호출 중 Esc 시 즉시 취소됨 (토큰 소모 중단)
- [ ] 도구 호출 ID: 1000회 동시 생성 시 충돌 0건
- [ ] JSON 파싱 에러: verbose 모드에서 경고 출력됨
- [ ] MCP: 첫 번째 메시지에서도 MCP 도구 발견됨
- [ ] 세션 저장 실패: 에러 메시지 출력되고 앱은 계속 동작

### Phase A 검증 (Foundation Wiring)

- [ ] Repo Map이 시스템 프롬프트에 포함됨 (HIGH: 5000토큰, MEDIUM: 2000, LOW: 500)
- [ ] Thinking Budget이 컨텍스트 70%+ 사용 시 50% 감소함
- [ ] MCP 설정 파일이 있으면 자동 연결, 없으면 정상 동작
- [ ] SIGINT/SIGTERM 시 세션 저장 후 종료
- [ ] 30초 간격 자동 저장 동작

### Phase B 검증 (Model Efficiency)

- [ ] `/dual on` — architect/editor 모델 분리 동작
- [ ] `/architect <model>` + `/editor <model>` — 모델 개별 설정
- [ ] Plan mode에서 architect 모델, execute에서 editor 모델 사용
- [ ] LOW tier: 시스템 프롬프트 ≤4K 토큰
- [ ] LOW tier: 도구 설명 압축 (1줄 + 필수 파라미터만)
- [ ] LOW tier: 도구 사용 가이드 포함
- [ ] LOW tier: 상대 경로 → 절대 경로 자동 교정
- [ ] LOW tier: 파라미터명 퍼지 매칭 동작

### Phase C 검증 (Production Readiness)

- [ ] GitHub Actions CI 파이프라인 Node 20/22에서 통과
- [ ] `madge --circular` 통과
- [ ] npm publish dry-run 성공
- [ ] Recovery strategy: context overflow 시 자동 compact + 재시도
- [ ] Recovery strategy: parse error 시 텍스트 파싱 폴백

### 성능 벤치마크

| 시나리오 | 측정 항목 | 목표 |
|---------|----------|------|
| HIGH tier 시스템 프롬프트 | 토큰 수 | ≤12K |
| MEDIUM tier 시스템 프롬프트 | 토큰 수 | ≤8K |
| LOW tier 시스템 프롬프트 | 토큰 수 | ≤4K |
| Repo Map 빌드 (100 파일) | 시간 | ≤500ms |
| 도구 호출 교정 | 성공률 | ≥80% |
| 단일 파일 수정 (LOW tier) | 성공률 | ≥70% |
| 멀티파일 리팩터링 (MEDIUM) | 성공률 | ≥80% |
| Startup time (MCP 없음) | 시간 | ≤300ms |

### 회귀 방지

- [ ] 기존 3605+ 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공
- [ ] Circular dependency 없음 (`madge --circular`)

---

## Sprint 5 이후 — v1.0 릴리스 체크리스트

```
Sprint 1: 비용 최적화           ✅ C1+C2 (Prompt Caching, Deferred Tools)
Sprint 2: UX 완성               ✅ I2+I3+C3+I4 (Markdown, Syntax, Streaming, Thinking)
Sprint 3: 고급 기능 + 코어 보강 ✅ I5+C4+I1+H1-H5 (Plan Mode, MCP HTTP, Worktree, Core)
Sprint 4: 완성도 + DX           ✅ I6+I7+P1+DX1 (Doctor, Bug, Performance, Commands)
Sprint 5: 코어 성숙도 + 효율    ✅ A1-A4 + B1-B4 + C1-C3

v1.0 릴리스 준비 상태:
  ✅ Core Architecture — 4-layer, zero circular deps, all modules wired
  ✅ LLM Integration — Multi-provider, dual-model, adaptive thinking
  ✅ Tool System — 18+ built-in, MCP live, deferred loading, call correction
  ✅ Context Management — 3-layer compaction, cold storage, repo map, tier budgets
  ✅ Developer Experience — 38+ commands, skills, hooks
  ✅ Production Ready — Graceful shutdown, auto-save, recovery strategy
  ✅ CI/CD — GitHub Actions, npm publish with provenance
  ✅ Model Efficiency — Repo map, tier budgets, tool correction, LOW tier guide

남은 작업 (Post v1.0):
  - OAuth Device Flow 인증
  - Plugin Marketplace
  - VS Code Extension
  - 사용자 문서 (Getting Started, Configuration Guide)
  - 국제화 (i18n) 완성
  - 테스트 커버리지 90%+ 목표
```

---

## 계획서 변경 이력

### v1.0 → v2.0 (미연결 모듈 감사)

| 항목 | v1.0 | v2.0 | 이유 |
|------|------|------|------|
| M2 범위 | 신규 모듈 | → B2 (tier 예산만) | system-prompt-builder 이미 95% 완성 |
| M3 범위 | 인덱서 구축 | → A1 (통합만) | repo-map.ts 이미 205줄 완성 |
| M4 | 별도 모듈 | → M2에 통합 (삭제) | M2와 기능 중복 |
| Phase A | 없음 | 미연결 모듈 통합 (4개) | 코드 감사에서 발견 |
| CI/CD | 매 push | Tag 기반 | 안전한 릴리스 제어 |
| 일정 | 4일 | 3일 | 기존 코드 활용으로 범위 축소 |

### v2.0 → v3.0 (Agent Loop 전문가 감사)

| 항목 | v2.0 | v3.0 | 이유 |
|------|------|------|------|
| **Phase 0 추가** | 없음 | **Critical Bug Fixes 7건** | LLM Client CRITICAL 이슈 2건 + Agent Hook HIGH 이슈 발견 |
| **L1 AbortSignal 누수** | 미발견 | P0-1로 추가 | client.ts + anthropic.ts 재시도 시 리스너 누적 |
| **L2 타임아웃 레이스** | 미발견 | P0-2로 추가 | Anthropic 스트림 중 타임아웃 발동 가능 |
| **H1 AbortController** | 미발견 | P0-3로 추가 | useAgentLoop에서 signal 미전달 — Esc 취소 불가 |
| **H2 MCP 레이스** | 미발견 | P0-6로 추가 | 첫 메시지에서 MCP 도구 누락 가능 |
| **H3 세션 저장** | 미발견 | P0-7로 추가 | fire-and-forget 패턴 → 데이터 유실 가능 |
| **감사 범위** | 모듈 연결 상태 | + Agent Loop 714줄 + LLM Client 1600줄+ | 코어 안정성 우선 |
| **우선순위** | A1-A4 동시 시작 | **P0 최우선 → A → B → C** | 버그 수정 없이 기능 추가 불가 |

---

## 웹 리서치 참조

### Dual-Model Architecture
- [Claude Code Model Configuration](https://code.claude.com/docs/en/model-config)
- [Aider Architect/Editor Mode](https://aider.chat/)
- [Choosing the Right Claude Model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)

### Context Engineering
- [Context Engineering for Coding Agents — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html)
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)

### Model Efficiency
- [Local AI Models 2026](https://almira19.medium.com/local-ai-models-that-can-compete-with-premium-coding-assistants-in-2026)
- [State of AI Coding Agents 2026](https://medium.com/@dave-patten/the-state-of-ai-coding-agents-2026)
- [Best AI Model for Coding 2026](https://www.morphllm.com/best-ai-model-for-coding)

### Production Readiness
- [Claude Code Complete Guide 2026](https://claude-world.com/articles/claude-code-complete-guide-2026/)
- [10 Must-Have Skills for Coding Agents](https://medium.com/@unicodeveloper/10-must-have-skills-for-claude-and-any-coding-agent-in-2026)
