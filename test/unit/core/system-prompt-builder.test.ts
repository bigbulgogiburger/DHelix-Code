import { describe, it, expect, afterAll } from "vitest";
import {
  buildSystemPrompt,
  buildStructuredSystemPrompt,
  buildSystemReminder,
  compressToolDescription,
  type SessionState,
  type PromptSection,
} from "../../../src/core/system-prompt-builder.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { z } from "zod";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

describe("buildSystemPrompt", () => {
  it("should build a prompt with identity section", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("dbcode");
    expect(prompt).toContain("AI coding assistant");
  });

  it("should include environment section with platform info", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Platform:");
    expect(prompt).toContain("Working directory:");
  });

  it("should include doing tasks section", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Doing tasks");
    expect(prompt).toContain("Read files before modifying them");
  });

  it("should include code quality section", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Code quality");
  });

  it("should include tools section when registry provided", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "test_tool",
      description: "A test tool",
      parameterSchema: z.object({}),
      permissionLevel: "safe",
      execute: async () => ({ output: "ok", isError: false }),
    });

    const prompt = buildSystemPrompt({ toolRegistry: registry });
    expect(prompt).toContain("test_tool");
    expect(prompt).toContain("A test tool");
  });

  it("should include tool usage guidelines when tools provided", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "file_read",
      description: "Read a file",
      parameterSchema: z.object({}),
      permissionLevel: "safe",
      execute: async () => ({ output: "ok", isError: false }),
    });
    const prompt = buildSystemPrompt({ toolRegistry: registry });
    expect(prompt).toContain("Tool usage guidelines");
  });

  it("should not include tools section when registry empty", () => {
    const registry = new ToolRegistry();
    const prompt = buildSystemPrompt({ toolRegistry: registry });
    expect(prompt).not.toContain("Using your tools");
  });

  it("should include project instructions when provided", () => {
    const prompt = buildSystemPrompt({
      projectInstructions: "Use TypeScript strict mode",
    });
    expect(prompt).toContain("Project Instructions");
    expect(prompt).toContain("TypeScript strict mode");
  });

  it("should include custom sections", () => {
    const prompt = buildSystemPrompt({
      customSections: [{ id: "custom", content: "# Custom Section\nHello", priority: 50 }],
    });
    expect(prompt).toContain("Custom Section");
  });

  it("should order sections by priority (higher first)", () => {
    const prompt = buildSystemPrompt({
      projectInstructions: "PROJECT_MARKER",
      customSections: [{ id: "low", content: "LOW_PRIORITY_MARKER", priority: 10 }],
    });
    const identityPos = prompt.indexOf("dbcode");
    const projectPos = prompt.indexOf("PROJECT_MARKER");
    const lowPos = prompt.indexOf("LOW_PRIORITY_MARKER");
    expect(identityPos).toBeLessThan(projectPos);
    expect(projectPos).toBeLessThan(lowPos);
  });

  it("should detect git context in a git repo", () => {
    // dbcode project root is a git repo
    const prompt = buildSystemPrompt({ workingDirectory: process.cwd() });
    expect(prompt).toContain("Git branch:");
  });

  it("should not include git context for non-repo directory", () => {
    const prompt = buildSystemPrompt({ workingDirectory: tmpdir() });
    expect(prompt).not.toContain("Git branch:");
  });

  it("should detect Node.js project type", () => {
    // dbcode project root has package.json
    const prompt = buildSystemPrompt({ workingDirectory: process.cwd() });
    expect(prompt).toContain("Project type: Node.js");
  });

  it("should not include project type for bare directory", () => {
    const prompt = buildSystemPrompt({
      workingDirectory: join(tmpdir(), `no-project-${Date.now()}`),
    });
    expect(prompt).not.toContain("Project type:");
  });

  it("should auto-load DBCODE.md from .dbcode directory", () => {
    const dir = join(tmpdir(), `dbcode-prompt-autoload-${Date.now()}`);
    mkdirSync(join(dir, ".dbcode"), { recursive: true });
    writeFileSync(join(dir, ".dbcode", "DBCODE.md"), "Use strict TypeScript", "utf-8");

    const prompt = buildSystemPrompt({ workingDirectory: dir });
    expect(prompt).toContain("Use strict TypeScript");
    expect(prompt).toContain("Project Instructions");

    rmSync(dir, { recursive: true, force: true });
  });

  it("should include recent git commits", () => {
    // dbcode project root is a git repo with commits
    const prompt = buildSystemPrompt({ workingDirectory: process.cwd() });
    expect(prompt).toContain("Recent commits:");
  });

  describe("project type detection", () => {
    const baseDir = join(tmpdir(), `dbcode-project-types-${Date.now()}`);

    afterAll(() => {
      try {
        rmSync(baseDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    const cases: Array<{ type: string; marker: string }> = [
      { type: "Rust", marker: "Cargo.toml" },
      { type: "Go", marker: "go.mod" },
      { type: "Python", marker: "pyproject.toml" },
      { type: "Java", marker: "pom.xml" },
      { type: "Ruby", marker: "Gemfile" },
    ];

    for (const { type, marker } of cases) {
      it(`should detect ${type} project type`, () => {
        const dir = join(baseDir, type.toLowerCase());
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, marker), "");

        const prompt = buildSystemPrompt({ workingDirectory: dir });
        expect(prompt).toContain(`Project type: ${type}`);
      });
    }
  });
});

