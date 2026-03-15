import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuditLogger, type AuditEntry } from "../../../src/permissions/audit-log.js";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("AuditLogger", () => {
  let tempDir: string;
  let logPath: string;
  let logger: AuditLogger;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "audit-log-test-"));
    logPath = join(tempDir, "audit.jsonl");
    logger = new AuditLogger(logPath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const makeEntry = (overrides?: Partial<AuditEntry>): AuditEntry => ({
    timestamp: new Date().toISOString(),
    sessionId: "test-session-001",
    toolName: "bash_exec",
    decision: "approved",
    ...overrides,
  });

  describe("log", () => {
    it("should create the log file and write an entry", async () => {
      const entry = makeEntry();
      await logger.log(entry);

      const content = await readFile(logPath, "utf-8");
      const parsed = JSON.parse(content.trim());
      expect(parsed.sessionId).toBe("test-session-001");
      expect(parsed.toolName).toBe("bash_exec");
      expect(parsed.decision).toBe("approved");
    });

    it("should append multiple entries as separate JSONL lines", async () => {
      await logger.log(makeEntry({ toolName: "file_read" }));
      await logger.log(makeEntry({ toolName: "file_write" }));
      await logger.log(makeEntry({ toolName: "bash_exec" }));

      const content = await readFile(logPath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      expect(lines).toHaveLength(3);

      const entries = lines.map((l) => JSON.parse(l));
      expect(entries[0].toolName).toBe("file_read");
      expect(entries[1].toolName).toBe("file_write");
      expect(entries[2].toolName).toBe("bash_exec");
    });

    it("should include optional reason field", async () => {
      const entry = makeEntry({
        decision: "denied",
        reason: "Destructive command blocked",
      });
      await logger.log(entry);

      const content = await readFile(logPath, "utf-8");
      const parsed = JSON.parse(content.trim());
      expect(parsed.reason).toBe("Destructive command blocked");
      expect(parsed.decision).toBe("denied");
    });

    it("should create nested directories if needed", async () => {
      const nestedPath = join(tempDir, "nested", "dir", "audit.jsonl");
      const nestedLogger = new AuditLogger(nestedPath);

      await nestedLogger.log(makeEntry());

      const content = await readFile(nestedPath, "utf-8");
      expect(content.trim().length).toBeGreaterThan(0);
    });

    it("should handle all decision types", async () => {
      await logger.log(makeEntry({ decision: "approved" }));
      await logger.log(makeEntry({ decision: "denied" }));
      await logger.log(makeEntry({ decision: "auto-approved" }));

      const entries = await logger.getRecentEntries();
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.decision)).toEqual([
        "approved",
        "denied",
        "auto-approved",
      ]);
    });
  });

  describe("getRecentEntries", () => {
    it("should return empty array when log file does not exist", async () => {
      const freshLogger = new AuditLogger(join(tempDir, "nonexistent.jsonl"));
      const entries = await freshLogger.getRecentEntries();
      expect(entries).toHaveLength(0);
    });

    it("should return all entries when count exceeds total", async () => {
      await logger.log(makeEntry({ toolName: "tool_a" }));
      await logger.log(makeEntry({ toolName: "tool_b" }));

      const entries = await logger.getRecentEntries(100);
      expect(entries).toHaveLength(2);
    });

    it("should return only the last N entries when count is specified", async () => {
      for (let i = 0; i < 10; i++) {
        await logger.log(makeEntry({ toolName: `tool_${i}` }));
      }

      const entries = await logger.getRecentEntries(3);
      expect(entries).toHaveLength(3);
      expect(entries[0].toolName).toBe("tool_7");
      expect(entries[1].toolName).toBe("tool_8");
      expect(entries[2].toolName).toBe("tool_9");
    });

    it("should default to 50 entries", async () => {
      // Write 5 entries and verify all are returned with default count
      for (let i = 0; i < 5; i++) {
        await logger.log(makeEntry({ toolName: `tool_${i}` }));
      }

      const entries = await logger.getRecentEntries();
      expect(entries).toHaveLength(5);
    });

    it("should skip malformed JSONL lines gracefully", async () => {
      // Write valid entry, then corrupt line, then valid entry
      const { appendFile } = await import("node:fs/promises");
      await logger.log(makeEntry({ toolName: "valid_1" }));
      await appendFile(logPath, "this is not json\n", "utf-8");
      await logger.log(makeEntry({ toolName: "valid_2" }));

      const entries = await logger.getRecentEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].toolName).toBe("valid_1");
      expect(entries[1].toolName).toBe("valid_2");
    });
  });
});
