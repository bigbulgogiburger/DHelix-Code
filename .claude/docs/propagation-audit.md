# 전파(Propagation) 감사 보고서 — 부모↔자식 에이전트 설정 전달 분석

> 작성일: 2026-03-20
> 근거: 5개 심층 감사 에이전트 병렬 분석 + 코드 실측
> 상태: 종합 완료

---

## 요약

**전파 효율: 11.8% (34개 설정 중 4개만 서브에이전트에 도달)**

dhelix의 반복적 문제는 부모 에이전트의 설정/변수/도구가 자식(서브에이전트)에 제대로 전달되지 않는 것이다.
본 보고서는 전체 전파 경로를 감사하여 **모든 갭(gap)**을 식별하고 우선순위와 수정 방법을 제시한다.

---

## 1. 전파 경로 개요

```
[Config System]  ──→  [index.ts]  ──→  [useAgentLoop]  ──→  [agent-loop.ts]
   35개 필드          5개 전달           시스템 프롬프트        도구 실행
                         │                    │                    │
                         ▼                    ▼                    ▼
                  [createAgentTool]     [buildSystemPrompt]   [ToolContext]
                    7개 deps              13개 옵션             8개 필드
                         │                                        │
                         ▼                                        ▼
                  [spawnSubagent]  ──→  [buildSubagentSystemPrompt]  ──→  [runAgentLoop]
                   SubagentConfig         6개 옵션 전달                    14개 config
```

### 전파 손실 지점 (Junction)

| 지점     | 위치                                   | 가용 필드 | 전달 필드 | 손실률  |
| -------- | -------------------------------------- | --------- | --------- | ------- |
| **J1**   | index.ts → createAgentTool             | 35개      | 7개       | **80%** |
| **J2**   | agent.ts → spawnSubagent               | 14개      | 8개 활용  | **43%** |
| **J3**   | spawner.ts → buildSubagentSystemPrompt | 13개      | 6개       | **54%** |
| **총계** | 전체 경로                              | 34개      | 4개       | **88%** |

---

## 2. CRITICAL — 전략(Strategy) 전파 실패

### 2-1. Strategy가 앱 시작 시 고정되어 절대 변경되지 않음

**심각도: CRITICAL**

```typescript
// src/index.ts:327 — 시작 시 1회만 선택
const strategy = selectStrategy(config.llm.model);

// src/index.ts:331-337 — 클로저에 캡처
createAgentTool({ client, model, strategy, toolRegistry, locale });

// /model 전환 후에도 strategy는 그대로!
```

**영향 시나리오:**

1. GPT-4o로 시작 → NativeFunctionCalling 선택
2. 사용자 `/model claude-opus-4-5` 전환
3. activeModel은 변경되지만 strategy는 여전히 GPT용
4. Claude에 GPT 전략으로 도구 호출 → **실패 또는 오작동**

**관련 파일:**

- `src/index.ts:327` — strategy 1회 선택
- `src/cli/hooks/useAgentLoop.ts:722-728` — /model 시 strategy 미갱신
- `src/tools/definitions/agent.ts:132` — deps.strategy 그대로 전달
- `src/subagents/spawner.ts:928` — 부모 strategy 상속
- `src/cli/headless.ts` — headless에서도 미갱신

### 2-2. 서브에이전트가 부모 Strategy를 무조건 상속

**심각도: CRITICAL**

```typescript
// spawner.ts — modelOverride로 모델은 바뀌지만 strategy는 안 바뀜
const { model: effectiveModel } = resolveModelForSubagent(...);
// effectiveModel = "claude-opus-4-5" (변경됨)
// strategy = TextParsing (부모의 llama3 전략 그대로) ← 불일치!
```

---

## 3. HIGH — 시스템 프롬프트 컨텍스트 미전달

### 전달되지 않는 프롬프트 옵션 (buildSystemPrompt 13개 중 7개 미전달)

