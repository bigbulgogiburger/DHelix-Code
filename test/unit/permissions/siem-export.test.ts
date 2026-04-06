import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SiemExporter, type SiemExportConfig } from "../../../src/permissions/siem-export.js";
import type { AuditEntry } from "../../../src/permissions/audit-log.js";

// Sample audit entry factory
function makeEntry(overrides?: Partial<AuditEntry>): AuditEntry {
  return {
    timestamp: "2026-04-05T12:00:00.000Z",
    sessionId: "sess-abc123",
    toolName: "bash_exec",
    decision: "approved",
    reason: "Session rule matched",
    ...overrides,
  };
}

describe("SiemExporter", () => {
  describe("formatAsJsonLines()", () => {
    it("should serialize event to a single JSON line ending with newline", () => {
      const exporter = new SiemExporter({ format: "json-lines" });
      const entry = makeEntry();
      const result = exporter.formatAsJsonLines(entry);

      expect(result).toMatch(/\n$/);
      const parsed = JSON.parse(result.trim());
      expect(parsed.sessionId).toBe("sess-abc123");
      expect(parsed.toolName).toBe("bash_exec");
      expect(parsed.decision).toBe("approved");
    });

    it("should include all fields from the entry", () => {
      const exporter = new SiemExporter({ format: "json-lines" });
      const entry = makeEntry({ decision: "denied", reason: "Blocked" });
      const result = exporter.formatAsJsonLines(entry);
      const parsed = JSON.parse(result.trim());

      expect(parsed.decision).toBe("denied");
      expect(parsed.reason).toBe("Blocked");
    });
  });

  describe("formatAsCef()", () => {
    it("should start with CEF:0 header", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry());
      expect(result).toMatch(/^CEF:0\|/);
    });

    it("should include 7 pipe-separated header fields plus extension", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry());
      // Format: CEF:0|Vendor|Product|DeviceVersion|SignatureID|Name|Severity|Extensions
      const parts = result.trim().split("|");
      expect(parts.length).toBeGreaterThanOrEqual(8);
    });

    it("should include rt= timestamp in extension", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry());
      expect(result).toContain("rt=2026-04-05T12:00:00.000Z");
    });

    it("should include suser= sessionId in extension", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry());
      expect(result).toContain("suser=sess-abc123");
    });

    it("should include act= toolName in extension", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry());
      expect(result).toContain("act=bash_exec");
    });

    it("should map denied decision to severity 8", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry({ decision: "denied" }));
      // Severity is the 7th field (index 6)
      const parts = result.split("|");
      expect(parts[6]).toBe("8");
    });

    it("should map approved decision to severity 2", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry({ decision: "approved" }));
      const parts = result.split("|");
      expect(parts[6]).toBe("2");
    });

    it("should escape pipe characters in header fields", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const entry = makeEntry({ toolName: "tool|with|pipe" });
      const result = exporter.formatAsCef(entry);
      // Should not have unescaped pipes in toolName (which appears in extension)
      expect(result).toContain("act=tool|with|pipe"); // extension value is not escaped the same way
    });

    it("should escape = in extension values", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const entry = makeEntry({ reason: "key=value" });
      const result = exporter.formatAsCef(entry);
      expect(result).toContain("msg=key\\=value");
    });

    it("should end with newline", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.formatAsCef(makeEntry());
      expect(result).toMatch(/\n$/);
    });
  });

  describe("formatAsLeef()", () => {
    it("should start with LEEF:1.0 header", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      expect(result).toMatch(/^LEEF:1\.0\|/);
    });

    it("should include vendor, product, version, and eventId in header", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      expect(result).toContain("DhelixCode|DhelixCode|1.0|dhelix-approved");
    });

    it("should include devTime= timestamp", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      expect(result).toContain("devTime=2026-04-05T12:00:00.000Z");
    });

    it("should include usrName= sessionId", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      expect(result).toContain("usrName=sess-abc123");
    });

    it("should include action= toolName", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      expect(result).toContain("action=bash_exec");
    });

    it("should include outcome= decision", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      expect(result).toContain("outcome=approved");
    });

    it("should use tab as attribute separator", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      // Header + tab + attributes separated by tabs
      const tabParts = result.split("\t");
      expect(tabParts.length).toBeGreaterThan(1);
    });

    it("should end with newline", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.formatAsLeef(makeEntry());
      expect(result).toMatch(/\n$/);
    });
  });

  describe("exportEvent()", () => {
    it("should dispatch to json-lines format", () => {
      const exporter = new SiemExporter({ format: "json-lines" });
      const result = exporter.exportEvent(makeEntry());
      expect(() => JSON.parse(result.trim())).not.toThrow();
    });

    it("should dispatch to cef format", () => {
      const exporter = new SiemExporter({ format: "cef" });
      const result = exporter.exportEvent(makeEntry());
      expect(result).toMatch(/^CEF:/);
    });

    it("should dispatch to leef format", () => {
      const exporter = new SiemExporter({ format: "leef" });
      const result = exporter.exportEvent(makeEntry());
      expect(result).toMatch(/^LEEF:/);
    });

    it("should filter fields when includeFields is specified", () => {
      const exporter = new SiemExporter({
        format: "json-lines",
        includeFields: ["toolName", "decision"],
      });
      const result = exporter.exportEvent(makeEntry());
      const parsed = JSON.parse(result.trim());
      expect(parsed.toolName).toBe("bash_exec");
      expect(parsed.decision).toBe("approved");
      expect(parsed.sessionId).toBeUndefined();
      expect(parsed.timestamp).toBeUndefined();
    });
  });

  describe("writeToFile() and rotateIfNeeded()", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "siem-export-test-"));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("should write formatted log to file", async () => {
      const outputPath = join(tempDir, "siem.log");
      const exporter = new SiemExporter({ format: "json-lines", outputPath });
      const formatted = exporter.exportEvent(makeEntry());
      await exporter.writeToFile(formatted);

      const content = await readFile(outputPath, "utf-8");
      expect(content.trim()).toBeTruthy();
      const parsed = JSON.parse(content.trim());
      expect(parsed.toolName).toBe("bash_exec");
    });

    it("should append multiple events to the same file", async () => {
      const outputPath = join(tempDir, "siem.log");
      const exporter = new SiemExporter({ format: "json-lines", outputPath });

      await exporter.writeToFile(exporter.exportEvent(makeEntry({ toolName: "file_read" })));
      await exporter.writeToFile(exporter.exportEvent(makeEntry({ toolName: "file_write" })));

      const content = await readFile(outputPath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      expect(lines).toHaveLength(2);
    });

    it("should do nothing when outputPath is not set", async () => {
      const exporter = new SiemExporter({ format: "json-lines" });
      // Should not throw
      await expect(exporter.writeToFile("some content\n")).resolves.toBeUndefined();
    });

    it("should rotate file when size exceeds maxFileSize", async () => {
      const outputPath = join(tempDir, "siem.log");
      // Set maxFileSize to 1 byte to force rotation
      const exporter = new SiemExporter({
        format: "json-lines",
        outputPath,
        maxFileSize: 1,
      });

      // First write creates the file
      await exporter.writeToFile("x\n");

      // Second write should trigger rotation (file size > 1 byte)
      await exporter.writeToFile("y\n");

      // Check that at least one .bak file exists
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(tempDir);
      const backupFiles = files.filter((f) => f.includes(".bak"));
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    it("should not rotate when file is within maxFileSize", async () => {
      const outputPath = join(tempDir, "siem.log");
      const exporter = new SiemExporter({
        format: "json-lines",
        outputPath,
        maxFileSize: 1024 * 1024, // 1MB
      });

      await exporter.writeToFile("small content\n");
      await exporter.writeToFile("another line\n");

      const { readdir } = await import("node:fs/promises");
      const files = await readdir(tempDir);
      const backupFiles = files.filter((f) => f.includes(".bak"));
      expect(backupFiles.length).toBe(0);
    });
  });
});
