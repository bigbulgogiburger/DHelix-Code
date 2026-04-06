import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentMemoryManager } from "../../../src/subagents/agent-memory.js";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:os
vi.mock("node:os", () => ({
  homedir: vi.fn().mockReturnValue("/home/testuser"),
}));

// Mock logger
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const { mkdir, readFile, writeFile } = await import("node:fs/promises");

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// getMemoryDir
// =============================================================================

describe("AgentMemoryManager.getMemoryDir", () => {
  it("should resolve user scope to ~/.dhelix/agent-memory/{name}/", () => {
    const manager = new AgentMemoryManager("reviewer", "user", "/project");
    const dir = manager.getMemoryDir();
    expect(dir).toContain("testuser");
    expect(dir).toContain("agent-memory");
    expect(dir).toContain("reviewer");
  });

  it("should resolve project scope to .dhelix/agent-memory/{name}/ relative to working dir", () => {
    const manager = new AgentMemoryManager("planner", "project", "/my/project");
    const dir = manager.getMemoryDir();
    expect(dir).toContain("agent-memory");
    expect(dir).toContain("planner");
  });

  it("should resolve local scope to .dhelix/agent-memory-local/{name}/ relative to working dir", () => {
    const manager = new AgentMemoryManager("builder", "local", "/my/project");
    const dir = manager.getMemoryDir();
    expect(dir).toContain("agent-memory-local");
    expect(dir).toContain("builder");
  });

  it("should use process.cwd() when working directory not provided", () => {
    const manager = new AgentMemoryManager("agent", "project");
    const dir = manager.getMemoryDir();
    // Should contain agent-memory and agent name
    expect(dir).toContain("agent-memory");
    expect(dir).toContain("agent");
  });
});

// =============================================================================
// initialize
// =============================================================================

describe("AgentMemoryManager.initialize", () => {
  it("should create the memory directory recursively", async () => {
    const manager = new AgentMemoryManager("reviewer", "user", "/project");
    await manager.initialize();

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining("reviewer"), { recursive: true });
  });

  it("should not throw when mkdir fails (logs warning instead)", async () => {
    vi.mocked(mkdir).mockRejectedValueOnce(new Error("Permission denied"));
    const manager = new AgentMemoryManager("reviewer", "user", "/project");

    // Should not throw
    await expect(manager.initialize()).resolves.toBeUndefined();
  });
});

// =============================================================================
// readMemory
// =============================================================================

describe("AgentMemoryManager.readMemory", () => {
  it("should read MEMORY.md from the memory directory", async () => {
    vi.mocked(readFile).mockResolvedValueOnce("# My Memory\nSome notes.");
    const manager = new AgentMemoryManager("reviewer", "user", "/project");

    const content = await manager.readMemory();
    expect(content).toBe("# My Memory\nSome notes.");
    expect(readFile).toHaveBeenCalledWith(expect.stringContaining("MEMORY.md"), "utf-8");
  });

  it("should return empty string when MEMORY.md does not exist", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const manager = new AgentMemoryManager("reviewer", "user", "/project");

    const content = await manager.readMemory();
    expect(content).toBe("");
  });

  it("should truncate content to 200 lines", async () => {
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`);
    vi.mocked(readFile).mockResolvedValueOnce(lines.join("\n"));

    const manager = new AgentMemoryManager("reviewer", "user", "/project");
    const content = await manager.readMemory();

    const resultLines = content.split("\n");
    expect(resultLines.length).toBe(200);
    expect(resultLines[0]).toBe("Line 1");
    expect(resultLines[199]).toBe("Line 200");
  });

  it("should return full content when under 200 lines", async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`);
    const fullContent = lines.join("\n");
    vi.mocked(readFile).mockResolvedValueOnce(fullContent);

    const manager = new AgentMemoryManager("reviewer", "user", "/project");
    const content = await manager.readMemory();
    expect(content).toBe(fullContent);
  });

  it("should return full content when exactly 200 lines", async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`);
    const fullContent = lines.join("\n");
    vi.mocked(readFile).mockResolvedValueOnce(fullContent);

    const manager = new AgentMemoryManager("reviewer", "user", "/project");
    const content = await manager.readMemory();
    expect(content).toBe(fullContent);
  });
});

// =============================================================================
// writeMemory
// =============================================================================

describe("AgentMemoryManager.writeMemory", () => {
  it("should create directory and write MEMORY.md", async () => {
    const manager = new AgentMemoryManager("reviewer", "user", "/project");
    await manager.writeMemory("# Updated Memory\nNew content.");

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining("reviewer"), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("MEMORY.md"),
      "# Updated Memory\nNew content.",
      "utf-8",
    );
  });

  it("should write empty string when called with empty content", async () => {
    const manager = new AgentMemoryManager("reviewer", "user", "/project");
    await manager.writeMemory("");

    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining("MEMORY.md"), "", "utf-8");
  });
});

// =============================================================================
// getMemoryPromptSection
// =============================================================================

describe("AgentMemoryManager.getMemoryPromptSection", () => {
  it("should include memory directory path and content", async () => {
    vi.mocked(readFile).mockResolvedValueOnce("# Knowledge\nImportant pattern discovered.");
    const manager = new AgentMemoryManager("reviewer", "user", "/project");

    const section = await manager.getMemoryPromptSection();
    expect(section).toContain("# Agent Memory");
    expect(section).toContain("reviewer");
    expect(section).toContain("# Knowledge");
    expect(section).toContain("Important pattern discovered.");
    expect(section).toContain("persist across conversations");
  });

  it("should include placeholder when no memory exists", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const manager = new AgentMemoryManager("reviewer", "user", "/project");

    const section = await manager.getMemoryPromptSection();
    expect(section).toContain("No memory file yet");
    expect(section).toContain("Create one to start building knowledge");
  });

  it("should include instructions for memory management", async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const manager = new AgentMemoryManager("reviewer", "user", "/project");

    const section = await manager.getMemoryPromptSection();
    expect(section).toContain("MEMORY.md");
    expect(section).toContain("under 200 lines");
    expect(section).toContain("topic-specific files");
  });
});

// =============================================================================
// getRequiredTools (static)
// =============================================================================

describe("AgentMemoryManager.getRequiredTools", () => {
  it("should return file_read, file_write, file_edit", () => {
    const tools = AgentMemoryManager.getRequiredTools();
    expect(tools).toContain("file_read");
    expect(tools).toContain("file_write");
    expect(tools).toContain("file_edit");
    expect(tools.length).toBe(3);
  });

  it("should return a readonly array", () => {
    const tools = AgentMemoryManager.getRequiredTools();
    // Verify it's the same reference (constant)
    expect(AgentMemoryManager.getRequiredTools()).toBe(tools);
  });
});