| 옵션                      | 메인 에이전트 |     서브에이전트      | 영향                                |
| ------------------------- | :-----------: | :-------------------: | ----------------------------------- |
| `capabilityTier`          |      ✅       |          ✅           | —                                   |
| `workingDirectory`        |      ✅       |          ✅           | —                                   |
| `locale`                  |      ✅       |          ✅           | —                                   |
| `projectInstructions`     |      ✅       | ⚠️ 자동 로드 fallback | 디스크 I/O 중복                     |
| **`tone`**                |      ✅       |          ❌           | 사용자 설정 톤(cute/senior 등) 무시 |
| **`skillsPromptSection`** |      ✅       |          ❌           | 커스텀 슬래시 명령 사용 불가        |
| **`autoMemoryContent`**   |      ✅       |          ❌           | 축적된 프로젝트 지식 접근 불가      |
| **`repoMapContent`**      |      ✅       |          ❌           | 코드베이스 구조 정보 없음           |
| **`isHeadless`**          |      ✅       |          ❌           | ask_user 동작 불일치                |
| **`mcpServers`**          |      ✅       |          ❌           | MCP 서버 정보 없음                  |
| **`customSections`**      |      ✅       |          ❌           | 커스텀 프롬프트 섹션 누락           |

---

## 4. HIGH — 권한(Permission) 전파 실패

### 4-1. checkPermission 콜백 미전달

**심각도: HIGH**

```typescript
// 메인 에이전트 — 모든 도구 호출에 권한 확인
runAgentLoop({
  checkPermission,  // ✅ PermissionManager.check()
  ...
});

// 서브에이전트 — 권한 확인 없음
runAgentLoop({
  // checkPermission: ???  ← 전달되지 않음!
  ...
});
```

**영향:** 서브에이전트의 모든 도구가 사용자 확인 없이 실행됨. 도구 레지스트리 필터링(plan 모드)만이 유일한 보안장치.

### 4-2. permissionMode 미전달

| 모드              | 메인 에이전트 |   서브에이전트   |
| ----------------- | :-----------: | :--------------: |
| default           |    ✅ 적용    |    ❌ 미적용     |
| acceptEdits       |    ✅ 적용    |    ❌ 미적용     |
| plan              |    ✅ 적용    | ⚠️ 도구 필터링만 |
| dontAsk           |    ✅ 적용    |    ❌ 미적용     |
| bypassPermissions |    ✅ 적용    |    ❌ 미적용     |

---

## 5. HIGH — 이벤트 시스템 격리

### 설계상 격리이지만 부작용 존재

```typescript
// spawner.ts:876 — 서브에이전트 전용 이벤트 발행기
const events = createEventEmitter(); // 부모와 분리
```

| 이벤트                    | 부모→UI | 서브에이전트→UI | 상태                                |
| ------------------------- | :-----: | :-------------: | ----------------------------------- |
| `tool:start`              |   ✅    |       ❌        | 서브에이전트 도구 실행 시작 안 보임 |
| `tool:complete`           |   ✅    |       ❌        | 개별 도구 완료 안 보임              |
| `tool:output-delta`       |   ✅    |       ❌        | 실시간 출력 스트림 안 보임          |
| `llm:text-delta`          |   ✅    |       ❌        | 서브에이전트 텍스트 스트림 안 보임  |
| `agent:assistant-message` |   ✅    |       ❌        | 중간 응답 안 보임                   |
| `agent:retry`             |   ✅    |       ❌        | 재시도 카운트다운 안 보임           |

**부모가 받는 유일한 이벤트:** 서브에이전트 완료 시 `tool:complete` 1개

---

## 6. MEDIUM — ToolContext 전파 갭

### capabilityTier가 ToolContext에 없음

```typescript
// executor.ts:123 — 도구 인자 보정 시 항상 "high"로 가정
const correctedArgs = correctToolCall(
  args,
  workingDirectory,
  options?.capabilityTier ?? "high", // ← 항상 "high"
);
```

**영향:** low/medium 모델 사용 시 도구 인자 보정이 부적절하게 동작.

### ToolContext 필드별 전파 상태

| 필드             | 메인 | 서브에이전트 | 비고                   |
| ---------------- | :--: | :----------: | ---------------------- |
| workingDirectory |  ✅  |      ✅      | worktree 시 변경됨     |
| abortSignal      |  ✅  |      ✅      | —                      |
| timeoutMs        |  ✅  |      ✅      | —                      |
| platform         |  ✅  |      ✅      | —                      |
| events           |  ✅  |  ⚠️ 격리됨   | 부모 UI에 안 보임      |
| toolCallId       |  ✅  |      ✅      | —                      |
| activeClient     |  ✅  |      ❌      | /model 전환 반영 안 됨 |
| activeModel      |  ✅  |      ❌      | /model 전환 반영 안 됨 |

---

## 7. MEDIUM — 훅(Hook) 시스템 미연결

### 정의되었지만 실행되지 않는 서브에이전트 훅

