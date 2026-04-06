/**
 * TypeScript symbol extractor unit tests
 *
 * Tests the extractTypeScriptSymbols function using mock AST nodes that
 * simulate web-tree-sitter's Node interface. This avoids WASM binary
 * compatibility issues while fully testing the extractor logic.
 */

import { describe, it, expect } from "vitest";

import {
  extractTypeScriptSymbols,
  type ParsedSymbol,
  type ImportInfo,
} from "../../../../src/indexing/queries/typescript.js";

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
  readonly startPosition: { readonly row: number; readonly column: number };
  readonly endPosition: { readonly row: number; readonly column: number };
  readonly previousNamedSibling: MockNode | null;
  childForFieldName(name: string): MockNode | null;
}

function createNode(opts: MockNodeOptions): MockNode {
  const namedChildren = opts.namedChildren ?? [];
  const children = opts.children ?? [...namedChildren];
  const fields = opts.fields ?? {};

  const node: MockNode = {
    type: opts.type,
    text: opts.text ?? "",
    namedChildren,
    children,
    startPosition: { row: opts.startRow ?? 0, column: 0 },
    endPosition: { row: opts.endRow ?? opts.startRow ?? 0, column: 0 },
    previousNamedSibling: opts.previousNamedSibling ?? null,
    childForFieldName(name: string): MockNode | null {
      return fields[name] ?? null;
    },
  };
  return node;
}

/**
 * Build a mock root "program" node with the given children.
 */
function program(...children: MockNode[]): MockNode {
  return createNode({
    type: "program",
    namedChildren: children,
  });
}

// ── Shorthand builders for common nodes ──────────────────────────────────

function identifier(name: string, row = 0): MockNode {
  return createNode({ type: "identifier", text: name, startRow: row });
}

function stringLiteral(value: string): MockNode {
  return createNode({ type: "string", text: `"${value}"` });
}

function formalParameters(text: string): MockNode {
  return createNode({ type: "formal_parameters", text });
}

function returnTypeAnnotation(text: string): MockNode {
  return createNode({ type: "type_annotation", text: `: ${text}` });
}

function typeParameters(text: string): MockNode {
  return createNode({ type: "type_parameters", text });
}

function jsDocComment(text: string, row = 0): MockNode {
  return createNode({ type: "comment", text: `/** ${text} */`, startRow: row });
}

function functionDeclaration(
  name: string,
  opts: {
    params?: string;
    returnType?: string;
    isAsync?: boolean;
    startRow?: number;
    endRow?: number;
    doc?: MockNode | null;
  } = {},
): MockNode {
  const nameNode = identifier(name);
  const paramsNode = formalParameters(opts.params ?? "()");
  const retNode = opts.returnType
    ? returnTypeAnnotation(opts.returnType)
    : null;

  const asyncNode = opts.isAsync
    ? createNode({ type: "async", text: "async" })
    : null;

  const fields: Record<string, MockNode | null> = {
    name: nameNode,
    parameters: paramsNode,
    return_type: retNode,
  };

  const children: MockNode[] = [];
  if (asyncNode) children.push(asyncNode);
  children.push(nameNode, paramsNode);
  if (retNode) children.push(retNode);

  return createNode({
    type: "function_declaration",
    namedChildren: [nameNode, paramsNode, ...(retNode ? [retNode] : [])],
    children,
    startRow: opts.startRow ?? 0,
    endRow: opts.endRow ?? opts.startRow ?? 0,
    fields,
    previousNamedSibling: opts.doc,
  });
}

function classBody(...members: MockNode[]): MockNode {
  return createNode({
    type: "class_body",
    namedChildren: members,
  });
}

