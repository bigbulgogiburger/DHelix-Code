/**
 * Kotlin symbol extractor unit tests
 *
 * Tests extractKotlinSymbols using mock AST nodes that simulate
 * web-tree-sitter's Node interface, avoiding WASM dependency.
 */

import { describe, it, expect } from "vitest";
import { extractKotlinSymbols } from "../../../../src/indexing/queries/kotlin.js";

// ── Mock AST Node builder ────────────────────────────────────────────────

interface MockNodeOptions {
  readonly type: string;
  readonly text?: string;
  readonly namedChildren?: MockNode[];
  readonly children?: MockNode[];
  readonly startRow?: number;
  readonly endRow?: number;
  readonly fields?: Record<string, MockNode | null>;
  readonly previousNamedSibling?: MockNode | null;
}

interface MockNode {
  readonly type: string;
  readonly text: string;
  readonly namedChildren: readonly MockNode[];
  readonly children: readonly MockNode[];
  readonly namedChildCount: number;
  readonly childCount: number;
  readonly startPosition: { readonly row: number; readonly column: number };
  readonly endPosition: { readonly row: number; readonly column: number };
  readonly previousNamedSibling: MockNode | null;
  namedChild(index: number): MockNode | null;
  child(index: number): MockNode | null;
  childForFieldName(name: string): MockNode | null;
}

function createNode(opts: MockNodeOptions): MockNode {
  const namedChildren = opts.namedChildren ?? [];
  const children = opts.children ?? [...namedChildren];
  const fields = opts.fields ?? {};

  return {
    type: opts.type,
    text: opts.text ?? "",
    namedChildren,
    children,
    namedChildCount: namedChildren.length,
    childCount: children.length,
    startPosition: { row: opts.startRow ?? 0, column: 0 },
    endPosition: { row: opts.endRow ?? opts.startRow ?? 0, column: 0 },
    previousNamedSibling: opts.previousNamedSibling ?? null,
    namedChild(index: number): MockNode | null {
      return namedChildren[index] ?? null;
    },
    child(index: number): MockNode | null {
      return children[index] ?? null;
    },
    childForFieldName(name: string): MockNode | null {
      return fields[name] ?? null;
    },
  };
}

function root(...children: MockNode[]): MockNode {
  return createNode({ type: "source_file", namedChildren: children });
}

