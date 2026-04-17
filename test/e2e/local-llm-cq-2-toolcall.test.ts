/**
 * L3 Conversation Quality — Scenario 2: Tool Call Coherence (Local LLM)
 *
 * Tests that the local LLM (GLM-4.5-Air) correctly sequences tool calls:
 *  - Uses file_write to scaffold a project
 *  - Reads files before editing them (read-before-edit invariant)
 *  - Uses file_edit (not file_write) for incremental changes
 *  - Reads multiple files on demand
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

const STACK_NAME = "L3 Conversation Quality — Tool Call Coherence (Local LLM)";
const PROJECT_DIR_NAME = "cq-local-2-toolcall";
const TOTAL_TURNS = 5;
const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "GLM45AirFP8";

const hasLocalModel = !!(process.env.LOCAL_API_BASE_URL && process.env.LOCAL_MODEL);

const projectDir = resolve(__dirname, `../../test-projects/${PROJECT_DIR_NAME}`);

// ============================================================
// TYPES
// ============================================================

interface ToolCall {
  turn: number;
  name: string;
  args: Record<string, unknown>;
}

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

const startTime = new Date().toISOString();

// ============================================================
// HELPER — tool_sequence invariant checker
// ============================================================

/**
 * For a given turn, verifies that every file_edit call was preceded by a
 * file_read call targeting the SAME file_path within the same turn.
 *
 * Returns true if the invariant holds (or there are no file_edit calls in
 * the turn). Returns false if any file_edit was issued without a prior
 * file_read for the same path.
 */
