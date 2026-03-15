import { describe, it, expect } from "vitest";
import {
  estimateTaskComplexity,
  getContextStrategy,
  type TaskComplexity,
  type ContextStrategy,
} from "../../../src/core/adaptive-context.js";

describe("estimateTaskComplexity", () => {
  describe("simple tasks", () => {
    it("should classify empty input as simple", () => {
      expect(estimateTaskComplexity("")).toBe("simple");
      expect(estimateTaskComplexity("   ")).toBe("simple");
    });

    it("should classify question-style prompts as simple", () => {
      expect(estimateTaskComplexity("what is the main entry point?")).toBe("simple");
      expect(estimateTaskComplexity("where is the config file?")).toBe("simple");
      expect(estimateTaskComplexity("how does the auth module work?")).toBe("simple");
      expect(estimateTaskComplexity("show me the types")).toBe("simple");
    });

    it("should classify read/run/check commands as simple", () => {
      expect(estimateTaskComplexity("read the file src/index.ts")).toBe("simple");
      expect(estimateTaskComplexity("run npm test")).toBe("simple");
      expect(estimateTaskComplexity("check the build output")).toBe("simple");
    });

    it("should classify small fixes as simple", () => {
      expect(estimateTaskComplexity("fix a typo in the readme")).toBe("simple");
      expect(estimateTaskComplexity("rename a variable in utils.ts")).toBe("simple");
      expect(estimateTaskComplexity("remove an unused import")).toBe("simple");
    });
  });

  describe("complex tasks", () => {
    it("should classify refactoring requests as complex", () => {
      const result = estimateTaskComplexity(
        "refactor the authentication module to use dependency injection across multiple files",
      );
      expect(result).toBe("complex");
    });

    it("should classify architecture requests as complex", () => {
      const result = estimateTaskComplexity(
        "architect a new plugin system with event-driven communication and implement a new service layer across multiple files",
      );
      expect(result).toBe("complex");
    });

    it("should classify migration requests as complex", () => {
      const result = estimateTaskComplexity(
        "migrate the database layer from Prisma to Drizzle and refactor across all services",
      );
      expect(result).toBe("complex");
    });

    it("should classify multi-step tasks as complex", () => {
      const result = estimateTaskComplexity(
        "implement a new system for caching with multi-step validation pipeline",
      );
      expect(result).toBe("complex");
    });

    it("should classify tasks with many file references as higher complexity", () => {
      const result = estimateTaskComplexity(
        "update config.ts, index.ts, utils.ts, types.ts to support the new feature",
      );
      // Multiple file references push complexity up
      expect(["moderate", "complex"]).toContain(result);
    });
  });

  describe("moderate tasks", () => {
    it("should classify medium-length implementation requests as moderate", () => {
      const result = estimateTaskComplexity(
        "implement a new feature that adds rate limiting to the API endpoints using a sliding window algorithm",
      );
      expect(result).toBe("moderate");
    });

    it("should classify performance optimization as at least moderate", () => {
      const result = estimateTaskComplexity("performance optimization of the cache layer");
      expect(["moderate", "complex"]).toContain(result);
    });
  });

  describe("scoring behavior", () => {
    it("should handle mixed signals (complex keyword + simple indicator)", () => {
      // "what" is simple (-2), but "refactor" is complex (+2) — net 0, maps to simple
      const result = estimateTaskComplexity("what would it take to refactor the auth module?");
      expect(result).toBe("simple");
    });

    it("should bump complexity for very long inputs", () => {
      const longInput = Array(100).fill("word").join(" ");
      const result = estimateTaskComplexity(longInput);
      expect(result).not.toBe("simple");
    });
  });
});

describe("getContextStrategy", () => {
  it("should return minimal context for simple tasks", () => {
    const strategy = getContextStrategy("simple");

    expect(strategy.includeRepoMap).toBe(false);
    expect(strategy.includeFullInstructions).toBe(false);
    expect(strategy.maxSystemPromptSections).toBe(4);
  });

  it("should return balanced context for moderate tasks", () => {
    const strategy = getContextStrategy("moderate");

    expect(strategy.includeRepoMap).toBe(true);
    expect(strategy.includeFullInstructions).toBe(true);
    expect(strategy.maxSystemPromptSections).toBe(8);
  });

  it("should return full context for complex tasks", () => {
    const strategy = getContextStrategy("complex");

    expect(strategy.includeRepoMap).toBe(true);
    expect(strategy.includeFullInstructions).toBe(true);
    expect(strategy.maxSystemPromptSections).toBe(16);
  });

  it("should return readonly-compatible objects", () => {
    const strategy: ContextStrategy = getContextStrategy("simple");
    expect(strategy).toBeDefined();
    expect(typeof strategy.includeRepoMap).toBe("boolean");
    expect(typeof strategy.maxSystemPromptSections).toBe("number");
  });

  it("should return progressively more sections as complexity increases", () => {
    const simple = getContextStrategy("simple");
    const moderate = getContextStrategy("moderate");
    const complex = getContextStrategy("complex");

    expect(simple.maxSystemPromptSections).toBeLessThan(moderate.maxSystemPromptSections);
    expect(moderate.maxSystemPromptSections).toBeLessThan(complex.maxSystemPromptSections);
  });
});
