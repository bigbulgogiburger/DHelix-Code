/**
 * Kotlin symbol extractor for TreeSitterEngine
 *
 * Extracts functions, classes, objects, interfaces, properties,
 * and imports from Kotlin source files using tree-sitter AST nodes.
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
 * Check if a Kotlin declaration is public (Kotlin defaults to public).
 * Returns false only if explicitly marked private/protected/internal.
 */
function isKotlinExported(node: Node): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (!child) continue;

    if (child.type === "modifiers") {
      const text = child.text;
      if (text.includes("private") || text.includes("protected")) return false;
    }

    if (child.text === "private" || child.text === "protected") return false;
  }

  // Kotlin default is public
  return true;
}

/**
 * Extract KDoc comment preceding a Kotlin declaration.
 * Kotlin uses block doc comments and line comments.
 */
function extractKotlinDoc(node: Node, _source: string): string | undefined {
  const prev = node.previousNamedSibling;
  if (!prev) return undefined;

  if (prev.type === "multiline_comment") {
    const text = prev.text;
    if (text.startsWith("/**")) {
      const inner = text.slice(3, -2).trim();
      const lines = inner.split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim());
      return lines.find((l) => l.length > 0 && !l.startsWith("@")) ?? undefined;
    }
  }

  if (prev.type === "line_comment") {
    const text = prev.text;
    if (text.startsWith("//")) {
      return text.slice(2).trim() || undefined;
    }
  }

  return undefined;
}

/**
 * Build a function signature from a function_declaration node.
 */
function buildKotlinFunctionSignature(node: Node): string | undefined {
  const name = getFieldText(node, "name");
  if (!name) return undefined;

  const params = node.childForFieldName("function_value_parameters");
  const returnType = node.childForFieldName("return_type");

  const paramStr = params?.text ?? "()";
  const returnStr = returnType ? `: ${returnType.text.replace(/^:\s*/, "")}` : "";

  // Check if it's a suspend function
  let prefix = "fun";
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.text === "suspend") {
      prefix = "suspend fun";
      break;
    }
  }

  return `${prefix} ${name}${paramStr}${returnStr}`;
}

/**
 * Extract members from a class/object/interface body.
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

      const sig = buildKotlinFunctionSignature(child);
      const doc = extractKotlinDoc(child, source);
      const exported = isKotlinExported(child);

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

    // Property declarations
    if (child.type === "property_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const typeNode = child.childForFieldName("type");
      const exported = isKotlinExported(child);

      // Check if val (immutable) or var (mutable)
      let kind: ParsedSymbol["kind"] = "variable";
      for (let j = 0; j < child.namedChildCount; j++) {
        const c = child.namedChild(j);
        if (c?.type === "val" || c?.text === "val") {
          kind = "constant";
          break;
        }
      }

      members.push({
        name,
        kind,
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        parentName,
        signature: typeNode ? `${name}: ${typeNode.text}` : name,
        documentation: extractKotlinDoc(child, source),
      });
    }
  }

  return members;
}

/**
 * Extract symbols and imports from a Kotlin source file AST.
 */
