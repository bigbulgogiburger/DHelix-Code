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
  gitBashToWindows,
  windowsToGitBash,
  expandWindowsEnvVars,
  isUNCPath,
  normalizeUNCPath,
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

describe("gitBashToWindows", () => {
  it("should convert /c/Users/name to C:\\Users\\name", () => {
    expect(gitBashToWindows("/c/Users/name")).toBe("C:\\Users\\name");
  });

  it("should convert /d/Projects/file.ts to D:\\Projects\\file.ts", () => {
    expect(gitBashToWindows("/d/Projects/file.ts")).toBe("D:\\Projects\\file.ts");
  });

  it("should handle drive letter root /c to C:", () => {
    expect(gitBashToWindows("/c")).toBe("C:");
  });

  it("should handle drive letter with trailing slash /c/", () => {
    expect(gitBashToWindows("/c/")).toBe("C:\\");
  });

  it("should be case-insensitive on drive letter", () => {
    expect(gitBashToWindows("/C/Users")).toBe("C:\\Users");
  });

  it("should pass through non-Git-Bash paths unchanged", () => {
    expect(gitBashToWindows("/home/user/file.ts")).toBe("/home/user/file.ts");
    expect(gitBashToWindows("relative/path")).toBe("relative/path");
    expect(gitBashToWindows("C:\\Users\\name")).toBe("C:\\Users\\name");
  });

  it("should not convert multi-char paths like /cd/foo", () => {
    // /cd/ is not a drive letter path (cd is two chars)
    expect(gitBashToWindows("/cd/foo")).toBe("/cd/foo");
  });
});

describe("windowsToGitBash", () => {
  it("should convert C:\\Users\\name to /c/Users/name", () => {
    expect(windowsToGitBash("C:\\Users\\name")).toBe("/c/Users/name");
  });

  it("should convert D:/Projects/file.ts to /d/Projects/file.ts", () => {
    expect(windowsToGitBash("D:/Projects/file.ts")).toBe("/d/Projects/file.ts");
  });

  it("should handle drive root C:\\", () => {
    expect(windowsToGitBash("C:\\")).toBe("/c/");
  });

  it("should handle drive root without trailing slash C:", () => {
    // C: alone (no path after colon) — edge case
    // The regex expects at least a [/\\] after the colon to match,
    // but "C:" has nothing after colon. Let's check our regex.
    // Actually our regex is /^([a-zA-Z]):[/\\](.*)?$/ which requires [/\\]
    // So "C:" won't match and passes through
    expect(windowsToGitBash("C:")).toBe("C:");
  });

  it("should pass through non-Windows paths unchanged", () => {
    expect(windowsToGitBash("/home/user/file.ts")).toBe("/home/user/file.ts");
    expect(windowsToGitBash("relative/path")).toBe("relative/path");
  });

  it("should convert mixed slash Windows path", () => {
    expect(windowsToGitBash("C:\\Users/name\\Documents")).toBe("/c/Users/name/Documents");
  });
});

describe("expandWindowsEnvVars", () => {
  it("should expand known environment variables", () => {
    // Use a variable we know exists in the test environment
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    if (process.env.HOME) {
      expect(expandWindowsEnvVars("%HOME%/Documents")).toBe(`${home}/Documents`);
    }
  });

  it("should leave unknown variables unchanged", () => {
    expect(expandWindowsEnvVars("%NONEXISTENT_VAR_XYZ%/path")).toBe("%NONEXISTENT_VAR_XYZ%/path");
  });

  it("should expand multiple variables", () => {
    process.env._TEST_VAR_A = "ValueA";
    process.env._TEST_VAR_B = "ValueB";
    try {
      expect(expandWindowsEnvVars("%_TEST_VAR_A%/%_TEST_VAR_B%")).toBe("ValueA/ValueB");
    } finally {
      delete process.env._TEST_VAR_A;
      delete process.env._TEST_VAR_B;
    }
  });

  it("should return string without env vars unchanged", () => {
    expect(expandWindowsEnvVars("/normal/unix/path")).toBe("/normal/unix/path");
  });
});

describe("isUNCPath", () => {
  it("should detect backslash UNC paths", () => {
    expect(isUNCPath("\\\\server\\share")).toBe(true);
    expect(isUNCPath("\\\\server\\share\\folder")).toBe(true);
  });

  it("should detect forward slash UNC paths", () => {
    expect(isUNCPath("//server/share")).toBe(true);
  });

  it("should reject non-UNC paths", () => {
    expect(isUNCPath("/single/slash")).toBe(false);
    expect(isUNCPath("C:\\Users\\name")).toBe(false);
    expect(isUNCPath("relative/path")).toBe(false);
    expect(isUNCPath("\\single")).toBe(false);
  });

  it("should reject paths with only slashes", () => {
    expect(isUNCPath("\\\\")).toBe(false);
    expect(isUNCPath("//")).toBe(false);
  });
});

describe("normalizeUNCPath", () => {
  it("should normalize backslash UNC paths to forward slashes", () => {
    expect(normalizeUNCPath("\\\\server\\share\\folder")).toBe("//server/share/folder");
  });

  it("should remove trailing slash", () => {
    expect(normalizeUNCPath("\\\\server\\share\\folder\\")).toBe("//server/share/folder");
  });

  it("should collapse duplicate slashes in path body", () => {
    // Use backslash UNC path with duplicate backslashes in the path portion after share
    // \\server\share\\folder\\file has extra backslashes in the path body
    expect(normalizeUNCPath("\\\\server\\share\\\\folder")).toBe("//server/share/folder");
  });

  it("should pass through non-UNC paths unchanged", () => {
    expect(normalizeUNCPath("C:\\Users\\name")).toBe("C:\\Users\\name");
    expect(normalizeUNCPath("/home/user")).toBe("/home/user");
  });

  it("should handle minimal UNC path", () => {
    expect(normalizeUNCPath("\\\\a\\b")).toBe("//a/b");
  });
});
