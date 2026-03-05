import { platform as osPlatform, homedir, tmpdir } from "node:os";

/** Supported platforms */
export type Platform = "win32" | "darwin" | "linux";

/** Detect current OS platform */
export function getPlatform(): Platform {
  const p = osPlatform();
  if (p === "win32" || p === "darwin" || p === "linux") {
    return p;
  }
  return "linux";
}

/** Check if running on Windows */
export function isWindows(): boolean {
  return getPlatform() === "win32";
}

/** Check if running on macOS */
export function isMacOS(): boolean {
  return getPlatform() === "darwin";
}

/** Check if running on Linux */
export function isLinux(): boolean {
  return getPlatform() === "linux";
}

/** Get the user's home directory */
export function getHomeDir(): string {
  return homedir();
}

/** Get the system temp directory */
export function getTempDir(): string {
  return tmpdir();
}

/** Get platform-specific shell command */
export function getShellCommand(): string {
  return isWindows() ? "cmd.exe" : "/bin/bash";
}

/** Get platform-specific shell args for executing a command string */
export function getShellArgs(command: string): readonly string[] {
  return isWindows() ? ["/c", command] : ["-c", command];
}
