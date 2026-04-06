import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ApprovalDatabase } from "../../../src/permissions/approval-db.js";
import type { ApprovalRecord } from "../../../src/permissions/approval-db.js";

/** 테스트용 ApprovalRecord 팩토리 */
function makeRecord(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    tool: "bash_exec",
    command: "npm install",
    action: "allow",
    scope: "session",
    createdAt: Date.now(),
    expiresAt: null,
    ...overrides,
  };
}

describe("ApprovalDatabase", () => {
  let db: ApprovalDatabase;

  beforeEach(() => {
    // 인메모리 SQLite 사용 (테스트 격리)
    db = new ApprovalDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  // ─── save & findLatest ───────────────────────────────────────────────────

  describe("save and findLatest", () => {
    it("should save a record and find it by tool+command", () => {
      const record = makeRecord({ tool: "bash_exec", command: "npm install" });
      db.save(record);

      const found = db.findLatest("bash_exec", "npm install");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(record.id);
      expect(found?.action).toBe("allow");
    });

    it("should return null when no matching record exists", () => {
      const found = db.findLatest("bash_exec", "npm install");
      expect(found).toBeNull();
    });

    it("should return the most recent record when multiple exist", () => {
      const older = makeRecord({
        tool: "bash_exec",
        command: "npm install",
        action: "deny",
        createdAt: Date.now() - 10000,
      });
      const newer = makeRecord({
        tool: "bash_exec",
        command: "npm install",
        action: "allow",
        createdAt: Date.now(),
      });

      db.save(older);
      db.save(newer);

      const found = db.findLatest("bash_exec", "npm install");
      expect(found?.action).toBe("allow");
      expect(found?.id).toBe(newer.id);
    });

    it("should not return expired records", () => {
      const record = makeRecord({
        tool: "bash_exec",
        command: "npm install",
        expiresAt: Date.now() - 1000, // 이미 만료
      });
      db.save(record);

      const found = db.findLatest("bash_exec", "npm install");
      expect(found).toBeNull();
    });

    it("should return records with null expiresAt (永久 유효)", () => {
      const record = makeRecord({ expiresAt: null });
      db.save(record);

      const found = db.findLatest(record.tool, record.command);
      expect(found).not.toBeNull();
    });

    it("should return records not yet expired", () => {
      const record = makeRecord({
        expiresAt: Date.now() + 60_000, // 1분 후 만료
      });
      db.save(record);

      const found = db.findLatest(record.tool, record.command);
      expect(found).not.toBeNull();
    });

    it("should upsert when saving same id", () => {
      const record = makeRecord({ action: "allow" });
      db.save(record);

      const updated: ApprovalRecord = { ...record, action: "deny" };
      db.save(updated);

      const found = db.findLatest(record.tool, record.command);
      expect(found?.action).toBe("deny");
    });
  });

  // ─── query ───────────────────────────────────────────────────────────────

  describe("query", () => {
    beforeEach(() => {
      db.save(makeRecord({ id: "r1", tool: "bash_exec", command: "npm install", action: "allow", scope: "session" }));
      db.save(makeRecord({ id: "r2", tool: "bash_exec", command: "git push", action: "deny", scope: "project" }));
      db.save(makeRecord({ id: "r3", tool: "file_write", command: "src/index.ts", action: "allow", scope: "global" }));
    });

    it("should return all records with no filter", () => {
      const records = db.query();
      expect(records).toHaveLength(3);
    });

    it("should filter by tool", () => {
      const records = db.query({ tool: "bash_exec" });
      expect(records).toHaveLength(2);
      expect(records.every((r) => r.tool === "bash_exec")).toBe(true);
    });

    it("should filter by action", () => {
      const records = db.query({ action: "deny" });
      expect(records).toHaveLength(1);
      expect(records[0]?.command).toBe("git push");
    });

    it("should filter by scope", () => {
      const records = db.query({ scope: "global" });
      expect(records).toHaveLength(1);
      expect(records[0]?.tool).toBe("file_write");
    });

    it("should filter by tool and command together", () => {
      const records = db.query({ tool: "bash_exec", command: "npm install" });
      expect(records).toHaveLength(1);
      expect(records[0]?.id).toBe("r1");
    });

    it("should exclude expired records by default", () => {
      db.save(makeRecord({
        id: "expired",
        tool: "bash_exec",
        command: "old_cmd",
        expiresAt: Date.now() - 1000,
      }));

      const records = db.query({ tool: "bash_exec" });
      expect(records.every((r) => r.id !== "expired")).toBe(true);
    });

    it("should include expired records when includeExpired is true", () => {
      db.save(makeRecord({
        id: "expired",
        tool: "bash_exec",
        command: "old_cmd",
        expiresAt: Date.now() - 1000,
      }));

      const records = db.query({ tool: "bash_exec", includeExpired: true });
      expect(records.some((r) => r.id === "expired")).toBe(true);
    });
  });

  // ─── deleteExpired ────────────────────────────────────────────────────────

  describe("deleteExpired", () => {
    it("should delete expired records and return count", () => {
      db.save(makeRecord({ id: "valid", expiresAt: null }));
      db.save(makeRecord({ id: "exp1", expiresAt: Date.now() - 1000 }));
      db.save(makeRecord({ id: "exp2", expiresAt: Date.now() - 5000 }));

      const deleted = db.deleteExpired();
      expect(deleted).toBe(2);

      const remaining = db.query({ includeExpired: true });
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe("valid");
    });

    it("should return 0 when no expired records exist", () => {
      db.save(makeRecord({ expiresAt: null }));
      expect(db.deleteExpired()).toBe(0);
    });
  });

  // ─── clear ────────────────────────────────────────────────────────────────

  describe("clear", () => {
    beforeEach(() => {
      db.save(makeRecord({ id: "s1", scope: "session" }));
      db.save(makeRecord({ id: "p1", scope: "project" }));
      db.save(makeRecord({ id: "g1", scope: "global" }));
    });

    it("should clear only session-scoped records", () => {
      db.clear("session");
      const remaining = db.query({ includeExpired: true });
      expect(remaining).toHaveLength(2);
      expect(remaining.every((r) => r.scope !== "session")).toBe(true);
    });

    it("should clear only project-scoped records", () => {
      db.clear("project");
      const remaining = db.query({ includeExpired: true });
      expect(remaining).toHaveLength(2);
      expect(remaining.every((r) => r.scope !== "project")).toBe(true);
    });

    it("should clear only global-scoped records", () => {
      db.clear("global");
      const remaining = db.query({ includeExpired: true });
      expect(remaining).toHaveLength(2);
      expect(remaining.every((r) => r.scope !== "global")).toBe(true);
    });
  });

  // ─── close ────────────────────────────────────────────────────────────────

  describe("close", () => {
    it("should close without throwing", () => {
      const tempDb = new ApprovalDatabase(":memory:");
      expect(() => tempDb.close()).not.toThrow();
    });
  });
});
