import { describe, it, expect } from "vitest";

// ─── Module Import ───────────────────────────────────────────────────────────

async function getModule() {
  return await import("../../../../src/cli/components/agent-tabs-utils.js");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("agent-tabs-utils", () => {
  // ─── getTabShortcut ──────────────────────────────────────────────────────

  describe("getTabShortcut", () => {
    it("should return Alt+1 for index 0", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(0)).toBe("Alt+1");
    });

    it("should return Alt+2 for index 1", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(1)).toBe("Alt+2");
    });

    it("should return Alt+9 for index 8", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(8)).toBe("Alt+9");
    });

    it("should return empty string for index 9 (10th tab)", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(9)).toBe("");
    });

    it("should return empty string for index 10", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(10)).toBe("");
    });

    it("should return empty string for large index", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(99)).toBe("");
    });

    it("should return empty string for negative index", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(-1)).toBe("");
    });

    it("should map all indices 0-8 to Alt+1..Alt+9", async () => {
      const mod = await getModule();
      for (let i = 0; i < 9; i++) {
        expect(mod.getTabShortcut(i)).toBe(`Alt+${i + 1}`);
      }
    });
  });

  // ─── formatTabLabel ──────────────────────────────────────────────────────

  describe("formatTabLabel", () => {
    it("should format basic label without unread badge", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "explore", status: "active" as const };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] explore");
    });

    it("should include unread badge when unreadCount > 0", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "explore", status: "active" as const, unreadCount: 3 };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] explore (3)");
    });

    it("should not include badge when unreadCount is 0", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "explore", status: "idle" as const, unreadCount: 0 };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] explore");
    });

    it("should not include badge when unreadCount is undefined", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "explore", status: "idle" as const };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] explore");
    });

    it("should use index+1 as label number for indices 0-8", async () => {
      const mod = await getModule();
      const tab = { id: "5", name: "refactor", status: "idle" as const };
      expect(mod.formatTabLabel(tab, 4)).toBe("[5] refactor");
    });

    it("should use + as index label for 10th tab (index 9)", async () => {
      const mod = await getModule();
      const tab = { id: "10", name: "test", status: "idle" as const };
      expect(mod.formatTabLabel(tab, 9)).toBe("[+] test");
    });

    it("should use + as index label for tabs beyond 10 (index >= 9)", async () => {
      const mod = await getModule();
      const tab = { id: "11", name: "extra", status: "idle" as const };
      expect(mod.formatTabLabel(tab, 20)).toBe("[+] extra");
    });

    it("should combine + index with unread badge", async () => {
      const mod = await getModule();
      const tab = { id: "10", name: "overflow", status: "active" as const, unreadCount: 5 };
      expect(mod.formatTabLabel(tab, 9)).toBe("[+] overflow (5)");
    });

    it("should format large unread count correctly", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "busy", status: "active" as const, unreadCount: 99 };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] busy (99)");
    });

    it("should handle tab name with spaces", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "my agent", status: "idle" as const };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] my agent");
    });

    it("should format last shortcut index (index 8) correctly", async () => {
      const mod = await getModule();
      const tab = { id: "9", name: "last", status: "idle" as const, unreadCount: 1 };
      expect(mod.formatTabLabel(tab, 8)).toBe("[9] last (1)");
    });
  });

  // ─── getStatusIcon ───────────────────────────────────────────────────────

  describe("getStatusIcon", () => {
    it("should return ★ for active status", async () => {
      const mod = await getModule();
      expect(mod.getStatusIcon("active")).toBe("\u2605");
    });

    it("should return ○ for idle status", async () => {
      const mod = await getModule();
      expect(mod.getStatusIcon("idle")).toBe("\u25CB");
    });

    it("should return ● for completed status", async () => {
      const mod = await getModule();
      expect(mod.getStatusIcon("completed")).toBe("\u25CF");
    });

    it("should return ✗ for error status", async () => {
      const mod = await getModule();
      expect(mod.getStatusIcon("error")).toBe("\u2717");
    });
  });

  // ─── getTabColor ─────────────────────────────────────────────────────────

  describe("getTabColor", () => {
    it("should return #00E5FF for active status", async () => {
      const mod = await getModule();
      expect(mod.getTabColor("active")).toBe("#00E5FF");
    });

    it("should return gray for idle status", async () => {
      const mod = await getModule();
      expect(mod.getTabColor("idle")).toBe("gray");
    });

    it("should return #00BCD4 for completed status", async () => {
      const mod = await getModule();
      expect(mod.getTabColor("completed")).toBe("#00BCD4");
    });

    it("should return red for error status", async () => {
      const mod = await getModule();
      expect(mod.getTabColor("error")).toBe("red");
    });
  });

  // ─── Export Verification ─────────────────────────────────────────────────

  describe("exports", () => {
    it("should export getTabShortcut as a function", async () => {
      const mod = await getModule();
      expect(typeof mod.getTabShortcut).toBe("function");
    });

    it("should export formatTabLabel as a function", async () => {
      const mod = await getModule();
      expect(typeof mod.formatTabLabel).toBe("function");
    });

    it("should export getStatusIcon as a function", async () => {
      const mod = await getModule();
      expect(typeof mod.getStatusIcon).toBe("function");
    });

    it("should export getTabColor as a function", async () => {
      const mod = await getModule();
      expect(typeof mod.getTabColor).toBe("function");
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle empty tab name in formatTabLabel", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "", status: "idle" as const };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] ");
    });

    it("should handle unreadCount of 1 correctly", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "x", status: "idle" as const, unreadCount: 1 };
      expect(mod.formatTabLabel(tab, 0)).toBe("[1] x (1)");
    });

    it("getTabShortcut should be pure — same index returns same value", async () => {
      const mod = await getModule();
      expect(mod.getTabShortcut(3)).toBe(mod.getTabShortcut(3));
    });

    it("formatTabLabel should be pure — same input returns same output", async () => {
      const mod = await getModule();
      const tab = { id: "1", name: "agent", status: "active" as const, unreadCount: 2 };
      expect(mod.formatTabLabel(tab, 0)).toBe(mod.formatTabLabel(tab, 0));
    });
  });
});
