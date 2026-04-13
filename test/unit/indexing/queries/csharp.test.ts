/**
 * C# symbol extractor unit tests
 *
 * Tests extractCsharpSymbols using mock AST nodes that simulate
 * web-tree-sitter's Node interface, avoiding WASM dependency.
 */

import { describe, it, expect } from "vitest";
import { extractCsharpSymbols } from "../../../../src/indexing/queries/csharp.js";

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
  return createNode({ type: "compilation_unit", namedChildren: children });
}

function identifier(name: string): MockNode {
  return createNode({ type: "identifier", text: name });
}

function publicModifier(): MockNode {
  return createNode({ type: "modifier", text: "public" });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("extractCsharpSymbols", () => {
  it("returns empty result for empty file", () => {
    const result = extractCsharpSymbols(root(), "/test/Empty.cs", "");
    expect(result.symbols).toHaveLength(0);
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
  });

  it("extracts a public class declaration", () => {
    const nameNode = identifier("MyClass");
    const pubMod = publicModifier();
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 10,
      fields: { name: nameNode },
      namedChildren: [pubMod, nameNode],
    });

    const result = extractCsharpSymbols(root(classDecl), "/test/MyClass.cs", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("MyClass");
    expect(result.symbols[0].kind).toBe("class");
    expect(result.symbols[0].exported).toBe(true);
    expect(result.symbols[0].signature).toBe("class MyClass");
  });

  it("marks non-public class as not exported", () => {
    const nameNode = identifier("InternalClass");
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 5,
      fields: { name: nameNode },
      namedChildren: [nameNode], // no public modifier
    });

    const result = extractCsharpSymbols(root(classDecl), "/test/IC.cs", "");
    expect(result.symbols[0].exported).toBe(false);
    expect(result.exports).not.toContain("InternalClass");
  });

  it("extracts a public interface declaration", () => {
    const nameNode = identifier("IRepository");
    const pubMod = publicModifier();
    const ifaceDecl = createNode({
      type: "interface_declaration",
      startRow: 0,
      endRow: 8,
      fields: { name: nameNode },
      namedChildren: [pubMod, nameNode],
    });

    const result = extractCsharpSymbols(root(ifaceDecl), "/test/IRepository.cs", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("IRepository");
    expect(result.symbols[0].kind).toBe("interface");
    expect(result.symbols[0].exported).toBe(true);
  });

  it("extracts a namespace declaration and recurses", () => {
    const nsNameNode = identifier("MyApp.Services");
    const classNameNode = identifier("UserService");
    const pubMod = publicModifier();
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 2,
      endRow: 20,
      fields: { name: classNameNode },
      namedChildren: [pubMod, classNameNode],
    });
    const bodyNode = createNode({
      type: "declaration_list",
      namedChildren: [classDecl],
    });
    const nsDecl = createNode({
      type: "namespace_declaration",
      startRow: 0,
      endRow: 22,
      fields: { name: nsNameNode, body: bodyNode },
      namedChildren: [nsNameNode, bodyNode],
    });

    const result = extractCsharpSymbols(root(nsDecl), "/test/Services.cs", "");
    // namespace symbol + class symbol
    expect(result.symbols.length).toBeGreaterThanOrEqual(2);
    const ns = result.symbols.find((s) => s.name === "MyApp.Services");
    expect(ns?.kind).toBe("type");
    const cls = result.symbols.find((s) => s.name === "UserService");
    expect(cls?.kind).toBe("class");
    expect(cls?.parentName).toBe("MyApp.Services");
  });

  it("extracts using directives as imports", () => {
    const qualifiedName = createNode({
      type: "qualified_name",
      text: "System.Collections.Generic",
    });
    const usingDir = createNode({
      type: "using_directive",
      startRow: 0,
      namedChildren: [qualifiedName],
    });

    const result = extractCsharpSymbols(root(usingDir), "/test/Foo.cs", "");
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].source).toBe("System.Collections.Generic");
    expect(result.imports[0].isNamespace).toBe(true);
  });

  it("extracts enum declaration", () => {
    const nameNode = identifier("Status");
    const pubMod = publicModifier();
    const enumDecl = createNode({
      type: "enum_declaration",
      startRow: 0,
      endRow: 5,
      fields: { name: nameNode },
      namedChildren: [pubMod, nameNode],
    });

    const result = extractCsharpSymbols(root(enumDecl), "/test/Status.cs", "");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].kind).toBe("enum");
    expect(result.symbols[0].name).toBe("Status");
    expect(result.symbols[0].exported).toBe(true);
  });

  it("extracts class with methods in body", () => {
    const methodName = identifier("GetUser");
    const pubMod = publicModifier();
    const paramsNode = createNode({ type: "parameter_list", text: "(int id)" });
    const returnType = createNode({ type: "predefined_type", text: "string" });
    const methodDecl = createNode({
      type: "method_declaration",
      startRow: 2,
      endRow: 5,
      fields: { name: methodName, type: returnType, parameters: paramsNode },
      namedChildren: [pubMod, returnType, methodName, paramsNode],
    });
    const bodyNode = createNode({
      type: "declaration_list",
      namedChildren: [methodDecl],
    });
    const className = identifier("UserService");
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 10,
      fields: { name: className, body: bodyNode },
      namedChildren: [pubMod, className, bodyNode],
    });

    const result = extractCsharpSymbols(root(classDecl), "/test/UserService.cs", "");
    const method = result.symbols.find((s) => s.name === "GetUser");
    expect(method).toBeDefined();
    expect(method?.kind).toBe("method");
    expect(method?.parentName).toBe("UserService");
  });

  it("extracts class with base class / interface list", () => {
    const nameNode = identifier("OrderService");
    const baseList = createNode({ type: "base_list", text: ": IService, BaseService" });
    const pubMod = publicModifier();
    const classDecl = createNode({
      type: "class_declaration",
      startRow: 0,
      endRow: 20,
      fields: { name: nameNode, base_list: baseList },
      namedChildren: [pubMod, nameNode, baseList],
    });

    const result = extractCsharpSymbols(root(classDecl), "/test/OrderService.cs", "");
    expect(result.symbols[0].signature).toContain("IService");
  });

  it("sets filePath on all symbols", () => {
    const nameNode = identifier("Foo");
    const pubMod = publicModifier();
    const classDecl = createNode({
      type: "class_declaration",
      fields: { name: nameNode },
      namedChildren: [pubMod, nameNode],
    });

    const result = extractCsharpSymbols(root(classDecl), "/src/Foo.cs", "");
    expect(result.symbols[0].filePath).toBe("/src/Foo.cs");
  });
});
