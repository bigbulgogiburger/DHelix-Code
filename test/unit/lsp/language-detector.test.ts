import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockAccess } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
}));

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    access: mockAccess,
  };
});

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", async () => {
  const actual = await vi.importActual<typeof import("node:util")>("node:util");
  return {
    ...actual,
    promisify: () => mockExecFileAsync,
  };
});

import {
  detectProjectLanguages,
  isServerInstalled,
  getServerConfig,
} from "../../../src/lsp/language-detector.js";

describe("language-detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectProjectLanguages", () => {
    it("should detect typescript when tsconfig.json exists", async () => {
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith("tsconfig.json")) return Promise.resolve();
        return Promise.reject(new Error("ENOENT"));
      });

      const languages = await detectProjectLanguages("/project");
      expect(languages).toContain("typescript");
    });

    it("should detect go when go.mod exists", async () => {
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith("go.mod")) return Promise.resolve();
        return Promise.reject(new Error("ENOENT"));
      });

      const languages = await detectProjectLanguages("/project");
      expect(languages).toContain("go");
      expect(languages).not.toContain("typescript");
    });

    it("should detect python when pyproject.toml exists", async () => {
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith("pyproject.toml")) return Promise.resolve();
        return Promise.reject(new Error("ENOENT"));
      });

      const languages = await detectProjectLanguages("/project");
      expect(languages).toContain("python");
    });

    it("should detect multiple languages when multiple indicators exist", async () => {
      mockAccess.mockImplementation((path: string) => {
        if (
          path.endsWith("tsconfig.json") ||
          path.endsWith("go.mod") ||
          path.endsWith("Cargo.toml")
        ) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const languages = await detectProjectLanguages("/project");
      expect(languages).toContain("typescript");
      expect(languages).toContain("go");
      expect(languages).toContain("rust");
      expect(languages).toHaveLength(3);
    });

    it("should return empty array when no indicators found", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const languages = await detectProjectLanguages("/empty-project");
      expect(languages).toEqual([]);
    });

    it("should not duplicate languages when multiple indicators match for same language", async () => {
      // Both pyproject.toml and requirements.txt exist for python
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith("pyproject.toml") || path.endsWith("requirements.txt")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const languages = await detectProjectLanguages("/project");
      const pythonCount = languages.filter((l) => l === "python").length;
      expect(pythonCount).toBe(1);
    });

    it("should detect rust when Cargo.toml exists", async () => {
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith("Cargo.toml")) return Promise.resolve();
        return Promise.reject(new Error("ENOENT"));
      });

      const languages = await detectProjectLanguages("/project");
      expect(languages).toContain("rust");
    });

    it("should detect java when pom.xml exists", async () => {
      mockAccess.mockImplementation((path: string) => {
        if (path.endsWith("pom.xml")) return Promise.resolve();
        return Promise.reject(new Error("ENOENT"));
      });

      const languages = await detectProjectLanguages("/project");
      expect(languages).toContain("java");
    });
  });

  describe("isServerInstalled", () => {
    it("should return true when command exists on PATH", async () => {
      // isServerInstalled takes LSPLanguageId, not command string
      // It internally looks up the config and runs `which <command>`
      mockExecFileAsync.mockResolvedValue({
        stdout: "/usr/bin/typescript-language-server",
        stderr: "",
      });

      const result = await isServerInstalled("typescript");
      expect(result).toBe(true);
    });

    it("should return false when command is not found", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("not found"));

      // isServerInstalled takes a LSPLanguageId
      const result = await isServerInstalled("typescript");
      expect(result).toBe(false);
    });
  });

  describe("getServerConfig", () => {
    it("should return correct config for typescript", () => {
      const config = getServerConfig("typescript");
      expect(config).toBeDefined();
      expect(config.command).toBe("typescript-language-server");
      expect(config.args).toContain("--stdio");
    });

    it("should return correct config for go", () => {
      const config = getServerConfig("go");
      expect(config).toBeDefined();
      expect(config.command).toBe("gopls");
    });

    it("should return correct config for python", () => {
      const config = getServerConfig("python");
      expect(config).toBeDefined();
      // Source uses pyright-langserver, not pylsp
      expect(config.command).toBe("pyright-langserver");
    });

    it("should return correct config for rust", () => {
      const config = getServerConfig("rust");
      expect(config).toBeDefined();
      expect(config.command).toBe("rust-analyzer");
    });

    it("should return correct config for java", () => {
      const config = getServerConfig("java");
      expect(config).toBeDefined();
      expect(config.command).toBe("jdtls");
    });

    it("should return undefined for unsupported language", () => {
      // getServerConfig returns SERVER_CONFIGS[language], which is undefined for unknown keys
      const config = getServerConfig("brainfuck" as never);
      expect(config).toBeUndefined();
    });
  });
});
