import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  exportCommand,
  sanitizeContent,
  detectToolCalls,
  estimateTokens,
} from "../../../src/commands/export.js";

const TMP_DIR = join(process.cwd(), "test", "tmp");

const baseContext = {
  workingDirectory: TMP_DIR,
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
  messages: [
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi there!" },
  ],
};

/** Cleanup helper — removes a file silently */
async function cleanup(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    /* ignore */
  }
}

describe("/export enhanced", () => {
  afterEach(async () => {
    // Clean up any generated files
    const { readdir } = await import("node:fs/promises");
    try {
      const files = await readdir(TMP_DIR);
      for (const f of files) {
        if (f.startsWith("dhelix-conversation") || f === "test-export.md") {
          await cleanup(join(TMP_DIR, f));
        }
      }
    } catch {
      /* ignore if dir doesn't exist */
    }
  });

  describe("basic export", () => {
    it("should create a file and report success", async () => {
      const result = await exportCommand.execute("test-export.md", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("exported");
      expect(result.output).toContain("test-export.md");
    });

    it("should generate default filename when no args given", async () => {
      const result = await exportCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("dhelix-conversation");
      expect(result.output).toContain(".md");
    });

    it("should write valid markdown to the file", async () => {
      await exportCommand.execute("test-export.md", baseContext);
      const filePath = join(TMP_DIR, "test-export.md");
      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("# Dhelix Code Conversation Export");
    });
  });

  describe("metadata header", () => {
    it("should include a table with metadata fields", async () => {
      await exportCommand.execute("test-export.md", baseContext);
      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");

      expect(content).toContain("| Field | Value |");
      expect(content).toContain("| Model | test-model |");
      expect(content).toContain("| Session | test-session |");
      expect(content).toContain("| Version |");
      expect(content).toContain("| Platform |");
      expect(content).toContain("| Directory |");
    });

    it("should show N/A for missing session", async () => {
      const ctx = { ...baseContext, sessionId: undefined };
      await exportCommand.execute("test-export.md", ctx);
      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");
      expect(content).toContain("| Session | N/A |");
    });
  });

  describe("empty messages", () => {
    it("should handle empty message array", async () => {
      const ctx = { ...baseContext, messages: [] };
      const result = await exportCommand.execute("test-export.md", ctx);
      expect(result.success).toBe(true);

      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");
      expect(content).toContain("(No messages in conversation)");
      // Should NOT contain a Summary section
      expect(content).not.toContain("## Summary");
    });

    it("should handle undefined messages", async () => {
      const ctx = { ...baseContext, messages: undefined };
      const result = await exportCommand.execute("test-export.md", ctx);
      expect(result.success).toBe(true);

      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");
      expect(content).toContain("(No messages in conversation)");
    });
  });

  describe("turn numbering", () => {
    it("should number turns based on user messages", async () => {
      const ctx = {
        ...baseContext,
        messages: [
          { role: "user" as const, content: "First question" },
          { role: "assistant" as const, content: "First answer" },
          { role: "user" as const, content: "Second question" },
          { role: "assistant" as const, content: "Second answer" },
        ],
      };
      await exportCommand.execute("test-export.md", ctx);
      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");
      expect(content).toContain("## Turn 1");
      expect(content).toContain("## Turn 2");
    });

    it("should skip system messages", async () => {
      const ctx = {
        ...baseContext,
        messages: [
          { role: "system" as const, content: "System prompt" },
          { role: "user" as const, content: "Hello" },
          { role: "assistant" as const, content: "Hi" },
        ],
      };
      await exportCommand.execute("test-export.md", ctx);
      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");
      expect(content).not.toContain("System prompt");
      expect(content).toContain("## Turn 1");
    });
  });

  describe("summary section", () => {
    it("should include summary with counts", async () => {
      const ctx = {
        ...baseContext,
        messages: [
          { role: "user" as const, content: "Q1" },
          { role: "assistant" as const, content: "A1" },
          { role: "user" as const, content: "Q2" },
          { role: "assistant" as const, content: "A2" },
        ],
      };
      await exportCommand.execute("test-export.md", ctx);
      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");
      expect(content).toContain("## Summary");
      expect(content).toContain("**Turns**: 2 (2 user, 2 assistant)");
      expect(content).toContain("**Total messages**: 4");
      expect(content).toContain("**Estimated tokens**:");
    });
  });

  describe("tool call detection", () => {
    it("should detect tool references in assistant messages", async () => {
      const ctx = {
        ...baseContext,
        messages: [
          { role: "user" as const, content: "List files" },
          {
            role: "assistant" as const,
            content: "Let me check. > Tool: `glob_search`\nFound 10 files.",
          },
        ],
      };
      await exportCommand.execute("test-export.md", ctx);
      const content = await readFile(join(TMP_DIR, "test-export.md"), "utf-8");
      expect(content).toContain("> Tool: `glob_search`");
    });
  });

  describe("command metadata", () => {
    it("should have correct name, description, and usage", () => {
      expect(exportCommand.name).toBe("export");
      expect(exportCommand.description).toContain("Export");
      expect(exportCommand.usage).toContain("--clipboard");
    });
  });

  describe("clipboard mode", () => {
    it("should attempt clipboard copy with --clipboard flag", async () => {
      const result = await exportCommand.execute("--clipboard", baseContext);
      // On macOS in CI/test this may or may not have pbcopy available
      expect(result.output).toMatch(/clipboard|Clipboard/);
    });
  });

  describe("error handling", () => {
    it("should return failure for invalid directory", async () => {
      const ctx = { ...baseContext, workingDirectory: "/nonexistent/path/that/does/not/exist" };
      const result = await exportCommand.execute("test.md", ctx);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Export failed");
    });
  });
});

describe("sanitizeContent", () => {
  it("should redact OpenAI API keys (sk-...)", () => {
    const input = "My key is sk-abcdefghijklmnopqrstuvwxyz1234567890";
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED_API_KEY]");
    expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz1234567890");
  });

  it("should redact key- prefixed keys", () => {
    const input = "Using key-abcdefghijklmnopqrstuvwxyz";
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED_KEY]");
  });

  it("should redact Bearer tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghij";
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED_TOKEN]");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  it("should redact GitHub tokens", () => {
    const input = "token: ghp_abcdefghijklmnopqrstuvwxyz1234567890";
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED_GITHUB_TOKEN]");
  });

  it("should redact Slack tokens", () => {
    const input = "token: xoxb-abcdefghijklmnopqrst-uvwxyz";
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED_SLACK_TOKEN]");
  });

  it("should redact password values", () => {
    const input = `password: "supersecretpassword123"`;
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("supersecretpassword123");
  });

  it("should not alter normal content", () => {
    const input = "This is a normal message about coding.";
    const result = sanitizeContent(input);
    expect(result).toBe(input);
  });
});

