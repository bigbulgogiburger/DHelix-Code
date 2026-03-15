import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { retryWithCorrection, type CorrectedToolCall } from "../../../src/tools/tool-retry.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp", "tool-retry");

describe("retryWithCorrection", () => {
  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
    // Create test files
    await writeFile(join(tmpDir, "index.ts"), "export const x = 1;", "utf-8");
    await writeFile(join(tmpDir, "utils.ts"), "export const y = 2;", "utf-8");
    await writeFile(join(tmpDir, "config.json"), "{}", "utf-8");
    await writeFile(join(tmpDir, "README.md"), "# Test", "utf-8");
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("ENOENT (file not found)", () => {
    it("should find closest matching file for typos", async () => {
      const result = await retryWithCorrection(
        "file_read",
        { file_path: join(tmpDir, "indx.ts") },
        new Error("ENOENT: no such file or directory"),
        tmpDir,
      );

      expect(result).not.toBeNull();
      expect(result!.args["file_path"]).toBe(join(tmpDir, "index.ts"));
      expect(result!.reason).toContain("corrected to closest match");
    });

    it("should find closest match for minor extension typos", async () => {
      const result = await retryWithCorrection(
        "file_read",
        { file_path: join(tmpDir, "index.tsx") },
        new Error("ENOENT: no such file or directory"),
        tmpDir,
      );

      expect(result).not.toBeNull();
      expect(result!.args["file_path"]).toBe(join(tmpDir, "index.ts"));
    });

    it("should return null when no close match exists", async () => {
      const result = await retryWithCorrection(
        "file_read",
        { file_path: join(tmpDir, "completely-different-name.xyz") },
        new Error("ENOENT: no such file or directory"),
        tmpDir,
      );

      expect(result).toBeNull();
    });

    it("should return null when file path is missing from args", async () => {
      const result = await retryWithCorrection(
        "file_read",
        { content: "some content" },
        new Error("ENOENT: no such file or directory"),
        tmpDir,
      );

      expect(result).toBeNull();
    });

    it("should handle 'path' key in addition to 'file_path'", async () => {
      const result = await retryWithCorrection(
        "glob_search",
        { path: join(tmpDir, "utls.ts") },
        new Error("ENOENT: no such file"),
        tmpDir,
      );

      expect(result).not.toBeNull();
      expect(result!.args["path"]).toBe(join(tmpDir, "utils.ts"));
    });

    it("should return null when directory does not exist", async () => {
      const result = await retryWithCorrection(
        "file_read",
        { file_path: "/nonexistent/directory/file.ts" },
        new Error("ENOENT: no such file or directory"),
        tmpDir,
      );

      expect(result).toBeNull();
    });

    it("should handle 'not found' error messages", async () => {
      const result = await retryWithCorrection(
        "file_read",
        { file_path: join(tmpDir, "indx.ts") },
        new Error("File not found"),
        tmpDir,
      );

      expect(result).not.toBeNull();
      expect(result!.args["file_path"]).toBe(join(tmpDir, "index.ts"));
    });
  });

  describe("Permission denied", () => {
    it("should return null for EACCES errors", async () => {
      const result = await retryWithCorrection(
        "file_write",
        { file_path: join(tmpDir, "index.ts"), content: "test" },
        new Error("EACCES: permission denied"),
        tmpDir,
      );

      expect(result).toBeNull();
    });

    it("should return null for permission denied message", async () => {
      const result = await retryWithCorrection(
        "bash_exec",
        { command: "rm -rf /" },
        new Error("Permission denied"),
        tmpDir,
      );

      expect(result).toBeNull();
    });
  });

  describe("Invalid JSON / parse errors", () => {
    it("should repair stringified JSON with trailing commas", async () => {
      const result = await retryWithCorrection(
        "custom_tool",
        { data: '{"key": "value",}' },
        new Error("Invalid JSON: unexpected token"),
        tmpDir,
      );

      expect(result).not.toBeNull();
      expect(result!.args["data"]).toEqual({ key: "value" });
      expect(result!.reason).toContain("Repaired malformed JSON");
    });

    it("should repair single-quoted JSON", async () => {
      const result = await retryWithCorrection(
        "custom_tool",
        { data: "{'key': 'value'}" },
        new Error("Parse error in arguments"),
        tmpDir,
      );

      expect(result).not.toBeNull();
      expect(result!.args["data"]).toEqual({ key: "value" });
    });

    it("should return null when JSON cannot be repaired", async () => {
      const result = await retryWithCorrection(
        "custom_tool",
        { data: "not json at all" },
        new Error("Invalid JSON"),
        tmpDir,
      );

      expect(result).toBeNull();
    });

    it("should return null when args have no repairable values", async () => {
      const result = await retryWithCorrection(
        "custom_tool",
        { count: 5, flag: true },
        new Error("Invalid arguments"),
        tmpDir,
      );

      expect(result).toBeNull();
    });

    it("should handle 'invalid arg' error messages", async () => {
      const result = await retryWithCorrection(
        "custom_tool",
        { config: '{"port": 3000,}' },
        new Error("invalid argument format"),
        tmpDir,
      );

      expect(result).not.toBeNull();
      expect(result!.args["config"]).toEqual({ port: 3000 });
    });
  });

  describe("Unknown errors", () => {
    it("should return null for unknown error types", async () => {
      const result = await retryWithCorrection(
        "file_read",
        { file_path: "/some/path.ts" },
        new Error("Something completely unexpected"),
        tmpDir,
      );

      expect(result).toBeNull();
    });
  });
});