describe("conditional sections with SessionState", () => {
  const baseState: SessionState = {
    mode: "normal",
    isSubagent: false,
    availableTools: [],
    extendedThinkingEnabled: false,
    features: {},
  };

  it("should not include plan mode section when mode is normal", () => {
    const prompt = buildSystemPrompt({ sessionState: baseState });
    // Check for the actual plan mode section header, not just "Plan Mode" substring
    // (project docs may contain "Plan Mode" references)
    expect(prompt).not.toContain("# Plan Mode\n");
  });

  it("should include plan mode section when mode is plan", () => {
    const prompt = buildSystemPrompt({
      sessionState: { ...baseState, mode: "plan" },
    });
    expect(prompt).toContain("Plan Mode");
    expect(prompt).toContain("Do NOT make any file modifications");
  });

  it("should not include subagent section when not a subagent", () => {
    const prompt = buildSystemPrompt({ sessionState: baseState });
    expect(prompt).not.toContain("Subagent Context");
  });

  it("should include subagent section with explore type", () => {
    const prompt = buildSystemPrompt({
      sessionState: { ...baseState, isSubagent: true, subagentType: "explore" },
    });
    expect(prompt).toContain("Subagent Context");
    expect(prompt).toContain("Exploration Focus");
  });

  it("should include subagent section with plan type", () => {
    const prompt = buildSystemPrompt({
      sessionState: { ...baseState, isSubagent: true, subagentType: "plan" },
    });
    expect(prompt).toContain("Planning Focus");
  });

  it("should include subagent section with general type", () => {
    const prompt = buildSystemPrompt({
      sessionState: { ...baseState, isSubagent: true, subagentType: "general" },
    });
    expect(prompt).toContain("General Task");
  });

  it("should not include extended thinking section when disabled", () => {
    const prompt = buildSystemPrompt({ sessionState: baseState });
    expect(prompt).not.toContain("Extended Thinking");
  });

  it("should include extended thinking section when enabled", () => {
    const prompt = buildSystemPrompt({
      sessionState: { ...baseState, extendedThinkingEnabled: true },
    });
    expect(prompt).toContain("Extended Thinking");
  });

  it("should include feature-flag-gated sections when feature enabled", () => {
    const prompt = buildSystemPrompt({
      sessionState: { ...baseState, features: { "parallel-tools": true } },
    });
    expect(prompt).toContain("Parallel Tool Execution");
  });

  it("should not include feature sections when feature disabled", () => {
    const prompt = buildSystemPrompt({
      sessionState: { ...baseState, features: { "parallel-tools": false } },
    });
    expect(prompt).not.toContain("Parallel Tool Execution");
  });

  it("should support multiple conditional sections simultaneously", () => {
    const prompt = buildSystemPrompt({
      sessionState: {
        mode: "plan",
        isSubagent: false,
        availableTools: [],
        extendedThinkingEnabled: true,
        features: { "auto-compact": true },
      },
    });
    expect(prompt).toContain("Plan Mode");
    expect(prompt).toContain("Extended Thinking");
    expect(prompt).toContain("Auto-Compaction");
    // Should NOT have subagent section
    expect(prompt).not.toContain("Subagent Context");
  });
});

