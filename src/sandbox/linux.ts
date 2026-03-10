import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { BaseError } from "../utils/error.js";

const execFileAsync = promisify(execFile);

/** Sandbox execution error for Linux bubblewrap */
export class BubblewrapError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "BUBBLEWRAP_ERROR", context);
  }
}

/** Configuration for a bubblewrap-sandboxed command execution */
export interface LinuxSandboxConfig {
  /** Command to execute inside the sandbox */
  readonly command: string;
  /** Arguments for the command */
  readonly args?: readonly string[];
  /** Working directory for execution */
  readonly cwd?: string;
  /** Project directory to allow filesystem read-write access to */
  readonly projectDir: string;
  /** Home directory (partial read-only access allowed) */
  readonly homeDir?: string;
  /** Timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Environment variables to pass through */
  readonly env?: Record<string, string>;
  /** Allow network access (default: true, for API calls) */
  readonly allowNetwork?: boolean;
}

/** System paths to mount read-only inside the bubblewrap sandbox */
const READONLY_SYSTEM_PATHS: readonly string[] = [
  "/usr",
  "/bin",
  "/lib",
  "/lib64",
  "/etc",
  "/sbin",
];

/** Home directory config paths to mount read-only */
const HOME_READONLY_PATHS: readonly string[] = [
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

/**
 * Generate bubblewrap (bwrap) command arguments for sandbox execution.
 *
 * Mounts:
 * - System paths (/usr, /bin, /lib, /etc, /sbin) read-only
 * - /proc, /dev as special filesystems
 * - /tmp as tmpfs (ephemeral)
 * - Project directory read-write
 * - Home directory config paths read-only
 *
 * Isolation:
 * - PID namespace isolation (--unshare-pid)
 * - New session (--new-session)
 * - Die with parent process (--die-with-parent)
 * - Optional network namespace isolation (--unshare-net)
 */
export function generateBwrapArgs(config: LinuxSandboxConfig): readonly string[] {
  const {
    command,
    args = [],
    projectDir,
    homeDir = process.env.HOME ?? "/home/unknown",
    allowNetwork = true,
  } = config;

  const bwrapArgs: string[] = [];

  // Mount system paths read-only
  for (const sysPath of READONLY_SYSTEM_PATHS) {
    bwrapArgs.push("--ro-bind", sysPath, sysPath);
  }

  // Mount special filesystems
  bwrapArgs.push("--proc", "/proc");
  bwrapArgs.push("--dev", "/dev");

  // Ephemeral /tmp
  bwrapArgs.push("--tmpfs", "/tmp");

  // Project directory read-write
  bwrapArgs.push("--bind", projectDir, projectDir);

  // Home directory config paths read-only
  for (const subPath of HOME_READONLY_PATHS) {
    const fullPath = `${homeDir}/${subPath}`;
    bwrapArgs.push("--ro-bind-try", fullPath, fullPath);
  }

  // Isolation flags
  bwrapArgs.push("--unshare-pid");
  bwrapArgs.push("--die-with-parent");
  bwrapArgs.push("--new-session");

  // Network isolation (only if explicitly disabled)
  if (!allowNetwork) {
    bwrapArgs.push("--unshare-net");
  }

  // Separator and command
  bwrapArgs.push("--", command, ...args);

  return bwrapArgs;
}

/**
 * Check if bubblewrap (bwrap) is available on the system.
 */
export async function hasBubblewrap(): Promise<boolean> {
  try {
    await execFileAsync("which", ["bwrap"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if running inside WSL (Windows Subsystem for Linux).
 * Reads /proc/version for "microsoft" or "WSL" indicators.
 */
export async function isWSL(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf-8");
    return /microsoft|wsl/i.test(version);
  } catch {
    return false;
  }
}

/**
 * Check if running inside WSL1 specifically.
 *
 * WSL1 detection heuristic:
 * - WSL_DISTRO_NAME environment variable is set (indicates WSL)
 * - /proc/version does NOT contain "WSL2" or similar WSL2 indicators
 * - WSL1 does not support all Linux kernel features needed for bubblewrap
 */
export async function isWSL1(): Promise<boolean> {
  // Must be in WSL at all
  const wslDistro = process.env.WSL_DISTRO_NAME;
  if (!wslDistro) {
    return false;
  }

  try {
    const version = await readFile("/proc/version", "utf-8");
    // WSL2 typically shows "microsoft-standard-WSL2" in /proc/version
    // WSL1 shows "Microsoft" but not "WSL2"
    const isMicrosoftKernel = /microsoft/i.test(version);
    const isWSL2Kernel = /wsl2/i.test(version);
    return isMicrosoftKernel && !isWSL2Kernel;
  } catch {
    // If we can't read /proc/version but WSL_DISTRO_NAME is set,
    // assume WSL1 (WSL1 has limited /proc support)
    return true;
  }
}

/**
 * Execute a command inside a Linux bubblewrap sandbox.
 *
 * Requires `bwrap` to be installed on the system.
 * Falls back to unsandboxed execution if bwrap is not available.
 */
export async function executeBubblewrap(config: LinuxSandboxConfig): Promise<{
  stdout: string;
  stderr: string;
}> {
  const {
    command,
    args = [],
    cwd,
    timeoutMs = 120_000,
    env,
  } = config;

  // Check if bwrap is available
  const bwrapAvailable = await hasBubblewrap();
  if (!bwrapAvailable) {
    throw new BubblewrapError("bubblewrap (bwrap) is not installed", {
      command,
      hint: "Install with: sudo apt install bubblewrap (Debian/Ubuntu) or sudo dnf install bubblewrap (Fedora)",
    });
  }

  // Check for WSL1 (not supported)
  const wsl1 = await isWSL1();
  if (wsl1) {
    throw new BubblewrapError(
      "bubblewrap sandbox is not supported on WSL1 due to missing kernel features",
      {
        command,
        hint: "Upgrade to WSL2: wsl --set-version <distro> 2",
      },
    );
  }

  const bwrapArgs = generateBwrapArgs(config);

  try {
    const result = await execFileAsync("bwrap", [...bwrapArgs], {
      cwd,
      timeout: timeoutMs,
      env: env ? { ...process.env, ...env } : undefined,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (error instanceof Error && "killed" in error && (error as Record<string, unknown>).killed) {
      throw new BubblewrapError("Sandboxed command timed out", {
        command,
        args: [...args],
        timeoutMs,
      });
    }
    throw new BubblewrapError("Sandboxed command failed", {
      command,
      args: [...args],
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
