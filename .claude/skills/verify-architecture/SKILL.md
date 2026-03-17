---
name: verify-architecture
description: 4-Layer 아키텍처 규칙, 순환 의존성, 파일 크기 제한, 코딩 컨벤션을 자동 검증합니다. 새 모듈 추가, 리팩토링, import 변경, 대규모 코드 작성 후 사용하세요. "아키텍처 검증", "구조 체크", "레이어 위반 확인" 등의 요청에도 사용하세요.
---

## Purpose

1. **순환 의존성 검출** — `madge --circular`로 순환 import를 탐지
2. **4-Layer 의존성 방향 검증** — CLI → Core → Infra → Leaf 단방향 준수 여부
3. **파일 크기 제한** — 800줄 초과 파일 탐지
4. **코딩 컨벤션 준수** — default export 금지, ESM 확장자, `any` 사용 금지

## When to Run

- 새로운 모듈이나 파일을 추가한 후
- `import` 구문을 변경하거나 파일 간 의존성을 재구성한 후
- 대규모 리팩토링이나 디렉토리 구조 변경 후
- PR 전 최종 아키텍처 검증으로
- 빌드는 통과하지만 구조적 문제가 의심될 때

## Related Files

| File               | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `src/cli/`         | Layer 1: CLI (Ink/React) — UI 컴포넌트, hooks, renderer |
| `src/core/`        | Layer 2: Core — agent loop, context, session, prompt    |
| `src/llm/`         | Layer 3: Infra — LLM client, strategies, streaming      |
| `src/tools/`       | Layer 3: Infra — tool system, executor, registry        |
| `src/mcp/`         | Layer 3: Infra — MCP client, bridge, transports         |
| `src/permissions/` | Layer 3: Infra — permission manager, modes              |
| `src/guardrails/`  | Layer 3: Infra — injection detector, secret scanner     |
| `src/sandbox/`     | Layer 3: Infra — sandbox execution                      |
| `src/subagents/`   | Layer 3: Infra — agent spawner, teams                   |
| `src/hooks/`       | Layer 3: Infra — hook system                            |
| `src/utils/`       | Layer 4: Leaf — logger, events, path, error             |
| `src/config/`      | Layer 4: Leaf — config loader, schema, defaults         |
| `src/skills/`      | Layer 4: Leaf — skill loader, executor, manager         |
| `src/memory/`      | Layer 4: Leaf — memory manager, writer                  |
| `src/constants.ts` | Layer 4: Leaf — 상수 정의                               |
| `tsconfig.json`    | TypeScript strict mode 설정                             |

## Layer 정의

```
Layer 1 (CLI):    src/cli/
Layer 2 (Core):   src/core/
Layer 3 (Infra):  src/llm/, src/tools/, src/mcp/, src/permissions/,
                  src/guardrails/, src/sandbox/, src/subagents/,
                  src/hooks/, src/auth/, src/indexing/, src/telemetry/
Layer 4 (Leaf):   src/utils/, src/config/, src/skills/, src/memory/,
                  src/mentions/, src/instructions/, src/voice/,
                  src/constants.ts
```

**규칙:** 하위 레이어는 상위 레이어를 import할 수 없습니다.

- Leaf(4)는 어떤 상위 레이어도 import 불가
- Infra(3)는 CLI(1), Core(2)를 import 불가
- Core(2)는 CLI(1)를 import 불가

## Workflow

### Step 1: 순환 의존성 검사

```bash
npx madge --circular --extensions ts,tsx src/
```

**PASS:** 출력이 "No circular dependency found" 또는 빈 결과
**FAIL:** 순환 경로가 표시됨 — 해당 파일들의 import를 분석하여 의존성을 끊어야 함

**수정 가이드:**

- 공통 타입을 Leaf 레이어의 별도 파일로 추출
- 인터페이스를 사용하여 의존성 역전 (Dependency Inversion)
- 동적 import (`import()`)를 사용하여 런타임 의존성으로 전환

### Step 2: Layer 의존성 방향 검증

**Leaf → 상위 레이어 import 검사:**

```bash
grep -rn "from ['\"]\.\./" src/utils/*.ts src/config/*.ts src/skills/*.ts src/memory/*.ts src/mentions/*.ts src/instructions/*.ts src/voice/*.ts src/constants.ts 2>/dev/null | grep -E "(cli|core|llm|tools|mcp|permissions|guardrails|sandbox|subagents|hooks|auth|indexing|telemetry)/" | head -20
```

**PASS:** 결과 없음 (Leaf가 상위를 import하지 않음)
**FAIL:** Leaf 모듈이 상위 레이어를 import — 해당 import를 제거하거나 의존성 방향을 수정

