/**
 * Python symbol extractor for TreeSitterEngine
 *
 * Extracts functions, classes, methods, imports, and variables from Python
 * source files using tree-sitter AST nodes.
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
 * Extract the text content of a named child from a tree-sitter node.
 */
function getChildText(node: Node, fieldName: string): string | undefined {
  const child = node.childForFieldName(fieldName);
  return child?.text;
}

/**
 * Extract documentation from a function or class body.
 * Python docstrings are the first expression_statement containing a string
 * in the body block.
 */
function extractDocstring(bodyNode: Node | null): string | undefined {
  if (!bodyNode) return undefined;

  for (let i = 0; i < bodyNode.namedChildCount; i++) {
    const child = bodyNode.namedChild(i);
    if (!child) continue;

    if (child.type === "expression_statement") {
      const expr = child.namedChild(0);
      if (expr && (expr.type === "string" || expr.type === "concatenated_string")) {
        // Strip triple-quote markers
        const raw = expr.text;
        return raw.replace(/^("""|''')\s*/, "").replace(/\s*("""|''')$/, "").trim();
      }
      // First non-docstring statement means no docstring
      return undefined;
    }
    // Comments or pass statements before docstring are allowed
    if (child.type !== "comment" && child.type !== "pass_statement") {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Extract decorator names from a decorated definition.
 */
function extractDecorators(node: Node): string[] {
  const decorators: string[] = [];

  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === "decorator") {
      // Decorator text includes "@", strip it
      const text = child.text.replace(/^@/, "").trim();
      // Take just the name part (before any parentheses)
      const name = text.split("(")[0].trim();
      decorators.push(name);
    }
  }

  return decorators;
}

/**
 * Build a function signature string from a function_definition node.
 */
function buildFunctionSignature(node: Node): string {
  const name = getChildText(node, "name") ?? "?";
  const params = getChildText(node, "parameters") ?? "()";
  const returnType = node.childForFieldName("return_type");
  const returnStr = returnType ? ` -> ${returnType.text}` : "";
  return `def ${name}${params}${returnStr}`;
}

/**
 * Extract __all__ list items from the module to determine explicit exports.
 */
function extractAllList(rootNode: Node, _source: string): Set<string> | null {
  const allNames = new Set<string>();
  let found = false;

  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const child = rootNode.namedChild(i);
    if (!child) continue;

    // Look for: __all__ = [...]
    if (child.type === "expression_statement") {
      const assignment = child.namedChild(0);
      if (assignment?.type === "assignment") {
        const left = assignment.childForFieldName("left");
        if (left?.text === "__all__") {
          found = true;
          const right = assignment.childForFieldName("right");
          if (right?.type === "list") {
            for (let j = 0; j < right.namedChildCount; j++) {
              const item = right.namedChild(j);
              if (item?.type === "string") {
                // Strip quotes
                const val = item.text.replace(/^['"]/, "").replace(/['"]$/, "");
                allNames.add(val);
              }
            }
          }
        }
      }
    }
  }

  return found ? allNames : null;
}

/**
 * Extract methods from a class body.
 */
function extractClassMethods(
  bodyNode: Node,
  className: string,
  filePath: string,
): ParsedSymbol[] {
  const methods: ParsedSymbol[] = [];

  for (let i = 0; i < bodyNode.namedChildCount; i++) {
    const child = bodyNode.namedChild(i);
    if (!child) continue;

    // Handle decorated definitions
    let funcNode: Node | null = null;

    if (child.type === "decorated_definition") {
      extractDecorators(child);
      for (let j = 0; j < child.namedChildCount; j++) {
        const inner = child.namedChild(j);
        if (inner?.type === "function_definition") {
          funcNode = inner;
          break;
        }
      }
    } else if (child.type === "function_definition") {
      funcNode = child;
    }

    if (!funcNode) continue;

    const name = getChildText(funcNode, "name");
    if (!name) continue;

    const body = funcNode.childForFieldName("body");
    const doc = extractDocstring(body ?? null);
    const sig = buildFunctionSignature(funcNode);

    methods.push({
      name,
      kind: "method",
      filePath,
      startLine: funcNode.startPosition.row + 1,
      endLine: funcNode.endPosition.row + 1,
      exported: true, // methods inherit class visibility
      signature: sig,
      parentName: className,
      documentation: doc,
    });
  }

  return methods;
}

/**
 * Extract symbols and imports from a Python source file AST.
 */
export function extractPythonSymbols(
  rootNode: Node,
  filePath: string,
  source: string,
): { symbols: ParsedSymbol[]; imports: ImportInfo[]; exports: string[] } {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exportNames: string[] = [];

  // Check for __all__ to determine explicit exports
  const allList = extractAllList(rootNode, source);

  function isExported(name: string): boolean {
    if (allList) {
      return allList.has(name);
    }
    // Python convention: everything is public unless prefixed with _
    return !name.startsWith("_");
  }

  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const child = rootNode.namedChild(i);
    if (!child) continue;

    // --- Imports ---
    if (child.type === "import_statement") {
      // import os, sys
      for (let j = 0; j < child.namedChildCount; j++) {
        const nameNode = child.namedChild(j);
        if (!nameNode) continue;

        if (nameNode.type === "dotted_name" || nameNode.type === "aliased_import") {
          const moduleName = nameNode.type === "aliased_import"
            ? (nameNode.childForFieldName("name")?.text ?? nameNode.text)
            : nameNode.text;
          const alias = nameNode.type === "aliased_import"
            ? (nameNode.childForFieldName("alias")?.text ?? moduleName)
            : moduleName;

          imports.push({
            source: moduleName,
            specifiers: [alias],
            isDefault: false,
            isNamespace: true,
            line: child.startPosition.row + 1,
          });
        }
      }
      continue;
    }

    if (child.type === "import_from_statement") {
      // from pathlib import Path, PurePath
      const moduleNode = child.childForFieldName("module_name");
      const moduleName = moduleNode?.text ?? "";

      const specifiers: string[] = [];
      let isNamespace = false;

      for (let j = 0; j < child.namedChildCount; j++) {
        const specNode = child.namedChild(j);
        if (!specNode) continue;

        if (specNode.type === "dotted_name" || specNode.type === "aliased_import") {
          const name = specNode.type === "aliased_import"
            ? (specNode.childForFieldName("alias")?.text ?? specNode.childForFieldName("name")?.text ?? specNode.text)
            : specNode.text;
          // Skip the module name itself
          if (specNode !== moduleNode) {
            specifiers.push(name);
          }
        } else if (specNode.type === "wildcard_import") {
          isNamespace = true;
          specifiers.push("*");
        }
      }

      if (specifiers.length > 0) {
        imports.push({
          source: moduleName,
          specifiers,
          isDefault: false,
          isNamespace,
          line: child.startPosition.row + 1,
        });
      }
      continue;
    }

    // --- Decorated definitions ---
    let targetNode = child;

    if (child.type === "decorated_definition") {
      extractDecorators(child);
      for (let j = 0; j < child.namedChildCount; j++) {
        const inner = child.namedChild(j);
        if (inner && (inner.type === "function_definition" || inner.type === "class_definition")) {
          targetNode = inner;
          break;
        }
      }
    }

    // --- Functions ---
    if (targetNode.type === "function_definition") {
      const name = getChildText(targetNode, "name");
      if (!name) continue;

      const body = targetNode.childForFieldName("body");
      const doc = extractDocstring(body ?? null);
      const sig = buildFunctionSignature(targetNode);
      const exported = isExported(name);

      symbols.push({
        name,
        kind: "function",
        filePath,
        startLine: (child.type === "decorated_definition" ? child : targetNode).startPosition.row + 1,
        endLine: targetNode.endPosition.row + 1,
        exported,
        signature: sig,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Classes ---
    if (targetNode.type === "class_definition") {
      const name = getChildText(targetNode, "name");
      if (!name) continue;

      const body = targetNode.childForFieldName("body");
      const doc = extractDocstring(body ?? null);
      const exported = isExported(name);

      // Build signature with base classes
      const superclasses = targetNode.childForFieldName("superclasses");
      const sig = superclasses
        ? `class ${name}(${superclasses.text})`
        : `class ${name}`;

      symbols.push({
        name,
        kind: "class",
        filePath,
        startLine: (child.type === "decorated_definition" ? child : targetNode).startPosition.row + 1,
        endLine: targetNode.endPosition.row + 1,
        exported,
        signature: sig,
        documentation: doc,
      });

      if (exported) exportNames.push(name);

      // Extract methods
      if (body) {
        const methods = extractClassMethods(body, name, filePath);
        symbols.push(...methods);
      }
      continue;
    }

    // --- Top-level variable assignments with type annotations ---
    if (child.type === "expression_statement") {
      const assignment = child.namedChild(0);
      if (!assignment) continue;

      if (assignment.type === "assignment") {
        const left = assignment.childForFieldName("left");
        const typeNode = assignment.childForFieldName("type");

        if (left?.type === "identifier" && typeNode) {
          const name = left.text;
          const exported = isExported(name);

          // Check if it looks like a constant (ALL_CAPS)
          const isConstant = /^[A-Z][A-Z0-9_]*$/.test(name);

          symbols.push({
            name,
            kind: isConstant ? "constant" : "variable",
            filePath,
            startLine: child.startPosition.row + 1,
            endLine: child.endPosition.row + 1,
            exported,
            signature: `${name}: ${typeNode.text}`,
          });

          if (exported) exportNames.push(name);
        }
      }
    }
  }

  return { symbols, imports, exports: exportNames };
}
