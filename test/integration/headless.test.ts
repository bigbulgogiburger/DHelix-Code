import { describe, it, expect, vi, beforeEach } from "vitest";
import { runHeadless } from "../../src/cli/headless.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import {
  createMockLLMProvider,
  mockChatCompletion,
  mockToolCallResponse,
} from "../mocks/openai.js";
import { z } from "zod";

describe("Headless Mode Integration", () => {
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "echo_tool",
      description: "Echo the input text back",
      parameterSchema: z.object({ text: z.string() }),
      permissionLevel: "safe",
      execute: async (params: { text: string }) => ({
        output: `Echo: ${params.text}`,
        isError: false,
      }),
    });
  });

  it("should run a simple text response", async () => {
    const provider = createMockLLMProvider([mockChatCompletion("Hello, I'm your assistant!")]);

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runHeadless({
      prompt: "Say hello",
      client: provider,
      model: "gpt-4o",
      strategy: selectStrategy("gpt-4o"),
      toolRegistry,
      outputFormat: "text",
    });

    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Hello, I'm your assistant!");
    writeSpy.mockRestore();
  });

  it("should run with JSON output format", async () => {
    const provider = createMockLLMProvider([mockChatCompletion("The answer is 42")]);

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runHeadless({
      prompt: "What is the answer?",
      client: provider,
      model: "gpt-4o",
      strategy: selectStrategy("gpt-4o"),
      toolRegistry,
      outputFormat: "json",
    });

    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.result).toBe("The answer is 42");
    expect(parsed.model).toBe("gpt-4o");
    expect(parsed.iterations).toBe(1);
    expect(parsed.aborted).toBe(false);
    writeSpy.mockRestore();
  });

  it("should handle tool call round-trip", async () => {
    const provider = createMockLLMProvider([
      mockToolCallResponse("echo_tool", { text: "world" }),
      mockChatCompletion("The echo returned: world"),
    ]);

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runHeadless({
      prompt: "Echo world",
      client: provider,
      model: "gpt-4o",
      strategy: selectStrategy("gpt-4o"),
      toolRegistry,
      outputFormat: "json",
    });

    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.result).toBe("The echo returned: world");
    expect(parsed.iterations).toBe(2); // tool call + final response
    writeSpy.mockRestore();
  });

  it("should handle stream-json output format", async () => {
    const provider = createMockLLMProvider([mockChatCompletion("Streaming result")]);

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runHeadless({
      prompt: "Test stream",
      client: provider,
      model: "gpt-4o",
      strategy: selectStrategy("gpt-4o"),
      toolRegistry,
      outputFormat: "stream-json",
    });

    const output = writeSpy.mock.calls.map((c) => c[0]).join("");
    // Final line should be the result event
    const lines = output.trim().split("\n");
    const lastLine = JSON.parse(lines[lines.length - 1]);
    expect(lastLine.type).toBe("result");
    expect(lastLine.text).toBe("Streaming result");
    writeSpy.mockRestore();
  });
});
