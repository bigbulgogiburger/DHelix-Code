/**
 * Go symbol extractor for TreeSitterEngine
 *
 * Extracts functions, methods, structs, interfaces, types, constants,
 * variables, and imports from Go source files using tree-sitter AST nodes.
 */

import type { Node } from "web-tree-sitter";

interface ParsedSymbol {
  readonly name: string;
  readonly kind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "variable"
    | "method"
    | "enum"
    | "constant";
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
 * Check if a Go identifier is exported (starts with uppercase).
 */
function isGoExported(name: string): boolean {
  return name.length > 0 && name[0] >= "A" && name[0] <= "Z";
}

/**
 * Extract doc comments preceding a node.
 * Go doc comments are consecutive // or /* comments immediately before a declaration.
 */
function extractGoDoc(node: Node, _source: string): string | undefined {
  const comments: string[] = [];
  let prev = node.previousNamedSibling;

  while (prev && prev.type === "comment") {
    comments.unshift(prev.text);
    prev = prev.previousNamedSibling;
  }

  if (comments.length === 0) return undefined;

  return (
    comments
      .map((c) => {
        if (c.startsWith("//")) return c.slice(2).trim();
        if (c.startsWith("/*") && c.endsWith("*/")) return c.slice(2, -2).trim();
        return c.trim();
      })
      .join("\n")
      .trim() || undefined
  );
}

/**
 * Build function signature from a function_declaration or method_declaration.
 */
function buildFuncSignature(node: Node): string {
  const name = getFieldText(node, "name") ?? "?";
  const params = getFieldText(node, "parameters") ?? "()";
  const result = getFieldText(node, "result");
  const resultStr = result ? ` ${result}` : "";

  if (node.type === "method_declaration") {
    const receiver = node.childForFieldName("receiver");
    const receiverStr = receiver ? receiver.text : "";
    return `func ${receiverStr} ${name}${params}${resultStr}`;
  }

  return `func ${name}${params}${resultStr}`;
}

/**
 * Extract the receiver type name from a method_declaration.
 */
function extractReceiverType(node: Node): string | undefined {
  const receiver = node.childForFieldName("receiver");
  if (!receiver) return undefined;

  // Receiver is a parameter_list like (r *Router) or (r Router)
  // Find the type inside it
  for (let i = 0; i < receiver.namedChildCount; i++) {
    const param = receiver.namedChild(i);
    if (!param) continue;

    const typeNode = param.childForFieldName("type");
    if (typeNode) {
      // Strip pointer (*) prefix
      const text = typeNode.text.replace(/^\*/, "");
      return text;
    }
  }

  return undefined;
}

/**
 * Process type_declaration nodes which can contain struct, interface, or other types.
 */
function processTypeSpec(
  specNode: Node,
  parentNode: Node,
  filePath: string,
  source: string,
): ParsedSymbol | undefined {
  const name = getFieldText(specNode, "name");
  if (!name) return undefined;

  const typeNode = specNode.childForFieldName("type");
  if (!typeNode) return undefined;

  const doc = extractGoDoc(parentNode, source);
  const exported = isGoExported(name);

  let kind: ParsedSymbol["kind"];
  let signature: string;

  switch (typeNode.type) {
    case "struct_type":
      kind = "class"; // Go structs map to "class" kind
      signature = `type ${name} struct`;
      break;
    case "interface_type":
      kind = "interface";
      signature = `type ${name} interface`;
      break;
    default:
      kind = "type";
      signature = `type ${name} ${typeNode.text}`;
      break;
  }

  return {
    name,
    kind,
    filePath,
    startLine: parentNode.startPosition.row + 1,
    endLine: parentNode.endPosition.row + 1,
    exported,
    signature,
    documentation: doc,
  };
}

/**
 * Extract constants or variables from a const/var declaration block.
 */
function extractConstVarSpecs(
  node: Node,
  kind: "constant" | "variable",
  filePath: string,
  source: string,
): ParsedSymbol[] {
  const results: ParsedSymbol[] = [];
  const doc = extractGoDoc(node, source);

  for (let i = 0; i < node.namedChildCount; i++) {
    const spec = node.namedChild(i);
    if (!spec) continue;

    // const_spec or var_spec
    if (spec.type === "const_spec" || spec.type === "var_spec") {
      const nameNode = spec.childForFieldName("name");
      if (!nameNode) continue;

      const name = nameNode.text;
      const typeNode = spec.childForFieldName("type");

      let sig = kind === "constant" ? `const ${name}` : `var ${name}`;
      if (typeNode) sig += ` ${typeNode.text}`;

      results.push({
        name,
        kind,
        filePath,
        startLine: spec.startPosition.row + 1,
        endLine: spec.endPosition.row + 1,
        exported: isGoExported(name),
        signature: sig,
        documentation: doc,
      });
    }
  }

  return results;
}

/**
 * Extract symbols and imports from a Go source file AST.
 */
export function extractGoSymbols(
  rootNode: Node,
  filePath: string,
  source: string,
): { symbols: ParsedSymbol[]; imports: ImportInfo[]; exports: string[] } {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exportNames: string[] = [];

  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const child = rootNode.namedChild(i);
    if (!child) continue;

    // --- Imports ---
    if (child.type === "import_declaration") {
      for (let j = 0; j < child.namedChildCount; j++) {
        const spec = child.namedChild(j);
        if (!spec) continue;

        if (spec.type === "import_spec") {
          const pathNode = spec.childForFieldName("path");
          if (!pathNode) continue;

          // Strip quotes from import path
          const importPath = pathNode.text.replace(/^"/, "").replace(/"$/, "");
          const nameNode = spec.childForFieldName("name");

          let specifierName: string;
          let isNamespace = false;

          if (nameNode) {
            if (nameNode.text === ".") {
              // Dot import: import . "pkg" — all exported names available
              isNamespace = true;
              specifierName = ".";
            } else if (nameNode.text === "_") {
              // Blank import: import _ "pkg" — side effects only
              specifierName = "_";
            } else {
              // Aliased import
              specifierName = nameNode.text;
            }
          } else {
            // Default: last segment of path
            const segments = importPath.split("/");
            specifierName = segments[segments.length - 1];
          }

          imports.push({
            source: importPath,
            specifiers: [specifierName],
            isDefault: false,
            isNamespace,
            line: spec.startPosition.row + 1,
          });
        } else if (spec.type === "import_spec_list") {
          // Grouped imports: import ( ... )
          for (let k = 0; k < spec.namedChildCount; k++) {
            const innerSpec = spec.namedChild(k);
            if (innerSpec?.type !== "import_spec") continue;

            const pathNode = innerSpec.childForFieldName("path");
            if (!pathNode) continue;

            const importPath = pathNode.text.replace(/^"/, "").replace(/"$/, "");
            const nameNode = innerSpec.childForFieldName("name");

            let specifierName: string;
            let isNamespace = false;

            if (nameNode) {
              if (nameNode.text === ".") {
                isNamespace = true;
                specifierName = ".";
              } else if (nameNode.text === "_") {
                specifierName = "_";
              } else {
                specifierName = nameNode.text;
              }
            } else {
              const segments = importPath.split("/");
              specifierName = segments[segments.length - 1];
            }

            imports.push({
              source: importPath,
              specifiers: [specifierName],
              isDefault: false,
              isNamespace,
              line: innerSpec.startPosition.row + 1,
            });
          }
        }
      }
      continue;
    }

    // --- Functions ---
    if (child.type === "function_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractGoDoc(child, source);
      const sig = buildFuncSignature(child);
      const exported = isGoExported(name);

      symbols.push({
        name,
        kind: "function",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: sig,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Methods ---
    if (child.type === "method_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractGoDoc(child, source);
      const sig = buildFuncSignature(child);
      const exported = isGoExported(name);
      const parentName = extractReceiverType(child);

      symbols.push({
        name,
        kind: "method",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: sig,
        parentName,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Type declarations (struct, interface, type alias) ---
    if (child.type === "type_declaration") {
      for (let j = 0; j < child.namedChildCount; j++) {
        const spec = child.namedChild(j);
        if (!spec || spec.type !== "type_spec") continue;

        const sym = processTypeSpec(spec, child, filePath, source);
        if (sym) {
          symbols.push(sym);
          if (sym.exported) exportNames.push(sym.name);
        }
      }
      continue;
    }

    // --- Constants ---
    if (child.type === "const_declaration") {
      const consts = extractConstVarSpecs(child, "constant", filePath, source);
      for (const c of consts) {
        symbols.push(c);
        if (c.exported) exportNames.push(c.name);
      }
      continue;
    }

    // --- Variables ---
    if (child.type === "var_declaration") {
      const vars = extractConstVarSpecs(child, "variable", filePath, source);
      for (const v of vars) {
        symbols.push(v);
        if (v.exported) exportNames.push(v.name);
      }
      continue;
    }
  }

  return { symbols, imports, exports: exportNames };
}
