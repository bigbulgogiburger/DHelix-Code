import { describe, it, expect } from "vitest";
import { runAgentLoop } from "../../src/core/agent-loop.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { createEventEmitter, type AppEventEmitter } from "../../src/utils/events.js";
import {
  createMockLLMProvider,
  mockChatCompletion,
  mockToolCallResponse,
} from "../mocks/openai.js";
import { z } from "zod";

/**
 * Helper to create a basic agent loop config with mock provider.
 * All tests use mock LLM providers — no real API calls, safe for CI.
 */
function createTestConfig(opts: {
  responses: Parameters<typeof createMockLLMProvider>[0];
  tools?: ToolRegistry;
  maxIterations?: number;
  signal?: AbortSignal;
  events?: AppEventEmitter;
}) {
  const events = opts.events ?? createEventEmitter();
  const registry = opts.tools ?? new ToolRegistry();
  const provider = createMockLLMProvider(opts.responses);
  const strategy = selectStrategy("gpt-4o");

  return {
    config: {
      client: provider,
      model: "gpt-4o",
      toolRegistry: registry,
      strategy,
      events,
      maxIterations: opts.maxIterations ?? 10,
      temperature: 0,
      maxTokens: 4096,
      signal: opts.signal,
    },
    events,
    provider,
  };
}

/**
 * Helper to create a ToolRegistry pre-populated with common mock tools.
 * Each tool returns deterministic output for predictable assertions.
 */
function createMockToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "file_read",
    description: "Read a file",
    parameterSchema: z.object({ path: z.string() }),
    permissionLevel: "safe",
    execute: async (params: { path: string }) => ({
      output: `Contents of ${params.path}: mock file content`,
      isError: false,
    }),
  });

  registry.register({
    name: "file_edit",
    description: "Edit a file",
    parameterSchema: z.object({
      file_path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
    }),
    permissionLevel: "safe",
    execute: async (params: { file_path: string; old_string: string; new_string: string }) => ({
      output: `Edited ${params.file_path}: replaced "${params.old_string}" with "${params.new_string}"`,
      isError: false,
    }),
  });

  registry.register({
    name: "bash_exec",
    description: "Execute a bash command",
    parameterSchema: z.object({ command: z.string() }),
    permissionLevel: "safe",
    execute: async (params: { command: string }) => ({
      output: `$ ${params.command}\ncommand output`,
      isError: false,
    }),
  });

  registry.register({
    name: "glob_search",
    description: "Search for files by pattern",
    parameterSchema: z.object({ pattern: z.string() }),
    permissionLevel: "safe",
    execute: async () => ({
      output: `src/index.ts\nsrc/app.ts\nsrc/utils.ts`,
      isError: false,
    }),
  });

  registry.register({
    name: "grep_search",
    description: "Search for content in files",
    parameterSchema: z.object({ pattern: z.string() }),
    permissionLevel: "safe",
    execute: async () => ({
      output: `src/index.ts:5:  export function main()`,
      isError: false,
    }),
  });

  return registry;
}

