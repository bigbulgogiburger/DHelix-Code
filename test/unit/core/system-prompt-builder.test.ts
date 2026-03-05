import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../../src/core/system-prompt-builder.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { z } from "zod";

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

  it("should include conventions section", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Read files before modifying");
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

  it("should not include tools section when registry empty", () => {
    const registry = new ToolRegistry();
    const prompt = buildSystemPrompt({ toolRegistry: registry });
    expect(prompt).not.toContain("Available Tools");
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
});
