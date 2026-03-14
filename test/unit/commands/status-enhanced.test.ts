import { describe, it, expect } from "vitest";
import { statusCommand } from "../../../src/commands/status.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "gpt-4o",
  sessionId: "test-session",
  emit: () => {},
  messages: [] as { role: string; content: string }[],
};

describe("/status enhanced", () => {
  it("should show basic output format", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("dbcode Session Status");
    expect(result.output).toContain("=".repeat("dbcode Session Status".length));
  });

  it("should show version info", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toMatch(/Version:\s+v\d+\.\d+\.\d+/);
  });

  it("should show model with tier", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toContain("gpt-4o (high tier)");
  });

  it("should show session info", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toContain("Session:   test-session");
  });

  it("should show 'none' when no session", async () => {
    const result = await statusCommand.execute("", {
      ...baseContext,
      sessionId: undefined,
    });
    expect(result.output).toContain("Session:   none");
  });

  it("should show directory", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toContain(`Directory: ${process.cwd()}`);
  });

  it("should show uptime", async () => {
    const result = await statusCommand.execute("", baseContext);
    // Uptime format can be "0s", "5m 3s", "1h 2m 30s" depending on how long the process has run
    expect(result.output).toMatch(/Uptime:\s+(\d+h\s+)?(\d+m\s+)?\d+s/);
  });

  it("should show message counts", async () => {
    const contextWithMessages = {
      ...baseContext,
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "Question" },
      ],
    };
    const result = await statusCommand.execute("", contextWithMessages);
    expect(result.output).toContain("Messages:  3 total (2 user turns)");
  });

  it("should show capabilities section", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toContain("Capabilities:");
    expect(result.output).toContain("Context window: 128K tokens");
    expect(result.output).toContain("Max output: 16K tokens");
  });

  it("should show thinking support for capable models", async () => {
    const result = await statusCommand.execute("", {
      ...baseContext,
      model: "claude-sonnet-4",
    });
    expect(result.output).toContain("Thinking: supported");
  });

  it("should show thinking not supported for basic models", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toContain("Thinking: not supported");
  });

  it("should show caching support for Claude models", async () => {
    const result = await statusCommand.execute("", {
      ...baseContext,
      model: "claude-sonnet-4",
    });
    expect(result.output).toContain("Caching: supported");
  });

  it("should show caching not supported for OpenAI models", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toContain("Caching: not supported");
  });

  it("should handle zero messages gracefully", async () => {
    const result = await statusCommand.execute("", baseContext);
    expect(result.output).toContain("Messages:  0 total (0 user turns)");
  });
});
