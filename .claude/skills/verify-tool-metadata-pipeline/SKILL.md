---
name: verify-tool-metadata-pipeline
description: Tool metadata가 실행→이벤트→activity→UI까지 일관되게 전달되는지 검증. 도구 정의, executor, agent-loop, 또는 display 코드 변경 후 사용.
---

## Purpose

1. **metadata 전달 일관성** — `ToolResult.metadata` → `ToolCallResult.metadata` → `tool:complete` event → activity entry → UI component
2. **extractDetail 시그니처 일치** — `tool-display.ts`의 모든 extractDetail이 3번째 파라미터로 metadata를 받는지
3. **toolDisplayMap 커버리지** — 모든 등록 도구가 `toolDisplayMap`에 display config를 가지는지
4. **이벤트 타입 동기화** — `events.ts`의 `tool:complete` 타입과 실제 emit하는 필드가 일치하는지

## When to Run

- `src/tools/definitions/*.ts`에서 새 도구를 추가하거나 metadata 형태를 변경했을 때
- `src/tools/executor.ts` 또는 `src/tools/types.ts`를 수정했을 때
- `src/cli/renderer/tool-display.ts`의 toolDisplayMap을 변경했을 때
- `src/core/agent-loop.ts`의 tool:complete 이벤트 emit 부분을 변경했을 때
- `src/cli/components/ToolCallBlock.tsx` 또는 `TurnBlock.tsx`를 수정했을 때

## Related Files

| File                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `src/tools/types.ts`                   | `ToolResult`, `ToolCallResult` 인터페이스 (metadata 필드) |
| `src/tools/executor.ts`                | `executeToolCall()` — ToolResult → ToolCallResult 변환    |
| `src/core/agent-loop.ts`               | `tool:complete` 이벤트 emit (metadata 포함)               |
| `src/utils/events.ts`                  | 이벤트 타입 정의 (tool:complete payload)                  |
| `src/cli/hooks/useAgentLoop.ts`        | onToolComplete → activity entry 변환                      |
| `src/core/activity.ts`                 | ActivityCollector — entry 저장                            |
| `src/cli/renderer/tool-display.ts`     | toolDisplayMap, getToolDisplayText, getToolPreview        |
| `src/cli/components/ToolCallBlock.tsx` | metadata prop 수신 및 전달                                |
| `src/cli/components/TurnBlock.tsx`     | entry.data.metadata 추출 및 전달                          |
| `src/tools/definitions/*.ts`           | 각 도구의 metadata 반환값                                 |

## Workflow

### Step 1: ToolCallResult에 metadata 필드 존재 확인

```bash
grep -n "metadata" src/tools/types.ts
```

**PASS:** `ToolCallResult` 인터페이스에 `readonly metadata?: Readonly<Record<string, unknown>>` 존재
**FAIL:** metadata 필드가 없으면 파이프라인이 끊어짐

### Step 2: executor가 metadata를 전달하는지 확인

```bash
grep -A2 "result.metadata" src/tools/executor.ts
```

**PASS:** `executeToolCall()` 반환값에 `metadata: result.metadata` 포함
**FAIL:** metadata가 drop되면 UI에 도달하지 못함

### Step 3: agent-loop의 tool:complete 이벤트에 metadata 포함 확인

```bash
grep -B1 -A5 'tool:complete' src/core/agent-loop.ts | grep metadata
```

**PASS:** 최소 1개의 `tool:complete` emit에 `metadata: result.metadata` 포함
**FAIL:** metadata가 이벤트에 누락

### Step 4: events.ts 타입에 metadata 정의 확인

```bash
grep -A5 "tool:complete" src/utils/events.ts | grep metadata
```

**PASS:** `tool:complete` 이벤트 타입에 `metadata?` 필드 정의됨
**FAIL:** 타입 불일치로 TypeScript 에러 발생 가능

### Step 5: useAgentLoop가 metadata를 activity entry에 전달하는지 확인

```bash
grep -A10 "onToolComplete" src/cli/hooks/useAgentLoop.ts | grep metadata
```

**PASS:** destructuring에 `metadata` 포함 및 `addEntry`에 전달
**FAIL:** metadata가 activity layer에서 손실

### Step 6: tool-display.ts extractDetail이 metadata 파라미터를 받는지 확인

```bash
grep "extractDetail.*metadata" src/cli/renderer/tool-display.ts | head -5
```

**PASS:** extractDetail 시그니처에 metadata 파라미터 존재
**FAIL:** display 함수가 metadata를 활용할 수 없음

### Step 7: ToolCallBlock에 metadata prop 존재 확인

```bash
grep "metadata" src/cli/components/ToolCallBlock.tsx
```

**PASS:** `ToolCallBlockProps`에 metadata 포함, `getToolDisplayText`에 전달
**FAIL:** UI 컴포넌트에서 metadata 미사용

### Step 8: TurnBlock이 metadata를 추출하는지 확인

```bash
grep "metadata" src/cli/components/TurnBlock.tsx
```

**PASS:** `findMetadata` 헬퍼 존재, ToolCallBlock에 metadata prop 전달
**FAIL:** entry에서 metadata 추출 로직 누락

### Step 9: 모든 도구 정의가 toolDisplayMap에 등록되어 있는지 확인

```bash
# 도구 정의 파일에서 name 추출
grep -rh "name:" src/tools/definitions/*.ts | grep -oP '"[^"]+"' | sort -u

# toolDisplayMap 키 추출
grep -oP '^\s+\w+:' src/cli/renderer/tool-display.ts | tr -d ' :' | sort -u
```

**PASS:** 모든 도구 이름이 toolDisplayMap에 존재
**FAIL:** 누락된 도구가 generic "Running X" / "Completed X"로 표시됨

## Output Format

| Check                   | Status    | Detail              |
| ----------------------- | --------- | ------------------- |
| ToolCallResult.metadata | PASS/FAIL | 필드 존재 여부      |
| executor 전달           | PASS/FAIL | metadata 전달 여부  |
| agent-loop emit         | PASS/FAIL | 이벤트 포함 여부    |
| events.ts 타입          | PASS/FAIL | 타입 정의 여부      |
| useAgentLoop 전달       | PASS/FAIL | activity entry 전달 |
| extractDetail 시그니처  | PASS/FAIL | metadata 파라미터   |
| ToolCallBlock prop      | PASS/FAIL | metadata prop       |
| TurnBlock 추출          | PASS/FAIL | findMetadata 존재   |
| toolDisplayMap 커버리지 | PASS/FAIL | 누락 도구 목록      |

## Exceptions

1. **에러 케이스의 metadata 누락** — permission denied, guardrail blocked, execution failure 시 metadata가 undefined인 것은 정상
2. **MCP 도구** — MCP 서버가 제공하는 외부 도구는 toolDisplayMap에 없어도 정상 (generic display 사용)
3. **ask_user 도구** — metadata를 반환하지만 display에서는 args.question만 사용하는 것은 의도된 동작
