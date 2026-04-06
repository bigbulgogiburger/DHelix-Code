/**
 * refactor 도구 및 refactor-utils 유닛 테스트
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { refactorTool } from "../../../../src/tools/definitions/refactor.js";
import {
  extractLinesFromContent,
  findUsedVariables,
  buildFunctionSignature,
  replaceLines,
} from "../../../../src/tools/definitions/refactor-utils.js";

// ─────────────────────────────────────────────
// 테스트 환경 설정
// ─────────────────────────────────────────────

const tmpDir = join(process.cwd(), "test", "tmp");
const testFile = join(tmpDir, "refactor-test-target.ts");

const context = {
  workingDirectory: tmpDir,
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

beforeEach(async () => {
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  try {
    await unlink(testFile);
  } catch {
    // ignore — 일부 테스트는 파일을 생성하지 않음
  }
});

// ─────────────────────────────────────────────
// refactor-utils 순수 함수 단위 테스트
// ─────────────────────────────────────────────

describe("refactor-utils: extractLinesFromContent", () => {
  const content = "line1\nline2\nline3\nline4\nline5";

  it("should extract a single line", () => {
    expect(extractLinesFromContent(content, 3, 3)).toBe("line3");
  });

  it("should extract multiple lines", () => {
    expect(extractLinesFromContent(content, 2, 4)).toBe("line2\nline3\nline4");
  });

  it("should clamp to file bounds (startLine before 1)", () => {
    expect(extractLinesFromContent(content, 0, 2)).toBe("line1\nline2");
  });

  it("should clamp to file bounds (endLine past end)", () => {
    expect(extractLinesFromContent(content, 4, 99)).toBe("line4\nline5");
  });

  it("should return full content for full range", () => {
    expect(extractLinesFromContent(content, 1, 5)).toBe(content);
  });
});

describe("refactor-utils: findUsedVariables", () => {
  it("should find identifiers in simple expressions", () => {
    const vars = findUsedVariables("const result = alpha + beta;");
    expect(vars).toContain("result");
    expect(vars).toContain("alpha");
    expect(vars).toContain("beta");
  });

  it("should exclude JS keywords", () => {
    const vars = findUsedVariables("if (true) { return null; }");
    expect(vars).not.toContain("if");
    expect(vars).not.toContain("return");
    expect(vars).not.toContain("true");
    expect(vars).not.toContain("null");
  });

  it("should exclude single-character identifiers", () => {
    const vars = findUsedVariables("for (let i = 0; i < n; i++) {}");
    expect(vars).not.toContain("i");
  });

  it("should deduplicate identifiers", () => {
    const vars = findUsedVariables("total + total + extra");
    const totalCount = vars.filter((v) => v === "total").length;
    expect(totalCount).toBe(1);
    expect(vars).toContain("extra");
  });

  it("should return empty array for empty input", () => {
    expect(findUsedVariables("")).toEqual([]);
  });
});

describe("refactor-utils: buildFunctionSignature", () => {
  it("should build signature with params and return type", () => {
    const sig = buildFunctionSignature("add", ["aa", "bb"], "number");
    expect(sig).toBe("function add(aa: unknown, bb: unknown): number");
  });

  it("should default to void return type when omitted", () => {
    const sig = buildFunctionSignature("log", ["message"]);
    expect(sig).toBe("function log(message: unknown): void");
  });

  it("should build signature with no params", () => {
    const sig = buildFunctionSignature("doNothing", []);
    expect(sig).toBe("function doNothing(): void");
  });
});

describe("refactor-utils: replaceLines", () => {
  const content = "alpha\nbeta\ngamma\ndelta";

  it("should replace a single line", () => {
    expect(replaceLines(content, 2, 2, "BETA")).toBe("alpha\nBETA\ngamma\ndelta");
  });

  it("should replace multiple lines", () => {
    expect(replaceLines(content, 2, 3, "REPLACED")).toBe("alpha\nREPLACED\ndelta");
  });

  it("should replace with multi-line replacement", () => {
    const result = replaceLines(content, 1, 1, "LINE_A\nLINE_B");
    expect(result).toBe("LINE_A\nLINE_B\nbeta\ngamma\ndelta");
  });

  it("should handle replacement at start of file", () => {
    expect(replaceLines(content, 1, 1, "FIRST")).toBe("FIRST\nbeta\ngamma\ndelta");
  });

  it("should handle replacement at end of file", () => {
    expect(replaceLines(content, 4, 4, "LAST")).toBe("alpha\nbeta\ngamma\nLAST");
  });
});

// ─────────────────────────────────────────────
// refactor 도구 통합 테스트
// ─────────────────────────────────────────────

describe("refactor tool: metadata", () => {
  it("should have correct name and permissionLevel", () => {
    expect(refactorTool.name).toBe("refactor");
    expect(refactorTool.permissionLevel).toBe("confirm");
  });
});

describe("refactor tool: extract-function", () => {
  it("should extract selected lines into a new function (basic)", async () => {
    const code = [
      "function main() {",
      "  const aa = 10;",
      "  const bb = 20;",
      "  const sum = aa + bb;",
      "  console.log(sum);",
      "}",
    ].join("\n");
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-function",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 4, endLine: 5 },
        newName: "computeAndLog",
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("extract-function");
    expect(result.output).toContain("computeAndLog");
  });

  it("should detect parameters from used variables", async () => {
    const code = [
      "function main() {",
      "  const result = myValue * factor;",
      "}",
    ].join("\n");
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-function",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 2, endLine: 2 },
        newName: "compute",
        dry_run: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[DRY RUN]");
    expect(result.output).toContain("compute");
    // dry_run이면 파일을 변경하지 않음
    const { readFile } = await import("node:fs/promises");
    const unchanged = await readFile(testFile, "utf-8");
    expect(unchanged).toBe(code);
  });

  it("should error when newName is missing for extract-function", async () => {
    await writeFile(testFile, "const x = 1;\n", "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-function",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 1, endLine: 1 },
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("newName");
  });
});

describe("refactor tool: extract-variable", () => {
  it("should extract an expression into a named variable", async () => {
    const code = [
      "function render() {",
      "  return width * height * 2;",
      "}",
    ].join("\n");
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 2, endLine: 2 },
        newName: "area",
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("extract-variable");
    expect(result.output).toContain("area");
  });

  it("should support dry_run without modifying the file", async () => {
    const code = "const total = price + tax;\n";
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 1, endLine: 1 },
        newName: "subtotal",
        dry_run: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[DRY RUN]");

    const { readFile } = await import("node:fs/promises");
    const unchanged = await readFile(testFile, "utf-8");
    expect(unchanged).toBe(code);
  });

  it("should error when newName is missing for extract-variable", async () => {
    await writeFile(testFile, "const x = 1;\n", "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 1, endLine: 1 },
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("newName");
  });
});

describe("refactor tool: inline-variable", () => {
  it("should inline a single-use variable into its usage site", async () => {
    const code = [
      "function compute() {",
      "  const multiplier = 42;",
      "  return multiplier * input;",
      "}",
    ].join("\n");
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "inline-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 2, endLine: 2 },
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("multiplier");
    expect(result.output).toContain("42");
    expect(result.output).toContain("Declaration removed");
  });

  it("should error when the declaration line is not a valid variable", async () => {
    const code = [
      "function compute() {",
      "  doSomething();",
      "}",
    ].join("\n");
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "inline-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 2, endLine: 2 },
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("does not contain a valid variable declaration");
  });

  it("should error when the variable has multiple usages", async () => {
    const code = [
      "const base = 10;",
      "const aa = base + 1;",
      "const bb = base + 2;",
    ].join("\n");
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "inline-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 1, endLine: 1 },
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("2 places");
  });

  it("should error when the variable has no usages", async () => {
    const code = [
      "const unused = 999;",
      "const other = 1;",
    ].join("\n");
    await writeFile(testFile, code, "utf-8");

    const result = await refactorTool.execute(
      {
        action: "inline-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 1, endLine: 1 },
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("no usages");
  });
});

describe("refactor tool: error handling", () => {
  it("should error when file does not exist", async () => {
    const result = await refactorTool.execute(
      {
        action: "extract-function",
        filePath: "no-such-file.ts",
        selection: { startLine: 1, endLine: 1 },
        newName: "fn",
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Failed to apply refactoring");
  });

  it("should error when startLine > endLine", async () => {
    await writeFile(testFile, "const x = 1;\n", "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 5, endLine: 2 },
        newName: "val",
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("startLine");
  });

  it("should error when selection is out of bounds", async () => {
    await writeFile(testFile, "const x = 1;\n", "utf-8");

    const result = await refactorTool.execute(
      {
        action: "extract-variable",
        filePath: "refactor-test-target.ts",
        selection: { startLine: 1, endLine: 100 },
        newName: "val",
        dry_run: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("out of bounds");
  });
});