**Infra → CLI/Core import 검사:**

```bash
grep -rn "from ['\"]\.\./" src/llm/*.ts src/tools/**/*.ts src/mcp/*.ts src/permissions/*.ts src/guardrails/*.ts src/sandbox/*.ts src/hooks/*.ts 2>/dev/null | grep -E "(cli|core)/" | head -20
```

**PASS:** 결과 없음
**FAIL:** Infra 모듈이 CLI 또는 Core를 import

**Core → CLI import 검사:**

```bash
grep -rn "from ['\"]\.\./" src/core/*.ts 2>/dev/null | grep "cli/" | head -10
```

**PASS:** 결과 없음
**FAIL:** Core 모듈이 CLI를 import

### Step 3: 파일 크기 검사 (800줄 제한)

```bash
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -rn | head -20
```

**PASS:** 모든 파일이 800줄 이하
**FAIL:** 800줄 초과 파일 발견 — 분리 대상 표시

**수정 가이드:**

- 유틸리티 함수를 별도 파일로 추출
- 큰 클래스를 기능별로 분리
- 타입 정의를 `types.ts`로 분리

### Step 4: Default Export 검사

```bash
grep -rn "export default" src/**/*.ts src/**/*.tsx 2>/dev/null | head -10
```

**PASS:** 결과 없음 (모든 파일이 named export 사용)
**FAIL:** default export 발견 — named export로 변경

### Step 5: ESM import 확장자 검사

```bash
grep -rn "from ['\"]\./" src/**/*.ts src/**/*.tsx 2>/dev/null | grep -v "\.js['\"]" | grep -v "\.json['\"]" | grep -v "node_modules" | grep -v "\.d\.ts" | head -20
```

**PASS:** 모든 상대 import에 `.js` 확장자 포함
**FAIL:** 확장자 누락 — `.js` 추가 필요

### Step 6: `any` 타입 사용 검사

```bash
grep -rn ": any\b" src/**/*.ts src/**/*.tsx 2>/dev/null | grep -v "eslint-disable" | grep -v "// any is" | grep -v ".d.ts" | head -15
```

**PASS:** eslint-disable 주석 없는 `any` 사용 없음
**FAIL:** 비인가 `any` 발견 — `unknown` + 타입 가드로 교체

### Step 7: console.log 검사

```bash
grep -rn "console\.log\b" src/**/*.ts src/**/*.tsx 2>/dev/null | grep -v "test/" | grep -v ".d.ts" | head -10
```

**PASS:** 프로덕션 코드에 console.log 없음
**FAIL:** console.log 발견 — logger 사용으로 교체 또는 제거

## Output Format

| Check                       | Status    | Detail                |
| --------------------------- | --------- | --------------------- |
| 순환 의존성                 | PASS/FAIL | 순환 경로 또는 "없음" |
| Layer 방향 (Leaf→상위)      | PASS/FAIL | 위반 파일:라인        |
| Layer 방향 (Infra→CLI/Core) | PASS/FAIL | 위반 파일:라인        |
| Layer 방향 (Core→CLI)       | PASS/FAIL | 위반 파일:라인        |
| 파일 크기 (≤800줄)          | PASS/FAIL | 초과 파일 목록        |
| Default Export 금지         | PASS/FAIL | 위반 파일             |
| ESM 확장자 (.js)            | PASS/FAIL | 누락 파일:라인        |
| `any` 타입 금지             | PASS/FAIL | 비인가 사용 위치      |
| console.log 금지            | PASS/FAIL | 발견 위치             |

## Exceptions

1. **eslint-disable 주석이 있는 `any`** — ToolRegistry 등 제네릭 타입 경계에서 `eslint-disable-next-line @typescript-eslint/no-explicit-any`로 명시된 경우는 허용
2. **타입 선언 파일** — `.d.ts` 파일의 `any`는 서드파티 타입 호환을 위해 허용
3. **subagents/ → core/ import** — `src/subagents/spawner.ts`가 `src/core/agent-loop.ts`를 import하는 것은 설계상 허용 (서브에이전트가 에이전트 루프를 생성해야 하므로)
4. **hooks/ → core/ import** — `src/hooks/runner.ts`가 `src/core/` 이벤트 타입을 import하는 것은 허용 (훅이 코어 이벤트에 반응해야 하므로)
5. **src/index.ts** — 진입점은 모든 레이어를 import할 수 있음 (부트스트랩 역할)
6. **테스트 파일** — `test/` 디렉토리의 파일은 레이어 규칙의 적용 대상이 아님
