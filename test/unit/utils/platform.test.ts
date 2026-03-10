import { describe, it, expect } from "vitest";
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
  getShellType,
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
      if (hasGitBash()) {
        // Git Bash found — shell should point to bash.exe
        expect(shell).toContain("bash.exe");
      } else {
        expect(shell).toBe("cmd.exe");
      }
    } else {
      // On Unix, returns SHELL env var or /bin/bash
      expect(shell.length).toBeGreaterThan(0);
    }
  });

  it("should return shell args for command execution", () => {
    const args = getShellArgs("echo hello");
    expect(args.length).toBe(2);
    if (isWindows() && !hasGitBash()) {
      expect(args[0]).toBe("/c");
    } else {
      // bash and git-bash both use -c
      expect(args[0]).toBe("-c");
    }
    expect(args[1]).toBe("echo hello");
  });

  it("should report hasGitBash consistently with getShellType", () => {
    if (!isWindows()) {
      expect(hasGitBash()).toBe(false);
      expect(getShellType()).toBe("bash");
    } else if (hasGitBash()) {
      expect(getShellType()).toBe("git-bash");
    } else {
      expect(getShellType()).toBe("cmd");
    }
  });

  it("should return a valid shell type", () => {
    const shellType = getShellType();
    expect(["bash", "git-bash", "cmd", "powershell"]).toContain(shellType);
  });
});
