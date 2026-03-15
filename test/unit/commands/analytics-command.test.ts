import { describe, it, expect, beforeEach } from "vitest";
import {
  analyticsCommand,
  getModelDistribution,
  getToolSuccessRate,
  getAverageIterations,
} from "../../../src/commands/analytics.js";
import { metrics, COUNTERS, HISTOGRAMS } from "../../../src/telemetry/metrics.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "gpt-4o",
  sessionId: "test-session",
  emit: () => {},
  messages: [
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi!" },
  ],
};

describe("/analytics command", () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe("command metadata", () => {
    it("should have correct name and description", () => {
      expect(analyticsCommand.name).toBe("analytics");
      expect(analyticsCommand.description).toBe(
        "Show detailed session analytics and performance metrics",
      );
      expect(analyticsCommand.usage).toBe("/analytics");
    });
  });

  describe("basic output format", () => {
    it("should include header", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Session Analytics");
      expect(result.output).toContain("==================");
    });

    it("should include all major sections", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Overview");
      expect(result.output).toContain("Token Usage");
      expect(result.output).toContain("Tool Usage");
      expect(result.output).toContain("Agent Performance");
      expect(result.output).toContain("Token Cache");
      expect(result.output).toContain("Activity Timeline");
    });

    it("should display active model", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Active Model:   gpt-4o");
    });

    it("should display session ID", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Session:        test-session");
    });

    it("should display N/A when no session ID", async () => {
      const noSessionContext = { ...baseContext, sessionId: undefined };
      const result = await analyticsCommand.execute("", noSessionContext);
      expect(result.output).toContain("Session:        N/A");
    });

    it("should display user turns count", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("User Turns:     1");
    });

    it("should display zero turns when no messages", async () => {
      const noMsgContext = { ...baseContext, messages: undefined };
      const result = await analyticsCommand.execute("", noMsgContext);
      expect(result.output).toContain("User Turns:     0");
    });
  });

  describe("with zero metrics", () => {
    it("should show zero tokens", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Input:          0");
      expect(result.output).toContain("Output:         0");
      expect(result.output).toContain("Total:          0");
    });

    it("should show zero cost", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Est. Cost:      $0.00");
    });

    it("should show zero tool invocations", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Total Invocations:  0");
    });

    it("should show 100% success rate with no tools", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Success Rate:       100.0%");
    });

    it("should show N/A for average iterations", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Avg Iterations/Request:  N/A");
    });
  });

  describe("with populated metrics", () => {
    beforeEach(() => {
      metrics.increment(COUNTERS.tokensUsed, 5000, { type: "input", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokensUsed, 1500, { type: "output", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokenCost, 0.47, { model: "gpt-4o" });
      metrics.increment(COUNTERS.toolInvocations, 10, { tool: "file_read", status: "success" });
      metrics.increment(COUNTERS.toolInvocations, 2, { tool: "file_read", status: "error" });
      metrics.increment(COUNTERS.toolInvocations, 5, { tool: "bash_exec", status: "success" });
      metrics.increment(COUNTERS.errors, 2, { category: "llm" });
    });

    it("should show token counts", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("5,000");
      expect(result.output).toContain("1,500");
      expect(result.output).toContain("6,500");
    });

    it("should show cost", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("$0.470");
    });

    it("should show tool success rate", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Succeeded:          15");
      expect(result.output).toContain("Failed:             2");
    });

    it("should show tool frequency breakdown", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("file_read");
      expect(result.output).toContain("bash_exec");
    });

    it("should show LLM errors", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("LLM Errors:              2");
    });
  });

  describe("model distribution", () => {
    it("should show model distribution when tokens are tracked", async () => {
      metrics.increment(COUNTERS.tokensUsed, 3000, { type: "input", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokensUsed, 1000, { type: "output", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokensUsed, 500, { type: "input", model: "gpt-4o-mini" });
      metrics.increment(COUNTERS.tokensUsed, 200, { type: "output", model: "gpt-4o-mini" });

      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Model Distribution");
      expect(result.output).toContain("gpt-4o");
    });

    it("should not show model distribution section with no tokens", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).not.toContain("Model Distribution");
    });
  });

  describe("token cache section", () => {
    it("should show token cache stats", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      expect(result.output).toContain("Token Cache");
      expect(result.output).toContain("Size:");
      expect(result.output).toContain("Hits:");
      expect(result.output).toContain("Misses:");
      expect(result.output).toContain("Hit Rate:");
    });
  });

  describe("activity timeline", () => {
    it("should show activity section with turns info or no-activity message", async () => {
      const result = await analyticsCommand.execute("", baseContext);
      // Since the test runs in < 1 second, duration may be 0s,
      // so either the turns/min info or the no-activity message is shown
      const hasActivity =
        result.output.includes("Turns/min:") ||
        result.output.includes("No activity recorded yet.");
      expect(hasActivity).toBe(true);
    });

    it("should show no activity message with no turns", async () => {
      const noMsgContext = { ...baseContext, messages: undefined };
      const result = await analyticsCommand.execute("", noMsgContext);
      expect(result.output).toContain("No activity recorded yet.");
    });
  });
});