describe("detectToolCalls", () => {
  it("should detect backtick-wrapped tool names", () => {
    const content = "Let me use `glob_search` and `read_file` to check.";
    const tools = detectToolCalls(content);
    expect(tools).toContain("glob_search");
    expect(tools).toContain("read_file");
  });

  it("should detect > Tool: format", () => {
    const content = "> Tool: `bash`\nRunning command...";
    const tools = detectToolCalls(content);
    expect(tools).toContain("bash");
  });

  it("should return empty array when no tools found", () => {
    const content = "Just a normal response with no tool calls.";
    const tools = detectToolCalls(content);
    expect(tools).toHaveLength(0);
  });

  it("should deduplicate tool names", () => {
    const content = "`glob_search` found files. Using `glob_search` again.";
    const tools = detectToolCalls(content);
    const globCount = tools.filter((t) => t === "glob_search").length;
    expect(globCount).toBe(1);
  });
});

describe("estimateTokens", () => {
  it("should estimate ~1 token per 4 chars", () => {
    const text = "a".repeat(100);
    expect(estimateTokens(text)).toBe(25);
  });

  it("should ceil the result", () => {
    const text = "abcde"; // 5 chars => ceil(5/4) = 2
    expect(estimateTokens(text)).toBe(2);
  });

  it("should return 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});