```
src/subagents/agent-hooks.ts → convertAgentHooks() → mergeHookConfigs()
  ↓
결과물은 생성되지만 runAgentLoop에 hookRunner 파라미터가 없음
  ↓
PreToolUse/PostToolUse 훅이 서브에이전트에서 절대 실행되지 않음
```

**영향:**

- 부모의 `prettier` PostToolUse 훅 → 서브에이전트 파일 편집 시 미실행
- 부모의 `tsc` PostToolUse 훅 → 서브에이전트 TS 편집 시 미실행
- 서브에이전트 전용 훅 정의 가능하지만 실제로 무시됨

---

## 8. MEDIUM — 기타 전파 갭

### 8-1. Extended Thinking 하드코딩

```typescript
// spawner.ts — 항상 false로 설정
const sessionState: SessionState = {
  extendedThinkingEnabled: false, // ← 부모 설정 무시
};
```

### 8-2. Temperature 무조건 전송

```typescript
// o1/o3 모델은 supportsTemperature: false인데도 temperature가 전송됨
// API가 무시하거나 에러 발생 가능
```

### 8-3. Developer Role 미적용

```typescript
// o1/o3 모델은 useDeveloperRole: true인데 서브에이전트 시스템 프롬프트는
// 항상 system role로 전송 → API 거부 가능
```

### 8-4. Dual-Model Router 미전달

```typescript
// 서브에이전트는 architect/editor 패턴 사용 불가
// dualModelRouter가 runAgentLoop에 전달되지 않음
```

### 8-5. 비용 추적 미집계

```typescript
// 서브에이전트 토큰 사용량이 부모 세션에 합산되지 않음
// 격리된 이벤트로 인해 llm:usage 이벤트가 부모에 안 도달
```

---

## 8-A. CRITICAL — 중첩 서브에이전트 전파 실패 (추가 감사)

> subagent-deep-auditor 결과 (2026-03-20)

### 8-A-1. 도구 레지스트리 필터 상속 깨짐

**심각도: CRITICAL**

```typescript
// agent.ts:133 — 원본(미필터) 레지스트리를 전달
toolRegistry: deps.toolRegistry,  // ← 부모의 필터링 안 된 전체 레지스트리!

// 시나리오:
// 부모: allowed_tools=["file_read", "glob_search"] (필터링 적용)
// 중첩 서브에이전트: 부모의 필터가 아닌 원본 레지스트리 수신
// → file_write, bash_exec 등 위험 도구 접근 가능!
```

**수정:** `deps.toolRegistry` 대신 부모의 현재 필터링된 레지스트리를 전달해야 함.

### 8-A-2. Checkpoint Manager 미전달

**심각도: CRITICAL**

```typescript
// spawner.ts runAgentLoop 호출 (L923-939):
// ❌ MISSING: checkpointManager
// ❌ MISSING: sessionId

// 메인 에이전트 (useAgentLoop.ts):
// ✅ checkpointManager 전달
// ✅ sessionId 전달
```

**영향:** 서브에이전트의 파일 수정이 자동 체크포인트되지 않음. 트랜잭션 안전성 상실.

### 8-A-3. SubagentResult에 usage 필드 누락

**심각도: HIGH**

```typescript
// spawner.ts — SubagentResult 반환 시 usage 누락
return {
  agentId,
  type,
  response,
  iterations,
  aborted,
  messages,
  workingDirectory,
  sharedState,
  // ❌ MISSING: usage (result.usage 존재하지만 미포함)
};
```

**영향:** 서브에이전트 비용이 부모 세션에 합산되지 않아 비용 추적 불가.

### 8-A-4. 중첩 깊이 제한 없음

```
서브에이전트 → 서브에이전트 → 서브에이전트 → ...
각 5분 타임아웃이지만 명시적 깊이 제한 없음
무한 재귀 시 메모리/비용 폭발 가능
```

### 8-A-5. 중첩 서브에이전트 전파 매트릭스