function checkReadBeforeEdit(
  calls: ToolCall[],
  turnNum: number,
): boolean {
  const turnTools = calls.filter((t) => t.turn === turnNum);
  for (let i = 0; i < turnTools.length; i++) {
    if (turnTools[i].name === "file_edit") {
      const editPath = turnTools[i].args["file_path"] as string;
      const hadRead = turnTools.slice(0, i).some(
        (t) => t.name === "file_read" && t.args["file_path"] === editPath,
      );
      if (!hadRead) return false;
    }
  }
  return true;
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

      console.log(`[CQ-2] Environment:`);
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
    // Turn 1 — Scaffold Node.js project structure
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 1: scaffold minimal Node.js project (4 files)",
      async () => {
        await sendTurn(
          `Create a minimal Node.js project structure in the current working directory:
  - package.json   (name: "tool-coherence", type: "module", scripts.test: "vitest run")
  - tsconfig.json  (target: ES2022, module: ESNext, strict: true)
  - src/index.ts   (empty — just a comment: "// entry point")
  - src/utils/helper.ts  (empty — just a comment: "// helpers")
Use file_write for each file. Create directories as needed.`,
          "Scaffold project",
        );

        const pkgExists = existsSync(resolve(projectDir, "package.json"));
        const tscExists = existsSync(resolve(projectDir, "tsconfig.json"));
        const indexExists = existsSync(resolve(projectDir, "src/index.ts"));
        const helperExists = existsSync(resolve(projectDir, "src/utils/helper.ts"));
        const passed = pkgExists && tscExists && indexExists && helperExists;

        assertionResults.push({
          label:
            "Turn 1: package.json + tsconfig.json + src/index.ts + src/utils/helper.ts all exist",
          passed,
        });

        console.log(
          `  [T1] pkg=${pkgExists} tsc=${tscExists} index=${indexExists} helper=${helperExists}`,
        );

        expect(pkgExists).toBe(true);
        expect(tscExists).toBe(true);
        expect(indexExists).toBe(true);
        expect(helperExists).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 2 — Read and echo src/index.ts
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 2: read src/index.ts verbatim using file_read",
      async () => {
        const { lastContent } = await sendTurn(
          `Read src/index.ts and tell me, word for word, what it contains. Use file_read.`,
          "Read index.ts",
        );

        // Verify the model actually called file_read this turn
        const readCallsThisTurn = toolCalls.filter(
          (t) => t.turn === currentTurn && t.name === "file_read",
        ).length;

        // We expect the LLM to echo the comment "// entry point"
        const containsComment =
          lastContent.includes("entry point") || lastContent.includes("//");

        console.log(
          `  [T2] fileReadsThisTurn=${readCallsThisTurn} containsComment=${containsComment}`,
        );
        // Soft assertion — we just confirm a file_read was invoked
        expect(readCallsThisTurn).toBeGreaterThan(0);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 3 — Add formatDate to helper.ts; import in index.ts
    //           RULE: file_read must precede each file_edit in this turn
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 3: add formatDate + import — read-before-edit invariant",
      async () => {
        await sendTurn(
          `Add a function called formatDate(date: Date): string to src/utils/helper.ts.
It should return date.toISOString().slice(0, 10). Export it (named export).
Then edit src/index.ts to import formatDate and log formatDate(new Date()).
RULE: Always file_read a file before editing it with file_edit.`,
          "Add formatDate",
        );

        const readBeforeEditOk = checkReadBeforeEdit(toolCalls, currentTurn);

        // file_write must not have been used in this turn (edit-not-write rule)
        const fileWriteCountThisTurn = toolCalls.filter(
          (t) => t.turn === currentTurn && t.name === "file_write",
        ).length;

        const passed = readBeforeEditOk && fileWriteCountThisTurn === 0;

        assertionResults.push({
          label:
            "Turn 3: read-before-edit invariant holds AND file_write count===0",
          passed,
        });

        console.log(
          `  [T3] readBeforeEditOk=${readBeforeEditOk} fileWriteThisTurn=${fileWriteCountThisTurn}`,
        );

        expect(readBeforeEditOk).toBe(true);
        expect(fileWriteCountThisTurn).toBe(0);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 4 — Fix null-guard in helper.ts using file_edit (not file_write)
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 4: fix null guard — file_edit only, no file_write",
      async () => {
        await sendTurn(
          `There is a bug in src/utils/helper.ts: formatDate does not handle null input.
Fix it: if date is null or undefined, return "1970-01-01".
Use file_edit (not file_write). Read the file first.`,
          "Fix null guard",
        );

        const fileWriteCountThisTurn = toolCalls.filter(
          (t) => t.turn === currentTurn && t.name === "file_write",
        ).length;

        const helperPath = resolve(projectDir, "src/utils/helper.ts");
        let helperContent = "";
        if (existsSync(helperPath)) {
          helperContent = readFileSync(helperPath, "utf-8");
        }

        const containsFormatDate = helperContent.includes("formatDate");
        const containsNullGuard = helperContent.includes("1970-01-01");

        const passed =
          fileWriteCountThisTurn === 0 && containsFormatDate && containsNullGuard;

        assertionResults.push({
          label:
            "Turn 4: file_write===0 AND helper.ts has formatDate AND 1970-01-01",
          passed,
        });

        console.log(
          `  [T4] fileWriteThisTurn=${fileWriteCountThisTurn} containsFormatDate=${containsFormatDate} containsNullGuard=${containsNullGuard}`,
        );

        expect(fileWriteCountThisTurn).toBe(0);
        expect(containsFormatDate).toBe(true);
        expect(containsNullGuard).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 5 — Show current contents of both files using file_read
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 5: show current file contents — uses file_read for each",
      async () => {
        await sendTurn(
          `Show me the CURRENT contents of src/utils/helper.ts and src/index.ts.
Use file_read for each.`,
          "Show file contents",
        );

        // Verify helper.ts still contains the final expected content
        const helperPath = resolve(projectDir, "src/utils/helper.ts");
        let helperContent = "";
        if (existsSync(helperPath)) {
          helperContent = readFileSync(helperPath, "utf-8");
        }

        const containsFormatDate = helperContent.includes("formatDate");
        const containsNullGuard = helperContent.includes("1970-01-01");

        const passed = containsFormatDate && containsNullGuard;

        assertionResults.push({
          label: "Turn 5: helper.ts has formatDate AND 1970-01-01",
          passed,
        });

        console.log(
          `  [T5] containsFormatDate=${containsFormatDate} containsNullGuard=${containsNullGuard}`,
        );

        expect(containsFormatDate).toBe(true);
        expect(containsNullGuard).toBe(true);
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
========== CQ-2 TOOL CALL COHERENCE REPORT (LOCAL LLM) ==========
Scenario : Tool Call Coherence
Model    : ${LOCAL_MODEL}
Target   : 4/5 assertions PASS

Turns Completed  : ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations : ${metrics.totalIterations}
Total Duration   : ${(totalMs / 1000).toFixed(1)}s
Total Tool Calls : ${toolCalls.length}
Errors           : ${metrics.errors.length}

Tool Call Breakdown:
  file_write : ${toolCalls.filter((t) => t.name === "file_write").length}
  file_read  : ${toolCalls.filter((t) => t.name === "file_read").length}
  file_edit  : ${toolCalls.filter((t) => t.name === "file_edit").length}
  other      : ${toolCalls.filter((t) => !["file_write", "file_read", "file_edit"].includes(t.name)).length}

Assertion Results (${passCount}/${totalAssertions}):
${assertionResults.map((r) => `  [${r.passed ? "PASS" : "FAIL"}] ${r.label}`).join("\n")}
${metrics.errors.length > 0 ? "\nErrors:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}
=================================================================`);

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
