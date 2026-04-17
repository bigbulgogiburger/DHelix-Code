/**
 * L3 Conversation Quality — Scenario 1: Context Retention (Local LLM)
 *
 * Tests that the local LLM (GLM-4.5-Air) retains multi-turn context:
 *  - Creates files with specific values
 *  - Recalls original values from memory (without re-reading)
 *  - Correctly applies incremental edits across turns
 *
 * Target: 4/5 assertions PASS (relaxed from cloud 5/5)
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

const STACK_NAME = "L3 Conversation Quality — Context Retention (Local LLM)";
const PROJECT_DIR_NAME = "cq-local-1-context";
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

      console.log(`[CQ-1] Environment:`);
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
    // Turn 1 — Create config.json
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 1: create config.json with initial values",
      async () => {
        await sendTurn(
          `Create a file called config.json in the current working directory with these settings:
  - appName: "MyApp"
  - version: "2.1.0"
  - maxRetries: 3
  - timeout: 5000
Use the file_write tool. Do not add extra fields.`,
          "Create config.json",
        );

        const passed = existsSync(resolve(projectDir, "config.json"));
        assertionResults.push({ label: "Turn 1: config.json exists", passed });
        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 2 — Create README.md
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 2: create README.md documenting config.json",
      async () => {
        await sendTurn(
          `Create a file called README.md that documents config.json.
List each setting name and its current value in a Markdown table
(columns: Setting | Value). Do not invent new settings.`,
          "Document config.json",
        );

        const passed = existsSync(resolve(projectDir, "README.md"));
        assertionResults.push({ label: "Turn 2: README.md exists", passed });
        // README creation is not a formal assertion target — note only
        // (counted toward report but not a hard pass/fail gate)
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 3 — Update config.json (read-before-edit)
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 3: update config.json — maxRetries→5, add logLevel",
      async () => {
        await sendTurn(
          `Now update config.json: change maxRetries to 5 and add a new field
"logLevel" with value "debug". You MUST read the file first (file_read)
before editing it (file_edit). Do not overwrite the whole file.`,
          "Update config.json",
        );

        const configPath = resolve(projectDir, "config.json");
        let passed = false;
        if (existsSync(configPath)) {
          try {
            const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
            passed = cfg["maxRetries"] === 5 && cfg["logLevel"] === "debug";
          } catch {
            passed = false;
          }
        }
        assertionResults.push({
          label: "Turn 3: maxRetries===5 AND logLevel===\"debug\"",
          passed,
        });
        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 4 — Memory-only recall (no file_read)
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 4: recall original maxRetries and new field name from memory",
      async () => {
        const { lastContent } = await sendTurn(
          `Answer this WITHOUT reading any file — rely on your memory of our conversation:
What was the ORIGINAL value of maxRetries BEFORE I asked you to change it in Turn 3?
And what new field did I ask you to add? Answer in a single sentence.`,
          "Recall originals (memory-only)",
        );

        // Must mention original value "3"
        const mentionsOriginal = /\b3\b/.test(lastContent);
        // Must mention "logLevel" (case-insensitive)
        const mentionsField = /logLevel/i.test(lastContent);
        // Must NOT have used file_read in this turn
        const fileReadsThisTurn = toolCalls.filter(
          (t) => t.turn === currentTurn && t.name === "file_read",
        ).length;
        const noFileRead = fileReadsThisTurn === 0;

        const passed = mentionsOriginal && mentionsField && noFileRead;
        assertionResults.push({
          label: "Turn 4: recalls original=3, field=logLevel, no file_read",
          passed,
        });

        console.log(
          `  [T4] mentionsOriginal=${mentionsOriginal} mentionsField=${mentionsField} noFileRead=${noFileRead} fileReadsThisTurn=${fileReadsThisTurn}`,
        );

        expect(mentionsOriginal).toBe(true);
        expect(mentionsField).toBe(true);
        expect(fileReadsThisTurn).toBe(0);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 5 — Sync README.md to current config.json values
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 5: update README.md to match current config.json",
      async () => {
        await sendTurn(
          `Update README.md to reflect the CURRENT config.json values.
Make sure every setting name and value in README.md matches config.json exactly.`,
          "Sync README to config",
        );

        const readmePath = resolve(projectDir, "README.md");
        let passed = false;
        if (existsSync(readmePath)) {
          const readme = readFileSync(readmePath, "utf-8");
          passed = readme.includes("5") && readme.toLowerCase().includes("debug");
        }
        assertionResults.push({
          label: "Turn 5: README contains maxRetries=5 and logLevel=debug",
          passed,
        });
        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Final: iteration efficiency
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Final: avg iterations per turn < 15",
      () => {
        const avg =
          metrics.turnsCompleted > 0
            ? metrics.totalIterations / metrics.turnsCompleted
            : 0;
        console.log(
          `  [Final] totalIterations=${metrics.totalIterations} turnsCompleted=${metrics.turnsCompleted} avg=${avg.toFixed(2)}`,
        );
        const passed = avg < 15;
        assertionResults.push({ label: "Final: avg iterations/turn < 15", passed });
        expect(avg).toBeLessThan(15);
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
========== CQ-1 CONTEXT RETENTION REPORT (LOCAL LLM) ==========
Scenario : Context Retention
Model    : ${LOCAL_MODEL}
Target   : 4/5 assertions PASS

Turns Completed  : ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations : ${metrics.totalIterations}
Total Duration   : ${(totalMs / 1000).toFixed(1)}s
Total Tool Calls : ${toolCalls.length}
Errors           : ${metrics.errors.length}

Assertion Results (${passCount}/${totalAssertions}):
${assertionResults.map((r) => `  [${r.passed ? "PASS" : "FAIL"}] ${r.label}`).join("\n")}
${metrics.errors.length > 0 ? "\nErrors:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}
================================================================`);

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
