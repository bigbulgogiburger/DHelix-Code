/**
 * Java symbol extractor for TreeSitterEngine
 *
 * Extracts classes, interfaces, enums, methods, constructors, and imports
 * from Java source files using tree-sitter AST nodes.
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
 * Extract modifier keywords from a modifiers node.
 */
function extractModifiers(node: Node): string[] {
  const modifiers: string[] = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (child.type === "modifiers") {
      for (let j = 0; j < child.childCount; j++) {
        const mod = child.child(j);
        if (mod && mod.type !== "marker_annotation" && mod.type !== "annotation") {
          modifiers.push(mod.text);
        }
      }
      break;
    }
  }

  // Also check direct children for cases where modifiers aren't grouped
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === "modifiers") {
      for (let j = 0; j < child.namedChildCount; j++) {
        const mod = child.namedChild(j);
        if (!mod) continue;
        if (mod.type !== "marker_annotation" && mod.type !== "annotation") {
          if (!modifiers.includes(mod.text)) {
            modifiers.push(mod.text);
          }
        }
      }
    }
  }

  return modifiers;
}

/**
 * Extract Javadoc comment preceding a node.
 * Javadoc comments start with /** and end with *​/
 */
function extractJavadoc(node: Node): string | undefined {
  // Check previous siblings for block_comment that looks like Javadoc
  let prev = node.previousNamedSibling;

  // Sometimes there's a modifiers node between the comment and the declaration
  while (prev && prev.type === "modifiers") {
    prev = prev.previousNamedSibling;
  }

  if (prev && (prev.type === "block_comment" || prev.type === "comment")) {
    const text = prev.text;
    if (text.startsWith("/**")) {
      // Strip Javadoc markers
      return text
        .replace(/^\/\*\*\s*/, "")
        .replace(/\s*\*\/$/, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trim())
        .filter((line) => !line.startsWith("@")) // Remove @param, @return etc.
        .join("\n")
        .trim() || undefined;
    }
  }

  // Also check non-named previous sibling (comments might not be named children)
  let prevSib = node.previousSibling;
  while (prevSib && prevSib.type === "modifiers") {
    prevSib = prevSib.previousSibling;
  }
  if (prevSib && prevSib !== prev && (prevSib.type === "block_comment" || prevSib.type === "comment")) {
    const text = prevSib.text;
    if (text.startsWith("/**")) {
      return text
        .replace(/^\/\*\*\s*/, "")
        .replace(/\s*\*\/$/, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trim())
        .filter((line) => !line.startsWith("@"))
        .join("\n")
        .trim() || undefined;
    }
  }

  return undefined;
}

/**
 * Build a method/constructor signature string.
 */
function buildMethodSignature(
  node: Node,
  modifiers: string[],
): string {
  const name = getFieldText(node, "name") ?? "?";
  const params = node.childForFieldName("parameters");
  const paramsText = params?.text ?? "()";
  const returnType = node.childForFieldName("type");
  const returnStr = returnType ? `${returnType.text} ` : "";
  const modStr = modifiers.length > 0 ? modifiers.join(" ") + " " : "";

  return `${modStr}${returnStr}${name}${paramsText}`;
}

/**
 * Extract methods and constructors from a class/interface/enum body.
 */