function identifier(name: string): MockNode {
  return createNode({ type: "simple_identifier", text: name });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("extractKotlinSymbols", () => {
  it("returns empty result for empty file", () => {
    const result = extractKotlinSymbols(root(), "/test/Empty.kt", "");
    expect(result.symbols).toHaveLength(0);
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
  });

  it("extracts a top-level function declaration", () => {
    const nameNode = identifier("greet");
    const paramsNode = createNode({ type: "function_value_parameters", text: "(name: String)" });
    const funcDecl = createNode({
      type: "function_declaration",
      startRow: 0,
      endRow: 4,
      fields: { name: nameNode, function_value_parameters: paramsNode },
      namedChildren: [nameNode, paramsNode],
    });

    const result = extractKotlinSymbols(root(funcDecl), "/test/greet.kt", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("greet");
    expect(result.symbols[0].kind).toBe("function");
    expect(result.symbols[0].exported).toBe(true);
  });

  it("extracts a class declaration", () => {
    const nameNode = identifier("Animal");
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 10,
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractKotlinSymbols(root(classDecl), "/test/Animal.kt", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Animal");
    expect(result.symbols[0].kind).toBe("class");
    expect(result.symbols[0].signature).toBe("class Animal");
  });

  it("extracts class with delegation specifiers (superclass)", () => {
    const nameNode = identifier("Dog");
    const delegationSpec = createNode({
      type: "delegation_specifiers",
      text: "Animal()",
    });
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 15,
      fields: { name: nameNode, delegation_specifiers: delegationSpec },
      namedChildren: [nameNode, delegationSpec],
    });

    const result = extractKotlinSymbols(root(classDecl), "/test/Dog.kt", "");
    expect(result.symbols[0].signature).toContain("Animal()");
  });

  it("extracts an object declaration (singleton)", () => {
    const nameNode = identifier("Repository");
    const objectDecl = createNode({
      type: "object_declaration",
      startRow: 0,
      endRow: 8,
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractKotlinSymbols(root(objectDecl), "/test/Repo.kt", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Repository");
    expect(result.symbols[0].kind).toBe("class");
    expect(result.symbols[0].signature).toBe("object Repository");
  });

  it("extracts an interface declaration", () => {
    const nameNode = identifier("Clickable");
    const ifaceDecl = createNode({
      type: "interface_declaration",
      startRow: 0,
      endRow: 6,
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractKotlinSymbols(root(ifaceDecl), "/test/Clickable.kt", "");
    expect(result.symbols[0].kind).toBe("interface");
    expect(result.symbols[0].name).toBe("Clickable");
  });

  it("extracts import headers", () => {
    const qualName = createNode({ type: "qualified_name", text: "kotlin.collections.List" });
    const importHeader = createNode({
      type: "import_header",
      startRow: 0,
      namedChildren: [qualName],
    });

    const result = extractKotlinSymbols(root(importHeader), "/test/Foo.kt", "");
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe("kotlin.collections.List");
  });

  it("falls back to text parsing for import header without qualified_name", () => {
    const importHeader = createNode({
      type: "import_header",
      text: "import com.example.Foo",
      startRow: 0,
      namedChildren: [],
    });

    const result = extractKotlinSymbols(root(importHeader), "/test/Foo.kt", "");
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe("com.example.Foo");
  });

  it("extracts class members (functions)", () => {
    const methodName = identifier("bark");
    const paramsNode = createNode({ type: "function_value_parameters", text: "()" });
    const methodDecl = createNode({
      type: "function_declaration",
      startRow: 2,
      endRow: 4,
      fields: { name: methodName, function_value_parameters: paramsNode },
      namedChildren: [methodName, paramsNode],
    });
    const bodyNode = createNode({
      type: "class_body",
      namedChildren: [methodDecl],
    });
    const className = identifier("Dog");
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 10,
      fields: { name: className, class_body: bodyNode },
      namedChildren: [className, bodyNode],
    });

    const result = extractKotlinSymbols(root(classDecl), "/test/Dog.kt", "");
    const method = result.symbols.find((s) => s.name === "bark");
    expect(method).toBeDefined();
    expect(method?.kind).toBe("method");
    expect(method?.parentName).toBe("Dog");
  });

  it("extracts data class with enum prefix", () => {
    const modifiers = createNode({ type: "modifiers", text: "data" });
    const nameNode = identifier("UserDTO");
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 3,
      fields: { name: nameNode },
      namedChildren: [modifiers, nameNode],
    });

    const result = extractKotlinSymbols(root(classDecl), "/test/UserDTO.kt", "");
    expect(result.symbols[0].signature).toContain("data class");
  });

  it("marks function as not exported when private modifier is present", () => {
    const modifiers = createNode({ type: "modifiers", text: "private" });
    const nameNode = identifier("helper");
    const funcDecl = createNode({
      type: "function_declaration",
      startRow: 0,
      endRow: 3,
      fields: { name: nameNode },
      namedChildren: [modifiers, nameNode],
    });

    const result = extractKotlinSymbols(root(funcDecl), "/test/Foo.kt", "");
    expect(result.symbols[0].exported).toBe(false);
    expect(result.exports).not.toContain("helper");
  });

  it("sets filePath on all symbols", () => {
    const nameNode = identifier("Foo");
    const classDecl = createNode({
      type: "class_declaration",
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractKotlinSymbols(root(classDecl), "/src/Foo.kt", "");
    expect(result.symbols[0].filePath).toBe("/src/Foo.kt");
  });
});
