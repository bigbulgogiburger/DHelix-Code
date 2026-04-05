/**
 * code-mode-utils 순수 함수 유닛 테스트
 */
import { describe, it, expect } from "vitest";
import {
  parseCodeBlocks,
  findBlock,
  applyEdit,
  applyEdits,
  validateEdits,
  type CodeBlock,
  type CodeEdit,
} from "../../../../src/tools/definitions/code-mode-utils.js";

// ─────────────────────────────────────────────
// parseCodeBlocks
// ─────────────────────────────────────────────

describe("parseCodeBlocks", () => {
  it("should detect function declarations", () => {
    const code = `function hello() {\n  console.log("hi");\n}`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("function");
    expect(blocks[0].name).toBe("hello");
    expect(blocks[0].startLine).toBe(1);
    expect(blocks[0].endLine).toBe(3);
  });

  it("should detect async function declarations", () => {
    const code = `async function fetchData() {\n  await fetch("/api");\n}`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("function");
    expect(blocks[0].name).toBe("fetchData");
  });

  it("should detect exported function declarations", () => {
    const code = `export function greet(name: string) {\n  return "Hello " + name;\n}`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("function");
    expect(blocks[0].name).toBe("greet");
  });

  it("should detect class declarations with methods", () => {
    const code = [
      "class MyClass {",
      "  constructor() {",
      "    this.x = 1;",
      "  }",
      "",
      "  doSomething() {",
      "    return this.x;",
      "  }",
      "}",
    ].join("\n");
    const blocks = parseCodeBlocks(code, "typescript");
    const classBlock = blocks.find((b) => b.type === "class");
    expect(classBlock).toBeDefined();
    expect(classBlock!.name).toBe("MyClass");

    const ctorBlock = blocks.find((b) => b.name === "MyClass.constructor");
    expect(ctorBlock).toBeDefined();
    expect(ctorBlock!.type).toBe("method");

    const methodBlock = blocks.find((b) => b.name === "MyClass.doSomething");
    expect(methodBlock).toBeDefined();
    expect(methodBlock!.type).toBe("method");
  });

  it("should detect interface declarations", () => {
    const code = [
      "interface User {",
      "  readonly name: string;",
      "  readonly age: number;",
      "}",
    ].join("\n");
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("interface");
    expect(blocks[0].name).toBe("User");
  });

  it("should detect exported interface declarations", () => {
    const code = `export interface Config {\n  readonly debug: boolean;\n}`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Config");
  });

  it("should detect type alias declarations", () => {
    const code = `type Status = "active" | "inactive";`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("type");
    expect(blocks[0].name).toBe("Status");
  });

  it("should detect import statements", () => {
    const code = `import { readFile } from "node:fs/promises";`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("import");
    expect(blocks[0].name).toBe("node:fs/promises");
  });

  it("should detect multi-line import statements", () => {
    const code = [
      "import {",
      "  readFile,",
      "  writeFile,",
      '} from "node:fs/promises";',
    ].join("\n");
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("import");
    expect(blocks[0].startLine).toBe(1);
    expect(blocks[0].endLine).toBe(4);
  });

  it("should detect variable declarations (const)", () => {
    const code = `const MAX_RETRIES = 3;`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("variable");
    expect(blocks[0].name).toBe("MAX_RETRIES");
  });

  it("should detect arrow function declarations as functions", () => {
    const code = `const add = (a: number, b: number) => a + b;`;
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("function");
    expect(blocks[0].name).toBe("add");
  });

  it("should handle mixed declarations", () => {
    const code = [
      'import { z } from "zod";',
      "",
      "const VERSION = 1;",
      "",
      "interface Config {",
      "  readonly debug: boolean;",
      "}",
      "",
      "type Level = 1 | 2 | 3;",
      "",
      "function parse(input: string) {",
      '  return input.split(",");',
      "}",
      "",
      "class Parser {",
      "  run() {",
      "    return true;",
      "  }",
      "}",
    ].join("\n");

    const blocks = parseCodeBlocks(code, "typescript");
    const types = blocks.map((b) => b.type);
    expect(types).toContain("import");
    expect(types).toContain("variable");
    expect(types).toContain("interface");
    expect(types).toContain("type");
    expect(types).toContain("function");
    expect(types).toContain("class");
  });

  it("should set language property on all blocks", () => {
    const code = `function foo() {}`;
    const blocks = parseCodeBlocks(code, "javascript");
    expect(blocks[0].language).toBe("javascript");
  });

  it("should return empty array for empty content", () => {
    const blocks = parseCodeBlocks("", "typescript");
    expect(blocks).toHaveLength(0);
  });

  it("should skip comment-only content", () => {
    const code = "// just a comment\n/* block comment */";
    const blocks = parseCodeBlocks(code, "typescript");
    expect(blocks).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// findBlock
// ─────────────────────────────────────────────

describe("findBlock", () => {
  const blocks: readonly CodeBlock[] = [
    { type: "function", name: "foo", startLine: 1, endLine: 3, content: "function foo() {}", language: "ts" },
    { type: "class", name: "MyClass", startLine: 5, endLine: 15, content: "class MyClass {}", language: "ts" },
    { type: "method", name: "MyClass.bar", startLine: 6, endLine: 10, content: "bar() {}", language: "ts" },
    { type: "interface", name: "IConfig", startLine: 17, endLine: 20, content: "interface IConfig {}", language: "ts" },
  ];

  it("should find block by simple name", () => {
    const result = findBlock(blocks, "foo");
    expect(result).toBeDefined();
    expect(result!.name).toBe("foo");
  });

  it("should find method by dot notation", () => {
    const result = findBlock(blocks, "MyClass.bar");
    expect(result).toBeDefined();
    expect(result!.type).toBe("method");
  });

  it("should find class by name", () => {
    const result = findBlock(blocks, "MyClass");
    expect(result).toBeDefined();
    expect(result!.type).toBe("class");
  });

  it("should return undefined for non-existent block", () => {
    const result = findBlock(blocks, "nonExistent");
    expect(result).toBeUndefined();
  });

  it("should return undefined for empty blocks array", () => {
    const result = findBlock([], "foo");
    expect(result).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// applyEdit — individual action types
// ─────────────────────────────────────────────

describe("applyEdit", () => {
  const code = [
    "function foo() {",
    "  return 1;",
    "}",
    "",
    "function bar() {",
    "  return 2;",
    "}",
  ].join("\n");

  const blocks = parseCodeBlocks(code, "typescript");

  it("should replace a block", () => {
    const edit: CodeEdit = {
      action: "replace-block",
      targetBlock: "foo",
      content: "function foo() {\n  return 42;\n}",
    };
    const result = applyEdit(code, blocks, edit);
    expect(result).toContain("return 42;");
    expect(result).not.toContain("return 1;");
    // bar should still exist
    expect(result).toContain("return 2;");
  });

  it("should insert before a block", () => {
    const edit: CodeEdit = {
      action: "insert-before",
      targetBlock: "bar",
      content: "// inserted before bar",
    };
    const result = applyEdit(code, blocks, edit);
    const lines = result.split("\n");
    const barIdx = lines.findIndex((l) => l.includes("function bar"));
    expect(barIdx).toBeGreaterThan(0);
    expect(lines[barIdx - 1]).toBe("// inserted before bar");
  });

  it("should insert after a block", () => {
    const edit: CodeEdit = {
      action: "insert-after",
      targetBlock: "foo",
      content: "// inserted after foo",
    };
    const result = applyEdit(code, blocks, edit);
    const lines = result.split("\n");
    // After foo's closing brace (line 3, idx 2), the inserted content should appear
    expect(lines[3]).toBe("// inserted after foo");
  });

  it("should remove a block", () => {
    const edit: CodeEdit = {
      action: "remove-block",
      targetBlock: "foo",
    };
    const result = applyEdit(code, blocks, edit);
    expect(result).not.toContain("function foo");
    expect(result).not.toContain("return 1;");
    expect(result).toContain("function bar");
  });

  it("should rename a symbol within block", () => {
    const edit: CodeEdit = {
      action: "rename-symbol",
      targetBlock: "foo",
      newName: "baz",
    };
    const result = applyEdit(code, blocks, edit);
    expect(result).toContain("function baz()");
    expect(result).not.toContain("function foo()");
    // bar should be untouched
    expect(result).toContain("function bar()");
  });

  it("should throw for non-existent block", () => {
    const edit: CodeEdit = {
      action: "remove-block",
      targetBlock: "nonExistent",
    };
    expect(() => applyEdit(code, blocks, edit)).toThrow('Block not found: "nonExistent"');
  });

  it("should throw when content is missing for replace-block", () => {
    const edit: CodeEdit = {
      action: "replace-block",
      targetBlock: "foo",
    };
    expect(() => applyEdit(code, blocks, edit)).toThrow('"content" is required');
  });

  it("should throw when newName is missing for rename-symbol", () => {
    const edit: CodeEdit = {
      action: "rename-symbol",
      targetBlock: "foo",
    };
    expect(() => applyEdit(code, blocks, edit)).toThrow('"newName" is required');
  });
});

// ─────────────────────────────────────────────
// applyEdits — multiple edits
// ─────────────────────────────────────────────

describe("applyEdits", () => {
  it("should apply multiple edits in safe order (back to front)", () => {
    const code = [
      "function first() {",
      "  return 1;",
      "}",
      "",
      "function second() {",
      "  return 2;",
      "}",
      "",
      "function third() {",
      "  return 3;",
      "}",
    ].join("\n");

    const edits: readonly CodeEdit[] = [
      { action: "remove-block", targetBlock: "first" },
      { action: "replace-block", targetBlock: "third", content: "function third() {\n  return 33;\n}" },
    ];

    const result = applyEdits(code, "typescript", edits);
    expect(result).not.toContain("return 1;");
    expect(result).toContain("return 2;");
    expect(result).toContain("return 33;");
  });

  it("should handle single edit", () => {
    const code = "function foo() {\n  return 1;\n}";
    const edits: readonly CodeEdit[] = [
      { action: "rename-symbol", targetBlock: "foo", newName: "bar" },
    ];
    const result = applyEdits(code, "typescript", edits);
    expect(result).toContain("function bar()");
  });

  it("should handle insert-before and insert-after together", () => {
    const code = "function target() {\n  return 0;\n}";
    const edits: readonly CodeEdit[] = [
      { action: "insert-before", targetBlock: "target", content: "// before" },
      { action: "insert-after", targetBlock: "target", content: "// after" },
    ];
    const result = applyEdits(code, "typescript", edits);
    expect(result).toContain("// before");
    expect(result).toContain("// after");
    expect(result).toContain("function target()");
  });
});

// ─────────────────────────────────────────────
// validateEdits
// ─────────────────────────────────────────────

describe("validateEdits", () => {
  const blocks: readonly CodeBlock[] = [
    { type: "function", name: "foo", startLine: 1, endLine: 3, content: "", language: "ts" },
    { type: "function", name: "bar", startLine: 5, endLine: 7, content: "", language: "ts" },
  ];

  it("should pass for valid edits", () => {
    const edits: readonly CodeEdit[] = [
      { action: "replace-block", targetBlock: "foo", content: "function foo() { return 42; }" },
      { action: "remove-block", targetBlock: "bar" },
    ];
    const result = validateEdits(blocks, edits);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail for non-existent target block", () => {
    const edits: readonly CodeEdit[] = [
      { action: "remove-block", targetBlock: "nonExistent" },
    ];
    const result = validateEdits(blocks, edits);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not found");
    expect(result.errors[0]).toContain("nonExistent");
  });

  it("should fail when replace-block has no content", () => {
    const edits: readonly CodeEdit[] = [
      { action: "replace-block", targetBlock: "foo", content: "" },
    ];
    const result = validateEdits(blocks, edits);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("content");
  });

  it("should fail when rename-symbol has no newName", () => {
    const edits: readonly CodeEdit[] = [
      { action: "rename-symbol", targetBlock: "foo" },
    ];
    const result = validateEdits(blocks, edits);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("newName");
  });

  it("should report multiple errors", () => {
    const edits: readonly CodeEdit[] = [
      { action: "remove-block", targetBlock: "missing1" },
      { action: "remove-block", targetBlock: "missing2" },
    ];
    const result = validateEdits(blocks, edits);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("should pass for remove-block without extra fields", () => {
    const edits: readonly CodeEdit[] = [
      { action: "remove-block", targetBlock: "foo" },
    ];
    const result = validateEdits(blocks, edits);
    expect(result.valid).toBe(true);
  });

  it("should list available blocks in error message", () => {
    const edits: readonly CodeEdit[] = [
      { action: "remove-block", targetBlock: "missing" },
    ];
    const result = validateEdits(blocks, edits);
    expect(result.errors[0]).toContain("foo");
    expect(result.errors[0]).toContain("bar");
  });
});
