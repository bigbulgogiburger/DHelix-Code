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

const STACK_NAME = "Conversation Quality — Context Retention";
const PROJECT_DIR_NAME = "conversation-quality-1";
const TOTAL_TURNS = 5;
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
  dhelixReads: string[];
  toolCalls: Array<{ turn: number; tool: string; args: Record<string, unknown>; tMs: number }>;
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
          dhelixReads: metrics.dhelixReads.length,
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
    // best-effort
  }
}

// ============================================================
// TEST SUITE
// ============================================================

describe.skipIf(!hasApiKey)(
  `E2E: ${STACK_NAME}`,
  () => {
    const messages: ChatMessage[] = [];
    let config: AgentLoopConfig;
    let currentTurn = 0;
    const metrics: SessionMetrics = {
      totalIterations: 0,
      turnsCompleted: 0,
      dhelixReads: [],
      toolCalls: [],
      turns: [],
      errors: [],
    };

    beforeAll(async () => {
      if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
      mkdirSync(projectDir, { recursive: true });

      const client = createLLMClientForModel({
        model: MODEL,
        baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY!,
        apiKeyHeader: process.env.OPENAI_API_KEY_HEADER,
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
          tool: name,
          args: (args ?? {}) as Record<string, unknown>,
          tMs: Date.now(),
        });
        const fp = (args as { file_path?: unknown } | undefined)?.file_path;
        if (name === "file_read" && typeof fp === "string" && fp.includes("DHELIX.md")) {
          metrics.dhelixReads.push(`Turn ${currentTurn}`);
        }
      });

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
        maxIterations: 50,
        maxTokens: 16384,
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
      const name = turnName ?? `Turn ${currentTurn}`;
      console.log(`\n--- Turn ${currentTurn}/${TOTAL_TURNS}: ${name} ---`);
      console.log(`User: ${userMessage.slice(0, 120)}...`);
      writeProgress(metrics, currentTurn, name, "running");

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
        metrics.turns.push({
          turn: currentTurn,
          name,
          userMessage,
          lastContent: typeof lastContent === "string" ? lastContent : JSON.stringify(lastContent),
          iterations: result.iterations,
          durationMs: Date.now() - turnStart,
        });

        console.log(`  Iterations: ${result.iterations} (${Date.now() - turnStart}ms)`);
        writeProgress(metrics, currentTurn, name, "completed");

        return {
          iterations: result.iterations,
          lastContent: typeof lastContent === "string" ? lastContent : JSON.stringify(lastContent),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        metrics.errors.push(`Turn ${currentTurn} (${name}): ${errorMsg}`);
        writeProgress(metrics, currentTurn, name, "failed");
        throw error;
      }
    }

    it("Turn 1: create config.json with initial values", async () => {
      await sendTurn(
        `Create a file called config.json with these settings:
  - appName: "MyApp"
  - version: "2.1.0"
  - maxRetries: 3
  - timeout: 5000`,
        "Create config.json",
      );
      expect(existsSync(resolve(projectDir, "config.json"))).toBe(true);
    }, 180_000);

    it("Turn 2: create README.md documenting config.json", async () => {
      await sendTurn(
        `Create a file called README.md that documents config.json.
List each setting name and its current value.`,
        "Document config.json",
      );
      expect(existsSync(resolve(projectDir, "README.md"))).toBe(true);
    }, 180_000);

    it("Turn 3: update config.json", async () => {
      await sendTurn(
        `Now update config.json: change maxRetries to 5 and add a new field
"logLevel" with value "debug".`,
        "Update config.json",
      );
      const cfg = readFileSync(resolve(projectDir, "config.json"), "utf-8");
      expect(cfg).toMatch(/"maxRetries"\s*:\s*5/);
      expect(cfg).toMatch(/"logLevel"\s*:\s*"debug"/);
    }, 180_000);

    it("Turn 4: recall original value and new field name", async () => {
      const { lastContent } = await sendTurn(
        `What were the ORIGINAL values of maxRetries before I asked you to change it?
And what new field did I ask you to add? Answer in a single sentence.`,
        "Recall originals",
      );
      expect(lastContent).toMatch(/\b3\b/);
      expect(lastContent.toLowerCase()).toContain("loglevel");
    }, 180_000);

    it("Turn 5: sync README.md to config.json", async () => {
      await sendTurn(
        `Update README.md to reflect the current config.json values.
Make sure it matches exactly.`,
        "Sync README",
      );
      const readme = readFileSync(resolve(projectDir, "README.md"), "utf-8");
      expect(readme).toMatch(/\b5\b/);
      expect(readme.toLowerCase()).toContain("debug");
    }, 180_000);

    afterAll(() => {
      const totalMs = metrics.turns.reduce((s, t) => s + t.durationMs, 0);
      console.log(`
========== CONVERSATION QUALITY REPORT ==========
Scenario: Context Retention
Model: ${MODEL}
Turns Completed: ${metrics.turnsCompleted} / ${TOTAL_TURNS}
Total Iterations: ${metrics.totalIterations}
Total Duration: ${(totalMs / 1000).toFixed(1)}s
Total Tool Calls: ${metrics.toolCalls.length}
Errors: ${metrics.errors.length}
${metrics.errors.length > 0 ? "Errors:\n" + metrics.errors.map((e) => `  - ${e}`).join("\n") : ""}
==================================================`);

      writeProgress(metrics, currentTurn, "Complete", "completed");

      writeFileSync(
        resolve(projectDir, "session-log.json"),
        JSON.stringify(
          {
            stack: STACK_NAME,
            projectDir,
            model: MODEL,
            startedAt: startTime,
            endedAt: new Date().toISOString(),
            totalDurationMs: totalMs,
            metrics,
          },
          null,
          2,
        ),
      );
    });
  },
  { timeout: 1_800_000 },
);
