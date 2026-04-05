/**
 * Swift symbol extractor for TreeSitterEngine
 *
 * Extracts functions, classes, structs, protocols, enums, extensions,
 * and imports from Swift source files using tree-sitter AST nodes.
 */

import type { Node } from "web-tree-sitter";

interface ParsedSymbol {
  readonly name: string;
  readonly kind: "function" | "class" | "interface" | "type" | "variable" | "method" | "enum" | "constant";
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exported: boolean;
  readonly signature?: string;
  readonly parentName?: string;
  readonly documentation?: string;
}

interface ImportInfo {
  readonly source: string;
  readonly specifiers: readonly string[];
  readonly isDefault: boolean;
  readonly isNamespace: boolean;
  readonly line: number;
}

/**
 * Get the text of a named field child.
 */
function getFieldText(node: Node, fieldName: string): string | undefined {
  const child = node.childForFieldName(fieldName);
  return child?.text;
}

/**
 * Check if a Swift declaration has a public/open access modifier.
 */
function isSwiftExported(node: Node): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (!child) continue;

    if (child.type === "modifiers" || child.type === "modifier") {
      const text = child.text;
      if (text === "public" || text === "open") return true;
    }

    // Access level modifiers appear before the keyword
    if (child.text === "public" || child.text === "open") return true;
  }

  // Default in Swift: internal (visible within the module), treated as exported
  return true;
}

/**
 * Extract doc comment preceding a Swift declaration.
 * Swift uses triple-slash for single-line doc comments and block doc comments.
 */
function extractSwiftDoc(node: Node, _source: string): string | undefined {
  const prev = node.previousNamedSibling;
  if (!prev) return undefined;

  if (prev.type === "comment" || prev.type === "multiline_comment") {
    const text = prev.text;

    // Block doc: /** ... */
    if (text.startsWith("/**")) {
      const inner = text.slice(3, -2).trim();
      const lines = inner.split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim());
      return lines.find((l) => l.length > 0 && !l.startsWith("-")) ?? undefined;
    }

    // Single line doc: ///
    if (text.startsWith("///")) {
      return text.slice(3).trim() || undefined;
    }

    // Single line: //
    if (text.startsWith("//")) {
      return text.slice(2).trim() || undefined;
    }
  }

  return undefined;
}

/**
 * Build a function signature from a function_declaration node.
 */
function buildSwiftFunctionSignature(node: Node): string | undefined {
  const name = getFieldText(node, "name");
  if (!name) return undefined;

  const params = node.childForFieldName("params");
  const returnType = node.childForFieldName("throws_modifier")
    ? node.childForFieldName("return_type")
    : node.childForFieldName("return_type");

  const paramStr = params?.text ?? "()";
  const returnStr = returnType ? ` -> ${returnType.text}` : "";

  return `func ${name}${paramStr}${returnStr}`;
}

/**
 * Extract members from a class/struct/enum/protocol body.
 */
function extractTypeMembers(
  bodyNode: Node,
  parentName: string,
  filePath: string,
  source: string,
): ParsedSymbol[] {
  const members: ParsedSymbol[] = [];

  for (let i = 0; i < bodyNode.namedChildCount; i++) {
    const child = bodyNode.namedChild(i);
    if (!child) continue;

    // Function / method
    if (child.type === "function_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const sig = buildSwiftFunctionSignature(child);
      const doc = extractSwiftDoc(child, source);
      const exported = isSwiftExported(child);

      members.push({
        name,
        kind: "method",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        parentName,
        signature: sig,
        documentation: doc,
      });
    }

    // Computed/stored properties
    if (child.type === "variable_declaration" || child.type === "property_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const typeNode = child.childForFieldName("type");
      const exported = isSwiftExported(child);

      members.push({
        name,
        kind: "variable",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        parentName,
        signature: typeNode ? `${name}: ${typeNode.text}` : name,
        documentation: extractSwiftDoc(child, source),
      });
    }

    // Initializer
    if (child.type === "init_declaration") {
      const params = child.childForFieldName("params");
      const exported = isSwiftExported(child);

      members.push({
        name: "init",
        kind: "method",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        parentName,
        signature: `init${params?.text ?? "()"}`,
        documentation: extractSwiftDoc(child, source),
      });
    }
  }

  return members;
}

