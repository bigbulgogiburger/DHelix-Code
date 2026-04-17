# Local LLM E2E Test Plan (GLM-4.5-Air 기반)

> **배경**: `LOCAL_MODEL=GLM45AirFP8` / `LOCAL_API_BASE_URL=https://models.dbinc.ai/v1`
> 로컬 LLM이 실제 응답을 반환하는 상태가 확보됨(2026-04-15). 이제 dhelix-code를
> "로컬 LLM 백엔드" 기준으로 E2E 검증 대상으로 삼을 수 있다.
>
> **목적**: (1) 로컬 LLM이 dhelix의 agent-loop / tool-call / context-compaction 경로를
> 파손 없이 통과하는지 검증, (2) 클라우드(GPT-4o-mini) 대비 편차를 측정, (3)
> GLM 계열 모델 업데이트/재배포 시 회귀를 조기 포착.
>
> **위치**: `.claude/docs/local-llm-e2e-test-plan.md`
> **마지막 갱신**: 2026-04-17

---

## 0. Test Pyramid (로컬 LLM 전용 7단계)

| Layer | 이름                       | 실행 주체 / 바이너리                 | 목표                                          | 실행 시간   | 선행 조건       |
| ----- | -------------------------- | ------------------------------------ | --------------------------------------------- | ----------- | --------------- |
| L0    | Connectivity Smoke         | vitest (lib)                         | 서버 살아있음 · 인증 · 모델 광고              | < 30s       | —               |
| L1    | Tool-Call Strategy         | vitest (lib)                         | native function-calling vs text-parsing 판별  | 1–3 min     | L0 PASS         |
| L2    | Headless CLI Single-Shot   | **`dbcode -p`** (binary)             | 1턴 CLI 경로 검증                             | 2–5 min     | L1 PASS         |
| L3    | Conversation Quality       | vitest (lib)                         | `runAgentLoop` 멀티턴 품질                    | 3–5 min/scenario | L2 PASS    |
| **L3-CLI** | **CQ via dbcode CLI** | **`dbcode -c -p`** (binary, 멀티턴) | **L3와 동일 턴을 실제 CLI로 실행 — 결과 동등성** | 5–8 min/scenario | L3 PASS |
| L4    | Project E2E (경량 스택)    | vitest + **`dbcode -c -p`** 병행     | 실제 프로젝트 생성 · 빌드 · 80% 커버리지      | 15–30 min   | L3 대부분 PASS  |
| L5    | Stress & Regression        | vitest + binary                      | 장문 컨텍스트 · 타임아웃 · Abort · 비용 0원   | 10–20 min   | L4 PASS         |

> **핵심 원칙**: L2부터는 **Claude가 아닌 dbcode 자체**가 개발 주체다.
> L3-CLI / L4는 `runAgentLoop()` 라이브러리 경로와 `dbcode -p` 바이너리 경로를
> **둘 다** 실행해 결과가 동등함을 확인한다. CLI 경로에서만 재현되는 회귀
> (예: CommandRegistry bootstrap, AutoSave, stdin 파이프, exit code 처리)를
> 잡기 위함이다.

각 Layer는 **선행 Layer가 PASS해야 다음 Layer로 진행**한다. L0 실패 시 나머지는 실행 불가이므로 즉시 중단·원인 보고.

---

## 1. 공통 사전 준비

### 1.1 환경변수
```bash
LOCAL_API_BASE_URL=https://models.dbinc.ai/v1
LOCAL_MODEL=GLM45AirFP8
LOCAL_API_KEY=<issued>
LOCAL_API_KEY_HEADER=model-api-key   # Bearer 대신 custom header
E2E_MODEL=GLM45AirFP8                # 기존 harness가 읽는 env (override 용)
OPENAI_API_KEY=dummy-for-skip-guard  # `describe.skipIf(!hasApiKey)` 우회용
```
> `skipIf(!hasApiKey)` 가드가 OPENAI_API_KEY만 보는 파일이 다수이므로, 로컬 LLM
> 전용 run에서는 `OPENAI_API_KEY=sk-local-dummy`를 설정해 테스트가 스킵되지 않게 한다.
> 실제 호출은 `createLLMClientForModel` → LocalModelProvider 로 분기돼야 한다.

### 1.2 실행 기준 명령
```bash
npm run build                                    # dist/index.js 필요
npx vitest run test/e2e/<file> --reporter=verbose
```

### 1.3 결과 보관
- 각 Layer 결과는 `.claude/reports/local-llm-e2e-<date>.md` 로 append
- 세션 로그(JSON): `test-projects/<project>/session-log.json`
- 진행 상황(실시간): `test-projects/<project>/.e2e-progress.json`

---

## 2. Layer 0 — Connectivity Smoke

### 테스트 파일
`test/e2e/local-llm-smoke.test.ts` (신규)

### Test Cases

#### L0-1 · healthCheck 200 OK
- **입력**: `new LocalModelProvider({ baseUrl: LOCAL_API_BASE_URL })` → `healthCheck()`
- **인수 조건**:
  - `result.healthy === true`
  - `result.latencyMs < 3000`
  - `result.error === undefined`

#### L0-2 · discoverModels() 에 `GLM45AirFP8` 포함
- **입력**: `provider.discoverModels()`
- **인수 조건**:
  - 반환 배열이 비어있지 않음
  - `models.some(m => m.id === "GLM45AirFP8")` true
  - 각 모델 `serverType !== undefined`

#### L0-3 · custom header 인증 경로 (model-api-key)
- **입력**: `LOCAL_API_KEY_HEADER=model-api-key`로 설정 후 최소 prompt 호출
- **인수 조건**:
  - 401/403 아님
  - 요청 헤더에 `model-api-key` 포함됨 (debug log 또는 MSW 인터셉트로 검증)
  - `Authorization: Bearer` **미포함**

#### L0-4 · URL 정규화 — `/chat/completions` 자동 제거
- **입력**: `LOCAL_API_BASE_URL=https://models.dbinc.ai/v1/chat/completions`
  (잘못된 전체 경로를 의도적으로 투입)
- **인수 조건**:
  - 클라이언트가 `/chat/completions/chat/completions` 같은 중복 경로를 호출하지 않음
  - 응답 200 OK
  - `client.ts`의 URL 정규화 로직이 적용됨

#### L0-5 · 최소 prompt echo
- **입력**: `"Respond with exactly: OK"` (system + user)
- **인수 조건**:
  - `result.content`에 `OK` 포함 (대소문자 무관)
  - `result.usage.totalTokens > 0`
  - `result.finishReason === "stop"`
  - 60s 이내 완료

---

## 3. Layer 1 — Tool-Call Strategy

> GLM-4.5-Air가 **native tool_calls**를 지원하는지 여부가 가장 중요한 분기점.
> 지원하면 그대로, 아니면 TextParsingStrategy로 폴백해야 한다.

### 테스트 파일
`test/e2e/local-llm-toolcall.test.ts`

