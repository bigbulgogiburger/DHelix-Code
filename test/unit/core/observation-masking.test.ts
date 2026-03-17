import { describe, it, expect } from "vitest";
import {
  applyObservationMasking,
  isReadOnlyToolOutput,
  getOutputSize,
} from "../../../src/core/observation-masking.js";
import type { ChatMessage } from "../../../src/llm/provider.js";

function msg(
  role: ChatMessage["role"],
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return { role, content, ...extra };
}

function toolMsg(content: string, name?: string, toolCallId = "t1"): ChatMessage {
  return { role: "tool", content, name, toolCallId };
}

// =============================================================================
// isReadOnlyToolOutput
// =============================================================================

describe("isReadOnlyToolOutput", () => {
  it("should return true for file_read tool output", () => {
    const message = toolMsg("  1\tconst x = 1;\n  2\tconst y = 2;", "file_read");
    expect(isReadOnlyToolOutput(message)).toBe(true);
  });

  it("should return true for grep_search tool output", () => {
    const message = toolMsg("3 matches found in 2 files", "grep_search");
    expect(isReadOnlyToolOutput(message)).toBe(true);
  });

  it("should return true for glob_search tool output", () => {
    const message = toolMsg("5 files found", "glob_search");
    expect(isReadOnlyToolOutput(message)).toBe(true);
  });

  it("should return true for read-only bash_exec output", () => {
    const message = toolMsg("STDOUT: file1.ts\nfile2.ts", "bash_exec");
    expect(isReadOnlyToolOutput(message)).toBe(true);
  });

  it("should return false for file_edit tool output", () => {
    const message = toolMsg("File edited successfully", "file_edit");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should return false for file_write tool output", () => {
    const message = toolMsg("File written successfully", "file_write");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should return false for user messages", () => {
    const message = msg("user", "Hello");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should return false for assistant messages", () => {
    const message = msg("assistant", "Here is the analysis");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should return false for system messages", () => {
    const message = msg("system", "You are a helpful assistant");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should return false for bash_exec with mutation commands", () => {
    const message = toolMsg("STDERR: rm: cannot remove 'file'", "bash_exec");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should return false for bash_exec with error output", () => {
    const message = toolMsg("Error: command not found", "bash_exec");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should return false for unknown tool types", () => {
    const message = toolMsg("some output", "custom_tool");
    expect(isReadOnlyToolOutput(message)).toBe(false);
  });

  it("should detect file_read from content pattern when name is not set", () => {
    // Line-numbered content without explicit name
    const message: ChatMessage = {
      role: "tool",
      content: "  1\timport { foo } from './bar';\n  2\texport const x = 1;",
      toolCallId: "t1",
    };
    expect(isReadOnlyToolOutput(message)).toBe(true);
  });

  it("should detect grep_search from content pattern when name is not set", () => {
    const message: ChatMessage = {
      role: "tool",
      content: "5 matches found in 3 files",
      toolCallId: "t1",
    };
    expect(isReadOnlyToolOutput(message)).toBe(true);
  });
});

// =============================================================================
// getOutputSize
// =============================================================================

describe("getOutputSize", () => {
  it("should estimate tokens from content length", () => {
    const message = toolMsg("x".repeat(400));
    expect(getOutputSize(message)).toBe(100);
  });

  it("should return 0 for empty content", () => {
    const message = toolMsg("");
    expect(getOutputSize(message)).toBe(0);
  });

  it("should ceil fractional token counts", () => {
    const message = toolMsg("abc"); // 3 chars / 4 = 0.75 → ceil = 1
    expect(getOutputSize(message)).toBe(1);
  });
});

// =============================================================================
// applyObservationMasking
// =============================================================================

