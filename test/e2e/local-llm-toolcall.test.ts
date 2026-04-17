/**
 * L1 — Tool-Call Strategy E2E Tests (Local LLM: GLM45AirFP8)
 *
 * Validates native tool-call strategy against a real local LLM endpoint.
 * Tests cover: single tool read, strategy auto-selection, multi-tool
 * multi-turn workflow, error recovery, and JSON schema compliance.
 *
 * Environment variables required to run:
 *   LOCAL_API_BASE_URL  — e.g. https://models.dbinc.ai/v1/chat/completions
 *   LOCAL_MODEL         — e.g. GLM45AirFP8
 *   LOCAL_API_KEY       — API key (optional; falls back to "no-key")
 *   LOCAL_API_KEY_HEADER — custom header name (optional; e.g. "model-api-key")
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { createLLMClientForModel } from "../../src/llm/client-factory.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { buildSystemPrompt } from "../../src/core/system-prompt-builder.js";
import { fileReadTool } from "../../src/tools/definitions/file-read.js";
import { fileWriteTool } from "../../src/tools/definitions/file-write.js";
import { fileEditTool } from "../../src/tools/definitions/file-edit.js";
import { type ChatMessage } from "../../src/llm/provider.js";

// ─── Skip guard ──────────────────────────────────────────────────────────────

const hasLocalModel = !!(process.env.LOCAL_API_BASE_URL && process.env.LOCAL_MODEL);

const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "GLM45AirFP8";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Absolute path to a test-project subdirectory under the repo root. */
function testProjectDir(name: string): string {
  return resolve(process.cwd(), "test-projects", name);
}

/** Ensure a clean project directory exists. */
function prepareDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

/** Build a fresh ToolRegistry with the three file tools. */
function makeRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(fileReadTool);
  registry.register(fileWriteTool);
  registry.register(fileEditTool);
  return registry;
}

