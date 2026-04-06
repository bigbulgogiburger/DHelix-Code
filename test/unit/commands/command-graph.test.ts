/**
 * CommandGraph unit tests
 *
 * Covers registration, resolution (canonical name + alias), fuzzy search,
 * listing by source/category, removal, and error handling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CommandGraph, type UnifiedCommand } from "../../../src/commands/command-graph.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeCmd(
  name: string,
  overrides: Partial<UnifiedCommand> = {},
): UnifiedCommand {
  return {
    name,
    source: "builtin",
    description: `Description for ${name}`,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CommandGraph", () => {
  let graph: CommandGraph;

  beforeEach(() => {
    graph = new CommandGraph();
  });

  // ── register ─────────────────────────────────────────────────────────

  describe("register", () => {
    it("registers a command successfully", () => {
      graph.register(makeCmd("commit"));
      expect(graph.size).toBe(1);
    });

    it("throws on duplicate canonical name", () => {
      graph.register(makeCmd("commit"));
      expect(() => graph.register(makeCmd("commit"))).toThrow(/already registered/);
    });

    it("throws when canonical name conflicts with an existing alias", () => {
      graph.register(makeCmd("commit", { aliases: ["ci"] }));
      expect(() => graph.register(makeCmd("ci"))).toThrow();
    });

    it("throws when alias conflicts with an existing canonical name", () => {
      graph.register(makeCmd("commit"));
      expect(() =>
        graph.register(makeCmd("push", { aliases: ["commit"] })),
      ).toThrow();
    });

    it("throws when alias conflicts with another alias", () => {
      graph.register(makeCmd("commit", { aliases: ["ci"] }));
      expect(() =>
        graph.register(makeCmd("push", { aliases: ["ci"] })),
      ).toThrow();
    });

    it("registers multiple commands without collision", () => {
      graph.register(makeCmd("commit"));
      graph.register(makeCmd("push"));
      graph.register(makeCmd("pull"));
      expect(graph.size).toBe(3);
    });
  });

  // ── resolve ───────────────────────────────────────────────────────────

  describe("resolve", () => {
    it("resolves by canonical name", () => {
      const cmd = makeCmd("commit");
      graph.register(cmd);

      const resolved = graph.resolve("commit");
      expect(resolved).toBe(cmd);
    });

    it("resolves by alias", () => {
      const cmd = makeCmd("commit", { aliases: ["ci", "c"] });
      graph.register(cmd);

      expect(graph.resolve("ci")).toBe(cmd);
      expect(graph.resolve("c")).toBe(cmd);
    });

    it("returns undefined for unknown names", () => {
      expect(graph.resolve("nonexistent")).toBeUndefined();
    });

    it("is case-sensitive for resolution", () => {
      graph.register(makeCmd("Commit"));
      expect(graph.resolve("commit")).toBeUndefined();
      expect(graph.resolve("Commit")).toBeDefined();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("removes a command by canonical name", () => {
      graph.register(makeCmd("commit"));
      const removed = graph.remove("commit");

      expect(removed).toBe(true);
      expect(graph.size).toBe(0);
      expect(graph.resolve("commit")).toBeUndefined();
    });

    it("removes aliases when command is removed", () => {
      graph.register(makeCmd("commit", { aliases: ["ci"] }));
      graph.remove("commit");

      expect(graph.resolve("ci")).toBeUndefined();
    });

    it("returns false for non-existent command", () => {
      expect(graph.remove("nonexistent")).toBe(false);
    });

    it("allows re-registration after removal", () => {
      graph.register(makeCmd("commit", { aliases: ["ci"] }));
      graph.remove("commit");
      expect(() => graph.register(makeCmd("commit", { aliases: ["ci"] }))).not.toThrow();
    });
  });

  // ── search ────────────────────────────────────────────────────────────

  describe("search", () => {
    beforeEach(() => {
      graph.register(makeCmd("commit", {
        description: "Commit staged changes to git",
        category: "git",
      }));
      graph.register(makeCmd("push", {
        description: "Push commits to remote",
        category: "git",
        aliases: ["p"],
      }));
      graph.register(makeCmd("model", {
        description: "Switch the active LLM model",
        category: "config",
      }));
    });

    it("returns all commands for empty query", () => {
      expect(graph.search("").length).toBe(3);
    });

    it("returns all commands for whitespace-only query", () => {
      expect(graph.search("   ").length).toBe(3);
    });

    it("matches by exact name (highest priority)", () => {
      const results = graph.search("commit");
      expect(results[0].name).toBe("commit");
    });

    it("matches by name prefix", () => {
      const results = graph.search("mod");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("model");
    });

    it("matches by alias prefix", () => {
      const results = graph.search("p");
      expect(results.some((r) => r.name === "push")).toBe(true);
    });

    it("matches by description substring", () => {
      const results = graph.search("LLM");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("model");
    });

    it("matches by category", () => {
      const results = graph.search("git");
      expect(results.every((r) => r.category === "git")).toBe(true);
      expect(results.length).toBe(2);
    });

    it("returns empty array for no matches", () => {
      const results = graph.search("xyzzy_no_match");
      expect(results).toHaveLength(0);
    });

    it("is case-insensitive", () => {
      const results = graph.search("COMMIT");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ── listBySource ──────────────────────────────────────────────────────

  describe("listBySource", () => {
    it("returns only commands from the specified source", () => {
      graph.register(makeCmd("commit", { source: "builtin" }));
      graph.register(makeCmd("mcptool", { source: "mcp" }));
      graph.register(makeCmd("myskill", { source: "skill" }));

      const builtins = graph.listBySource("builtin");
      expect(builtins).toHaveLength(1);
      expect(builtins[0].name).toBe("commit");

      const mcpCmds = graph.listBySource("mcp");
      expect(mcpCmds).toHaveLength(1);

      const skillCmds = graph.listBySource("skill");
      expect(skillCmds).toHaveLength(1);
    });

    it("returns empty array if no commands from source", () => {
      graph.register(makeCmd("commit", { source: "builtin" }));
      expect(graph.listBySource("plugin")).toHaveLength(0);
    });
  });

  // ── listByCategory ────────────────────────────────────────────────────

  describe("listByCategory", () => {
    it("returns only commands from the specified category", () => {
      graph.register(makeCmd("commit", { category: "git" }));
      graph.register(makeCmd("push", { category: "git" }));
      graph.register(makeCmd("model", { category: "config" }));

      const gitCmds = graph.listByCategory("git");
      expect(gitCmds).toHaveLength(2);
      expect(gitCmds.every((c) => c.category === "git")).toBe(true);
    });

    it("returns empty array if no commands in category", () => {
      graph.register(makeCmd("commit", { category: "git" }));
      expect(graph.listByCategory("network")).toHaveLength(0);
    });
  });

  // ── getAll ────────────────────────────────────────────────────────────

  describe("getAll", () => {
    it("returns all registered commands", () => {
      graph.register(makeCmd("a"));
      graph.register(makeCmd("b"));
      graph.register(makeCmd("c"));

      const all = graph.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((c) => c.name).sort()).toEqual(["a", "b", "c"]);
    });

    it("returns empty array when no commands registered", () => {
      expect(graph.getAll()).toHaveLength(0);
    });
  });

  // ── size ──────────────────────────────────────────────────────────────

  describe("size", () => {
    it("reflects the number of registered commands", () => {
      expect(graph.size).toBe(0);
      graph.register(makeCmd("a"));
      expect(graph.size).toBe(1);
      graph.register(makeCmd("b"));
      expect(graph.size).toBe(2);
      graph.remove("a");
      expect(graph.size).toBe(1);
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles commands with no aliases or category", () => {
      const cmd: UnifiedCommand = {
        name: "minimal",
        source: "plugin",
        description: "Minimal command",
      };
      graph.register(cmd);
      expect(graph.resolve("minimal")).toBe(cmd);
    });

    it("supports all source types", () => {
      graph.register(makeCmd("a", { source: "builtin" }));
      graph.register(makeCmd("b", { source: "mcp" }));
      graph.register(makeCmd("c", { source: "skill" }));
      graph.register(makeCmd("d", { source: "plugin" }));

      expect(graph.size).toBe(4);
    });
  });
});
