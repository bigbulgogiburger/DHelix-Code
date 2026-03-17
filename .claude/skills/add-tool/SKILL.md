---
name: add-tool
description: 새로운 빌트인 도구를 추가하는 전체 워크플로우를 안내합니다. Zod 스키마 정의, 도구 구현, 레지스트리 등록, display 설정, 테스트 작성까지 포함합니다. "새 도구 추가", "tool 만들어줘", "빌트인 도구 구현" 등의 요청에 사용하세요.
argument-hint: "<tool_name> [description]"
---

# 빌트인 도구 추가 워크플로우

## Why This Skill Exists

dbcode의 도구 시스템은 정의(Zod 스키마) → 레지스트리 등록 → executor 실행 → 이벤트 발행 → UI 표시라는 파이프라인을 따릅니다. 이 파이프라인의 어느 한 단계라도 누락되면 도구가 동작하지 않거나 UI에 "Running X / Completed X"라는 generic 텍스트가 표시됩니다. 이 스킬은 파이프라인 전체를 빠짐없이 연결합니다.

## 변경 대상 파일

| 파일                               | 역할                                 |
| ---------------------------------- | ------------------------------------ |
| `src/tools/definitions/<name>.ts`  | 도구 정의 + 실행 로직 (새 파일 생성) |
| `src/tools/types.ts`               | ToolDefinition, ToolResult 타입 참조 |
| `src/index.ts`                     | import + 레지스트리 등록             |
| `src/cli/renderer/tool-display.ts` | toolDisplayMap에 display 설정 추가   |
| `test/unit/tools/<name>.test.ts`   | 단위 테스트 (새 파일 생성)           |

## Workflow

### Step 1: 요구사항 확인

`$ARGUMENTS`에서 도구 이름과 설명을 추출합니다.

- 도구 이름이 없으면 `AskUserQuestion`으로 확인
- 이름은 **snake_case** (예: `file_read`, `glob_search`, `bash_exec`)
- 기존 도구와 중복되지 않는지 확인:

```bash
grep -r "name:" src/tools/definitions/*.ts | grep '"<tool_name>"'
```

**추가 확인 사항:**

- 도구의 입력 파라미터는 무엇인가?
- 권한 수준은? (`safe` / `confirm` / `dangerous`)
- 타임아웃이 필요한가?
- 메타데이터를 반환해야 하는가? (UI 표시용)

### Step 2: 도구 정의 파일 생성

`src/tools/definitions/<name>.ts` 파일을 생성합니다.

**필수 패턴:**

```typescript
import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

// 1. Zod 스키마 정의 — 각 필드에 .describe()로 LLM 힌트 제공
const paramSchema = z.object({
  input: z.string().describe("The input to process"),
  option: z.boolean().optional().describe("Optional flag"),
});

type Params = z.infer<typeof paramSchema>;

// 2. 실행 함수 정의
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  try {
    const { input, option } = params;
    const { workingDirectory, abortSignal } = context;

    // 구현 로직

    return {
      output: "결과 텍스트",
      isError: false,
      metadata: { /* UI에 필요한 추가 정보 */ },
    };
  } catch (error) {
    return {
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

// 3. 도구 정의 export
export const <camelName>Tool: ToolDefinition<Params> = {
  name: "<snake_name>",
  description: "LLM이 이 도구를 언제 사용할지 판단하는 설명. 구체적이고 명확하게 작성.",
  parameterSchema: paramSchema,
  permissionLevel: "safe", // "safe" | "confirm" | "dangerous"
  timeoutMs: 30_000, // 선택: 기본값은 executor의 전역 타임아웃
  execute,
};
```

**체크리스트:**

- Zod 스키마의 모든 필드에 `.describe()` 사용 — LLM이 파라미터를 정확히 전달하려면 설명이 필수
- `type` import 사용 (ToolDefinition, ToolContext, ToolResult)
- Named export: `<camelName>Tool` 형식 (예: `globSearchTool`, `mkdirTool`)
- default export 금지
- ESM import에 `.js` 확장자 필수
- `context.abortSignal`을 장시간 작업에 전달하여 취소 지원
- 에러 시 `isError: true` + 사용자 친화적 메시지 반환

**권한 수준 가이드:**

| 수준        | 설명                   | 예시                               |
| ----------- | ---------------------- | ---------------------------------- |
| `safe`      | 읽기 전용, 부작용 없음 | glob_search, grep_search, list_dir |
| `confirm`   | 파일 수정, 외부 통신   | file_write, file_edit, web_fetch   |
| `dangerous` | 시스템 명령 실행, 삭제 | bash_exec                          |

### Step 3: index.ts에 등록

`src/index.ts`에서 다음 2곳을 수정합니다:

**3a. Dynamic import 추가:**

```bash
# 도구 import 위치 확인
grep -n "tools/definitions" src/index.ts | head -20
```

Promise.all 블록에 import 추가:

```typescript
import("./tools/definitions/<name>.js"),
```

