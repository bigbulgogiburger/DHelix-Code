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
      expect(shell).toBe("cmd.exe");
    } else {
      expect(shell).toBe("/bin/bash");
    }
  });

  it("should return shell args for command execution", () => {
    const args = getShellArgs("echo hello");
    expect(args.length).toBe(2);
    if (isWindows()) {
      expect(args[0]).toBe("/c");
    } else {
      expect(args[0]).toBe("-c");
    }
    expect(args[1]).toBe("echo hello");
  });
});