#### L1-1 · Native 단일 tool 호출
- **사용자 프롬프트 (dhelix 입력)**:
  ```
  The file README.md in the current working directory describes this project.
  Read README.md and tell me, in one sentence, what the project is.
  Do not guess — you MUST use the file_read tool.
  ```
- **사전 준비 (test에서 미리 생성)**:
  `README.md` — `"# dhelix\nCLI AI coding assistant for local LLMs."`
- **인수 조건**:
  - `result.iterations` ∈ [2, 4] (tool call + follow-up, 소형 모델 2회 허용)
  - `result.messages` 에 role `"tool"` 메시지 ≥ 1개
  - 최종 assistant 응답에 `dhelix`와 `CLI` 둘 다 포함 (대소문자 무관)
  - `file_read` 가 정확히 1회 호출됨

#### L1-2 · Strategy 자동 선택 확인
- **입력**: `selectStrategy("GLM45AirFP8")`
- **사용자 프롬프트**: 불필요 (strategy 객체만 검사)
- **인수 조건**:
  - 반환 전략의 `name`이 `"native"` 또는 `"text-parsing"` 중 하나
  - 만약 `model-capabilities.ts`에 GLM 패턴 미등록 상태면 → **FAIL로 기록**하고 capabilities 업데이트 태스크 생성
  - 첨부된 capability 로그에 `supportsTools: true|false` 명시

#### L1-3 · 멀티 tool 호출 (write → read → edit)
- **Turn 1 프롬프트**:
  ```
  Create a file named config.json in the current working directory.
  Content:
  {
    "appName": "local-llm-test",
    "retries": 3,
    "timeout": 5000
  }
  Use the file_write tool. Do not add any other fields.
  ```
- **Turn 2 프롬프트**:
  ```
  Read config.json and report each field name and value. Use file_read.
  ```
- **Turn 3 프롬프트**:
  ```
  Update config.json: change "retries" from 3 to 7 and add a new field "debug": true.
  You MUST read the file first (file_read) before modifying it (file_edit).
  Do NOT overwrite the entire file with file_write.
  ```
- **인수 조건**:
  - 3턴 합산 tool 호출 ≥ 4회 (`file_write` 1, `file_read` ≥ 2, `file_edit` 1)
  - Turn 3 에서 `file_edit` 이전에 `file_read` 반드시 선행 (tool_sequence)
  - 최종 `config.json` 파싱 가능한 JSON
  - `retries === 7`, `debug === true`, `appName === "local-llm-test"` (기존값 보존)
  - 턴당 `iterations < 8`

#### L1-4 · 에러 recovery
- **사용자 프롬프트**:
  ```
  Read the file nonexistent-file.txt and tell me its first line.
  If the file does not exist, tell me so clearly and stop — do not create it.
  ```
- **인수 조건**:
  - `iterations < 10` (무한 retry 없음)
  - `file_read` 호출이 1~2회 (의미 없는 반복 없음)
  - 최종 응답에 `not found` / `does not exist` / `존재하지 않` 중 하나 포함
  - 응답에서 에이전트가 파일을 **새로 만들지 않음** (file_write 호출 0회)
  - `result.aborted === false`

#### L1-5 · Tool-call JSON schema 준수 (10회 반복)
- **사용자 프롬프트 (매 iteration 동일)**:
  ```
  Call the file_write tool with these exact parameters:
  - path: "schema-test-{N}.txt"    (N = 1..10)
  - content: "hello {N}"
  Do not call any other tool. Respond with just "done" after the tool succeeds.
  ```
- **인수 조건**:
  - 10회 중 tool_call `arguments` JSON 파싱 성공 ≥ 9회 (≥ 90%)
  - Zod schema 검증 통과 ≥ 9회 (≥ 90%)
  - 매 호출마다 required 필드(`path`, `content`) 모두 존재
  - 생성된 파일 10개 중 정상 파일 ≥ 9개, 내용 일치

---

## 4. Layer 2 — Headless CLI Single-Shot

> 빌드된 `dist/index.js`를 로컬 LLM으로 실제 호출. 엔드유저 경로 확인.

### 테스트 파일
`test/e2e/local-llm-headless.test.ts`

#### L2-1 · 텍스트 출력
- **명령**: `node dist/index.js -p "Say hello" --output-format text`
- **인수 조건**:
  - exit code 0
  - stdout 에 최소 1단어 이상의 응답
  - stderr 에 오류 없음
  - 60s 이내 종료

#### L2-2 · JSON 출력
- **명령**: `node dist/index.js -p "What is 2+2?" --output-format json`
- **인수 조건**:
  - stdout 파싱 가능한 JSON
  - JSON 필드에 `content`, `usage`, `cost` 포함
  - `cost.totalCost === 0` (로컬 모델 무료)

#### L2-3 · stream-json 출력
- **명령**: `node dist/index.js -p "Count to 3" --output-format stream-json`
- **인수 조건**:
  - NDJSON 형식 (`\n` 구분)
  - 첫 라인부터 5초 이내 출력 시작 (첫 토큰 지연)
  - 마지막 라인 `{"type":"done", ...}` 형태

#### L2-4 · 파일 읽기 with tool
- **명령**: `node dist/index.js -p "Read package.json and tell me the version"`
- **인수 조건**:
  - exit code 0
  - 응답에 실제 `package.json`의 version 값 포함 (현재 `0.2.0`)
  - tool 호출이 실제로 수행됨 (`--debug` 로 확인)

#### L2-5 · 비정상 종료 처리
- **명령**: 존재하지 않는 모델 지정 (`--model nonexistent-model`)
- **인수 조건**:
  - exit code ≠ 0
  - stderr 에 "model not found" / "404" 등 사용자 친화적 메시지
  - stack trace는 노출되지 않음 (DEBUG=1 이 아닌 경우)

---

## 5. Layer 3 — Conversation Quality (6 시나리오)

> 기존 `.claude/skills/dhelix-e2e-test/references/conversation-quality.md` 의
> harness 재사용. **턴 프롬프트는 아래에 그대로 인라인 기재** — dhelix가 받는 원문.

### 실행 방식
```bash
E2E_MODEL=GLM45AirFP8 OPENAI_API_KEY=dummy npx vitest run test/e2e/conversation-quality-*.test.ts
```

### 시나리오별 **로컬 LLM 목표치** (클라우드보다 완화)

| # | 시나리오                | 클라우드 목표 | **로컬 목표** | 비고                          |
| - | ----------------------- | ------------- | ------------- | ----------------------------- |
| 1 | Context Retention       | 5/5 assertion | **4/5**       | 소형 모델 단기 기억 편차 허용 |
| 2 | Tool Call Coherence     | 5/5           | **4/5**       | read-before-edit 규율 핵심    |
| 3 | Error Recovery          | 5/5           | **3/5**       | GLM은 복구 턴 수가 많을 수 있음 |
| 4 | Instruction Adherence   | 5/5           | **4/5**       | JSDoc · camelCase 준수        |
| 5 | Progressive Complexity  | 5/5           | **3/5**       | operator precedence 어려움 예상 |
| 6 | Contradiction Handling  | 5/5           | **4/5**       | latest-wins 원칙 준수         |

