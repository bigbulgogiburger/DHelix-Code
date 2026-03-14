import { describe, it, expect, beforeEach } from "vitest";
import { statsCommand, formatDuration, getToolBreakdown } from "../../../src/commands/stats.js";
import { metrics, COUNTERS } from "../../../src/telemetry/metrics.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/stats enhanced", () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe("basic output format", () => {
    it("should include Session Statistics header", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Session Statistics");
      expect(result.output).toContain("==================");
    });

    it("should display model and session info", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Model:       test-model");
      expect(result.output).toContain("Session:     test-session");
    });

    it("should display N/A when no session ID", async () => {
      const noSessionContext = { ...baseContext, sessionId: undefined };
      const result = await statsCommand.execute("", noSessionContext);
      expect(result.output).toContain("Session:     N/A");
    });

    it("should include duration", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Duration:");
    });

    it("should include all major sections", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Tokens:");
      expect(result.output).toContain("Input:");
      expect(result.output).toContain("Output:");
      expect(result.output).toContain("Total:");
      expect(result.output).toContain("Cost:");
      expect(result.output).toContain("Tool Usage:");
      expect(result.output).toContain("Turns:");
      expect(result.output).toContain("Errors:");
    });
  });

  describe("with zero metrics (fresh session)", () => {
    it("should show zero tokens", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Input:     0");
      expect(result.output).toContain("Output:    0");
      expect(result.output).toContain("Total:     0");
    });

    it("should show zero cost", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("$0.00");
    });

    it("should show zero tool invocations", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("0 invocations");
    });

    it("should show zero errors", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Errors:      0");
    });

    it("should show zero turns without messages", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Turns:       0 (user messages)");
    });
  });

  describe("with populated metrics", () => {
    beforeEach(() => {
      metrics.increment(COUNTERS.tokensUsed, 5000, { type: "input", model: "test-model" });
      metrics.increment(COUNTERS.tokensUsed, 1500, { type: "output", model: "test-model" });
      metrics.increment(COUNTERS.tokenCost, 0.47, { model: "test-model" });
      metrics.increment(COUNTERS.toolInvocations, 10, { tool: "file_read", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 5, { tool: "bash_exec", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 15, { tool: "*", status: "success" });
      metrics.increment(COUNTERS.errors, 2, { category: "llm" });
    });

    it("should show token counts", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("5,000");
      expect(result.output).toContain("1,500");
      expect(result.output).toContain("6,500");
    });

    it("should show cost", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("$0.47");
    });

    it("should show tool invocation total", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("15 invocations");
    });

    it("should show error count", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Errors:      2");
    });
  });

  describe("tool breakdown", () => {
    it("should include tool breakdown when tools are used", async () => {
      metrics.increment(COUNTERS.toolInvocations, 10, { tool: "file_read", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 5, { tool: "bash_exec", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 3, { tool: "grep_search", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 18, { tool: "*", status: "success" });

      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("file_read");
      expect(result.output).toContain("bash_exec");
      expect(result.output).toContain("grep_search");
    });

    it("should sort tools by count descending", () => {
      metrics.increment(COUNTERS.toolInvocations, 3, { tool: "grep_search", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 10, { tool: "file_read", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 5, { tool: "bash_exec", status: "success" });

      const breakdown = getToolBreakdown();
      expect(breakdown.length).toBe(3);
      expect(breakdown[0].name).toBe("file_read");
      expect(breakdown[0].count).toBe(10);
      expect(breakdown[1].name).toBe("bash_exec");
      expect(breakdown[1].count).toBe(5);
      expect(breakdown[2].name).toBe("grep_search");
      expect(breakdown[2].count).toBe(3);
    });

    it("should return empty breakdown when no tools used", () => {
      const breakdown = getToolBreakdown();
      expect(breakdown).toEqual([]);
    });

    it("should include unknown tools found in counter data", () => {
      metrics.increment(COUNTERS.toolInvocations, 7, { tool: "custom_tool", status: "success" });

      const breakdown = getToolBreakdown();
      expect(breakdown.length).toBe(1);
      expect(breakdown[0].name).toBe("custom_tool");
      expect(breakdown[0].count).toBe(7);
    });

    it("should include visual bars in tool breakdown", async () => {
      metrics.increment(COUNTERS.toolInvocations, 10, { tool: "file_read", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 10, { tool: "*", status: "success" });

      const result = await statsCommand.execute("", baseContext);
      // Check that the block character is present
      expect(result.output).toContain("\u2588");
    });
  });

  describe("user turns", () => {
    it("should count user messages", async () => {
      const contextWithMessages = {
        ...baseContext,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
          { role: "user", content: "Help me" },
          { role: "assistant", content: "Sure" },
          { role: "user", content: "Thanks" },
        ],
      };
      const result = await statsCommand.execute("", contextWithMessages);
      expect(result.output).toContain("Turns:       3 (user messages)");
    });

    it("should show 0 turns when no messages provided", async () => {
      const result = await statsCommand.execute("", baseContext);
      expect(result.output).toContain("Turns:       0 (user messages)");
    });
  });

  describe("formatDuration", () => {
    it("should format seconds only", () => {
      expect(formatDuration(5000)).toBe("5s");
      expect(formatDuration(0)).toBe("0s");
      expect(formatDuration(59000)).toBe("59s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(60000)).toBe("1m 0s");
      expect(formatDuration(90000)).toBe("1m 30s");
      expect(formatDuration(2723000)).toBe("45m 23s");
    });

    it("should format hours, minutes, and seconds", () => {
      expect(formatDuration(3600000)).toBe("1h 0m 0s");
      expect(formatDuration(3661000)).toBe("1h 1m 1s");
      expect(formatDuration(7200000)).toBe("2h 0m 0s");
    });

    it("should handle sub-second values", () => {
      expect(formatDuration(500)).toBe("0s");
      expect(formatDuration(999)).toBe("0s");
    });
  });
});
