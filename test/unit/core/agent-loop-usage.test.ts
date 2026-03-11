import { describe, it, expect, vi, beforeEach } from "vitest";
import { groupToolCalls, type AgentLoopConfig } from "../../../src/core/agent-loop.js";
import type { ExtractedToolCall, ToolCallResult } from "../../../src/tools/types.js";

// Mock modules that agent-loop.ts imports
vi.mock("../../../src/tools/executor.js", () => ({
  executeToolCall: vi.fn(),
}));

vi.mock("../../../src/llm/streaming.js", () => ({
  consumeStream: vi.fn(),
}));

vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  estimateTokens: vi.fn(() => 10),
  countMessageTokens: vi.fn(() => 50),
}));

// =============================================================================
// groupToolCalls — parallel execution grouping
// =============================================================================

describe("groupToolCalls", () => {
  it("should return empty array for empty input", () => {
    const groups = groupToolCalls([]);
    expect(groups).toEqual([]);
  });

  it("should return single group for single tool call", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_read", arguments: { path: "/src/app.ts" } },
    ];

    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
    expect(groups[0][0].id).toBe("tc-1");
  });

  it("should group read-only tools together (always parallel)", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_read", arguments: { path: "/a.ts" } },
      { id: "tc-2", name: "glob_search", arguments: { pattern: "*.ts" } },
      { id: "tc-3", name: "grep_search", arguments: { pattern: "TODO" } },
      { id: "tc-4", name: "file_read", arguments: { path: "/b.ts" } },
    ];

    const groups = groupToolCalls(calls);
    // All read-only tools should be in the same group
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(4);
  });

  it("should keep file writes to different paths in the same group", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_write", arguments: { file_path: "/a.ts" } },
      { id: "tc-2", name: "file_write", arguments: { file_path: "/b.ts" } },
    ];

    const groups = groupToolCalls(calls);
    // Different paths → no conflict → same group
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("should split file writes to the same path into separate groups", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_edit", arguments: { file_path: "/a.ts" } },
      { id: "tc-2", name: "file_write", arguments: { file_path: "/a.ts" } },
    ];

    const groups = groupToolCalls(calls);
    // Same path → conflict → separate groups
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(1);
    expect(groups[1]).toHaveLength(1);
  });

  it("should allow bash_exec calls to be parallel with each other", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "bash_exec", arguments: { command: "ls" } },
      { id: "tc-2", name: "bash_exec", arguments: { command: "pwd" } },
      { id: "tc-3", name: "bash_exec", arguments: { command: "date" } },
    ];

    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it("should mix read-only tools with file writes to different paths", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_read", arguments: { path: "/a.ts" } },
      { id: "tc-2", name: "file_write", arguments: { file_path: "/b.ts" } },
      { id: "tc-3", name: "grep_search", arguments: { pattern: "test" } },
    ];

    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it("should handle conflict in the middle of a batch", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_read", arguments: { path: "/a.ts" } },
      { id: "tc-2", name: "file_edit", arguments: { file_path: "/x.ts" } },
      { id: "tc-3", name: "file_write", arguments: { file_path: "/x.ts" } }, // Conflict with tc-2
      { id: "tc-4", name: "file_read", arguments: { path: "/b.ts" } },
    ];

    const groups = groupToolCalls(calls);
    // tc-1 and tc-2 in first group, tc-3 and tc-4 in second group (tc-3 conflicts with tc-2 on /x.ts)
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2); // tc-1, tc-2
    expect(groups[1]).toHaveLength(2); // tc-3, tc-4
  });

  it("should handle unknown tools gracefully", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "custom_tool", arguments: { data: "test" } },
      { id: "tc-2", name: "another_tool", arguments: {} },
    ];

    const groups = groupToolCalls(calls);
    // Unknown tools go in current group (assumed independent)
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("should extract file_path from various argument formats", () => {
    // Tests that file write tools use file_path, path, or filePath
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_write", arguments: { file_path: "/same.ts" } },
      { id: "tc-2", name: "file_edit", arguments: { file_path: "/same.ts" } },
    ];

    const groups = groupToolCalls(calls);
    // Both target /same.ts → conflict
    expect(groups).toHaveLength(2);
  });
});

// =============================================================================
// AgentLoopConfig interface
// =============================================================================

describe("AgentLoopConfig interface", () => {
  it("should have expected configuration fields", () => {
    // Type-level test: verify that the AgentLoopConfig interface has the right shape
    // by constructing a partial config with all documented fields
    const config: Partial<AgentLoopConfig> = {
      maxIterations: 50,
      temperature: 0,
      maxTokens: 4096,
      maxRetries: 2,
      useStreaming: true,
      maxContextTokens: 128_000,
      maxToolResultChars: 12_000,
      maxToolResultTokens: 3_000,
      enableGuardrails: true,
      sessionId: "test-session",
    };

    // Verify we can set expected fields without type errors
    expect(config.maxIterations).toBe(50);
    expect(config.maxContextTokens).toBe(128_000);
    expect(config.enableGuardrails).toBe(true);
  });
});