### 공통 인수 조건 (각 시나리오)
- 모든 턴이 타임아웃(턴당 180s) 없이 완료
- `metrics.totalIterations / turnsCompleted < 15` (평균 반복 상한)
- 최종 파일이 **존재하고 비어있지 않음**
- `session-log.json` 정상 기록

---

### 5.1 · Scenario 1: Context Retention

**프로젝트 디렉토리**: `test-projects/cq-local-1-context/`

**Turn 1** (dhelix 입력):
```
Create a file called config.json in the current working directory with these settings:
  - appName: "MyApp"
  - version: "2.1.0"
  - maxRetries: 3
  - timeout: 5000
Use the file_write tool. Do not add extra fields.
```

**Turn 2**:
```
Create a file called README.md that documents config.json.
List each setting name and its current value in a Markdown table
(columns: Setting | Value). Do not invent new settings.
```

**Turn 3**:
```
Now update config.json: change maxRetries to 5 and add a new field
"logLevel" with value "debug". You MUST read the file first (file_read)
before editing it (file_edit). Do not overwrite the whole file.
```

**Turn 4**:
```
Answer this WITHOUT reading any file — rely on your memory of our conversation:
What was the ORIGINAL value of maxRetries BEFORE I asked you to change it in Turn 3?
And what new field did I ask you to add? Answer in a single sentence.
```

**Turn 5**:
```
Update README.md to reflect the CURRENT config.json values.
Make sure every setting name and value in README.md matches config.json exactly.
```

**인수 조건**:
- Turn 3 후 `config.json` 에 `maxRetries: 5`, `logLevel: "debug"` 확인
- Turn 4 응답에 문자열 `"3"`과 `"logLevel"` 모두 포함 (정규식 `/\b3\b/` + `/logLevel/i`)
- Turn 4 에서 **파일 read 호출 0회** (기억 기반 답변 여부)
- Turn 5 후 README.md 의 값이 config.json 과 일치 (appName, version, maxRetries=5, timeout=5000, logLevel=debug)
- 목표: 5개 중 **4개 PASS**

---

### 5.2 · Scenario 2: Tool Call Coherence

**프로젝트 디렉토리**: `test-projects/cq-local-2-toolcall/`

**Turn 1**:
```
Create a minimal Node.js project structure in the current working directory:
  - package.json   (name: "tool-coherence", type: "module", scripts.test: "vitest run")
  - tsconfig.json  (target: ES2022, module: ESNext, strict: true)
  - src/index.ts   (empty — just a comment: "// entry point")
  - src/utils/helper.ts  (empty — just a comment: "// helpers")
Use file_write for each file. Create directories as needed.
```

**Turn 2**:
```
Read src/index.ts and tell me, word for word, what it contains. Use file_read.
```

**Turn 3**:
```
Add a function called formatDate(date: Date): string to src/utils/helper.ts.
It should return date.toISOString().slice(0, 10). Export it (named export).
Then edit src/index.ts to import formatDate and log formatDate(new Date()).
RULE: Always file_read a file before editing it with file_edit.
```

**Turn 4**:
```
There is a bug in src/utils/helper.ts: formatDate does not handle null input.
Fix it: if date is null or undefined, return "1970-01-01".
Use file_edit (not file_write). Read the file first.
```

**Turn 5**:
```
Show me the CURRENT contents of src/utils/helper.ts and src/index.ts.
Use file_read for each.
```

**인수 조건**:
- Turn 3, 4: `file_edit` 호출 직전에 같은 파일에 대한 `file_read` 존재 (tool_sequence)
- Turn 4 에서 `file_write` 호출 0회 (edit-not-write 규율)
- 같은 파일을 **같은 턴 내에서** 연속 2회 읽는 중복 없음
- 최종 `helper.ts` 에 `formatDate` 심볼과 `1970-01-01` 둘 다 존재
- 목표: 5개 중 **4개 PASS**

---

### 5.3 · Scenario 3: Error Recovery

**프로젝트 디렉토리**: `test-projects/cq-local-3-recovery/`

**Turn 1**:
```
Create a minimal Node.js vitest project in the current working directory:
  - package.json (devDependencies: vitest, scripts.test: "vitest run")
  - src/sum.ts   (export function sum(a: number, b: number): number { return a + b; })
  - src/sum.test.ts  (import { sum } from "./sum.js"; test("sum adds", () => expect(sum(1,2)).toBe(3)))
Use file_write. Do NOT run npm install yet.
```

**Turn 2**:
```
Run: npm test
Using bash_exec. This WILL FAIL because node_modules doesn't exist.
When it fails, diagnose the root cause and fix it yourself — then retry npm test.
```

**Turn 3**:
```
Now BREAK the test intentionally: edit src/sum.ts so that sum(1,2) returns a+b+1.
Run npm test — it must fail. Then fix src/sum.ts back to a+b. Run npm test again — must pass.
Show the final test output.
```

**Turn 4**:
```
Add a new function subtract(a: number, b: number): number in src/sum.ts.
Add a test for it in src/sum.test.ts. Run npm test — all tests must pass.
```

**Turn 5**:
```
Run npm test one final time and paste the exact output in your response.
```

**인수 조건**:
- Turn 2: 첫 실패 후 에이전트가 `npm install` 자동 수행 (bash_exec 호출 증거)
- Turn 3: sum.ts 가 의도적 break → fix 로 돌아옴 (최종값 `a + b`)
- Turn 5: 응답에 `passed` / `failed 0` 같은 성공 신호 포함
- 어느 턴도 `iterations ≥ 20` 로 폭주 없음 (무한 retry 방지)
- 목표: 5개 중 **3개 PASS** (로컬 모델 복구 난이도 반영)

---

### 5.4 · Scenario 4: Instruction Adherence

**프로젝트 디렉토리**: `test-projects/cq-local-4-rules/`

**Turn 1**:
```
From now on, follow these rules for ALL TypeScript code you write:
  1. All variable names use camelCase (no snake_case, no PascalCase for vars)
  2. Every exported function has a JSDoc block with @param and @returns
  3. Use const instead of let whenever reassignment is not required
  4. Never use console.log — import and use a logger from "./logger.js"
Create a file coding-rules.md in the current working directory that lists these 4 rules verbatim.
```

**Turn 2**:
```
Create src/logger.ts — export a function named logger(msg: string): void
that calls process.stdout.write(msg + "\n"). Follow the rules from Turn 1.
```

**Turn 3**:
```
Create src/math.ts with exported functions: add, subtract, multiply, divide.
All take (a: number, b: number) and return number. divide must throw on b === 0.
Follow the coding rules.
```

**Turn 4**:
```
Create src/strings.ts with exported functions: capitalize(s), truncate(s, n), slugify(s).
Follow the coding rules. Use logger from ./logger.js if you need to log anything.
```