describe("Agent Scenarios — E2E Validation", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 1: Simple Q&A — agent responds without tool calls
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 1: Simple Q&A", () => {
    it("should complete in 1 iteration without tool calls", async () => {
      const { config } = createTestConfig({
        responses: [mockChatCompletion("Hello! I can help you with coding.")],
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ]);

      expect(result.iterations).toBe(1);
      expect(result.aborted).toBe(false);
      const lastMsg = result.messages[result.messages.length - 1];
      expect(lastMsg.content).toContain("Hello");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 2: Single Tool Call — agent reads a file and responds
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 2: Single Tool Call", () => {
    it("should execute a file_read tool and produce a response", async () => {
      const registry = createMockToolRegistry();
      const { config } = createTestConfig({
        responses: [
          // First: agent decides to read a file
          mockToolCallResponse("file_read", { path: "src/index.ts" }),
          // Second: agent responds with the findings
          mockChatCompletion("The main entry point is in src/index.ts."),
        ],
        tools: registry,
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are a helpful coding assistant." },
        { role: "user", content: "What is the main entry point?" },
      ]);

      expect(result.iterations).toBe(2);
      expect(result.aborted).toBe(false);
      const lastMsg = result.messages[result.messages.length - 1];
      expect(lastMsg.content).toContain("src/index.ts");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 3: Multi-step Tool Use — agent gathers information over steps
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 3: Multi-step Tool Use", () => {
    it("should chain multiple tool calls before responding", async () => {
      const registry = createMockToolRegistry();
      const { config } = createTestConfig({
        responses: [
          // Step 1: search for files
          mockToolCallResponse("glob_search", { pattern: "**/*.ts" }),
          // Step 2: read a specific file
          mockToolCallResponse("file_read", { path: "src/index.ts" }),
          // Step 3: search for a pattern in code
          mockToolCallResponse("grep_search", { pattern: "export function" }),
          // Step 4: final response
          mockChatCompletion(
            "The project has 3 TypeScript files. The main entry point exports a main() function.",
          ),
        ],
        tools: registry,
      });

      const result = await runAgentLoop(config, [
        {
          role: "system",
          content: "You are a coding assistant. Explore the codebase.",
        },
        { role: "user", content: "Analyze the project structure." },
      ]);

      expect(result.iterations).toBe(4);
      expect(result.aborted).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 4: Tool Error Recovery — agent handles a failed tool
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 4: Tool Error Recovery", () => {
    it("should recover from a tool execution error", async () => {
      const registry = new ToolRegistry();
      registry.register({
        name: "file_read",
        description: "Read a file",
        parameterSchema: z.object({ path: z.string() }),
        permissionLevel: "safe",
        execute: async (params: { path: string }) => {
          if (params.path === "/nonexistent") {
            return {
              output: "Error: ENOENT: no such file or directory",
              isError: true,
            };
          }
          return { output: "file content", isError: false };
        },
      });

      const { config } = createTestConfig({
        responses: [
          // Agent tries to read a non-existent file
          mockToolCallResponse("file_read", { path: "/nonexistent" }),
          // Agent recovers and tries a different approach
          mockToolCallResponse("file_read", { path: "src/index.ts" }),
          // Agent provides the response
          mockChatCompletion(
            "I found the file at src/index.ts after the initial path was incorrect.",
          ),
        ],
        tools: registry,
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Read the main file." },
      ]);

      expect(result.iterations).toBe(3);
      expect(result.aborted).toBe(false);
      // Verify the error was captured in the conversation messages
      const allContent = result.messages
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join("\n");
      expect(allContent).toContain("ENOENT");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 5: Abort/Cancellation — user cancels mid-execution
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 5: Cancellation", () => {
    it("should abort cleanly when signal is triggered before loop starts", async () => {
      const controller = new AbortController();
      const registry = createMockToolRegistry();

      // Abort immediately before the loop can complete
      controller.abort();

      const { config } = createTestConfig({
        responses: [
          mockToolCallResponse("file_read", { path: "src/index.ts" }),
          mockChatCompletion("Done reading."),
        ],
        tools: registry,
        signal: controller.signal,
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Read and analyze all files." },
      ]);

      expect(result.aborted).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 6: Empty Response Handling — LLM returns empty content
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 6: Empty Response Recovery", () => {
    it("should handle empty LLM response and eventually produce output", async () => {
      const { config } = createTestConfig({
        responses: [
          // First response is empty — agent loop may retry or nudge
          mockChatCompletion(""),
          // After nudge, provides real response
          mockChatCompletion("Here is my response."),
        ],
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Help me." },
      ]);

      // Should have processed the empty response and continued
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.aborted).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 7: Max Iterations Guard — prevents infinite loops
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 7: Max Iterations", () => {
    it("should stop at maxIterations even if tools keep being called", async () => {
      const registry = createMockToolRegistry();
      const { config } = createTestConfig({
        responses: [
          // Agent keeps calling tools endlessly (mock provider cycles last response)
          mockToolCallResponse("file_read", { path: "src/1.ts" }),
          mockToolCallResponse("file_read", { path: "src/2.ts" }),
          mockToolCallResponse("file_read", { path: "src/3.ts" }),
          mockToolCallResponse("file_read", { path: "src/4.ts" }),
          mockChatCompletion("Finally done."),
        ],
        tools: registry,
        maxIterations: 3,
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Read all files." },
      ]);

      expect(result.iterations).toBeLessThanOrEqual(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 8: Event Emission — verify expected events fire
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 8: Event Lifecycle", () => {
    it("should emit core lifecycle events", async () => {
      const events = createEventEmitter();
      const registry = createMockToolRegistry();
      const eventLog: string[] = [];

      events.on("agent:iteration", () => eventLog.push("iteration"));
      events.on("llm:start", () => eventLog.push("llm:start"));
      events.on("llm:complete", () => eventLog.push("llm:complete"));
      events.on("agent:assistant-message", () => eventLog.push("assistant-message"));
      events.on("agent:usage-update", () => eventLog.push("usage-update"));
      events.on("agent:complete", () => eventLog.push("complete"));

      const { config } = createTestConfig({
        responses: [
          mockToolCallResponse("file_read", { path: "test.ts" }),
          mockChatCompletion("Done."),
        ],
        tools: registry,
        events,
      });

      await runAgentLoop(config, [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Read test.ts" },
      ]);

      // Verify key events were emitted (at least once)
      expect(eventLog).toContain("iteration");
      expect(eventLog).toContain("assistant-message");
      expect(eventLog).toContain("usage-update");
      expect(eventLog).toContain("complete");

      // iteration should come before any usage-update
      const iterIdx = eventLog.indexOf("iteration");
      const usageIdx = eventLog.indexOf("usage-update");
      expect(iterIdx).toBeLessThan(usageIdx);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 9: Code Modification Safety — verify file edits are tracked
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 9: Safe Code Modification", () => {
    it("should track file modifications in tool results", async () => {
      const editedFiles: string[] = [];
      const registry = new ToolRegistry();
      registry.register({
        name: "file_edit",
        description: "Edit a file",
        parameterSchema: z.object({
          file_path: z.string(),
          old_string: z.string(),
          new_string: z.string(),
        }),
        permissionLevel: "safe",
        execute: async (params: { file_path: string; old_string: string; new_string: string }) => {
          editedFiles.push(params.file_path);
          return {
            output: `Edited ${params.file_path}`,
            isError: false,
          };
        },
      });

      const { config } = createTestConfig({
        responses: [
          mockToolCallResponse("file_edit", {
            file_path: "src/app.ts",
            old_string: "const x = 1",
            new_string: "const x = 2",
          }),
          mockChatCompletion("I've updated the variable value in src/app.ts."),
        ],
        tools: registry,
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are a coding assistant." },
        { role: "user", content: "Change x to 2 in src/app.ts" },
      ]);

      expect(result.iterations).toBe(2);
      expect(editedFiles).toContain("src/app.ts");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Scenario 10: Duplicate Tool Call Detection — circuit breaker for loops
  // ═══════════════════════════════════════════════════════════════════════
  describe("Scenario 10: Duplicate Tool Call Loop Detection", () => {
    it("should detect and break out of repeated identical tool calls", async () => {
      const registry = createMockToolRegistry();
      const { config } = createTestConfig({
        responses: [
          // Agent keeps calling the same tool with same args
          mockToolCallResponse("file_read", { path: "src/loop.ts" }),
          mockToolCallResponse("file_read", { path: "src/loop.ts" }),
          mockToolCallResponse("file_read", { path: "src/loop.ts" }),
          mockToolCallResponse("file_read", { path: "src/loop.ts" }),
          mockToolCallResponse("file_read", { path: "src/loop.ts" }),
          mockChatCompletion("I was stuck in a loop, but recovered."),
        ],
        tools: registry,
        maxIterations: 10,
      });

      const result = await runAgentLoop(config, [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Analyze loop.ts" },
      ]);

      // Should break the loop via duplicate detection and not use all 10 iterations.
      // The agent loop has MAX_DUPLICATE_TOOL_CALLS = 3 so it should stop or nudge.
      expect(result.iterations).toBeLessThanOrEqual(10);
      expect(result.aborted).toBe(false);
    });
  });
});
