import { describe, it, expect } from "vitest";
import { OpenAICompatibleClient } from "../../src/llm/client.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { runAgentLoop } from "../../src/core/agent-loop.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { fileReadTool } from "../../src/tools/definitions/file-read.js";
import { z } from "zod";

const hasApiKey = !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasApiKey)("Real OpenAI API Integration", () => {
  const client = hasApiKey
    ? new OpenAICompatibleClient({
        baseURL: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30_000,
      })
    : (undefined as unknown as OpenAICompatibleClient);

  it("should get a simple text response", async () => {
    const response = await client.chat({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant. Be very brief." },
        { role: "user", content: "What is 2+2? Answer with just the number." },
      ],
      temperature: 0,
      maxTokens: 10,
    });

    expect(response.content).toContain("4");
    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.finishReason).toBe("stop");
  }, 15000);

  it("should make a tool call and loop", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "add_numbers",
      description: "Add two numbers together",
      parameterSchema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
      permissionLevel: "safe",
      execute: async (params: { a: number; b: number }) => ({
        output: String(params.a + params.b),
        isError: false,
      }),
    });

    const strategy = selectStrategy("gpt-4o-mini");
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client,
        model: "gpt-4o-mini",
        toolRegistry,
        strategy,
        events,
        temperature: 0,
        maxTokens: 100,
        maxIterations: 5,
      },
      [
        { role: "system", content: "Use the add_numbers tool to add numbers. Be brief." },
        { role: "user", content: "What is 17 + 25?" },
      ],
    );

    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.aborted).toBe(false);
    // The final message should contain "42"
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.content).toContain("42");
  }, 30000);

  it("should read a file via tool", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(fileReadTool);

    const strategy = selectStrategy("gpt-4o-mini");
    const events = createEventEmitter();

    const result = await runAgentLoop(
      {
        client,
        model: "gpt-4o-mini",
        toolRegistry,
        strategy,
        events,
        temperature: 0,
        maxTokens: 200,
        maxIterations: 5,
        workingDirectory: process.cwd(),
      },
      [
        { role: "system", content: "You have file tools. Be brief." },
        { role: "user", content: "Read the file package.json and tell me the project name." },
      ],
    );

    expect(result.iterations).toBeGreaterThanOrEqual(2);
    const lastMsg = result.messages[result.messages.length - 1];
    expect(lastMsg.content.toLowerCase()).toContain("dbcode");
  }, 30000);
});