/** Create the real LLM client from env vars. */
function makeClient() {
  return createLLMClientForModel({
    model: LOCAL_MODEL,
    baseURL: process.env.LOCAL_API_BASE_URL!,
    apiKey: process.env.LOCAL_API_KEY ?? "no-key",
    apiKeyHeader: process.env.LOCAL_API_KEY_HEADER,
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!hasLocalModel)("L1 Tool-Call Strategy", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // L1-1 — Native single tool call (READ README.md)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("L1-1: Native single tool call — READ README.md", () => {
    const projectDir = testProjectDir("local-l1-1-readme");
    let messages: ChatMessage[] = [];
    let config: AgentLoopConfig;

    beforeAll(() => {
      prepareDir(projectDir);
      writeFileSync(join(projectDir, "README.md"), "# dhelix\nCLI AI coding assistant for local LLMs.");

      const client = makeClient();
      const toolRegistry = makeRegistry();
      const strategy = selectStrategy(LOCAL_MODEL);
      const events = createEventEmitter();
      const systemPrompt = buildSystemPrompt();

      messages = [{ role: "system", content: systemPrompt }];

      config = {
        client,
        model: LOCAL_MODEL,
        toolRegistry,
        strategy,
        events,
        workingDirectory: projectDir,
        useStreaming: false,
        maxContextTokens: 128_000,
        maxIterations: 15,
        maxTokens: 4096,
        checkPermission: async () => ({ allowed: true }),
      };
    });

    afterAll(() => {
      try {
        rmSync(projectDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    it(
      "should call file_read exactly once and answer with project description",
      async () => {
        const toolCallCounts: Record<string, number> = {};
        const events = createEventEmitter();
        events.on("tool:start", ({ name }) => {
          toolCallCounts[name] = (toolCallCounts[name] ?? 0) + 1;
        });

        // Override config events to track tool calls
        const testConfig: AgentLoopConfig = { ...config, events };

        const sessionMessages: ChatMessage[] = [...messages];
        sessionMessages.push({
          role: "user",
          content:
            "The file README.md in the current working directory describes this project.\nRead README.md and tell me, in one sentence, what the project is.\nDo not guess — you MUST use the file_read tool.",
        });

        const result = await runAgentLoop(testConfig, sessionMessages);

        const lastMsg = result.messages[result.messages.length - 1];
        const lastContent = (lastMsg?.content ?? "").toString().toLowerCase();

        expect(result.iterations).toBeGreaterThanOrEqual(2);
        expect(result.iterations).toBeLessThanOrEqual(6);

        const toolMessages = result.messages.filter((m) => m.role === "tool");
        expect(toolMessages.length).toBeGreaterThanOrEqual(1);

        expect(lastContent).toMatch(/dhelix/i);
        expect(lastContent).toMatch(/cli/i);

        expect(toolCallCounts["file_read"] ?? 0).toBe(1);
      },
      120_000,
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L1-2 — Strategy auto-selection (pure unit — no LLM call)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("L1-2: Strategy auto-selection", () => {
    it(
      "should select a valid strategy for GLM45AirFP8 without calling the LLM",
      () => {
        const strategy = selectStrategy("GLM45AirFP8");

        expect(strategy).toBeDefined();
        expect(strategy).not.toBeNull();

        const validNames = ["native", "text-parsing"] as const;
        expect(validNames).toContain(strategy.name);

        // Log which strategy was chosen (visible with --reporter=verbose)
        console.info(`[L1-2] GLM45AirFP8 strategy selected: ${strategy.name}`);
      },
      5_000,
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L1-3 — Multi-tool (write → read → edit), 3 turns
  // ═══════════════════════════════════════════════════════════════════════════
  describe("L1-3: Multi-tool workflow — write → read → edit", () => {
    const projectDir = testProjectDir("local-l1-3-config");

    /** Shared mutable conversation buffer across turns. */
    let messages: ChatMessage[] = [];
    let config: AgentLoopConfig;

    // Per-turn tool call counters
    const toolCountsByTurn: Array<Record<string, number>> = [];

    beforeAll(() => {
      prepareDir(projectDir);

      const client = makeClient();
      const toolRegistry = makeRegistry();
      const strategy = selectStrategy(LOCAL_MODEL);
      const events = createEventEmitter();
      const systemPrompt = buildSystemPrompt();

      messages = [{ role: "system", content: systemPrompt }];

      config = {
        client,
        model: LOCAL_MODEL,
        toolRegistry,
        strategy,
        events,
        workingDirectory: projectDir,
        useStreaming: false,
        maxContextTokens: 128_000,
        maxIterations: 15,
        maxTokens: 4096,
        checkPermission: async () => ({ allowed: true }),
      };
    });

    afterAll(() => {
      try {
        rmSync(projectDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    /** Run one turn, accumulating messages and tracking tool call counts. */
    async function sendTurn(
      userMessage: string,
      turnIndex: number,
    ): Promise<{ iterations: number; lastContent: string; messages: readonly ChatMessage[] }> {
      const turnCounts: Record<string, number> = {};
      const turnEvents = createEventEmitter();
      turnEvents.on("tool:start", ({ name }: { name: string }) => {
        turnCounts[name] = (turnCounts[name] ?? 0) + 1;
      });

      const turnConfig: AgentLoopConfig = { ...config, events: turnEvents };

      messages.push({ role: "user", content: userMessage });
      const result = await runAgentLoop(turnConfig, messages);

      // Replace shared messages with the full updated conversation
      messages = [...result.messages] as ChatMessage[];

      toolCountsByTurn[turnIndex] = turnCounts;

      const lastMsg = result.messages[result.messages.length - 1];
      return {
        iterations: result.iterations,
        lastContent: (lastMsg?.content ?? "").toString(),
        messages: result.messages,
      };
    }

    it(
      "Turn 1 — creates config.json with file_write",
      async () => {
        const result = await sendTurn(
          'Create a file named config.json in the current working directory.\n' +
            'Content:\n{\n  "appName": "local-llm-test",\n  "retries": 3,\n  "timeout": 5000\n}\n' +
            "Use the file_write tool. Do not add any other fields.",
          0,
        );

        expect(result.iterations).toBeLessThan(10);
      },
      180_000,
    );

    it(
      "Turn 2 — reads config.json with file_read",
      async () => {
        const result = await sendTurn(
          "Read config.json and report each field name and value. Use file_read.",
          1,
        );

        expect(result.iterations).toBeLessThan(10);
      },
      180_000,
    );

    it(
      "Turn 3 — edits config.json with file_edit and verifies final state",
      async () => {
        const result = await sendTurn(
          'Update config.json: change "retries" from 3 to 7 and add a new field "debug": true.\n' +
            "You MUST read the file first (file_read) before modifying it (file_edit).\n" +
            "Do NOT overwrite the entire file with file_write.",
          2,
        );

        expect(result.iterations).toBeLessThan(10);

        // ── Aggregate tool call counts across all 3 turns ──────────────────
        const totalCounts: Record<string, number> = {};
        for (const tc of toolCountsByTurn) {
          for (const [name, count] of Object.entries(tc)) {
            totalCounts[name] = (totalCounts[name] ?? 0) + count;
          }
        }

        expect(totalCounts["file_write"] ?? 0).toBeGreaterThanOrEqual(1);
        expect(totalCounts["file_read"] ?? 0).toBeGreaterThanOrEqual(2);
        expect(totalCounts["file_edit"] ?? 0).toBeGreaterThanOrEqual(1);

        // ── Verify final config.json state ─────────────────────────────────
        const configPath = join(projectDir, "config.json");
        expect(existsSync(configPath)).toBe(true);

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
        } catch (err) {
          throw new Error(`config.json is not valid JSON: ${String(err)}`);
        }

        expect(parsed["retries"]).toBe(7);
        expect(parsed["debug"]).toBe(true);
        expect(parsed["appName"]).toBe("local-llm-test");
        expect(parsed["timeout"]).toBe(5000);
      },
      180_000,
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L1-4 — Error recovery (nonexistent file)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("L1-4: Error recovery — nonexistent file", () => {
    const projectDir = testProjectDir("local-l1-4-nofile");
    let messages: ChatMessage[] = [];
    let config: AgentLoopConfig;

    beforeAll(() => {
      prepareDir(projectDir);

      const client = makeClient();
      const toolRegistry = makeRegistry();
      const strategy = selectStrategy(LOCAL_MODEL);
      const events = createEventEmitter();
      const systemPrompt = buildSystemPrompt();

      messages = [{ role: "system", content: systemPrompt }];

      config = {
        client,
        model: LOCAL_MODEL,
        toolRegistry,
        strategy,
        events,
        workingDirectory: projectDir,
        useStreaming: false,
        maxContextTokens: 128_000,
        maxIterations: 15,
        maxTokens: 4096,
        checkPermission: async () => ({ allowed: true }),
      };
    });

    afterAll(() => {
      try {
        rmSync(projectDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    it(
      "should report file-not-found without creating the file or looping endlessly",
      async () => {
        const toolCallCounts: Record<string, number> = {};
        const events = createEventEmitter();
        events.on("tool:start", ({ name }: { name: string }) => {
          toolCallCounts[name] = (toolCallCounts[name] ?? 0) + 1;
        });

        const testConfig: AgentLoopConfig = { ...config, events };

        const sessionMessages: ChatMessage[] = [
          ...messages,
          {
            role: "user",
            content:
              "Read the file nonexistent-file.txt and tell me its first line.\n" +
              "If the file does not exist, tell me so clearly and stop — do not create it.",
          },
        ];

        const result = await runAgentLoop(testConfig, sessionMessages);

        const lastMsg = result.messages[result.messages.length - 1];
        const lastContent = (lastMsg?.content ?? "").toString();

        // No infinite retry
        expect(result.iterations).toBeLessThan(10);

        // Accept 1-3 attempts (model may retry once after seeing the error)
        const readCount = toolCallCounts["file_read"] ?? 0;
        expect(readCount).toBeGreaterThanOrEqual(1);
        expect(readCount).toBeLessThanOrEqual(3);

        // Final message must communicate absence of the file
        expect(lastContent).toMatch(/not found|does not exist|존재하지 않/i);

        // Must NOT have created the file
        expect(toolCallCounts["file_write"] ?? 0).toBe(0);

        // Loop must not have been aborted by circuit-breaker/abort signal
        expect(result.aborted).toBe(false);
      },
      120_000,
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // L1-5 — JSON schema compliance (5 independent single-turn calls)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("L1-5: JSON schema compliance — file_write args", () => {
    const projectDir = testProjectDir("local-l1-5-schema");
    let baseConfig: Omit<AgentLoopConfig, "events">;
    let systemPrompt: string;

    beforeAll(() => {
      prepareDir(projectDir);

      const client = makeClient();
      const toolRegistry = makeRegistry();
      const strategy = selectStrategy(LOCAL_MODEL);
      systemPrompt = buildSystemPrompt();

      baseConfig = {
        client,
        model: LOCAL_MODEL,
        toolRegistry,
        strategy,
        workingDirectory: projectDir,
        useStreaming: false,
        maxContextTokens: 128_000,
        maxIterations: 10,
        maxTokens: 2048,
        checkPermission: async () => ({ allowed: true }),
      };
    });

    afterAll(() => {
      try {
        rmSync(projectDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    it(
      "should produce valid file_write JSON args and create ≥ 4 out of 5 files",
      async () => {
        const RUNS = 5;
        let filesCreatedCorrectly = 0;

        for (let i = 1; i <= RUNS; i++) {
          const events = createEventEmitter();
          const config: AgentLoopConfig = { ...baseConfig, events };

          const sessionMessages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                `Call the file_write tool with these exact parameters:\n` +
                `- path: "schema-test-${i}.txt"\n` +
                `- content: "hello ${i}"\n` +
                `Do not call any other tool. Respond with just "done" after the tool succeeds.`,
            },
          ];

          try {
            await runAgentLoop(config, sessionMessages);
          } catch {
            // count as failure — continue to next run
            continue;
          }

          const expectedPath = join(projectDir, `schema-test-${i}.txt`);
          if (existsSync(expectedPath)) {
            const content = readFileSync(expectedPath, "utf-8").trim();
            if (content === `hello ${i}`) {
              filesCreatedCorrectly++;
            }
          }
        }

        // At least 4 out of 5 runs must create the file with correct content (≥ 80%)
        expect(filesCreatedCorrectly).toBeGreaterThanOrEqual(4);
      },
      // 5 runs × 60s each
      300_000,
    );
  });
});
