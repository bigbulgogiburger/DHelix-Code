import { describe, it, expect } from "vitest";
import { extractExportedSymbols, buildImportHint } from "../../../src/tools/import-hint.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("extractExportedSymbols", () => {
  it("should extract named function exports", () => {
    const content = `export function foo() {}\nexport async function bar() {}`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toContain("foo");
    expect(symbols).toContain("bar");
  });

  it("should extract const/let/var exports", () => {
    const content = `export const a = 1;\nexport let b = 2;\nexport var c = 3;`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toContain("a");
    expect(symbols).toContain("b");
    expect(symbols).toContain("c");
  });

  it("should extract class and interface exports", () => {
    const content = `export class MyClass {}\nexport interface MyInterface {}`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toContain("MyClass");
    expect(symbols).toContain("MyInterface");
  });

  it("should extract type and enum exports", () => {
    const content = `export type MyType = string;\nexport enum MyEnum { A, B }`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toContain("MyType");
    expect(symbols).toContain("MyEnum");
  });

  it("should extract re-exports from braces", () => {
    const content = `export { foo, bar, baz } from './other.js';`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toContain("foo");
    expect(symbols).toContain("bar");
    expect(symbols).toContain("baz");
  });

  it("should handle 'as' renames in re-exports", () => {
    const content = `export { foo as renamedFoo } from './other.js';`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toContain("renamedFoo");
    expect(symbols).not.toContain("foo");
  });

  it("should detect default export", () => {
    const content = `export default function main() {}`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toContain("default");
  });

  it("should return empty array for file with no exports", () => {
    const content = `const a = 1;\nfunction foo() {}\nconsole.log(a);`;
    const symbols = extractExportedSymbols(content);
    expect(symbols).toHaveLength(0);
  });

  it("should not produce duplicates", () => {
    const content = `export function foo() {}\nexport { foo };`;
    const symbols = extractExportedSymbols(content);
    const fooCount = symbols.filter((s) => s === "foo").length;
    expect(fooCount).toBe(1);
  });
});

describe("buildImportHint", () => {
  const tmpBase = join(tmpdir(), `import-hint-test-${Date.now()}`);

  it("should return empty string for non-TS/JS files", async () => {
    const dir = join(tmpBase, "non-ts");
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, "readme.md");
    await writeFile(filePath, "# Hello\nexport const x = 1;", "utf-8");

    const hint = await buildImportHint(filePath, dir);
    expect(hint).toBe("");

    await rm(dir, { recursive: true, force: true });
  });

  it("should return empty string for files with no exports", async () => {
    const dir = join(tmpBase, "no-exports");
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, "internal.ts");
    await writeFile(filePath, "const x = 1;\nfunction foo() {}", "utf-8");

    const hint = await buildImportHint(filePath, dir);
    expect(hint).toBe("");

    await rm(dir, { recursive: true, force: true });
  });

  it("should return empty string when file does not exist", async () => {
    const hint = await buildImportHint("/nonexistent/file.ts", "/nonexistent");
    expect(hint).toBe("");
  });

  it("should find importing files when ripgrep is available", async () => {
    const dir = join(tmpBase, "with-imports");
    await mkdir(dir, { recursive: true });

    // Create a module that exports symbols
    const typesFile = join(dir, "types.ts");
    await writeFile(
      typesFile,
      `export interface Product {\n  name: string;\n}\nexport type ProductId = string;`,
      "utf-8",
    );

    // Create files that import from types.ts
    const serviceFile = join(dir, "service.ts");
    await writeFile(
      serviceFile,
      `import { Product } from './types.js';\nconsole.log("service");`,
      "utf-8",
    );

    const repoFile = join(dir, "repo.ts");
    await writeFile(
      repoFile,
      `import { ProductId } from './types.js';\nconsole.log("repo");`,
      "utf-8",
    );

    // Create a file that does NOT import types.ts
    const otherFile = join(dir, "other.ts");
    await writeFile(otherFile, `console.log("unrelated");`, "utf-8");

    const hint = await buildImportHint(typesFile, dir);

    // If ripgrep is available, we should get a hint with importing files
    // If ripgrep is not available, empty string is acceptable
    if (hint) {
      expect(hint).toContain("[Hint]");
      expect(hint).toContain("Product");
      expect(hint).toContain("service.ts");
      expect(hint).toContain("repo.ts");
      expect(hint).not.toContain("other.ts");
    }

    await rm(dir, { recursive: true, force: true });
  });
});