describe("custom section conditions", () => {
  it("should include custom section when condition returns true", () => {
    const sections: PromptSection[] = [
      {
        id: "conditional",
        content: "CONDITIONAL_CONTENT",
        priority: 50,
        condition: () => true,
      },
    ];
    const prompt = buildSystemPrompt({ customSections: sections });
    expect(prompt).toContain("CONDITIONAL_CONTENT");
  });

  it("should exclude custom section when condition returns false", () => {
    const sections: PromptSection[] = [
      {
        id: "conditional",
        content: "CONDITIONAL_CONTENT",
        priority: 50,
        condition: () => false,
      },
    ];
    const prompt = buildSystemPrompt({ customSections: sections });
    expect(prompt).not.toContain("CONDITIONAL_CONTENT");
  });

  it("should include custom section when condition is undefined", () => {
    const sections: PromptSection[] = [
      {
        id: "no-condition",
        content: "ALWAYS_INCLUDED",
        priority: 50,
      },
    ];
    const prompt = buildSystemPrompt({ customSections: sections });
    expect(prompt).toContain("ALWAYS_INCLUDED");
  });
});

describe("token budget", () => {
  it("should trim lowest-priority sections when budget exceeded", () => {
    const prompt = buildSystemPrompt({
      customSections: [{ id: "big-low", content: "A".repeat(5000), priority: 5 }],
      totalTokenBudget: 500,
    });
    // The high-priority identity section should be included
    expect(prompt).toContain("dbcode");
    // The big low-priority section should be trimmed
    expect(prompt).not.toContain("A".repeat(5000));
  });

  it("should keep all sections when under budget", () => {
    const prompt = buildSystemPrompt({
      customSections: [{ id: "small", content: "SMALL_SECTION", priority: 50 }],
    });
    expect(prompt).toContain("SMALL_SECTION");
  });

  it("should respect per-section tokenBudget", () => {
    const longContent = "Line one\n".repeat(500);
    const prompt = buildSystemPrompt({
      customSections: [{ id: "capped", content: longContent, priority: 50, tokenBudget: 20 }],
    });
    // Should be truncated
    expect(prompt).toContain("...(truncated)");
    // Should not contain the full content
    expect(prompt).not.toContain("Line one\n".repeat(500));
  });
});

describe("buildSystemReminder", () => {
  it("should generate tool-usage reminder", () => {
    const reminder = buildSystemReminder("tool-usage");
    expect(reminder).toContain("<system-reminder>");
    expect(reminder).toContain("file_read");
    expect(reminder).toContain("parallel");
    expect(reminder).toContain("</system-reminder>");
  });

  it("should generate code-quality reminder", () => {
    const reminder = buildSystemReminder("code-quality");
    expect(reminder).toContain("minimal and focused");
    expect(reminder).toContain("code style");
  });

  it("should generate git-safety reminder", () => {
    const reminder = buildSystemReminder("git-safety");
    expect(reminder).toContain("force push");
    expect(reminder).toContain("conventional commit");
  });

  it("should generate context-limit reminder with usage percentage", () => {
    const reminder = buildSystemReminder("context-limit", { usagePercent: 85 });
    expect(reminder).toContain("85%");
    expect(reminder).toContain("concise");
  });

  it("should handle context-limit without context parameter", () => {
    const reminder = buildSystemReminder("context-limit");
    expect(reminder).toContain("0%");
  });
});

describe("backward compatibility", () => {
  it("should work with no arguments", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("dbcode");
  });

  it("should work with only old-style options", () => {
    const prompt = buildSystemPrompt({
      projectInstructions: "Test instructions",
      workingDirectory: process.cwd(),
    });
    expect(prompt).toContain("Test instructions");
  });

  it("should work with mixed old and new options", () => {
    const prompt = buildSystemPrompt({
      projectInstructions: "Test instructions",
      sessionState: {
        mode: "plan",
        isSubagent: false,
        availableTools: [],
        extendedThinkingEnabled: false,
        features: {},
      },
    });
    expect(prompt).toContain("Test instructions");
    expect(prompt).toContain("Plan Mode");
  });
});

