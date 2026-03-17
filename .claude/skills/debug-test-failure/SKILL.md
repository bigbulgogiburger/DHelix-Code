---
name: debug-test-failure
description: 테스트 실패를 체계적으로 진단하고 수정합니다. 에러 메시지 분석, 관련 소스 추적, mock 설정 검증, 수정 적용까지의 워크플로우를 제공합니다. "테스트 실패", "test 깨졌어", "왜 테스트가 안 돼", "vitest 에러" 등의 상황에 사용하세요.
argument-hint: "[test file path or pattern]"
---

# 테스트 실패 디버깅 워크플로우

## Why This Skill Exists

dbcode는 208개 이상의 테스트 파일에서 6,000+ 테스트 케이스를 실행하며, 98%+ 커버리지를 유지합니다. 테스트 실패 시 원인이 다양합니다 — 소스 코드 변경으로 인한 기대값 불일치, mock 설정 오류, 비동기 타이밍 이슈, import 경로 변경 등. 이 스킬은 실패 원인을 체계적으로 분류하고 빠르게 수정합니다.

## Related Files

| File                   | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `vitest.config.ts`     | 테스트 설정 (globals, environment, coverage) |
| `test/unit/`           | 단위 테스트 (208+ 파일)                      |
| `test/integration/`    | 통합 테스트 (agent loop, tools, MCP)         |
| `test/e2e/`            | E2E 테스트 (CLI boot, projects)              |
| `test/mocks/openai.ts` | Mock LLM provider factory                    |
| `test/fixtures/`       | 테스트 픽스처 데이터                         |

## Workflow

### Step 1: 실패 현황 파악

**인자가 주어진 경우 (특정 테스트):**

```bash
npx vitest run <test-path> --reporter=verbose 2>&1 | tail -50
```

**인자가 없는 경우 (전체 테스트):**

```bash
npx vitest run 2>&1 | tail -80
```

실패한 테스트를 목록으로 정리합니다:

```markdown
| #   | 테스트 파일      | 실패 케이스   | 에러 타입      |
| --- | ---------------- | ------------- | -------------- |
| 1   | path/to/test.ts  | "should do X" | AssertionError |
| 2   | path/to/test2.ts | "handles Y"   | TypeError      |
```

### Step 2: 에러 분류

각 실패를 아래 카테고리로 분류합니다:

| 카테고리          | 증상                             | 일반적 원인                          |
| ----------------- | -------------------------------- | ------------------------------------ |
| **기대값 불일치** | `expected X, received Y`         | 소스 코드 변경으로 반환값이 바뀜     |
| **타입 에러**     | `TypeError: X is not a function` | 인터페이스 변경, import 누락         |
| **Import 에러**   | `Cannot find module`             | 파일 이동/이름 변경, .js 확장자 누락 |
| **Mock 불일치**   | `not a function`, 빈 결과        | Mock이 실제 인터페이스와 다름        |
| **비동기 이슈**   | `timeout`, 무한 대기             | await 누락, Promise 미해결           |
| **환경 의존**     | 특정 OS에서만 실패               | 경로 구분자, 파일 시스템 차이        |

### Step 3: 원인 추적

분류된 카테고리에 따라 다른 전략을 사용합니다:

**기대값 불일치의 경우:**

1. 실패한 테스트의 `expect()` 라인을 읽습니다
2. 테스트가 검증하는 소스 함수/클래스를 찾습니다
3. 최근 변경사항을 확인합니다:

```bash
git diff HEAD~5 -- <source-file>
```

4. 반환값이 의도적으로 변경된 것인지 판단합니다:
   - **의도적 변경** → 테스트의 기대값을 업데이트
   - **비의도적 변경** → 소스 코드 수정

**타입/Import 에러의 경우:**

1. 에러에 표시된 import 경로를 확인합니다
2. 대상 파일이 존재하는지 확인합니다:

```bash
ls <imported-path> 2>/dev/null || echo "MISSING"
```

3. export된 이름이 변경되었는지 확인합니다:

```bash
grep -n "export.*<symbolName>" <source-file>
```

