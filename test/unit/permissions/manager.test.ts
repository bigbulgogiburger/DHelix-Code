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

  // --- Backward compatibility ---

  it("should work without persistent rules (backward compatible)", () => {
    const pm = new PermissionManager("default", []);
    const result = pm.check("file_read", "safe");

    expect(result.allowed).toBe(true);
  });

  // --- Persistent deny rules ---

  describe("persistent deny rules", () => {
    it("should deny when persistent deny rule matches", () => {
      const pm = new PermissionManager("default", [], {
        deny: ["Bash(rm -rf *)"],
      });

      const result = pm.check("Bash", "confirm", { command: "rm -rf /" });
      expect(result.allowed).toBe(false);
      expect(result.requiresPrompt).toBe(false);
      expect(result.reason).toBe("Persistent deny rule");
    });

    it("should deny even in dontAsk mode", () => {
      const pm = new PermissionManager("dontAsk", [], {
        deny: ["Bash(rm -rf *)"],
      });

      const result = pm.check("Bash", "confirm", { command: "rm -rf /" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Persistent deny rule");
    });

    it("should deny even in bypassPermissions mode", () => {
      const pm = new PermissionManager("bypassPermissions", [], {
        deny: ["Bash(rm -rf *)"],
      });

      const result = pm.check("Bash", "confirm", { command: "rm -rf /" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Persistent deny rule");
    });

    it("should deny even when session approved", () => {
      const pm = new PermissionManager("default", [], {
        deny: ["Bash(rm -rf *)"],
      });

      pm.approveAll("Bash");
      const result = pm.check("Bash", "confirm", { command: "rm -rf /" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Persistent deny rule");
    });

    it("should deny over persistent allow rules", () => {
      const pm = new PermissionManager("default", [], {
        allow: ["Bash(rm *)"],
        deny: ["Bash(rm -rf *)"],
      });

      // "rm -rf /tmp" matches both allow Bash(rm *) and deny Bash(rm -rf *)
      // Deny always wins
      const result = pm.check("Bash", "confirm", { command: "rm -rf /tmp" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Persistent deny rule");
    });

    it("should deny with tool-name-only pattern", () => {
      const pm = new PermissionManager("default", [], {
        deny: ["web_search"],
      });

      const result = pm.check("web_search", "confirm");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Persistent deny rule");
    });

    it("should not deny non-matching tool", () => {
      const pm = new PermissionManager("dontAsk", [], {
        deny: ["Bash(rm -rf *)"],
      });

      const result = pm.check("Bash", "confirm", { command: "npm install" });
      expect(result.allowed).toBe(true);
    });
  });

  // --- Persistent allow rules ---

  describe("persistent allow rules", () => {
    it("should allow when persistent allow rule matches", () => {
      const pm = new PermissionManager("default", [], {
        allow: ["Bash(npm *)"],
      });

      const result = pm.check("Bash", "confirm", { command: "npm install" });
      expect(result.allowed).toBe(true);
      expect(result.requiresPrompt).toBe(false);
      expect(result.reason).toBe("Persistent allow rule");
    });

    it("should allow with tool-name-only pattern", () => {
      const pm = new PermissionManager("default", [], {
        allow: ["file_write"],
      });

      const result = pm.check("file_write", "confirm");
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Persistent allow rule");
    });

    it("should allow with path glob", () => {
      const pm = new PermissionManager("default", [], {
        allow: ["Edit(/src/**)"],
      });

      const result = pm.check("Edit", "confirm", { path: "/src/foo/bar.ts" });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Persistent allow rule");
    });

    it("should not allow non-matching args", () => {
      const pm = new PermissionManager("default", [], {
        allow: ["Bash(npm *)"],
      });

      const result = pm.check("Bash", "confirm", { command: "yarn install" });
      // Falls through to mode-based check
      expect(result.requiresPrompt).toBe(true);
    });

    it("should fall through to explicit rules if no allow match", () => {
      const pm = new PermissionManager(
        "default",
        [{ toolName: "file_write", allowed: true }],
        { allow: ["Bash(npm *)"] },
      );

      const result = pm.check("file_write", "confirm");
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Rule: allowed");
    });
  });

  // --- Check order verification ---

  describe("check order: deny > session > allow > rules > mode", () => {
    it("session approvals checked before persistent allow", () => {
      const pm = new PermissionManager("default", [], {
        allow: ["Bash(npm *)"],
      });

      pm.approve("Bash", { command: "npm install" });
      const result = pm.check("Bash", "confirm", { command: "npm install" });
      // Session approval is checked first (step 2), so reason reflects that
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Session approved");
    });

    it("persistent allow checked before explicit rules", () => {
      const pm = new PermissionManager(
        "default",
        [{ toolName: "Bash", allowed: false }],
        { allow: ["Bash(npm *)"] },
      );

      const result = pm.check("Bash", "confirm", { command: "npm install" });
      // Persistent allow (step 3) fires before explicit rules (step 4)
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Persistent allow rule");
    });

    it("explicit rules checked before mode", () => {
      const pm = new PermissionManager(
        "default",
        [{ toolName: "file_write", allowed: true }],
      );

      const result = pm.check("file_write", "confirm");
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Rule: allowed");
    });
  });

  // --- Malformed patterns graceful degradation ---

  describe("malformed persistent patterns", () => {
    it("should silently skip malformed patterns", () => {
      const pm = new PermissionManager("default", [], {
        allow: ["Bash(", "valid_tool", ""],
        deny: ["(bad)", "Bash(rm *)"],
      });

      // "valid_tool" should still work
      const r1 = pm.check("valid_tool", "confirm");
      expect(r1.allowed).toBe(true);
      expect(r1.reason).toBe("Persistent allow rule");

      // "Bash(rm *)" should still work
      const r2 = pm.check("Bash", "confirm", { command: "rm /tmp/test" });
      expect(r2.allowed).toBe(false);
      expect(r2.reason).toBe("Persistent deny rule");
    });
  });
});
