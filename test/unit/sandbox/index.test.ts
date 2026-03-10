import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSandboxStatus, type SandboxStatus } from "../../../src/sandbox/index.js";

// We test getSandboxStatus by observing its behavior on the current platform
// rather than mocking the platform utilities, since the actual behavior
// is what matters for integration correctness.

describe("sandbox index", () => {
  describe("getSandboxStatus", () => {
    it("should return a valid SandboxStatus object", async () => {
      const status = await getSandboxStatus();

      expect(typeof status.available).toBe("boolean");
      expect(["seatbelt", "bubblewrap", "none"]).toContain(status.type);
      expect(Array.isArray(status.warnings)).toBe(true);
    });

    it("should return seatbelt on macOS", async () => {
      if (process.platform === "darwin") {
        const status = await getSandboxStatus();
        expect(status.type).toBe("seatbelt");
        expect(status.available).toBe(true);
        expect(status.warnings).toHaveLength(0);
      }
    });

    it("should return bubblewrap or none on Linux", async () => {
      if (process.platform === "linux") {
        const status = await getSandboxStatus();
        expect(["bubblewrap", "none"]).toContain(status.type);
      }
    });

    it("should return none on unsupported platforms", async () => {
      if (process.platform !== "darwin" && process.platform !== "linux") {
        const status = await getSandboxStatus();
        expect(status.type).toBe("none");
        expect(status.available).toBe(false);
        expect(status.warnings.length).toBeGreaterThan(0);
      }
    });

    it("warnings should be an array of strings", async () => {
      const status = await getSandboxStatus();
      for (const warning of status.warnings) {
        expect(typeof warning).toBe("string");
      }
    });
  });

  describe("platform routing", () => {
    it("should detect the current platform correctly", async () => {
      const status = await getSandboxStatus();

      if (process.platform === "darwin") {
        expect(status.type).toBe("seatbelt");
      } else if (process.platform === "linux") {
        // Could be bubblewrap or none depending on installation
        expect(["bubblewrap", "none"]).toContain(status.type);
      } else {
        expect(status.type).toBe("none");
      }
    });
  });
});
