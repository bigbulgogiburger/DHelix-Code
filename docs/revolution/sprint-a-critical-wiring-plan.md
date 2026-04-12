# Sprint A: Critical Wiring — Implementation Plan

> **2026-04-09** | Anthropic Claude Code Master 관점 심층 검증 및 개발 계획
> 코드 리딩 기반 실증적 분석 + 5-Agent Team 병렬 실행 전략

---

## Executive Summary

Sprint A는 DHelix Code의 **"설계 우수, 연결 부족"** 문제를 해결하는 핵심 스프린트입니다.
60,000+ LOC의 신규 모듈이 기존 런타임에 연결되지 않은 상태를 해소하여,
**"promising architecture" → "functional product"** 전환을 달성합니다.

### 개발 방향 검증 결과

| 검증 항목 | 결과 | 근거 |
|-----------|------|------|
| 신규 도구 4개 등록 | **적합** | 코드 완성도 100%, `src/index.ts` import + registerAll 배열에 추가만 필요 |
| MCP Health Monitor 통합 | **적합** | DI 패턴 설계, `manager.ts`의 `connectAll()` 후 wiring 포인트 명확 |
| Hook Event Adapter 초기화 | **적합** | `createHookAdapter()` 완성, `src/index.ts` 377줄 hookRunner 생성 직후 연결 |
| ToolPipeline → agent-loop | **적합 (단, 점진적 접근 필요)** | 4-stage pipeline 완성, agent-loop 1087-1113줄 대체 대상 명확 |
| RuntimePipeline → agent-loop | **방향 적합, 범위 축소 권장** | 9-stage 완성이나 agent-loop 1,302 LOC 전면 리팩토링은 리스크 높음 → Phase 1: 호환 래퍼 도입 |

### 리스크 분석

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| agent-loop 전면 리팩토링 시 기존 기능 파손 | **HIGH** | Phase 1: 래퍼 패턴, Phase 2: 점진적 위임 |
| ToolPipeline의 ToolContext vs agent-loop의 executeToolCall 인터페이스 불일치 | **MEDIUM** | 어댑터 패턴으로 브릿지 |
| MCP Health Monitor 타이머가 테스트 환경에서 hanging | **LOW** | AbortSignal 기반 정리 + vitest afterEach |
| 5개 작업 간 파일 충돌 | **LOW** | Task 1-3은 독립 파일, Task 4-5만 agent-loop.ts 공유 → 순차 실행 |

---

## Task 1: 신규 도구 4개 Registry 등록

### 현재 상태 (코드 검증 완료)

- **4개 도구 파일**: 모두 완전 구현됨 (Zod 스키마 + execute 함수 + ToolDefinition export)
  - `src/tools/definitions/apply-patch.ts` → `applyPatchTool`
  - `src/tools/definitions/batch-file-ops.ts` → `batchFileOpsTool`
  - `src/tools/definitions/code-mode.ts` → `codeModeTool`
  - `src/tools/definitions/refactor.ts` → `refactorTool`
- **등록 위치**: `src/index.ts`
  - Import: 130-274줄 `Promise.all([...])` 블록
  - Registration: 320-343줄 `toolRegistry.registerAll([...])` 배열

### 변경 사항

#### 1-1. `src/index.ts` — Dynamic Import 추가 (202-274줄 Promise.all 내부)

```typescript
// 기존 마지막 도구 import (line 235) 뒤에 추가
import("./tools/definitions/safe-rename.js"),
// ── 신규 도구 4개 ──
import("./tools/definitions/apply-patch.js"),
import("./tools/definitions/batch-file-ops.js"),
import("./tools/definitions/code-mode.js"),
import("./tools/definitions/refactor.js"),
```

#### 1-2. `src/index.ts` — Destructuring 추가 (130-201줄)

```typescript
// 기존 destructuring 마지막 (line 163 부근) 뒤에 추가
{ applyPatchTool },
{ batchFileOpsTool },
{ codeModeTool },
{ refactorTool },
```

#### 1-3. `src/index.ts` — registerAll 배열 추가 (320-343줄)

```typescript
toolRegistry.registerAll([
  // ... 기존 22개 도구 ...
  safeRenameTool,
  // ── 신규 도구 4개 ──
  applyPatchTool,
  batchFileOpsTool,
  codeModeTool,
  refactorTool,
]);
```

