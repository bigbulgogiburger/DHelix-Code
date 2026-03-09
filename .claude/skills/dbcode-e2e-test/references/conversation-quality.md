# Conversation Quality Test Scenarios

## Overview

프로젝트 빌드/커버리지가 아닌 **대화 자체의 품질**을 검증하는 테스트 시나리오.
`runAgentLoop()`를 통해 멀티턴 대화를 실행하고, 에이전트의 대화 능력을 측정한다.

---

## Test Mode: conversation-quality

프로젝트 E2E 테스트와 달리, 이 모드는:

- 간단한 mock 프로젝트나 빈 디렉토리에서 실행
- 빌드/커버리지 대신 **대화 메트릭**에 집중
- 각 시나리오는 5-8턴으로 구성 (E2E보다 짧음)
- 실행 시간: 시나리오당 3-5분

---

## Scenario 1: Context Retention (컨텍스트 유지)

에이전트가 이전 턴의 정보를 정확히 기억하는지 검증.

### Turn Definitions

```
Turn 1: "Create a file called config.json with these settings:
  - appName: 'MyApp'
  - version: '2.1.0'
  - maxRetries: 3
  - timeout: 5000"

Turn 2: "Create a file called README.md that documents config.json.
  List each setting name and its current value."

Turn 3: "Now update config.json: change maxRetries to 5 and add a new field
  'logLevel' with value 'debug'."

Turn 4: "What were the ORIGINAL values of maxRetries before I asked you to change it?
  And what new field did I ask you to add? Answer in a single sentence."

Turn 5: "Update README.md to reflect the current config.json values.
  Make sure it matches exactly."
```

### Assertions

| ID   | Type              | Description                                        |
| ---- | ----------------- | -------------------------------------------------- |
| cr-1 | file_contains     | config.json has maxRetries: 5 (updated)            |
| cr-2 | file_contains     | config.json has logLevel: "debug" (new field)      |
| cr-3 | response_contains | Turn 4 response mentions "3" (original maxRetries) |
| cr-4 | response_contains | Turn 4 response mentions "logLevel"                |
| cr-5 | file_consistency  | README.md values match config.json after Turn 5    |

### Quality Metrics

- **Factual Accuracy**: Does the agent correctly recall prior values?
- **No Hallucination**: Does the agent invent values not mentioned?
- **Cross-file Consistency**: Do files created in different turns stay consistent?

---

## Scenario 2: Tool Call Coherence (도구 호출 일관성)

에이전트가 도구를 논리적 순서로 사용하는지 검증.

### Turn Definitions

```
Turn 1: "Create a Node.js project structure:
  - src/index.ts (main entry)
  - src/utils/helper.ts (utility functions)
  - package.json
  - tsconfig.json"

Turn 2: "Read src/index.ts and tell me what it contains."

Turn 3: "Add a function called 'formatDate' to src/utils/helper.ts.
  Then import and use it in src/index.ts."

Turn 4: "There's a bug in helper.ts — the formatDate function doesn't
  handle null input. Fix it by adding a null check."

Turn 5: "Show me the final version of both files."
```

### Assertions

| ID   | Type               | Description                                                         |
| ---- | ------------------ | ------------------------------------------------------------------- |
| tc-1 | tool_sequence      | Turn 1: file_write calls create directories before files            |
| tc-2 | tool_sequence      | Turn 3: file_read before file_edit (reads helper.ts before editing) |
| tc-3 | tool_sequence      | Turn 4: file_read before file_edit (reads to find the bug location) |
| tc-4 | tool_present       | Turn 4: uses file_edit (not file_write to overwrite entire file)    |
| tc-5 | no_redundant_tools | No duplicate consecutive reads of the same file                     |

### Quality Metrics

- **Read-before-Write**: Always reads a file before editing it
- **Minimal Writes**: Uses file_edit for changes, not full file_write overwrites
- **No Redundant Calls**: Doesn't read the same file twice without reason

---

## Scenario 3: Error Recovery (에러 복구)

에이전트가 실패 상황에서 자체 복구하는 능력을 검증.

### Turn Definitions

```
Turn 1: "Create a Python project:
  - main.py with a Flask app
  - requirements.txt with flask dependency
  - tests/test_app.py with basic tests"

Turn 2: "Run the tests with: python -m pytest tests/ -v"
  (This may fail if pytest is not installed — agent should handle this)

Turn 3: "The test_app.py has a failing test (if agent wrote one that passes,
  manually break it or ask): Fix the failing test and run again."

Turn 4: "Add a new endpoint /api/health that returns {'status': 'ok'}.
  Write a test for it and make sure ALL tests pass."

Turn 5: "Run all tests one final time and show me the results."
```

### Assertions

| ID   | Type               | Description                                             |
| ---- | ------------------ | ------------------------------------------------------- |
| er-1 | error_handled      | If Turn 2 fails, agent attempts to install dependencies |
| er-2 | retry_success      | Agent retries the command after fixing the issue        |
| er-3 | no_panic           | Agent doesn't abandon the task on first failure         |
| er-4 | all_tests_pass     | Final test run in Turn 5 has 0 failures                 |
| er-5 | iterations_bounded | No turn exceeds 15 iterations (no infinite retry loop)  |