describe("getModelDistribution", () => {
  beforeEach(() => {
    metrics.reset();
  });

  it("should return empty array with no metrics", () => {
    const dist = getModelDistribution();
    expect(dist).toEqual([]);
  });

  it("should return distribution sorted by total tokens descending", () => {
    metrics.increment(COUNTERS.tokensUsed, 1000, { type: "input", model: "small-model" });
    metrics.increment(COUNTERS.tokensUsed, 500, { type: "output", model: "small-model" });
    metrics.increment(COUNTERS.tokensUsed, 5000, { type: "input", model: "big-model" });
    metrics.increment(COUNTERS.tokensUsed, 2000, { type: "output", model: "big-model" });

    const dist = getModelDistribution();
    expect(dist.length).toBe(2);
    expect(dist[0].model).toBe("big-model");
    expect(dist[0].inputTokens).toBe(5000);
    expect(dist[0].outputTokens).toBe(2000);
    expect(dist[1].model).toBe("small-model");
    expect(dist[1].inputTokens).toBe(1000);
    expect(dist[1].outputTokens).toBe(500);
  });
});

describe("getToolSuccessRate", () => {
  beforeEach(() => {
    metrics.reset();
  });

  it("should return 100% rate with no tools", () => {
    const rate = getToolSuccessRate();
    expect(rate.total).toBe(0);
    expect(rate.rate).toBe(100);
  });

  it("should calculate success rate correctly", () => {
    metrics.increment(COUNTERS.toolInvocations, 8, { tool: "file_read", status: "success" });
    metrics.increment(COUNTERS.toolInvocations, 2, { tool: "file_read", status: "error" });

    const rate = getToolSuccessRate();
    expect(rate.succeeded).toBe(8);
    expect(rate.failed).toBe(2);
    expect(rate.total).toBe(10);
    expect(rate.rate).toBe(80);
  });

  it("should ignore wildcard tool entries", () => {
    metrics.increment(COUNTERS.toolInvocations, 100, { tool: "*", status: "success" });
    metrics.increment(COUNTERS.toolInvocations, 5, { tool: "bash_exec", status: "success" });

    const rate = getToolSuccessRate();
    expect(rate.succeeded).toBe(5);
    expect(rate.total).toBe(5);
  });
});

describe("getAverageIterations", () => {
  beforeEach(() => {
    metrics.reset();
  });

  it("should return 0 with no data", () => {
    expect(getAverageIterations()).toBe(0);
  });

  it("should calculate average from histogram observations", () => {
    metrics.observe(HISTOGRAMS.agentIterations, 3);
    metrics.observe(HISTOGRAMS.agentIterations, 5);
    metrics.observe(HISTOGRAMS.agentIterations, 7);

    const avg = getAverageIterations();
    expect(avg).toBe(5);
  });
});
