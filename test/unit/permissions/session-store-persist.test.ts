import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionApprovalStore } from "../../../src/permissions/session-store.js";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PERSIST_PATH = join(homedir(), ".dhelix", "session-approvals.json");

function cleanupPersistFile(): void {
  try {
    unlinkSync(PERSIST_PATH);
  } catch {
    // File may not exist
  }
}

describe("SessionApprovalStore persistence", () => {
  beforeEach(() => {
    cleanupPersistFile();
  });

  afterEach(() => {
    cleanupPersistFile();
  });

  it("should save and load approvals", async () => {
    const store = new SessionApprovalStore();
    store.approve("file_read");
    store.approve("grep_search");
    await store.save();

    const newStore = new SessionApprovalStore();
    await newStore.load();
    expect(newStore.isApproved("file_read")).toBe(true);
    expect(newStore.isApproved("grep_search")).toBe(true);
    expect(newStore.isApproved("file_write")).toBe(false);
  });

  it("should handle load when no file exists", async () => {
    const newStore = new SessionApprovalStore();
    // Should not throw
    await expect(newStore.load()).resolves.toBeUndefined();
    expect(newStore.size).toBe(0);
  });

  it("should merge loaded approvals with existing ones", async () => {
    const store = new SessionApprovalStore();
    store.approve("file_read");
    await store.save();

    const newStore = new SessionApprovalStore();
    newStore.approve("bash_exec");
    await newStore.load();

    expect(newStore.isApproved("file_read")).toBe(true);
    expect(newStore.isApproved("bash_exec")).toBe(true);
  });

  it("should handle save errors gracefully", async () => {
    const store = new SessionApprovalStore();
    // save() has a try-catch, so should not throw even if path is invalid
    await expect(store.save()).resolves.toBeUndefined();
  });
});
