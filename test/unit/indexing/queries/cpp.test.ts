/**
 * C/C++ symbol extractor unit tests
 *
 * Tests extractCppSymbols using mock AST nodes that simulate
 * web-tree-sitter's Node interface, avoiding WASM dependency.
 */

import { describe, it, expect } from "vitest";
import { extractCppSymbols } from "../../../../src/indexing/queries/cpp.js";

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
  readonly namedChildCount?: number;
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
  return createNode({ type: "translation_unit", namedChildren: children });
}

function identifier(name: string): MockNode {
  return createNode({ type: "identifier", text: name });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("extractCppSymbols", () => {
  it("returns empty result for empty file", () => {
    const result = extractCppSymbols(root(), "/test/empty.cpp", "");
    expect(result.symbols).toHaveLength(0);
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
  });

  it("extracts a simple function definition", () => {
    const declaratorIdent = identifier("add");
    const paramsNode = createNode({ type: "parameter_list", text: "(int a, int b)" });
    const funcDeclarator = createNode({
      type: "function_declarator",
      namedChildren: [declaratorIdent, paramsNode],
      fields: { declarator: declaratorIdent, parameters: paramsNode },
    });
    const typeNode = createNode({ type: "type_specifier", text: "int" });
    const funcDef = createNode({
      type: "function_definition",
      startRow: 1,
      endRow: 5,
      fields: { declarator: funcDeclarator, type: typeNode },
      namedChildren: [typeNode, funcDeclarator],
    });

    const result = extractCppSymbols(root(funcDef), "/test/math.cpp", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("add");
    expect(result.symbols[0].kind).toBe("function");
    expect(result.symbols[0].startLine).toBe(2);
    expect(result.symbols[0].endLine).toBe(6);
    expect(result.symbols[0].exported).toBe(true);
  });

  it("extracts a class specifier with name", () => {
    const nameNode = identifier("MyClass");
    const classBody = createNode({
      type: "field_declaration_list",
      namedChildren: [],
    });
    const classDef = createNode({
      type: "class_specifier",
      startRow: 0,
      endRow: 10,
      fields: { name: nameNode, body: classBody },
      namedChildren: [nameNode, classBody],
    });

    const result = extractCppSymbols(root(classDef), "/test/MyClass.cpp", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("MyClass");
    expect(result.symbols[0].kind).toBe("class");
    expect(result.symbols[0].signature).toBe("class MyClass");
  });

  it("extracts a struct specifier", () => {
    const nameNode = identifier("Point");
    const structDef = createNode({
      type: "struct_specifier",
      startRow: 0,
      endRow: 4,
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractCppSymbols(root(structDef), "/test/point.cpp", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Point");
    expect(result.symbols[0].kind).toBe("class");
    expect(result.symbols[0].signature).toBe("struct Point");
  });

  it("extracts a namespace definition", () => {
    const nameNode = identifier("MyNS");
    const bodyNode = createNode({
      type: "declaration_list",
      namedChildren: [],
    });
    const nsDef = createNode({
      type: "namespace_definition",
      startRow: 0,
      endRow: 20,
      fields: { name: nameNode, body: bodyNode },
      namedChildren: [nameNode, bodyNode],
    });

    const result = extractCppSymbols(root(nsDef), "/test/ns.cpp", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("MyNS");
    expect(result.symbols[0].kind).toBe("type");
    expect(result.symbols[0].signature).toBe("namespace MyNS");
  });

  it("extracts an enum specifier", () => {
    const nameNode = identifier("Color");
    const enumDef = createNode({
      type: "enum_specifier",
      startRow: 0,
      endRow: 5,
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractCppSymbols(root(enumDef), "/test/color.cpp", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Color");
    expect(result.symbols[0].kind).toBe("enum");
    expect(result.symbols[0].signature).toBe("enum Color");
  });

  it("extracts #include directives as imports", () => {
    const pathNode = createNode({ type: "system_lib_string", text: "<vector>" });
    const include = createNode({
      type: "preproc_include",
      startRow: 0,
      fields: { path: pathNode },
      namedChildren: [pathNode],
    });

    const result = extractCppSymbols(root(include), "/test/main.cpp", "");
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe("vector");
    expect(result.imports[0].line).toBe(1);
  });

  it("extracts quoted include path", () => {
    const pathNode = createNode({ type: "string_literal", text: '"utils.h"' });
    const include = createNode({
      type: "preproc_include",
      startRow: 2,
      fields: { path: pathNode },
      namedChildren: [pathNode],
    });

    const result = extractCppSymbols(root(include), "/test/main.cpp", "");
    expect(result.imports[0].source).toBe("utils.h");
  });

  it("exports names of functions and types", () => {
    const nameNode = identifier("MyStruct");
    const structDef = createNode({
      type: "struct_specifier",
      startRow: 0,
      endRow: 5,
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractCppSymbols(root(structDef), "/test/s.cpp", "");
    expect(result.exports).toContain("MyStruct");
  });

  it("extracts doc comment for a function", () => {
    const docComment = createNode({
      type: "comment",
      text: "/** Adds two integers */",
    });
    const declaratorIdent = identifier("add");
    const paramsNode = createNode({ type: "parameter_list", text: "()" });
    const funcDeclarator = createNode({
      type: "function_declarator",
      fields: { declarator: declaratorIdent, parameters: paramsNode },
      namedChildren: [declaratorIdent, paramsNode],
    });
    const typeNode = createNode({ type: "type_specifier", text: "int" });
    const funcDef = createNode({
      type: "function_definition",
      startRow: 1,
      endRow: 3,
      fields: { declarator: funcDeclarator, type: typeNode },
      namedChildren: [typeNode, funcDeclarator],
      previousNamedSibling: docComment,
    });

    const result = extractCppSymbols(root(funcDef), "/test/math.cpp", "");
    expect(result.symbols[0].documentation).toBe("Adds two integers");
  });

  it("sets filePath on all symbols", () => {
    const nameNode = identifier("Foo");
    const classDef = createNode({
      type: "class_specifier",
      fields: { name: nameNode },
      namedChildren: [nameNode],
    });

    const result = extractCppSymbols(root(classDef), "/src/foo.cpp", "");
    expect(result.symbols[0].filePath).toBe("/src/foo.cpp");
  });
});
