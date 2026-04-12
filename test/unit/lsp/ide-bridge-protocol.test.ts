/**
 * IDE Bridge Protocol — Unit Tests
 *
 * Tests IPC protocol definitions: socket path generation,
 * protocol version export, and type correctness.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { platform } from "node:os";

import {
  getSocketPath,
  IDE_BRIDGE_PROTOCOL_VERSION,
} from "../../../src/lsp/ide-bridge-protocol.js";

describe("ide-bridge-protocol", () => {
  describe("getSocketPath", () => {
    it("should generate a deterministic path from workspace path", () => {
      const path1 = getSocketPath("/Users/test/project");
      const path2 = getSocketPath("/Users/test/project");
      expect(path1).toBe(path2);
    });

    it("should generate different paths for different workspaces", () => {
      const path1 = getSocketPath("/Users/test/project-a");
      const path2 = getSocketPath("/Users/test/project-b");
      expect(path1).not.toBe(path2);
    });

    it("should contain dhelix-bridge prefix in the path", () => {
      const socketPath = getSocketPath("/test/project");
      expect(socketPath).toContain("dhelix-bridge-");
    });

    it("should use the first 8 chars of md5 hash", () => {
      const workspace = "/test/my-project";
      const expectedHash = createHash("md5")
        .update(workspace)
        .digest("hex")
        .slice(0, 8);
      const socketPath = getSocketPath(workspace);
      expect(socketPath).toContain(expectedHash);
    });

    it("should use /tmp/ prefix with .sock extension on Unix", () => {
      if (platform() === "win32") return; // Skip on Windows
      const socketPath = getSocketPath("/test/project");
      expect(socketPath).toMatch(/^\/tmp\/dhelix-bridge-[a-f0-9]{8}\.sock$/);
    });

    it("should use named pipe format on Windows", () => {
      // We cannot reliably test this on non-Windows, but we verify
      // the format conceptually via the hash calculation
      if (platform() !== "win32") return;
      const socketPath = getSocketPath("/test/project");
      expect(socketPath).toMatch(/^\\\\.\\pipe\\dhelix-bridge-[a-f0-9]{8}$/);
    });

    it("should handle empty workspace path", () => {
      const socketPath = getSocketPath("");
      expect(socketPath).toContain("dhelix-bridge-");
      // Empty string still produces a valid md5 hash
      const hash = createHash("md5").update("").digest("hex").slice(0, 8);
      expect(socketPath).toContain(hash);
    });

    it("should handle workspace paths with special characters", () => {
      const socketPath = getSocketPath("/Users/test/my project (2)/src");
      expect(socketPath).toContain("dhelix-bridge-");
      expect(socketPath).toMatch(/[a-f0-9]{8}/);
    });

    it("should produce exactly 8-char hex hash segment", () => {
      const socketPath = getSocketPath("/any/path");
      const match = socketPath.match(/dhelix-bridge-([a-f0-9]+)/);
      expect(match).not.toBeNull();
      expect(match![1]).toHaveLength(8);
    });
  });

  describe("IDE_BRIDGE_PROTOCOL_VERSION", () => {
    it("should export a valid semver version string", () => {
      expect(IDE_BRIDGE_PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should be 1.0.0 for initial protocol release", () => {
      expect(IDE_BRIDGE_PROTOCOL_VERSION).toBe("1.0.0");
    });
  });
});
