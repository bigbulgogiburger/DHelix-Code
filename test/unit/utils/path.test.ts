import { describe, it, expect } from "vitest";
import {
  normalizePath,
  isAbsolutePath,
  joinPath,
  baseName,
  extName,
} from "../../../src/utils/path.js";

describe("normalizePath", () => {
  it("should normalize forward slashes", () => {
    const result = normalizePath("src/utils/path.ts");
    expect(result).toContain("src");
    expect(result).toContain("path.ts");
    expect(result).not.toContain("\\\\");
  });

  it("should handle double slashes", () => {
    const result = normalizePath("src//utils//path.ts");
    expect(result).toBe("src/utils/path.ts");
  });
});

describe("isAbsolutePath", () => {
  it("should detect Unix absolute paths", () => {
    expect(isAbsolutePath("/home/user/file.ts")).toBe(true);
  });

  it("should detect relative paths", () => {
    expect(isAbsolutePath("src/file.ts")).toBe(false);
    expect(isAbsolutePath("./file.ts")).toBe(false);
  });
});

describe("joinPath", () => {
  it("should join path segments", () => {
    const result = joinPath("src", "utils", "path.ts");
    expect(result).toBe("src/utils/path.ts");
  });
});

describe("baseName", () => {
  it("should extract file name", () => {
    expect(baseName("src/utils/path.ts")).toBe("path.ts");
  });

  it("should extract file name without extension", () => {
    expect(baseName("src/utils/path.ts", ".ts")).toBe("path");
  });
});

describe("extName", () => {
  it("should extract extension", () => {
    expect(extName("file.ts")).toBe(".ts");
    expect(extName("file.test.ts")).toBe(".ts");
  });

  it("should return empty for no extension", () => {
    expect(extName("Makefile")).toBe("");
  });
});