### Quality Metrics

- **Diagnosis**: Does the agent identify the root cause of failure?
- **Fix Strategy**: Does it apply the right fix (install deps, fix code, etc.)?
- **Retry Discipline**: Does it retry only after making a meaningful change?

---

## Scenario 4: Instruction Adherence (지시 준수)

에이전트가 세션 전반에 걸쳐 사용자 지시를 일관되게 따르는지 검증.

### Turn Definitions

```
Turn 1: "From now on, follow these rules for ALL code you write:
  1. All variable names must use camelCase
  2. Every function must have a JSDoc comment
  3. Use 'const' instead of 'let' whenever possible
  4. No console.log — use a logger function instead
  Create a file called coding-rules.md with these rules."

Turn 2: "Create src/math.ts with functions: add, subtract, multiply, divide.
  Follow the rules from Turn 1."

Turn 3: "Create src/string-utils.ts with functions: capitalize, truncate, slugify.
  Follow the coding rules."

Turn 4: "Create src/index.ts that imports and re-exports everything from
  math.ts and string-utils.ts. Follow the coding rules."

Turn 5: "Review ALL .ts files and check if they follow the 4 rules
  from Turn 1. List any violations."
```

### Assertions

| ID   | Type                 | Description                                         |
| ---- | -------------------- | --------------------------------------------------- |
| ia-1 | pattern_present      | All .ts files have JSDoc on every function          |
| ia-2 | pattern_absence      | No `console.log` in any .ts file                    |
| ia-3 | pattern_absence      | No `let` where `const` could be used                |
| ia-4 | naming_convention    | All variable names are camelCase                    |
| ia-5 | self_review_accurate | Turn 5 response correctly identifies any violations |

### Quality Metrics

- **Rule Persistence**: Are rules from Turn 1 still followed in Turn 4?
- **Self-Awareness**: Does the agent's self-review match actual compliance?
- **Consistency**: Are rules applied uniformly (not just in the turn they were stated)?

---

## Scenario 5: Progressive Complexity (점진적 복잡성)

단순한 시작에서 점점 복잡해지는 요구사항을 처리하는 능력을 검증.

### Turn Definitions

```
Turn 1: "Create a simple TypeScript function in src/calculator.ts:
  function calculate(a: number, b: number, op: string): number
  Support +, -, *, / operations."

Turn 2: "Extend the calculator to support:
  - Modulo (%) operation
  - Power (**) operation
  - Handle division by zero (throw Error)"

Turn 3: "Now make it support chained operations:
  calculate([2, '+', 3, '*', 4]) should evaluate left-to-right → 20
  Keep the original 2-argument version working too (backward compatible)."

Turn 4: "Add operator precedence: * and / before + and -.
  calculate([2, '+', 3, '*', 4]) should now → 14
  Add parentheses support: ['(', 2, '+', 3, ')', '*', 4] → 20"

Turn 5: "Write comprehensive tests in src/calculator.test.ts covering:
  - Basic operations (Turn 1)
  - Extended operations (Turn 2)
  - Chained operations (Turn 3)
  - Operator precedence (Turn 4)
  - Edge cases: division by zero, empty input, invalid operator
  Run the tests."
```

### Assertions

| ID   | Type                | Description                                                |
| ---- | ------------------- | ---------------------------------------------------------- |
| pc-1 | backward_compatible | Original 2-arg function still works after Turn 3-4 changes |
| pc-2 | feature_complete    | All operations from all turns are present in final code    |
| pc-3 | tests_pass          | All tests pass in Turn 5                                   |
| pc-4 | test_coverage       | Tests cover scenarios from ALL turns, not just the latest  |
| pc-5 | no_regression       | Earlier features (basic ops) not broken by later additions |

### Quality Metrics

- **Backward Compatibility**: Does adding features break existing ones?
- **Incremental Design**: Does the code evolve cleanly or get rewritten each turn?
- **Cumulative Testing**: Do tests cover the full history, not just recent changes?

---

## Scenario 6: Contradiction Handling (모순 처리)

사용자가 이전 턴과 모순되는 지시를 줄 때 에이전트의 대응을 검증.

### Turn Definitions

```
Turn 1: "Create a REST API design document in api-design.md:
  - All endpoints use /api/v1/ prefix
  - Response format: { data: ..., error: null }
  - Authentication: JWT Bearer token"

Turn 2: "Implement the API in src/server.ts with Express.
  Follow the design in api-design.md exactly."

Turn 3: "Actually, change the API prefix to /v2/ instead of /api/v1/.
  Also use session-based auth instead of JWT."

Turn 4: "Update api-design.md to match the current implementation."

Turn 5: "Wait, I think JWT was better. Change back to JWT auth
  but keep the /v2/ prefix. Update both the code and the design doc."
```

### Assertions

