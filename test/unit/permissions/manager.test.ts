import { describe, it, expect } from "vitest";
import { PermissionManager } from "../../../src/permissions/manager.js";

describe("PermissionManager", () => {
  it("should auto-allow safe tools in default mode", () => {
    const pm = new PermissionManager("default");
    const result = pm.check("file_read", "safe");

    expect(result.allowed).toBe(true);
    expect(result.requiresPrompt).toBe(false);
  });

  it("should require prompt for confirm tools in default mode", () => {
    const pm = new PermissionManager("default");
    const result = pm.check("file_write", "confirm");

    expect(result.allowed).toBe(false);
    expect(result.requiresPrompt).toBe(true);
  });

  it("should auto-allow confirm tools in acceptEdits mode", () => {
    const pm = new PermissionManager("acceptEdits");
    const result = pm.check("file_write", "confirm");

    expect(result.allowed).toBe(true);
    expect(result.requiresPrompt).toBe(false);
  });

  it("should block all non-safe tools in plan mode", () => {
    const pm = new PermissionManager("plan");

    expect(pm.check("file_read", "safe").allowed).toBe(true);
    expect(pm.check("file_write", "confirm").allowed).toBe(false);
    expect(pm.check("file_write", "confirm").requiresPrompt).toBe(false);
  });

  it("should allow everything in dontAsk mode", () => {
    const pm = new PermissionManager("dontAsk");

    expect(pm.check("bash_exec", "dangerous").allowed).toBe(true);
    expect(pm.check("bash_exec", "dangerous").requiresPrompt).toBe(false);
  });

  it("should respect session approvals", () => {
    const pm = new PermissionManager("default");

    expect(pm.check("file_write", "confirm").allowed).toBe(false);

    pm.approve("file_write");
    expect(pm.check("file_write", "confirm").allowed).toBe(true);
  });

  it("should respect approveAll", () => {
    const pm = new PermissionManager("default");

    pm.approveAll("bash_exec");
    expect(pm.check("bash_exec", "confirm").allowed).toBe(true);
  });

  it("should respect explicit rules", () => {
    const pm = new PermissionManager("default", [{ toolName: "file_write", allowed: true }]);

    const result = pm.check("file_write", "confirm");
    expect(result.allowed).toBe(true);
    expect(result.requiresPrompt).toBe(false);
  });

  it("should support mode changes", () => {
    const pm = new PermissionManager("default");

    pm.setMode("dontAsk");
    expect(pm.getMode()).toBe("dontAsk");
    expect(pm.check("bash_exec", "dangerous").allowed).toBe(true);
  });

  it("should match rules with argument patterns", () => {
    const pm = new PermissionManager("default", [
      { toolName: "bash_exec", pattern: "rm *", allowed: false },
    ]);

    // Should match: bash_exec with command arg matching "rm *"
    const denied = pm.check("bash_exec", "confirm", { command: "rm -rf /" });
    expect(denied.allowed).toBe(false);

    // Should NOT match: different argument value
    const allowed = pm.check("bash_exec", "confirm", { command: "ls -la" });
    // Falls through to mode check (default mode + confirm = prompt)
    expect(allowed.requiresPrompt).toBe(true);
  });

  it("should support wildcard tool names in rules", () => {
    const pm = new PermissionManager("default", [{ toolName: "file_*", allowed: true }]);

    expect(pm.check("file_read", "safe").allowed).toBe(true);
    expect(pm.check("file_write", "confirm").allowed).toBe(true);
    // Non-matching tool falls through to mode check
    expect(pm.check("bash_exec", "confirm").requiresPrompt).toBe(true);
  });

  it("should add rules dynamically with addRule", () => {
    const pm = new PermissionManager("default");

    expect(pm.check("file_write", "confirm").requiresPrompt).toBe(true);

    pm.addRule({ toolName: "file_write", allowed: true });
    expect(pm.check("file_write", "confirm").allowed).toBe(true);
  });

  it("should clear session approvals", () => {
    const pm = new PermissionManager("default");

    pm.approve("file_write");
    expect(pm.check("file_write", "confirm").allowed).toBe(true);

    pm.clearSession();
    expect(pm.check("file_write", "confirm").requiresPrompt).toBe(true);
  });
});