### 검증 방법

```bash
npm run build && npm run typecheck
# 도구 수 확인: 26개 → 30개 (기존 22 + agent + 4 신규 + 3 내부)
```

### 영향 범위

- `src/index.ts` 만 수정
- 다른 Task와 파일 충돌 없음 (Task 3도 index.ts 수정하나 다른 섹션)

---

## Task 2: MCP Health Monitor → Manager 통합

### 현재 상태 (코드 검증 완료)

- **McpHealthMonitor** (`src/mcp/health-monitor.ts`):
  - DI 패턴: `pingFn`, `reconnectFn` 외부 주입
  - 상태 전이: healthy → degraded → unreachable
  - 콜백 기반 알림: `onStatusChange(callback)`
  - `start()`, `stop()`, `registerServer()` 메서드 완성
- **MCPManager** (`src/mcp/manager.ts`):
  - `clients: Map<string, MCPClient>` — 서버별 클라이언트 관리
  - `connectAll()` → 서버 연결 + bridge 등록
  - **Health monitor 참조 없음** ← 연결 필요

### 변경 사항

#### 2-1. `src/mcp/manager.ts` — Import 추가

```typescript
import { McpHealthMonitor, type McpServerHealth } from "./health-monitor.js";
```

#### 2-2. `src/mcp/manager.ts` — MCPManager 클래스에 필드 추가 (line ~78)

```typescript
export class MCPManager {
  private readonly clients = new Map<string, MCPClient>();
  private readonly bridge: MCPToolBridge;
  private readonly configPath: string;
  private readonly scopeManager: MCPScopeManager | null;
  // ── 신규: Health Monitor ──
  private readonly healthMonitor: McpHealthMonitor;
```

#### 2-3. `src/mcp/manager.ts` — Constructor에서 초기화 (line ~86-93)

```typescript
constructor(config: MCPManagerConfig) {
  this.configPath = config.configPath ?? DEFAULT_CONFIG_PATH;
  this.bridge = new MCPToolBridge(config.toolRegistry);
  this.scopeManager = config.workingDirectory
    ? new MCPScopeManager(config.workingDirectory)
    : null;
  // ── 신규: Health Monitor 초기화 ──
  this.healthMonitor = new McpHealthMonitor({
    pingIntervalMs: 30_000,
    degradedAfter: 2,
    unreachableAfter: 5,
  });
}
```

#### 2-4. `src/mcp/manager.ts` — connectAll() 에서 서버 등록 (line ~173-207)

```typescript
async connectAll(): Promise<ConnectAllResult> {
  const serverConfigs = await this.loadScopedConfigs();
  const entries = Object.entries(serverConfigs);

  if (entries.length === 0) {
    return { connected: [], failed: [] };
  }

  const results = await Promise.allSettled(
    entries.map(async ([name, config]) => {
      await this.connectServer(name, config);
      return name;
    }),
  );

  const connected: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      connected.push(result.value);
    } else {
      failed.push({
        name: entries[i][0],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  // ── 신규: 연결 성공한 서버를 Health Monitor에 등록 ──
  for (const serverName of connected) {
    const client = this.clients.get(serverName);
    if (client) {
      this.healthMonitor.registerServer(serverName, serverName, async () => {
        await client.listTools(); // ping 구현: listTools 호출로 연결 상태 확인
      });
    }
  }

  // 연결된 서버가 있으면 모니터링 시작
  if (connected.length > 0) {
    this.healthMonitor.start();
  }

  return { connected, failed };
}
```

#### 2-5. `src/mcp/manager.ts` — disconnectAll()에서 모니터 정지

```typescript
async disconnectAll(): Promise<void> {
  // ── 신규: Health Monitor 정지 ──
  this.healthMonitor.stop();

  const disconnects = [...this.clients.values()].map((client) => client.disconnect());
  await Promise.allSettled(disconnects);
  this.clients.clear();
}
```

#### 2-6. `src/mcp/manager.ts` — Health 상태 조회 메서드 추가

```typescript
/**
 * 모든 MCP 서버의 헬스 상태를 반환합니다.
 */
getServerHealthStatus(): readonly McpServerHealth[] {
  return this.healthMonitor.getAllHealth();
}
```

### 검증 방법

```bash
npm run typecheck
npm test -- --grep "MCPManager"
```