function methodDefinition(
  name: string,
  opts: {
    params?: string;
    returnType?: string;
    isAsync?: boolean;
    isGetter?: boolean;
    isSetter?: boolean;
    isStatic?: boolean;
    startRow?: number;
    endRow?: number;
    doc?: MockNode | null;
  } = {},
): MockNode {
  const nameNode = identifier(name);
  const paramsNode = formalParameters(opts.params ?? "()");
  const retNode = opts.returnType
    ? returnTypeAnnotation(opts.returnType)
    : null;

  const children: MockNode[] = [];
  if (opts.isStatic) children.push(createNode({ type: "static", text: "static" }));
  if (opts.isAsync) children.push(createNode({ type: "async", text: "async" }));
  if (opts.isGetter) children.push(createNode({ type: "get", text: "get" }));
  if (opts.isSetter) children.push(createNode({ type: "set", text: "set" }));
  children.push(nameNode, paramsNode);
  if (retNode) children.push(retNode);

  return createNode({
    type: "method_definition",
    namedChildren: [nameNode, paramsNode, ...(retNode ? [retNode] : [])],
    children,
    startRow: opts.startRow ?? 0,
    endRow: opts.endRow ?? opts.startRow ?? 0,
    fields: {
      name: nameNode,
      parameters: paramsNode,
      return_type: retNode,
    },
    previousNamedSibling: opts.doc,
  });
}

function classDeclaration(
  name: string,
  body: MockNode,
  opts: {
    superclass?: string;
    startRow?: number;
    endRow?: number;
    doc?: MockNode | null;
  } = {},
): MockNode {
  const nameNode = identifier(name);
  const heritage = opts.superclass
    ? createNode({
        type: "class_heritage",
        text: `extends ${opts.superclass}`,
        namedChildren: [createNode({ type: "identifier", text: opts.superclass })],
      })
    : null;

  const namedChildren: MockNode[] = [nameNode, body];
  if (heritage) namedChildren.splice(1, 0, heritage);

  return createNode({
    type: "class_declaration",
    namedChildren,
    startRow: opts.startRow ?? 0,
    endRow: opts.endRow ?? opts.startRow ?? 0,
    fields: { name: nameNode },
    previousNamedSibling: opts.doc,
  });
}

function interfaceDeclaration(
  name: string,
  opts: {
    extendsClause?: string;
    startRow?: number;
    endRow?: number;
  } = {},
): MockNode {
  const nameNode = identifier(name);
  const extendsNode = opts.extendsClause
    ? createNode({ type: "extends_type_clause", text: opts.extendsClause })
    : null;

  return createNode({
    type: "interface_declaration",
    namedChildren: [nameNode, ...(extendsNode ? [extendsNode] : [])],
    startRow: opts.startRow ?? 0,
    endRow: opts.endRow ?? opts.startRow ?? 0,
    fields: { name: nameNode },
  });
}

function typeAliasDeclaration(
  name: string,
  opts: {
    typeParams?: string;
    startRow?: number;
    endRow?: number;
  } = {},
): MockNode {
  const nameNode = identifier(name);
  const typeParamsNode = opts.typeParams
    ? typeParameters(opts.typeParams)
    : null;

  return createNode({
    type: "type_alias_declaration",
    namedChildren: [nameNode, ...(typeParamsNode ? [typeParamsNode] : [])],
    startRow: opts.startRow ?? 0,
    endRow: opts.endRow ?? opts.startRow ?? 0,
    fields: { name: nameNode },
  });
}

function enumDeclaration(
  name: string,
  opts: {
    isConst?: boolean;
    startRow?: number;
    endRow?: number;
  } = {},
): MockNode {
  const nameNode = identifier(name);
  const children: MockNode[] = [];
  if (opts.isConst) children.push(createNode({ type: "const", text: "const" }));
  children.push(nameNode);

  return createNode({
    type: "enum_declaration",
    namedChildren: [nameNode],
    children,
    startRow: opts.startRow ?? 0,
    endRow: opts.endRow ?? opts.startRow ?? 0,
    fields: { name: nameNode },
  });
}

function exportStatement(...children: MockNode[]): MockNode {
  // When wrapping a declaration, the declaration is a named child
  return createNode({
    type: "export_statement",
    namedChildren: children,
    fields: { source: null },
  });
}

