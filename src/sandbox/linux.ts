import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
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

/** Result of checking Linux sandbox readiness */
export interface SandboxReadiness {
  readonly available: boolean;
  readonly reason?: string;
  readonly environment: "native-linux" | "wsl2" | "wsl1" | "unknown";
  readonly bubblewrapInstalled: boolean;
  readonly bubblewrapVersion?: string;
  readonly recommendations: readonly string[];
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

// ---------------------------------------------------------------------------
// WSL detection
// ---------------------------------------------------------------------------

/**
 * Detect if running inside WSL2.
 *
 * WSL2 is identified by:
 * - /proc/version containing "microsoft" (case-insensitive)
 * - /proc/sys/fs/binfmt_misc/WSLInterop existing (WSL2 feature)
 */
export async function isWSL2(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf-8");
    const hasMicrosoftKernel = /microsoft/i.test(version);

    if (!hasMicrosoftKernel) {
      return false;
    }

    // WSL2 exposes WSLInterop; WSL1 does not
    try {
      await access("/proc/sys/fs/binfmt_misc/WSLInterop");
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Detect if running inside WSL1.
 *
 * WSL1 has "Microsoft" in /proc/version but does NOT have WSLInterop support.
 */
export async function isWSL1(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf-8");
    const hasMicrosoftKernel = /microsoft/i.test(version);

    if (!hasMicrosoftKernel) {
      return false;
    }

    // WSL1 lacks WSLInterop
    try {
      await access("/proc/sys/fs/binfmt_misc/WSLInterop");
      return false; // WSLInterop exists -> WSL2, not WSL1
    } catch {
      return true; // No WSLInterop -> WSL1
    }
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

// ---------------------------------------------------------------------------
// Bubblewrap detection
// ---------------------------------------------------------------------------

/**
 * Check if bubblewrap (bwrap) is installed and executable.
 */
export async function hasBubblewrap(): Promise<boolean> {
  try {
    await execFileAsync("bwrap", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the installed bubblewrap version string, or null if not installed.
 */
export async function getBubblewrapVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("bwrap", ["--version"]);
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sandbox argument generation and execution
// ---------------------------------------------------------------------------

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
 * Execute a command inside a Linux bubblewrap sandbox.
 *
 * Requires `bwrap` to be installed on the system.
 * Falls back to unsandboxed execution if bwrap is not available.
 */
export async function executeBubblewrap(config: LinuxSandboxConfig): Promise<{
  stdout: string;
  stderr: string;
}> {
  const { command, args = [], cwd, timeoutMs = 120_000, env } = config;

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

// ---------------------------------------------------------------------------
// Sandbox readiness checking
// ---------------------------------------------------------------------------

/**
 * Detect the Linux distribution family by reading /etc/os-release.
 * Returns a simplified identifier for install instruction purposes.
 */
async function detectDistroFamily(): Promise<"debian" | "fedora" | "arch" | "unknown"> {
  try {
    const osRelease = await readFile("/etc/os-release", "utf-8");
    const idLine = osRelease.split("\n").find((line) => /^ID=/.test(line));
    const idLikeLine = osRelease.split("\n").find((line) => /^ID_LIKE=/.test(line));

    const id = idLine?.replace(/^ID=/, "").replace(/"/g, "").trim().toLowerCase() ?? "";
    const idLike =
      idLikeLine
        ?.replace(/^ID_LIKE=/, "")
        .replace(/"/g, "")
        .trim()
        .toLowerCase() ?? "";

    const combined = `${id} ${idLike}`;

    if (combined.includes("debian") || combined.includes("ubuntu")) {
      return "debian";
    }
    if (combined.includes("fedora") || combined.includes("rhel") || combined.includes("centos")) {
      return "fedora";
    }
    if (combined.includes("arch")) {
      return "arch";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Build install recommendation strings based on the detected distro.
 */
function buildInstallRecommendations(
  distro: "debian" | "fedora" | "arch" | "unknown",
): readonly string[] {
  const recommendations: string[] = [];

  switch (distro) {
    case "debian":
      recommendations.push("Install bubblewrap: sudo apt install bubblewrap");
      break;
    case "fedora":
      recommendations.push("Install bubblewrap: sudo dnf install bubblewrap");
      break;
    case "arch":
      recommendations.push("Install bubblewrap: sudo pacman -S bubblewrap");
      break;
    default:
      recommendations.push(
        "Install bubblewrap using your distribution's package manager.",
        "Common commands:",
        "  Ubuntu/Debian: sudo apt install bubblewrap",
        "  Fedora: sudo dnf install bubblewrap",
        "  Arch: sudo pacman -S bubblewrap",
      );
      break;
  }

  return recommendations;
}

/**
 * Detect the Linux environment type.
 */
async function detectEnvironment(): Promise<"native-linux" | "wsl2" | "wsl1" | "unknown"> {
  if (process.platform !== "linux") {
    return "unknown";
  }

  if (await isWSL2()) {
    return "wsl2";
  }

  if (await isWSL1()) {
    return "wsl1";
  }

  return "native-linux";
}

/**
 * Check overall sandbox readiness on Linux.
 *
 * Evaluates:
 * - Whether the platform is Linux (native, WSL1, or WSL2)
 * - Whether bubblewrap is installed and its version
 * - Provides install recommendations when bubblewrap is missing
 */
export async function checkLinuxSandboxReady(): Promise<SandboxReadiness> {
  const environment = await detectEnvironment();

  if (environment === "unknown") {
    return {
      available: false,
      reason: "Not running on Linux. Bubblewrap sandboxing is only available on Linux.",
      environment,
      bubblewrapInstalled: false,
      recommendations: [],
    };
  }

  if (environment === "wsl1") {
    return {
      available: false,
      reason:
        "WSL1 does not support the namespace features required by bubblewrap. Upgrade to WSL2.",
      environment,
      bubblewrapInstalled: await hasBubblewrap(),
      bubblewrapVersion: (await getBubblewrapVersion()) ?? undefined,
      recommendations: ["Upgrade to WSL2 for sandbox support: wsl --set-version <distro> 2"],
    };
  }

  const bwrapInstalled = await hasBubblewrap();
  const bwrapVersion = await getBubblewrapVersion();

  if (!bwrapInstalled) {
    const distro = await detectDistroFamily();
    const recommendations = buildInstallRecommendations(distro);

    return {
      available: false,
      reason: "Bubblewrap is not installed.",
      environment,
      bubblewrapInstalled: false,
      recommendations,
    };
  }

  return {
    available: true,
    environment,
    bubblewrapInstalled: true,
    bubblewrapVersion: bwrapVersion ?? undefined,
    recommendations: [],
  };
}
