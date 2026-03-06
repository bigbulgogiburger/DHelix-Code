import { describe, it, expect, afterAll } from "vitest";
import { buildSystemPrompt } from "../../../src/core/system-prompt-builder.js";
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