function extractClassMembers(
  bodyNode: Node,
  parentName: string,
  filePath: string,
): ParsedSymbol[] {
  const members: ParsedSymbol[] = [];

  for (let i = 0; i < bodyNode.namedChildCount; i++) {
    const child = bodyNode.namedChild(i);
    if (!child) continue;

    // --- Methods ---
    if (child.type === "method_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractJavadoc(child);
      const modifiers = extractModifiers(child);
      const sig = buildMethodSignature(child, modifiers);
      const exported = modifiers.includes("public");

      members.push({
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
      continue;
    }

    // --- Constructors ---
    if (child.type === "constructor_declaration") {
      const name = getFieldText(child, "name") ?? parentName;
      const doc = extractJavadoc(child);
      const modifiers = extractModifiers(child);
      const params = child.childForFieldName("parameters");
      const paramsText = params?.text ?? "()";
      const modStr = modifiers.length > 0 ? modifiers.join(" ") + " " : "";

      members.push({
        name,
        kind: "method",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported: modifiers.includes("public"),
        signature: `${modStr}${name}${paramsText}`,
        parentName,
        documentation: doc,
      });
      continue;
    }

    // --- Nested classes/interfaces/enums (skip for now, keep extractors focused) ---
  }

  return members;
}

/**
 * Parse an import_declaration to extract source and specifiers.
 */
function parseJavaImport(node: Node): ImportInfo | undefined {
  // import java.util.List;
  // import java.util.*;
  // import static java.util.Collections.emptyList;

  // Get the full import path text
  let fullPath = "";

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (child.type === "scoped_identifier" || child.type === "identifier") {
      fullPath = child.text;
    }
    // Handle wildcard imports
    if (child.type === "asterisk") {
      fullPath += ".*";
    }
  }

  if (!fullPath) return undefined;

  const isWildcard = fullPath.endsWith(".*");
  const line = node.startPosition.row + 1;

  if (isWildcard) {
    const source = fullPath.slice(0, -2); // Remove .*
    return {
      source,
      specifiers: ["*"],
      isDefault: false,
      isNamespace: true,
      line,
    };
  }

  // Split into package + class name
  const lastDot = fullPath.lastIndexOf(".");
  if (lastDot >= 0) {
    const source = fullPath.slice(0, lastDot);
    const specifier = fullPath.slice(lastDot + 1);
    return {
      source,
      specifiers: [specifier],
      isDefault: false,
      isNamespace: false,
      line,
    };
  }

  return {
    source: fullPath,
    specifiers: [fullPath],
    isDefault: false,
    isNamespace: true,
    line,
  };
}

/**
 * Extract symbols and imports from a Java source file AST.
 */
export function extractJavaSymbols(
  rootNode: Node,
  filePath: string,
  _source: string,
): { symbols: ParsedSymbol[]; imports: ImportInfo[]; exports: string[] } {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exportNames: string[] = [];

  // Java files typically have a program node as root
  // Children can be: package_declaration, import_declaration, class_declaration, etc.

  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const child = rootNode.namedChild(i);
    if (!child) continue;

    // --- Imports ---
    if (child.type === "import_declaration") {
      const info = parseJavaImport(child);
      if (info) imports.push(info);
      continue;
    }

    // --- Classes ---
    if (child.type === "class_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractJavadoc(child);
      const modifiers = extractModifiers(child);
      const exported = modifiers.includes("public");

      // Build signature with superclass and interfaces
      const superclass = child.childForFieldName("superclass");
      const interfaces = child.childForFieldName("interfaces");
      let sig = modifiers.length > 0 ? modifiers.join(" ") + " " : "";
      sig += `class ${name}`;
      if (superclass) sig += ` extends ${superclass.text}`;
      if (interfaces) sig += ` implements ${interfaces.text}`;

      symbols.push({
        name,
        kind: "class",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: sig,
        documentation: doc,
      });

      if (exported) exportNames.push(name);

      // Extract methods and constructors
      const body = child.childForFieldName("body");
      if (body) {
        const members = extractClassMembers(body, name, filePath);
        symbols.push(...members);
      }
      continue;
    }

    // --- Interfaces ---
    if (child.type === "interface_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractJavadoc(child);
      const modifiers = extractModifiers(child);
      const exported = modifiers.includes("public");

      let sig = modifiers.length > 0 ? modifiers.join(" ") + " " : "";
      sig += `interface ${name}`;

      // interfaces can extend other interfaces
      for (let j = 0; j < child.namedChildCount; j++) {
        const n = child.namedChild(j);
        if (n?.type === "extends_interfaces" || n?.type === "super_interfaces") {
          sig += ` extends ${n.text}`;
        }
      }

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

      // Extract method declarations from interface body
      const body = child.childForFieldName("body");
      if (body) {
        const members = extractClassMembers(body, name, filePath);
        symbols.push(...members);
      }
      continue;
    }

    // --- Enums ---
    if (child.type === "enum_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractJavadoc(child);
      const modifiers = extractModifiers(child);
      const exported = modifiers.includes("public");

      let sig = modifiers.length > 0 ? modifiers.join(" ") + " " : "";
      sig += `enum ${name}`;

      symbols.push({
        name,
        kind: "enum",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: sig,
        documentation: doc,
      });

      if (exported) exportNames.push(name);

      // Extract methods from enum body
      const body = child.childForFieldName("body");
      if (body) {
        const members = extractClassMembers(body, name, filePath);
        symbols.push(...members);
      }
      continue;
    }

    // --- Annotation type declarations (treat as interface) ---
    if (child.type === "annotation_type_declaration") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractJavadoc(child);
      const modifiers = extractModifiers(child);
      const exported = modifiers.includes("public");

      symbols.push({
        name,
        kind: "interface",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: `@interface ${name}`,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }
  }

  return { symbols, imports, exports: exportNames };
}
