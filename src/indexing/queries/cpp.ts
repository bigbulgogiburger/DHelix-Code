/**
 * C/C++ symbol extractor for TreeSitterEngine
 *
 * Extracts functions, classes, structs, namespaces, enums, methods,
 * and includes from C/C++ source files using tree-sitter AST nodes.
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
 * Extract doc comment preceding a node.
 * C/C++ doc comments are either /** ... * / or // / ... line comments.
 */
function extractCppDoc(node: Node, _source: string): string | undefined {
  const prev = node.previousNamedSibling;
  if (!prev) return undefined;

  if (prev.type === "comment") {
    const text = prev.text;

    // Block doc comment: /** ... */
    if (text.startsWith("/**")) {
      const inner = text.slice(3, -2).trim();
      const lines = inner.split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim());
      const summary = lines.find((l) => l.length > 0 && !l.startsWith("@") && !l.startsWith("\\"));
      return summary ?? undefined;
    }

    // Single-line comment: // ...
    if (text.startsWith("//")) {
      return text.slice(2).trim() || undefined;
    }
  }

  return undefined;
}

/**
 * Extract declarator name from a function_declarator node.
 * Handles pointer declarators: (*funcPtr) and qualified names: MyClass::method.
 */
function extractDeclaratorName(node: Node): string | undefined {
  if (node.type === "function_declarator") {
    const declarator = node.childForFieldName("declarator");
    if (declarator) {
      return extractDeclaratorName(declarator);
    }
  }

  if (node.type === "qualified_identifier") {
    // e.g., MyClass::method → extract the "method" part (scope_identifier)
    const name = node.childForFieldName("name");
    return name?.text ?? node.text;
  }

  if (node.type === "identifier") {
    return node.text;
  }

  if (node.type === "pointer_declarator") {
    const inner = node.childForFieldName("declarator");
    return inner ? extractDeclaratorName(inner) : undefined;
  }

  // Fallback: use named child
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === "identifier") return child.text;
  }

  return undefined;
}

/**
 * Build a function signature from a function_definition node.
 */
function buildFunctionSignature(node: Node): string | undefined {
  const declarator = node.childForFieldName("declarator");
  if (!declarator) return undefined;

  const typeNode = node.childForFieldName("type");
  const returnType = typeNode?.text ?? "";

  const funcDecl = declarator.type === "function_declarator"
    ? declarator
    : declarator.childForFieldName("declarator");
  if (!funcDecl) return returnType ? `${returnType} (...)` : undefined;

  const params = funcDecl.childForFieldName("parameters");
  const name = extractDeclaratorName(declarator);

  return `${returnType} ${name ?? "?"}${params?.text ?? "()"}`.trim();
}

/**
 * Extract method members from a class/struct body.
 */
function extractClassMembers(
  bodyNode: Node,
  parentName: string,
  filePath: string,
  source: string,
): ParsedSymbol[] {
  const methods: ParsedSymbol[] = [];

  for (let i = 0; i < bodyNode.namedChildCount; i++) {
    const child = bodyNode.namedChild(i);
    if (!child) continue;

    if (child.type === "function_definition") {
      const declarator = child.childForFieldName("declarator");
      if (!declarator) continue;

      const name = extractDeclaratorName(declarator);
      if (!name) continue;

      const sig = buildFunctionSignature(child);
      const doc = extractCppDoc(child, source);

      methods.push({
        name,
        kind: "method",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported: true, // C++ methods are accessible based on access specifiers
        parentName,
        signature: sig,
        documentation: doc,
      });
    }

    // Declaration (forward declared or pure virtual method)
    if (child.type === "declaration") {
      const declarator = child.childForFieldName("declarator");
      if (!declarator) continue;

      // Only process function declarators
      const funcDecl = declarator.type === "function_declarator"
        ? declarator
        : declarator.childForFieldName("declarator");
      if (!funcDecl || funcDecl.type !== "function_declarator") continue;

      const name = extractDeclaratorName(declarator);
      if (!name) continue;

      const typeNode = child.childForFieldName("type");
      const params = funcDecl.childForFieldName("parameters");
      const sig = `${typeNode?.text ?? ""} ${name}${params?.text ?? "()"}`.trim();

      methods.push({
        name,
        kind: "method",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported: true,
        parentName,
        signature: sig,
        documentation: extractCppDoc(child, source),
      });
    }
  }

  return methods;
}