function exportDefaultDeclaration(...children: MockNode[]): MockNode {
  return createNode({
    type: "export_default_declaration",
    namedChildren: children,
  });
}

function exportClause(...specifiers: MockNode[]): MockNode {
  return createNode({
    type: "export_clause",
    namedChildren: specifiers,
  });
}

function exportSpecifier(name: string, alias?: string): MockNode {
  const nameNode = createNode({ type: "identifier", text: name });
  const aliasNode = alias
    ? createNode({ type: "identifier", text: alias })
    : null;
  return createNode({
    type: "export_specifier",
    text: alias ? `${name} as ${alias}` : name,
    namedChildren: [nameNode, ...(aliasNode ? [aliasNode] : [])],
    fields: {
      name: nameNode,
      alias: aliasNode,
    },
  });
}

function importStatement(
  source: string,
  opts: {
    specifiers?: string[];
    defaultImport?: string;
    namespaceImport?: string;
    startRow?: number;
  } = {},
): MockNode {
  const sourceNode = stringLiteral(source);
  const namedChildren: MockNode[] = [];

  if (opts.defaultImport) {
    namedChildren.push(identifier(opts.defaultImport));
  }

  if (opts.namespaceImport) {
    const aliasNode = identifier(opts.namespaceImport);
    namedChildren.push(
      createNode({
        type: "namespace_import",
        namedChildren: [aliasNode],
        fields: { alias: aliasNode },
      }),
    );
  }

  if (opts.specifiers && opts.specifiers.length > 0) {
    const specs = opts.specifiers.map((s) => {
      const parts = s.split(" as ");
      const nameNode = createNode({ type: "identifier", text: parts[0] });
      const aliasNode = parts[1]
        ? createNode({ type: "identifier", text: parts[1] })
        : null;
      return createNode({
        type: "import_specifier",
        text: s,
        namedChildren: [nameNode, ...(aliasNode ? [aliasNode] : [])],
        fields: { name: nameNode, alias: aliasNode },
      });
    });
    namedChildren.push(
      createNode({ type: "named_imports", namedChildren: specs }),
    );
  }

  namedChildren.push(sourceNode);

  return createNode({
    type: "import_statement",
    namedChildren,
    startRow: opts.startRow ?? 0,
    fields: { source: sourceNode },
  });
}

function lexicalDeclaration(
  kindText: "const" | "let" | "var",
  declarators: MockNode[],
  opts: { startRow?: number; endRow?: number } = {},
): MockNode {
  const kindNode = createNode({ type: kindText, text: kindText });
  return createNode({
    type: "lexical_declaration",
    namedChildren: declarators,
    children: [kindNode, ...declarators],
    startRow: opts.startRow ?? 0,
    endRow: opts.endRow ?? opts.startRow ?? 0,
  });
}

function variableDeclarator(
  name: string,
  value?: MockNode,
  typeAnnotation?: string,
): MockNode {
  const nameNode = identifier(name);
  const typeNode = typeAnnotation
    ? createNode({ type: "type_annotation", text: `: ${typeAnnotation}` })
    : null;

  return createNode({
    type: "variable_declarator",
    namedChildren: [nameNode, ...(value ? [value] : [])],
    fields: {
      name: nameNode,
      value: value ?? null,
      type: typeNode,
    },
  });
}

