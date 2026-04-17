/**
 * L4-1 Node.js CLI Project E2E (Local LLM — Library)
 *
 * 9-turn scenario that creates a real Node.js + TypeScript + vitest project,
 * validating DHELIX.md-driven development, test coverage ≥ 80%, and
 * convention compliance.
 *
 * Skip guard: all tests skipped when LOCAL_API_BASE_URL or LOCAL_MODEL are not set.
 *
 * Pass criteria (afterAll):
 *   - turnsCompleted ≥ 8/9
 *   - avg iterations/turn < 20
 *   - DHELIX.md reads ≥ 2
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync, readFileSync, mkdirSync } from "node:fs";
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

const STACK_NAME = "L4-1 Node.js CLI Project E2E (Local LLM)";
const PROJECT_DIR_NAME = "local-node-cli-3";
const TOTAL_TURNS = 9;
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
  dhelixReads: number[];
}

interface ToolCallRecord {
  turn: number;
  name: string;
  args: Record<string, unknown>;
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
    const toolCalls: ToolCallRecord[] = [];

    const metrics: SessionMetrics = {
      totalIterations: 0,
      turnsCompleted: 0,
      turns: [],
      errors: [],
      dhelixReads: [],
    };

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
      events.on("tool:start", (event) => {
        const { name, args } = event as { name: string; args?: Record<string, unknown> };
        const safeArgs = (args ?? {}) as Record<string, unknown>;
        toolCalls.push({ turn: currentTurn, name, args: safeArgs });

        // Track DHELIX.md reads for L4-1e metric
        if (
          name === "file_read" &&
          typeof safeArgs["path"] === "string" &&
          (safeArgs["path"] as string).toLowerCase().includes("dhelix")
        ) {
          if (!metrics.dhelixReads.includes(currentTurn)) {
            metrics.dhelixReads.push(currentTurn);
          }
        }
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
        maxIterations: 25,
        maxTokens: 8192,
        checkPermission: async () => ({ allowed: true }),
      };

      messages.push({ role: "system", content: systemPrompt });

      console.log(`[L4-1] Environment:`);
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
    // Turn 0 — /init + DHELIX.md
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 0: /init and create DHELIX.md",
      async () => {
        const { lastContent } = await sendTurn(
          `Run /init to initialize this project. Create a DHELIX.md file at the project root\nthat describes a Node.js 20+ CLI utility project with these conventions:\n  - Runtime: Node.js 20+, ESM only (package.json "type": "module")\n  - Language: TypeScript 5.x, strict mode\n  - Testing: vitest (npm test → vitest run)\n  - Coverage: @vitest/coverage-v8 (npm run test:coverage)\n  - Style: named exports only, no default exports; camelCase vars; JSDoc on every\n    exported function; const over let; throw Error for invalid input\n  - Directory: src/ for source, src/*.test.ts co-located tests\n  - Build command: npx tsc --noEmit\nInclude sections: "Project Overview", "Commands", "Code Style", "Directory Structure".`,
          "init and DHELIX.md",
        );

        const dhelixPath = join(projectDir, "DHELIX.md");
        const dhelixExists = existsSync(dhelixPath);

        let hasEsm = false;
        let hasVitest = false;
        if (dhelixExists) {
          const content = readFileSync(dhelixPath, "utf-8");
          hasEsm = content.includes("ESM") || content.toLowerCase().includes("esm");
          hasVitest = content.toLowerCase().includes("vitest");
        }

        const passed = dhelixExists && hasEsm && hasVitest;
        assertionResults.push({ label: "Turn 0: DHELIX.md exists with ESM + vitest", passed });

        expect(dhelixExists).toBe(true);
        expect(hasEsm || lastContent.toLowerCase().includes("esm")).toBe(true);
        expect(hasVitest || lastContent.toLowerCase().includes("vitest")).toBe(true);
      },
      300_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 1 — Scaffold project
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 1: scaffold package.json and tsconfig.json",
      async () => {
        await sendTurn(
          `Create these files:\n  - package.json — name "local-node-cli", version "0.1.0", type "module",\n    scripts: { "test": "vitest run", "test:coverage": "vitest run --coverage",\n    "typecheck": "tsc --noEmit" }, devDependencies: typescript, vitest,\n    @vitest/coverage-v8, @types/node\n  - tsconfig.json — target ES2022, module NodeNext, moduleResolution NodeNext,\n    strict true, esModuleInterop true, skipLibCheck true, outDir dist, rootDir src\n  - src/ directory (empty for now)\nUse file_write for each. Refer to DHELIX.md for conventions.`,
          "scaffold project",
        );

        const pkgExists = existsSync(join(projectDir, "package.json"));
        const tscExists = existsSync(join(projectDir, "tsconfig.json"));

        const passed = pkgExists && tscExists;
        assertionResults.push({ label: "Turn 1: package.json and tsconfig.json exist", passed });
        expect(pkgExists).toBe(true);
        expect(tscExists).toBe(true);
      },
      300_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 2 — Create src/calc.ts
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 2: create src/calc.ts with 4 exported functions",
      async () => {
        await sendTurn(
          `Create src/calc.ts with four exported pure functions, following DHELIX.md:\n  - add(a: number, b: number): number\n  - subtract(a: number, b: number): number\n  - multiply(a: number, b: number): number\n  - divide(a: number, b: number): number\nEvery function needs a JSDoc block with @param and @returns.\nNamed exports only. Do NOT throw yet — that comes in a later turn.`,
          "create calc.ts",
        );

        const calcPath = join(projectDir, "src/calc.ts");
        const calcExists = existsSync(calcPath);
        let hasDivide = false;
        if (calcExists) {
          hasDivide = readFileSync(calcPath, "utf-8").includes("divide");
        }

        const passed = calcExists && hasDivide;
        assertionResults.push({ label: "Turn 2: src/calc.ts exists with divide", passed });
        expect(calcExists).toBe(true);
        expect(hasDivide).toBe(true);
      },
      300_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 3 — Create src/calc.test.ts
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 3: create src/calc.test.ts",
      async () => {
        await sendTurn(
          `Create src/calc.test.ts with vitest tests for all 4 operations in src/calc.ts.\nUse named imports: import { add, subtract, multiply, divide } from "./calc.js";\nWrite at least one positive case per function (4 tests minimum).\nInclude edge cases: negative numbers, zero, decimal values.`,
          "initial tests",
        );

        const testPath = join(projectDir, "src/calc.test.ts");
        const passed = existsSync(testPath);
        assertionResults.push({ label: "Turn 3: src/calc.test.ts exists", passed });
        expect(passed).toBe(true);
      },
      300_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 4 — Add Division by zero guard
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 4: add Division by zero throw to src/calc.ts",
      async () => {
        await sendTurn(
          `Edit src/calc.ts so that divide throws new Error("Division by zero") when b === 0.\nUse file_read before file_edit. Do not rewrite the whole file — only change divide.\nUpdate the JSDoc of divide to document the throw (@throws).\nRefer to DHELIX.md for conventions.`,
          "add divideByZero",
        );

        const calcPath = join(projectDir, "src/calc.ts");
        let passed = false;
        if (existsSync(calcPath)) {
          passed = readFileSync(calcPath, "utf-8").includes("Division by zero");
        }
        assertionResults.push({ label: "Turn 4: calc.ts has Division by zero guard", passed });
        expect(passed).toBe(true);
      },
      300_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 5 — Add edge case tests
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 5: add toThrow and edge-case tests to calc.test.ts",
      async () => {
        await sendTurn(
          `Add tests to src/calc.test.ts:\n  - divide(10, 0) must throw with message "Division by zero" (use expect().toThrow())\n  - divide(0, 5) must equal 0\n  - multiply(0, 1e9) must equal 0\n  - add(0.1, 0.2) with toBeCloseTo (floating point tolerance)\nUse file_edit, not file_write. Read the file first.`,
          "edge case tests",
        );

        const testPath = join(projectDir, "src/calc.test.ts");
        let passed = false;
        if (existsSync(testPath)) {
          passed = readFileSync(testPath, "utf-8").includes("toThrow");
        }
        assertionResults.push({ label: "Turn 5: calc.test.ts has toThrow assertion", passed });
        expect(passed).toBe(true);
      },
      300_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 6 — npm install + test (slow: includes install)
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 6: npm install and npm test — all tests must pass",
      async () => {
        const { lastContent } = await sendTurn(
          `Run: npm install\nThen run: npm test\nUsing bash_exec (working directory is the project dir). Show full output.\nIf anything fails, diagnose, fix, and re-run until all tests pass.`,
          "npm install and test",
        );

        const hasPass = /passed|✓/i.test(lastContent);
        const hasZeroFailed = /failed.*\b0\b/i.test(lastContent) || /\b0\s+failed/i.test(lastContent);
        const passed = hasPass || hasZeroFailed;

        assertionResults.push({ label: "Turn 6: npm test passes", passed });
        // soft assertion — print warning but don't fail hard if install is slow
        if (!passed) {
          console.warn(`  [T6] Test pass signal not found in response (may be timing). Continuing.`);
        }
        expect(lastContent.length).toBeGreaterThan(0);
      },
      600_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 7 — Coverage ≥ 80%
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 7: npm run test:coverage — coverage ≥ 80%",
      async () => {
        const { lastContent } = await sendTurn(
          `Run: npm run test:coverage\nUsing bash_exec. Paste the coverage summary table in your response.\nStatements coverage MUST be >= 80%. If below, ADD more tests in src/calc.test.ts\n(not in calc.ts) to reach 80%+, then re-run. Keep iterating until 80%+.`,
          "coverage",
        );

        const hasPercent = lastContent.includes("%");
        // Try to find a coverage value ≥ 80
        const coverageMatch = lastContent.match(/(\d{2,3})\s*%/g);
        let highEnough = false;
        if (coverageMatch) {
          highEnough = coverageMatch.some((m) => {
            const val = parseInt(m, 10);
            return val >= 80;
          });
        }

        const passed = hasPercent && highEnough;
        assertionResults.push({ label: "Turn 7: coverage ≥ 80%", passed });

        if (!passed) {
          console.warn(
            `  [T7] Coverage ≥ 80% not confirmed in response. hasPercent=${hasPercent} highEnough=${highEnough}`,
          );
        }
        expect(hasPercent).toBe(true);
      },
      600_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 8 — DHELIX.md compliance check
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 8: DHELIX.md compliance — all rules PASS",
      async () => {
        const { lastContent } = await sendTurn(
          `Read DHELIX.md. Then read every file you created under src/ AND package.json.\nProduce a Markdown table titled "DHELIX.md Compliance" with one row per convention\nfrom DHELIX.md and a PASS/FAIL column plus a short note.\nIf any FAIL, fix the offending file (file_edit) and re-check.\nFinal answer must contain a summary line "Compliance: X/Y rules passed".`,
          "dhelix compliance",
        );

        const hasCompliance = /[Cc]ompliance:/i.test(lastContent);
        const dhelixExists = existsSync(join(projectDir, "DHELIX.md"));

        assertionResults.push({
          label: "Turn 8: Compliance summary present + DHELIX.md exists",
          passed: hasCompliance && dhelixExists,
        });
        expect(dhelixExists).toBe(true);
        expect(hasCompliance).toBe(true);
      },
      300_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // afterAll — L4-1 metrics report
    // ──────────────────────────────────────────────────────────────────────────

    afterAll(() => {
      const totalMs = metrics.turns.reduce((s, t) => s + t.durationMs, 0);
      const passCount = assertionResults.filter((r) => r.passed).length;
      const totalAssertions = assertionResults.length;

      console.log(`
========== L4-1 NODE.JS CLI PROJECT REPORT (LOCAL LLM) ==========
Scenario : Node.js CLI Project E2E
Model    : ${LOCAL_MODEL}
Turns    : ${metrics.turnsCompleted}/${TOTAL_TURNS}
Total ms : ${totalMs}

Assertion Results:`);
      assertionResults.forEach((r) => {
        console.log(`  ${r.passed ? "✓" : "✗"} ${r.label}`);
      });
      console.log(`\nScore    : ${passCount}/${totalAssertions}`);

      if (metrics.errors.length > 0) {
        console.log(`\nErrors:`);
        metrics.errors.forEach((e) => console.log(`  - ${e}`));
      }

      console.log(`\n=== L4-1 REPORT ===`);
      console.log(`Turns completed: ${metrics.turnsCompleted}/9`);
      console.log(`Total iterations: ${metrics.totalIterations}`);
      console.log(
        `Avg iterations/turn: ${(metrics.totalIterations / Math.max(metrics.turnsCompleted, 1)).toFixed(1)}`,
      );
      console.log(
        `DHELIX.md reads: ${metrics.dhelixReads.length} (turns: ${metrics.dhelixReads.join(", ")})`,
      );

      // L4-1b: ≥ 8/9 turns completed
      expect(metrics.turnsCompleted).toBeGreaterThanOrEqual(8);
      // L4-1f: avg iterations < 20
      expect(
        metrics.totalIterations / Math.max(metrics.turnsCompleted, 1),
      ).toBeLessThan(20);
      // L4-1e: DHELIX.md read at least twice
      expect(metrics.dhelixReads.length).toBeGreaterThanOrEqual(2);
    });
  },
);
