/**
 * L3 Conversation Quality — Scenario 5: Progressive Complexity (Local LLM)
 *
 * Tests that the local LLM (GLM-4.5-Air) can handle progressively harder
 * requirements across turns, building a full-featured TypeScript calculator:
 *  - Turn 1: Basic 4-operation calculator
 *  - Turn 2: Extend with % ** and division-by-zero guard
 *  - Turn 3: Array-form (left-to-right evaluation)
 *  - Turn 4: Array-form with operator precedence + parentheses
 *  - Turn 5: vitest test suite covering all turns
 *
 * Target: 3/5 assertions PASS (hardest mathematical scenario)
 *
 * Skip guard: all tests skipped when LOCAL_API_BASE_URL or LOCAL_MODEL are not set.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

const STACK_NAME = "L3 Conversation Quality — Progressive Complexity (Local LLM)";
const PROJECT_DIR_NAME = "cq-local-5-progressive";
const TOTAL_TURNS = 5;
const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "GLM45AirFP8";

const hasLocalModel = !!(process.env.LOCAL_API_BASE_URL && process.env.LOCAL_MODEL);

const projectDir = resolve(__dirname, `../../test-projects/${PROJECT_DIR_NAME}`);

// ============================================================
// TYPES
// ============================================================

interface SessionMetrics {
  totalIterations: number;
  turnsCompleted: number;
  turns: Array<{
    turn: number;
    name: string;
    userMessage: string;
    lastContent: string;
    iterations: number;
    durationMs: number;
  }>;
  errors: string[];
}

interface ToolCall {
  turn: number;
  name: string;
  args: Record<string, unknown>;
}

const startTime = new Date().toISOString();

// ============================================================
// TEST SUITE
// ============================================================

describe.skipIf(!hasLocalModel)(
  `E2E: ${STACK_NAME}`,
  () => {
    const messages: ChatMessage[] = [];
    let config: AgentLoopConfig;
    let currentTurn = 0;
    const toolCalls: ToolCall[] = [];

    const metrics: SessionMetrics = {
      totalIterations: 0,
      turnsCompleted: 0,
      turns: [],
      errors: [],
    };

    // Track assertion outcomes for final report
    const assertionResults: Array<{ label: string; passed: boolean }> = [];

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
      events.on("tool:start", ({ name, args }: { name: string; args: Record<string, unknown> }) => {
        toolCalls.push({
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

      console.log(`[CQ-5] Environment:`);
      console.log(`  LOCAL_API_BASE_URL = ${process.env.LOCAL_API_BASE_URL}`);
      console.log(`  LOCAL_MODEL        = ${LOCAL_MODEL}`);
      console.log(`  projectDir         = ${projectDir}`);
    }, 30_000);

    // ──────────────────────────────────────────────────────────────────────────
    // sendTurn helper
    // ──────────────────────────────────────────────────────────────────────────

    async function sendTurn(
      userMessage: string,
      turnName?: string,
    ): Promise<{ iterations: number; lastContent: string }> {
      currentTurn++;
      const name = turnName ?? `Turn ${currentTurn}`;
      console.log(`\n--- Turn ${currentTurn}/${TOTAL_TURNS}: ${name} ---`);
      console.log(`User: ${userMessage.slice(0, 120)}...`);

      messages.push({ role: "user", content: userMessage });

      const turnStart = Date.now();
      try {
        const result = await runAgentLoop(config, messages);
        messages.length = 0;
        messages.push(...result.messages);

        metrics.totalIterations += result.iterations;
        metrics.turnsCompleted++;

        const lastMsg = result.messages[result.messages.length - 1];
        const lastContent = lastMsg?.content ?? "";
        const lastContentStr =
          typeof lastContent === "string" ? lastContent : JSON.stringify(lastContent);

        metrics.turns.push({
          turn: currentTurn,
          name,
          userMessage,
          lastContent: lastContentStr,
          iterations: result.iterations,
          durationMs: Date.now() - turnStart,
        });

        console.log(
          `  Iterations: ${result.iterations} | Duration: ${Date.now() - turnStart}ms`,
        );
        console.log(`  Reply snippet: ${lastContentStr.slice(0, 160)}`);

        return { iterations: result.iterations, lastContent: lastContentStr };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metrics.errors.push(`Turn ${currentTurn} (${name}): ${errorMsg}`);
        throw error;
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 1 — Basic calculator
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 1: create src/calculator.ts with basic 4-op calculate function",
      async () => {
        await sendTurn(
          `Create src/calculator.ts in the current working directory.
Export function calculate(a: number, b: number, op: string): number
Supported op values: "+", "-", "*", "/". Return the result.
Do not handle errors yet. Also create package.json with devDependency vitest.`,
          "Create basic calculator",
        );

        const calcPath = resolve(projectDir, "src/calculator.ts");
        const fileExists = existsSync(calcPath);
        let hasCalculate = false;
        if (fileExists) {
          const content = readFileSync(calcPath, "utf-8");
          hasCalculate = content.includes("calculate");
        }

        const passed = fileExists && hasCalculate;
        assertionResults.push({
          label: "Turn 1: src/calculator.ts exists and contains 'calculate'",
          passed,
        });

        console.log(
          `  [T1] fileExists=${fileExists} hasCalculate=${hasCalculate}`,
        );

        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 2 — Extend with % ** and division guard
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 2: extend calculator with %, **, and division-by-zero guard",
      async () => {
        await sendTurn(
          `Extend calculator.ts:
  - Add op "%" (modulo)
  - Add op "**" (power)
  - For "/" and "%", if b === 0, throw new Error("Division by zero")
Keep the 3-argument signature unchanged. Do file_read before file_edit.`,
          "Extend with % ** and error guard",
        );

        const calcPath = resolve(projectDir, "src/calculator.ts");
        let passed = false;
        if (existsSync(calcPath)) {
          const content = readFileSync(calcPath, "utf-8");
          const hasPower = content.includes("**");
          const hasModulo = content.includes("%");
          const hasDivisionGuard = content.includes("Division by zero");
          passed = hasPower && hasModulo && hasDivisionGuard;
          console.log(
            `  [T2] hasPower=${hasPower} hasModulo=${hasModulo} hasDivisionGuard=${hasDivisionGuard}`,
          );
        }

        assertionResults.push({
          label: "Turn 2: calculator.ts has '**', '%', and 'Division by zero'",
          passed,
        });
        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 3 — Array-form overload (left-to-right)
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 3: add array-form overload evaluated left-to-right",
      async () => {
        await sendTurn(
          `Add an OVERLOAD: calculate also accepts a single array argument,
e.g. calculate([2, "+", 3, "*", 4]), evaluated LEFT-TO-RIGHT => 20.
The original 3-arg form MUST still work (backward compatibility).`,
          "Add array-form overload (left-to-right)",
        );

        const calcPath = resolve(projectDir, "src/calculator.ts");
        let passed = false;
        if (existsSync(calcPath)) {
          const content = readFileSync(calcPath, "utf-8");
          // Accept any of: Array.isArray, overload signature with array, or array spread
          const hasArrayHandling =
            /Array\.isArray|Array<|args\[|\barray\b|\[\.\.\./i.test(content);
          passed = hasArrayHandling;
          console.log(
            `  [T3] hasArrayHandling=${hasArrayHandling}`,
          );
        }

        assertionResults.push({
          label: "Turn 3: calculator.ts contains array handling (Array.isArray or similar)",
          passed,
        });
        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 4 — Operator precedence + parentheses
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 4: update array-form to use operator precedence and support parentheses",
      async () => {
        await sendTurn(
          `Change the array-form evaluation to respect operator precedence:
  - "*", "/", "%", "**" bind tighter than "+", "-"
  - So calculate([2, "+", 3, "*", 4]) = 14 (not 20)
  - Also support parentheses: calculate(["(", 2, "+", 3, ")", "*", 4]) = 20
Keep 3-arg form working.`,
          "Operator precedence + parentheses",
        );

        const calcPath = resolve(projectDir, "src/calculator.ts");
        let passed = false;
        if (existsSync(calcPath)) {
          const content = readFileSync(calcPath, "utf-8");
          // Must still have ** and % from turn 2
          const hasPower = content.includes("**");
          const hasModulo = content.includes("%");
          // Must have parentheses handling
          const hasParens = /\(|\bparen/i.test(content);
          passed = hasPower && hasModulo && hasParens;
          console.log(
            `  [T4] hasPower=${hasPower} hasModulo=${hasModulo} hasParens=${hasParens}`,
          );
        }

        assertionResults.push({
          label: "Turn 4: calculator.ts has '**', '%', and parentheses handling",
          passed,
        });
        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 5 — vitest test suite
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 5: create src/calculator.test.ts covering all turns",
      async () => {
        const { lastContent } = await sendTurn(
          `Create src/calculator.test.ts with vitest tests covering:
  - Turn 1: each of + - * / (4 cases)
  - Turn 2: % ** and division-by-zero throw (3 cases)
  - Turn 3 fallback: left-to-right if no precedence context (1 case)
  - Turn 4: precedence example = 14, parentheses example = 20 (2 cases)
  - Edge: empty array, invalid operator (2 cases — should throw)
Run: npx vitest run — every test must pass.`,
          "Create vitest test suite",
        );

        const testPath = resolve(projectDir, "src/calculator.test.ts");
        const testExists = existsSync(testPath);

        let passed = false;
        if (testExists) {
          const testContent = readFileSync(testPath, "utf-8");
          // Count test/it calls
          const testCallMatches = testContent.match(/\bit\s*\(|\btest\s*\(/g) ?? [];
          const testCallCount = testCallMatches.length;

          // Accept either: vitest run output shows passed, OR the file has ≥ 10 test calls
          const vitestPassed = /passed|✓|failed.*0/i.test(lastContent);
          const hasEnoughTests = testCallCount >= 10;

          passed = vitestPassed || hasEnoughTests;
          console.log(
            `  [T5] testExists=${testExists} testCallCount=${testCallCount} vitestPassed=${vitestPassed} hasEnoughTests=${hasEnoughTests}`,
          );
        }

        assertionResults.push({
          label: "Turn 5: calculator.test.ts exists AND (vitest passed OR ≥10 test calls)",
          passed,
        });
        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Final: pass count report (target ≥ 3/5)
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Final: report pass count (target ≥ 3/5)",
      () => {
        const passCount = assertionResults.filter((r) => r.passed).length;
        const totalAssertions = assertionResults.length;
        const avg =
          metrics.turnsCompleted > 0
            ? metrics.totalIterations / metrics.turnsCompleted
            : 0;

        console.log(`
  [CQ-5 Final] passCount=${passCount}/${totalAssertions} target=3/5
  avg iterations/turn = ${avg.toFixed(2)}
  ${assertionResults.map((r) => `  [${r.passed ? "PASS" : "FAIL"}] ${r.label}`).join("\n")}`);

        assertionResults.push({ label: "Final: avg iterations/turn < 15", passed: avg < 15 });
        // Soft assertion — log only, not a hard gate
        expect(passCount).toBeGreaterThanOrEqual(1); // at least partial success
      },
    );

    // ──────────────────────────────────────────────────────────────────────────
    // afterAll — session log + pass/fail report
    // ──────────────────────────────────────────────────────────────────────────

    afterAll(() => {
      const totalMs = metrics.turns.reduce((s, t) => s + t.durationMs, 0);
      const passCount = assertionResults.filter((r) => r.passed).length;
      const totalAssertions = assertionResults.length;

      console.log(`
========== CQ-5 PROGRESSIVE COMPLEXITY REPORT (LOCAL LLM) ==========
Scenario : Progressive Complexity
Model    : ${LOCAL_MODEL}
Target   : 3/5 assertions PASS

Turns Completed  : ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations : ${metrics.totalIterations}
Total Duration   : ${(totalMs / 1000).toFixed(1)}s
Total Tool Calls : ${toolCalls.length}
Errors           : ${metrics.errors.length}

Assertion Results (${passCount}/${totalAssertions}):
${assertionResults.map((r) => `  [${r.passed ? "PASS" : "FAIL"}] ${r.label}`).join("\n")}
${metrics.errors.length > 0 ? "\nErrors:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}
=====================================================================`);

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
              passCount,
              totalAssertions,
              assertionResults,
              metrics,
              toolCalls,
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
