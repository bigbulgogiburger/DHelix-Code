# Sprint 2: UX 완성 (UX Completion)

> **Version**: 1.0
> **Date**: 2026-03-14
> **Base**: Sprint 1 완료 — 3390 tests / 0 TS errors / 20 files changed
> **Scope**: I3 Syntax Highlighting + I2 Rich Markdown + C3 Tool Result Streaming + I4 Thinking Auto-Budget

---

## 목차

1. [Sprint 2 범위 선정](#sprint-2-범위-선정)
2. [기존 인프라 현황](#기존-인프라-현황)
3. [I3. Syntax Highlighting](#i3-syntax-highlighting)
4. [I2. Rich Markdown Rendering](#i2-rich-markdown-rendering)
5. [C3. Tool Result Streaming](#c3-tool-result-streaming)
6. [I4. Extended Thinking Auto-Budget](#i4-extended-thinking-auto-budget)
7. [구현 순서 및 일정](#구현-순서-및-일정)
8. [검증 기준](#검증-기준)
9. [리스크](#리스크)

---

## Sprint 2 범위 선정

dbcode_develop_v2.md 로드맵에서 남은 격차:

| # | 기능 | 현재 구현률 | 복잡도 | Sprint 2 포함? |
|---|------|-----------|--------|---------------|
| **I3** | Syntax Highlighting | 90% (Shiki 통합됨, 미연결) | **낮음** | ✅ |
| **I2** | Rich Markdown Rendering | 70% (marked/marked-terminal 설치됨) | **낮-중** | ✅ |
| **C3** | Tool Result Streaming | 10% (BackgroundProcessManager 존재) | **중-높** | ✅ |
| **I4** | Thinking Auto-Budget | 30% (토글 존재, 미사용 dead code) | **중** | ✅ |
| I5 | Plan Mode Auto-Execution | 10% (토글만 존재) | 높 | ❌ Sprint 3으로 연기 |
| C4 | SSE Transport for MCP | 0% | 중 | ❌ Sprint 3으로 연기 |
| I1 | Worktree Isolation | 0% | 높 | ❌ Sprint 3으로 연기 |

**I5 연기 사유**: Agent loop 아키텍처 변경이 필요 (plan → 실행 2단계 분리). 현재 구조에서는 "도구 실행을 차단하고 계획만 수집 → 사용자 승인 → 재실행" 흐름을 지원하지 않음.

---

## 기존 인프라 현황

Sprint 1과 마찬가지로, **이미 구현되어 있으나 미연결된 인프라**가 상당함:

### I3 — Shiki 하이라이터 (90% 구현됨)

| 파일 | 상태 | 내용 |
|------|------|------|
| `src/cli/renderer/syntax.ts` | ✅ 구현됨, ❌ 미사용 | `highlightCode(code, lang, theme)`, 20+ 언어 지원, ANSI RGB 출력 |
| `src/config/schema.ts` | ✅ 설정 존재 | `syntaxHighlighting: z.boolean().default(true)` |

**미연결 지점**: `StreamingMessage.tsx`와 `ToolCallBlock.tsx`에서 코드 블록을 추출할 때 `highlightCode()`를 호출하지 않음.

### I4 — Thinking 토글 (Dead Code)

| 파일 | 상태 | 내용 |
|------|------|------|
| `src/cli/App.tsx` | ✅ `thinkingEnabled` state | Alt+T로 토글, 알림 표시 |
| `src/cli/components/ThinkingBlock.tsx` | ✅ 구현됨 | 접이식 thinking 내용 + 토큰 카운트 |
| `src/llm/provider.ts` | ✅ `ThinkingConfig` 인터페이스 | `{ type: "enabled", budget_tokens: number }` |
| `src/llm/providers/anthropic.ts` | ✅ thinking 스트리밍 | `thinking-delta` 청크 처리 |

**문제**: `thinkingEnabled`가 `true`여도 **LLM 요청에 thinking config가 전달되지 않음**. 완전한 dead code.

### C3 — BackgroundProcessManager (부분 존재)

| 파일 | 상태 | 내용 |
|------|------|------|
| `src/tools/executor.ts` | ✅ `BackgroundProcessManager` | `getIncrementalOutput()` — 증분 출력 읽기 |
| `src/tools/definitions/bash-output.ts` | ✅ `bash_output` 도구 | 백그라운드 프로세스 출력 조회 |

**문제**: 포그라운드 bash 실행은 모든 출력을 메모리에 모은 후 한 번에 반환. 실행 중 진행 표시 없음.

---

## I3. Syntax Highlighting

### 문제

코드 블록이 터미널에서 일반 텍스트로 렌더링됨. 언어별 구문 강조 없음.

### 현재 아키텍처

```
Assistant text → useTextBuffering (100ms) → StreamingMessage
                                              ↓
                                       partialRenderMarkdown()
                                              ↓
                                       marked + marked-terminal
                                              ↓
                                       터미널 출력 (구문 강조 없음)
```

### 목표 아키텍처

```
Assistant text → useTextBuffering (100ms) → StreamingMessage
                                              ↓
                                       partialRenderMarkdown()
                                              ↓
                                       marked + marked-terminal
                                              ↓
                                       코드 블록 감지 → highlightCode()
                                              ↓
                                       터미널 출력 (구문 강조 적용)
```

### 구현 계획

#### A. marked-terminal에 Shiki 하이라이터 연결

**파일: `src/cli/renderer/markdown.ts`**

`marked-terminal` 옵션에 `code` 커스텀 렌더러를 추가:

```typescript
import { highlightCode, isLanguageSupported } from "./syntax.js";

const renderer = new TerminalRenderer({
  // 기존 옵션 유지
  reflowText: true,
  width: process.stdout.columns || 80,
  showSectionPrefix: false,
  // 신규: 코드 블록에 Shiki 하이라이팅 적용
  code: (code: string, language?: string) => {
    if (language && isLanguageSupported(language)) {
      // highlightCode는 async — 동기 렌더링에서는 캐시된 결과 사용
      return highlightCodeSync(code, language);
    }
    return code; // fallback: 일반 텍스트
  },
});
```

**문제**: `highlightCode()`가 async (Shiki 초기화). 해결:
- 첫 렌더링 시 Shiki를 warm-up (`initHighlighter()` 호출)
- 이후 동기 버전 `highlightCodeSync()` 추가 (캐시된 highlighter 사용)

**파일: `src/cli/renderer/syntax.ts` — 동기 API 추가**

```typescript
/** Synchronous highlight — only works after highlighter is initialized */
export function highlightCodeSync(code: string, language: string): string {
  if (!highlighterInstance) return code; // fallback
  // ... 기존 colorize 로직
}

/** Pre-warm the highlighter (call at startup) */
export async function initHighlighter(): Promise<void> {
  await getHighlighter(); // lazy singleton 초기화
}
```

#### B. 도구 출력에도 하이라이팅 적용

**파일: `src/cli/components/ToolCallBlock.tsx`**

bash_exec 출력이 JSON이나 코드일 경우 자동 감지하여 하이라이팅:

```typescript
function detectLanguage(output: string): string | undefined {
  const trimmed = output.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<html")) return "html";
  return undefined;
}
```

#### C. Startup에서 Shiki warm-up

**파일: `src/index.ts`**

```typescript
// App 렌더 전에 비동기 초기화
void initHighlighter();
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/cli/renderer/markdown.ts` | code 렌더러 추가 | ~15줄 |
| `src/cli/renderer/syntax.ts` | `highlightCodeSync()`, `initHighlighter()` 추가 | ~20줄 |
| `src/cli/components/ToolCallBlock.tsx` | JSON 감지 + 하이라이팅 | ~15줄 |
| `src/index.ts` | warm-up 호출 | +1줄 |
| 테스트 | 신규 | ~50줄 |

---

## I2. Rich Markdown Rendering

### 문제

`marked-terminal`이 설치되어 있지만 기본 설정만 사용. 테이블, 링크, 수평선 등이 최적화되지 않음.

### 구현 계획

#### A. marked-terminal 옵션 강화

**파일: `src/cli/renderer/markdown.ts`**

```typescript
const renderer = new TerminalRenderer({
  reflowText: true,
  width: process.stdout.columns || 80,
  showSectionPrefix: false,
  // 신규 옵션:
  tab: 2,                    // 들여쓰기 폭
  unescape: true,            // HTML entities 해석
  tableOptions: {             // 테이블 스타일
    chars: { top: "─", "top-mid": "┬", "top-left": "┌", "top-right": "┐",
             bottom: "─", "bottom-mid": "┴", "bottom-left": "└", "bottom-right": "┘",
             left: "│", "left-mid": "├", mid: "─", "mid-mid": "┼",
             right: "│", "right-mid": "┤", middle: "│" },
    style: { head: ["cyan", "bold"] },
  },
});
```

#### B. OSC 8 하이퍼링크 (클릭 가능한 URL)

터미널이 지원하면 URL을 클릭 가능하게 렌더링:

```typescript
/** Wrap URL with OSC 8 hyperlink escape sequence */
function osc8Link(url: string, text?: string): string {
  const label = text || url;
  return `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;
}
```

`marked-terminal`의 `link` 렌더러에 적용:

```typescript
link: (href: string, _title: string | null, text: string) => {
  return osc8Link(href, text);
},
```

#### C. 파일 경로 자동 링크

`file_path:line_number` 패턴을 감지하여 클릭 가능하게:

```typescript
// 예: src/tools/registry.ts:45 → 클릭 시 에디터에서 열기
const FILE_PATH_PATTERN = /(\S+\.\w+):(\d+)/g;
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/cli/renderer/markdown.ts` | 옵션 강화 + OSC 8 + 파일 링크 | ~40줄 |
| 테스트 | 신규 | ~30줄 |

---

## C3. Tool Result Streaming

### 문제

`bash_exec`로 `npm test` 같은 긴 명령 실행 시, 완료될 때까지 **아무 출력도 보이지 않음**.
사용자는 "멈춘 건지 실행 중인지" 알 수 없음.

### 현재 흐름 (문제)

```
bash_exec("npm test") → spawn → [30초 대기, 출력 없음] → 전체 결과 한 번에 표시
```

### 목표 흐름

```
bash_exec("npm test") → spawn → [stdout 줄 단위 스트리밍 → UI 실시간 표시] → 완료
```

### 구현 계획

#### A. ToolResult에 스트리밍 지원 추가

**파일: `src/tools/types.ts`**

```typescript
export interface ToolResult {
  readonly output: string;
  readonly isError: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Optional: stream output lines as they arrive (for long-running tools) */
  readonly outputStream?: AsyncIterable<string>;
}
```

#### B. bash-exec에 스트리밍 모드 추가

**파일: `src/tools/definitions/bash-exec.ts`**

```typescript
// 기존 execute() 유지 (하위 호환)
// 신규: executeWithStream() — 청크 단위 출력

async *streamOutput(command: string, signal?: AbortSignal): AsyncIterable<string> {
  const proc = spawn(command, { shell: true, signal });
  const decoder = new TextDecoder();

  for await (const chunk of proc.stdout) {
    yield decoder.decode(chunk, { stream: true });
  }

  // stderr도 수집
  for await (const chunk of proc.stderr) {
    yield decoder.decode(chunk, { stream: true });
  }
}
```

execute 함수 내에서 `outputStream`을 반환:

```typescript
return {
  output: finalOutput,
  isError: exitCode !== 0,
  outputStream: streamChunks(proc),  // AsyncIterable<string>
};
```

#### C. Agent Loop에서 스트리밍 출력 이벤트 전파

**파일: `src/core/agent-loop.ts`**

도구 실행 시 `outputStream`이 있으면 이벤트 발생:

```typescript
const result = await executeToolCall(tool, call, context);

// Stream tool output if available
if (result.outputStream) {
  for await (const chunk of result.outputStream) {
    config.events.emit("tool:output-delta", { id: call.id, name: call.name, chunk });
  }
}
```

**파일: `src/utils/events.ts` — 이벤트 타입 추가**

```typescript
"tool:output-delta": { id: string; name: string; chunk: string };
```

#### D. ToolCallBlock에서 스트리밍 출력 렌더링

**파일: `src/cli/components/ToolCallBlock.tsx`**

실행 중인 도구의 출력을 점진적으로 표시:

```typescript
// 이벤트 리슨:
events.on("tool:output-delta", ({ id, chunk }) => {
  if (id === toolCallId) {
    setStreamingOutput(prev => prev + chunk);
  }
});
```

마지막 10줄만 표시하여 화면 과부하 방지:

```typescript
const lastLines = streamingOutput.split("\n").slice(-10).join("\n");
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/tools/types.ts` | `outputStream` 필드 추가 | +3줄 |
| `src/tools/definitions/bash-exec.ts` | 스트리밍 모드 | ~40줄 |
| `src/core/agent-loop.ts` | 스트리밍 이벤트 전파 | ~15줄 |
| `src/utils/events.ts` | `tool:output-delta` 이벤트 | +1줄 |
| `src/cli/components/ToolCallBlock.tsx` | 스트리밍 출력 렌더링 | ~30줄 |
| `src/cli/hooks/useAgentLoop.ts` | 이벤트 리스너 | ~10줄 |
| 테스트 | 신규 + 수정 | ~100줄 |

### 제약사항

- **Agent loop은 도구 결과를 기다린 후 LLM에 전달**하므로, 스트리밍은 **UI 표시용**이지 LLM 응답 흐름에는 영향 없음
- 최종 `output` 필드는 기존과 동일하게 전체 결과 포함 (하위 호환)
- 스트리밍은 bash_exec에만 적용 (file_read 등은 이미 빠름)

---

## I4. Extended Thinking Auto-Budget

### 문제

1. `thinkingEnabled` 상태가 LLM 요청에 **전혀 전달되지 않음** (dead code)
2. 수동 토글만 가능, 모델별 자동 예산 조절 없음
3. Claude가 아닌 모델에서 thinking을 켜면 에러 발생 가능

### 현재 Dead Code 흐름

```
Alt+T → setThinkingEnabled(true) → 알림 "Extended thinking: ON"
                                     ↓
                               (상태가 어디에도 전달되지 않음)
                                     ↓
                               LLM 요청: thinking 파라미터 없음
```

### 목표 흐름

```
Alt+T → setThinkingEnabled(true) → 모델 체크: supportsThinking?
                                     ↓ yes
                               자동 예산 계산: min(contextWindow * 5%, 16384)
                                     ↓
                               LLM 요청: thinking: { type: "enabled", budget_tokens: N }
                                     ↓
                               ThinkingBlock 렌더링 (기존 구현 활용)
```

### 구현 계획

#### A. ModelCapabilities에 thinking 필드 추가

**파일: `src/llm/model-capabilities.ts`**

```typescript
export interface ModelCapabilities {
  // 기존 필드 유지...
  /** Whether the model supports extended thinking */
  readonly supportsThinking: boolean;
  /** Default thinking budget tokens (0 = auto-calculate) */
  readonly defaultThinkingBudget: number;
}
```

DEFAULTS:
```typescript
supportsThinking: false,
defaultThinkingBudget: 0,
```

Claude 모델 오버라이드:
```typescript
// claude-opus-4: supportsThinking: true, defaultThinkingBudget: 16384
// claude-sonnet-4: supportsThinking: true, defaultThinkingBudget: 10000
// claude-haiku-4: supportsThinking: true, defaultThinkingBudget: 5000
```

#### B. Thinking 예산 자동 계산

**파일: `src/llm/thinking-budget.ts` (신규)**

```typescript
/** Calculate thinking budget based on model capabilities and context usage */
export function calculateThinkingBudget(
  caps: ModelCapabilities,
  contextUsagePercent: number,
): number {
  if (!caps.supportsThinking) return 0;
  if (caps.defaultThinkingBudget > 0) return caps.defaultThinkingBudget;

  // Auto: 5% of max context, capped at 16384, reduced when context is full
  const base = Math.min(Math.floor(caps.maxContextTokens * 0.05), 16384);
  const scaleFactor = contextUsagePercent > 70 ? 0.5 : 1.0; // 컨텍스트 70% 이상이면 절반
  return Math.max(1024, Math.floor(base * scaleFactor));
}
```

#### C. thinkingEnabled → LLM 요청 배선

**파일: `src/cli/hooks/useAgentLoop.ts`**

`thinkingEnabled`를 useAgentLoop에 전달하고 ChatRequest에 포함:

```typescript
// UseAgentLoopOptions에 추가:
readonly thinkingEnabled?: boolean;

// processMessage 내에서:
const thinkingConfig = thinkingEnabled && modelCaps.supportsThinking
  ? { type: "enabled" as const, budget_tokens: calculateThinkingBudget(modelCaps, contextUsage) }
  : undefined;

// runAgentLoop config에 추가:
thinking: thinkingConfig,
```

**파일: `src/core/agent-loop.ts`**

`AgentLoopConfig`에 `thinking` 필드 추가 → `chatRequest`에 전달:

```typescript
const chatRequest = {
  model: config.model,
  messages: prepared.messages,
  tools: prepared.tools,
  temperature: config.temperature ?? 0,
  maxTokens: config.maxTokens ?? 4096,
  signal: config.signal,
  thinking: config.thinking,  // 신규
};
```

#### D. App.tsx → useAgentLoop 배선

```typescript
// App.tsx에서:
} = useAgentLoop({
  // 기존 props...
  thinkingEnabled,  // 추가
});
```

### 영향 범위

| 파일 | 변경 | 규모 |
|------|------|------|
| `src/llm/model-capabilities.ts` | `supportsThinking`, `defaultThinkingBudget` | +15줄 |
| `src/llm/thinking-budget.ts` | **신규** — 예산 자동 계산 | ~30줄 |
| `src/core/agent-loop.ts` | `thinking` config 전달 | +5줄 |
| `src/cli/hooks/useAgentLoop.ts` | thinking 배선 | +10줄 |
| `src/cli/App.tsx` | thinkingEnabled 전달 | +1줄 |
| 테스트 | 신규 | ~60줄 |

---

## 구현 순서 및 일정

### 에이전트 병렬화 계획

```
Agent 1: "syntax-markdown"    → I3 + I2 (파일 겹침: markdown.ts, syntax.ts)
Agent 2: "tool-streaming"     → C3 (독립: bash-exec.ts, ToolCallBlock.tsx, events.ts)
Agent 3: "thinking-wiring"    → I4 (독립: model-capabilities.ts, thinking-budget.ts, agent-loop.ts)
```

### 파일 충돌 분석

```
Agent 1 (syntax-markdown):
  src/cli/renderer/markdown.ts       ← 독점
  src/cli/renderer/syntax.ts         ← 독점
  src/cli/components/ToolCallBlock.tsx ← Agent 2와 공유 ⚠️

Agent 2 (tool-streaming):
  src/tools/types.ts                 ← 독점
  src/tools/definitions/bash-exec.ts ← 독점
  src/core/agent-loop.ts             ← Agent 3와 공유 ⚠️
  src/cli/components/ToolCallBlock.tsx ← Agent 1과 공유 ⚠️
  src/utils/events.ts                ← 독점

Agent 3 (thinking-wiring):
  src/llm/model-capabilities.ts      ← 독점
  src/llm/thinking-budget.ts         ← 독점 (신규)
  src/core/agent-loop.ts             ← Agent 2와 공유 ⚠️
  src/cli/hooks/useAgentLoop.ts      ← 독점
  src/cli/App.tsx                    ← 독점
```

**충돌 해결 전략:**
- `ToolCallBlock.tsx`: Agent 1이 하이라이팅, Agent 2가 스트리밍 — 다른 함수이므로 순차 적용 가능
- `agent-loop.ts`: Agent 2가 스트리밍 이벤트, Agent 3가 thinking config — 다른 위치이므로 순차 적용 가능
- **순서**: Agent 1 + Agent 3 병렬 → Agent 2 순차 (공유 파일 정리 후)

### 일정

```
Day 1    │  Agent 1 (I3+I2) + Agent 3 (I4) 병렬 실행
Day 2    │  Agent 2 (C3) 실행 (Agent 1/3 완료 후)
Day 3    │  통합 검증 + 충돌 해결 + 테스트
Day 4    │  벤치마크 + 커밋
```

**총 예상: 4일**

---

## 검증 기준

### 기능 검증

**I3 Syntax Highlighting:**
- [ ] TypeScript 코드 블록이 구문 강조되어 표시됨
- [ ] 미지원 언어는 일반 텍스트로 fallback
- [ ] JSON 도구 출력이 자동 감지 + 하이라이팅됨
- [ ] `syntaxHighlighting: false` 설정 시 비활성화

**I2 Rich Markdown:**
- [ ] 마크다운 테이블이 박스 문자로 정렬 표시됨
- [ ] URL이 OSC 8 하이퍼링크로 클릭 가능
- [ ] 코드 블록, 헤더, 볼드, 이탤릭 정상 렌더링

**C3 Tool Result Streaming:**
- [ ] `npm test` 같은 긴 명령 실행 시 출력이 줄 단위로 표시됨
- [ ] 마지막 10줄만 화면에 유지 (화면 과부하 방지)
- [ ] 완료 후 전체 결과가 기존과 동일하게 ToolCallBlock에 표시
- [ ] 스트리밍은 UI 표시용이며 LLM 응답 흐름에 영향 없음

**I4 Thinking Auto-Budget:**
- [ ] Alt+T 토글 시 Claude 모델에 thinking 파라미터가 LLM 요청에 포함됨
- [ ] 비-Claude 모델에서 Alt+T 시 "이 모델은 thinking을 지원하지 않습니다" 알림
- [ ] 컨텍스트 70% 이상 사용 시 thinking 예산 자동 축소
- [ ] ThinkingBlock이 정상 렌더링됨 (기존 구현)

### 회귀 방지

- [ ] 기존 3390개 테스트 전부 통과
- [ ] TypeScript 에러 0개
- [ ] 빌드 성공

---

## 리스크

| 리스크 | 확률 | 영향 | 완화 |
|--------|------|------|------|
| Shiki 초기화 지연 (첫 하이라이팅 ~200ms) | 중 | 낮 | startup warm-up + 동기 fallback |
| 터미널 OSC 8 미지원 (일부 터미널) | 중 | 낮 | 미지원 시 URL 텍스트만 표시 (graceful degradation) |
| bash 스트리밍이 기존 도구 결과 타입과 호환 안 됨 | 낮 | 중 | `outputStream` 옵셔널 필드로 하위 호환 |
| Thinking budget이 모델별로 최적값 다름 | 중 | 낮 | defaultThinkingBudget으로 모델별 기본값 설정 |
| agent-loop.ts 공유 파일 충돌 | 중 | 중 | Agent 2/3 순차 적용 + 통합 에이전트 정리 |

---

## Sprint 2 이후 남은 작업

Sprint 2 완료 시 dbcode vs Claude Code 격차:

| 격차 | Sprint 2 후 상태 |
|------|-----------------|
| I3 Syntax Highlighting | ✅ 해소 |
| I2 Rich Markdown | ✅ 해소 |
| C3 Tool Result Streaming | ✅ 해소 |
| I4 Thinking Auto-Budget | ✅ 해소 |
| I5 Plan Mode Auto-Execution | 🟡 Sprint 3 |
| C4 SSE Transport for MCP | 🟡 Sprint 3 |
| I1 Worktree Isolation | 🟡 Sprint 3 |
| I6 OAuth/SSO 인증 | 🟡 Sprint 4 |

**Sprint 2 완료 시 dbcode의 UX 격차가 사실상 해소**됩니다. 남은 항목은 고급 기능(Plan 자동 실행, SSE MCP, Worktree)으로, 핵심 사용성에는 큰 영향이 없습니다.