| 항목                |    부모→자식    |    자식→손자     | 비고                          |
| ------------------- | :-------------: | :--------------: | ----------------------------- |
| model/client        |       ✅        |        ✅        | activeClient/activeModel 전달 |
| strategy            | ⚠️ 부모 것 상속 | ⚠️ 부모 것 상속  | 모델 변경 시 불일치           |
| toolRegistry        |    ✅ 필터링    |   ❌ 원본 상속   | **CRITICAL: 보안 우회**       |
| locale              |       ✅        | ❌ deps에만 있음 | 중첩 시 소실                  |
| projectInstructions |       ✅        | ❌ deps에만 있음 | 중첩 시 소실                  |
| checkpointManager   |       ❌        |        ❌        | 파일 안전성 상실              |
| checkPermission     |       ❌        |        ❌        | 권한 확인 없음                |
| thinking            |       ❌        |        ❌        | 항상 false                    |
| hookRunner          |       ❌        |        ❌        | 훅 미실행                     |
| dualModelRouter     |       ❌        |        ❌        | 단일 모델만                   |
| skills              | ⚠️ 필드만 존재  |        ❌        | 미구현                        |
| memory              | ⚠️ 필드만 존재  |        ❌        | 미구현                        |
| usage tracking      |       ❌        |        ❌        | 비용 미추적                   |

---

## 9. 전체 전파 스코어카드

| 카테고리                 | 전달/전체 |  비율   |  등급  |
| ------------------------ | :-------: | :-----: | :----: |
| **Strategy/Model**       |    2/7    |   29%   |   ❌   |
| **시스템 프롬프트 옵션** |   4/13    |   31%   |   ❌   |
| **보안/권한**            |    1/8    |   13%   |   ❌   |
| **이벤트/UI**            |    1/6    |   17%   |   ❌   |
| **ToolContext**          |    6/8    |   75%   |   ⚠️   |
| **LLM 설정**             |    3/7    |   43%   |   ❌   |
| **고급 기능**            |    0/6    |   0%    |   ❌   |
| **훅/MCP**               |    0/4    |   0%    |   ❌   |
| **총계**                 | **17/59** | **29%** | **❌** |

---

## 10. 수정 우선순위

### P0 — CRITICAL (즉시 수정)

| #      | 항목                         | 파일                                        | 수정 방법                                                  |
| ------ | ---------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| **S1** | Strategy 동적 재계산         | `useAgentLoop.ts`, `spawner.ts`, `agent.ts` | `selectStrategy(activeModel)` 호출 추가                    |
| **S2** | 서브에이전트 Strategy 재계산 | `spawner.ts:928`                            | `const effectiveStrategy = selectStrategy(effectiveModel)` |
| **S3** | 도구 레지스트리 필터 상속    | `agent.ts:133`                              | `deps.toolRegistry` → 부모의 필터링된 레지스트리 전달      |
| **S4** | checkpointManager 전달       | `spawner.ts:923`                            | runAgentLoop config에 추가 (파일 트랜잭션 안전성)          |

### P1 — HIGH (다음 스프린트)

| #      | 항목                         | 파일                                       | 수정 방법                                   |
| ------ | ---------------------------- | ------------------------------------------ | ------------------------------------------- |
| **H1** | tone 전달                    | `agent.ts`, `spawner.ts`, `index.ts`       | AgentToolDeps + SubagentConfig에 추가       |
| **H2** | checkPermission 전달         | `spawner.ts:923`                           | runAgentLoop config에 추가                  |
| **H3** | autoMemoryContent 전달       | `spawner.ts`                               | buildSubagentSystemPrompt 옵션에 추가       |
| **H4** | repoMapContent 전달          | `spawner.ts`                               | buildSubagentSystemPrompt 옵션에 추가       |
| **H5** | capabilityTier → ToolContext | `types.ts`, `agent-loop.ts`, `executor.ts` | ToolContext 필드 추가 + 전달                |
| **H6** | 이벤트 브릿지 (도구 진행)    | `spawner.ts`                               | 서브에이전트 events를 parentEvents로 포워딩 |

### P2 — MEDIUM (향후 개선)

| #      | 항목                     | 파일                          | 수정 방법                                   |
| ------ | ------------------------ | ----------------------------- | ------------------------------------------- |
| **M1** | hookRunner 전달          | `agent-loop.ts`, `spawner.ts` | AgentLoopConfig에 hookRunner 추가           |
| **M2** | Extended Thinking 전파   | `spawner.ts:508`              | 하드코딩 제거, 부모 설정 상속               |
| **M3** | temperature 조건부 전송  | `agent-loop.ts`               | `supportsTemperature` 체크 후 전송          |
| **M4** | developer role 적용      | `spawner.ts`                  | `useDeveloperRole` 체크 후 메시지 역할 변경 |
| **M5** | 비용 추적 집계           | `spawner.ts`                  | 서브에이전트 usage 이벤트를 부모에 전달     |
| **M6** | skillsPromptSection 전달 | `spawner.ts`                  | buildSubagentSystemPrompt 옵션에 추가       |
| **M7** | isHeadless 전달          | `spawner.ts`                  | buildSubagentSystemPrompt 옵션에 추가       |
| **M8** | dualModelRouter 전달     | `spawner.ts`                  | runAgentLoop config에 추가                  |
| **M9** | sessionId 전달           | `spawner.ts`                  | 체크포인트/감사 로그 연결                   |