**Turn 5**:
```
Read EVERY .ts file you created (src/logger.ts, src/math.ts, src/strings.ts)
and check the 4 rules from Turn 1. Output a Markdown report with one row per file
and one column per rule (PASS / FAIL). If any FAIL, fix it and re-check.
```

**인수 조건**:
- 최종 `.ts` 파일 3개 전체에 `console.log` 0회 (grep)
- 모든 `export` 가 붙은 함수 위에 `/**` JSDoc 블록 존재
- `let` 사용이 **정당한 경우만** (순수 재할당 필요 케이스) — 탐지는 "let → reassign없는 라인" 휴리스틱
- 변수명 정규식 `/\b[a-z][a-zA-Z0-9]*\b/` 부합 (snake_case 0회)
- Turn 5 의 자체 리포트 내용이 실제 파일 상태와 일치
- 목표: 5개 중 **4개 PASS**

---

### 5.5 · Scenario 5: Progressive Complexity

**프로젝트 디렉토리**: `test-projects/cq-local-5-progressive/`

**Turn 1**:
```
Create src/calculator.ts in the current working directory.
Export function calculate(a: number, b: number, op: string): number
Supported op values: "+", "-", "*", "/". Return the result.
Do not handle errors yet. Also create package.json with devDependency vitest.
```

**Turn 2**:
```
Extend calculator.ts:
  - Add op "%" (modulo)
  - Add op "**" (power)
  - For "/" and "%", if b === 0, throw new Error("Division by zero")
Keep the 3-argument signature unchanged. Do file_read before file_edit.
```

**Turn 3**:
```
Add an OVERLOAD: calculate also accepts a single array argument,
e.g. calculate([2, "+", 3, "*", 4]), evaluated LEFT-TO-RIGHT => 20.
The original 3-arg form MUST still work (backward compatibility).
```

**Turn 4**:
```
Change the array-form evaluation to respect operator precedence:
  - "*", "/", "%", "**" bind tighter than "+", "-"
  - So calculate([2, "+", 3, "*", 4]) = 14 (not 20)
  - Also support parentheses: calculate(["(", 2, "+", 3, ")", "*", 4]) = 20
Keep 3-arg form working.
```

**Turn 5**:
```
Create src/calculator.test.ts with vitest tests covering:
  - Turn 1: each of + - * / (4 cases)
  - Turn 2: % ** and division-by-zero throw (3 cases)
  - Turn 3 fallback: left-to-right if no precedence context (1 case)
  - Turn 4: precedence example = 14, parentheses example = 20 (2 cases)
  - Edge: empty array, invalid operator (2 cases — should throw)
Run: npx vitest run — every test must pass.
```

**인수 조건**:
- Turn 1 의 3-인자 호출 `calculate(2, "+", 3)` 여전히 `5` 반환 (backward compat)
- Turn 5 의 `npx vitest run` 결과 `failed: 0`
- `src/calculator.ts` 에 `**`, `%`, 괄호 핸들링 코드 모두 존재
- 총 테스트 케이스 수 ≥ 10
- 목표: 5개 중 **3개 PASS**

---

### 5.6 · Scenario 6: Contradiction Handling

**프로젝트 디렉토리**: `test-projects/cq-local-6-contradiction/`

**Turn 1**:
```
Create api-design.md in the current working directory describing a REST API:
  - Prefix: /api/v1/
  - Response format: { "data": ..., "error": null }
  - Authentication: JWT Bearer token in Authorization header
```

**Turn 2**:
```
Create src/server.ts — a minimal Express app implementing ONE endpoint:
GET /api/v1/ping → { data: "pong", error: null }
Add JWT Bearer middleware stub (just checks header presence).
Also create package.json with express as dependency.
Follow api-design.md exactly.
```

**Turn 3**:
```
Change of plan: use prefix /v2/ instead of /api/v1/.
Also switch from JWT to session-based auth (check req.session.userId).
Update src/server.ts. Acknowledge that this contradicts Turn 1 in your response.
```

**Turn 4**:
```
Update api-design.md to match the CURRENT code in src/server.ts.
The doc and code must be in sync now.
```

**Turn 5**:
```
I changed my mind again: go BACK to JWT auth, but KEEP /v2/ prefix.
Update both src/server.ts AND api-design.md. Remove any leftover session-auth code.
Acknowledge the back-and-forth in your response.
```

**인수 조건**:
- Turn 4 후 `api-design.md` 와 `src/server.ts` 의 prefix / auth 기술이 일치
- Turn 5 후 코드: `/v2/` 경로 + JWT 미들웨어, `req.session` 참조 0회 (grep)
- Turn 5 후 doc: `/v2/` + `JWT` 둘 다 언급, `session-based` / `session auth` 문구 0회
- Turn 3 또는 Turn 5 응답에 `contradiction` / `change` / `earlier` / `바뀌었` 중 하나 포함 (인지 증거)
- 목표: 5개 중 **4개 PASS**

---

## 5.7 Layer 3-CLI — Conversation Quality via `dbcode` CLI

> **L3와 동일한 턴 프롬프트**를, 이번엔 **실제 dbcode 바이너리**로 실행한다.
> 개발 주체는 Claude가 아니라 **dbcode 자신**. vitest 경로에서 잡히지 않는
> CLI 바인딩(세션 저장, resume, exit code, stdin/stdout 파이핑)을 검증한다.

### dbcode CLI 멀티턴 실행 규약

dbcode는 이미 아래 플래그로 멀티턴을 지원한다 (src/index.ts:38-39):
- `-p, --print <prompt>` — headless 1턴
- `-c, --continue` — 가장 최근 세션 이어쓰기
- `-r, --resume <session-id>` — 특정 세션 이어쓰기
- `--output-format json` — 결과 구조화 출력

즉 `dbcode -p "Turn1"` → `dbcode -c -p "Turn2"` → `dbcode -c -p "Turn3"` … 로
전체 시나리오를 **외부 오케스트레이터 없이 CLI만으로** 재현 가능하다.

### 턴 정의 파일 포맷 (turns.jsonl)

각 시나리오를 JSONL 로 저장. 한 줄 = 한 턴.

**예시**: `test/e2e/cli-turns/cq-1-context.jsonl`
```json
{"turn": 1, "name": "create config", "prompt": "Create a file called config.json ...", "assertions": [{"type": "file_exists", "path": "config.json"}]}
{"turn": 2, "name": "document", "prompt": "Create a file called README.md ...", "assertions": [{"type": "file_exists", "path": "README.md"}]}
{"turn": 3, "name": "update + add", "prompt": "Now update config.json ...", "assertions": [{"type": "file_contains_json", "path": "config.json", "pathExpr": "$.maxRetries", "equals": 5}]}
{"turn": 4, "name": "recall", "prompt": "Answer WITHOUT reading any file ...", "assertions": [{"type": "response_contains", "any": ["3"]}, {"type": "response_contains", "all": ["logLevel"]}]}
{"turn": 5, "name": "sync", "prompt": "Update README.md to reflect ...", "assertions": [{"type": "files_consistent", "files": ["config.json", "README.md"]}]}
```

