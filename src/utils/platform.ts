import { platform as osPlatform, homedir, tmpdir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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

/** Check if running inside WSL (Windows Subsystem for Linux) */
export function isWSL(): boolean {
  return !!process.env.WSL_DISTRO_NAME;
}

/** Check if running inside WSL2 (kernel version 4.19+, contains "microsoft") */
export function isWSL2(): boolean {
  if (!isWSL()) return false;
  try {
    const procVersion = readFileSync("/proc/version", "utf-8").toLowerCase();
    if (!procVersion.includes("microsoft")) return false;
    // WSL2 has kernel version 4.19+ (WSL1 uses 4.4.x)
    const kernelMatch = procVersion.match(/(\d+)\.(\d+)/);
    if (!kernelMatch) return false;
    const major = parseInt(kernelMatch[1], 10);
    const minor = parseInt(kernelMatch[2], 10);
    return major > 4 || (major === 4 && minor >= 19);
  } catch {
    return false;
  }
}

/** Check if running inside WSL1 (WSL but not WSL2) */
export function isWSL1(): boolean {
  return isWSL() && !isWSL2();
}

/** Get the user's home directory */
export function getHomeDir(): string {
  return homedir();
}

/** Get the system temp directory */
export function getTempDir(): string {
  return tmpdir();
}

/** Common Git Bash installation paths on Windows */
const GIT_BASH_CANDIDATES: readonly string[] = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
];

/**
 * Attempt to find Git Bash on Windows.
 *
 * Search order:
 * 1. C:\Program Files\Git\bin\bash.exe
 * 2. C:\Program Files (x86)\Git\bin\bash.exe
 * 3. `where bash.exe` on PATH
 * 4. PROGRAMFILES env var
 *
 * Returns null if not found or not on Windows.
 */
export async function findGitBash(): Promise<string | null> {
  if (!isWindows()) return null;

  // 1 & 2: Check common installation paths
  for (const candidate of GIT_BASH_CANDIDATES) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // Ignore filesystem errors
    }
  }

  // 3: Check PATH via `where bash.exe`
  try {
    const result = execFileSync("where", ["bash.exe"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    }).trim();
    // `where` may return multiple lines; take the first one
    const firstLine = result.split(/\r?\n/)[0]?.trim();
    if (firstLine && existsSync(firstLine)) {
      return firstLine;
    }
  } catch {
    // `where` not available or bash.exe not on PATH
  }

  // 4: Check PROGRAMFILES env var
  const programFiles = process.env.PROGRAMFILES;
  if (programFiles) {
    const candidate = `${programFiles}\\Git\\bin\\bash.exe`;
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Synchronous version of shell command detection.
 * Returns cmd.exe on Windows, /bin/bash on Unix.
 * This preserves the original behavior for callers that cannot use async.
 */
export function getShellCommandSync(): string {
  return isWindows() ? "cmd.exe" : "/bin/bash";
}

/**
 * Get platform-specific shell command (async).
 * On Windows, prefers Git Bash over cmd.exe if available.
 * On Unix, returns /bin/bash.
 */
export async function getShellCommand(): Promise<string> {
  if (isWindows()) {
    const gitBash = await findGitBash();
    if (gitBash) return gitBash;
    // Fallback to cmd.exe with warning logged to stderr
    return "cmd.exe";
  }
  return "/bin/bash";
}

/**
 * Get platform-specific shell args for executing a command string.
 * Works for both bash-like shells (Git Bash, /bin/bash) and cmd.exe.
 */
export function getShellArgs(command: string, shell?: string): readonly string[] {
  // If the shell is cmd.exe, use /c; otherwise use -c (bash-style)
  if (shell === "cmd.exe" || (!shell && isWindows())) {
    return ["/c", command];
  }
  return ["-c", command];
}
