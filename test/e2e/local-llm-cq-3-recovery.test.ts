/**
 * L3 Conversation Quality — Scenario 3: Error Recovery
 *
 * Tests the local LLM (GLM-4.5-Air) ability to:
 *   - Create a minimal Node.js vitest project from scratch
 *   - Diagnose and recover from a failing npm test (missing node_modules)
 *   - Intentionally break a test, observe the failure, then self-repair
 *   - Extend the project with new functionality
 *   - Reproduce final passing test output
 *
 * Target: 3/5 assertions PASS (hardest scenario for GLM)
 *
 * Skip guard: all tests are skipped when LOCAL_API_BASE_URL or LOCAL_MODEL
 * are not set in the environment.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { type ChatMessage } from "../../src/llm/provider.js";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { createLLMClientForModel } from "../../src/llm/client-factory.js";
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

const STACK_NAME = "Conversation Quality — Error Recovery";
const PROJECT_DIR_NAME = "cq-local-3-recovery";
const TOTAL_TURNS = 5;
const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "GLM45AirFP8";

const hasLocalModel = !!(process.env.LOCAL_API_BASE_URL && process.env.LOCAL_MODEL);

const projectDir = resolve(__dirname, `../../test-projects/${PROJECT_DIR_NAME}`);
const progressFile = resolve(projectDir, ".e2e-progress.json");

// ============================================================
// METRICS TYPES
// ============================================================

interface TurnRecord {
  turn: number;
  name: string;
  userMessage: string;
  lastContent: string;
  iterations: number;
  durationMs: number;
}

interface SessionMetrics {
  totalIterations: number;
  turnsCompleted: number;
  toolCalls: Array<{ turn: number; name: string; args: Record<string, unknown> }>;
  turns: TurnRecord[];
  errors: string[];
}

const startTime = new Date().toISOString();

function writeProgress(
  metrics: SessionMetrics,
  currentTurn: number,
  turnName: string,
  status: "running" | "completed" | "failed",
): void {
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
    // best-effort
  }
}

// ============================================================
// TEST SUITE
// ============================================================

describe.skipIf(!hasLocalModel)(
  `E2E: ${STACK_NAME}`,
  () => {
    const messages: ChatMessage[] = [];
    let config: AgentLoopConfig;
    let currentTurn = 0;
    const metrics: SessionMetrics = {
      totalIterations: 0,
      turnsCompleted: 0,
      toolCalls: [],
      turns: [],
      errors: [],
    };

    // Assertion pass/fail tracking
    const assertionResults: Array<{ label: string; passed: boolean }> = [];

    function recordAssertion(label: string, passed: boolean): void {
      assertionResults.push({ label, passed });
      console.log(`  [ASSERT] ${passed ? "PASS" : "FAIL"}: ${label}`);
    }

    beforeAll(async () => {
      if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
      mkdirSync(projectDir, { recursive: true });

      const client = createLLMClientForModel({
        model: LOCAL_MODEL,
        baseURL: process.env.LOCAL_API_BASE_URL!,
        apiKey: process.env.LOCAL_API_KEY ?? "no-key",
        apiKeyHeader: process.env.LOCAL_API_KEY_HEADER,
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
      events.on("tool:start", ({ name, args }) => {
        metrics.toolCalls.push({
          turn: currentTurn,
          name,
          args: (args ?? {}) as Record<string, unknown>,
        });
      });

      const systemPrompt = buildSystemPrompt({
        toolRegistry,
        workingDirectory: projectDir,
      });

      config = {
        client,
        model: LOCAL_MODEL,
        toolRegistry,
        strategy: selectStrategy(LOCAL_MODEL),
        events,
        workingDirectory: projectDir,
        useStreaming: false,
        maxContextTokens: 128_000,
        maxIterations: 20,
        maxTokens: 4096,
        checkPermission: async () => ({ allowed: true }),
      };

      messages.push({ role: "system", content: systemPrompt });
      writeProgress(metrics, 0, "Setup", "running");
    }, 30_000);

    async function sendTurn(
      userMessage: string,
      turnName?: string,
    ): Promise<{ iterations: number; lastContent: string }> {
      currentTurn++;
      console.log(`\n--- Turn ${currentTurn}/${TOTAL_TURNS}: ${turnName ?? `Turn ${currentTurn}`} ---`);
      messages.push({ role: "user", content: userMessage });

      const turnStart = Date.now();
      writeProgress(metrics, currentTurn, turnName ?? `Turn ${currentTurn}`, "running");

      try {
        const result = await runAgentLoop(config, messages);
        messages.length = 0;
        messages.push(...result.messages);
        metrics.totalIterations += result.iterations;
        metrics.turnsCompleted++;

        const lastMsg = result.messages[result.messages.length - 1];
        const raw = lastMsg?.content ?? "";
        const lastContent = typeof raw === "string" ? raw : JSON.stringify(raw);

        metrics.turns.push({
          turn: currentTurn,
          name: turnName ?? `Turn ${currentTurn}`,
          userMessage,
          lastContent,
          iterations: result.iterations,
          durationMs: Date.now() - turnStart,
        });

        console.log(`  Iterations: ${result.iterations} (${Date.now() - turnStart}ms)`);
        writeProgress(metrics, currentTurn, turnName ?? `Turn ${currentTurn}`, "completed");

        return { iterations: result.iterations, lastContent };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metrics.errors.push(`Turn ${currentTurn} (${turnName ?? `Turn ${currentTurn}`}): ${errorMsg}`);
        writeProgress(metrics, currentTurn, turnName ?? `Turn ${currentTurn}`, "failed");
        throw error;
      }
    }

    // ------------------------------------------------------------------ Turn 1

    it(
      "Turn 1: create minimal vitest project scaffold",
      async () => {
        await sendTurn(
          `Create a minimal Node.js vitest project in the current working directory:
  - package.json (devDependencies: vitest, scripts.test: "vitest run")
  - src/sum.ts   (export function sum(a: number, b: number): number { return a + b; })
  - src/sum.test.ts  (import { sum } from "./sum.js"; test("sum adds", () => expect(sum(1,2)).toBe(3)))
Use file_write. Do NOT run npm install yet.`,
          "Scaffold vitest project",
        );

        const sumExists = existsSync(join(projectDir, "src/sum.ts"));
        const testExists = existsSync(join(projectDir, "src/sum.test.ts"));

        recordAssertion("src/sum.ts created", sumExists);
        recordAssertion("src/sum.test.ts created", testExists);

        expect(sumExists).toBe(true);
        expect(testExists).toBe(true);
      },
      180_000,
    );

    // ------------------------------------------------------------------ Turn 2

    it(
      "Turn 2: run npm test (fails), diagnose, install, retry",
      async () => {
        const toolCallsBefore = metrics.toolCalls.length;

        const { iterations } = await sendTurn(
          `Run: npm test
Using bash_exec. This WILL FAIL because node_modules doesn't exist.
When it fails, diagnose the root cause and fix it yourself — then retry npm test.`,
          "npm test → fail → fix → pass",
        );

        // Check that bash_exec was called (npm install must have run)
        const turn2ToolCalls = metrics.toolCalls.filter(
          (tc) => tc.turn === currentTurn && tc.name === "bash_exec",
        );
        const bashWasCalled = turn2ToolCalls.length > 0;
        const noInfiniteLoop = iterations < 20;

        recordAssertion("bash_exec called in Turn 2 (npm install ran)", bashWasCalled);
        recordAssertion("Turn 2 iterations < 20 (no infinite loop)", noInfiniteLoop);

        expect(bashWasCalled).toBe(true);
        expect(noInfiniteLoop).toBe(true);
      },
      300_000,
    );

    // ------------------------------------------------------------------ Turn 3

    it(
      "Turn 3: break test intentionally, observe failure, then fix back",
      async () => {
        const { iterations } = await sendTurn(
          `Now BREAK the test intentionally: edit src/sum.ts so that sum(1,2) returns a+b+1.
Run npm test — it must fail. Then fix src/sum.ts back to a+b. Run npm test again — must pass.
Show the final test output.`,
          "Break test → fix → pass",
        );

        const sumContent = existsSync(join(projectDir, "src/sum.ts"))
          ? readFileSync(join(projectDir, "src/sum.ts"), "utf-8")
          : "";

        const isFixed = /a\s*\+\s*b/.test(sumContent) && !/a\s*\+\s*b\s*\+\s*1/.test(sumContent);
        const noInfiniteLoop = iterations < 20;

        recordAssertion("src/sum.ts restored to a + b (not a + b + 1)", isFixed);
        recordAssertion("Turn 3 iterations < 20 (no infinite loop)", noInfiniteLoop);

        expect(isFixed).toBe(true);
        expect(noInfiniteLoop).toBe(true);
      },
      300_000,
    );

    // ------------------------------------------------------------------ Turn 4

    it(
      "Turn 4: add subtract function and test",
      async () => {
        const { iterations } = await sendTurn(
          `Add a new function subtract(a: number, b: number): number in src/sum.ts.
Add a test for it in src/sum.test.ts. Run npm test — all tests must pass.`,
          "Add subtract + test",
        );

        const noInfiniteLoop = iterations < 20;
        recordAssertion("Turn 4 iterations < 20 (no infinite loop)", noInfiniteLoop);
        // This assertion does not gate the final count — just tracked
        expect(noInfiniteLoop).toBe(true);
      },
      300_000,
    );

    // ------------------------------------------------------------------ Turn 5

    it(
      "Turn 5: final npm test run — must report passing",
      async () => {
        const { lastContent, iterations } = await sendTurn(
          `Run npm test one final time and paste the exact output in your response.`,
          "Final npm test",
        );

        const passPattern = /passed|✓|test.*pass|failed.*0/i;
        const testsPassed = passPattern.test(lastContent);
        const noInfiniteLoop = iterations < 20;

        recordAssertion("Final npm test output shows passing tests", testsPassed);
        recordAssertion("Turn 5 iterations < 20 (no infinite loop)", noInfiniteLoop);

        expect(testsPassed).toBe(true);
        expect(noInfiniteLoop).toBe(true);
      },
      300_000,
    );

    // ------------------------------------------------------------------ Summary

    afterAll(() => {
      const totalMs = metrics.turns.reduce((s, t) => s + t.durationMs, 0);
      const passCount = assertionResults.filter((a) => a.passed).length;
      const failCount = assertionResults.filter((a) => !a.passed).length;

      console.log(`
========== CQ-3 ERROR RECOVERY REPORT ==========
Model:            ${LOCAL_MODEL}
Turns Completed:  ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations: ${metrics.totalIterations}
Total Duration:   ${(totalMs / 1000).toFixed(1)}s
Total Tool Calls: ${metrics.toolCalls.length}
Errors:           ${metrics.errors.length}
${metrics.errors.length > 0 ? "Error Details:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}

Assertion Results (target: 3/5):
${assertionResults.map((a) => `  [${a.passed ? "PASS" : "FAIL"}] ${a.label}`).join("\n")}

PASS: ${passCount} / ${assertionResults.length}  (target ≥ 3)
${passCount >= 3 ? "✔ TARGET MET" : "✘ BELOW TARGET"}
=================================================`);

      writeProgress(metrics, currentTurn, "Complete", "completed");

      try {
        writeFileSync(
          resolve(projectDir, "session-log.json"),
          JSON.stringify(
            {
              stack: STACK_NAME,
              projectDir,
              model: LOCAL_MODEL,
              startedAt: startTime,
              endedAt: new Date().toISOString(),
              totalDurationMs: totalMs,
              metrics,
              assertionResults,
              passCount,
              failCount,
              targetPassed: passCount >= 3,
            },
            null,
            2,
          ),
        );
      } catch {
        // best-effort
      }
    });
  },
  { timeout: 1_800_000 },
);