destructuring에 대응 항목 추가:

```typescript
{ <camelName>Tool },
```

**3b. registerAll 배열에 추가:**

```bash
# registerAll 위치 확인
grep -n "registerAll" src/index.ts
```

`toolRegistry.registerAll([...])` 배열에 `<camelName>Tool`을 추가합니다.

### Step 4: tool-display.ts에 display 설정 추가

`src/cli/renderer/tool-display.ts`의 `toolDisplayMap`에 엔트리를 추가합니다. 이 설정이 없으면 UI에 "Running <name> / Completed <name>"이라는 generic 텍스트가 표시됩니다.

```bash
# toolDisplayMap 위치 확인
grep -n "toolDisplayMap" src/cli/renderer/tool-display.ts | head -5
```

**추가할 엔트리:**

```typescript
<snake_name>: {
  running: (args) => `동작 중 텍스트 (${extractDetail(args, "input")})`,
  complete: (args, result, metadata) => `완료 텍스트`,
  icon: "🔧", // 도구 성격에 맞는 이모지
},
```

**extractDetail 사용법:**

```typescript
// args에서 특정 파라미터 추출
extractDetail(args, "paramName"); // string 반환
extractDetail(args, "paramName", metadata); // metadata 우선, 없으면 args에서
```

### Step 5: 테스트 작성

`test/unit/tools/<name>.test.ts` 파일을 생성합니다.

**필수 테스트 패턴:**

```typescript
import { describe, it, expect } from "vitest";
import { <camelName>Tool } from "../../../src/tools/definitions/<name>.js";

const baseContext = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: process.platform as "win32" | "darwin" | "linux",
};

describe("<snake_name> tool", () => {
  it("should have correct definition", () => {
    expect(<camelName>Tool.name).toBe("<snake_name>");
    expect(<camelName>Tool.description).toBeTypeOf("string");
    expect(<camelName>Tool.permissionLevel).toBe("safe"); // 또는 confirm/dangerous
    expect(<camelName>Tool.execute).toBeTypeOf("function");
  });

  it("should validate parameter schema", () => {
    const valid = <camelName>Tool.parameterSchema.safeParse({ input: "test" });
    expect(valid.success).toBe(true);

    const invalid = <camelName>Tool.parameterSchema.safeParse({});
    expect(invalid.success).toBe(false);
  });

  it("should execute successfully with valid input", async () => {
    const result = await <camelName>Tool.execute(
      { input: "test" },
      baseContext,
    );
    expect(result.isError).toBe(false);
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle errors gracefully", async () => {
    const result = await <camelName>Tool.execute(
      { input: "invalid/path/that/does/not/exist" },
      baseContext,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Error");
  });
});
```

**테스트 체크리스트:**

- 도구 메타데이터 검증 (name, description, permissionLevel)
- Zod 스키마 유효성 검증 (valid + invalid inputs)
- 정상 실행 테스트
- 에러 케이스 테스트
- metadata 반환 검증 (해당되는 경우)
- AbortSignal 취소 테스트 (장시간 작업의 경우)

### Step 6: 검증

```bash
# 타입 체크
npx tsc --noEmit

# 해당 테스트만 실행
npx vitest run test/unit/tools/<name>.test.ts

# 빌드 확인
npm run build
```

### Step 7: verify-tool-metadata-pipeline 실행 (권장)

도구 추가 후 metadata 파이프라인이 올바르게 연결되었는지 `/verify-tool-metadata-pipeline` 스킬을 실행하여 확인합니다.

## 주의사항

1. **Hot Tools** — `file_read`, `file_write`, `file_edit`, `bash_exec`, `glob_search`, `grep_search`는 Hot Tool로 분류되어 매 LLM 요청에 항상 포함됩니다. 새 도구를 Hot Tool로 추가하려면 `src/tools/registry.ts`의 `hotTools` Set을 수정해야 합니다.
2. **MCP 도구와의 충돌** — 이름이 `mcp__`로 시작하는 도구는 MCP 도구로 취급됩니다. 빌트인 도구는 이 접두사를 사용하지 마세요.
3. **Adaptive Schema** — `src/tools/adaptive-schema.ts`가 모델 능력에 따라 스키마를 단순화합니다. 복잡한 스키마는 LOW tier 모델에서 파라미터가 줄어들 수 있습니다.

## Exceptions

1. **Agent 도구** — `createAgentTool()`은 client, model, strategy, registry 의존성이 필요하여 특수 등록 패턴을 사용합니다. 이 워크플로우로는 처리할 수 없습니다.
2. **MCP 브릿지 도구** — MCP 서버에서 제공하는 도구는 `src/mcp/tool-bridge.ts`를 통해 동적으로 등록되므로 이 워크플로우와 무관합니다.
3. **Lazy-loaded 도구** — `src/tools/lazy-tool-loader.ts`를 통해 지연 로딩되는 도구는 별도의 로딩 로직이 필요합니다.
