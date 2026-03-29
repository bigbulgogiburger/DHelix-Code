/**
 * Rust symbol extractor for TreeSitterEngine
 *
 * Extracts functions, methods (inside impl blocks), structs, enums, traits,
 * type aliases, constants, and use declarations from Rust source files
 * using tree-sitter AST nodes.
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
 * Check if a node has a `pub` visibility modifier.
 */
function hasPubVisibility(node: Node): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    if (child.type === "visibility_modifier") {
      return true;
    }
    // Stop checking after we pass visibility position (it's always first)
    if (child.type !== "visibility_modifier" && child.type !== "attribute_item" && child.type !== "line_comment" && child.type !== "block_comment") {
      break;
    }
  }
  return false;
}

/**
 * Extract /// doc comments preceding a node.
 */
function extractRustDoc(node: Node): string | undefined {
  const comments: string[] = [];
  let prev = node.previousNamedSibling;

  while (prev) {
    if (prev.type === "line_comment") {
      const text = prev.text;
      if (text.startsWith("///")) {
        comments.unshift(text.slice(3).trim());
      } else if (text.startsWith("//!")) {
        // Module-level doc, skip for symbol docs
        break;
      } else {
        break;
      }
    } else if (prev.type === "attribute_item") {
      // #[...] attributes can precede a doc comment chain
      prev = prev.previousNamedSibling;
      continue;
    } else {
      break;
    }
    prev = prev.previousNamedSibling;
  }

  return comments.length > 0 ? comments.join("\n").trim() : undefined;
}

/**
 * Build function signature from a function_item node.
 */
function buildRustFuncSignature(node: Node): string {
  const name = getFieldText(node, "name") ?? "?";
  const params = getFieldText(node, "parameters") ?? "()";
  const returnType = node.childForFieldName("return_type");
  const returnStr = returnType ? ` -> ${returnType.text}` : "";
  const pub = hasPubVisibility(node) ? "pub " : "";

  // Check for async/unsafe/const qualifiers
  const qualifiers: string[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    if (child.text === "async" || child.text === "unsafe" || child.text === "const") {
      qualifiers.push(child.text);
    }
    if (child.type === "function" || child.text === "fn") break;
  }

  const qualStr = qualifiers.length > 0 ? qualifiers.join(" ") + " " : "";
  return `${pub}${qualStr}fn ${name}${params}${returnStr}`;
}

/**
 * Extract the impl target type name from an impl_item.
 */
function extractImplTarget(implNode: Node): string | undefined {
  const typeNode = implNode.childForFieldName("type");
  return typeNode?.text;
}

/**
 * Extract methods from an impl_item body.
 */
function extractImplMethods(
  implNode: Node,
  filePath: string,
): ParsedSymbol[] {
  const methods: ParsedSymbol[] = [];
  const parentName = extractImplTarget(implNode);
  const body = implNode.childForFieldName("body");
  if (!body) return methods;

  for (let i = 0; i < body.namedChildCount; i++) {
    const child = body.namedChild(i);
    if (!child || child.type !== "function_item") continue;

    const name = getFieldText(child, "name");
    if (!name) continue;

    const doc = extractRustDoc(child);
    const sig = buildRustFuncSignature(child);
    const exported = hasPubVisibility(child);

    methods.push({
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
  }

  return methods;
}

/**
 * Parse a use_declaration to extract import source and specifiers.
 */
function parseUseDeclaration(node: Node): ImportInfo | undefined {
  // use_declaration contains an argument child (the use path/tree)
  const argNode = node.childForFieldName("argument");
  if (!argNode) return undefined;

  const fullText = argNode.text;
  const line = node.startPosition.row + 1;

  // Handle glob: use std::io::*
  if (fullText.endsWith("::*")) {
    const source = fullText.slice(0, -3);
    return {
      source,
      specifiers: ["*"],
      isDefault: false,
      isNamespace: true,
      line,
    };
  }

  // Handle use tree: use std::io::{Read, Write}
  const braceMatch = fullText.match(/^(.+)::\{([\s\S]+)\}$/);
  if (braceMatch) {
    const source = braceMatch[1];
    const specifiers = braceMatch[2]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        // Handle `Read as IoRead`
        const asMatch = s.match(/^(\w+)\s+as\s+(\w+)$/);
        return asMatch ? asMatch[2] : s;
      });

    return {
      source,
      specifiers,
      isDefault: false,
      isNamespace: false,
      line,
    };
  }

  // Handle simple: use std::io::Read or use std::io::Read as IoRead
  const asMatch = fullText.match(/^(.+)::(\w+)\s+as\s+(\w+)$/);
  if (asMatch) {
    return {
      source: asMatch[1],
      specifiers: [asMatch[3]],
      isDefault: false,
      isNamespace: false,
      line,
    };
  }

  // Simple path: use std::io::Read
  const lastSep = fullText.lastIndexOf("::");
  if (lastSep >= 0) {
    const source = fullText.slice(0, lastSep);
    const specifier = fullText.slice(lastSep + 2);
    return {
      source,
      specifiers: [specifier],
      isDefault: false,
      isNamespace: false,
      line,
    };
  }

  // Single segment: use crate_name
  return {
    source: fullText,
    specifiers: [fullText],
    isDefault: false,
    isNamespace: true,
    line,
  };
}