describe("applyObservationMasking", () => {
  it("should mask read-only tool outputs while keeping recent ones", () => {
    const messages: readonly ChatMessage[] = [
      msg("user", "read file A"),
      toolMsg("  1\tline 1\n  2\tline 2\n  3\tline 3", "file_read", "t1"),
      msg("assistant", "File A contains..."),
      msg("user", "search for foo"),
      toolMsg("2 matches found in 1 files", "grep_search", "t2"),
      msg("assistant", "Found foo in..."),
      msg("user", "read file B"),
      toolMsg("  1\timport React\n  2\texport default", "file_read", "t3"),
      msg("assistant", "File B contains..."),
      msg("user", "read file C"),
      toolMsg("  1\tconst z = 42", "file_read", "t4"),
      msg("assistant", "File C contains..."),
    ];

    const result = applyObservationMasking(messages, { keepRecentN: 2 });

    // First two read-only tool outputs should be masked
    expect(result[1].content).toContain("[Observation masked");
    expect(result[4].content).toContain("[Observation masked");

    // Last two read-only tool outputs should be preserved
    expect(result[7].content).not.toContain("[Observation masked");
    expect(result[10].content).not.toContain("[Observation masked");
  });

  it("should not mask mutation tool outputs", () => {
    const messages: readonly ChatMessage[] = [
      msg("user", "edit file"),
      toolMsg("File edited successfully", "file_edit", "t1"),
      msg("assistant", "Done editing"),
    ];

    const result = applyObservationMasking(messages);

    expect(result[1].content).toBe("File edited successfully");
  });

  it("should not mask user or assistant messages", () => {
    const messages: readonly ChatMessage[] = [msg("user", "Hello"), msg("assistant", "Hi there!")];

    const result = applyObservationMasking(messages);

    expect(result[0].content).toBe("Hello");
    expect(result[1].content).toBe("Hi there!");
  });

  it("should preserve all tool outputs when count <= keepRecentN", () => {
    const messages: readonly ChatMessage[] = [
      msg("user", "read file"),
      toolMsg("  1\tline 1", "file_read", "t1"),
      msg("assistant", "Done"),
    ];

    // keepRecentN = 3, only 1 read-only tool output → all preserved
    const result = applyObservationMasking(messages, { keepRecentN: 3 });

    expect(result[1].content).toBe("  1\tline 1");
  });

  it("should default keepRecentN to 3", () => {
    const messages: readonly ChatMessage[] = [
      msg("user", "r1"),
      toolMsg("  1\ta", "file_read", "t1"),
      msg("user", "r2"),
      toolMsg("  1\tb", "file_read", "t2"),
      msg("user", "r3"),
      toolMsg("  1\tc", "file_read", "t3"),
      msg("user", "r4"),
      toolMsg("  1\td", "file_read", "t4"),
      msg("user", "r5"),
      toolMsg("  1\te", "file_read", "t5"),
    ];

    const result = applyObservationMasking(messages);

    // First 2 should be masked, last 3 preserved (default keepRecentN = 3)
    expect(result[1].content).toContain("[Observation masked");
    expect(result[3].content).toContain("[Observation masked");
    expect(result[5].content).not.toContain("[Observation masked");
    expect(result[7].content).not.toContain("[Observation masked");
    expect(result[9].content).not.toContain("[Observation masked");
  });

  it("should never mutate the input array", () => {
    const messages: readonly ChatMessage[] = [
      msg("user", "read"),
      toolMsg("  1\tline 1", "file_read", "t1"),
    ];

    const original = [...messages];
    applyObservationMasking(messages);

    expect(messages).toEqual(original);
  });

  it("should include tool name and token count in masked placeholder", () => {
    const longContent = "  1\t" + "x".repeat(200);
    const messages: readonly ChatMessage[] = [
      msg("user", "r1"),
      toolMsg(longContent, "file_read", "t1"),
      msg("user", "r2"),
      toolMsg("  1\ty", "file_read", "t2"),
      msg("user", "r3"),
      toolMsg("  1\tz", "file_read", "t3"),
      msg("user", "r4"),
      toolMsg("  1\tw", "file_read", "t4"),
    ];

    const result = applyObservationMasking(messages, { keepRecentN: 3 });

    // First tool output should be masked with tool name and size
    expect(result[1].content).toContain("file_read");
    expect(result[1].content).toMatch(/\d+ tokens/);
  });

  it("should handle empty message array", () => {
    const result = applyObservationMasking([]);
    expect(result).toEqual([]);
  });

  it("should handle messages with no tool outputs", () => {
    const messages: readonly ChatMessage[] = [msg("user", "Hello"), msg("assistant", "Hi")];

    const result = applyObservationMasking(messages);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Hello");
    expect(result[1].content).toBe("Hi");
  });
});
