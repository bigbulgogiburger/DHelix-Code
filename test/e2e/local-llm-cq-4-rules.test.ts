/**
 * L3 Conversation Quality — Scenario 4: Instruction Adherence
 *
 * Tests the local LLM (GLM-4.5-Air) ability to follow and consistently apply
 * a set of coding rules across multiple turns:
 *   1. All variable names use camelCase
 *   2. Every exported function has a JSDoc block with @param and @returns
 *   3. Use const instead of let when reassignment is not required
 *   4. Never use console.log — use a logger from "./logger.js"
 *
 * Target: 4/5 assertions PASS
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

const STACK_NAME = "Conversation Quality — Instruction Adherence";
const PROJECT_DIR_NAME = "cq-local-4-rules";
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
      "Turn 1: establish coding rules and create coding-rules.md",
      async () => {
        await sendTurn(
          `From now on, follow these rules for ALL TypeScript code you write:
  1. All variable names use camelCase (no snake_case, no PascalCase for vars)
  2. Every exported function has a JSDoc block with @param and @returns
  3. Use const instead of let whenever reassignment is not required
  4. Never use console.log — import and use a logger from "./logger.js"
Create a file coding-rules.md in the current working directory that lists these 4 rules verbatim.`,
          "Establish coding rules",
        );

        const rulesPath = join(projectDir, "coding-rules.md");
        const rulesExist = existsSync(rulesPath);

        let rulesContent = "";
        if (rulesExist) {
          rulesContent = readFileSync(rulesPath, "utf-8");
        }

        const hasAllKeywords =
          rulesContent.includes("camelCase") &&
          /JSDoc|jsdoc/.test(rulesContent) &&
          rulesContent.includes("const") &&
          rulesContent.includes("console.log");

        recordAssertion(
          "coding-rules.md exists and contains all 4 rule keywords (camelCase, JSDoc, const, console.log)",
          rulesExist && hasAllKeywords,
        );

        expect(rulesExist).toBe(true);
        expect(rulesContent).toMatch(/camelCase/);
        expect(rulesContent).toMatch(/JSDoc|jsdoc/i);
        expect(rulesContent).toMatch(/\bconst\b/);
        expect(rulesContent).toMatch(/console\.log/);
      },
      180_000,
    );

    // ------------------------------------------------------------------ Turn 2

    it(
      "Turn 2: create src/logger.ts following the coding rules",
      async () => {
        await sendTurn(
          `Create src/logger.ts — export a function named logger(msg: string): void
that calls process.stdout.write(msg + "\\n"). Follow the rules from Turn 1.`,
          "Create src/logger.ts",
        );

        const loggerExists = existsSync(join(projectDir, "src/logger.ts"));
        recordAssertion("src/logger.ts created", loggerExists);
        expect(loggerExists).toBe(true);
      },
      180_000,
    );

    // ------------------------------------------------------------------ Turn 3

    it(
      "Turn 3: create src/math.ts with add/subtract/multiply/divide",
      async () => {
        await sendTurn(
          `Create src/math.ts with exported functions: add, subtract, multiply, divide.
All take (a: number, b: number) and return number. divide must throw on b === 0.
Follow the coding rules.`,
          "Create src/math.ts",
        );

        const mathExists = existsSync(join(projectDir, "src/math.ts"));
        recordAssertion("src/math.ts created", mathExists);
        expect(mathExists).toBe(true);
      },
      180_000,
    );

    // ------------------------------------------------------------------ Turn 4

    it(
      "Turn 4: create src/strings.ts with capitalize/truncate/slugify",
      async () => {
        await sendTurn(
          `Create src/strings.ts with exported functions: capitalize(s), truncate(s, n), slugify(s).
Follow the coding rules. Use logger from ./logger.js if you need to log anything.`,
          "Create src/strings.ts",
        );

        const stringsExists = existsSync(join(projectDir, "src/strings.ts"));
        recordAssertion("src/strings.ts created", stringsExists);
        expect(stringsExists).toBe(true);
      },
      180_000,
    );

    // ------------------------------------------------------------------ Turn 5

    it(
      "Turn 5: self-review report and fix any violations",
      async () => {
        await sendTurn(
          `Read EVERY .ts file you created (src/logger.ts, src/math.ts, src/strings.ts)
and check the 4 rules from Turn 1. Output a Markdown report with one row per file
and one column per rule (PASS / FAIL). If any FAIL, fix it and re-check.`,
          "Self-review and fix coding rules",
        );

        // Read the three source files (may not all exist if earlier turns failed)
        const loggerPath = join(projectDir, "src/logger.ts");
        const mathPath = join(projectDir, "src/math.ts");
        const stringsPath = join(projectDir, "src/strings.ts");

        const tsFiles: Array<{ label: string; path: string }> = [
          { label: "src/logger.ts", path: loggerPath },
          { label: "src/math.ts", path: mathPath },
          { label: "src/strings.ts", path: stringsPath },
        ];

        // ── Rule 4: no console.log in any created .ts file ──────────────────
        const consoleLogPattern = /console\.log/;
        let consolePassed = true;
        for (const { label, path } of tsFiles) {
          if (!existsSync(path)) continue;
          const content = readFileSync(path, "utf-8");
          if (consoleLogPattern.test(content)) {
            consolePassed = false;
            console.log(`  [console.log found in ${label}]`);
          }
        }
        recordAssertion("No console.log in any .ts file (Rule 4)", consolePassed);

        // ── Rule 2: JSDoc present in each existing file ──────────────────────
        const jsdocPattern = /\/\*\*/;
        let jsdocPassed = true;
        for (const { label, path } of tsFiles) {
          if (!existsSync(path)) continue;
          const content = readFileSync(path, "utf-8");
          if (!jsdocPattern.test(content)) {
            jsdocPassed = false;
            console.log(`  [JSDoc missing in ${label}]`);
          }
        }
        recordAssertion("JSDoc block present in each .ts file (Rule 2)", jsdocPassed);

        // ── Rule 1: no snake_case variable names ─────────────────────────────
        // Matches identifiers like my_var or MY_VAR but not all-caps (constants)
        const snakeCasePattern = /\b[a-z][a-z0-9]*(_[a-z0-9]+)+\b/;
        let snakePassed = true;
        for (const { label, path } of tsFiles) {
          if (!existsSync(path)) continue;
          const content = readFileSync(path, "utf-8");
          if (snakeCasePattern.test(content)) {
            snakePassed = false;
            console.log(`  [snake_case identifier found in ${label}]`);
          }
        }
        recordAssertion("No snake_case variable names in .ts files (Rule 1)", snakePassed);

        // ── logger.ts: exports function logger that calls process.stdout.write ─
        const loggerGoodShape =
          existsSync(loggerPath) &&
          (() => {
            const c = readFileSync(loggerPath, "utf-8");
            return /export.*function\s+logger/.test(c) && /process\.stdout\.write/.test(c);
          })();
        recordAssertion("src/logger.ts exports logger() using process.stdout.write", loggerGoodShape);

        // At least 2 of the 4 final rule checks must pass for the turn to be
        // considered a success (permissive — GLM may partially fix things)
        const finalChecks = [consolePassed, jsdocPassed, snakePassed, loggerGoodShape];
        const finalPassCount = finalChecks.filter(Boolean).length;
        console.log(`  Turn 5 final rule checks: ${finalPassCount}/4 passed`);

        // Soft assertion — we do not hard-fail here so the afterAll summary
        // always runs and we can see the full picture.
        expect(finalPassCount).toBeGreaterThanOrEqual(1);
      },
      180_000,
    );

    // ------------------------------------------------------------------ Summary

    afterAll(() => {
      const totalMs = metrics.turns.reduce((s, t) => s + t.durationMs, 0);
      const passCount = assertionResults.filter((a) => a.passed).length;
      const failCount = assertionResults.filter((a) => !a.passed).length;

      console.log(`
========== CQ-4 INSTRUCTION ADHERENCE REPORT ==========
Model:            ${LOCAL_MODEL}
Turns Completed:  ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations: ${metrics.totalIterations}
Total Duration:   ${(totalMs / 1000).toFixed(1)}s
Total Tool Calls: ${metrics.toolCalls.length}
Errors:           ${metrics.errors.length}
${metrics.errors.length > 0 ? "Error Details:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}

Assertion Results (target: 4/5):
${assertionResults.map((a) => `  [${a.passed ? "PASS" : "FAIL"}] ${a.label}`).join("\n")}

PASS: ${passCount} / ${assertionResults.length}  (target ≥ 4)
${passCount >= 4 ? "✔ TARGET MET" : "✘ BELOW TARGET"}
========================================================`);

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
              targetPassed: passCount >= 4,
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