### MCPClient.listTools() 존재 확인 필요

`src/mcp/client.ts`에 `listTools()` 메서드가 있는지 확인 — MCP 표준이므로 존재할 것으로 예상.

---

## Task 3: Hook Event Adapter 초기화

### 현재 상태 (코드 검증 완료)

- **createHookAdapter()** (`src/hooks/event-emitter-adapter.ts:381-387`):
  - 완전 구현: 5가지 이벤트 매핑, attach/detach 생명주기
  - `AppEventEmitter` + `HookRunner` + `HookAdapterConfig` 의존성
- **연결 지점**: `src/index.ts:377` — `hookRunner` 생성 직후
- **문제**: `AppEventEmitter` 인스턴스가 index.ts에서 생성되지 않음
  - events는 `App` 컴포넌트 내부에서 생성됨 (React hook)

### 변경 전략

`src/index.ts`에서 직접 연결하려면 `AppEventEmitter` 인스턴스가 필요하지만,
현재 events는 App 컴포넌트(CLI React) 내부에서 생성됩니다.

**방안 A (권장)**: App 컴포넌트 내부에서 hookRunner를 받아 adapter를 생성
**방안 B**: index.ts에서 events를 생성하여 App에 전달 + adapter 연결

→ **방안 A 채택**: App 컴포넌트가 이미 events를 소유하므로, hookRunner를 prop으로 전달하고 App 내부에서 연결

### 변경 사항

#### 3-1. `src/index.ts` — App에 hookRunner prop 전달 (line ~587)

```typescript
render(
  React.createElement(App, {
    client,
    model: config.llm.model,
    // ... 기존 props ...
    mcpManager,
    hookRunner, // ← 신규 추가
  }),
  { exitOnCtrlC: false },
);
```

#### 3-2. `src/cli/App.tsx` — hookRunner prop 수신 및 adapter 초기화

```typescript
import { createHookAdapter } from "../hooks/event-emitter-adapter.js";

// App props에 hookRunner 추가
interface AppProps {
  // ... 기존 props ...
  hookRunner?: HookRunner;
}

// useEffect에서 adapter 생성 및 attach
useEffect(() => {
  if (!props.hookRunner || !events) return;

  const adapter = createHookAdapter(events, props.hookRunner, {
    sessionId: props.sessionId,
    workingDirectory: process.cwd(),
  });
  adapter.attach();

  return () => {
    adapter.detach();
  };
}, [props.hookRunner, events]);
```

### 검증 방법

```bash
npm run typecheck
npm test -- --grep "HookEventAdapter"
```

---

## Task 4: ToolPipeline → agent-loop 통합

### 현재 상태 (코드 검증 완료)

- **ToolPipeline** (`src/tools/pipeline.ts:74-225`):
  - 4-stage: Preflight → Schedule → Execute → Postprocess
  - `execute(calls, context, config)` → `PipelineResult`
  - RetryEngine 내장
- **agent-loop 현재 도구 실행** (`src/core/agent-loop.ts:1087-1113`):
  - `executeToolCall()` 직접 호출 (executor.ts)
  - 수동 guardrail 적용 (1104-1109)
  - Promise.allSettled 병렬 실행
  - 수동 그룹핑 (파일 쓰기 도구 순차 실행)

### 인터페이스 불일치 분석

| 항목 | ToolPipeline (ToolContext) | agent-loop (executeToolCall 인자) |
|------|---------------------------|----------------------------------|
| client 참조 | 없음 | `activeClient`, `activeModel` |
| permission | 없음 (preflight에서 처리) | `checkPermission` 콜백 |
| checkpoint | 없음 | `checkpointManager` |
| events | 없음 | `events` |

**결론**: ToolPipeline은 "순수 도구 실행" 관점이고, agent-loop은 "세션 컨텍스트 포함 실행"입니다.
직접 대체보다는 **ToolPipeline을 agent-loop의 실행 엔진으로 래핑하여 사용**하는 것이 안전합니다.

### 변경 전략: Adapter 패턴

agent-loop의 기존 도구 실행 로직을 ToolPipeline 기반으로 전환하되,
agent-loop 고유의 컨텍스트(checkpoint, events, permission)는 Pipeline의 preflight/postprocess에 주입합니다.

### 변경 사항

#### 4-1. `src/core/agent-loop.ts` — ToolPipeline import 추가

