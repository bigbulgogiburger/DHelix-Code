import { describe, it, expect } from "vitest";
import { checkPermissionByMode, getModeDescription } from "../../../src/permissions/modes.js";

describe("permissions/modes", () => {
  describe("checkPermissionByMode", () => {
    it("bypassPermissions allows everything", () => {
      expect(checkPermissionByMode("bypassPermissions", "safe").allowed).toBe(true);
      expect(checkPermissionByMode("bypassPermissions", "confirm").allowed).toBe(true);
      expect(checkPermissionByMode("bypassPermissions", "dangerous").allowed).toBe(true);
    });

    it("dontAsk allows everything", () => {
      expect(checkPermissionByMode("dontAsk", "safe").allowed).toBe(true);
      expect(checkPermissionByMode("dontAsk", "confirm").allowed).toBe(true);
      expect(checkPermissionByMode("dontAsk", "dangerous").allowed).toBe(true);
    });

    it("plan only allows safe tools", () => {
      const safe = checkPermissionByMode("plan", "safe");
      expect(safe.allowed).toBe(true);

      const confirm = checkPermissionByMode("plan", "confirm");
      expect(confirm.allowed).toBe(false);
      expect(confirm.reason).toContain("Plan mode");

      const dangerous = checkPermissionByMode("plan", "dangerous");
      expect(dangerous.allowed).toBe(false);
    });

    it("acceptEdits allows safe and confirm, prompts for dangerous", () => {
      const safe = checkPermissionByMode("acceptEdits", "safe");
      expect(safe.allowed).toBe(true);
      expect(safe.requiresPrompt).toBe(false);

      const confirm = checkPermissionByMode("acceptEdits", "confirm");
      expect(confirm.allowed).toBe(true);
      expect(confirm.requiresPrompt).toBe(false);

      const dangerous = checkPermissionByMode("acceptEdits", "dangerous");
      expect(dangerous.allowed).toBe(false);
      expect(dangerous.requiresPrompt).toBe(true);
    });

    it("default allows safe, prompts for confirm and dangerous", () => {
      const safe = checkPermissionByMode("default", "safe");
      expect(safe.allowed).toBe(true);

      const confirm = checkPermissionByMode("default", "confirm");
      expect(confirm.allowed).toBe(false);
      expect(confirm.requiresPrompt).toBe(true);

      const dangerous = checkPermissionByMode("default", "dangerous");
      expect(dangerous.allowed).toBe(false);
      expect(dangerous.requiresPrompt).toBe(true);
    });
  });

  describe("getModeDescription", () => {
    it("should return descriptions for all modes", () => {
      expect(getModeDescription("default")).toContain("confirmation");
      expect(getModeDescription("acceptEdits")).toContain("Auto-approve");
      expect(getModeDescription("plan")).toContain("Read-only");
      expect(getModeDescription("dontAsk")).toContain("Auto-approve");
      expect(getModeDescription("bypassPermissions")).toContain("Bypass");
    });
  });
});
