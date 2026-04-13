/**
 * Swift symbol extractor unit tests
 *
 * Tests extractSwiftSymbols using mock AST nodes that simulate
 * web-tree-sitter's Node interface, avoiding WASM dependency.
 */

import { describe, it, expect } from "vitest";
import { extractSwiftSymbols } from "../../../../src/indexing/queries/swift.js";

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

describe("extractSwiftSymbols", () => {
  it("returns empty result for empty file", () => {
    const result = extractSwiftSymbols(root(), "/test/empty.swift", "");
    expect(result.symbols).toHaveLength(0);
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
  });

  it("extracts a top-level function declaration", () => {
    const nameNode = identifier("greet");
    const paramsNode = createNode({ type: "function_value_parameters", text: "(name: String)" });
    const returnType = createNode({ type: "type_annotation", text: "String" });
    const funcDecl = createNode({
      type: "function_declaration",
      startRow: 0,
      endRow: 4,
      fields: { name: nameNode, params: paramsNode, return_type: returnType },
      namedChildren: [nameNode, paramsNode, returnType],
    });

    const result = extractSwiftSymbols(root(funcDecl), "/test/greet.swift", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("greet");
    expect(result.symbols[0].kind).toBe("function");
    expect(result.symbols[0].startLine).toBe(1);
  });

  it("extracts a class declaration", () => {
    const nameNode = identifier("Animal");
    const bodyNode = createNode({ type: "class_body", namedChildren: [] });
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 10,
      fields: { name: nameNode, body: bodyNode },
      namedChildren: [nameNode, bodyNode],
    });

    const result = extractSwiftSymbols(root(classDecl), "/test/Animal.swift", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Animal");
    expect(result.symbols[0].kind).toBe("class");
    expect(result.symbols[0].signature).toBe("class Animal");
  });

  it("extracts class with type inheritance clause", () => {
    const nameNode = identifier("Dog");
    const inheritance = createNode({
      type: "type_inheritance_clause",
      text: ": Animal, Identifiable",
    });
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 15,
      fields: { name: nameNode, type_inheritance_clause: inheritance },
      namedChildren: [nameNode, inheritance],
    });

    const result = extractSwiftSymbols(root(classDecl), "/test/Dog.swift", "");
    expect(result.symbols[0].signature).toContain("Animal");
  });

  it("extracts a struct declaration", () => {
    const nameNode = identifier("Point");
    const bodyNode = createNode({ type: "struct_body", namedChildren: [] });
    const structDecl = createNode({
      type: "struct_declaration",
      startRow: 0,
      endRow: 5,
      fields: { name: nameNode, body: bodyNode },
      namedChildren: [nameNode, bodyNode],
    });

    const result = extractSwiftSymbols(root(structDecl), "/test/Point.swift", "");
    expect(result.symbols[0].kind).toBe("class"); // Swift structs → "class" kind
    expect(result.symbols[0].name).toBe("Point");
    expect(result.symbols[0].signature).toBe("struct Point");
  });

  it("extracts a protocol declaration", () => {
    const nameNode = identifier("Drawable");
    const bodyNode = createNode({ type: "protocol_body", namedChildren: [] });
    const protocolDecl = createNode({
      type: "protocol_declaration",
      startRow: 0,
      endRow: 8,
      fields: { name: nameNode, body: bodyNode },
      namedChildren: [nameNode, bodyNode],
    });

    const result = extractSwiftSymbols(root(protocolDecl), "/test/Drawable.swift", "");
    expect(result.symbols[0].kind).toBe("interface");
    expect(result.symbols[0].name).toBe("Drawable");
  });

  it("extracts an enum declaration", () => {
    const nameNode = identifier("Direction");
    const bodyNode = createNode({ type: "enum_class_body", namedChildren: [] });
    const enumDecl = createNode({
      type: "enum_declaration",
      startRow: 0,
      endRow: 6,
      fields: { name: nameNode, body: bodyNode },
      namedChildren: [nameNode, bodyNode],
    });

    const result = extractSwiftSymbols(root(enumDecl), "/test/Direction.swift", "");
    expect(result.symbols[0].kind).toBe("enum");
    expect(result.symbols[0].name).toBe("Direction");
  });

  it("extracts import declaration", () => {
    const moduleIdent = createNode({ type: "identifier", text: "UIKit" });
    const importDecl = createNode({
      type: "import_declaration",
      startRow: 0,
      namedChildren: [moduleIdent],
    });

    const result = extractSwiftSymbols(root(importDecl), "/test/VC.swift", "");
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe("UIKit");
    expect(result.imports[0].isNamespace).toBe(true);
  });

  it("extracts methods from class body", () => {
    const methodName = identifier("bark");
    const paramsNode = createNode({ type: "function_value_parameters", text: "()" });
    const methodDecl = createNode({
      type: "function_declaration",
      startRow: 2,
      endRow: 4,
      fields: { name: methodName, params: paramsNode },
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
      fields: { name: className, body: bodyNode },
      namedChildren: [className, bodyNode],
    });

    const result = extractSwiftSymbols(root(classDecl), "/test/Dog.swift", "");
    const method = result.symbols.find((s) => s.name === "bark");
    expect(method).toBeDefined();
    expect(method?.kind).toBe("method");
    expect(method?.parentName).toBe("Dog");
  });

  it("sets exported true by default (internal visibility)", () => {
    const nameNode = identifier("Helper");
    const funcDecl = createNode({
      type: "function_declaration",
      startRow: 0,
      endRow: 3,
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractSwiftSymbols(root(funcDecl), "/test/helper.swift", "");
    expect(result.symbols[0].exported).toBe(true);
  });

  it("sets filePath on all symbols", () => {
    const nameNode = identifier("Foo");
    const classDecl = createNode({
      type: "class_declaration",
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractSwiftSymbols(root(classDecl), "/src/Foo.swift", "");
    expect(result.symbols[0].filePath).toBe("/src/Foo.swift");
  });
});
