import { describe, it, expect, beforeEach } from "vitest";
import { PolicyEngine, TomlParseError } from "../../../src/permissions/policy-engine.js";
import type { ToolPolicy } from "../../../src/permissions/policy-engine.js";

describe("PolicyEngine", () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  // ─── loadFromObject ────────────────────────────────────────────────────────

  describe("loadFromObject", () => {
    it("should load a simple policy and return it", () => {
      const policy: ToolPolicy = {
        defaultAction: "ask",
        rules: { allow: ["npm *"], deny: ["rm -rf *"] },
      };
      engine.loadFromObject({ bash_exec: policy });

      expect(engine.getToolPolicy("bash_exec")).toEqual(policy);
    });

    it("should list loaded policies", () => {
      const policy: ToolPolicy = { defaultAction: "allow", rules: {} };
      engine.loadFromObject({ file_read: policy });

      expect(engine.listPolicies()).toHaveProperty("file_read");
    });

    it("should overwrite existing policy with same tool name", () => {
      engine.loadFromObject({ file_read: { defaultAction: "allow", rules: {} } });
      engine.loadFromObject({ file_read: { defaultAction: "deny", rules: {} } });

      expect(engine.getToolPolicy("file_read")?.defaultAction).toBe("deny");
    });
  });

  // ─── evaluate ─────────────────────────────────────────────────────────────

  describe("evaluate", () => {
    beforeEach(() => {
      engine.loadFromObject({
        bash_exec: {
          defaultAction: "ask",
          rules: {
            allow: ["npm *", "git *"],
            deny: ["rm -rf *", "sudo *"],
            ask: ["curl *"],
          },
        },
        file_read: {
          defaultAction: "allow",
          rules: {},
        },
        file_write: {
          defaultAction: "deny",
          rules: {
            allow: ["*.ts", "*.js"],
          },
        },
      });
    });

    it("should return allow for matching allow pattern", () => {
      expect(engine.evaluate("bash_exec", "npm install")).toBe("allow");
      expect(engine.evaluate("bash_exec", "git push")).toBe("allow");
    });

    it("should return deny for matching deny pattern", () => {
      expect(engine.evaluate("bash_exec", "rm -rf /tmp")).toBe("deny");
      expect(engine.evaluate("bash_exec", "sudo apt-get install")).toBe("deny");
    });

    it("should return ask for matching ask pattern", () => {
      expect(engine.evaluate("bash_exec", "curl https://example.com")).toBe("ask");
    });

    it("should return defaultAction when no pattern matches", () => {
      expect(engine.evaluate("bash_exec", "echo hello")).toBe("ask");
      expect(engine.evaluate("file_read", "/any/path")).toBe("allow");
    });

    it("should prioritize deny over allow", () => {
      // deny 패턴이 allow보다 우선순위 높음
      engine.loadFromObject({
        test_tool: {
          defaultAction: "ask",
          rules: {
            allow: ["rm *"],
            deny: ["rm -rf *"],
          },
        },
      });
      // "rm -rf /" 은 allow "rm *"도 매칭되지만, deny "rm -rf *"가 우선
      expect(engine.evaluate("test_tool", "rm -rf /")).toBe("deny");
      // "rm file.txt"는 deny에 매칭 안됨 → allow
      expect(engine.evaluate("test_tool", "rm file.txt")).toBe("allow");
    });

    it("should return ask for unknown tool (no policy)", () => {
      expect(engine.evaluate("unknown_tool", "anything")).toBe("ask");
    });

    it("should handle wildcard patterns correctly", () => {
      expect(engine.evaluate("file_write", "main.ts")).toBe("allow");
      expect(engine.evaluate("file_write", "main.js")).toBe("allow");
      expect(engine.evaluate("file_write", "main.py")).toBe("deny"); // defaultAction
    });
  });

  // ─── specificity (longest-match-wins) ─────────────────────────────────────

  describe("specificity — longest-match-wins", () => {
    it("should prefer more specific deny over generic allow when both match", () => {
      engine.loadFromObject({
        bash_exec: {
          defaultAction: "ask",
          rules: {
            allow: ["git *"],
            deny: ["git push --force"],
          },
        },
      });

      expect(engine.evaluate("bash_exec", "git push --force")).toBe("deny");
      expect(engine.evaluate("bash_exec", "git commit -m 'fix'")).toBe("allow");
    });
  });

  // ─── loadFromToml ──────────────────────────────────────────────────────────

  describe("loadFromToml", () => {
    it("should parse simple TOML with defaultAction", () => {
      engine.loadFromToml(`
[tool.file_read]
defaultAction = "allow"
      `);

      const policy = engine.getToolPolicy("file_read");
      expect(policy?.defaultAction).toBe("allow");
    });

    it("should parse TOML with arrays", () => {
      engine.loadFromToml(`
[tool.bash_exec]
defaultAction = "ask"
allow = ["npm install", "npm run *"]
deny = ["rm -rf *", "sudo *"]
      `);

      const policy = engine.getToolPolicy("bash_exec");
      expect(policy?.rules.allow).toContain("npm install");
      expect(policy?.rules.allow).toContain("npm run *");
      expect(policy?.rules.deny).toContain("rm -rf *");
    });

    it("should parse TOML with timeoutMs and maxOutputBytes", () => {
      engine.loadFromToml(`
[tool.bash_exec]
defaultAction = "ask"
timeoutMs = 30000
maxOutputBytes = 1048576
      `);

      const policy = engine.getToolPolicy("bash_exec");
      expect(policy?.timeoutMs).toBe(30000);
      expect(policy?.maxOutputBytes).toBe(1048576);
    });

    it("should parse multiple tool sections", () => {
      engine.loadFromToml(`
[tool.bash_exec]
defaultAction = "ask"

[tool.file_read]
defaultAction = "allow"

[tool.file_write]
defaultAction = "deny"
      `);

      expect(engine.getToolPolicy("bash_exec")?.defaultAction).toBe("ask");
      expect(engine.getToolPolicy("file_read")?.defaultAction).toBe("allow");
      expect(engine.getToolPolicy("file_write")?.defaultAction).toBe("deny");
    });

    it("should ignore comments in TOML", () => {
      engine.loadFromToml(`
# This is a comment
[tool.file_read]
# Another comment
defaultAction = "allow" # inline comment
      `);

      expect(engine.getToolPolicy("file_read")?.defaultAction).toBe("allow");
    });

    it("should ignore TOML without [tool.*] section", () => {
      engine.loadFromToml(`
[other_section]
key = "value"
      `);

      expect(Object.keys(engine.listPolicies())).toHaveLength(0);
    });

    it("should throw TomlParseError for unclosed section", () => {
      expect(() => {
        engine.loadFromToml("[tool.bash_exec\ndefaultAction = \"ask\"");
      }).toThrow(TomlParseError);
    });

    it("should evaluate correctly after TOML load", () => {
      engine.loadFromToml(`
[tool.bash_exec]
defaultAction = "ask"
allow = ["npm *", "git status"]
deny = ["rm -rf *"]
      `);

      expect(engine.evaluate("bash_exec", "npm install")).toBe("allow");
      expect(engine.evaluate("bash_exec", "rm -rf /home")).toBe("deny");
      expect(engine.evaluate("bash_exec", "echo hello")).toBe("ask");
    });
  });
});
