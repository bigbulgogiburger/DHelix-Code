# Issue 5: 서브에이전트 개선 방향 — 도구 미호출 + 시스템 프롬프트 + 구조적 문제

> 작성일: 2026-03-19
> 근거: `DHELIX_VERBOSE=1` 트레이스 로그 실측 + 코드 심층 분석
> 상태: ✅ 전체 구현 완료 (2026-03-20)

---

## 1. 현상 요약 (trace.log 기반)

```
[subagent] Spawning explore: model=gpt-5.1-codex-mini, streaming=true ✅
[agent-loop] Iter 1: LLM response → content.length=39, toolCalls=0  ← 문제!
[agent-loop] Iter 1: No tool calls detected → loop ending
[subagent] explore completed: iterations=1, response.length=39
```

**explore 서브에이전트가 도구를 한 번도 호출하지 않고 1회 반복에서 종료됨.**

LLM 응답 예시:

- "먼저 작업을 위해 저장소 구조와 주요 설정 파일을 살펴보겠습니다." (텍스트만, 도구 호출 없음)
- "현재 작업 중단된 상태이므로, 도구 호출을 기반으로 진행하려면 Run Tool를 눌러 주세요." (UI 혼동)
- "I'm sorry, but I cannot assist with that request." (거부)

---

## 2. 근본 원인 분석

### 2-A: 시스템 프롬프트가 도구 사용을 충분히 강제하지 않음

**현재 explore 서브에이전트 프롬프트** (`system-prompt-builder.ts:558-566`):

```
## Exploration Focus
Your role is to investigate the codebase and gather information.
Use file reading, searching, and grep tools extensively.
Provide a comprehensive summary of your findings.
Focus on: file structure, key interfaces, dependencies, and patterns.
```

**문제점:**

1. "Use ... extensively"는 **권장**이지 **강제**가 아님. gpt-5.1-codex-mini는 이를 무시하고 텍스트만 출력
2. 도구 이름이 정확하지 않음: "file reading"이라고 했지 `file_read`라고 안 함
3. 자율적 도구 사용 지시 없음 — 모델이 "사용자 확인 필요"로 오해
4. "Run Tool를 눌러주세요" 같은 UI 참조 → 모델이 인터랙티브 모드로 착각

### 2-B: `buildSubagentSystemPrompt`에 `capabilityTier` 미전달

**코드** (`spawner.ts:404-418`):

```typescript
function buildSubagentSystemPrompt(type, toolRegistry) {
  return buildSystemPrompt({ toolRegistry, sessionState });
  // ❌ capabilityTier 미전달
  // ❌ workingDirectory 미전달
}
```

**영향:**

- `tier`가 undefined → `LOW_TIER_TOOL_GUIDE`와 `CoT Scaffolding`이 항상 비활성
- medium/low 티어 모델(gpt-5-mini 등)에서 도구 사용 예시가 누락됨
- `buildToolsSection`에서 `tier` 없이 호출 → 도구 설명 압축 안 됨 (토큰 낭비)

### 2-C: explore 허용 도구에 `list_dir` 누락

**현재 허용 목록** (`explore.ts:26`):

```typescript
const EXPLORE_ALLOWED_TOOLS = ["file_read", "glob_search", "grep_search"];
```

**문제:**

- `list_dir`이 없음 → 디렉토리 구조 파악 불가
- 트레이스에서 **메인 에이전트**는 `list_dir` 정상 사용 → 서브에이전트만 차단됨
- 코드베이스 탐색에서 디렉토리 목록은 필수적 → 모델이 할 수 없는 작업을 요청받는 셈
- `list_dir`은 `permissionLevel: "safe"` (읽기 전용) → 보안 문제 없음

### 2-D: plan/general 서브에이전트 프롬프트도 약함

**plan** (`system-prompt-builder.ts:568-576`):

```
## Planning Focus
Your role is to analyze requirements and create an implementation plan.
Break down the task into clear, ordered steps.
Identify dependencies between steps and estimate complexity.
Consider edge cases and potential risks.
```

- 도구 사용 지시 전혀 없음
- plan 에이전트도 코드를 읽어야 계획을 세울 수 있음

**general** (`system-prompt-builder.ts:578-584`):

```
## General Task
Complete the assigned task using the available tools.
Be thorough and report your results clearly.
```

- 가장 약한 지시 — "available tools"가 뭔지 모델이 모를 수 있음