function arrowFunction(
  params: string,
  opts: { returnType?: string; isAsync?: boolean } = {},
): MockNode {
  const paramsNode = formalParameters(params);
  const retNode = opts.returnType
    ? returnTypeAnnotation(opts.returnType)
    : null;
  const children: MockNode[] = [];
  if (opts.isAsync) children.push(createNode({ type: "async", text: "async" }));
  children.push(paramsNode);
  if (retNode) children.push(retNode);

  return createNode({
    type: "arrow_function",
    namedChildren: [paramsNode, ...(retNode ? [retNode] : [])],
    children,
    fields: {
      parameters: paramsNode,
      return_type: retNode,
    },
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

const FILE = "/test/sample.ts";

describe("TypeScript extractor (extractTypeScriptSymbols)", () => {
  // ── 1. Export detection ───────────────────────────────────────────────

  describe("export detection", () => {
    it("export function foo => exported: true", () => {
      const fn = functionDeclaration("foo", { params: "()", returnType: "void" });
      const root = program(exportStatement(fn));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const foo = result.symbols.find((s) => s.name === "foo");
      expect(foo).toBeDefined();
      expect(foo!.exported).toBe(true);
      expect(foo!.kind).toBe("function");
    });

    it("function bar (no export) => exported: false", () => {
      const fn = functionDeclaration("bar", { params: "()", returnType: "void" });
      const root = program(fn);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const bar = result.symbols.find((s) => s.name === "bar");
      expect(bar).toBeDefined();
      expect(bar!.exported).toBe(false);
    });

    it("export default class => exported: true", () => {
      const cls = classDeclaration("Foo", classBody());
      const root = program(exportDefaultDeclaration(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const foo = result.symbols.find(
        (s) => s.name === "Foo" && s.kind === "class",
      );
      expect(foo).toBeDefined();
      expect(foo!.exported).toBe(true);
      expect(result.exports).toContain("default");
    });

    it("export { X, Y } => both in exports array", () => {
      const clause = exportClause(
        exportSpecifier("X"),
        exportSpecifier("Y"),
      );
      const expStmt = createNode({
        type: "export_statement",
        namedChildren: [clause],
        fields: { source: null },
      });
      const root = program(expStmt);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.exports).toContain("X");
      expect(result.exports).toContain("Y");
    });

    it("export const => exported constant", () => {
      const decl = lexicalDeclaration("const", [
        variableDeclarator("MAX"),
      ]);
      const root = program(exportStatement(decl));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const max = result.symbols.find((s) => s.name === "MAX");
      expect(max).toBeDefined();
      expect(max!.exported).toBe(true);
      expect(max!.kind).toBe("const");
    });

    it("export type => exported type alias", () => {
      const typeDecl = typeAliasDeclaration("ID");
      const root = program(exportStatement(typeDecl));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const id = result.symbols.find((s) => s.name === "ID");
      expect(id).toBeDefined();
      expect(id!.exported).toBe(true);
      expect(id!.kind).toBe("type");
    });

    it("export enum => exported enum", () => {
      const enumDecl = enumDeclaration("Color");
      const root = program(exportStatement(enumDecl));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const color = result.symbols.find((s) => s.name === "Color");
      expect(color).toBeDefined();
      expect(color!.exported).toBe(true);
      expect(color!.kind).toBe("enum");
    });

    it("export interface => exported", () => {
      const iface = interfaceDeclaration("Config");
      const root = program(exportStatement(iface));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const cfg = result.symbols.find((s) => s.name === "Config");
      expect(cfg).toBeDefined();
      expect(cfg!.exported).toBe(true);
      expect(cfg!.kind).toBe("interface");
    });
  });

  // ── 2. Import extraction ──────────────────────────────────────────────

  describe("import extraction", () => {
    it("named import: import { X } from './file'", () => {
      const imp = importStatement("react", {
        specifiers: ["useState", "useEffect"],
      });
      const root = program(imp);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.imports.length).toBe(1);
      expect(result.imports[0].source).toBe("react");
      expect(result.imports[0].specifiers).toContain("useState");
      expect(result.imports[0].specifiers).toContain("useEffect");
      expect(result.imports[0].isDefault).toBe(false);
      expect(result.imports[0].isNamespace).toBe(false);
    });

    it("default import: import X from './file'", () => {
      const imp = importStatement("react", { defaultImport: "React" });
      const root = program(imp);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.imports.length).toBe(1);
      expect(result.imports[0].source).toBe("react");
      expect(result.imports[0].isDefault).toBe(true);
      expect(result.imports[0].specifiers).toContain("React");
    });

    it("namespace import: import * as X from './file'", () => {
      const imp = importStatement("node:path", {
        namespaceImport: "path",
      });
      const root = program(imp);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.imports.length).toBe(1);
      expect(result.imports[0].source).toBe("node:path");
      expect(result.imports[0].isNamespace).toBe(true);
      expect(result.imports[0].specifiers).toContain("path");
    });

    it("side-effect import: import './side-effect'", () => {
      const imp = importStatement("./side-effect", {});
      const root = program(imp);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.imports.length).toBe(1);
      expect(result.imports[0].source).toBe("./side-effect");
      expect(result.imports[0].specifiers.length).toBe(0);
      expect(result.imports[0].isDefault).toBe(false);
      expect(result.imports[0].isNamespace).toBe(false);
    });

    it("aliased import: import { X as Y }", () => {
      const imp = importStatement("node:fs/promises", {
        specifiers: ["readFile as read"],
      });
      const root = program(imp);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.imports[0].specifiers).toContain("read");
    });

    it("multiple import statements", () => {
      const imp1 = importStatement("node:path", {
        specifiers: ["join"],
        startRow: 0,
      });
      const imp2 = importStatement("node:fs/promises", {
        specifiers: ["readFile"],
        startRow: 1,
      });
      const imp3 = importStatement("node:os", {
        defaultImport: "os",
        startRow: 2,
      });
      const root = program(imp1, imp2, imp3);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.imports.length).toBe(3);
      const sources = result.imports.map((i) => i.source);
      expect(sources).toContain("node:path");
      expect(sources).toContain("node:fs/promises");
      expect(sources).toContain("node:os");
    });

    it("import line numbers are correct (1-based)", () => {
      const imp1 = importStatement("mod", { specifiers: ["X"], startRow: 0 });
      const imp2 = importStatement("mod2", {
        defaultImport: "Y",
        startRow: 1,
      });
      const root = program(imp1, imp2);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.imports[0].line).toBe(1);
      expect(result.imports[1].line).toBe(2);
    });
  });

  // ── 3. Signature extraction ───────────────────────────────────────────

  describe("signature extraction", () => {
    it("function with typed parameters and return type", () => {
      const fn = functionDeclaration("calc", {
        params: "(a: string, b: number)",
        returnType: "boolean",
      });
      const root = program(exportStatement(fn));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const calc = result.symbols.find((s) => s.name === "calc");
      expect(calc).toBeDefined();
      expect(calc!.signature).toContain("a: string");
      expect(calc!.signature).toContain("b: number");
      expect(calc!.signature).toContain("boolean");
    });

    it("async function includes async prefix", () => {
      const fn = functionDeclaration("fetchData", {
        params: "(url: string)",
        returnType: "Promise<string>",
        isAsync: true,
      });
      const root = program(exportStatement(fn));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const fetchData = result.symbols.find((s) => s.name === "fetchData");
      expect(fetchData).toBeDefined();
      expect(fetchData!.signature).toContain("async");
    });

    it("arrow function assigned to const captures signature", () => {
      const arrow = arrowFunction("(a: number, b: number)", {
        returnType: "number",
      });
      const decl = lexicalDeclaration("const", [
        variableDeclarator("add", arrow),
      ]);
      const root = program(exportStatement(decl));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const add = result.symbols.find((s) => s.name === "add");
      expect(add).toBeDefined();
      expect(add!.kind).toBe("function");
      expect(add!.signature).toContain("a: number");
      expect(add!.signature).toContain("b: number");
    });

    it("function with no return type annotation", () => {
      const fn = functionDeclaration("noReturn", {
        params: "(x: string)",
      });
      const root = program(exportStatement(fn));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const noReturn = result.symbols.find((s) => s.name === "noReturn");
      expect(noReturn).toBeDefined();
      expect(noReturn!.signature).toContain("x: string");
      // No return type means no colon suffix
    });
  });

  // ── 4. Class methods ──────────────────────────────────────────────────

  describe("class methods", () => {
    it("regular method has kind='method' and parentName", () => {
      const method = methodDefinition("getData", {
        params: "(id: string)",
        returnType: "Promise<Data>",
        isAsync: true,
      });
      const cls = classDeclaration("MyService", classBody(method));
      const root = program(exportStatement(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const getData = result.symbols.find(
        (s) => s.name === "getData" && s.kind === "method",
      );
      expect(getData).toBeDefined();
      expect(getData!.parentName).toBe("MyService");
      expect(getData!.signature).toContain("async");
    });

    it("constructor is extracted as method", () => {
      const ctor = methodDefinition("constructor", {
        params: "(private readonly db: Database)",
      });
      const cls = classDeclaration("MyService", classBody(ctor));
      const root = program(exportStatement(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const constructor = result.symbols.find(
        (s) => s.name === "constructor" && s.kind === "method",
      );
      expect(constructor).toBeDefined();
      expect(constructor!.parentName).toBe("MyService");
    });

    it("getter method detected", () => {
      const getter = methodDefinition("name", {
        params: "()",
        returnType: "string",
        isGetter: true,
      });
      const cls = classDeclaration("MyService", classBody(getter));
      const root = program(exportStatement(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const nameGetter = result.symbols.find(
        (s) => s.name === "name" && s.kind === "method",
      );
      expect(nameGetter).toBeDefined();
      expect(nameGetter!.parentName).toBe("MyService");
      expect(nameGetter!.signature).toContain("get ");
    });

    it("setter method detected", () => {
      const setter = methodDefinition("name", {
        params: "(value: string)",
        isSetter: true,
      });
      const cls = classDeclaration("MyService", classBody(setter));
      const root = program(exportStatement(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const nameSetter = result.symbols.find(
        (s) => s.name === "name" && s.kind === "method",
      );
      expect(nameSetter).toBeDefined();
      expect(nameSetter!.parentName).toBe("MyService");
      expect(nameSetter!.signature).toContain("set ");
    });

    it("static method has static in signature", () => {
      const staticMethod = methodDefinition("create", {
        params: "()",
        returnType: "MyService",
        isStatic: true,
      });
      const cls = classDeclaration("MyService", classBody(staticMethod));
      const root = program(exportStatement(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const create = result.symbols.find(
        (s) => s.name === "create" && s.kind === "method",
      );
      expect(create).toBeDefined();
      expect(create!.parentName).toBe("MyService");
      expect(create!.signature).toContain("static ");
    });

    it("class with extends clause captures superclass", () => {
      const cls = classDeclaration("Child", classBody(), {
        superclass: "BaseService",
      });
      const root = program(exportStatement(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const child = result.symbols.find(
        (s) => s.name === "Child" && s.kind === "class",
      );
      expect(child).toBeDefined();
      expect(child!.signature).toContain("extends BaseService");
    });
  });

  // ── 5. Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("empty file returns empty symbols array", () => {
      const root = program();
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.symbols).toEqual([]);
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
    });

    it("re-exports are tracked in exports array and imports for dependency", () => {
      const clause1 = exportClause(
        exportSpecifier("Foo"),
        exportSpecifier("Bar"),
      );
      const reExportSource = stringLiteral("./module");
      const reExport1 = createNode({
        type: "export_statement",
        namedChildren: [clause1, reExportSource],
        fields: { source: reExportSource },
      });

      const clause2 = exportClause(exportSpecifier("Baz", "Qux"));
      const reExportSource2 = stringLiteral("./other");
      const reExport2 = createNode({
        type: "export_statement",
        namedChildren: [clause2, reExportSource2],
        fields: { source: reExportSource2 },
      });

      const root = program(reExport1, reExport2);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.exports).toContain("Foo");
      expect(result.exports).toContain("Bar");
      expect(result.exports).toContain("Qux");

      // Re-exports also generate import entries for dependency tracking
      const sources = result.imports.map((i) => i.source);
      expect(sources).toContain("./module");
      expect(sources).toContain("./other");
    });

    it("const enum is detected with const in signature", () => {
      const enumDecl = enumDeclaration("Direction", { isConst: true });
      const root = program(exportStatement(enumDecl));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const dir = result.symbols.find((s) => s.name === "Direction");
      expect(dir).toBeDefined();
      expect(dir!.kind).toBe("enum");
      expect(dir!.signature).toBe("const");
    });

    it("interface with extends clause", () => {
      const iface = interfaceDeclaration("Dog", {
        extendsClause: "extends Animal",
      });
      const root = program(exportStatement(iface));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const dog = result.symbols.find((s) => s.name === "Dog");
      expect(dog).toBeDefined();
      expect(dog!.kind).toBe("interface");
      expect(dog!.signature).toContain("extends");
    });

    it("type with type parameters", () => {
      const typeDecl = typeAliasDeclaration("Result", {
        typeParams: "<T, E>",
      });
      const root = program(exportStatement(typeDecl));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const res = result.symbols.find((s) => s.name === "Result");
      expect(res).toBeDefined();
      expect(res!.kind).toBe("type");
      expect(res!.signature).toContain("<T, E>");
    });

    it("abstract class is detected", () => {
      const nameNode = identifier("BaseHandler");
      const body = classBody();
      const cls = createNode({
        type: "abstract_class_declaration",
        namedChildren: [nameNode, body],
        fields: { name: nameNode },
      });
      const root = program(exportStatement(cls));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const handler = result.symbols.find((s) => s.name === "BaseHandler");
      expect(handler).toBeDefined();
      expect(handler!.kind).toBe("class");
      expect(handler!.exported).toBe(true);
    });

    it("non-exported const (non-function) is not tracked", () => {
      const decl = lexicalDeclaration("const", [
        variableDeclarator("internal"),
      ]);
      const root = program(decl);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const internal = result.symbols.find((s) => s.name === "internal");
      expect(internal).toBeUndefined();
    });

    it("async arrow function is detected as function", () => {
      const arrow = arrowFunction("(id: string)", {
        returnType: "Promise<User>",
        isAsync: true,
      });
      const decl = lexicalDeclaration("const", [
        variableDeclarator("fetchUser", arrow),
      ]);
      const root = program(exportStatement(decl));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const fetchUser = result.symbols.find((s) => s.name === "fetchUser");
      expect(fetchUser).toBeDefined();
      expect(fetchUser!.kind).toBe("function");
      expect(fetchUser!.signature).toContain("async");
    });

    it("JSDoc comment is extracted as documentation", () => {
      const doc = jsDocComment("Greets a user by name", 0);
      const fn = functionDeclaration("greet", {
        params: "(name: string)",
        returnType: "string",
        startRow: 1,
        doc,
      });
      const root = program(exportStatement(fn));
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const greet = result.symbols.find((s) => s.name === "greet");
      expect(greet).toBeDefined();
      expect(greet!.documentation).toContain("Greets a user by name");
    });

    it("line numbers are 1-based", () => {
      const fn1 = functionDeclaration("first", { startRow: 0 });
      const fn2 = functionDeclaration("second", { startRow: 1 });
      const fn3 = functionDeclaration("third", { startRow: 2 });
      const root = program(fn1, fn2, fn3);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      const first = result.symbols.find((s) => s.name === "first");
      const second = result.symbols.find((s) => s.name === "second");
      const third = result.symbols.find((s) => s.name === "third");
      expect(first!.startLine).toBe(1);
      expect(second!.startLine).toBe(2);
      expect(third!.startLine).toBe(3);
    });

    it("filePath is passed through to all symbols", () => {
      const fn = functionDeclaration("test");
      const root = program(exportStatement(fn));
      const customPath = "/my/custom/path.ts";
      const result = extractTypeScriptSymbols(
        root as unknown as import("web-tree-sitter").Node,
        customPath,
        "",
      );

      expect(result.symbols[0].filePath).toBe(customPath);
    });

    it("expression_statement is intentionally ignored", () => {
      const expr = createNode({
        type: "expression_statement",
        namedChildren: [],
      });
      const root = program(expr);
      const result = extractTypeScriptSymbols(root as unknown as import("web-tree-sitter").Node, FILE, "");

      expect(result.symbols).toEqual([]);
    });
  });
});
