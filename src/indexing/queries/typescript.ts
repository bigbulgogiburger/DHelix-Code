/**
 * TypeScript/JavaScript AST-based symbol extractor for TreeSitterEngine
 *
 * Walks web-tree-sitter AST nodes to extract symbols, imports, and exports
 * from TypeScript/JavaScript source files. Unlike the regex-based approach
 * in repo-map.ts, this produces richer metadata (signatures, docs, ranges).
 */

import type { Node } from "web-tree-sitter";

// ── Public types ──────────────────────────────────────────────────────────

export interface ParsedSymbol {
  readonly name: string;
  readonly kind: "class" | "function" | "interface" | "type" | "const" | "enum" | "method";
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exported: boolean;
  readonly signature?: string;
  readonly parentName?: string;
  readonly documentation?: string;
}

export interface ImportInfo {
  readonly source: string;
  readonly specifiers: readonly string[];
  readonly isDefault: boolean;
  readonly isNamespace: boolean;
  readonly line: number;
}

export interface ExtractionResult {
  readonly symbols: readonly ParsedSymbol[];
  readonly imports: readonly ImportInfo[];
  readonly exports: readonly string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract the leading doc-comment (JSDoc or line comments) immediately
 * preceding a declaration node. Returns the first summary line.
 */
function extractDocComment(node: Node, _source: string): string | undefined {
  const prev = node.previousNamedSibling;
  if (!prev || prev.type !== "comment") return undefined;

  const text = prev.text;

  // JSDoc: /** ... */
  if (text.startsWith("/**")) {
    // Grab content between /** and */
    const inner = text.slice(3, -2).trim();
    // Take first meaningful line (skip empty, @-tag lines)
    const lines = inner.split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim());
    const summary = lines.find((l) => l.length > 0 && !l.startsWith("@"));
    return summary || undefined;
  }

  // Single-line comment: // ...
  if (text.startsWith("//")) {
    return text.slice(2).trim() || undefined;
  }

  return undefined;
}

/**
 * Build a human-readable function signature from formal_parameters + return type.
 * Example output: "(name: string, age: number): User"
 */
function extractFunctionSignature(node: Node): string | undefined {
  const params = node.childForFieldName("parameters");
  if (!params) return undefined;

  const returnType = node.childForFieldName("return_type");
  const paramText = params.text;
  const retText = returnType ? `: ${returnType.text.replace(/^:\s*/, "")}` : "";
  return `${paramText}${retText}`;
}

/**
 * Extract the name text from a node's "name" field, if present.
 */
function nameOf(node: Node): string | undefined {
  const n = node.childForFieldName("name");
  return n?.text;
}

/**
 * Check whether a node is an arrow function or function expression.
 */
function isFunctionValue(node: Node): boolean {
  return (
    node.type === "arrow_function" ||
    node.type === "function_expression" ||
    node.type === "function"
  );
}

/**
 * Find the variable_declarator's value node.
 */
function declaratorValue(declarator: Node): Node | undefined {
  return declarator.childForFieldName("value") ?? undefined;
}

/**
 * Build signature for an arrow function / function expression assigned to a const.
 */
function extractArrowSignature(valueNode: Node): string | undefined {
  const params = valueNode.childForFieldName("parameters");
  if (!params) return undefined;

  const returnType = valueNode.childForFieldName("return_type");
  const paramText = params.text;
  const retText = returnType ? `: ${returnType.text.replace(/^:\s*/, "")}` : "";
  return `${paramText}${retText}`;
}

// ── Main extractor ────────────────────────────────────────────────────────