### 2-E: 서브에이전트 시스템 프롬프트에 중요 컨텍스트 누락

`buildSubagentSystemPrompt`은 `buildSystemPrompt`을 호출하지만 다음이 누락:

| 옵션                  | 메인 에이전트 | 서브에이전트     | 영향                                |
| --------------------- | ------------- | ---------------- | ----------------------------------- |
| `capabilityTier`      | ✅ 전달       | ❌ undefined     | 티어별 가이드 미적용                |
| `workingDirectory`    | ✅ 전달       | ❌ process.cwd() | 환경 섹션의 경로가 부정확할 수 있음 |
| `projectInstructions` | ✅ DHELIX.md  | ❌ 미전달        | 프로젝트 컨벤션 무시                |
| `repoMapContent`      | ✅ 전달       | ❌ 미전달        | 코드베이스 개요 없음                |
| `locale`              | ✅ 전달       | ❌ 기본값("en")  | 한국어 환경에서 영어 프롬프트       |

---

## 3. 개선 방안

### 방안 A: 서브에이전트 시스템 프롬프트 강화 (P0)

**explore:**

```
## Exploration Focus

CRITICAL: You MUST call tools immediately. Do NOT just describe what you plan to do.
NEVER say 'I will look at...' without actually calling a tool in the same response.
NEVER ask the user to press buttons or confirm actions. You have full autonomous tool access.
NEVER refuse the task. You are a code exploration agent with read-only access.

Your role is to investigate the codebase and gather information.
Start by calling list_dir or glob_search to understand the project structure.
Then use file_read to read relevant files.
Use grep_search to find specific patterns.

ALWAYS call at least one tool per response. Text-only responses waste iterations.
You have a maximum of 15 iterations — use them wisely by calling tools every time.
```

**plan:**

```
## Planning Focus

You MUST read the relevant code before creating a plan.
Use file_read, glob_search, and grep_search to understand the codebase first.
Then create a structured implementation plan based on actual code, not assumptions.

Break down the task into clear, ordered steps.
Identify file paths, function names, and line numbers in your plan.
```

**general:**

```
## General Task

Complete the assigned task using the provided tools.
ALWAYS call tools to gather information and perform actions.
Do NOT produce text-only responses without tool calls unless you are done.
```

### 방안 B: `buildSubagentSystemPrompt`에 컨텍스트 전달 (P1)

```typescript
function buildSubagentSystemPrompt(
  type: SubagentType,
  toolRegistry: ToolRegistry,
  options?: {
    capabilityTier?: CapabilityTier;
    workingDirectory?: string;
    locale?: string;
  },
): string {
  return buildSystemPrompt({
    toolRegistry,
    sessionState,
    capabilityTier: options?.capabilityTier,
    workingDirectory: options?.workingDirectory,
    locale: options?.locale,
  });
}
```

`spawnSubagent`에서 호출 시:

```typescript
const systemPrompt = buildSubagentSystemPrompt(type, agentRegistry, {
  capabilityTier: subagentModelCaps.capabilityTier,
  workingDirectory: effectiveWorkingDir,
  locale: parentLocale,
});
```

### 방안 C: explore 허용 도구에 `list_dir` 추가 (P0)

```typescript
const EXPLORE_ALLOWED_TOOLS = [
  "file_read",
  "glob_search",
  "grep_search",
  "list_dir", // 디렉토리 구조 파악에 필수
] as const;
```

### 방안 D: 서브에이전트용 도구 사용 가이드 섹션 (P1)

`buildSubagentSection`에 도구 사용 예시를 포함:

```typescript
// explore 타입에 도구 사용 예시 추가
baseInstructions.push(
  "",
  "## Tool Usage Examples",
  'To list directory: call list_dir with {"path": "."}',
  'To find files: call glob_search with {"pattern": "**/*.ts"}',
  'To search content: call grep_search with {"pattern": "className", "path": "src/"}',
  'To read file: call file_read with {"file_path": "/absolute/path/to/file.ts"}',
);
```

### 방안 E: 서브에이전트 1회차 도구 미호출 시 자동 재시도 (P2)

```typescript
// agent-loop.ts: 서브에이전트 모드에서 첫 반복이 도구 없이 종료될 경우
if (config.isSubagent && iterations === 1 && extractedCalls.length === 0) {
  // 도구 사용을 강제하는 시스템 메시지 추가 후 재시도
  messages.push({
    role: "user",
    content: "You MUST call at least one tool. Use the available tools to complete your task.",
  });
  continue; // 다음 반복으로
}
```