/**
 * Extract symbols and imports from a Rust source file AST.
 */
export function extractRustSymbols(
  rootNode: Node,
  filePath: string,
  _source: string,
): { symbols: ParsedSymbol[]; imports: ImportInfo[]; exports: string[] } {
  const symbols: ParsedSymbol[] = [];
  const imports: ImportInfo[] = [];
  const exportNames: string[] = [];

  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const child = rootNode.namedChild(i);
    if (!child) continue;

    // --- Use declarations (imports) ---
    if (child.type === "use_declaration") {
      const info = parseUseDeclaration(child);
      if (info) imports.push(info);
      continue;
    }

    // --- Functions (top-level) ---
    if (child.type === "function_item") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractRustDoc(child);
      const sig = buildRustFuncSignature(child);
      const exported = hasPubVisibility(child);

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

    // --- Structs ---
    if (child.type === "struct_item") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractRustDoc(child);
      const exported = hasPubVisibility(child);
      const pub = exported ? "pub " : "";

      symbols.push({
        name,
        kind: "class",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: `${pub}struct ${name}`,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Enums ---
    if (child.type === "enum_item") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractRustDoc(child);
      const exported = hasPubVisibility(child);
      const pub = exported ? "pub " : "";

      symbols.push({
        name,
        kind: "enum",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: `${pub}enum ${name}`,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Traits ---
    if (child.type === "trait_item") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractRustDoc(child);
      const exported = hasPubVisibility(child);
      const pub = exported ? "pub " : "";

      symbols.push({
        name,
        kind: "interface",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: `${pub}trait ${name}`,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Type aliases ---
    if (child.type === "type_item") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractRustDoc(child);
      const exported = hasPubVisibility(child);
      const pub = exported ? "pub " : "";

      symbols.push({
        name,
        kind: "type",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: `${pub}type ${name}`,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Constants ---
    if (child.type === "const_item") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractRustDoc(child);
      const exported = hasPubVisibility(child);
      const pub = exported ? "pub " : "";
      const typeNode = child.childForFieldName("type");
      const typeStr = typeNode ? `: ${typeNode.text}` : "";

      symbols.push({
        name,
        kind: "constant",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: `${pub}const ${name}${typeStr}`,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Static items (treat as constants) ---
    if (child.type === "static_item") {
      const name = getFieldText(child, "name");
      if (!name) continue;

      const doc = extractRustDoc(child);
      const exported = hasPubVisibility(child);
      const pub = exported ? "pub " : "";
      const typeNode = child.childForFieldName("type");
      const typeStr = typeNode ? `: ${typeNode.text}` : "";

      symbols.push({
        name,
        kind: "constant",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
        exported,
        signature: `${pub}static ${name}${typeStr}`,
        documentation: doc,
      });

      if (exported) exportNames.push(name);
      continue;
    }

    // --- Impl blocks → extract methods ---
    if (child.type === "impl_item") {
      const methods = extractImplMethods(child, filePath);
      for (const m of methods) {
        symbols.push(m);
        if (m.exported) exportNames.push(m.name);
      }
      continue;
    }
  }

  return { symbols, imports, exports: exportNames };
}