```typescript
import { ToolPipeline, type PipelineConfig } from "../tools/pipeline.js";
```

#### 4-2. `src/core/agent-loop.ts` — 도구 실행 섹션 리팩토링 (1087-1113줄)

기존 `executeToolCall` 직접 호출을 `ToolPipeline.execute()`로 대체합니다.
단, 체크포인트, 이벤트 발행, 권한 검사는 Pipeline 외부에서 유지합니다.

```typescript
// 기존: 직접 실행
// let result = await executeToolCall(config.toolRegistry, call, { ... });

// 신규: ToolPipeline 활용
const toolPipeline = new ToolPipeline(config.toolRegistry);
const pipelineResult = await toolPipeline.execute(
  executableCalls,
  {
    workingDirectory: config.workingDirectory ?? process.cwd(),
    signal: config.signal,
    capabilityTier: getModelCapabilities(activeModel).capabilityTier,
  },
  {
    enableGuardrails: config.enableGuardrails !== false,
    postprocess: {
      maxOutputChars: maxToolResultChars,
    },
  },
);

// Pipeline 결과를 기존 형식으로 매핑
for (const result of pipelineResult.results) {
  results.push(result);
  config.events.emit("tool:complete", {
    name: result.name,
    id: result.id,
    isError: result.isError,
    output: result.output,
    metadata: result.metadata,
  });
}
```

### 주의사항

- **체크포인트 로직 보존**: Pipeline 실행 전에 기존 체크포인트 로직 (1056-1085줄) 유지
- **이벤트 발행 보존**: Pipeline 결과 후 `tool:complete` 이벤트 발행 유지
- **권한 검사**: 기존 preflight 로직 (1010-1054줄) → Pipeline preflight로 점진적 이관
- **MCP 실패 가이드**: 기존 MCP 실패 감지 로직 (1190-1209줄) 유지

### 검증 방법

```bash
npm run typecheck
npm test -- --grep "agent-loop"
npm test -- --grep "ToolPipeline"
```

---

## Task 5: RuntimePipeline → agent-loop 호환 래퍼

### 현재 상태 (코드 검증 완료)

- **RuntimePipeline** (`src/core/runtime/pipeline.ts:55-171`):
  - 9-stage 오케스트레이터: `executeIteration(ctx) → IterationOutcome`
  - RuntimeContext: agent-loop의 모든 상태를 포함하는 인터페이스
  - 각 stage 완전 구현 (9개 파일)
- **agent-loop.ts** (1,302 LOC):
  - React hook (`useAgentLoop`) + while 루프 직접 실행
  - UI 통합 (events, streaming), 세션 관리, 에러 복구 등 혼합

### 전면 리팩토링의 리스크

agent-loop.ts를 RuntimePipeline으로 **전면 대체**하면:
1. 1,302줄의 기존 로직 중 UI 통합, 스트리밍, 이중 모델 라우팅 등이 손실될 위험
2. 테스트 커버리지 80%가 크게 하락할 수 있음
3. React hook 패턴(`useAgentLoop`)과 순수 Pipeline의 인터페이스 불일치

### 변경 전략: Phase 1 — 호환 래퍼 (이번 Sprint)

RuntimePipeline을 직접 사용하는 대신, agent-loop 내부에서 **stage 단위로 점진적 위임**합니다.

#### Phase 1 (이번 Sprint): 엔트리 포인트 + 메트릭스

```
agent-loop.ts
  ├── RuntimePipeline.executeIteration() 를 사용하지 않음 (아직)
  ├── 대신: stage 개별 호출을 시작 — resolve-tools, extract-calls
  └── MetricsCollector 연결 — stage별 timing 수집 시작
```

#### Phase 2 (Sprint B): 점진적 위임

```
agent-loop.ts (~500 LOC)
  └── RuntimePipeline.executeIteration()
      ├── 기존 9 stages 활용
      └── agent-loop은 UI 통합 + 세션 관리만 담당
```

### 변경 사항

#### 5-1. `src/core/agent-loop.ts` — RuntimePipeline import 및 stage 활용

```typescript
import { createResolveToolsStage } from "./runtime/stages/resolve-tools.js";
import { createExtractCallsStage } from "./runtime/stages/extract-calls.js";
import { type RuntimeContext, type StageName } from "./runtime/types.js";
```

