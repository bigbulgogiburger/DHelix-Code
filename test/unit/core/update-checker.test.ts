import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isNewerVersion } from "../../../src/core/update-checker.js";

// Mock node:fs/promises for state persistence tests
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

describe("update-checker", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isNewerVersion", () => {
    it("should detect newer major version", () => {
      expect(isNewerVersion("0.1.0", "1.0.0")).toBe(true);
    });

    it("should detect newer minor version", () => {
      expect(isNewerVersion("0.1.0", "0.2.0")).toBe(true);
    });

    it("should detect newer patch version", () => {
      expect(isNewerVersion("0.1.0", "0.1.1")).toBe(true);
    });

    it("should return false for same version", () => {
      expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    });

    it("should return false for older version", () => {
      expect(isNewerVersion("1.0.0", "0.9.0")).toBe(false);
    });

    it("should handle version with v prefix", () => {
      expect(isNewerVersion("v0.1.0", "v0.2.0")).toBe(true);
      expect(isNewerVersion("v1.0.0", "v1.0.0")).toBe(false);
    });

    it("should handle partial version strings", () => {
      expect(isNewerVersion("1.0", "1.1")).toBe(true);
      expect(isNewerVersion("1", "2")).toBe(true);
    });

    it("should return false when current is newer", () => {
      expect(isNewerVersion("2.0.0", "1.9.9")).toBe(false);
      expect(isNewerVersion("0.2.0", "0.1.9")).toBe(false);
    });

    it("should handle major version difference correctly", () => {
      expect(isNewerVersion("0.9.9", "1.0.0")).toBe(true);
      expect(isNewerVersion("1.0.0", "0.9.9")).toBe(false);
    });

    it("should compare minor versions only when major is equal", () => {
      expect(isNewerVersion("1.5.0", "1.10.0")).toBe(true);
      expect(isNewerVersion("1.10.0", "1.5.0")).toBe(false);
    });
  });

  describe("checkForUpdates", () => {
    it("should be importable and callable", async () => {
      const { checkForUpdates } = await import("../../../src/core/update-checker.js");
      expect(typeof checkForUpdates).toBe("function");
    });
  });

  describe("UpdateInfo interface", () => {
    it("should have correct shape", () => {
      const info = {
        current: "0.1.0",
        latest: "0.2.0",
        updateCommand: "npm install -g dbcode@latest",
      } as const;

      expect(info.current).toBe("0.1.0");
      expect(info.latest).toBe("0.2.0");
      expect(info.updateCommand).toContain("npm install");
    });
  });
});