> 프롬프트 원문은 §5.1~§5.6 의 "Turn N 프롬프트" 블록을 **그대로** 복사한다.

### CLI 러너 (scripts/run-cli-turns.sh)

`.claude/skills/dhelix-e2e-test/scripts/run-cli-turns.sh` (신규):

```bash
#!/usr/bin/env bash
# Usage: run-cli-turns.sh <turns.jsonl> <project-dir>
set -euo pipefail

TURNS_FILE="$1"
PROJECT_DIR="$2"
DBCODE_BIN="${DBCODE_BIN:-node $(pwd)/dist/index.js}"
LOG_DIR="$PROJECT_DIR/.cli-turn-logs"

mkdir -p "$PROJECT_DIR" "$LOG_DIR"
cd "$PROJECT_DIR"

SESSION_ID=""
TURN=0

while IFS= read -r line; do
  TURN=$((TURN + 1))
  PROMPT=$(echo "$line" | jq -r .prompt)
  NAME=$(echo "$line" | jq -r .name)

  echo "--- Turn $TURN: $NAME ---"

  if [[ -z "$SESSION_ID" ]]; then
    # First turn — creates session
    OUT=$($DBCODE_BIN -p "$PROMPT" --output-format json 2>"$LOG_DIR/turn-$TURN.err")
    SESSION_ID=$(echo "$OUT" | jq -r .sessionId)
  else
    # Subsequent — resume by session id
    OUT=$($DBCODE_BIN -r "$SESSION_ID" -p "$PROMPT" --output-format json 2>"$LOG_DIR/turn-$TURN.err")
  fi

  echo "$OUT" > "$LOG_DIR/turn-$TURN.json"

  # Check exit status / usage
  EXIT=$(echo "$OUT" | jq -r .exitCode // 0)
  if [[ "$EXIT" != "0" ]]; then
    echo "FAIL: turn $TURN exit=$EXIT"
    exit 1
  fi
done < "$TURNS_FILE"

echo "ALL TURNS COMPLETE — session=$SESSION_ID"
```

### Assertion Runner (scripts/verify-cli-turns.ts)

JSONL의 `assertions` 배열을 순회하며 파일/응답 검증:

```typescript
// 인터페이스만 발췌 — 구현은 scripts/verify-cli-turns.ts
interface Assertion {
  type:
    | "file_exists"
    | "file_contains"              // literal substring
    | "file_contains_json"         // JSONPath evaluate + equals
    | "response_contains"          // all / any keywords in last turn output
    | "files_consistent"           // diff by content hash of shared keys
    | "no_tool_named"              // last turn log did NOT call tool X
    | "tool_call_count";           // min/max count of tool calls in turn
  // ... type-specific fields
}
```

검증은 `.cli-turn-logs/turn-N.json` (dbcode 가 출력한 JSON) + 실제 파일 시스템을 읽어 수행. **Claude는 이 러너를 실행만** 하고, 검증 자체도 dbcode 결과 기반으로 객관적으로 수행된다.

### Test Case: L3-CLI-1 ~ L3-CLI-6

| ID        | 시나리오 / JSONL 소스                                 | 프로젝트 디렉토리                                  |
| --------- | ----------------------------------------------------- | -------------------------------------------------- |
| L3-CLI-1  | `cli-turns/cq-1-context.jsonl` (§5.1 원문)           | `test-projects/cli-cq-1-context/`                  |
| L3-CLI-2  | `cli-turns/cq-2-toolcall.jsonl` (§5.2 원문)          | `test-projects/cli-cq-2-toolcall/`                 |
| L3-CLI-3  | `cli-turns/cq-3-recovery.jsonl` (§5.3 원문)          | `test-projects/cli-cq-3-recovery/`                 |
| L3-CLI-4  | `cli-turns/cq-4-rules.jsonl` (§5.4 원문)             | `test-projects/cli-cq-4-rules/`                    |
| L3-CLI-5  | `cli-turns/cq-5-progressive.jsonl` (§5.5 원문)       | `test-projects/cli-cq-5-progressive/`              |
| L3-CLI-6  | `cli-turns/cq-6-contradiction.jsonl` (§5.6 원문)     | `test-projects/cli-cq-6-contradiction/`            |

### L3-CLI 공통 인수 조건

- 모든 턴 exit code 0
- 턴 간 `sessionId` 일관됨 (turn-1.json → turn-N.json 의 sessionId 동일)
- 세션 재개 후 이전 턴의 메시지가 context 에 보존됨 (응답에서 확인)
- SessionManager 가 디스크에 세션 저장 (sqlite 파일 크기 > 0)
- 결과 어서션이 §5.1~§5.6 의 해당 시나리오 목표와 **L3와 ±1개 이내** 차이
  (L3 library ↔ L3-CLI binary 동등성)
- `--output-format json` 출력에서 `cost.totalCost === 0`

### L3-CLI 실행 커맨드

```bash
# L3-CLI-1 (Context Retention)
bash .claude/skills/dhelix-e2e-test/scripts/run-cli-turns.sh \
  test/e2e/cli-turns/cq-1-context.jsonl \
  test-projects/cli-cq-1-context

# 이후 검증
npx tsx .claude/skills/dhelix-e2e-test/scripts/verify-cli-turns.ts \
  test/e2e/cli-turns/cq-1-context.jsonl \
  test-projects/cli-cq-1-context
```

---

## 6. Layer 4 — Project E2E (경량 스택 우선)

> 기존 5개 스택 중 **로컬 LLM이 현실적으로 통과 가능한** 스택을 우선 선정.
> JVM 스택(Gradle 의존성 해석)은 GLM-4.5-Air 로는 난이도 높음 — 후순위.

### 스택 우선순위 (로컬 LLM 기준)

| 순위 | 스택                             | 예상 통과 확률 | 전제 조건                    |
| ---- | -------------------------------- | -------------- | ---------------------------- |
| 1    | Node.js CLI (단일 파일 + vitest) | **HIGH**       | 빌드 불필요, pure TS         |
| 2    | React Dashboard (Project 1)      | MEDIUM         | npm install 네트워크 필요    |
| 3    | FastAPI (Project 2)              | MEDIUM         | python venv / pip            |
| 4    | Spring Boot + React              | LOW            | Gradle + 멀티모듈, 난이도 높 |
| 5    | Spring JSP / Flutter             | LOW            | JVM/Dart 툴체인              |

### L4-1 · Node.js CLI (**권장 첫 스택**)

#### 목적
dhelix agent-loop이 로컬 LLM 구동 하에서 **단일 TS 파일 + 단위 테스트**
조합을 엔드투엔드로 만들 수 있는지 확인. 외부 네트워크/툴체인 의존 최소화.

#### Turn 정의 (dhelix 입력 원문)

**프로젝트 디렉토리**: `test-projects/local-node-cli/`