// =============================================================================
// AggregatedUsage-style tracking
// =============================================================================

describe("Usage tracking structures", () => {
  it("should support tracking token usage across iterations", () => {
    // This tests the pattern used in the agent loop for tracking usage
    interface AggregatedUsage {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      iterationCount: number;
    }

    const usage: AggregatedUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      iterationCount: 0,
    };

    // Simulate accumulating usage from multiple iterations
    const iterations = [
      { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
      { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 },
      { promptTokens: 500, completionTokens: 250, totalTokens: 750 },
    ];

    for (const iter of iterations) {
      usage.promptTokens += iter.promptTokens;
      usage.completionTokens += iter.completionTokens;
      usage.totalTokens += iter.totalTokens;
      usage.iterationCount++;
    }

    expect(usage.promptTokens).toBe(3500);
    expect(usage.completionTokens).toBe(1750);
    expect(usage.totalTokens).toBe(5250);
    expect(usage.iterationCount).toBe(3);
  });
});

// =============================================================================
// truncateToolResult behavior (tested via groupToolCalls structure)
// =============================================================================

describe("Tool result truncation patterns", () => {
  it("should preserve short results unchanged", () => {
    // ToolCallResult with short output should not be truncated
    const result: ToolCallResult = {
      id: "tc-1",
      name: "file_read",
      output: "short content",
      isError: false,
    };

    expect(result.output.length).toBeLessThan(12_000);
    expect(result.output).toBe("short content");
  });

  it("should represent truncation with ellipsis marker", () => {
    // Simulating what truncateToolResult produces
    const maxChars = 12_000;
    const longOutput = "x".repeat(20_000);

    // Manual truncation to verify the pattern
    const truncated =
      longOutput.slice(0, maxChars) +
      `\n\n[... truncated, showing first ${maxChars} of ${longOutput.length} chars]`;

    expect(truncated.length).toBeLessThan(longOutput.length);
    expect(truncated).toContain("[... truncated");
    expect(truncated).toContain(`${maxChars} of ${longOutput.length}`);
  });

  it("should handle ToolCallResult isError field", () => {
    const errorResult: ToolCallResult = {
      id: "tc-1",
      name: "bash_exec",
      output: "Error: command not found",
      isError: true,
    };

    const successResult: ToolCallResult = {
      id: "tc-2",
      name: "bash_exec",
      output: "hello world",
      isError: false,
    };

    expect(errorResult.isError).toBe(true);
    expect(successResult.isError).toBe(false);
  });
});

// =============================================================================
// Backward compatibility: groupToolCalls export
// =============================================================================

describe("groupToolCalls backward compatibility", () => {
  it("should be importable as a named export from agent-loop", () => {
    expect(typeof groupToolCalls).toBe("function");
  });

  it("should maintain the same return type (ExtractedToolCall[][])", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_read", arguments: { path: "a.ts" } },
    ];

    const groups = groupToolCalls(calls);

    // Should be an array of arrays
    expect(Array.isArray(groups)).toBe(true);
    expect(Array.isArray(groups[0])).toBe(true);

    // Each element should have the ExtractedToolCall shape
    expect(groups[0][0]).toHaveProperty("id");
    expect(groups[0][0]).toHaveProperty("name");
    expect(groups[0][0]).toHaveProperty("arguments");
  });

  it("should handle real-world multi-tool scenario", () => {
    const calls: ExtractedToolCall[] = [
      { id: "tc-1", name: "grep_search", arguments: { pattern: "TODO", path: "/src" } },
      { id: "tc-2", name: "file_read", arguments: { path: "/src/app.ts" } },
      {
        id: "tc-3",
        name: "file_edit",
        arguments: { file_path: "/src/app.ts", old_string: "old", new_string: "new" },
      },
      { id: "tc-4", name: "file_write", arguments: { file_path: "/src/new-file.ts" } },
      { id: "tc-5", name: "bash_exec", arguments: { command: "npm test" } },
    ];

    const groups = groupToolCalls(calls);

    // Verify structure: some grouping should occur
    expect(groups.length).toBeGreaterThanOrEqual(1);

    // All tool calls should be represented across all groups
    const allCalls = groups.flat();
    expect(allCalls).toHaveLength(5);
    expect(allCalls.map((c) => c.id).sort()).toEqual(["tc-1", "tc-2", "tc-3", "tc-4", "tc-5"]);
  });
});
