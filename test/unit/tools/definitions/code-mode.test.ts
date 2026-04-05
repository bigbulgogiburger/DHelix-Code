/**
 * code_mode 도구 통합 테스트
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, unlink, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { codeModeTool } from "../../../../src/tools/definitions/code-mode.js";

// ─────────────────────────────────────────────
// 테스트 환경 설정
// ─────────────────────────────────────────────

const tmpDir = join(process.cwd(), "test", "tmp");
const testFile = join(tmpDir, "code-mode-test-target.ts");

const context = {
  workingDirectory: tmpDir,
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

const sampleCode = [
  'import { z } from "zod";',
  "",
  "interface Config {",
  "  readonly debug: boolean;",
  "}",
  "",
  "function greet(name: string) {",
  '  return "Hello " + name;',
  "}",
  "",
  "class MyService {",
  "  run() {",
  "    return true;",
  "  }",
  "}",
].join("\n");

beforeEach(async () => {
  await mkdir(tmpDir, { recursive: true });
  await writeFile(testFile, sampleCode, "utf-8");
});

afterEach(async () => {
  try {
    await unlink(testFile);
  } catch {
    // ignore
  }
});

// ─────────────────────────────────────────────
// 기본 동작 테스트
// ─────────────────────────────────────────────

describe("code_mode tool", () => {
  it("should have correct metadata", () => {
    expect(codeModeTool.name).toBe("code_mode");
    expect(codeModeTool.permissionLevel).toBe("confirm");
    expect(codeModeTool.description).toContain("Structurally edit");
  });

  it("should replace a function block", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [
          {
            action: "replace-block",
            targetBlock: "greet",
            content: 'function greet(name: string) {\n  return `Hi, ${name}!`;\n}',
          },
        ],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Successfully applied");

    const content = await readFile(testFile, "utf-8");
    expect(content).toContain("Hi, ${name}!");
    expect(content).not.toContain('"Hello "');
  });

  it("should remove a block", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [{ action: "remove-block", targetBlock: "greet" }],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    const content = await readFile(testFile, "utf-8");
    expect(content).not.toContain("function greet");
    // Other blocks should remain
    expect(content).toContain("interface Config");
    expect(content).toContain("class MyService");
  });

  it("should insert before a block", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [
          {
            action: "insert-before",
            targetBlock: "greet",
            content: "// Greeting function",
          },
        ],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    const content = await readFile(testFile, "utf-8");
    expect(content).toContain("// Greeting function");
    const lines = content.split("\n");
    const commentIdx = lines.findIndex((l) => l === "// Greeting function");
    const funcIdx = lines.findIndex((l) => l.includes("function greet"));
    expect(commentIdx).toBeLessThan(funcIdx);
  });

  it("should insert after a block", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [
          {
            action: "insert-after",
            targetBlock: "Config",
            content: "\ntype Level = 1 | 2 | 3;",
          },
        ],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    const content = await readFile(testFile, "utf-8");
    expect(content).toContain("type Level = 1 | 2 | 3;");
  });

  it("should rename a symbol", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [
          {
            action: "rename-symbol",
            targetBlock: "greet",
            newName: "sayHello",
          },
        ],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    const content = await readFile(testFile, "utf-8");
    expect(content).toContain("function sayHello(");
    expect(content).not.toContain("function greet(");
  });
});

// ─────────────────────────────────────────────
// dryRun 테스트
// ─────────────────────────────────────────────

describe("code_mode dryRun", () => {
  it("should not modify the file in dryRun mode", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [{ action: "remove-block", targetBlock: "greet" }],
        dryRun: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[DRY RUN]");
    expect(result.output).toContain("Blocks detected:");

    // File should be unchanged
    const content = await readFile(testFile, "utf-8");
    expect(content).toBe(sampleCode);
  });

  it("should include language and block info in dryRun output", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [{ action: "remove-block", targetBlock: "greet" }],
        dryRun: true,
      },
      context,
    );

    expect(result.output).toContain("Language: typescript");
    expect(result.metadata?.dryRun).toBe(true);
    expect(result.metadata?.language).toBe("typescript");
  });
});

// ─────────────────────────────────────────────
// 에러 처리 테스트
// ─────────────────────────────────────────────

describe("code_mode error handling", () => {
  it("should return error for non-existent file", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "non-existent-file.ts",
        edits: [{ action: "remove-block", targetBlock: "foo" }],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Failed to apply");
  });

  it("should return error for non-existent target block", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [{ action: "remove-block", targetBlock: "nonExistent" }],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Validation failed");
    expect(result.output).toContain("nonExistent");
    expect(result.output).toContain("Available blocks:");
  });

  it("should return error for empty file", async () => {
    await writeFile(testFile, "", "utf-8");
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [{ action: "remove-block", targetBlock: "foo" }],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("No code blocks detected");
  });

  it("should return error when replace-block content is missing in validation", async () => {
    const result = await codeModeTool.execute(
      {
        filePath: "code-mode-test-target.ts",
        edits: [{ action: "replace-block", targetBlock: "greet", content: "" }],
        dryRun: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Validation failed");
  });
});
