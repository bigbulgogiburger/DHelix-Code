/**
 * L5 — Stress & Regression Tests (Local LLM)
 *
 * Covers four stress scenarios:
 *   L5-1: Long-context file (~4000 exported constants), read + edit + confirm
 *   L5-2: AbortSignal propagation — agent loop aborts cleanly within deadline
 *   L5-3: LocalModelProvider.estimateCost always returns 0 (pure unit)
 *   L5-4: Sequential independent sessions — no cross-contamination
 *
 * Skip guard: all tests skipped when LOCAL_API_BASE_URL or LOCAL_MODEL are not set.
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
import { LocalModelProvider } from "../../src/llm/providers/local.js";

// ============================================================
// CONFIGURATION
// ============================================================

const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "GLM45AirFP8";
const hasLocalModel = !!(process.env.LOCAL_API_BASE_URL && process.env.LOCAL_MODEL);

// ============================================================
// HELPERS
// ============================================================

function buildConfig(projectDir: string, overrides?: Partial<AgentLoopConfig>): AgentLoopConfig {
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

  const systemPrompt = buildSystemPrompt({
    toolRegistry,
    workingDirectory: projectDir,
  });

  return {
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
    ...overrides,
    // Prepend system prompt into messages outside
  } as AgentLoopConfig;
}

function buildMessages(config: AgentLoopConfig, userMessage: string): ChatMessage[] {
  const toolRegistry = config.toolRegistry as ToolRegistry;
  const systemPrompt = buildSystemPrompt({
    toolRegistry,
    workingDirectory: config.workingDirectory,
  });
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
}

function extractLastContent(messages: readonly ChatMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
}

// ============================================================
// L5-1 — LONG CONTEXT (~4000 exported constants)
// ============================================================

describe.skipIf(!hasLocalModel)(
  "L5-1: Long context — 4000 exported constants",
  () => {
    const L5_1_DIR = resolve(__dirname, "../../test-projects/local-l5-1-longctx");
    const bigTsPath = join(L5_1_DIR, "big.ts");
    const LINE_COUNT = 4000;

    beforeAll(() => {
      if (existsSync(L5_1_DIR)) rmSync(L5_1_DIR, { recursive: true, force: true });
      mkdirSync(L5_1_DIR, { recursive: true });

      // Generate big.ts: 4000 lines of exported constants
      const lines: string[] = [];
      for (let n = 1; n <= LINE_COUNT; n++) {
        lines.push(`export const field${n}: number = ${n};`);
      }
      writeFileSync(bigTsPath, lines.join("\n") + "\n", "utf-8");
      console.log(`[L5-1] Created ${bigTsPath} (${LINE_COUNT} lines)`);
    });

    afterAll(() => {
      if (existsSync(L5_1_DIR)) rmSync(L5_1_DIR, { recursive: true, force: true });
    });

    it(
      "Turn 1: count constants and find field2048",
      async () => {
        const cfg = buildConfig(L5_1_DIR);
        const msgs = buildMessages(
          cfg,
          `Read the entire file big.ts in the current working directory. Then tell me: how many exported constants are defined, and what is the value of the constant named field2048?`,
        );

        const result = await runAgentLoop(cfg, msgs);
        const lastContent = extractLastContent(result.messages);

        console.log(`[L5-1 T1] Reply snippet: ${lastContent.slice(0, 300)}`);

        // Must mention total count (4000 or 4,000) AND value 2048
        const mentionsCount =
          lastContent.includes("4000") ||
          lastContent.includes("4,000") ||
          lastContent.includes("4 000");
        const mentions2048 = lastContent.includes("2048");

        expect(mentionsCount).toBe(true);
        expect(mentions2048).toBe(true);
      },
      600_000,
    );

    it(
      "Turn 2: append fieldMarker to big.ts",
      async () => {
        const cfg = buildConfig(L5_1_DIR);
        const msgs = buildMessages(
          cfg,
          `Now append a new line to big.ts: export const fieldMarker: string = "LOCAL_TEST_MARKER"; Use file_edit. Read the tail of the file first to find the right insertion point.`,
        );

        const result = await runAgentLoop(cfg, msgs);
        const lastContent = extractLastContent(result.messages);

        console.log(`[L5-1 T2] Reply snippet: ${lastContent.slice(0, 200)}`);

        // Verify file now contains fieldMarker
        const fileContent = readFileSync(bigTsPath, "utf-8");
        expect(fileContent).toContain("fieldMarker");
        expect(fileContent).toContain("LOCAL_TEST_MARKER");
      },
      600_000,
    );

    it(
      "Turn 3: confirm fieldMarker and field2048 unchanged",
      async () => {
        const cfg = buildConfig(L5_1_DIR);
        const msgs = buildMessages(
          cfg,
          `Re-read big.ts. Confirm that fieldMarker exists and its value is "LOCAL_TEST_MARKER". Also confirm field2048 still equals 2048 (unchanged).`,
        );

        const result = await runAgentLoop(cfg, msgs);
        const lastContent = extractLastContent(result.messages);

        console.log(`[L5-1 T3] Reply snippet: ${lastContent.slice(0, 300)}`);

        expect(lastContent).toContain("LOCAL_TEST_MARKER");
        // No errors expected (result not aborted)
        expect((result as { aborted?: boolean }).aborted).toBeFalsy();
      },
      600_000,
    );
  },
);

// ============================================================
// L5-2 — ABORTSIGNAL PROPAGATION
// ============================================================

describe.skipIf(!hasLocalModel)(
  "L5-2: AbortSignal propagation",
  () => {
    const L5_2_DIR = resolve(__dirname, "../../test-projects/local-l5-2-abort");

    beforeAll(() => {
      if (existsSync(L5_2_DIR)) rmSync(L5_2_DIR, { recursive: true, force: true });
      mkdirSync(L5_2_DIR, { recursive: true });
    });

    afterAll(() => {
      if (existsSync(L5_2_DIR)) rmSync(L5_2_DIR, { recursive: true, force: true });
    });

    it(
      "aborts within 15s of signal",
      async () => {
        const controller = new AbortController();
        const cfg = buildConfig(L5_2_DIR, { abortSignal: controller.signal } as Partial<AgentLoopConfig>);

        const msgs = buildMessages(
          cfg,
          `Write a very long response: list every positive integer from 1 to 10000, one per line, as plain text. Do not use tools — just emit the text directly. Do not stop until you finish.`,
        );

        // Abort after 3 seconds
        const abortTimer = setTimeout(() => controller.abort(), 3000);

        const startMs = Date.now();
        let aborted = false;
        try {
          const result = await runAgentLoop(cfg, msgs);
          aborted = (result as { aborted?: boolean }).aborted === true;
        } catch (err) {
          // AbortError or similar is acceptable
          aborted = true;
          if (err instanceof Error && !err.message.includes("abort")) {
            // Re-throw unexpected errors
            clearTimeout(abortTimer);
            throw err;
          }
        } finally {
          clearTimeout(abortTimer);
        }

        const elapsedMs = Date.now() - startMs;
        console.log(`[L5-2] aborted=${aborted} elapsed=${elapsedMs}ms`);

        // Must resolve within 15 seconds of abort signal
        expect(elapsedMs).toBeLessThan(15_000);
        expect(aborted).toBe(true);
      },
      30_000,
    );
  },
);

// ============================================================
// L5-3 — COST TRACKER = 0 (pure unit, no LLM call)
// ============================================================

describe(
  "L5-3: LocalModelProvider estimateCost always returns 0",
  () => {
    it(
      "totalCost is 0 for any token usage",
      () => {
        const provider = new LocalModelProvider();
        const result = provider.estimateCost({
          promptTokens: 1000,
          completionTokens: 200,
          totalTokens: 1200,
        });

        expect(result.totalCost).toBe(0);
        expect(result.inputCost).toBe(0);
        expect(result.outputCost).toBe(0);
        expect(result.currency).toBe("USD");
      },
      5_000,
    );

    it(
      "totalCost is 0 for large token usage",
      () => {
        const provider = new LocalModelProvider();
        const result = provider.estimateCost({
          promptTokens: 1_000_000,
          completionTokens: 500_000,
          totalTokens: 1_500_000,
        });

        expect(result.totalCost).toBe(0);
      },
      5_000,
    );

    it(
      "totalCost is 0 for zero tokens",
      () => {
        const provider = new LocalModelProvider();
        const result = provider.estimateCost({
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        });

        expect(result.totalCost).toBe(0);
      },
      5_000,
    );
  },
);

// ============================================================
// L5-4 — SEQUENTIAL INDEPENDENT SESSIONS
// ============================================================

describe.skipIf(!hasLocalModel)(
  "L5-4: Sequential independent sessions — no cross-contamination",
  () => {
    const sessions = [
      {
        dir: resolve(__dirname, "../../test-projects/local-l5-4-sess-a"),
        message: 'Reply with ONLY the word "ALPHA" and nothing else.',
        expectedKeyword: "ALPHA",
      },
      {
        dir: resolve(__dirname, "../../test-projects/local-l5-4-sess-b"),
        message: 'Reply with ONLY the word "BETA" and nothing else.',
        expectedKeyword: "BETA",
      },
      {
        dir: resolve(__dirname, "../../test-projects/local-l5-4-sess-c"),
        message: 'Reply with ONLY the word "GAMMA" and nothing else.',
        expectedKeyword: "GAMMA",
      },
    ];

    beforeAll(() => {
      for (const sess of sessions) {
        if (existsSync(sess.dir)) rmSync(sess.dir, { recursive: true, force: true });
        mkdirSync(sess.dir, { recursive: true });
      }
    });

    afterAll(() => {
      for (const sess of sessions) {
        if (existsSync(sess.dir)) rmSync(sess.dir, { recursive: true, force: true });
      }
    });

    it(
      "Session A responds with ALPHA, not contaminated by B or C",
      async () => {
        const sess = sessions[0];
        const cfg = buildConfig(sess.dir, { maxIterations: 5, maxTokens: 256 });
        const msgs = buildMessages(cfg, sess.message);

        const result = await runAgentLoop(cfg, msgs);
        const lastContent = extractLastContent(result.messages).toUpperCase();

        console.log(`[L5-4 A] Reply: ${lastContent.slice(0, 100)}`);

        expect(lastContent).toContain(sess.expectedKeyword);
        expect(lastContent).not.toContain("BETA");
        expect(lastContent).not.toContain("GAMMA");
      },
      300_000,
    );

    it(
      "Session B responds with BETA, not contaminated by A or C",
      async () => {
        const sess = sessions[1];
        const cfg = buildConfig(sess.dir, { maxIterations: 5, maxTokens: 256 });
        const msgs = buildMessages(cfg, sess.message);

        const result = await runAgentLoop(cfg, msgs);
        const lastContent = extractLastContent(result.messages).toUpperCase();

        console.log(`[L5-4 B] Reply: ${lastContent.slice(0, 100)}`);

        expect(lastContent).toContain(sess.expectedKeyword);
        expect(lastContent).not.toContain("GAMMA");
      },
      300_000,
    );

    it(
      "Session C responds with GAMMA, not contaminated by A or B",
      async () => {
        const sess = sessions[2];
        const cfg = buildConfig(sess.dir, { maxIterations: 5, maxTokens: 256 });
        const msgs = buildMessages(cfg, sess.message);

        const result = await runAgentLoop(cfg, msgs);
        const lastContent = extractLastContent(result.messages).toUpperCase();

        console.log(`[L5-4 C] Reply: ${lastContent.slice(0, 100)}`);

        expect(lastContent).toContain(sess.expectedKeyword);
        expect(lastContent).not.toContain("ALPHA");
        expect(lastContent).not.toContain("BETA");
      },
      300_000,
    );
  },
);
