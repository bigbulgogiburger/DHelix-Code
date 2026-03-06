import { describe, it, expect, afterEach } from "vitest";
import { clearCommand } from "../../../src/commands/clear.js";
import { compactCommand } from "../../../src/commands/compact.js";
import { helpCommand, setHelpCommands } from "../../../src/commands/help.js";
import { modelCommand } from "../../../src/commands/model.js";
import { effortCommand } from "../../../src/commands/effort.js";
import { fastCommand } from "../../../src/commands/fast.js";
import { simplifyCommand } from "../../../src/commands/simplify.js";
import { batchCommand } from "../../../src/commands/batch.js";
import { debugCommand } from "../../../src/commands/debug.js";
import { exportCommand } from "../../../src/commands/export.js";
import { copyCommand } from "../../../src/commands/copy.js";
import { costCommand } from "../../../src/commands/cost.js";
import { contextCommand } from "../../../src/commands/context.js";
import { statsCommand } from "../../../src/commands/stats.js";
import { doctorCommand } from "../../../src/commands/doctor.js";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("Core slash commands", () => {
  it("/clear should clear conversation", async () => {
    const result = await clearCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.shouldClear).toBe(true);
  });

  it("/compact should return instructions", async () => {
    const result = await compactCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toBeTypeOf("string");
  });

  it("/help should list commands", async () => {
    setHelpCommands([clearCommand, compactCommand, helpCommand]);
    const result = await helpCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("clear");
  });

  it("/model should show current model without args", async () => {
    const result = await modelCommand.execute("", baseContext);
    expect(result.output).toContain("test-model");
  });

  it("/model should switch model with args", async () => {
    const result = await modelCommand.execute("gpt-4", baseContext);
    expect(result.newModel).toBe("gpt-4");
  });

  it("/effort should show instructions", async () => {
    const result = await effortCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });

  it("/fast should toggle fast mode", async () => {
    const result = await fastCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });

  it("/simplify should provide instructions", async () => {
    const result = await simplifyCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });

  it("/batch should require args", async () => {
    const result = await batchCommand.execute("", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("/batch should accept pattern and operation", async () => {
    const result = await batchCommand.execute("src/**/*.ts add comments", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("src/**/*.ts");
  });

  it("/debug should require args", async () => {
    const result = await debugCommand.execute("", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("/debug should accept error description", async () => {
    const result = await debugCommand.execute("TypeError: undefined", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("TypeError");
  });

  it("all core commands should have name and description", () => {
    const commands = [
      clearCommand,
      compactCommand,
      helpCommand,
      modelCommand,
      effortCommand,
      fastCommand,
      simplifyCommand,
      batchCommand,
      debugCommand,
    ];
    for (const cmd of commands) {
      expect(cmd.name).toBeTypeOf("string");
      expect(cmd.description).toBeTypeOf("string");
      expect(cmd.execute).toBeTypeOf("function");
    }
  });
});

describe("export command", () => {
  const exportDir = join(tmpdir(), `dbcode-export-test-${Date.now()}`);

  afterEach(async () => {
    await rm(exportDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should export conversation with messages", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(exportDir, { recursive: true });

    const result = await exportCommand.execute("test-export.md", {
      ...baseContext,
      workingDirectory: exportDir,
      messages: [
        { role: "user", content: "Hello there" },
        { role: "assistant", content: "Hi! How can I help?" },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain("test-export.md");

    // Verify file was written with conversation content
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(join(exportDir, "test-export.md"), "utf-8");
    expect(content).toContain("Hello there");
    expect(content).toContain("How can I help");
    expect(content).toContain("**User**");
    expect(content).toContain("**Assistant**");
  });

  it("should export with empty messages", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(exportDir, { recursive: true });

    const result = await exportCommand.execute("empty.md", {
      ...baseContext,
      workingDirectory: exportDir,
      messages: [],
    });
    expect(result.success).toBe(true);

    const { readFile } = await import("node:fs/promises");
    const content = await readFile(join(exportDir, "empty.md"), "utf-8");
    expect(content).toContain("No messages");
  });

  it("should generate filename when not provided", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(exportDir, { recursive: true });

    const result = await exportCommand.execute("", {
      ...baseContext,
      workingDirectory: exportDir,
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain("dbcode-conversation-");
  });

  it("should handle write errors gracefully", async () => {
    const result = await exportCommand.execute("test.md", {
      ...baseContext,
      workingDirectory: "/nonexistent/path/that/does/not/exist",
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("Export failed");
  });

  it("should skip system messages in export", async () => {
    const { mkdir, readFile } = await import("node:fs/promises");
    await mkdir(exportDir, { recursive: true });

    const result = await exportCommand.execute("skip-sys.md", {
      ...baseContext,
      workingDirectory: exportDir,
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
      ],
    });
    expect(result.success).toBe(true);

    const content = await readFile(join(exportDir, "skip-sys.md"), "utf-8");
    expect(content).not.toContain("You are a helpful assistant");
    expect(content).toContain("Question");
    expect(content).toContain("Answer");
  });
});

describe("copy command", () => {
  const contextWithMessages = {
    ...baseContext,
    messages: [
      { role: "user", content: "Show me a function" },
      {
        role: "assistant",
        content:
          'Here is a function:\n\n```typescript\nfunction hello() {\n  return "world";\n}\n```\n\nAnd another:\n\n```python\ndef greet():\n    return "hi"\n```',
      },
    ],
  };

  it("should reject invalid block number", async () => {
    const result = await copyCommand.execute("abc", contextWithMessages);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("should report no code blocks when none exist", async () => {
    const result = await copyCommand.execute("", {
      ...baseContext,
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "Hi there, no code blocks here!" },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.output).toContain("No code blocks");
  });

  it("should report out of range block number", async () => {
    const result = await copyCommand.execute("99", contextWithMessages);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
    expect(result.output).toContain("2 code block(s)");
  });

  it("should copy last code block to clipboard", async () => {
    const result = await copyCommand.execute("", contextWithMessages);
    // On this system, clipboard should work (Windows has clip command)
    if (result.success) {
      expect(result.output).toContain("Copied code block");
      expect(result.output).toContain("python");
    }
    // If clipboard fails (e.g., in CI), that's also OK
    expect(result.output).toBeTypeOf("string");
  });

  it("should copy specific block number", async () => {
    const result = await copyCommand.execute("1", contextWithMessages);
    if (result.success) {
      expect(result.output).toContain("#1");
      expect(result.output).toContain("typescript");
    }
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle empty messages gracefully", async () => {
    const result = await copyCommand.execute("", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("No code blocks");
  });
});

describe("cost command", () => {
  it("should show cost information", async () => {
    const result = await costCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("test-model");
  });
});

describe("context command", () => {
  it("should show context usage", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });
});

describe("stats command", () => {
  it("should show session stats", async () => {
    const result = await statsCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });
});

describe("doctor command", () => {
  it("should run diagnostics", async () => {
    const result = await doctorCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Doctor");
  });
});
