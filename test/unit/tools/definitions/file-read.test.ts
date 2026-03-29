import { describe, it, expect } from "vitest";
import { fileReadTool } from "../../../../src/tools/definitions/file-read.js";
import { join } from "node:path";

const context = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

const fixturesDir = join(process.cwd(), "test/fixtures/file-read");

describe("file_read tool", () => {
  it("should have correct metadata", () => {
    expect(fileReadTool.name).toBe("file_read");
    expect(fileReadTool.permissionLevel).toBe("safe");
  });

  it("should read a file with line numbers", async () => {
    const result = await fileReadTool.execute({ path: "package.json" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("dhelix");
    expect(result.output).toMatch(/^\s+1 \|/m);
  });

  it("should support offset and limit", async () => {
    const result = await fileReadTool.execute(
      { path: "package.json", offset: 0, limit: 3 },
      context,
    );
    expect(result.isError).toBe(false);
    const lines = result.output.split("\n");
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it("should handle non-existent file", async () => {
    const result = await fileReadTool.execute({ path: "non-existent-file-12345.txt" }, context);
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Failed to read file");
  });

  it("should include metadata with path and line info", async () => {
    const result = await fileReadTool.execute({ path: "package.json" }, context);
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.totalLines).toBeGreaterThan(0);
  });

  describe("empty file", () => {
    it("should return [Empty file] for empty files", async () => {
      const result = await fileReadTool.execute({ path: join(fixturesDir, "empty.txt") }, context);
      expect(result.isError).toBe(false);
      expect(result.output).toBe("[Empty file]");
    });
  });

  describe("line truncation", () => {
    it("should truncate lines exceeding 2000 characters", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "long-lines.txt") },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("... (truncated)");
      expect(result.output).toContain("short line");
    });
  });

  describe("default line limit", () => {
    it("should limit to 2000 lines by default and show truncation notice", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "many-lines.txt") },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("[File truncated: showing 2000 of 2500 lines");
      expect(result.output).toContain("Line 1");
      expect(result.output).toContain("Line 2000");
      expect(result.output).not.toContain("| Line 2001");
    });

    it("should not truncate when explicit limit is provided", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "many-lines.txt"), limit: 2500 },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).not.toContain("[File truncated");
      expect(result.output).toContain("Line 2500");
    });
  });

  describe("image support", () => {
    it("should read PNG and return base64 with dimensions", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "test-image.png") },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("[Image: test-image.png");
      expect(result.output).toContain("1x1");
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.type).toBe("image");
      expect(result.metadata!.media_type).toBe("image/png");
      expect(typeof result.metadata!.data).toBe("string");
      expect((result.metadata!.data as string).length).toBeGreaterThan(0);
    });

    it("should read GIF and return base64 with dimensions", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "test-image.gif") },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("[Image: test-image.gif");
      expect(result.output).toContain("2x2");
      expect(result.metadata!.type).toBe("image");
      expect(result.metadata!.media_type).toBe("image/gif");
    });

    it("should read SVG without dimensions", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "test-image.svg") },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("[Image: test-image.svg");
      expect(result.output).toContain("bytes");
      expect(result.metadata!.type).toBe("image");
      expect(result.metadata!.media_type).toBe("image/svg+xml");
    });
  });

  describe("jupyter notebook support", () => {
    it("should parse notebook cells correctly", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "sample.ipynb") },
        context,
      );
      expect(result.isError).toBe(false);
      // Markdown cell rendered as-is
      expect(result.output).toContain("# Sample Notebook");
      expect(result.output).toContain("This is a test notebook.");
      // Code cells wrapped in code blocks
      expect(result.output).toContain("```python");
      expect(result.output).toContain("print('hello world')");
      expect(result.output).toContain("```");
      // Output displayed
      expect(result.output).toContain("Output:");
      expect(result.output).toContain("hello world");
      // Cell separator
      expect(result.output).toContain("---");
      // Metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.cellCount).toBe(4);
      expect(result.metadata!.language).toBe("python");
    });

    it("should handle execute_result output type", async () => {
      const result = await fileReadTool.execute(
        { path: join(fixturesDir, "sample.ipynb") },
        context,
      );
      expect(result.output).toContain("30");
    });
  });

  describe("PDF support", () => {
    it("should have pages parameter in schema", () => {
      const schema = fileReadTool.parameterSchema;
      const parsed = schema.safeParse({ path: "test.pdf", pages: "1-5" });
      expect(parsed.success).toBe(true);
    });

    it("should handle non-existent PDF file", async () => {
      const result = await fileReadTool.execute({ path: "nonexistent.pdf" }, context);
      expect(result.isError).toBe(true);
      expect(result.output).toContain("Failed to read file");
    });
  });
});