**Turn 0 — /init & DHELIX.md**:
```
Run /init to initialize this project. Create a DHELIX.md file at the project root
that describes a Node.js 20+ CLI utility project with these conventions:
  - Runtime: Node.js 20+, ESM only (package.json "type": "module")
  - Language: TypeScript 5.x, strict mode
  - Testing: vitest (npm test → vitest run)
  - Coverage: @vitest/coverage-v8 (npm run test:coverage)
  - Style: named exports only, no default exports; camelCase vars; JSDoc on every
    exported function; const over let; throw Error for invalid input
  - Directory: src/ for source, src/*.test.ts co-located tests
  - Build command: npx tsc --noEmit
Include sections: "Project Overview", "Commands", "Code Style", "Directory Structure".
```

**Turn 1 — Scaffolding**:
```
Create these files:
  - package.json — name "local-node-cli", version "0.1.0", type "module",
    scripts: { "test": "vitest run", "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit" }, devDependencies: typescript, vitest,
    @vitest/coverage-v8, @types/node
  - tsconfig.json — target ES2022, module NodeNext, moduleResolution NodeNext,
    strict true, esModuleInterop true, skipLibCheck true, outDir dist, rootDir src
  - src/ directory (empty for now)
Use file_write for each. Refer to DHELIX.md for conventions.
```

**Turn 2 — Core module (calc.ts)**:
```
Create src/calc.ts with four exported pure functions, following DHELIX.md:
  - add(a: number, b: number): number
  - subtract(a: number, b: number): number
  - multiply(a: number, b: number): number
  - divide(a: number, b: number): number
Every function needs a JSDoc block with @param and @returns.
Named exports only. Do NOT throw yet — that comes in a later turn.
```

**Turn 3 — Initial tests**:
```
Create src/calc.test.ts with vitest tests for all 4 operations in src/calc.ts.
Use named imports: import { add, subtract, multiply, divide } from "./calc.js";
Write at least one positive case per function (4 tests minimum).
Include edge cases: negative numbers, zero, decimal values.
```

**Turn 4 — Add divideByZero check**:
```
Edit src/calc.ts so that divide throws new Error("Division by zero") when b === 0.
Use file_read before file_edit. Do not rewrite the whole file — only change divide.
Update the JSDoc of divide to document the throw (@throws).
Refer to DHELIX.md for conventions.
```

**Turn 5 — Edge-case tests**:
```
Add tests to src/calc.test.ts:
  - divide(10, 0) must throw with message "Division by zero" (use expect().toThrow())
  - divide(0, 5) must equal 0
  - multiply(0, 1e9) must equal 0
  - add(0.1, 0.2) with toBeCloseTo (floating point tolerance)
Use file_edit, not file_write. Read the file first.
```

**Turn 6 — Run tests**:
```
Run: npm install
Then run: npm test
Using bash_exec (working directory is the project dir). Show full output.
If anything fails, diagnose, fix, and re-run until all tests pass.
```

**Turn 7 — Coverage**:
```
Run: npm run test:coverage
Using bash_exec. Paste the coverage summary table in your response.
Statements coverage MUST be >= 80%. If below, ADD more tests in src/calc.test.ts
(not in calc.ts) to reach 80%+, then re-run. Keep iterating until 80%+.
```

**Turn 8 — Self-compliance check**:
```
Read DHELIX.md. Then read every file you created under src/ AND package.json.
Produce a Markdown table titled "DHELIX.md Compliance" with one row per convention
from DHELIX.md and a PASS/FAIL column plus a short note.
If any FAIL, fix the offending file (file_edit) and re-check.
Final answer must contain a summary line "Compliance: X/Y rules passed".
```

#### 인수 조건
| ID   | 항목                        | 목표 값                              |
| ---- | --------------------------- | ------------------------------------ |
| L4-1a | DHELIX.md 존재             | `test-projects/local-node-cli/DHELIX.md` |
| L4-1b | 턴 완료율                   | ≥ 8/9 (88.9%)                       |
| L4-1c | `npm test` 성공             | exit 0, failed=0                    |
| L4-1d | coverage                    | statements ≥ 80%                    |
| L4-1e | DHELIX.md read 횟수         | ≥ 2 (Turn 8 및 중간 최소 1회)       |
| L4-1f | 평균 iterations/turn        | < 20                                |
| L4-1g | 총 소요 시간                | < 45분                              |

#### 실행 분기 (2가지 경로 병행)

**(A) vitest + runAgentLoop (라이브러리)**
```bash
E2E_MODEL=GLM45AirFP8 npx vitest run test/e2e/local-llm-node-cli.test.ts
```

**(B) dbcode CLI (바이너리) — 권장 기본값**
```bash
# 1. turns.jsonl 로 9턴 정의 (Turn 0~8 원문 §6 Turn 정의에서 복사)
#    위치: test/e2e/cli-turns/l4-1-node-cli.jsonl

# 2. dbcode CLI로 순차 실행 (세션 자동 이어쓰기)
bash .claude/skills/dhelix-e2e-test/scripts/run-cli-turns.sh \
  test/e2e/cli-turns/l4-1-node-cli.jsonl \
  test-projects/local-node-cli

# 3. 외부에서 빌드/테스트 재검증 (dbcode가 이미 수행했지만 독립 확인)
(cd test-projects/local-node-cli && npm run test:coverage)
```

**동등성 인수 조건** (두 경로 모두 만족):
- L4-1a ~ L4-1g 동일
- (B)에서 SessionManager SQLite 파일이 `~/.dhelix/sessions/` 에 생성됨
- (B)의 exit code 항상 0
- (A)와 (B)의 `DHELIX.md read 횟수` 차이 ≤ 1
- (A)와 (B)의 생성 파일 목록이 완전히 일치 (파일명 기준, 내용은 모델 비결정성 허용)

### L4-2 · React Dashboard (선택)
- 기존 `project-1-react-session.test.ts`를 `E2E_MODEL=GLM45AirFP8`로 실행
- 인수 조건은 기존 테스트의 assertion 그대로 사용
- 단, **빌드 성공은 선택적**(P1). `npm install` 네트워크 실패는 테스트 환경 이슈로 분리 기록

### L4-3 · FastAPI (선택)
- 기존 `project-2-fastapi-session.test.ts`
- pytest 통과 / 80% coverage 확인
- Python 런타임 설치 전제

> **중요**: Project 4/5/6/7 (Spring 계열)은 **로컬 LLM v1에서 미실행**.
> 모델 역량이 올라간 이후(GLM-5 이상) 활성화 권장.

---

## 7. Layer 5 — Stress & Regression

### L5-1 · 장문 컨텍스트 (50K tokens)

**사전 준비 (test에서 미리 생성)**: `big.ts` — 8,000 줄 더미 TypeScript
(각 줄: `export const fieldNNNN: number = NNNN;`)

**Turn 1 프롬프트**:
```
Read the entire file big.ts in the current working directory.
Then tell me: how many exported constants are defined, and what is the value
of the constant named field4096 ?
```