| ID   | Type                | Description                                              |
| ---- | ------------------- | -------------------------------------------------------- |
| ch-1 | doc_code_sync       | After Turn 4, api-design.md matches server.ts            |
| ch-2 | latest_wins         | After Turn 5, JWT auth is used (latest instruction)      |
| ch-3 | prefix_correct      | After Turn 5, /v2/ prefix (not /api/v1/)                 |
| ch-4 | no_stale_code       | No leftover session-based auth code after Turn 5         |
| ch-5 | acknowledged_change | Agent acknowledges the contradiction in Turn 3 or Turn 5 |

### Quality Metrics

- **Latest-Wins**: Does the agent apply the most recent instruction?
- **Stale Cleanup**: Does it remove code from superseded instructions?
- **Transparency**: Does it acknowledge when instructions contradict?

---

## Test Harness Additions

대화 품질 테스트에서는 기존 harness에 추가 메트릭을 수집한다:

```typescript
interface ConversationQualityMetrics extends SessionMetrics {
  // Response quality
  responseRelevance: Array<{ turn: number; relevant: boolean; reason?: string }>;

  // Tool call analysis
  toolCallPatterns: Array<{
    turn: number;
    pattern: "read-before-edit" | "write-without-read" | "redundant-read" | "edit-not-write";
    file: string;
  }>;

  // Context retention
  contextChecks: Array<{
    turn: number;
    asked: string;
    expectedInResponse: string;
    found: boolean;
  }>;

  // Instruction compliance
  ruleViolations: Array<{
    turn: number;
    rule: string;
    file: string;
    violation: string;
  }>;
}
```

### Tool Call Pattern Analysis

```typescript
function analyzeToolPatterns(
  toolCalls: SessionMetrics["toolCalls"],
): ConversationQualityMetrics["toolCallPatterns"] {
  const patterns: ConversationQualityMetrics["toolCallPatterns"] = [];
  const readFiles = new Set<string>();

  for (const call of toolCalls) {
    const filePath = call.args?.file_path?.toString() ?? "";

    if (call.tool === "file_read") {
      readFiles.add(filePath);
    }

    if (call.tool === "file_edit" && !readFiles.has(filePath)) {
      patterns.push({
        turn: call.turn,
        pattern: "write-without-read",
        file: filePath,
      });
    }

    if (call.tool === "file_edit" && readFiles.has(filePath)) {
      patterns.push({
        turn: call.turn,
        pattern: "read-before-edit",
        file: filePath,
      });
    }

    if (call.tool === "file_write" && readFiles.has(filePath)) {
      patterns.push({
        turn: call.turn,
        pattern: "edit-not-write",
        file: filePath,
      });
    }
  }

  return patterns;
}
```

### Response Content Validation

```typescript
function validateResponseContains(
  response: string,
  expected: string[],
): { found: string[]; missing: string[] } {
  const lower = response.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];

  for (const term of expected) {
    if (lower.includes(term.toLowerCase())) {
      found.push(term);
    } else {
      missing.push(term);
    }
  }

  return { found, missing };
}
```

---

## Evaluation Report Template (Conversation Quality)

```markdown
# dbcode Conversation Quality Report

**Date:** {DATE}
**Model:** {MODEL_NAME}
**Scenarios Tested:** {N}/6

## Summary

| Scenario             | Context | Tools | Recovery | Rules | Complexity | Contradictions | Score |
| -------------------- | ------- | ----- | -------- | ----- | ---------- | -------------- | ----- |
| 1. Context Retention | PASS    | -     | -        | -     | -          | -              | 4.5/5 |
| 2. Tool Coherence    | -       | PASS  | -        | -     | -          | -              | 4.0/5 |
| ...                  | ...     | ...   | ...      | ...   | ...        | ...            | ...   |

## Per-Scenario Details

### Scenario 1: Context Retention

- **Turns:** 5/5 completed
- **Context Checks:** 4/4 passed (recalled all prior values)
- **Hallucinations:** 0
- **Cross-file Consistency:** PASS
- **Notable:** Agent correctly recalled original maxRetries=3 after changing to 5

### Scenario 2: Tool Call Coherence

- **Read-before-Edit Rate:** 100% (8/8 edits had prior reads)
- **Redundant Reads:** 1 (src/index.ts read twice in Turn 3)
- **Edit vs Write:** 85% edits used file_edit (good)
- **Notable:** One unnecessary file_write that should have been file_edit

## Aggregate Metrics

| Metric                 | Value | Target |
| ---------------------- | ----- | ------ |
| Context Retention Rate | 95%   | >= 90% |
| Read-before-Edit Rate  | 92%   | >= 95% |
| Error Recovery Rate    | 100%  | >= 80% |
| Rule Compliance Rate   | 88%   | >= 85% |
| Backward Compatibility | 100%  | 100%   |
| Contradiction Handling | 90%   | >= 85% |
| Avg Iterations/Turn    | 4.2   | < 10   |
```

---

## When to Run Conversation Quality Tests

- 모델 변경 후 (gpt-4o → gpt-4.1-mini 등)
- agent-loop.ts 또는 system-prompt-builder.ts 수정 후
- 도구 정의 변경 후 (tools/definitions/)
- context-manager.ts 또는 conversation.ts 수정 후
- 새 모델 프로바이더 추가 후
