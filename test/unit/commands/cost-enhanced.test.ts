import { describe, it, expect, beforeEach } from "vitest";
import {
  costCommand,
  formatTokenCount,
  formatCost,
  calculateEfficiency,
} from "../../../src/commands/cost.js";
import { metrics, COUNTERS } from "../../../src/telemetry/metrics.js";

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

describe("/cost enhanced", () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe("basic output format", () => {
    it("should include header", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Token Usage & Cost");
      expect(result.output).toContain("===================");
    });

    it("should display current model", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("Current Model: gpt-4o");
    });

    it("should include all major sections", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("Token Breakdown:");
      expect(result.output).toContain("Estimated Cost:");
      expect(result.output).toContain("Pricing:");
      expect(result.output).toContain("Efficiency:");
      expect(result.output).toContain("Tip:");
    });
  });

  describe("with zero usage", () => {
    it("should show zero tokens", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("Input:");
      expect(result.output).toContain("Output:");
      expect(result.output).toContain("($0.00)");
    });

    it("should show zero estimated cost", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("Estimated Cost: $0.00");
    });

    it("should show pricing for gpt-4o", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("Input:  $2.50 / 1M tokens");
      expect(result.output).toContain("Output: $10.00 / 1M tokens");
    });

    it("should show efficiency with recorded turns", async () => {
      const result = await costCommand.execute("", baseContext);
      // 1 user message => 1 turn, but zero tokens => zero cost per turn
      expect(result.output).toContain("Cost per turn: $0.00");
      expect(result.output).toContain("Tokens per turn: ~0");
      expect(result.output).toContain("Output ratio: 0.0%");
    });

    it("should show no turns message when no messages", async () => {
      const noMsgContext = { ...baseContext, messages: undefined };
      const result = await costCommand.execute("", noMsgContext);
      expect(result.output).toContain("No turns recorded yet.");
    });
  });

  describe("with non-zero usage", () => {
    beforeEach(() => {
      metrics.increment(COUNTERS.tokensUsed, 98200, { type: "input", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokensUsed, 27230, { type: "output", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokenCost, 0.653, { model: "gpt-4o" });
    });

    it("should show token counts with separators", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("98,200");
      expect(result.output).toContain("27,230");
      expect(result.output).toContain("125,430");
    });

    it("should show tracked cost", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("Estimated Cost: $0.653");
    });

    it("should show per-component costs", async () => {
      const result = await costCommand.execute("", baseContext);
      // Input: 98200 / 1M * 2.5 = $0.2455 => formatted as $0.245
      expect(result.output).toContain("($0.245)");
      // Output: 27230 / 1M * 10 = $0.2723
      expect(result.output).toContain("($0.272)");
    });

    it("should show efficiency metrics with turns", async () => {
      const multiTurnContext = {
        ...baseContext,
        messages: [
          { role: "user" as const, content: "Hello" },
          { role: "assistant" as const, content: "Hi" },
          { role: "user" as const, content: "Help" },
          { role: "assistant" as const, content: "Sure" },
          { role: "user" as const, content: "Code" },
          { role: "assistant" as const, content: "Done" },
        ],
      };
      const result = await costCommand.execute("", multiTurnContext);
      // 3 user turns
      expect(result.output).toContain("Cost per turn:");
      expect(result.output).toContain("Tokens per turn:");
      expect(result.output).toContain("Output ratio:");
    });
  });

  describe("pricing display for different models", () => {
    it("should show gpt-4o-mini pricing", async () => {
      const miniContext = { ...baseContext, model: "gpt-4o-mini" };
      const result = await costCommand.execute("", miniContext);
      expect(result.output).toContain("Current Model: gpt-4o-mini");
      expect(result.output).toContain("Input:  $0.15 / 1M tokens");
      expect(result.output).toContain("Output: $0.60 / 1M tokens");
    });

    it("should show claude-sonnet-4 pricing", async () => {
      const claudeContext = { ...baseContext, model: "claude-sonnet-4" };
      const result = await costCommand.execute("", claudeContext);
      expect(result.output).toContain("Current Model: claude-sonnet-4");
      expect(result.output).toContain("Input:  $3.00 / 1M tokens");
      expect(result.output).toContain("Output: $15.00 / 1M tokens");
    });

    it("should show zero pricing for local models", async () => {
      const localContext = { ...baseContext, model: "llama3.1" };
      const result = await costCommand.execute("", localContext);
      expect(result.output).toContain("Input:  $0.00 / 1M tokens");
      expect(result.output).toContain("Output: $0.00 / 1M tokens");
    });

    it("should show default pricing for unknown models", async () => {
      const unknownContext = { ...baseContext, model: "unknown-model-x" };
      const result = await costCommand.execute("", unknownContext);
      expect(result.output).toContain("Input:  $1.00 / 1M tokens");
      expect(result.output).toContain("Output: $3.00 / 1M tokens");
    });
  });

  describe("efficiency metrics calculation", () => {
    it("should calculate output ratio correctly", async () => {
      metrics.increment(COUNTERS.tokensUsed, 8000, { type: "input", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokensUsed, 2000, { type: "output", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokenCost, 0.04, { model: "gpt-4o" });

      const result = await costCommand.execute("", baseContext);
      // 2000 / 10000 = 20%
      expect(result.output).toContain("Output ratio: 20.0%");
    });

    it("should calculate cost per turn", async () => {
      metrics.increment(COUNTERS.tokensUsed, 10000, { type: "input", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokensUsed, 5000, { type: "output", model: "gpt-4o" });
      metrics.increment(COUNTERS.tokenCost, 0.3, { model: "gpt-4o" });

      const twoTurnContext = {
        ...baseContext,
        messages: [
          { role: "user" as const, content: "A" },
          { role: "assistant" as const, content: "B" },
          { role: "user" as const, content: "C" },
          { role: "assistant" as const, content: "D" },
        ],
      };

      const result = await costCommand.execute("", twoTurnContext);
      // 2 user turns, $0.3 total => $0.15 per turn
      expect(result.output).toContain("Cost per turn: $0.150");
    });
  });

  describe("output format verification", () => {
    it("should include tip about /model command", async () => {
      const result = await costCommand.execute("", baseContext);
      expect(result.output).toContain("Tip: Use /model to switch to a cheaper model");
    });

    it("should use consistent indentation", async () => {
      const result = await costCommand.execute("", baseContext);
      const lines = result.output.split("\n");
      // Section headers use 2-space indent
      const sectionLines = lines.filter(
        (l) =>
          l.includes("Token Breakdown:") || l.includes("Pricing:") || l.includes("Efficiency:"),
      );
      for (const line of sectionLines) {
        expect(line).toMatch(/^ {2}\S/);
      }
      // Detail lines use 4-space indent
      const detailLines = lines.filter(
        (l) => l.includes("Input:") && l.includes("$") && !l.includes("Token"),
      );
      for (const line of detailLines) {
        expect(line).toMatch(/^ {4}\S/);
      }
    });
  });
});

describe("formatTokenCount", () => {
  it("should format zero", () => {
    expect(formatTokenCount(0, 6)).toBe("     0");
  });

  it("should format with comma separators", () => {
    expect(formatTokenCount(1234567, 10)).toBe(" 1,234,567");
  });

  it("should pad to specified width", () => {
    const result = formatTokenCount(100, 8);
    expect(result.length).toBe(8);
    expect(result.trim()).toBe("100");
  });

  it("should not truncate if wider than width", () => {
    const result = formatTokenCount(1000000, 2);
    expect(result).toContain("1,000,000");
  });
});

describe("formatCost", () => {
  it("should format zero cost", () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it("should format sub-cent amounts with 4 decimals", () => {
    expect(formatCost(0.0025)).toBe("$0.0025");
  });

  it("should format sub-dollar amounts with 3 decimals", () => {
    expect(formatCost(0.245)).toBe("$0.245");
    expect(formatCost(0.5)).toBe("$0.500");
  });

  it("should format dollar+ amounts with 2 decimals", () => {
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(12.345)).toBe("$12.35");
  });
});

describe("calculateEfficiency", () => {
  it("should return zeros for zero turns", () => {
    const result = calculateEfficiency(1000, 500, 0.5, 0);
    expect(result.costPerTurn).toBe(0);
    expect(result.tokensPerTurn).toBe(0);
    expect(result.outputRatio).toBe(0);
  });

  it("should calculate correct values", () => {
    const result = calculateEfficiency(8000, 2000, 0.4, 2);
    expect(result.costPerTurn).toBe(0.2);
    expect(result.tokensPerTurn).toBe(5000);
    expect(result.outputRatio).toBe(20);
  });

  it("should handle all-input scenario", () => {
    const result = calculateEfficiency(10000, 0, 0.1, 1);
    expect(result.outputRatio).toBe(0);
    expect(result.tokensPerTurn).toBe(10000);
  });

  it("should handle all-output scenario", () => {
    const result = calculateEfficiency(0, 5000, 0.3, 1);
    expect(result.outputRatio).toBe(100);
    expect(result.tokensPerTurn).toBe(5000);
  });
});