**Turn 2 프롬프트**:
```
Now append a new line to big.ts: export const fieldMarker: string = "LOCAL_TEST_MARKER";
Use file_edit. Read the tail of the file first to find the right insertion point.
```

**Turn 3 프롬프트**:
```
Re-read big.ts. Confirm that fieldMarker exists and its value is "LOCAL_TEST_MARKER".
Also confirm field4096 still equals 4096 (unchanged).
```

**인수 조건**:
- 3턴 모두 타임아웃 없이 완료
- Turn 1 응답에 `8000` (또는 `8,000`) 그리고 `4096` 포함
- Turn 3 응답에 `LOCAL_TEST_MARKER` 포함
- context compaction 이벤트 로그(`events.on("context:compact")`) ≥ 1회 발생
- `maxContextTokens: 128_000` 한도 내 OOM/에러 없음

---

### L5-2 · AbortSignal 전파

**사용자 프롬프트**:
```
Write a very long response: list every positive integer from 1 to 10000,
one per line, as plain text. Do not use tools — just emit the text directly.
Do not stop until you finish.
```

**테스트 하네스**: 호출 시작 2,000ms 후 `abortController.abort()` 트리거.

**인수 조건**:
- `result.aborted === true` **또는** `AbortError` throw
- 호출 후 5초 이내에 Promise가 resolve/reject (무한 대기 없음)
- 진행 중이던 fetch의 `response.body` reader 가 `releaseLock()` 호출됨
  (local.ts:440 finally 블록 검증)
- 같은 provider 인스턴스로 **후속 호출 1회**가 정상 수행됨 (재사용 가능)

### L5-3 · 타임아웃 동작
- **시나리오**: 로컬 서버 지연 시뮬레이션 (네트워크 throttle 또는 느린 프롬프트)
- **인수 조건**:
  - `defaults.ts` 의 120s timeout 정확히 적용
  - 타임아웃 에러 메시지에 "Local model" / "timeout" 포함
  - 사용자에게 retry 옵션 제시

### L5-4 · Cost Tracker = 0
- **시나리오**: 10회 연속 호출 후 `/cost` 조회 시뮬레이션
- **인수 조건**:
  - `CostTracker.getTotal().totalCost === 0`
  - 기록된 모든 usage entry의 `cost === 0`
  - 집계 UI (있다면)에 "$0.00" 표시

### L5-5 · 네트워크 오프라인
- **시나리오**: 로컬 서버 정상 · 외부 인터넷 차단 시 정상 동작
- **인수 조건**:
  - prompt 응답 정상
  - 외부 API(Anthropic/OpenAI) 로의 fallback 시도 없음
  - "privacy mode" 취지 유지

### L5-6 · 동시성 / 순차 호출
- **시나리오**: 5개 session 순차 실행 (provider 재사용)
- **인수 조건**:
  - 각 session 독립적 메시지 배열
  - 응답이 다른 session에 섞이지 않음
  - `maxConcurrentRequests: 1` 준수 (manifest)

### L5-7 · 회귀 비교 (vs GPT-4o-mini)
- **시나리오**: 동일 프롬프트를 (a) GLM45AirFP8, (b) gpt-4o-mini 로 각각 실행
- **수집 메트릭**:
  - 턴 수 비율
  - tool 호출 정확도 차이
  - 응답 길이 분포
  - 최종 과제 완료 여부
- **목적**: 기준선 확보. 차후 GLM 업그레이드 시 이 수치를 benchmark 로 사용.

---

## 8. Report Template

각 run 종료 후 `.claude/reports/local-llm-e2e-<yyyy-mm-dd>.md` 에 아래 형식 append:

```markdown
# Local LLM E2E Report — 2026-04-17

**Model**: GLM45AirFP8
**Endpoint**: https://models.dbinc.ai/v1
**Dhelix Version**: v0.2.0 (commit 98b1d97)
**Run Duration**: 1h 48m

## Summary
| Layer | Status | Pass Rate | Notes |
| ----- | ------ | --------- | ----- |
| L0    | PASS   | 5/5       | —     |
| L1    | PASS   | 4/5       | L1-2 strategy fallback에 text-parsing 선택됨 |
| L2    | PASS   | 5/5       | —     |
| L3    | PASS   | 22/30     | 시나리오 3 (Error Recovery) 3/5 |
| L4    | PASS   | L4-1 only | Project 4~7 SKIP |
| L5    | PARTIAL| 5/7       | L5-1 compaction 시 OOM — 이슈 등록 |

## Deviation vs GPT-4o-mini
- Iterations/turn: **+62%** (GLM 8.9 vs GPT 5.5)
- Tool-call JSON 유효성: **-4%** (96% vs 100%)
- Context retention: 동등
- Instruction adherence: **-8%** (camelCase 규칙 이탈 소수 발생)

## Action Items
1. `model-capabilities.ts`에 `/^GLM/i` 패턴 등록 (L1-2 대응)
2. Project 4 (Spring Boot) 로컬 LLM 활성화는 GLM-5 대기
3. L5-1 compaction OOM → 이슈 등록 필요
```

---

## 9. Known Risks / GLM-4.5-Air 특이 이슈 체크리스트

실행 전 반드시 확인:

- [ ] `model-capabilities.ts` 에 `/^GLM/i` 패턴 등록 여부
  (미등록 시 기본 tier=low / context=8192 로 잘못 잡힘)
- [ ] `tool-call-strategy.ts` 가 GLM을 native vs text-parsing 중 올바르게 분기
- [ ] `chat-template.ts` — GLM 전용 chat template 필요 여부 (8 패밀리 중 GLM 포함 여부)
- [ ] `LOCAL_API_KEY_HEADER=model-api-key` 케이스에서 Bearer 중복 전송 없는지
- [ ] 120s 타임아웃이 로컬 GPU 서버에 충분한지 (실측 필요)
- [ ] GLM 응답의 `finish_reason` 값이 OpenAI 표준(`stop|length|tool_calls`)과 일치하는지
- [ ] 스트리밍 SSE 포맷 `data: [DONE]` 준수 여부 — local.ts:383
- [ ] 한국어 프롬프트 시 토큰 카운트 정확도 (`token-counter.ts` LRU)

---

## 10. Execution Order (권장 실행 순서)

