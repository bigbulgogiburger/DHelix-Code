import { describe, it, expect } from "vitest";
import { OpenAICompatibleClient } from "../../src/llm/client.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { runAgentLoop } from "../../src/core/agent-loop.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { type ChatMessage } from "../../src/llm/provider.js";
import { z } from "zod";

const hasApiKey = !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasApiKey)("Multi-turn Conversation", () => {
  const client = hasApiKey
    ? new OpenAICompatibleClient({
        baseURL: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30_000,
      })
    : (undefined as unknown as OpenAICompatibleClient);

  it("should maintain context across 5 conversation turns", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "remember",
      description: "Store a value in memory. Call with key and value.",
      parameterSchema: z.object({
        key: z.string().describe("The key to store"),
        value: z.string().describe("The value to store"),
      }),
      permissionLevel: "safe",
      execute: async (params: { key: string; value: string }) => ({
        output: `Stored: ${params.key} = ${params.value}`,
        isError: false,
      }),
    });

    const strategy = selectStrategy("gpt-4o-mini");
    const events = createEventEmitter();

    // Accumulate messages across turns to simulate multi-turn conversation
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a helpful assistant. Remember information the user tells you. Be very brief in responses (1-2 sentences max).",
      },
    ];

    // Turn 1: Tell the agent a fact
    messages.push({ role: "user", content: "My name is Alice and I live in Seoul." });
    let result = await runAgentLoop(
      {
        client,
        model: "gpt-4o-mini",
        toolRegistry,
        strategy,
        events,
        maxTokens: 100,
        maxIterations: 3,
      },
      messages,
    );
    messages.length = 0;
    messages.push(...result.messages);

    // Turn 2: Tell another fact
    messages.push({ role: "user", content: "My favorite color is blue." });
    result = await runAgentLoop(
      {
        client,
        model: "gpt-4o-mini",
        toolRegistry,
        strategy,
        events,
        maxTokens: 100,
        maxIterations: 3,
      },
      messages,
    );
    messages.length = 0;
    messages.push(...result.messages);

    // Turn 3: Tell yet another fact
    messages.push({ role: "user", content: "I work as a software engineer." });
    result = await runAgentLoop(
      {
        client,
        model: "gpt-4o-mini",
        toolRegistry,
        strategy,
        events,
        maxTokens: 100,
        maxIterations: 3,
      },
      messages,
    );
    messages.length = 0;
    messages.push(...result.messages);

    // Turn 4: Ask about turn 1 information
    messages.push({ role: "user", content: "What is my name and where do I live?" });
    result = await runAgentLoop(
      {
        client,
        model: "gpt-4o-mini",
        toolRegistry,
        strategy,
        events,
        maxTokens: 100,
        maxIterations: 3,
      },
      messages,
    );
    messages.length = 0;
    messages.push(...result.messages);

    const turn4Response = result.messages[result.messages.length - 1].content.toLowerCase();
    expect(turn4Response).toContain("alice");
    expect(turn4Response).toContain("seoul");

    // Turn 5: Ask about turn 2 information (context retention)
    messages.push({ role: "user", content: "What is my favorite color?" });
    result = await runAgentLoop(
      {
        client,
        model: "gpt-4o-mini",
        toolRegistry,
        strategy,
        events,
        maxTokens: 100,
        maxIterations: 3,
      },
      messages,
    );

    const turn5Response = result.messages[result.messages.length - 1].content.toLowerCase();
    expect(turn5Response).toContain("blue");

    // Verify conversation has accumulated messages from all turns
    expect(result.messages.length).toBeGreaterThanOrEqual(10); // At minimum: system + 5 user + 5 assistant
  }, 120_000);
});
