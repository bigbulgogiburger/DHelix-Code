import { describe, it, expect } from "vitest";
import { SessionApprovalStore } from "../../../src/permissions/session-store.js";

describe("SessionApprovalStore", () => {
  it("should not approve unapproved tools", () => {
    const store = new SessionApprovalStore();
    expect(store.isApproved("file_write")).toBe(false);
  });

  it("should approve a tool by name", () => {
    const store = new SessionApprovalStore();
    store.approve("file_write");
    expect(store.isApproved("file_write")).toBe(true);
  });

  it("should approve a tool with specific path args", () => {
    const store = new SessionApprovalStore();
    store.approve("file_write", { path: "/tmp/test.txt" });
    expect(store.isApproved("file_write", { path: "/tmp/test.txt" })).toBe(true);
    // Different path should not be approved
    expect(store.isApproved("file_write", { path: "/tmp/other.txt" })).toBe(false);
  });

  it("should approveAll to approve any args for a tool", () => {
    const store = new SessionApprovalStore();
    store.approveAll("bash_exec");
    expect(store.isApproved("bash_exec")).toBe(true);
    expect(store.isApproved("bash_exec", { command: "rm -rf" })).toBe(true);
  });

  it("should clear all approvals", () => {
    const store = new SessionApprovalStore();
    store.approve("file_write");
    store.approveAll("bash_exec");
    expect(store.size).toBe(2);

    store.clear();
    expect(store.size).toBe(0);
    expect(store.isApproved("file_write")).toBe(false);
    expect(store.isApproved("bash_exec")).toBe(false);
  });

  it("should track size correctly", () => {
    const store = new SessionApprovalStore();
    expect(store.size).toBe(0);
    store.approve("a");
    expect(store.size).toBe(1);
    store.approve("b");
    expect(store.size).toBe(2);
  });

  it("should build key with path from args", () => {
    const store = new SessionApprovalStore();
    store.approve("file_write", { path: "/a.txt" });
    // Tool-level check should fail (path-specific only)
    expect(store.isApproved("file_write")).toBe(false);
    // Args without path should use tool-name only key
    store.approve("file_write", { command: "test" });
    expect(store.isApproved("file_write")).toBe(true);
  });
});