#### 5-2. `src/core/agent-loop.ts` — Stage 개별 호출 시작

resolve-tools stage를 도입하여 기존 도구 필터링 로직을 대체:

```typescript
// 기존: 수동 도구 목록 생성
// const toolDefs = config.toolRegistry.getHotDefinitionsForLLM();

// 신규: resolve-tools stage 활용
const resolveStage = createResolveToolsStage();
await resolveStage.execute(runtimeCtx);
const toolDefs = runtimeCtx.toolDefs;
```

#### 5-3. `src/core/runtime/index.ts` — 공개 API 확장

```typescript
export { RuntimePipeline, createPipeline, type PipelineOptions } from "./pipeline.js";
export {
  type RuntimeContext,
  type RuntimeStage,
  type StageName,
  type IterationOutcome,
  type PipelineHooks,
} from "./types.js";
// Stage 팩토리 함수도 개별 export (점진적 위임용)
export { createResolveToolsStage } from "./stages/resolve-tools.js";
export { createExtractCallsStage } from "./stages/extract-calls.js";
```

#### 5-4. Metrics 연결

```typescript
// agent-loop 내부에서 stage timing 수집
const timings = new Map<StageName, number>();
// ... stage 실행 후 ...
config.events.emit("agent:stage-timing", { stage: "resolve-tools", ms: elapsed });
```

### 검증 방법

```bash
npm run typecheck
npm test -- --grep "RuntimePipeline"
npm test -- --grep "agent-loop"
npm run check  # 전체 검증
```

---

## Agent Team 구성 (5명)

### 파일 충돌 분석

| Task | 수정 파일 | 충돌 |
|------|----------|------|
| Task 1 | `src/index.ts` (imports + registerAll) | Task 3과 index.ts 공유 → **같은 에이전트** |
| Task 2 | `src/mcp/manager.ts` | 독립 |
| Task 3 | `src/index.ts` (App props) + `src/cli/App.tsx` | Task 1과 index.ts 공유 |
| Task 4 | `src/core/agent-loop.ts` (도구 실행 섹션) | Task 5와 agent-loop.ts 공유 → **순차** |
| Task 5 | `src/core/agent-loop.ts` + `src/core/runtime/index.ts` | Task 4 이후 실행 |

### 최적 팀 구성

```
Agent 1 (Tool Registrar):     Task 1 + Task 3  — src/index.ts + src/cli/App.tsx
Agent 2 (MCP Wiring):         Task 2           — src/mcp/manager.ts
Agent 3 (Pipeline Integrator): Task 4           — src/core/agent-loop.ts (도구 실행 섹션)
Agent 4 (Runtime Bridge):     Task 5           — src/core/agent-loop.ts (stage 위임) + runtime/
Agent 5 (Test & Verify):      전체 검증        — typecheck + test + build

실행 순서:
  Phase 1 (병렬): Agent 1, Agent 2
  Phase 2 (병렬): Agent 3 (Task 4)
  Phase 3 (순차): Agent 4 (Task 5, agent-loop.ts 충돌 회피)
  Phase 4: Agent 5 (전체 검증)
```

---

## 성공 기준

| 기준 | 측정 방법 |
|------|----------|
| 도구 등록률 86% → 100% | `toolRegistry.size` === 30 (기존 26 + 신규 4) |
| MCP Health Monitor 가동 | `mcpManager.getServerHealthStatus()` 반환 |
| Hook Adapter 활성화 | `adapter.isAttached === true` |
| ToolPipeline 연결 | agent-loop에서 `ToolPipeline.execute()` 호출 확인 |
| RuntimePipeline Stage 호출 | `resolve-tools` stage 사용 확인 |
| 기존 테스트 통과 | `npm test` 6,475 tests 전체 통과 |
| 타입 체크 통과 | `npm run typecheck` 0 errors |
| 빌드 성공 | `npm run build` 0 errors |

---

## 롤백 전략

각 Task는 독립적으로 롤백 가능합니다:

```bash
# Task별 독립 커밋이므로 개별 revert 가능
git revert <task-1-commit>  # 도구 등록만 롤백
git revert <task-2-commit>  # MCP health만 롤백
# ...
```

Task 4, 5는 agent-loop.ts를 수정하므로, 롤백 시 Task 5 → Task 4 순서로 revert합니다.