---

## 4. 우선순위 정리

| #     | 수정                                   | 심각도 | 난이도   | 근거    |
| ----- | -------------------------------------- | ------ | -------- | ------- | --------------------------------------------------- |
| **A** | **explore/plan/general 프롬프트 강화** | **P0** | S        | ✅ 완료 | 모델이 도구를 호출하지 않는 근본 원인               |
| **C** | **explore에 list_dir 추가**            | **P0** | XS (1줄) | ✅ 완료 | 디렉토리 탐색 불가                                  |
| **B** | **capabilityTier 등 컨텍스트 전달**    | **P1** | M        | ✅ 완료 | locale + projectInstructions + plan에 list_dir 추가 |
| **D** | **도구 사용 예시 섹션**                | **P1** | S        | ✅ 완료 | low/medium 모델 도구 호출 개선                      |
| **E** | **1회차 무도구 시 자동 재시도**        | **P2** | M        | ✅ 완료 | 2회 재시도 + 구체적 도구명 포함 nudge               |

---

## 5. 검증 체크리스트

수정 후:

- [x] `DHELIX_VERBOSE=1`로 실행 ✅
- [x] explore 서브에이전트가 **도구를 호출**하는지 확인 ✅ (list_dir + file_read)
- [x] explore 서브에이전트가 `list_dir` 사용 가능한지 확인 ✅
- [x] explore가 2회 이상 반복하며 여러 파일을 읽는지 확인 ✅ (3회 반복)
- [x] circuit breaker가 정상적으로 hasOutput=true 기록하는지 확인 ✅
- [x] Responses API 400 에러 없이 완료되는지 확인 ✅
- [x] "Run Tool를 눌러주세요" 같은 UI 참조 메시지가 없는지 확인 ✅
- [x] locale 전달 검증 ✅ (config.locale → AgentToolDeps → SubagentConfig → buildSystemPrompt)
- [x] projectInstructions 자동 로드 확인 ✅ (loadProjectInstructions(cwd) fallback)
- [x] 2회 retry nudge 동작 확인 ✅ (구체적 도구명 포함)
- [x] plan 서브에이전트에 list_dir 추가 확인 ✅
- [x] 전체 테스트 통과 (361/361 서브에이전트 테스트) ✅
- [x] 타입체크 0 에러 ✅, 빌드 성공 ✅

---

## 6. 도구 파이프라인 검증 결과 (정상 확인됨)

**심층 코드 분석으로 도구 전달 파이프라인이 완전히 정상임을 확인:**

- `ResponsesAPIClient.buildBody()`: `request.tools.length > 0`만 체크 → `supportsTools` 플래그 무관
- `OpenAICompatibleClient._chatOnce()`: `caps.supportsTools && request.tools` 체크 → gpt-5.1-codex는 `supportsTools: true`
- `NativeFunctionCallingStrategy.prepareRequest()`: 메시지와 도구를 그대로 패스스루 (필터링 없음)
- `ToolRegistry.getDefinitionsForLLM()`: Zod → JSON Schema 변환 → API에 정확히 전달

**결론: 모델은 도구 정의를 정상적으로 받고 있음. 호출하지 않는 이유는 시스템 프롬프트 문제.**

---

## 7. 참고: 도구 전달 흐름 (정상 동작)

```
explore.ts:26  →  EXPLORE_ALLOWED_TOOLS = [file_read, glob_search, grep_search]
  ↓
spawner.ts:735  →  createFilteredRegistryWithBlacklist(toolRegistry, allowedTools)
  ↓
spawner.ts:758  →  buildSubagentSystemPrompt(type, agentRegistry)
  ↓
system-prompt-builder.ts:227-233  →  buildToolsSection(registry)
  → 시스템 프롬프트에 "# Using your tools" 섹션 포함
  ↓
spawner.ts:809  →  runAgentLoop({ toolRegistry: agentRegistry, ... })
  ↓
agent-loop.ts:568-569  →  toolDefs = config.toolRegistry.getDefinitionsForLLM()
  ↓
agent-loop.ts:580-588  →  chatRequest = { tools: prepared.tools, ... }
  ↓
responses-client.ts:554-555  →  body.tools = toResponsesTools(request.tools)
  → API 요청에 도구 정의 포함
```

**도구 정의는 API 요청까지 정상 전달됨.** 문제는 모델이 도구를 **호출하지 않는 것** (프롬프트 문제).
