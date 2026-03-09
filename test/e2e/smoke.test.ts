import { describe, it, expect } from "vitest";
import { runAgentLoop } from "../../src/core/agent-loop.js";
import { type LLMProvider } from "../../src/llm/provider.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { OpenAICompatibleClient } from "../../src/llm/client.js";
import { z } from "zod";

const hasApiKey = !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasApiKey)("E2E Smoke Test", () => {
  /**
   * Create a real OpenAI-compatible LLM provider for E2E tests.
   */
  function createRealProvider(): LLMProvider {
    return new OpenAICompatibleClient({
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    });
  }

  it("should complete a simple prompt without tool calls", async () => {
    const provider = createRealProvider();
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const strategy = selectStrategy(model);
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client: provider,
        model,
        toolRegistry: new ToolRegistry(),
        strategy,
        events,
        maxIterations: 3,
        temperature: 0,
        maxTokens: 100,
      },
      [
        { role: "system", content: "You are a helpful assistant. Follow instructions exactly." },
        { role: "user", content: "Respond with exactly: OK" },
      ],
    );

    expect(result.iterations).toBe(1);
    expect(result.aborted).toBe(false);

    // The last message should be the assistant response
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.role).toBe("assistant");
    expect(lastMsg.content.toUpperCase()).toContain("OK");
  }, 30_000);

  it("should handle a single tool call", async () => {
    const provider = createRealProvider();
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const strategy = selectStrategy(model);
    const events = createEventEmitter();

    // Register a simple file_read tool that returns a mock response
    const registry = new ToolRegistry();
    registry.register({
      name: "file_read",
      description: "Read a file from the local filesystem. Returns the file contents as text.",
      parameterSchema: z.object({
        path: z.string().describe("Absolute path to the file to read"),
      }),
      permissionLevel: "safe",
      execute: async (params: { path: string }) => {
        // Return mock package.json content for the test
        if (params.path.includes("package.json")) {
          return {
            output: JSON.stringify(
              { name: "dbcode", version: "0.1.0", description: "CLI AI coding assistant" },
              null,
              2,
            ),
            isError: false,
          };
        }
        return { output: "File not found", isError: true };
      },
    });

    const result = await runAgentLoop(
      {
        client: provider,
        model,
        toolRegistry: registry,
        strategy,
        events,
        maxIterations: 5,
        temperature: 0,
        maxTokens: 500,
      },
      [
        {
          role: "system",
          content:
            "You are a helpful assistant with access to file reading tools. Use the file_read tool to read files when asked.",
        },
        {
          role: "user",
          content: "Read the file package.json and tell me the project name.",
        },
      ],
    );

    expect(result.aborted).toBe(false);
    // Should have at least 2 iterations (tool call + response)
    expect(result.iterations).toBeGreaterThanOrEqual(2);

    // Final message should contain the project name
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.role).toBe("assistant");
    expect(lastMsg.content.toLowerCase()).toContain("dbcode");
  }, 60_000);
});
