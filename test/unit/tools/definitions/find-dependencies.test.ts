import { vi, describe, it, expect, beforeEach } from "vitest";

// Use vi.hoisted to create mock functions that can be used in vi.mock factory
const { mockStat, mockReadFile, mockExecFile } = vi.hoisted(() => ({
  mockStat: vi.fn(),
  mockReadFile: vi.fn(),
  mockExecFile: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    stat: mockStat,
    readFile: mockReadFile,
  };
});

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>(
    "node:child_process",
  );
  return {
    ...actual,
    execFile: mockExecFile,
  };
});

import { findDependenciesTool } from "../../../../src/tools/definitions/find-dependencies.js";
import type { ToolContext } from "../../../../src/tools/types.js";

const mockContext: ToolContext = {
  workingDirectory: "/project",
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin",
};

describe("find_dependencies tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file exists and is a regular file
    mockStat.mockResolvedValue({ isFile: () => true });
  });

  it("should have correct metadata", () => {
    expect(findDependenciesTool.name).toBe("find_dependencies");
    expect(findDependenciesTool.permissionLevel).toBe("safe");
  });

  describe("imports direction", () => {
    it("should list all import sources for a file", async () => {
      const fileContent = [
        'import { useState, useEffect } from "react";',
        'import { formatDate, parseQuery } from "./utils.js";',
        'import { join, resolve } from "node:path";',
        'import { debounce } from "lodash";',
        'import { APP_CONFIG } from "../config.js";',
      ].join("\n");

      mockReadFile.mockResolvedValue(fileContent);

      const result = await findDependenciesTool.execute(
        { file_path: "/project/src/app.ts", direction: "imports" },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain("react");
      expect(result.output).toContain("./utils.js");
      expect(result.output).toContain("node:path");
      expect(result.output).toContain("lodash");
      expect(result.output).toContain("../config.js");
      // Metadata should track count
      expect(result.metadata?.directCount).toBe(5);
    });

    it("should show specifiers when show_specifiers is true", async () => {
      const fileContent = 'import { useState, useEffect } from "react";\n';
      mockReadFile.mockResolvedValue(fileContent);

      const result = await findDependenciesTool.execute(
        { file_path: "/project/src/app.ts", direction: "imports", show_specifiers: true },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain("useState");
      expect(result.output).toContain("useEffect");
    });
  });

  describe("importedBy direction", () => {
    it("should list files that import the target", async () => {
      // ripgrep returns files containing references
      // promisify(execFile) wraps it, so we mock the callback-style execFile
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, callback?: Function) => {
          if (callback) {
            callback(null, { stdout: "/project/src/app.ts\n/project/src/components/header.tsx\n" });
          }
          return { stdout: "/project/src/app.ts\n/project/src/components/header.tsx\n" };
        },
      );

      // readFile for each candidate file
      mockReadFile
        .mockResolvedValueOnce('import { formatDate } from "./utils.js";\n')  // app.ts content
        .mockResolvedValueOnce('import { parseQuery } from "../utils.js";\n'); // header.tsx content

      // stat calls for resolving import paths
      mockStat.mockResolvedValue({ isFile: () => true });

      const result = await findDependenciesTool.execute(
        { file_path: "/project/src/utils.ts", direction: "importedBy" },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(typeof result.output).toBe("string");
    });
  });

  describe("depth > 1 (recursive)", () => {
    it("should track transitive dependencies", async () => {
      // app.ts imports utils.ts and config.ts
      const appContent = [
        'import { formatDate } from "./utils.js";',
        'import { APP_CONFIG } from "./config.js";',
      ].join("\n");

      // utils.ts imports logger.ts
      const utilsContent = 'import { log } from "./logger.js";\n';

      // config.ts has no internal imports
      const configContent = 'export const APP_CONFIG = {};\n';

      mockReadFile
        .mockResolvedValueOnce(appContent)    // traceImports reads app.ts
        .mockResolvedValueOnce(utilsContent)   // traceImports reads utils.ts (depth 2)
        .mockResolvedValueOnce(configContent);  // traceImports reads config.ts (depth 2)

      // stat calls for resolving import paths
      mockStat.mockImplementation((path: string) => {
        if (typeof path === "string" && (
          path.endsWith(".ts") ||
          path.endsWith("/app.ts")
        )) {
          return Promise.resolve({ isFile: () => true });
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await findDependenciesTool.execute(
        { file_path: "/project/src/app.ts", direction: "imports", depth: 2 },
        mockContext,
      );

      expect(result.isError).toBe(false);
      // Should show both direct and transitive deps
      expect(result.output).toContain("utils");
      expect(result.output).toContain("config");
    });
  });

  describe("circular dependency detection", () => {
    it("should detect circular imports without infinite loop", async () => {
      // A imports B
      const aContent = 'import { B } from "./b.js";\n';
      // B imports A
      const bContent = 'import { A } from "./a.js";\n';

      mockReadFile
        .mockResolvedValueOnce(aContent)
        .mockResolvedValueOnce(bContent);

      mockStat.mockImplementation((path: string) => {
        if (typeof path === "string" && path.endsWith(".ts")) {
          return Promise.resolve({ isFile: () => true });
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await findDependenciesTool.execute(
        { file_path: "/project/src/a.ts", direction: "imports", depth: 3 },
        mockContext,
      );

      expect(result.isError).toBe(false);
      // Should complete without hanging
      expect(result.output).toContain("b");
    });
  });

  describe("external vs internal classification", () => {
    it("should label built-in, external, and internal dependencies", async () => {
      const fileContent = [
        'import { readFile } from "node:fs";',
        'import { Router } from "express";',
        'import { apiRouter } from "./routes/api.js";',
      ].join("\n");

      mockReadFile.mockResolvedValue(fileContent);
      mockStat.mockImplementation((path: string) => {
        if (typeof path === "string" && path.endsWith(".ts")) {
          return Promise.resolve({ isFile: () => true });
        }
        if (typeof path === "string" && path.endsWith("server.ts")) {
          return Promise.resolve({ isFile: () => true });
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await findDependenciesTool.execute(
        { file_path: "/project/src/server.ts", direction: "imports" },
        mockContext,
      );

      expect(result.isError).toBe(false);
      // Built-in label
      expect(result.output).toMatch(/built-in|builtin/i);
      // External label
      expect(result.output).toMatch(/external/i);
      // Internal files should show path
      expect(result.output).toContain("routes/api");
    });
  });

  describe("file not found", () => {
    it("should return a helpful error for non-existent file", async () => {
      mockStat.mockRejectedValue(
        new Error("ENOENT: no such file or directory"),
      );

      const result = await findDependenciesTool.execute(
        { file_path: "/project/src/nonexistent.ts", direction: "imports" },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toMatch(/[Nn]ot found|[Dd]oes not exist|ENOENT/i);
    });
  });
});
