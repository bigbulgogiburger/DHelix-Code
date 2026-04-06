---
name: add-slash-command
description: 새로운 슬래시 명령어를 추가하는 전체 워크플로우를 안내합니다. 명령어 파일 생성, 레지스트리 등록, 테스트 작성, CLAUDE.md 업데이트까지 포함합니다. "새 명령어 만들어줘", "슬래시 커맨드 추가", "/xxx 명령어 구현" 등의 요청에 사용하세요.
argument-hint: "<command-name> [description]"
---

# 슬래시 명령어 추가 워크플로우

## Why This Skill Exists

dhelix는 현재 41개의 슬래시 명령어를 가지고 있으며, 모든 명령어가 동일한 패턴을 따릅니다. 새 명령어를 추가할 때마다 3~4개 파일을 일관된 방식으로 수정해야 하는데, 이 패턴을 벗어나면 레지스트리 등록 누락, 테스트 미작성, 타입 불일치 등의 문제가 발생합니다. 이 스킬은 그 반복 작업을 정확하게 안내합니다.

## 변경 대상 파일

| 파일                                        | 역할                       |
| ------------------------------------------- | -------------------------- |
| `src/commands/<name>.ts`                    | 명령어 구현 (새 파일 생성) |
| `src/index.ts`                              | import + 레지스트리 등록   |
| `test/unit/commands/<name>-command.test.ts` | 단위 테스트 (새 파일 생성) |
| `CLAUDE.md`                                 | 명령어 수 업데이트 (선택)  |

## Workflow

### Step 1: 요구사항 확인

`$ARGUMENTS`에서 명령어 이름과 설명을 추출합니다.

- 명령어 이름이 없으면 `AskUserQuestion`으로 확인
- 이름은 소문자, 단일 단어 또는 하이픈 연결 (예: `output-style`, `dual-model`)
- 기존 명령어와 중복되지 않는지 확인:

```bash
grep -r "name:" src/commands/*.ts | grep '"<command-name>"'
```

### Step 2: 명령어 파일 생성

`src/commands/<name>.ts` 파일을 생성합니다.

**필수 패턴:**

```typescript
import { type CommandContext, type CommandResult, type SlashCommand } from "./registry.js";
// 필요한 유틸리티 import

export const <name>Command: SlashCommand = {
  name: "<name>",
  description: "<한줄 설명>",
  usage: "/<name> [args]",
  execute: async (args: string, context: CommandContext): Promise<CommandResult> => {
    // 구현
    return {
      output: "결과 텍스트",
      success: true,
    };
  },
};
```

**체크리스트:**

- `type` import 사용 (값이 아닌 타입은 `type` 키워드)
- Named export만 사용 (default export 금지)
- export 이름은 `<name>Command` 형식 (camelCase)
- `execute` 함수는 `async`
- 반환값은 `CommandResult` 인터페이스 준수
- ESM import에 `.js` 확장자 필수
- 에러 처리: try/catch로 감싸고 `success: false` 반환

**CommandResult 주요 플래그:**

| 플래그                      | 용도              | 사용 예시        |
| --------------------------- | ----------------- | ---------------- |
| `shouldClear`               | 대화 내역 초기화  | /clear           |
| `shouldInjectAsUserMessage` | 출력을 LLM에 주입 | /commit, /review |
| `interactiveSelect`         | 선택 목록 표시    | /model, /resume  |
| `newModel`                  | 모델 변경         | /model           |
| `refreshInstructions`       | DHELIX.md 재로드  | /config          |

### Step 3: index.ts에 등록

`src/index.ts`에서 다음 2곳을 수정합니다:

**3a. Dynamic import 추가:**

기존 명령어 import 블록(Promise.all 내부)에 추가합니다.

```bash
# import 위치 확인
grep -n "import.*commands/" src/index.ts | tail -5
```

해당 Promise.all 블록에 새 import를 추가:

```typescript
import("./commands/<name>.js"),
```

destructuring에도 대응하는 항목 추가:

```typescript
{ <name>Command },
```

**3b. commands 배열에 추가:**

```bash
# 배열 위치 확인
grep -n "Command," src/index.ts | tail -10
```

commands 배열에 `<name>Command`를 추가합니다.

### Step 4: 테스트 작성

`test/unit/commands/<name>-command.test.ts` 파일을 생성합니다.

**필수 테스트 패턴:**

```typescript
import { describe, it, expect } from "vitest";
import { <name>Command } from "../../../src/commands/<name>.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/<name> command", () => {
  it("should have correct metadata", () => {
    expect(<name>Command.name).toBe("<name>");
    expect(<name>Command.description).toBeTypeOf("string");
    expect(<name>Command.usage).toContain("/<name>");
    expect(<name>Command.execute).toBeTypeOf("function");
  });

  it("should return success on valid input", async () => {
    const result = await <name>Command.execute("valid-args", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle empty args", async () => {
    const result = await <name>Command.execute("", baseContext);
    // 빈 인자에 대한 적절한 동작 검증
    expect(result).toBeDefined();
  });
});
```

**테스트 체크리스트:**

- 메타데이터 검증 (name, description, usage, execute 타입)
- 정상 입력 테스트
- 빈 인자 테스트
- 에러 케이스 테스트 (해당되는 경우)
- `baseContext`에 필요한 필드만 포함 (최소 mock)

### Step 5: 검증

```bash
# 타입 체크
npx tsc --noEmit

# 해당 테스트만 실행
npx vitest run test/unit/commands/<name>-command.test.ts

# 빌드 확인
npm run build
```

모든 검증이 통과하면 완료입니다.

## 주의사항

1. **import 순서** — `src/index.ts`의 Promise.all 내 import는 알파벳 순서가 아닌 기존 그룹핑 패턴을 따릅니다. 비슷한 카테고리의 명령어 근처에 추가하세요.
2. **명령어 이름 충돌** — 스킬 이름과 겹치면 스킬이 우선 실행됩니다. 기존 스킬 목록도 확인하세요.
3. **CommandResult 플래그 조합** — `shouldInjectAsUserMessage`와 `interactiveSelect`는 동시 사용하지 마세요.

## Exceptions

1. **Agent 도구 명령어** — `/agents` 같은 서브에이전트 관련 명령어는 추가 의존성(client, strategy 등)이 필요하므로 이 패턴만으로는 부족합니다
2. **스킬 기반 명령어** — `skills/command-bridge.ts`를 통해 등록되는 스킬 명령어는 이 워크플로우 대신 스킬 시스템을 사용합니다
3. **InteractiveSelect 명령어** — 선택 목록을 사용하는 명령어는 추가 UI 연동이 필요합니다. `/model`, `/resume`을 참고하세요
