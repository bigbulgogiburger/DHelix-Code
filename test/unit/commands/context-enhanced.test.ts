import { describe, it, expect } from "vitest";
import { contextCommand } from "../../../src/commands/context.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "gpt-4o",
  sessionId: "test-session",
  emit: () => {},
  messages: [] as { role: string; content: string }[],
};

describe("/context enhanced", () => {
  it("should show 0% usage with no messages", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("0%");
    expect(result.output).toContain("Context Window");
    expect(result.output).toContain("0 / ");
  });

  it("should show non-zero usage with messages", async () => {
    const contextWithMessages = {
      ...baseContext,
      messages: [
        { role: "user", content: "Hello, how are you doing today? I have a question about programming." },
        { role: "assistant", content: "I am doing great! I would be happy to help you with your programming question. Please go ahead and ask." },
        { role: "user", content: "Can you explain how closures work in JavaScript?" },
        { role: "assistant", content: "A closure is the combination of a function bundled together with references to its surrounding state. In other words, a closure gives you access to an outer function's scope from an inner function." },
      ],
    };
    const result = await contextCommand.execute("", contextWithMessages);
    expect(result.success).toBe(true);
    // With messages, tokens should be > 0 so percentage should reflect that
    expect(result.output).not.toContain("0 / ");
    expect(result.output).toContain("Messages: 4 total (2 user, 2 assistant)");
  });

  it("should render visual bar correctly", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    // At 0%, bar should be all dashes
    expect(result.output).toContain("[" + "-".repeat(40) + "]");
  });

  it("should show tier information", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.output).toContain("high tier");
  });

  it("should show medium tier for medium-tier model", async () => {
    const result = await contextCommand.execute("", {
      ...baseContext,
      model: "gpt-4o-mini",
    });
    expect(result.output).toContain("medium tier");
  });

  it("should show compaction threshold", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.output).toContain("Compaction threshold: 83.5%");
  });

  it("should show tokens until compaction", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.output).toContain("Tokens until compaction:");
  });

  it("should show max context and output token counts", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.output).toContain("Max context: 128K tokens");
    expect(result.output).toContain("Max output: 16K tokens");
  });

  it("should show tip about /compact", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.output).toContain("Tip: Use /compact");
  });

  it("should handle missing messages gracefully", async () => {
    const contextWithoutMessages = {
      workingDirectory: process.cwd(),
      model: "gpt-4o",
      sessionId: "test-session",
      emit: () => {},
    };
    const result = await contextCommand.execute("", contextWithoutMessages);
    expect(result.success).toBe(true);
    expect(result.output).toContain("0%");
    expect(result.output).toContain("Messages: 0 total (0 user, 0 assistant)");
  });

  it("should display message breakdown by role", async () => {
    const contextWithMessages = {
      ...baseContext,
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "Question" },
      ],
    };
    const result = await contextCommand.execute("", contextWithMessages);
    expect(result.output).toContain("Messages: 3 total (2 user, 1 assistant)");
  });
});
