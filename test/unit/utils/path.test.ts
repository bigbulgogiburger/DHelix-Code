import { describe, it, expect } from "vitest";
import {
  normalizePath,
  isAbsolutePath,
  joinPath,
  baseName,
  extName,
  dirName,
  resolvePath,
  relativePath,
  toGitBashPath,
  fromGitBashPath,
  normalizeDriveLetter,
  isUNCPath,
  isLongPath,
  ensureLongPathSupport,
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

describe("dirName", () => {
  it("should return directory name", () => {
    const result = dirName("src/utils/path.ts");
    expect(result).toBe("src/utils");
  });

  it("should return dot for file without directory", () => {
    const result = dirName("file.ts");
    expect(result).toBe(".");
  });
});

describe("resolvePath", () => {
  it("should resolve and normalize a path", () => {
    const result = resolvePath("src", "utils", "path.ts");
    expect(result).toContain("src/utils/path.ts");
    expect(result).not.toContain("\\");
  });
});

describe("relativePath", () => {
  it("should compute relative path", () => {
    const result = relativePath("/a/b", "/a/b/c/d.ts");
    expect(result).toBe("c/d.ts");
  });
});

describe("isAbsolutePath (Windows)", () => {
  it("should detect Windows drive paths", () => {
    // Windows-style paths should work on all platforms
    expect(isAbsolutePath("C:\\Users\\test")).toBe(true);
    expect(isAbsolutePath("D:/Projects/file.ts")).toBe(true);
  });
});

describe("toGitBashPath", () => {
  it("should convert drive-letter paths", () => {
    expect(toGitBashPath("C:\\Users\\foo\\bar")).toBe("/c/Users/foo/bar");
  });

  it("should handle forward-slash Windows paths", () => {
    expect(toGitBashPath("D:/Projects/my-app")).toBe("/d/Projects/my-app");
  });

  it("should handle lowercase drive letters", () => {
    expect(toGitBashPath("c:\\temp")).toBe("/c/temp");
  });

  it("should pass through non-drive paths", () => {
    expect(toGitBashPath("relative/path")).toBe("relative/path");
    expect(toGitBashPath("/unix/path")).toBe("/unix/path");
  });

  it("should handle empty string", () => {
    expect(toGitBashPath("")).toBe("");
  });
});

describe("fromGitBashPath", () => {
  it("should convert Git Bash paths to Windows", () => {
    expect(fromGitBashPath("/c/Users/foo")).toBe("C:\\Users\\foo");
  });

  it("should handle uppercase drive letter in Git Bash path", () => {
    expect(fromGitBashPath("/D/Projects/bar")).toBe("D:\\Projects\\bar");
  });

  it("should pass through non-drive paths", () => {
    expect(fromGitBashPath("/usr/bin")).toBe("/usr/bin");
    expect(fromGitBashPath("relative")).toBe("relative");
  });

  it("should handle empty string", () => {
    expect(fromGitBashPath("")).toBe("");
  });
});

describe("normalizeDriveLetter", () => {
  it("should uppercase a lowercase drive letter", () => {
    expect(normalizeDriveLetter("c:\\Users\\foo")).toBe("C:\\Users\\foo");
  });

  it("should keep an already-uppercase drive letter", () => {
    expect(normalizeDriveLetter("C:\\Users\\foo")).toBe("C:\\Users\\foo");
  });

  it("should pass through non-drive paths", () => {
    expect(normalizeDriveLetter("/unix/path")).toBe("/unix/path");
    expect(normalizeDriveLetter("relative")).toBe("relative");
  });

  it("should handle empty string", () => {
    expect(normalizeDriveLetter("")).toBe("");
  });
});

describe("isUNCPath", () => {
  it("should detect backslash UNC paths", () => {
    expect(isUNCPath("\\\\server\\share")).toBe(true);
    expect(isUNCPath("\\\\server\\share\\folder")).toBe(true);
  });

  it("should detect forward-slash UNC paths", () => {
    expect(isUNCPath("//server/share")).toBe(true);
  });

  it("should reject non-UNC paths", () => {
    expect(isUNCPath("C:\\Users")).toBe(false);
    expect(isUNCPath("/home/user")).toBe(false);
    expect(isUNCPath("\\\\server")).toBe(false);
  });
});

describe("isLongPath", () => {
  it("should detect paths exceeding 260 characters", () => {
    const longPath = "C:\\" + "a".repeat(260);
    expect(isLongPath(longPath)).toBe(true);
  });

  it("should pass short paths", () => {
    expect(isLongPath("C:\\Users\\foo")).toBe(false);
  });
});

describe("ensureLongPathSupport", () => {
  it("should add prefix for long paths", () => {
    const longPath = "C:\\" + "a".repeat(260);
    const result = ensureLongPathSupport(longPath);
    expect(result).toBe("\\\\?\\" + longPath);
  });

  it("should not double-prefix", () => {
    const prefixed = "\\\\?\\" + "C:\\" + "a".repeat(260);
    expect(ensureLongPathSupport(prefixed)).toBe(prefixed);
  });

  it("should not modify short paths", () => {
    expect(ensureLongPathSupport("C:\\Users\\foo")).toBe("C:\\Users\\foo");
  });
});
