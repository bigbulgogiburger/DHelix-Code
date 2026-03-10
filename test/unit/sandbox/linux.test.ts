import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateBwrapArgs,
  hasBubblewrap,
  isWSL,
  isWSL1,
  type LinuxSandboxConfig,
} from "../../../src/sandbox/linux.js";

describe("linux sandbox", () => {
  describe("generateBwrapArgs", () => {
    const baseConfig: LinuxSandboxConfig = {
      command: "/bin/echo",
      args: ["hello", "world"],
      projectDir: "/home/user/project",
      homeDir: "/home/user",
    };

    it("should mount system paths read-only", () => {
      const args = generateBwrapArgs(baseConfig);

      // Verify each system path is mounted read-only
      const systemPaths = ["/usr", "/bin", "/lib", "/lib64", "/etc", "/sbin"];
      for (const sysPath of systemPaths) {
        const roBindIdx = args.indexOf(sysPath);
        expect(roBindIdx).toBeGreaterThan(-1);
        // Pattern: --ro-bind, source, dest  (source === dest for system paths)
        expect(args[roBindIdx - 1]).toBe("--ro-bind");
        // dest follows source
        expect(args[roBindIdx + 1]).toBe(sysPath);
      }
    });

    it("should mount /proc and /dev", () => {
      const args = generateBwrapArgs(baseConfig);

      const procIdx = args.indexOf("/proc");
      expect(procIdx).toBeGreaterThan(-1);
      expect(args[procIdx - 1]).toBe("--proc");

      const devIdx = args.indexOf("/dev");
      expect(devIdx).toBeGreaterThan(-1);
      expect(args[devIdx - 1]).toBe("--dev");
    });

    it("should mount /tmp as tmpfs", () => {
      const args = generateBwrapArgs(baseConfig);

      const tmpIdx = args.indexOf("/tmp");
      // Find the tmpfs mount (not the system ro-bind)
      const tmpfsIdx = args.indexOf("--tmpfs");
      expect(tmpfsIdx).toBeGreaterThan(-1);
      expect(args[tmpfsIdx + 1]).toBe("/tmp");
    });

    it("should mount project directory read-write", () => {
      const args = generateBwrapArgs(baseConfig);

      const bindIdx = args.indexOf("--bind");
      expect(bindIdx).toBeGreaterThan(-1);
      expect(args[bindIdx + 1]).toBe("/home/user/project");
      expect(args[bindIdx + 2]).toBe("/home/user/project");
    });

    it("should mount home config paths read-only with --ro-bind-try", () => {
      const args = generateBwrapArgs(baseConfig);

      const configPaths = [
        ".config",
        ".local",
        ".npm",
        ".node_modules",
        ".cache",
        ".nvm",
        ".volta",
        ".rustup",
        ".cargo",
        ".dbcode",
        ".claude",
        ".git",
      ];

      for (const subPath of configPaths) {
        const fullPath = `/home/user/${subPath}`;
        const idx = args.indexOf(fullPath);
        expect(idx, `Expected ${fullPath} to be in bwrap args`).toBeGreaterThan(-1);
        // Pattern: --ro-bind-try, source, dest (source === dest)
        expect(args[idx - 1]).toBe("--ro-bind-try");
      }
    });

    it("should include isolation flags", () => {
      const args = generateBwrapArgs(baseConfig);

      expect(args).toContain("--unshare-pid");
      expect(args).toContain("--die-with-parent");
      expect(args).toContain("--new-session");
    });

    it("should allow network by default", () => {
      const args = generateBwrapArgs(baseConfig);

      expect(args).not.toContain("--unshare-net");
    });

    it("should restrict network when allowNetwork is false", () => {
      const args = generateBwrapArgs({
        ...baseConfig,
        allowNetwork: false,
      });

      expect(args).toContain("--unshare-net");
    });

    it("should include command and args after separator", () => {
      const args = generateBwrapArgs(baseConfig);

      const separatorIdx = args.indexOf("--");
      expect(separatorIdx).toBeGreaterThan(-1);
      expect(args[separatorIdx + 1]).toBe("/bin/echo");
      expect(args[separatorIdx + 2]).toBe("hello");
      expect(args[separatorIdx + 3]).toBe("world");
    });

    it("should handle empty args", () => {
      const args = generateBwrapArgs({
        command: "/bin/ls",
        projectDir: "/home/user/project",
        homeDir: "/home/user",
      });

      const separatorIdx = args.indexOf("--");
      expect(args[separatorIdx + 1]).toBe("/bin/ls");
      // No further args after command
      expect(args.length).toBe(separatorIdx + 2);
    });

    it("should use HOME env var as fallback when homeDir not specified", () => {
      const originalHome = process.env.HOME;
      process.env.HOME = "/home/testuser";

      try {
        const args = generateBwrapArgs({
          command: "/bin/ls",
          projectDir: "/tmp/project",
        });

        expect(args).toContain("/home/testuser/.config");
      } finally {
        process.env.HOME = originalHome;
      }
    });
  });

  describe("hasBubblewrap", () => {
    it("should return a boolean", async () => {
      const result = await hasBubblewrap();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("isWSL", () => {
    it("should return a boolean", async () => {
      const result = await isWSL();
      expect(typeof result).toBe("boolean");
    });

    // On macOS / non-Linux, this should return false (no /proc/version)
    it("should return false on non-Linux platforms", async () => {
      if (process.platform !== "linux") {
        const result = await isWSL();
        expect(result).toBe(false);
      }
    });
  });

  describe("isWSL1", () => {
    it("should return a boolean", async () => {
      const result = await isWSL1();
      expect(typeof result).toBe("boolean");
    });

    it("should return false when WSL_DISTRO_NAME is not set", async () => {
      const original = process.env.WSL_DISTRO_NAME;
      delete process.env.WSL_DISTRO_NAME;

      try {
        const result = await isWSL1();
        expect(result).toBe(false);
      } finally {
        if (original !== undefined) {
          process.env.WSL_DISTRO_NAME = original;
        }
      }
    });
  });
});