describe("buildStructuredSystemPrompt", () => {
  it("should return text and blocks", () => {
    const result = buildStructuredSystemPrompt();
    expect(result.text).toBeTruthy();
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it("should mark static sections with cache_control", () => {
    const result = buildStructuredSystemPrompt();
    const cachedBlocks = result.blocks.filter((b) => b.cache_control);
    expect(cachedBlocks.length).toBeGreaterThan(0);
  });

  it("should not cache environment section", () => {
    const result = buildStructuredSystemPrompt({ workingDirectory: "/tmp" });
    const envBlock = result.blocks.find((b) => b.text.includes("# Environment"));
    // Environment is dynamic, should NOT have cache_control
    if (envBlock) {
      expect(envBlock.cache_control).toBeUndefined();
    }
  });

  it("should produce blocks whose text concatenation matches the full text", () => {
    const result = buildStructuredSystemPrompt();
    const reconstructed = result.blocks.map((b) => b.text).join("\n\n---\n\n");
    expect(reconstructed).toBe(result.text);
  });
});

describe("compressToolDescription", () => {
  it("should return full description for high tier", () => {
    const desc = "Read a file from disk. Supports binary and text files.";
    expect(compressToolDescription(desc, "high")).toBe(desc);
  });

  it("should return full description for medium tier", () => {
    const desc = "Read a file from disk. Supports binary and text files.";
    expect(compressToolDescription(desc, "medium")).toBe(desc);
  });

  it("should keep only first sentence for low tier", () => {
    const desc = "Read a file from disk. Supports binary and text files.";
    expect(compressToolDescription(desc, "low")).toBe("Read a file from disk.");
  });

  it("should return full description when no period exists for low tier", () => {
    const desc = "Read a file from disk";
    expect(compressToolDescription(desc, "low")).toBe(desc);
  });
});

describe("tier-based system prompt budget", () => {
  it("should include low-tier tool guide when capabilityTier is low", () => {
    const prompt = buildSystemPrompt({ capabilityTier: "low" });
    expect(prompt).toContain("# Tool Usage Guide");
    expect(prompt).toContain("Call file_read");
    expect(prompt).toContain("Call file_edit");
    expect(prompt).toContain("Call grep_search");
    expect(prompt).toContain("Call bash_exec");
  });

  it("should not include low-tier tool guide for high tier", () => {
    const prompt = buildSystemPrompt({ capabilityTier: "high" });
    expect(prompt).not.toContain("# Tool Usage Guide");
  });

  it("should not include low-tier tool guide for medium tier", () => {
    const prompt = buildSystemPrompt({ capabilityTier: "medium" });
    expect(prompt).not.toContain("# Tool Usage Guide");
  });

  it("should not include low-tier tool guide when tier is undefined", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("# Tool Usage Guide");
  });

  it("should compress tool descriptions for low tier", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "test_tool",
      description: "A test tool for testing. It supports many features and options.",
      parameterSchema: z.object({}),
      permissionLevel: "safe",
      execute: async () => ({ output: "ok", isError: false }),
    });

    const prompt = buildSystemPrompt({
      toolRegistry: registry,
      capabilityTier: "low",
    });
    // Should have only first sentence
    expect(prompt).toContain("A test tool for testing.");
    // Should not have the second sentence
    expect(prompt).not.toContain("It supports many features");
  });

  it("should not compress tool descriptions for high tier", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "test_tool",
      description: "A test tool for testing. It supports many features and options.",
      parameterSchema: z.object({}),
      permissionLevel: "safe",
      execute: async () => ({ output: "ok", isError: false }),
    });

    const prompt = buildSystemPrompt({
      toolRegistry: registry,
      capabilityTier: "high",
    });
    expect(prompt).toContain("It supports many features and options.");
  });

  it("should include CoT scaffolding for low tier", () => {
    const prompt = buildSystemPrompt({ capabilityTier: "low" });
    expect(prompt).toContain("Step-by-Step Approach");
  });

  it("should not include CoT scaffolding for high tier", () => {
    const prompt = buildSystemPrompt({ capabilityTier: "high" });
    expect(prompt).not.toContain("Step-by-Step Approach");
  });

  it("should apply tier-based total token budget for low tier", () => {
    // Low tier budget is 4000 tokens — this should trim some sections
    const prompt = buildSystemPrompt({
      capabilityTier: "low",
      customSections: [
        { id: "big", content: "X".repeat(20000), priority: 5 },
      ],
    });
    // Big low-priority section should be trimmed due to low budget
    expect(prompt).not.toContain("X".repeat(20000));
    // But identity (highest priority) should still be present
    expect(prompt).toContain("dbcode");
  });

  it("should allow explicit totalTokenBudget to override tier budget", () => {
    // Explicitly set high budget even though tier is low
    const prompt = buildSystemPrompt({
      capabilityTier: "low",
      totalTokenBudget: 50_000,
      customSections: [
        { id: "big", content: "MARKER_" + "Y".repeat(200), priority: 50 },
      ],
    });
    // With large explicit budget, the section should be included
    expect(prompt).toContain("MARKER_");
  });
});