```bash
# Day 1: L0~L2 (< 15분) — 라이브러리 + CLI 1턴
npx vitest run test/e2e/local-llm-smoke.test.ts
npx vitest run test/e2e/local-llm-toolcall.test.ts
npx vitest run test/e2e/local-llm-headless.test.ts        # dbcode -p 경로 포함

# Day 2: L3 (라이브러리) — 약 30분
E2E_MODEL=GLM45AirFP8 npx vitest run test/e2e/conversation-quality-*.test.ts

# Day 3: L3-CLI — dbcode CLI로 동일 턴 재실행 (약 40분)
for s in 1-context 2-toolcall 3-recovery 4-rules 5-progressive 6-contradiction; do
  bash .claude/skills/dhelix-e2e-test/scripts/run-cli-turns.sh \
    test/e2e/cli-turns/cq-$s.jsonl \
    test-projects/cli-cq-$s
  npx tsx .claude/skills/dhelix-e2e-test/scripts/verify-cli-turns.ts \
    test/e2e/cli-turns/cq-$s.jsonl \
    test-projects/cli-cq-$s
done

# Day 4: L4-1 (CLI 우선) + L5 (약 1시간)
bash .claude/skills/dhelix-e2e-test/scripts/run-cli-turns.sh \
  test/e2e/cli-turns/l4-1-node-cli.jsonl \
  test-projects/local-node-cli
(cd test-projects/local-node-cli && npm run test:coverage)  # 80% 재확인
npx vitest run test/e2e/local-llm-stress.test.ts            # L5
```

### Exit Criteria (런 종료 판정)
| 결과                    | 판정                     |
| ----------------------- | ------------------------ |
| L0~L2 중 하나라도 실패  | **BLOCK** — 회귀, 즉시 수정 |
| L3 평균 < 60%           | **FAIL** — 모델/프롬프트 재검토 |
| L4-1 통과 & L3 ≥ 75%    | **PASS** — 로컬 LLM 상용 가능 |
| L5 전부 통과            | **GOLD** — 배포 후보 승격 |

---

## 11. 다음 액션

**라이브러리(vitest) 경로**:
- [ ] `test/e2e/local-llm-smoke.test.ts` 생성 (L0)
- [ ] `test/e2e/local-llm-toolcall.test.ts` 생성 (L1)
- [ ] `test/e2e/local-llm-headless.test.ts` 생성 (L2 — `execSync("node dist/index.js -p ...")` 형태)
- [ ] `conversation-quality-*.test.ts` 에 `E2E_MODEL` env 로 LocalProvider 주입 경로 확인
- [ ] `test/e2e/local-llm-node-cli.test.ts` 생성 (L4-1 라이브러리 버전)
- [ ] `test/e2e/local-llm-stress.test.ts` 생성 (L5)

**dbcode CLI(바이너리) 경로 — "Claude가 아닌 dbcode로 개발"**:
- [ ] `test/e2e/cli-turns/` 디렉토리 생성
- [ ] `cq-1-context.jsonl` ~ `cq-6-contradiction.jsonl` 6개 (§5.1~§5.6 원문 복사)
- [ ] `l4-1-node-cli.jsonl` (§6 Turn 0~8 원문)
- [ ] `.claude/skills/dhelix-e2e-test/scripts/run-cli-turns.sh` 작성
- [ ] `.claude/skills/dhelix-e2e-test/scripts/verify-cli-turns.ts` 작성 (Assertion Runner)
- [ ] `dbcode -p --output-format json` 이 `sessionId` / `cost.totalCost` / `exitCode` 필드를 반환하는지 확인
  (미제공 시 `src/headless/*.ts` 에 필드 추가 — L3-CLI 검증 선결 과제)

**인프라 / 기타**:
- [ ] `.github/workflows/` 에 `local-llm-e2e.yml` 워크플로 추가 (선택)
- [ ] `model-capabilities.ts`에 GLM 패턴 등록 (9번 체크리스트 첫 항목)
- [ ] `~/.dhelix/sessions/` SQLite 파일 검증 헬퍼 (L3-CLI 인수 조건용)

---

## 부록 A · 턴 프롬프트 총 개수 & 빠른 조회표

| Layer    | Test ID    | 턴 수 | 실행 경로    | 프로젝트 디렉토리 / turns.jsonl                |
| -------- | ---------- | ----- | ------------ | ---------------------------------------------- |
| L1       | L1-1       | 1     | lib (vitest) | `test-projects/local-l1-1-readme/`             |
| L1       | L1-3       | 3     | lib          | `test-projects/local-l1-3-config/`             |
| L1       | L1-4       | 1     | lib          | `test-projects/local-l1-4-nofile/`             |
| L1       | L1-5       | 10 반복 | lib        | `test-projects/local-l1-5-schema/`             |
| L3       | Scenario 1 | 5     | lib          | `test-projects/cq-local-1-context/`            |
| L3       | Scenario 2 | 5     | lib          | `test-projects/cq-local-2-toolcall/`           |
| L3       | Scenario 3 | 5     | lib          | `test-projects/cq-local-3-recovery/`           |
| L3       | Scenario 4 | 5     | lib          | `test-projects/cq-local-4-rules/`              |
| L3       | Scenario 5 | 5     | lib          | `test-projects/cq-local-5-progressive/`        |
| L3       | Scenario 6 | 5     | lib          | `test-projects/cq-local-6-contradiction/`      |
| **L3-CLI** | L3-CLI-1 ~ 6 | 5 × 6 | **dbcode -c -p** | `test/e2e/cli-turns/cq-{1..6}-*.jsonl` → `test-projects/cli-cq-{1..6}-*/` |
| L4       | L4-1 (lib) | 9     | lib          | `test-projects/local-node-cli/` (vitest 버전)  |
| **L4-1-CLI** | L4-1 (binary) | 9 | **dbcode -c -p** | `test/e2e/cli-turns/l4-1-node-cli.jsonl` → `test-projects/local-node-cli/` |
| L5       | L5-1       | 3     | lib          | `test-projects/local-l5-1-longctx/`            |
| L5       | L5-2       | 1     | lib          | `test-projects/local-l5-2-abort/`              |

**총 턴 수**:
- 라이브러리 경로 (lib): ≈ 58턴
- dbcode CLI 경로 (binary): ≈ 39턴 (L3-CLI 30 + L4-1-CLI 9) — **Claude가 아닌 dbcode가 직접 실행**
- **합산 ≈ 97턴** (단, 프롬프트 원문은 공유되므로 유지보수 대상은 58개)

### 공통 sendTurn 사용 예시

```typescript
const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

await sendTurn(messages, "<<여기에 위 문서의 'Turn N 프롬프트' 원문 그대로 복사>>", config);

// 각 턴 후 assertion:
expect(existsSync(join(projectDir, "config.json"))).toBe(true);
```

### 검증용 참조 구현 위치

| 검증 항목                         | 구현 / 샘플 위치                                |
| --------------------------------- | ----------------------------------------------- |
| `sendTurn` 헬퍼                   | `.claude/skills/dhelix-e2e-test/references/test-harness.md` |
| tool_sequence / read-before-edit  | 위 harness + `analyzeToolPatterns()`            |
| coverage 파싱                     | `parseCoverage()` in test-harness.md            |
| DHELIX.md 읽기 카운트             | `events.on("tool:start")` → file_read args      |
| session log 출력                  | `afterAll()` → `session-log.json`               |

**중요**: 위 턴 프롬프트의 **단어 변경 금지** — 테스트 재현성/회귀 비교를 위해
원문 그대로 `sendTurn()` 에 주입할 것. 번역/요약은 dhelix 응답에서만 허용.