/**
 * Extract symbols and imports from a C/C++ source file AST.
 */
export function extractCppSymbols(
  rootNode: Node,
  filePath: string,
  source: string,
): { symbols: ParsedSymbol[]; imports: ImportInfo[]; exports: string[] } {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exportNames: string[] = [];

  function processNode(node: Node, parentNamespace?: string): void {
    switch (node.type) {
      // --- #include directives ---
      case "preproc_include": {
        const pathNode = node.childForFieldName("path");
        if (pathNode) {
          const raw = pathNode.text;
          // Strip <...> or "..." delimiters
          const importPath = raw.replace(/^[<"]/, "").replace(/[>"]$/, "");
          imports.push({
            source: importPath,
            specifiers: [],
            isDefault: false,
            isNamespace: false,
            line: node.startPosition.row + 1,
          });
        }
        break;
      }

      // --- Function definition ---
      case "function_definition": {
        const declarator = node.childForFieldName("declarator");
        if (!declarator) break;

        const name = extractDeclaratorName(declarator);
        if (!name) break;

        const sig = buildFunctionSignature(node);
        const doc = extractCppDoc(node, source);
        const fullName = parentNamespace ? `${parentNamespace}::${name}` : name;

        symbols.push({
          name,
          kind: "function",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: true,
          signature: sig,
          parentName: parentNamespace,
          documentation: doc,
        });

        exportNames.push(fullName);
        break;
      }

      // --- Class declaration ---
      case "class_specifier": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;

        const name = nameNode.text;
        const doc = extractCppDoc(node, source);

        // Detect base classes
        const baseClause = node.childForFieldName("base_class_clause");
        const sig = baseClause ? `class ${name} : ${baseClause.text.replace(/^:\s*/, "")}` : `class ${name}`;

        symbols.push({
          name,
          kind: "class",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: true,
          signature: sig,
          parentName: parentNamespace,
          documentation: doc,
        });

        exportNames.push(name);

        // Extract methods
        const body = node.childForFieldName("body");
        if (body) {
          const methods = extractClassMembers(body, name, filePath, source);
          symbols.push(...methods);
        }
        break;
      }

      // --- Struct declaration ---
      case "struct_specifier": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;

        const name = nameNode.text;
        const doc = extractCppDoc(node, source);

        symbols.push({
          name,
          kind: "class", // C structs map to "class" kind
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: true,
          signature: `struct ${name}`,
          parentName: parentNamespace,
          documentation: doc,
        });

        exportNames.push(name);

        // Extract methods from struct body too
        const body = node.childForFieldName("body");
        if (body) {
          const methods = extractClassMembers(body, name, filePath, source);
          symbols.push(...methods);
        }
        break;
      }

      // --- Namespace definition ---
      case "namespace_definition": {
        const nameNode = node.childForFieldName("name");
        const namespaceName = nameNode?.text;
        const fullNs = parentNamespace && namespaceName
          ? `${parentNamespace}::${namespaceName}`
          : (namespaceName ?? parentNamespace);

        if (namespaceName) {
          const doc = extractCppDoc(node, source);
          symbols.push({
            name: namespaceName,
            kind: "type", // Namespaces map to "type" kind
            filePath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            exported: true,
            signature: `namespace ${namespaceName}`,
            parentName: parentNamespace,
            documentation: doc,
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

      // --- Enum specifier ---
      case "enum_specifier": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;

        const name = nameNode.text;
        const doc = extractCppDoc(node, source);

        symbols.push({
          name,
          kind: "enum",
          filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: true,
          signature: `enum ${name}`,
          parentName: parentNamespace,
          documentation: doc,
        });

        exportNames.push(name);
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