### P3 — LOW (선택적)

| #      | 항목               | 수정 방법                                |
| ------ | ------------------ | ---------------------------------------- |
| **L1** | MCP 동적 도구 검색 | mcpConnector 전달                        |
| **L2** | voice 설정 전달    | 서브에이전트에서 음성 입력 불필요 (skip) |
| **L3** | UI 설정 전달       | 서브에이전트에 UI 없음 (skip)            |

---

## 11. 근본 원인 분석

### 설계 패턴의 문제

```
현재: Factory + Closure 패턴
  createAgentTool({ strategy, ... })  ← 시작 시 캡처, 변경 불가

필요: Dynamic Resolution 패턴
  execute() { selectStrategy(context.activeModel) }  ← 실행 시 해결
```

### 핵심 아키텍처 제약

1. **AgentToolDeps가 정적 클로저** — /model 전환 시 strategy, client 등이 갱신 안 됨
2. **SubagentConfig가 최소 인터페이스** — 부모의 풍부한 컨텍스트 중 일부만 수용
3. **buildSubagentSystemPrompt가 제한된 옵션** — buildSystemPrompt의 13개 중 6개만 전달
4. **runAgentLoop config가 불완전** — checkPermission, hookRunner, dualModelRouter 등 미포함
5. **이벤트 격리가 과도** — 보안상 격리 필요하지만 진행 상황은 전달 필요

---

## 12. 관련 파일 인덱스

| 파일                                | 역할                   | 주요 갭 라인                                          |
| ----------------------------------- | ---------------------- | ----------------------------------------------------- |
| `src/index.ts`                      | 앱 시작, 전파 시작점   | L327 (strategy 고정), L331-337 (deps 제한)            |
| `src/cli/hooks/useAgentLoop.ts`     | 메인 에이전트 루프     | L722-728 (/model 시 strategy 미갱신)                  |
| `src/tools/definitions/agent.ts`    | 에이전트 도구          | L132 (strategy 클로저), L127-143 (spawnSubagent 호출) |
| `src/subagents/spawner.ts`          | 서브에이전트 핵심      | L928 (strategy 상속), L923-939 (runAgentLoop 설정)    |
| `src/core/agent-loop.ts`            | 에이전트 루프          | L1060 (capabilityTier 미전달), L961 (checkPermission) |
| `src/core/system-prompt-builder.ts` | 프롬프트 빌더          | L194 (13개 옵션 중 6개만 수신)                        |
| `src/tools/types.ts`                | ToolContext 인터페이스 | capabilityTier 필드 없음                              |
| `src/tools/executor.ts`             | 도구 실행기            | L123 (capabilityTier 기본값 "high")                   |
| `src/utils/events.ts`               | 이벤트 시스템          | 23개 이벤트 타입 정의                                 |
| `src/subagents/agent-hooks.ts`      | 서브에이전트 훅        | 정의만 있고 실행 안 됨                                |

---

## 부록: 전파 체크리스트 (개발 시 참조)

새로운 설정/기능 추가 시 아래 체크리스트를 확인:

- [ ] `config/defaults.ts`에 기본값 설정
- [ ] `index.ts`에서 `createAgentTool` deps에 전달
- [ ] `AgentToolDeps` 인터페이스에 필드 추가
- [ ] `agent.ts` execute에서 `spawnSubagent`에 전달
- [ ] `SubagentConfig` 인터페이스에 필드 추가
- [ ] `spawnSubagent` 분해 + executeParams에 추가
- [ ] `executeSubagent` params 타입에 추가
- [ ] `buildSubagentSystemPrompt` 옵션에 추가 (프롬프트 관련)
- [ ] `runAgentLoop` config에 추가 (런타임 관련)
- [ ] `explore.ts` / `plan.ts` / `general.ts` 옵션에 추가
- [ ] 테스트에서 전파 검증 추가
