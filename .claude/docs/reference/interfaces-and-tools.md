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

## Built-in Tools (14)

| Tool          | Permission | Description                                               |
| ------------- | ---------- | --------------------------------------------------------- |
| file_read     | safe       | Read with line numbers, offset/limit, image/PDF support   |
| file_write    | confirm    | Create/overwrite (must read first if exists)              |
| file_edit     | confirm    | Search/Replace with uniqueness validation, diff preview   |
| bash_exec     | confirm    | Shell execution with timeout, background support          |
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

## Tool-Call Strategies

- **Native function-calling** (`strategies/native-function-calling.ts`): GPT-4o, Claude 등 함수 호출 네이티브 지원 모델
- **Text parsing** (`strategies/text-parsing.ts`): XML 태그 기반 폴백 — 함수 호출 미지원 모델용

## Tool Display Pipeline

`tool-display.ts`의 `toolDisplayMap`에서 도구별 표시 설정:

- `extractHeaderArg`: 헤더에 표시할 핵심 인자 (파일 경로, 커맨드 등)
- `extractDetail`: metadata 기반 상세 정보 (줄 수, exit code 등)
- `extractPreview`: diff/출력 미리보기
- `extractSubtext`: 상태 줄 아래 보조 텍스트

## 주의사항

- 새 도구 추가 시: `src/tools/definitions/`에 파일 생성 → `registry.ts`에 등록 → `tool-display.ts`에 표시 설정 추가
- `ToolResult.metadata`는 executor에서 자동 전달 → activity → UI까지 파이프라인 확인은 `verify-tool-metadata-pipeline` 스킬 사용
- permissionLevel 변경은 보안 영향 — "safe"는 자동 실행, "confirm"은 사용자 승인 필요
