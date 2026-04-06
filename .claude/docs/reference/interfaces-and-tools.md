# Interfaces & Tools

> 참조 시점: Tool 추가/수정, LLM provider 연동, tool-call strategy 변경 시

## Key Interfaces

```typescript
// Tool definition (src/tools/types.ts)
interface ToolDefinition<TParams = unknown> {
  readonly name: string;
  readonly description: string;
  readonly parameterSchema: z.ZodSchema<TParams>;
  readonly permissionLevel: "safe" | "confirm" | "dangerous";
  readonly execute: (params: TParams, context: ToolContext) => Promise<ToolResult>;
}

// LLM Provider (src/llm/provider.ts)
interface LLMProvider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  countTokens(text: string): number;
}

// Dual tool-call strategy (src/llm/tool-call-strategy.ts)
interface ToolCallStrategy {
  readonly name: "native" | "text-parsing";
  prepareRequest(messages: ChatMessage[], tools: ToolDefinition[]): LLMRequest;
  extractToolCalls(response: LLMResponse): ExtractedToolCall[];
  formatToolResults(results: ToolCallResult[]): ChatMessage[];
}
```

## Built-in Tools (16)

| Tool          | Permission | Description                                               |
| ------------- | ---------- | --------------------------------------------------------- |
| file_read     | safe       | Read with line numbers, offset/limit, image/PDF support   |
| file_write    | confirm    | Create/overwrite (must read first if exists)              |
| file_edit     | confirm    | Search/Replace with uniqueness validation, diff preview   |
| bash_exec     | confirm    | Shell execution with timeout, background support          |
| bash_output   | safe       | Read output from background bash process                  |
| kill_shell    | confirm    | Kill a running background shell process                   |
| glob_search   | safe       | File pattern matching, sorted by mtime                    |
| grep_search   | safe       | Regex content search (ripgrep wrapper)                    |
| list_dir      | safe       | Directory listing with metadata                           |
| web_fetch     | confirm    | HTTP fetch with 15-min cache, content extraction          |
| web_search    | confirm    | Brave Search + DuckDuckGo fallback                        |
| notebook_edit | confirm    | Jupyter notebook cell editing                             |
| mkdir         | confirm    | Create directories recursively                            |
| ask_user      | safe       | Ask user questions with choices                           |
| agent         | confirm    | Spawn subagent (explore/plan/general) via factory pattern |
| todo_write    | safe       | Task tracking with pending/in_progress/completed states   |

**Hot tools** (always included in schema): file_read, file_write, file_edit, bash_exec, glob_search, grep_search

## Tool-Call Strategies

- **Native function-calling** (`strategies/native-function-calling.ts`): GPT-4o, Claude 등 함수 호출 네이티브 지원 모델
- **Text parsing** (`strategies/text-parsing.ts`): XML 태그 기반 폴백 — 함수 호출 미지원 모델용
- **Two-stage** (`strategies/two-stage-tool-call.ts`): 복잡한 워크플로우용

## Tool Call Auto-Correction

**tool-call-corrector.ts**: Zod 검증 전에 저가 모델의 흔한 실수를 자동 교정:

- 상대 경로 → 절대 경로 (`./src/app.ts` → `/project/src/app.ts`)
- `"true"` 문자열 → `true` boolean
- `"123"` 문자열 → `123` number
- HIGH 티어 모델에서는 건너뜀

## Tool Grouping & Parallel Execution

**agent-loop.ts**: 도구 호출을 충돌 분석하여 그룹으로 나눔:

- 같은 파일에 대한 쓰기 작업 → 별도 그룹 (순차 실행)
- 읽기 전용 도구 (file_read, grep, glob) → 같은 그룹 (병렬 실행)
- 그룹 내: `Promise.allSettled`로 병렬 / 그룹 간: 순차

## Adaptive Schema & Lazy Loading

Tool schemas adapt to model capability tiers:

| Tier   | Schema Detail | Loading   | Description                                 |
| ------ | ------------- | --------- | ------------------------------------------- |
| HIGH   | Full          | Eager     | All params, descriptions, examples          |
| MEDIUM | Reduced       | Lazy      | Required params only, minimal descriptions  |
| LOW    | Minimal       | On-demand | Name + essential params + few-shot examples |

## Tool Retry & Self-Healing

- **tool-retry.ts**: Auto-corrects failed tool calls:
  - **Levenshtein path correction**: Suggests closest valid file path
  - **JSON repair**: Fixes malformed JSON arguments (trailing commas, missing quotes)

## MCP Tool Bridge

- **tool-bridge.ts**: MCP 서버의 도구를 dhelix ToolRegistry에 등록
- MCP 도구는 `mcp__{server}__{tool}` 네이밍 규칙
- **tool-filter.ts**: 서버별 include/exclude 필터링
- **tool-search.ts**: 사용 가능한 MCP 도구 검색

## Tool Display Pipeline

`tool-display.ts`의 `toolDisplayMap`에서 도구별 표시 설정:

- `extractHeaderArg`: 헤더에 표시할 핵심 인자 (파일 경로, 커맨드 등)
- `extractDetail`: metadata 기반 상세 정보 (줄 수, exit code 등)
- `extractPreview`: diff/출력 미리보기
- `extractSubtext`: 상태 줄 아래 보조 텍스트

## 주의사항

- 새 도구 추가 시: `src/tools/definitions/`에 파일 생성 → `registry.ts`에 등록 → `tool-display.ts`에 표시 설정 추가
- `ToolResult.metadata`는 executor에서 자동 전달 → `verify-tool-metadata-pipeline` 스킬로 검증
- permissionLevel 변경은 보안 영향 — "safe"는 자동 실행, "confirm"은 사용자 승인 필요
- adaptive-schema 변경 시: 3개 티어 모두에서 tool 동작 검증 필요
- tool-retry와 tool-call-corrector는 agent-loop 내부에서 자동 적용