export function extractTypeScriptSymbols(
  rootNode: Node,
  filePath: string,
  source: string,
): ExtractionResult {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exports: string[] = [];

  for (const node of rootNode.namedChildren) {
    processTopLevel(node, false);
  }

  return { symbols, imports, exports };

  // ── Top-level dispatcher ──────────────────────────────────────────────

  function processTopLevel(node: Node, isExported: boolean): void {
    switch (node.type) {
      // ── export statement wrapper ────────────────────────────────────
      case "export_statement": {
        handleExportStatement(node);
        break;
      }

      // ── export default ──────────────────────────────────────────────
      case "export_default_declaration": {
        // e.g. export default class Foo {}
        for (const child of node.namedChildren) {
          processTopLevel(child, true);
        }
        exports.push("default");
        break;
      }

      // ── function / generator ────────────────────────────────────────
      case "function_declaration":
      case "generator_function_declaration": {
        handleFunctionDeclaration(node, isExported);
        break;
      }

      // ── class / abstract class ──────────────────────────────────────
      case "class_declaration":
      case "abstract_class_declaration": {
        handleClassDeclaration(node, isExported);
        break;
      }

      // ── interface ───────────────────────────────────────────────────
      case "interface_declaration": {
        handleInterfaceDeclaration(node, isExported);
        break;
      }

      // ── type alias ──────────────────────────────────────────────────
      case "type_alias_declaration": {
        handleTypeAlias(node, isExported);
        break;
      }

      // ── enum ────────────────────────────────────────────────────────
      case "enum_declaration": {
        handleEnumDeclaration(node, isExported);
        break;
      }

      // ── const / let / var ───────────────────────────────────────────
      case "lexical_declaration": {
        handleLexicalDeclaration(node, isExported);
        break;
      }

      // ── import ──────────────────────────────────────────────────────
      case "import_statement": {
        handleImportStatement(node);
        break;
      }

      // ── expression_statement (for module.exports, etc.) ─────────────
      case "expression_statement": {
        // Intentionally ignored — CJS patterns out of scope for ESM
        break;
      }

      default:
        break;
    }
  }

  // ── Export statement ─────────────────────────────────────────────────

  function handleExportStatement(node: Node): void {
    // Check for source clause → re-export: export { X } from "..."
    const sourceNode = node.childForFieldName("source");

    if (sourceNode) {
      // Re-export: export { Foo, Bar } from "./module"
      const reExportSource = stripQuotes(sourceNode.text);
      const exportClause = findChild(node, "export_clause");
      if (exportClause) {
        for (const spec of exportClause.namedChildren) {
          if (spec.type === "export_specifier") {
            const exportedName =
              spec.childForFieldName("alias")?.text ??
              spec.childForFieldName("name")?.text ??
              spec.text;
            exports.push(exportedName);
          }
        }
      }
      // Also store as import for dependency tracking
      imports.push({
        source: reExportSource,
        specifiers: [],
        isDefault: false,
        isNamespace: false,
        line: node.startPosition.row + 1,
      });
      return;
    }

    // export { X, Y } (no source → local re-exports)
    const exportClause = findChild(node, "export_clause");
    if (exportClause) {
      for (const spec of exportClause.namedChildren) {
        if (spec.type === "export_specifier") {
          const exportedName =
            spec.childForFieldName("alias")?.text ??
            spec.childForFieldName("name")?.text ??
            spec.text;
          exports.push(exportedName);
        }
      }
      return;
    }

    // export <declaration> — delegate to inner declaration
    for (const child of node.namedChildren) {
      if (child.type === "export_clause") continue;
      processTopLevel(child, true);
    }

    // Track the exported name for the declaration child
    const declaration = node.namedChildren.find(
      (c) => c.type !== "export_clause" && c.type !== "string" && c.type !== "comment",
    );
    if (declaration) {
      const declName = nameOf(declaration);
      if (declName) {
        exports.push(declName);
      } else if (declaration.type === "lexical_declaration") {
        // const X = ... → extract each declarator name
        for (const declarator of declaration.namedChildren) {
          if (declarator.type === "variable_declarator") {
            const varName = nameOf(declarator);
            if (varName) exports.push(varName);
          }
        }
      }
    }
  }

  // ── Functions ───────────────────────────────────────────────────────

  function handleFunctionDeclaration(node: Node, isExported: boolean): void {
    const name = nameOf(node);
    if (!name) return;

    const isAsync = node.children.some((c) => c.type === "async");
    const sig = extractFunctionSignature(node);
    const prefix = isAsync ? "async " : "";

    symbols.push({
      name,
      kind: "function",
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      exported: isExported,
      signature: sig ? `${prefix}${sig}` : undefined,
      documentation: extractDocComment(node, source),
    });
  }

  // ── Classes ─────────────────────────────────────────────────────────

  function handleClassDeclaration(node: Node, isExported: boolean): void {
    const name = nameOf(node);
    if (!name) return;

    // Detect superclass: class Foo extends Bar
    const heritage = findChild(node, "class_heritage");
    const superclass = heritage?.namedChildren[0]?.text;
    const sig = superclass ? `extends ${superclass}` : undefined;

    symbols.push({
      name,
      kind: "class",
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      exported: isExported,
      signature: sig,
      documentation: extractDocComment(node, source),
    });

    // Extract methods from class body
    const body = findChild(node, "class_body");
    if (body) {
      extractClassMembers(body, name, isExported);
    }
  }

  function extractClassMembers(body: Node, className: string, classExported: boolean): void {
    for (const member of body.namedChildren) {
      switch (member.type) {
        case "method_definition":
        case "public_field_definition": {
          handleMethodDefinition(member, className, classExported);
          break;
        }
        default:
          break;
      }
    }
  }

  function handleMethodDefinition(node: Node, className: string, classExported: boolean): void {
    const name = nameOf(node);
    if (!name) return;

    // Detect method kind: constructor, get, set, or regular
    const isGetter = node.children.some((c) => c.type === "get");
    const isSetter = node.children.some((c) => c.type === "set");
    const isStatic = node.children.some((c) => c.type === "static");
    const isAsync = node.children.some((c) => c.type === "async");

    let prefix = "";
    if (isStatic) prefix += "static ";
    if (isAsync) prefix += "async ";
    if (isGetter) prefix += "get ";
    if (isSetter) prefix += "set ";

    const sig = extractFunctionSignature(node);

    symbols.push({
      name,
      kind: "method",
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      exported: classExported,
      parentName: className,
      signature: sig ? `${prefix}${sig}` : undefined,
      documentation: extractDocComment(node, source),
    });
  }

  // ── Interfaces ──────────────────────────────────────────────────────

  function handleInterfaceDeclaration(node: Node, isExported: boolean): void {
    const name = nameOf(node);
    if (!name) return;

    // Detect extends clause
    const extendsClause = findChild(node, "extends_type_clause");
    const sig = extendsClause ? extendsClause.text : undefined;

    symbols.push({
      name,
      kind: "interface",
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      exported: isExported,
      signature: sig,
      documentation: extractDocComment(node, source),
    });
  }

  // ── Type aliases ────────────────────────────────────────────────────

  function handleTypeAlias(node: Node, isExported: boolean): void {
    const name = nameOf(node);
    if (!name) return;

    // Include type parameters if present: type Foo<T> = ...
    const typeParams = findChild(node, "type_parameters");
    const sig = typeParams ? typeParams.text : undefined;

    symbols.push({
      name,
      kind: "type",
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      exported: isExported,
      signature: sig,
      documentation: extractDocComment(node, source),
    });
  }

  // ── Enums ───────────────────────────────────────────────────────────

  function handleEnumDeclaration(node: Node, isExported: boolean): void {
    const name = nameOf(node);
    if (!name) return;

    const isConst = node.children.some((c) => c.type === "const");

    symbols.push({
      name,
      kind: "enum",
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      exported: isExported,
      signature: isConst ? "const" : undefined,
      documentation: extractDocComment(node, source),
    });
  }

  // ── Lexical declarations (const/let/var) ────────────────────────────

  function handleLexicalDeclaration(node: Node, isExported: boolean): void {
    // Only process const declarations at top level
    const kindNode = node.children.find(
      (c) => c.type === "const" || c.type === "let" || c.type === "var",
    );
    const isConst = kindNode?.type === "const";

    for (const declarator of node.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;

      const name = nameOf(declarator);
      if (!name) continue;

      const value = declaratorValue(declarator);

      // Arrow function or function expression → treat as function
      if (value && isFunctionValue(value)) {
        const isAsync = value.children.some((c) => c.type === "async");
        const sig = extractArrowSignature(value);
        const prefix = isAsync ? "async " : "";

        symbols.push({
          name,
          kind: "function",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: isExported,
          signature: sig ? `${prefix}${sig}` : undefined,
          documentation: extractDocComment(node, source),
        });
      } else if (isConst) {
        // Regular const (not a function) — only track if exported
        if (!isExported) continue;

        // Extract type annotation if present
        const typeAnnotation = declarator.childForFieldName("type");
        const sig = typeAnnotation ? typeAnnotation.text.replace(/^:\s*/, "") : undefined;

        symbols.push({
          name,
          kind: "const",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: isExported,
          signature: sig,
          documentation: extractDocComment(node, source),
        });
      }
    }
  }

  // ── Imports ─────────────────────────────────────────────────────────

  function handleImportStatement(node: Node): void {
    const sourceNode = node.childForFieldName("source");
    if (!sourceNode) return;

    const importSource = stripQuotes(sourceNode.text);
    const specifiers: string[] = [];
    let isDefault = false;
    let isNamespace = false;

    for (const child of node.namedChildren) {
      switch (child.type) {
        // import X from "..."
        case "identifier": {
          isDefault = true;
          specifiers.push(child.text);
          break;
        }

        // import * as X from "..."
        case "namespace_import": {
          isNamespace = true;
          const alias = child.childForFieldName("alias") ?? child.namedChildren[0];
          if (alias) specifiers.push(alias.text);
          break;
        }

        // import { A, B as C } from "..."
        case "named_imports": {
          for (const spec of child.namedChildren) {
            if (spec.type === "import_specifier") {
              const alias = spec.childForFieldName("alias");
              const name = spec.childForFieldName("name");
              specifiers.push(alias?.text ?? name?.text ?? spec.text);
            }
          }
          break;
        }

        default:
          break;
      }
    }

    imports.push({
      source: importSource,
      specifiers,
      isDefault,
      isNamespace,
      line: node.startPosition.row + 1,
    });
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────

function stripQuotes(text: string): string {
  if (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"'))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function findChild(node: Node, type: string): Node | undefined {
  return node.namedChildren.find((c) => c.type === type);
}
