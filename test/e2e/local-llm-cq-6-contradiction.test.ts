/**
 * L3 Conversation Quality — Scenario 6: Contradiction Handling (Local LLM)
 *
 * Tests that the local LLM (GLM-4.5-Air) can gracefully handle contradictory
 * instructions across turns, keeping code and docs in sync:
 *  - Turn 1: API design doc with /api/v1/ prefix and JWT auth
 *  - Turn 2: Express server following the design doc
 *  - Turn 3: Change prefix to /v2/ and switch to session auth (contradicts Turn 1)
 *  - Turn 4: Sync api-design.md to match current code
 *  - Turn 5: Revert to JWT auth, keep /v2/ prefix — update both files
 *
 * Target: 4/5 assertions PASS
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

const STACK_NAME = "L3 Conversation Quality — Contradiction Handling (Local LLM)";
const PROJECT_DIR_NAME = "cq-local-6-contradiction";
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

    // Capture per-turn lastContent for cross-turn checks
    const turnContents: Record<number, string> = {};

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

      console.log(`[CQ-6] Environment:`);
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

        turnContents[currentTurn] = lastContentStr;

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
    // Turn 1 — Create api-design.md
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 1: create api-design.md with /api/v1/ prefix and JWT auth",
      async () => {
        await sendTurn(
          `Create api-design.md in the current working directory describing a REST API:
  - Prefix: /api/v1/
  - Response format: { "data": ..., "error": null }
  - Authentication: JWT Bearer token in Authorization header`,
          "Create API design doc",
        );

        // No assertion gate here — just prep for later turns
        const exists = existsSync(resolve(projectDir, "api-design.md"));
        console.log(`  [T1] api-design.md exists=${exists}`);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 2 — Create src/server.ts
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 2: create src/server.ts implementing GET /api/v1/ping with JWT stub",
      async () => {
        await sendTurn(
          `Create src/server.ts — a minimal Express app implementing ONE endpoint:
GET /api/v1/ping → { data: "pong", error: null }
Add JWT Bearer middleware stub (just checks header presence).
Also create package.json with express as dependency.
Follow api-design.md exactly.`,
          "Create Express server",
        );

        // No assertion gate here — just prep for later turns
        const exists = existsSync(resolve(projectDir, "src/server.ts"));
        console.log(`  [T2] src/server.ts exists=${exists}`);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 3 — Contradictory change: /v2/ + session auth
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 3: change prefix to /v2/ and switch to session auth (acknowledge contradiction)",
      async () => {
        await sendTurn(
          `Change of plan: use prefix /v2/ instead of /api/v1/.
Also switch from JWT to session-based auth (check req.session.userId).
Update src/server.ts. Acknowledge that this contradicts Turn 1 in your response.`,
          "Contradictory change: /v2/ + session auth",
        );

        // No assertion gate here — save content for final cross-turn check
        const serverPath = resolve(projectDir, "src/server.ts");
        const serverExists = existsSync(serverPath);
        console.log(`  [T3] src/server.ts exists=${serverExists}`);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 4 — Sync api-design.md to current code
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 4: update api-design.md to match current src/server.ts (/v2/ in sync)",
      async () => {
        await sendTurn(
          `Update api-design.md to match the CURRENT code in src/server.ts.
The doc and code must be in sync now.`,
          "Sync api-design.md to server.ts",
        );

        const designPath = resolve(projectDir, "api-design.md");
        const serverPath = resolve(projectDir, "src/server.ts");

        const designExists = existsSync(designPath);
        const serverExists = existsSync(serverPath);

        let designHasV2 = false;
        let serverHasV2 = false;
        let inSync = false;

        if (designExists) {
          const designContent = readFileSync(designPath, "utf-8");
          designHasV2 = designContent.includes("/v2/");
        }
        if (serverExists) {
          const serverContent = readFileSync(serverPath, "utf-8");
          serverHasV2 = serverContent.includes("/v2/");
        }

        // Both must have /v2/ to be "in sync"
        if (serverHasV2 && designHasV2) {
          inSync = true;
        }

        const passed = designExists && serverExists && designHasV2 && serverHasV2 && inSync;
        assertionResults.push({
          label: "Turn 4: api-design.md and server.ts both contain '/v2/' (in sync)",
          passed,
        });

        console.log(
          `  [T4] designExists=${designExists} serverExists=${serverExists} designHasV2=${designHasV2} serverHasV2=${serverHasV2} inSync=${inSync}`,
        );

        expect(passed).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Turn 5 — Revert to JWT, keep /v2/, update both files
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Turn 5: revert to JWT auth + keep /v2/ — update both files, acknowledge back-and-forth",
      async () => {
        const { lastContent } = await sendTurn(
          `I changed my mind again: go BACK to JWT auth, but KEEP /v2/ prefix.
Update both src/server.ts AND api-design.md. Remove any leftover session-auth code.
Acknowledge the back-and-forth in your response.`,
          "Revert to JWT, keep /v2/",
        );

        const serverPath = resolve(projectDir, "src/server.ts");
        const designPath = resolve(projectDir, "api-design.md");

        let serverHasV2 = false;
        let serverHasJWT = false;
        let serverHasNoSession = false;
        let designHasJWT = false;
        let designHasNoSession = false;

        if (existsSync(serverPath)) {
          const serverContent = readFileSync(serverPath, "utf-8");
          serverHasV2 = serverContent.includes("/v2/");
          serverHasJWT =
            /jwt|Authorization|Bearer|token/i.test(serverContent);
          serverHasNoSession = !/req\.session/i.test(serverContent);
          console.log(
            `  [T5-server] hasV2=${serverHasV2} hasJWT=${serverHasJWT} noSession=${serverHasNoSession}`,
          );
        }

        if (existsSync(designPath)) {
          const designContent = readFileSync(designPath, "utf-8");
          designHasJWT = /jwt|Bearer/i.test(designContent);
          designHasNoSession = !/session-based|session auth/i.test(designContent);
          console.log(
            `  [T5-design] hasJWT=${designHasJWT} noSession=${designHasNoSession}`,
          );
        }

        // Check contradiction acknowledgement across Turn 3 and Turn 5 responses
        const turn3Content = turnContents[3] ?? "";
        const acknowledgesContradiction =
          /contradiction|change|earlier|바뀌었/i.test(lastContent) ||
          /contradiction|change|earlier|바뀌었/i.test(turn3Content);

        console.log(
          `  [T5] acknowledgesContradiction=${acknowledgesContradiction}`,
        );

        // Sub-assertion 1: server.ts has /v2/ AND JWT AND no session
        const serverPassed = serverHasV2 && serverHasJWT && serverHasNoSession;
        assertionResults.push({
          label: "Turn 5a: server.ts has '/v2/' + JWT + no req.session",
          passed: serverPassed,
        });

        // Sub-assertion 2: api-design.md has JWT and no session-based
        const designPassed = designHasJWT && designHasNoSession;
        assertionResults.push({
          label: "Turn 5b: api-design.md has JWT + no 'session-based/session auth'",
          passed: designPassed,
        });

        // Sub-assertion 3: contradiction acknowledged in Turn 3 or Turn 5
        assertionResults.push({
          label: "Turn 5c: contradiction acknowledged in Turn 3 or Turn 5 response",
          passed: acknowledgesContradiction,
        });

        // All three sub-assertions must pass for the overall turn to pass
        const overallPassed = serverPassed && designPassed && acknowledgesContradiction;
        expect(serverPassed).toBe(true);
        expect(designPassed).toBe(true);
        expect(acknowledgesContradiction).toBe(true);
      },
      180_000,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Final: pass count report (target ≥ 4/5)
    // ──────────────────────────────────────────────────────────────────────────

    it(
      "Final: report pass count (target ≥ 4/5)",
      () => {
        // assertionResults currently has: T4 (1) + T5a + T5b + T5c (3) = 4 entries
        const passCount = assertionResults.filter((r) => r.passed).length;
        const totalAssertions = assertionResults.length;
        const avg =
          metrics.turnsCompleted > 0
            ? metrics.totalIterations / metrics.turnsCompleted
            : 0;

        console.log(`
  [CQ-6 Final] passCount=${passCount}/${totalAssertions} target=4/${totalAssertions}
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
========== CQ-6 CONTRADICTION HANDLING REPORT (LOCAL LLM) ==========
Scenario : Contradiction Handling
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
