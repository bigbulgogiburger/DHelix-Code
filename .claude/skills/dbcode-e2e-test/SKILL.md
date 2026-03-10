---
name: dbcode-e2e-test
disabled: true
description: |
  E2E validation skill for the dbcode CLI AI coding assistant. Two test modes:
  (1) Project E2E — multi-turn tests creating real projects across 5+ tech stacks, validating
  builds, 80% coverage, and DBCODE.md compliance.
  (2) Conversation Quality — multi-turn tests verifying context retention, tool call coherence,
  error recovery, instruction adherence, progressive complexity, and contradiction handling.

  Use this skill when: running E2E tests for dbcode, validating coding ability across tech stacks,
  testing multi-turn conversation quality, verifying /init and DBCODE.md system, benchmarking
  dbcode against real-world project creation, or evaluating conversation quality after model/prompt changes.
---

# dbcode E2E & Conversation Quality Validation Skill

## Purpose

Two validation modes:

1. **Project E2E** — Validate that dbcode can create real-world projects through multi-turn conversations
   (initialization, implementation, building, testing, 80%+ coverage).
2. **Conversation Quality** — Validate dbcode's multi-turn conversation capabilities
   (context retention, tool call coherence, error recovery, instruction adherence, contradiction handling).

## CRITICAL: Role Separation — You Are the Observer, Not the Builder

This is the most important principle of this entire skill. Read it carefully.

**dbcode** is the system under test. It has an agent loop (`runAgentLoop()`) that calls an LLM,
which then uses tools (file_write, bash_exec, etc.) to create project code. The E2E test validates
that this agent loop can produce working projects.

**You (Claude)** are the test engineer. Your job is to:

1. Generate the test harness file (a `.test.ts` file that calls `runAgentLoop()`)
2. Run the test via `npx vitest run <test-file>`
3. Observe the output and report results

**You must NEVER:**

