import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPlatform,
  isWindows,
  isMacOS,
  isLinux,
  getHomeDir,
  getTempDir,
  getShellCommand,
  getShellArgs,
  hasGitBash,
  isWSL,
  isWSL1,
  isWSL2,
} from "../../../src/utils/platform.js";

describe("platform", () => {
  it("should return a valid platform", () => {
    const platform = getPlatform();
    expect(["win32", "darwin", "linux"]).toContain(platform);
  });

  it("should detect Windows correctly", () => {
    const platform = getPlatform();
    expect(isWindows()).toBe(platform === "win32");
  });

  it("should detect macOS correctly", () => {
    const platform = getPlatform();
    expect(isMacOS()).toBe(platform === "darwin");
  });

  it("should detect Linux correctly", () => {
    const platform = getPlatform();
    expect(isLinux()).toBe(platform === "linux");
  });

  it("should return a home directory", () => {
    const home = getHomeDir();
    expect(home.length).toBeGreaterThan(0);
  });

  it("should return a temp directory", () => {
    const temp = getTempDir();
    expect(temp.length).toBeGreaterThan(0);
  });

  it("should return shell command based on platform", () => {
    const shell = getShellCommand();
    if (isWindows()) {
      // On Windows, could be Git Bash or cmd.exe
      expect(shell).toMatch(/bash\.exe$|cmd\.exe$/);
    } else {
      // On Unix, returns SHELL env var or /bin/bash as fallback
      // Could be /bin/bash, /bin/zsh, /usr/bin/fish, etc.
      expect(shell.length).toBeGreaterThan(0);
      expect(shell).toMatch(/^\//); // Should be an absolute path
    }
  });

  it("should return shell args for command execution", () => {
    const args = getShellArgs("echo hello");
    expect(args.length).toBe(2);
    // bash and git-bash both use -c
    expect(args[0]).toBe("-c");
    expect(args[1]).toBe("echo hello");
  });

  it("should return bash-style args when shell is explicitly bash", () => {
    const args = getShellArgs("echo hello", "/usr/bin/bash");
    expect(args[0]).toBe("-c");
    expect(args[1]).toBe("echo hello");
  });

  it("should return cmd-style args when shell is explicitly cmd.exe", () => {
    const args = getShellArgs("echo hello", "cmd.exe");
    expect(args[0]).toBe("/c");
    expect(args[1]).toBe("echo hello");
  });

  it("should return bash-style args when shell is a Git Bash path", () => {
    const args = getShellArgs("echo hello", "C:\\Program Files\\Git\\bin\\bash.exe");
    expect(args[0]).toBe("-c");
    expect(args[1]).toBe("echo hello");
  });
});

describe("hasGitBash", () => {
  it("should return false on non-Windows platforms", () => {
    if (!isWindows()) {
      expect(hasGitBash()).toBe(false);
    }
  });

  it("should not throw even if Git is not installed", () => {
    // hasGitBash should never crash, just return a boolean
    const result = hasGitBash();
    expect(typeof result).toBe("boolean");
  });
});

describe("WSL detection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Restore env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("isWSL should return false when WSL_DISTRO_NAME is not set", () => {
    delete process.env.WSL_DISTRO_NAME;
    expect(isWSL()).toBe(false);
  });

  it("isWSL should return true when WSL_DISTRO_NAME is set", () => {
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    expect(isWSL()).toBe(true);
  });

  it("isWSL2 should return false when not in WSL", () => {
    delete process.env.WSL_DISTRO_NAME;
    expect(isWSL2()).toBe(false);
  });

  it("isWSL1 should return false when not in WSL", () => {
    delete process.env.WSL_DISTRO_NAME;
    expect(isWSL1()).toBe(false);
  });

  it("isWSL1 should be true when WSL but not WSL2", () => {
    // On non-Linux systems, isWSL2 will return false because /proc/version doesn't exist
    // So if WSL_DISTRO_NAME is set, isWSL1 should be true (WSL minus WSL2)
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    // On macOS/non-WSL Linux, /proc/version won't contain "microsoft"
    // so isWSL2() returns false, making isWSL1() return true
    if (!isWSL2()) {
      expect(isWSL1()).toBe(true);
    }
  });
});
