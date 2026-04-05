/**
 * Postprocess stage 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  postprocess,
  DEFAULT_POSTPROCESS_CONFIG,
  type PostprocessConfig,
} from "../../../../src/tools/pipeline/postprocess.js";
import { type ToolResult } from "../../../../src/tools/types.js";

// Mock fs/promises for spillover tests
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

function makeResult(output: string, isError = false): ToolResult {
  return { output, isError };
}

describe("postprocess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return result unchanged when output is within limits", async () => {
    const result = makeResult("short output");
    const processed = await postprocess(result);

    expect(processed.output).toBe("short output");
    expect(processed.isError).toBe(false);
  });

  it("should attach metadata when metadataAttach is true", async () => {
    const result = makeResult("test output");
    const processed = await postprocess(result, DEFAULT_POSTPROCESS_CONFIG, 42);

    expect(processed.metadata).toBeDefined();
    expect(processed.metadata?.["executionTimeMs"]).toBe(42);
    expect(processed.metadata?.["outputBytes"]).toBeGreaterThan(0);
    expect(processed.metadata?.["truncated"]).toBe(false);
  });

  it("should not attach metadata when metadataAttach is false", async () => {
    const result = makeResult("test output");
    const config: PostprocessConfig = {
      ...DEFAULT_POSTPROCESS_CONFIG,
      metadataAttach: false,
    };
    const processed = await postprocess(result, config, 42);

    expect(processed.metadata).toBeUndefined();
  });

  it("should truncate output exceeding maxOutputLength", async () => {
    const longOutput = "x".repeat(200);
    const result = makeResult(longOutput);
    const config: PostprocessConfig = {
      ...DEFAULT_POSTPROCESS_CONFIG,
      maxOutputLength: 100,
      spilloverEnabled: false,
    };

    const processed = await postprocess(result, config);

    expect(processed.output.length).toBeLessThanOrEqual(200); // truncated + notice
    expect(processed.output).toContain("truncated");
    expect(processed.metadata?.["truncated"]).toBe(true);
  });

  it("should use head truncation strategy", async () => {
    const longOutput = "A".repeat(50) + "B".repeat(150);
    const result = makeResult(longOutput);
    const config: PostprocessConfig = {
      ...DEFAULT_POSTPROCESS_CONFIG,
      maxOutputLength: 100,
      truncationStrategy: "head",
      spilloverEnabled: false,
    };

    const processed = await postprocess(result, config);

    // Should start with A's (head preserved)
    expect(processed.output.startsWith("A")).toBe(true);
    expect(processed.output).toContain("truncated");
  });

  it("should use tail truncation strategy", async () => {
    const longOutput = "A".repeat(150) + "B".repeat(50);
    const result = makeResult(longOutput);
    const config: PostprocessConfig = {
      ...DEFAULT_POSTPROCESS_CONFIG,
      maxOutputLength: 100,
      truncationStrategy: "tail",
      spilloverEnabled: false,
    };

    const processed = await postprocess(result, config);

    // Should end with B's (tail preserved)
    expect(processed.output.endsWith("B".repeat(50))).toBe(true);
    expect(processed.output).toContain("truncated");
  });

  it("should use head-tail truncation strategy", async () => {
    const longOutput = "H".repeat(100) + "M".repeat(100) + "T".repeat(100);
    const result = makeResult(longOutput);
    const config: PostprocessConfig = {
      ...DEFAULT_POSTPROCESS_CONFIG,
      maxOutputLength: 100,
      truncationStrategy: "head-tail",
      spilloverEnabled: false,
    };

    const processed = await postprocess(result, config);

    expect(processed.output).toContain("truncated");
    // Head and tail portions should be present
    expect(processed.output.startsWith("H")).toBe(true);
    expect(processed.output.endsWith("T")).toBe(true);
  });

  it("should create spillover file when enabled and output exceeds limit", async () => {
    const { writeFile } = await import("node:fs/promises");

    const longOutput = "x".repeat(200);
    const result = makeResult(longOutput);
    const config: PostprocessConfig = {
      ...DEFAULT_POSTPROCESS_CONFIG,
      maxOutputLength: 100,
      spilloverEnabled: true,
    };

    const processed = await postprocess(result, config);

    expect(writeFile).toHaveBeenCalled();
    expect(processed.output).toContain("Full output saved to:");
    expect(processed.metadata?.["spilloverPath"]).toBeDefined();
  });

  it("should preserve existing metadata", async () => {
    const result: ToolResult = {
      output: "test",
      isError: false,
      metadata: { custom: "value" },
    };

    const processed = await postprocess(result, DEFAULT_POSTPROCESS_CONFIG, 10);

    expect(processed.metadata?.["custom"]).toBe("value");
    expect(processed.metadata?.["executionTimeMs"]).toBe(10);
  });

  it("should preserve isError flag", async () => {
    const result = makeResult("error output", true);
    const processed = await postprocess(result);

    expect(processed.isError).toBe(true);
  });
});