- Directly create project files (no writing Java, Kotlin, TypeScript, Dart, HTML, CSS, etc. into the test-projects/ directory)
- Directly run build commands on the project (no `./gradlew build`, `npm run build` yourself)
- Directly fix code that dbcode generated (if it fails, that's a valid test failure)
- Write any file inside `test-projects/` yourself — every file there must come from dbcode's agent loop

Think of it like this: you're a QA engineer writing a test script. You write the test,
press "run", and watch. If the software under test (dbcode) fails to produce working code,
you report the failure — you don't jump in and fix the code yourself. That would defeat
the entire purpose of the test.

### What Goes in the Test File vs What dbcode Does

```
┌─────────────────────────────────────────────────────────┐
│ YOU (Claude) write this:                                │
│                                                         │
│  test/e2e/project-N-session.test.ts                     │
│  ├── Import runAgentLoop, tools, config                 │
│  ├── Define turn prompts (user messages)                │
│  ├── Set up event monitoring (DBCODE.md reads)          │
│  ├── Call sendTurn() for each turn                      │
│  ├── Assert file existence, build success, coverage     │
│  └── Generate session report                            │
│                                                         │
│  Then run: npx vitest run test/e2e/project-N-...test.ts │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼ triggers
┌─────────────────────────────────────────────────────────┐
│ DBCODE (runAgentLoop) does this:                        │
│                                                         │
│  Inside the test, runAgentLoop() calls the LLM which:   │
│  ├── Reads the user prompt                              │
│  ├── Decides which tools to call                        │
│  ├── Calls file_write to create project files           │
│  ├── Calls bash_exec to run builds/tests                │
│  ├── Reads DBCODE.md for conventions                    │
│  └── Produces all project code autonomously             │
│                                                         │
│  Output: test-projects/{stack-name}/ with all files     │
└─────────────────────────────────────────────────────────┘
```

### After Running the Test

Once `npx vitest run` completes, you CAN:

- Read generated files to inspect quality (for the report)
- Run build/test commands to verify results (for double-checking)
- Analyze DBCODE.md compliance by reading what dbcode produced

But you must NOT modify any files dbcode generated. If something is wrong,
report it as a test finding — don't fix it.

---

## Test Philosophy

The tests are designed to catch real failure modes:

- Can the agent maintain context across 8-12 turns?
- Does it produce code that actually compiles and passes tests?
- Does it respect DBCODE.md project instructions?
- Can it handle diverse tech stacks (JVM, Node, Flutter)?
- Does it achieve meaningful test coverage, not just token tests?

---

## Test Modes

### Mode 1: Project E2E (기존)

실제 프로젝트를 빌드하고 테스트 커버리지를 검증. 아래 "How to Run a Full E2E Validation" 참조.

### Mode 2: Conversation Quality (신규)

프로젝트 빌드가 아닌 **대화 자체의 품질**을 검증. `references/conversation-quality.md` 참조.

| Scenario                  | 검증 대상           | 턴 수 | 실행 시간 |
| ------------------------- | ------------------- | ----- | --------- |
| 1. Context Retention      | 이전 턴 정보 기억   | 5     | ~3분      |
| 2. Tool Call Coherence    | 도구 호출 순서/논리 | 5     | ~3분      |
| 3. Error Recovery         | 실패 시 자체 복구   | 5     | ~5분      |
| 4. Instruction Adherence  | 세션 전반 지시 준수 | 5     | ~3분      |
| 5. Progressive Complexity | 점진적 복잡성 대응  | 5     | ~4분      |
| 6. Contradiction Handling | 모순 지시 처리      | 5     | ~3분      |

#### 대화 품질 테스트 실행 방법

1. `references/conversation-quality.md`에서 시나리오 선택
2. `references/test-harness.md` 템플릿 기반으로 테스트 파일 생성
   - `test/e2e/conversation-quality-{scenario}.test.ts`
   - 프로젝트 디렉토리: `test-projects/conversation-quality-{N}/`
3. 시나리오별 턴 프롬프트와 assertion 삽입
4. 추가 메트릭 수집 (도구 호출 패턴, 응답 내용 검증, 규칙 위반)

#### 대화 품질 전용 Assertions

프로젝트 E2E와 달리 빌드/커버리지 대신:

| Assertion 유형        | 설명                                               |
| --------------------- | -------------------------------------------------- |
| `response_contains`   | 에이전트 응답에 특정 키워드 포함 여부              |
| `tool_sequence`       | 도구 호출 순서 검증 (read → edit, 디렉토리 → 파일) |
| `no_redundant_tools`  | 불필요한 중복 도구 호출 없음                       |
| `pattern_present`     | 생성된 코드에 특정 패턴 존재 (JSDoc, camelCase 등) |
| `pattern_absence`     | 생성된 코드에 금지 패턴 부재 (console.log, let 등) |
| `file_consistency`    | 다른 턴에서 생성된 파일 간 일관성                  |
| `backward_compatible` | 이후 턴 변경이 이전 기능을 깨지 않음               |
| `error_handled`       | 실패 시 적절한 복구 시도                           |
| `acknowledged_change` | 모순 지시 시 인지/설명 여부                        |

#### 언제 대화 품질 테스트를 실행하는가

- 모델 변경 후 (gpt-4o → gpt-4.1-mini 등)
- `agent-loop.ts` 또는 `system-prompt-builder.ts` 수정 후
- 도구 정의 변경 후 (`tools/definitions/`)
- `context-manager.ts` 또는 `conversation.ts` 수정 후
- 새 모델 프로바이더 추가 후

---

## Architecture

```
test/e2e/
├── project-*-session.test.ts           # Project E2E tests (YOU write these)
├── conversation-quality-*.test.ts      # Conversation quality tests (YOU write these)
test-projects/
├── {stack-name}/                       # Project E2E output (DBCODE writes these)
├── conversation-quality-{N}/           # Conversation quality output (DBCODE writes these)
references/
├── stack-*.md                          # Per-stack turn definitions & expectations
├── conversation-quality.md             # Conversation quality scenarios & metrics
├── test-harness.md                     # Test file template (shared by both modes)
scripts/
├── validate-session.ts                 # Post-session validation script
```

All E2E tests use the real `runAgentLoop()` from `src/core/agent-loop.ts` with actual
LLM API calls. Tests are skipped when `OPENAI_API_KEY` is absent.

---

## How to Run a Full E2E Validation

### Step 1: Choose Target Stacks

Available stacks (read the relevant `references/stack-*.md` for turn details):

| ID  | Stack                             | Reference                                |
| --- | --------------------------------- | ---------------------------------------- |
| 1   | Spring MVC + JSP + JavaScript     | `references/stack-spring-jsp.md`         |
| 2   | Spring Boot + React (TypeScript)  | `references/stack-springboot-react.md`   |
| 3   | Spring Boot + Vue 3 (TypeScript)  | `references/stack-springboot-vue.md`     |
| 4   | Spring Boot + Flutter (Dart)      | `references/stack-springboot-flutter.md` |
| 5   | Flutter WebView + Spring Boot API | `references/stack-flutter-webview.md`    |

### Step 2: Generate the Test File

You generate a vitest test file. This file is the ONLY thing you write.
Read `references/test-harness.md` for the complete harness template.

The test file calls `runAgentLoop()` with user prompts and asserts on the results.
All actual project creation happens inside `runAgentLoop()` — the LLM inside dbcode
decides what files to create, what commands to run, and how to structure the project.

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
// ... other imports from test-harness.md
```

### Step 3: Run the Test (Don't Do dbcode's Job)

After generating the test file, run it:

```bash
npx vitest run test/e2e/project-N-session.test.ts
```

Then WAIT. The test will take 10-30 minutes depending on the stack.
dbcode's agent loop will autonomously:

- Create DBCODE.md
- Scaffold the project
- Implement features
- Run builds
- Write tests
- Check compliance

You observe the vitest output and report results.

### Step 4: Mandatory Turn Structure

Every test session MUST include these turns in order. These are the USER PROMPTS
inside the test file — dbcode receives them and acts on them autonomously.

#### Turn 0: /init (MANDATORY FIRST TURN)

```
"Run /init to initialize this project. Create a DBCODE.md that describes a {STACK_NAME}
project with the following conventions: {CONVENTIONS}. Include build commands, test
commands, code style rules, and directory structure."
```

**Assertions (in the test file):**

- `DBCODE.md` exists at project root
- Contains project name, stack info, build/test commands

#### Turn 1: Project Scaffolding

```
"Create the project structure for a {PROJECT_TYPE} application.
Set up {BUILD_TOOL} with all necessary dependencies.
Follow the conventions in DBCODE.md."
```

**Assertions:**

- Build config file exists (build.gradle, package.json, pubspec.yaml)
- Source directory structure created

#### Turns 2-6: Feature Implementation

Each turn adds one feature. Be specific about requirements:

```
"Implement {FEATURE} with the following requirements:
- {REQUIREMENT_1}
- {REQUIREMENT_2}
Refer to DBCODE.md for coding conventions."
```

The phrase "Refer to DBCODE.md" forces the agent to re-read project instructions.

#### Turn 7: Build Validation (MANDATORY)

```
"Build the project. Fix any compilation errors. Run: {BUILD_COMMAND}"
```

**Assertions:**

- Build succeeds (validated by the test's `validateBuild()` helper)

#### Turn 8: Test Writing + Coverage (MANDATORY)

```
"Write comprehensive tests to achieve at least 80% code coverage.
Run tests with coverage: {TEST_COVERAGE_COMMAND}.
Fix any failing tests."
```

**Assertions:**

- Tests pass (no failures)
- Coverage report shows >= 80%

#### Turn 9: DBCODE.md Compliance Check (MANDATORY)

```
"Review the project against DBCODE.md conventions. List any violations and fix them."
```

**Assertions:**

- Agent reads DBCODE.md (verify via event tracking)

### Step 5: DBCODE.md Reference Monitoring

Track whether dbcode reads DBCODE.md during the session. This is implemented
in the test harness via event listeners:

```typescript
events.on("tool:start", ({ name, args }) => {
  if (name === "file_read" && args?.file_path?.toString().includes("DBCODE.md")) {
    dbcodeReads.push(`Turn ${currentTurn}`);
  }
});

// After session:
expect(dbcodeReads.length).toBeGreaterThanOrEqual(2);
```

### Step 6: Evaluation Criteria

After the test completes, evaluate the results:

#### Quantitative Metrics (Automated — inside the test file)

| Metric          | Target | How to Measure                   |
| --------------- | ------ | -------------------------------- |
| Build Success   | 100%   | `validateBuild()` exit code      |
| Test Pass Rate  | 100%   | Parse test runner output         |
| Test Coverage   | >= 80% | Parse coverage report            |
| DBCODE.md Reads | >= 2   | Event monitoring count           |
| Turn Completion | 100%   | All turns complete without error |
| Iterations/Turn | < 25   | `result.iterations` per turn     |

#### Qualitative Metrics (You review AFTER the test runs)

After the test completes, you may read the generated files to assess:

| Metric               | Rating (1-5) | What to Look For                            |
| -------------------- | ------------ | ------------------------------------------- |
| Code Quality         |              | Idiomatic patterns, no copy-paste smell     |
| Architecture         |              | Proper separation of concerns, layering     |
| Test Quality         |              | Meaningful assertions, edge cases covered   |
| DBCODE.md Compliance |              | Actually follows declared conventions       |
| Error Recovery       |              | Handles build/test failures gracefully      |
| Context Retention    |              | References earlier turns, no contradictions |

### Step 7: Generate Evaluation Report

After running all stacks, produce a markdown report:

```markdown
# dbcode E2E Validation Report

**Date:** {DATE}
**Model:** {MODEL_NAME}
**Stacks Tested:** {N}/5

## Summary

| Stack      | Build | Tests | Coverage | DBCODE Refs | Score |
| ---------- | ----- | ----- | -------- | ----------- | ----- |
| Spring+JSP | PASS  | 12/12 | 85%      | 3           | 4.2/5 |
| ...        | ...   | ...   | ...      | ...         | ...   |

## Per-Stack Details

### Stack 1: {NAME}

- **Turns:** {N} completed / {N} total
- **Total Iterations:** {N}
- **DBCODE.md References:** {list of turns}
- **Build Output:** {summary}
- **Coverage Report:** {summary}
- **Issues Found:** {list}
- **Qualitative Assessment:** {notes from reading generated code}
```

---

## The sendTurn Helper

All tests use this exact pattern for multi-turn simulation:

```typescript
let currentTurn = 0;

async function sendTurn(userMessage: string): Promise<{
  iterations: number;
  lastContent: string;
}> {
  currentTurn++;
  console.log(`\n--- Turn ${currentTurn} ---`);
  console.log(`User: ${userMessage.slice(0, 100)}...`);

  messages.push({ role: "user", content: userMessage });
  const result = await runAgentLoop(config, messages);
  messages.length = 0;
  messages.push(...result.messages);

  metrics.totalIterations += result.iterations;
  metrics.turnsCompleted++;

  const lastMsg = result.messages[result.messages.length - 1];
  return {
    iterations: result.iterations,
    lastContent: lastMsg?.content ?? "",
  };
}
```

Key: `messages.length = 0; messages.push(...result.messages)` replaces the array
contents in-place, maintaining the reference while updating to the agent loop's
output (which includes tool call messages interleaved).

---

## Configuration Constants

```typescript
const E2E_CONFIG = {
  model: process.env.E2E_MODEL ?? "gpt-4.1-mini",
  maxIterations: 25,
  maxTokens: 16384,
  maxContextTokens: 128_000,
  useStreaming: false,
  turnTimeout: 180_000, // 3 minutes per turn
  buildTimeout: 120_000, // 2 minutes for builds
  testTimeout: 120_000, // 2 minutes for tests
  minCoverage: 80, // 80% minimum
  minDbcodeReads: 2, // Must read DBCODE.md at least twice
};
```

## Progress Reporting (30-second intervals)

The user wants to see what's happening during the long-running test. Since tests
can take 10-30 minutes, you must report progress every ~30 seconds.

### How It Works

The test harness writes progress to a file at a well-known path. You run the test
in the background, then periodically read this file and report to the user.

**Progress file path:** `test-projects/{stack-name}/.e2e-progress.json`

The test harness writes this file after every turn completes:

```json
{
  "currentTurn": 3,
  "totalTurns": 9,
  "turnName": "Implement Task REST API",
  "status": "running",
  "iterations": 12,
  "totalIterations": 38,
  "dbcodeReads": 2,
  "lastToolCall": "file_write",
  "filesCreated": 15,
  "errors": [],
  "startedAt": "2026-03-07T10:30:00Z",
  "lastUpdatedAt": "2026-03-07T10:35:22Z"
}
```

### Implementation in the Test Harness

Add this to the `sendTurn()` helper (already included in `references/test-harness.md`):

```typescript
import { writeFileSync } from "node:fs";

const progressFile = resolve(projectDir, ".e2e-progress.json");

function writeProgress(turnName: string, status: "running" | "completed" | "failed") {
  writeFileSync(
    progressFile,
    JSON.stringify(
      {
        currentTurn,
        totalTurns: TOTAL_TURNS,
        turnName,
        status,
        iterations: metrics.totalIterations,
        dbcodeReads: metrics.dbcodeReads.length,
        lastToolCall: metrics.toolCalls.at(-1)?.tool ?? "none",
        filesCreated: 0, // optionally count with glob
        errors: metrics.errors,
        startedAt: startTime,
        lastUpdatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
```

### Your Monitoring Loop

After launching the test in the background:

```
1. Run `npx vitest run test/e2e/project-N-session.test.ts` with run_in_background
2. Every ~30 seconds, read the progress file:
   Read test-projects/{stack-name}/.e2e-progress.json
3. Report to user:
   "Turn 3/9: Implement Task REST API — 12 iterations so far, 2 DBCODE.md reads, 15 files created"
4. Repeat until the background task completes
5. Read final vitest output and report results
```

If the progress file doesn't exist yet, the test hasn't started its first turn —
just tell the user "Test is starting up, waiting for first turn..."

If the status is "failed", report the error immediately rather than waiting.

---

## Workflow Checklist

### Mode 1: Project E2E

1. Read the relevant `references/stack-*.md` for the target stack
2. Read `references/test-harness.md` for the test file template
3. Generate the test file at `test/e2e/project-N-session.test.ts`
4. Run `npx vitest run test/e2e/project-N-session.test.ts` in background (`run_in_background: true`)
5. Every 30 seconds, read `.e2e-progress.json` and report status to user
6. When test completes, read vitest output and report pass/fail
7. Read generated files in `test-projects/` for qualitative review
8. Produce an evaluation report

### Mode 2: Conversation Quality

1. Read `references/conversation-quality.md` for scenario definitions
2. Read `references/test-harness.md` for the test file template
3. Choose scenario(s): context-retention, tool-coherence, error-recovery, instruction-adherence, progressive-complexity, contradiction-handling
4. Generate the test file at `test/e2e/conversation-quality-{scenario}.test.ts`
   - 프로젝트 디렉토리: `test-projects/conversation-quality-{N}/`
   - 시나리오별 턴 프롬프트와 assertion 삽입
   - 대화 품질 전용 메트릭 수집 코드 추가
5. Run `npx vitest run test/e2e/conversation-quality-*.test.ts` in background
6. Every 30 seconds, read `.e2e-progress.json` and report status to user
7. When test completes, read vitest output and report pass/fail
8. Produce a conversation quality report (see `references/conversation-quality.md` report template)

Remember: You NEVER touch `test-projects/` with write operations. All files there
are created by dbcode's agent loop.

## Quick Reference

### Project E2E

- Test harness template: `references/test-harness.md`
- Stack-specific turns: `references/stack-*.md`
- Validation script: `scripts/validate-session.ts`
- Existing E2E examples: `test/e2e/project-*-session.test.ts`

### Conversation Quality

- Scenario definitions: `references/conversation-quality.md`
- Test harness template: `references/test-harness.md` (shared)
- Conversation quality tests: `test/e2e/conversation-quality-*.test.ts`

### Shared

- Agent loop source: `src/core/agent-loop.ts`
- Instruction loader: `src/instructions/loader.ts`
- Init command: `src/commands/init.ts`
- Existing multi-turn integration test: `test/integration/multi-turn.test.ts`
