/**
 * Tree-sitter symbol extractors — barrel export
 *
 * Each language extractor converts a tree-sitter AST into a uniform
 * { symbols, imports, exports } structure for the TreeSitterEngine.
 */

export { extractPythonSymbols } from "./python.js";
export { extractGoSymbols } from "./go.js";
export { extractRustSymbols } from "./rust.js";
export { extractJavaSymbols } from "./java.js";
export { extractCppSymbols } from "./cpp.js";
export { extractCsharpSymbols } from "./csharp.js";
export { extractSwiftSymbols } from "./swift.js";
export { extractKotlinSymbols } from "./kotlin.js";