/**
 * Extract symbols and imports from a Swift source file AST.
 */
export function extractSwiftSymbols(
  rootNode: Node,
  filePath: string,
  source: string,
): { symbols: ParsedSymbol[]; imports: ImportInfo[]; exports: string[] } {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exportNames: string[] = [];

  function processNode(node: Node, parentName?: string): void {
    switch (node.type) {
      // --- import declaration ---
      case "import_declaration": {
        // import UIKit / import Foundation
        let moduleName = "";
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child && child.type !== "import") {
            moduleName = child.text;
            break;
          }
        }

        if (moduleName) {
          imports.push({
            source: moduleName,
            specifiers: [],
            isDefault: false,
            isNamespace: true,
            line: node.startPosition.row + 1,
          });
        }
        break;
      }

      // --- Function declaration (top-level or inside extension) ---
      case "function_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const sig = buildSwiftFunctionSignature(node);
        const doc = extractSwiftDoc(node, source);
        const exported = isSwiftExported(node);

        symbols.push({
          name,
          kind: parentName ? "method" : "function",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName,
          documentation: doc,
        });

        if (exported) exportNames.push(name);
        break;
      }

      // --- Class declaration ---
      case "class_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const exported = isSwiftExported(node);
        const doc = extractSwiftDoc(node, source);

        // Detect superclass / conformances
        const typeInheritance = node.childForFieldName("type_inheritance_clause");
        const sig = typeInheritance
          ? `class ${name}: ${typeInheritance.text.replace(/^:\s*/, "")}`
          : `class ${name}`;

        symbols.push({
          name,
          kind: "class",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        const body = node.childForFieldName("body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Struct declaration ---
      case "struct_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const exported = isSwiftExported(node);
        const doc = extractSwiftDoc(node, source);

        const typeInheritance = node.childForFieldName("type_inheritance_clause");
        const sig = typeInheritance
          ? `struct ${name}: ${typeInheritance.text.replace(/^:\s*/, "")}`
          : `struct ${name}`;

        symbols.push({
          name,
          kind: "class", // Swift structs map to "class" kind
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        const body = node.childForFieldName("body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Protocol declaration ---
      case "protocol_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const exported = isSwiftExported(node);
        const doc = extractSwiftDoc(node, source);

        const typeInheritance = node.childForFieldName("type_inheritance_clause");
        const sig = typeInheritance
          ? `protocol ${name}: ${typeInheritance.text.replace(/^:\s*/, "")}`
          : `protocol ${name}`;

        symbols.push({
          name,
          kind: "interface", // Protocols map to "interface" kind
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        const body = node.childForFieldName("body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Enum declaration ---
      case "enum_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const exported = isSwiftExported(node);
        const doc = extractSwiftDoc(node, source);

        const typeInheritance = node.childForFieldName("type_inheritance_clause");
        const sig = typeInheritance
          ? `enum ${name}: ${typeInheritance.text.replace(/^:\s*/, "")}`
          : `enum ${name}`;

        symbols.push({
          name,
          kind: "enum",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        const body = node.childForFieldName("body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Extension declaration ---
      case "extension_declaration": {
        // Extensions don't introduce new names but may add methods
        const extendedType = node.childForFieldName("type");
        const extName = extendedType?.text;

        const body = node.childForFieldName("body");
        if (body && extName) {
          const members = extractTypeMembers(body, extName, filePath, source);
          // Mark extension members with parentName set to extended type
          symbols.push(...members);
        }
        break;
      }

      default:
        break;
    }
  }

  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const child = rootNode.namedChild(i);
    if (child) processNode(child);
  }

  return { symbols, imports, exports: exportNames };
}
