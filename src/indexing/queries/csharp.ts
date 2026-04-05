/**
 * C# symbol extractor for TreeSitterEngine
 *
 * Extracts classes, methods, properties, namespaces, interfaces,
 * and using directives from C# source files using tree-sitter AST nodes.
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
 * Check if a C# declaration has a public modifier.
 */
function isPublic(node: Node): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (!child) continue;

    // Check modifier list
    if (child.type === "modifier" && child.text === "public") return true;

    // Some tree-sitter grammars place modifiers directly as children
    if (child.text === "public") return true;
  }

  return false;
}

/**
 * Extract XML doc comment preceding a node.
 * C# doc comments are /// lines preceding a declaration.
 */
function extractCsharpDoc(node: Node, _source: string): string | undefined {
  const prev = node.previousNamedSibling;
  if (!prev) return undefined;

  if (prev.type === "comment") {
    const text = prev.text;

    // XML doc comment: ///
    if (text.startsWith("///")) {
      return text.slice(3).trim() || undefined;
    }

    // Block comment: /* ... */
    if (text.startsWith("/*")) {
      const inner = text.slice(2, -2).trim();
      const lines = inner.split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim());
      return lines.find((l) => l.length > 0) ?? undefined;
    }
  }

  return undefined;
}

/**
 * Build a method signature string from a method_declaration node.
 */
function buildMethodSignature(node: Node): string | undefined {
  const name = getFieldText(node, "name");
  if (!name) return undefined;

  const returnType = getFieldText(node, "type") ?? getFieldText(node, "return_type") ?? "void";
  const params = node.childForFieldName("parameters");
  const paramStr = params?.text ?? "()";

  return `${returnType} ${name}${paramStr}`;
}

/**
 * Extract members from a class/interface body.
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

    // Methods
    if (child.type === "method_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const sig = buildMethodSignature(child);
      const doc = extractCsharpDoc(child, source);
      const exported = isPublic(child);

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

    // Properties
    if (child.type === "property_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const typeNode = child.childForFieldName("type");
      const exported = isPublic(child);

      members.push({
        name,
        kind: "variable",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        parentName,
        signature: `${typeNode?.text ?? "object"} ${name}`,
        documentation: extractCsharpDoc(child, source),
      });
    }

    // Constructor
    if (child.type === "constructor_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const params = child.childForFieldName("parameters");
      const exported = isPublic(child);

      members.push({
        name,
        kind: "method",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        parentName,
        signature: `${name}${params?.text ?? "()"}`,
        documentation: extractCsharpDoc(child, source),
      });
    }
  }

  return members;
}

/**
 * Extract symbols and imports from a C# source file AST.
 */
export function extractCsharpSymbols(
  rootNode: Node,
  filePath: string,
  source: string,
): { symbols: ParsedSymbol[]; imports: ImportInfo[]; exports: string[] } {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exportNames: string[] = [];

  function processNode(node: Node, parentNamespace?: string): void {
    switch (node.type) {
      // --- using directives ---
      case "using_directive": {
        // using System.Collections.Generic;
        // using directive's child is often a qualified_name or identifier
        let nameNode: Node | null = null;
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child && child.type !== "using") {
            nameNode = child;
            break;
          }
        }

        if (nameNode) {
          imports.push({
            source: nameNode.text,
            specifiers: [],
            isDefault: false,
            isNamespace: true,
            line: node.startPosition.row + 1,
          });
        }
        break;
      }

      // --- Namespace declaration ---
      case "namespace_declaration": {
        const nameNode = node.childForFieldName("name");
        const namespaceName = nameNode?.text;
        const fullNs = parentNamespace && namespaceName
          ? `${parentNamespace}.${namespaceName}`
          : (namespaceName ?? parentNamespace);

        if (namespaceName) {
          symbols.push({
            name: namespaceName,
            kind: "type",
            filePath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            exported: true,
            signature: `namespace ${namespaceName}`,
            parentName: parentNamespace,
            documentation: extractCsharpDoc(node, source),
          });
        }

        // Recurse into namespace body
        const body = node.childForFieldName("body");
        if (body) {
          for (let i = 0; i < body.namedChildCount; i++) {
            const child = body.namedChild(i);
            if (child) processNode(child, fullNs);
          }
        }
        break;
      }

      // --- Class declaration ---
      case "class_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const exported = isPublic(node);
        const doc = extractCsharpDoc(node, source);

        // Detect base classes / interfaces
        const baseList = node.childForFieldName("base_list");
        const sig = baseList
          ? `class ${name} : ${baseList.text.replace(/^:\s*/, "")}`
          : `class ${name}`;

        symbols.push({
          name,
          kind: "class",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName: parentNamespace,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        // Extract members
        const body = node.childForFieldName("body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Interface declaration ---
      case "interface_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const exported = isPublic(node);
        const doc = extractCsharpDoc(node, source);

        const baseList = node.childForFieldName("base_list");
        const sig = baseList
          ? `interface ${name} : ${baseList.text.replace(/^:\s*/, "")}`
          : `interface ${name}`;

        symbols.push({
          name,
          kind: "interface",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName: parentNamespace,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        // Extract interface members
        const body = node.childForFieldName("body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Method declaration (top-level, outside class) ---
      case "method_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const sig = buildMethodSignature(node);
        const exported = isPublic(node);

        symbols.push({
          name,
          kind: "function",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: sig,
          parentName: parentNamespace,
          documentation: extractCsharpDoc(node, source),
        });

        if (exported) exportNames.push(name);
        break;
      }

      // --- Enum declaration ---
      case "enum_declaration": {
        const name = getFieldText(node, "name");
        if (!name) break;

        const exported = isPublic(node);

        symbols.push({
          name,
          kind: "enum",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported,
          signature: `enum ${name}`,
          parentName: parentNamespace,
          documentation: extractCsharpDoc(node, source),
        });

        if (exported) exportNames.push(name);
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
