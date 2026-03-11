import { platform as osPlatform, homedir, tmpdir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Supported platforms */
export type Platform = "win32" | "darwin" | "linux";

/** Shell type identifier */
export type ShellType = "bash" | "git-bash" | "cmd" | "powershell";

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

/**
 * Find Git Bash executable on Windows.
 * Checks user override (GIT_BASH_PATH env var), standard install locations,
 * and attempts to derive the path from git.exe on PATH.
 */
function findGitBash(): string | null {
  if (!isWindows()) return null;

  const candidates: readonly (string | undefined)[] = [
    process.env.GIT_BASH_PATH,
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  // Try deriving bash.exe location from git.exe on PATH.
  // git.exe is typically at C:\Program Files\Git\cmd\git.exe
  // bash.exe is at              C:\Program Files\Git\bin\bash.exe
  const pathEnv = process.env.PATH ?? process.env.Path ?? "";
  const pathDirs = pathEnv.split(";");

  for (const dir of pathDirs) {
    const gitExe = join(dir, "git.exe");
    if (existsSync(gitExe)) {
      // dir is e.g. C:\Program Files\Git\cmd  →  parent is Git root
      const gitRoot = dirname(dir);
      const bashExe = join(gitRoot, "bin", "bash.exe");
      if (existsSync(bashExe)) {
        return bashExe;
      }
    }
  }

  // Check PROGRAMFILES env var as final fallback
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

/** Cached Git Bash path (undefined = not yet looked up) */
let _gitBashPath: string | null | undefined;

/** Get the cached Git Bash path, or look it up once */
function getGitBashPath(): string | null {
  if (_gitBashPath === undefined) {
    _gitBashPath = findGitBash();
  }
  return _gitBashPath;
}

/** Check if Git Bash is available on Windows */
export function hasGitBash(): boolean {
  return getGitBashPath() !== null;
}

/** Get the current shell type */
export function getShellType(): ShellType {
  if (!isWindows()) return "bash";
  if (getGitBashPath()) return "git-bash";
  return "cmd";
}

/** Get platform-specific shell command (prefers Git Bash on Windows) */
export function getShellCommand(): string {
  if (isWindows()) {
    const gitBash = getGitBashPath();
    if (gitBash) return gitBash;
    return "cmd.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

/** Get platform-specific shell args for executing a command string */
export function getShellArgs(command: string, shell?: string): readonly string[] {
  // If the shell is cmd.exe, use /c; otherwise use -c (bash-style)
  if (shell === "cmd.exe" || (!shell && isWindows() && !getGitBashPath())) {
    return ["/c", command] as const;
  }
  return ["-c", command] as const;
}

/**
 * Reset the cached Git Bash path. Primarily useful for testing.
 * @internal
 */
export function _resetGitBashCache(): void {
  _gitBashPath = undefined;
}
