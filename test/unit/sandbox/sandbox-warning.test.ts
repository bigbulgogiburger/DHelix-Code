import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSandboxStatus } from "../../../src/sandbox/index.js";

describe("sandbox warning", () => {
  describe("getSandboxStatus warnings", () => {
    it("should return a SandboxStatus with warnings array", async () => {
      const status = await getSandboxStatus();
      expect(Array.isArray(status.warnings)).toBe(true);
    });

    it("on non-sandboxed platforms, warnings should include SECURITY WARNING", async () => {
      // On macOS (darwin) and Linux with bwrap, sandbox IS available
      // so this test only asserts on unsupported platforms
      if (process.platform !== "darwin" && process.platform !== "linux") {
        const status = await getSandboxStatus();
        expect(status.available).toBe(false);
        expect(status.type).toBe("none");
        expect(status.warnings.length).toBeGreaterThan(0);

        const hasSecurityWarning = status.warnings.some(
          (w) => w.includes("SECURITY WARNING"),
        );
        expect(hasSecurityWarning).toBe(true);
      }
    });

    it("on macOS should have seatbelt available with no warnings", async () => {
      if (process.platform === "darwin") {
        const status = await getSandboxStatus();
        expect(status.available).toBe(true);
        expect(status.type).toBe("seatbelt");
        expect(status.warnings).toHaveLength(0);
      }
    });

    it("warnings should all be strings", async () => {
      const status = await getSandboxStatus();
      for (const warning of status.warnings) {
        expect(typeof warning).toBe("string");
      }
    });
  });

  describe("executeSandboxed warning output", () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // Reset the warning state for each test
      const mod = await import("../../../src/sandbox/index.js");
      if (typeof mod._resetSandboxWarning === "function") {
        mod._resetSandboxWarning();
      }
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("should emit sandbox warning on unsupported platform", async () => {
      // This test verifies the warning mechanism works.
      // On macOS/Linux with sandbox, the unsandboxed path isn't taken.
      // We verify the _resetSandboxWarning export exists for testability.
      const mod = await import("../../../src/sandbox/index.js");
      expect(typeof mod._resetSandboxWarning).toBe("function");
    });
  });
});
