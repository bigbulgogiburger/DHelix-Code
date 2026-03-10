import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original platform for restoration
const originalPlatform = process.platform;

// Mock node:fs for existsSync (Git Bash detection)
const mockExistsSync = vi.fn();
vi.mock("node:fs", () => ({
  existsSync: (path: string) => mockExistsSync(path),
}));

describe("platform-windows", () => {
  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
    vi.restoreAllMocks();
  });

  describe("Windows shell detection (platform.ts)", () => {
    // These tests need to dynamically import platform.ts after setting up mocks
    // because platform detection happens at call time

    beforeEach(() => {
      vi.clearAllMocks();
      mockExistsSync.mockReturnValue(false);
    });

    describe("getShellCommand()", () => {
      it("returns Git Bash path on Windows when available", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockImplementation((path: string) => {
          if (path === "C:\\Program Files\\Git\\bin\\bash.exe") return true;
          return false;
        });

        // Re-import to get fresh module with new platform
        vi.resetModules();
        // Re-mock after resetModules
        vi.doMock("node:fs", () => ({
          existsSync: (path: string) => mockExistsSync(path),
        }));
        const { getShellCommand, _resetGitBashCache } = await import(
          "../../../src/utils/platform.js"
        );
        _resetGitBashCache();

        const shell = getShellCommand();
        expect(shell).toBe("C:\\Program Files\\Git\\bin\\bash.exe");
      });

      it("falls back to cmd.exe when Git Bash not found", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockReturnValue(false);

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: () => false,
        }));
        const { getShellCommand, _resetGitBashCache } = await import(
          "../../../src/utils/platform.js"
        );
        _resetGitBashCache();

        const shell = getShellCommand();
        expect(shell).toBe("cmd.exe");
      });

      it("returns /bin/bash on macOS/Linux", async () => {
        Object.defineProperty(process, "platform", { value: "linux", writable: true });

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: () => false,
        }));
        // Ensure SHELL env var is set for deterministic result
        const origShell = process.env.SHELL;
        process.env.SHELL = "/bin/bash";
        const { getShellCommand, _resetGitBashCache } = await import(
          "../../../src/utils/platform.js"
        );
        _resetGitBashCache();

        const shell = getShellCommand();
        expect(shell).toBe("/bin/bash");

        process.env.SHELL = origShell;
      });
    });

    describe("getShellArgs()", () => {
      it("returns ['-c', command] when using Git Bash", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockImplementation((path: string) => {
          if (path === "C:\\Program Files\\Git\\bin\\bash.exe") return true;
          return false;
        });

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: (path: string) => mockExistsSync(path),
        }));
        const { getShellArgs, _resetGitBashCache } = await import("../../../src/utils/platform.js");
        _resetGitBashCache();

        const args = getShellArgs("echo hello");
        expect(args).toEqual(["-c", "echo hello"]);
      });

      it("returns ['/c', command] when using cmd.exe", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockReturnValue(false);

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: () => false,
        }));
        const { getShellArgs, _resetGitBashCache } = await import("../../../src/utils/platform.js");
        _resetGitBashCache();

        const args = getShellArgs("echo hello");
        expect(args).toEqual(["/c", "echo hello"]);
      });
    });

    describe("hasGitBash()", () => {
      it("returns true when Git Bash is installed", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockImplementation((path: string) => {
          if (path === "C:\\Program Files\\Git\\bin\\bash.exe") return true;
          return false;
        });

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: (path: string) => mockExistsSync(path),
        }));
        const { hasGitBash, _resetGitBashCache } = await import("../../../src/utils/platform.js");
        _resetGitBashCache();

        expect(hasGitBash()).toBe(true);
      });

      it("returns false when Git Bash is not installed", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockReturnValue(false);

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: () => false,
        }));
        const { hasGitBash, _resetGitBashCache } = await import("../../../src/utils/platform.js");
        _resetGitBashCache();

        expect(hasGitBash()).toBe(false);
      });
    });

    describe("getShellType()", () => {
      it("returns 'git-bash' when Git Bash available on Windows", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockImplementation((path: string) => {
          if (path === "C:\\Program Files\\Git\\bin\\bash.exe") return true;
          return false;
        });

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: (path: string) => mockExistsSync(path),
        }));
        const { getShellType, _resetGitBashCache } = await import("../../../src/utils/platform.js");
        _resetGitBashCache();

        expect(getShellType()).toBe("git-bash");
      });

      it("returns 'cmd' when no Git Bash on Windows", async () => {
        Object.defineProperty(process, "platform", { value: "win32", writable: true });
        mockExistsSync.mockReturnValue(false);

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: () => false,
        }));
        const { getShellType, _resetGitBashCache } = await import("../../../src/utils/platform.js");
        _resetGitBashCache();

        expect(getShellType()).toBe("cmd");
      });

      it("returns 'bash' on non-Windows", async () => {
        Object.defineProperty(process, "platform", { value: "linux", writable: true });

        vi.resetModules();
        vi.doMock("node:fs", () => ({
          existsSync: () => false,
        }));
        const { getShellType, _resetGitBashCache } = await import("../../../src/utils/platform.js");
        _resetGitBashCache();

        expect(getShellType()).toBe("bash");
      });
    });
  });

  describe("Windows path utilities (path.ts)", () => {
    // Path utilities are pure functions that don't depend on mocked platform,
    // so we can import them once
    let toGitBashPath: (p: string) => string;
    let fromGitBashPath: (p: string) => string;
    let normalizeDriveLetter: (p: string) => string;
    let isUNCPath: (p: string) => boolean;
    let isLongPath: (p: string) => boolean;
    let ensureLongPathSupport: (p: string) => string;

    beforeEach(async () => {
      vi.resetModules();
      vi.doMock("node:fs", () => ({
        existsSync: () => false,
      }));
      const pathModule = await import("../../../src/utils/path.js");
      toGitBashPath = pathModule.toGitBashPath;
      fromGitBashPath = pathModule.fromGitBashPath;
      normalizeDriveLetter = pathModule.normalizeDriveLetter;
      isUNCPath = pathModule.isUNCPath;
      isLongPath = pathModule.isLongPath;
      ensureLongPathSupport = pathModule.ensureLongPathSupport;
    });

    describe("toGitBashPath()", () => {
      it("converts C:\\Users\\foo to /c/Users/foo", () => {
        expect(toGitBashPath("C:\\Users\\foo")).toBe("/c/Users/foo");
      });

      it("converts D:\\projects\\test to /d/projects/test", () => {
        expect(toGitBashPath("D:\\projects\\test")).toBe("/d/projects/test");
      });

      it("returns empty string for empty input", () => {
        expect(toGitBashPath("")).toBe("");
      });
    });

    describe("fromGitBashPath()", () => {
      it("converts /c/Users/foo to C:\\Users\\foo", () => {
        expect(fromGitBashPath("/c/Users/foo")).toBe("C:\\Users\\foo");
      });

      it("converts /d/projects/test to D:\\projects\\test", () => {
        expect(fromGitBashPath("/d/projects/test")).toBe("D:\\projects\\test");
      });

      it("returns empty string for empty input", () => {
        expect(fromGitBashPath("")).toBe("");
      });
    });

    describe("normalizeDriveLetter()", () => {
      it("normalizes lowercase c:\\ to C:\\", () => {
        expect(normalizeDriveLetter("c:\\foo")).toBe("C:\\foo");
      });

      it("preserves already uppercase C:\\", () => {
        expect(normalizeDriveLetter("C:\\foo")).toBe("C:\\foo");
      });

      it("does not modify Unix-style paths", () => {
        expect(normalizeDriveLetter("/unix/path")).toBe("/unix/path");
      });
    });

    describe("isUNCPath()", () => {
      it("detects backslash UNC path \\\\server\\share", () => {
        expect(isUNCPath("\\\\server\\share")).toBe(true);
      });

      it("detects forward slash UNC path //server/share", () => {
        expect(isUNCPath("//server/share")).toBe(true);
      });

      it("returns false for normal Windows path", () => {
        expect(isUNCPath("C:\\normal\\path")).toBe(false);
      });
    });

    describe("isLongPath()", () => {
      it("returns false for short paths", () => {
        expect(isLongPath("C:\\short")).toBe(false);
      });

      it("returns true for paths exceeding 260 characters", () => {
        const longPath = "C:\\" + "a".repeat(260);
        expect(isLongPath(longPath)).toBe(true);
      });
    });

    describe("ensureLongPathSupport()", () => {
      it("adds \\\\?\\ prefix for long paths", () => {
        const longPath = "C:\\" + "a".repeat(260);
        const result = ensureLongPathSupport(longPath);
        expect(result).toBe("\\\\?\\" + longPath);
      });

      it("doesn't modify short paths", () => {
        const shortPath = "C:\\short\\path";
        expect(ensureLongPathSupport(shortPath)).toBe(shortPath);
      });

      it("doesn't double-prefix already prefixed paths", () => {
        const longPath = "C:\\" + "a".repeat(260);
        const prefixed = "\\\\?\\" + longPath;
        // First ensure it's treated as long (prefix + original > 260)
        expect(ensureLongPathSupport(prefixed)).toBe(prefixed);
      });
    });
  });
});