**Mock 불일치의 경우:**

1. Mock 객체의 구조를 확인합니다 (보통 `test/mocks/` 또는 테스트 내부)
2. 실제 인터페이스와 비교합니다:

```bash
# Mock 정의 확인
grep -A10 "mock\|Mock\|vi.fn" <test-file> | head -20

# 실제 인터페이스 확인
grep -A10 "interface\|type.*=" <source-file> | head -20
```

3. Mock에 누락된 필드/메서드를 추가합니다

**비동기 이슈의 경우:**

1. `await` 누락 확인:

```bash
grep -n "expect.*\.to" <test-file> | grep -v await
```

2. Promise 반환 확인:

```bash
grep -n "async\|Promise\|await" <test-file> | head -10
```

### Step 4: 수정 적용

각 실패에 대해 수정을 적용합니다.

**수정 원칙:**

- 테스트가 틀린 것인지, 소스가 틀린 것인지 먼저 판단
- 소스 코드가 의도대로 변경된 경우 → 테스트 업데이트
- 소스 코드에 버그가 있는 경우 → 소스 수정
- Mock이 오래된 경우 → Mock 업데이트
- **절대 테스트를 `.skip`하거나 삭제하지 않음** (사용자가 명시적으로 요청하지 않는 한)

### Step 5: 수정 검증

```bash
# 수정된 테스트만 재실행
npx vitest run <fixed-test-paths> --reporter=verbose

# 전체 테스트 (관련 테스트가 많은 경우)
npx vitest run
```

### Step 6: 결과 보고

```markdown
## 테스트 디버깅 결과

### 수정 요약

| #   | 테스트      | 원인          | 수정 내용          |
| --- | ----------- | ------------- | ------------------ |
| 1   | `path:line` | 기대값 불일치 | 반환값 업데이트    |
| 2   | `path:line` | Mock 누락     | metadata 필드 추가 |

### 검증

- 수정 전: X개 실패
- 수정 후: 전체 통과 (또는 N개 잔여)
```

## 자주 발생하는 패턴별 해결책

### 패턴 1: 새 필드 추가 후 Mock 깨짐

소스에 새 필드를 추가하면, 해당 타입을 mock하는 모든 테스트에서 필드 누락 에러가 발생합니다.

**해결:** `test/mocks/` 디렉토리의 공통 mock factory를 먼저 업데이트한 후, 개별 테스트의 인라인 mock도 확인합니다.

### 패턴 2: 이벤트 타입 변경

`src/utils/events.ts`의 이벤트 페이로드가 변경되면 `useAgentLoop.ts` 테스트에서 타입 에러가 발생합니다.

**해결:** 이벤트 페이로드 타입을 확인하고 테스트의 mock 이벤트 데이터를 맞춥니다.

### 패턴 3: 명령어 등록 순서

새 명령어를 추가했지만 `src/index.ts`의 import/등록 순서가 맞지 않으면 `slash-commands.test.ts`에서 실패합니다.

**해결:** `src/index.ts`에서 import와 배열 등록이 모두 되어 있는지 확인합니다.

### 패턴 4: Windows 경로 이슈

경로 구분자(`\` vs `/`)로 인해 Unix에서는 통과하지만 Windows에서 실패하는 테스트입니다.

**해결:** `src/utils/path.ts`의 `normalizePath()`를 사용하거나, 테스트에서 `path.sep`을 고려합니다.

## Exceptions

1. **의도적 skip** — `it.skip()` 또는 `describe.skip()`이 이미 있는 테스트는 알려진 이슈이므로 무시
2. **환경 의존 테스트** — `OPENAI_API_KEY`가 없으면 자동 skip되는 통합 테스트는 정상
3. **Flaky 테스트** — 간헐적으로 실패하는 타이밍 의존 테스트는 `vi.useFakeTimers()`로 해결하거나, 재실행으로 확인
4. **E2E 테스트** — `test/e2e/`의 테스트는 실제 CLI 부팅이 필요하여 CI에서만 실행되는 경우가 있음