export function extractKotlinSymbols(
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

    switch (child.type) {
      // --- Package / import directives ---
      case "import_header": {
        // import com.example.Foo
        // import com.example.*
        let importPath = "";
        let isNamespace = false;

        for (let j = 0; j < child.namedChildCount; j++) {
          const c = child.namedChild(j);
          if (!c) continue;
          if (c.type === "identifier" || c.type === "qualified_name") {
            importPath = c.text;
          }
          if (c.text === "*") {
            isNamespace = true;
          }
        }

        // Fallback: extract from the node text
        if (!importPath) {
          const raw = child.text.replace(/^import\s+/, "").trim();
          importPath = raw.endsWith(".*") ? raw.slice(0, -2) : raw;
          isNamespace = raw.endsWith(".*");
        }

        if (importPath) {
          const segments = importPath.split(".");
          const name = segments[segments.length - 1];

          imports.push({
            source: importPath,
            specifiers: isNamespace ? ["*"] : [name],
            isDefault: false,
            isNamespace,
            line: child.startPosition.row + 1,
          });
        }
        break;
      }

      // --- Top-level function declaration ---
      case "function_declaration": {
        const name = getFieldText(child, "name");
        if (!name) break;

        const sig = buildKotlinFunctionSignature(child);
        const doc = extractKotlinDoc(child, source);
        const exported = isKotlinExported(child);

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
        break;
      }

      // --- Class declaration ---
      case "class_declaration": {
        const name = getFieldText(child, "name");
        if (!name) break;

        const exported = isKotlinExported(child);
        const doc = extractKotlinDoc(child, source);

        // Check if it's a data/sealed/abstract class
        let prefix = "class";
        for (let j = 0; j < child.namedChildCount; j++) {
          const c = child.namedChild(j);
          if (c?.type === "modifiers") {
            if (c.text.includes("data")) prefix = "data class";
            else if (c.text.includes("sealed")) prefix = "sealed class";
            else if (c.text.includes("abstract")) prefix = "abstract class";
            else if (c.text.includes("enum")) prefix = "enum class";
          }
        }

        // Detect superclass / interface implementations
        const delegationSpecifiers = child.childForFieldName("delegation_specifiers");
        const sig = delegationSpecifiers
          ? `${prefix} ${name} : ${delegationSpecifiers.text}`
          : `${prefix} ${name}`;

        // Determine kind based on prefix
        const isEnum = prefix.includes("enum");
        const kind: ParsedSymbol["kind"] = isEnum ? "enum" : "class";

        symbols.push({
          name,
          kind,
          filePath,
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          exported,
          signature: sig,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        // Extract class body members
        const body = child.childForFieldName("class_body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Object declaration (singleton) ---
      case "object_declaration": {
        const name = getFieldText(child, "name");
        if (!name) break;

        const exported = isKotlinExported(child);
        const doc = extractKotlinDoc(child, source);

        const delegationSpecifiers = child.childForFieldName("delegation_specifiers");
        const sig = delegationSpecifiers
          ? `object ${name} : ${delegationSpecifiers.text}`
          : `object ${name}`;

        symbols.push({
          name,
          kind: "class", // Objects are singleton classes
          filePath,
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          exported,
          signature: sig,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        const body = child.childForFieldName("class_body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Interface declaration ---
      case "interface_declaration": {
        const name = getFieldText(child, "name");
        if (!name) break;

        const exported = isKotlinExported(child);
        const doc = extractKotlinDoc(child, source);

        const delegationSpecifiers = child.childForFieldName("delegation_specifiers");
        const sig = delegationSpecifiers
          ? `interface ${name} : ${delegationSpecifiers.text}`
          : `interface ${name}`;

        symbols.push({
          name,
          kind: "interface",
          filePath,
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          exported,
          signature: sig,
          documentation: doc,
        });

        if (exported) exportNames.push(name);

        const body = child.childForFieldName("class_body");
        if (body) {
          const members = extractTypeMembers(body, name, filePath, source);
          symbols.push(...members);
        }
        break;
      }

      // --- Top-level property declaration ---
      case "property_declaration": {
        const name = getFieldText(child, "name");
        if (!name) break;

        const typeNode = child.childForFieldName("type");
        const exported = isKotlinExported(child);

        let kind: ParsedSymbol["kind"] = "variable";
        for (let j = 0; j < child.namedChildCount; j++) {
          const c = child.namedChild(j);
          if (c?.text === "val") {
            kind = "constant";
            break;
          }
        }

        symbols.push({
          name,
          kind,
          filePath,
          startLine: child.startPosition.row + 1,
          endLine: child.endPosition.row + 1,
          exported,
          signature: typeNode ? `${name}: ${typeNode.text}` : name,
          documentation: extractKotlinDoc(child, source),
        });

        if (exported) exportNames.push(name);
        break;
      }

      default:
        break;
    }
  }

  return { symbols, imports, exports: exportNames };
}
