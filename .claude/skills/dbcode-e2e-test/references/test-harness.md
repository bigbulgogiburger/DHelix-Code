# E2E Test Harness Template

## Complete Test File Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type ChatMessage } from "../../src/llm/provider.js";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { createOpenAIClient } from "../../src/llm/client.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { buildSystemPrompt } from "../../src/core/system-prompt-builder.js";
import { fileReadTool } from "../../src/tools/definitions/file-read.js";
import { fileWriteTool } from "../../src/tools/definitions/file-write.js";
import { fileEditTool } from "../../src/tools/definitions/file-edit.js";
import { bashExecTool } from "../../src/tools/definitions/bash-exec.js";
import { globSearchTool } from "../../src/tools/definitions/glob-search.js";
import { grepSearchTool } from "../../src/tools/definitions/grep-search.js";

// ============================================================
// CONFIGURATION
// ============================================================

const STACK_NAME = "__STACK_NAME__"; // e.g., "Spring Boot + React (TypeScript)"
const PROJECT_DIR_NAME = "__DIR_NAME__"; // e.g., "springboot-react-taskboard"
const TOTAL_TURNS = __TOTAL_TURNS__; // e.g., 9
const MODEL = process.env.E2E_MODEL ?? "gpt-4.1-mini";
const hasApiKey = !!process.env.OPENAI_API_KEY;

const projectDir = resolve(__dirname, `../../test-projects/${PROJECT_DIR_NAME}`);
const progressFile = resolve(projectDir, ".e2e-progress.json");

// ============================================================
// MONITORING & PROGRESS
// ============================================================

interface SessionMetrics {
  totalIterations: number;
  turnsCompleted: number;
  dbcodeReads: string[];
  toolCalls: Array<{ turn: number; tool: string; args: Record<string, unknown> }>;
  errors: string[];
}

const startTime = new Date().toISOString();

function writeProgress(
  metrics: SessionMetrics,
  currentTurn: number,
  turnName: string,
  status: "running" | "completed" | "failed",
) {
  try {
    writeFileSync(
      progressFile,
      JSON.stringify(
        {
          currentTurn,
          totalTurns: TOTAL_TURNS,
          turnName,
          status,
          iterations: metrics.totalIterations,
          turnsCompleted: metrics.turnsCompleted,
          dbcodeReads: metrics.dbcodeReads.length,
          dbcodeReadTurns: metrics.dbcodeReads,
          lastToolCall: metrics.toolCalls.at(-1)?.tool ?? "none",
          totalToolCalls: metrics.toolCalls.length,
          errors: metrics.errors,
          startedAt: startTime,
          lastUpdatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch {
    // Progress file is best-effort, don't fail the test
  }
}

// ============================================================
// TEST SUITE
// ============================================================

describe.skipIf(!hasApiKey)(
  `E2E: ${STACK_NAME} Multi-Turn Session`,
  () => {
    const messages: ChatMessage[] = [];
    let config: AgentLoopConfig;
    let currentTurn = 0;
    const metrics: SessionMetrics = {
      totalIterations: 0,
      turnsCompleted: 0,
      dbcodeReads: [],
      toolCalls: [],
      errors: [],
    };

    // ---- Setup ----
    beforeAll(async () => {
      // Clean project directory
      if (existsSync(projectDir)) {
        rmSync(projectDir, { recursive: true, force: true });
      }
      mkdirSync(projectDir, { recursive: true });

      // Create LLM client and tools
      const client = createOpenAIClient({
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY!,
      });

      const toolRegistry = new ToolRegistry();
      toolRegistry.registerAll([
        fileReadTool,
        fileWriteTool,
        fileEditTool,
        bashExecTool,
        globSearchTool,
        grepSearchTool,
      ]);

      const events = createEventEmitter();

      // Monitor DBCODE.md reads and all tool calls
      events.on(
        "tool:start",
        ({ name, id, args }: { name: string; id: string; args?: Record<string, unknown> }) => {
          metrics.toolCalls.push({ turn: currentTurn, tool: name, args: args ?? {} });
          if (name === "file_read" && args?.file_path?.toString().includes("DBCODE.md")) {
            metrics.dbcodeReads.push(`Turn ${currentTurn}`);
          }
        },
      );

      const strategy = selectStrategy(MODEL);

      const systemPrompt = buildSystemPrompt({
        toolRegistry,
        workingDirectory: projectDir,
      });

      config = {
        client,
        model: MODEL,
        toolRegistry,
        strategy,
        events,
        workingDirectory: projectDir,
        useStreaming: false,
        maxContextTokens: 128_000,
        maxIterations: 25,
        maxTokens: 16384,
        checkPermission: async () => ({ allowed: true }),
      };

      // Initialize system message
      messages.push({ role: "system", content: systemPrompt });

      // Write initial progress
      writeProgress(metrics, 0, "Setup", "running");
    }, 30_000);

    // ---- sendTurn Helper ----
    async function sendTurn(
      userMessage: string,
      turnName?: string,
    ): Promise<{
      iterations: number;
      lastContent: string;
    }> {
      currentTurn++;
      const name = turnName ?? `Turn ${currentTurn}`;

      console.log(`\n--- Turn ${currentTurn}/${TOTAL_TURNS}: ${name} ---`);
      console.log(`User: ${userMessage.slice(0, 120)}...`);

      // Write progress: starting this turn
      writeProgress(metrics, currentTurn, name, "running");

      messages.push({ role: "user", content: userMessage });

      try {
        const result = await runAgentLoop(config, messages);
        messages.length = 0;
        messages.push(...result.messages);

        metrics.totalIterations += result.iterations;
        metrics.turnsCompleted++;

        console.log(`  Iterations: ${result.iterations}`);
        console.log(`  Total iterations so far: ${metrics.totalIterations}`);

        // Write progress: turn completed
        writeProgress(metrics, currentTurn, name, "completed");

        const lastMsg = result.messages[result.messages.length - 1];
        return {
          iterations: result.iterations,
          lastContent: lastMsg?.content ?? "",
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metrics.errors.push(`Turn ${currentTurn} (${name}): ${errorMsg}`);
        writeProgress(metrics, currentTurn, name, "failed");
        throw error;
      }
    }

    // ---- Turn Tests (INSERT TURNS HERE) ----
    // See references/stack-*.md for per-stack turn definitions
    //
    // Example:
    // it("Turn 0: Initialize project with DBCODE.md", async () => {
    //   await sendTurn("Run /init to initialize...", "Initialize DBCODE.md");
    //   expect(existsSync(resolve(projectDir, "DBCODE.md"))).toBe(true);
    // }, 180_000);

    // ---- Final Evaluation ----
    afterAll(() => {
      const report = `
========== E2E SESSION REPORT ==========
Stack: ${STACK_NAME}
Project: ${projectDir}
Model: ${MODEL}
Turns Completed: ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations: ${metrics.totalIterations}
Avg Iterations/Turn: ${(metrics.totalIterations / Math.max(metrics.turnsCompleted, 1)).toFixed(1)}
DBCODE.md Reads: ${metrics.dbcodeReads.length} (${metrics.dbcodeReads.join(", ") || "none"})
Total Tool Calls: ${metrics.toolCalls.length}
Errors: ${metrics.errors.length}
${metrics.errors.length > 0 ? "Error Details:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}
==========================================`;
      console.log(report);

      // Write final progress
      writeProgress(metrics, currentTurn, "Complete", "completed");
    });
  },
  { timeout: 1_800_000 },
); // 30 minute total timeout
```

## Permission Handling

For E2E tests, bypass permissions since all tool calls are expected:

```typescript
const config: AgentLoopConfig = {
  // ... other config ...
  checkPermission: async () => ({ allowed: true }),
};
```

## Build Validation Pattern

Use this INSIDE the test assertions (not run by Claude directly):

```typescript
function validateBuild(command: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd,
      timeout: 120_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output };
  } catch (err) {
    const error = err as { stderr?: string; stdout?: string };
    return {
      success: false,
      output: `STDOUT: ${error.stdout ?? ""}\nSTDERR: ${error.stderr ?? ""}`,
    };
  }
}
```

## Coverage Parsing Pattern

```typescript
function parseCoverage(output: string): number | null {
  // Vitest/Jest format: "All files  |  85.2 |  80.1 |  90.3 |  85.2"
  const vitestMatch = output.match(/All files\s*\|\s*([\d.]+)/);
  if (vitestMatch) return parseFloat(vitestMatch[1]);

  // JaCoCo format: "Total: 85%"
  const jacocoMatch = output.match(/Total:\s*([\d.]+)%/);
  if (jacocoMatch) return parseFloat(jacocoMatch[1]);

  // lcov/istanbul format: "Statements   : 85.2%"
  const istanbulMatch = output.match(/Statements\s*:\s*([\d.]+)%/);
  if (istanbulMatch) return parseFloat(istanbulMatch[1]);

  // Flutter format: "85.2% coverage"
  const flutterMatch = output.match(/([\d.]+)%\s*coverage/i);
  if (flutterMatch) return parseFloat(flutterMatch[1]);

  return null;
}
```

## Important Reminders

1. **This test file is the ONLY thing Claude writes.** All project files inside
   `test-projects/` are created by dbcode's agent loop (the LLM inside `runAgentLoop()`).

2. **Claude runs this test, then watches.** After generating this file, Claude runs
   `npx vitest run` in the background and monitors `.e2e-progress.json` every 30 seconds.

3. **If dbcode fails to produce working code, that's the test result.** Claude does NOT
   fix the generated code — it reports the failure.
