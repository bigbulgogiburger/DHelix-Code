import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { BaseError } from "../utils/error.js";
import { isWSL2 } from "./linux.js";

const execFileAsync = promisify(execFile);

/** Sandbox execution error */
export class BubblewrapError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "BUBBLEWRAP_ERROR", context);
  }
}

/** A filesystem path to mount inside the bubblewrap sandbox */
export interface PathMount {
  readonly hostPath: string;
  readonly sandboxPath?: string;
  readonly writable: boolean;
}

/** Configuration for a bubblewrap-sandboxed command execution */
export interface BubblewrapConfig {
  /** Command to execute inside the sandbox */
  readonly command: string;
  /** Arguments for the command */
  readonly args?: readonly string[];
  /** Working directory for execution */
  readonly cwd?: string;
  /** Project directory (mounted read-write) */
  readonly projectDir: string;
  /** Home directory (defaults to os.homedir()) */
  readonly homeDir?: string;
  /** Temp directory (defaults to os.tmpdir()) */
  readonly tmpDir?: string;
  /** Timeout in milliseconds (defaults to 120000) */
  readonly timeoutMs?: number;
  /** Environment variables to set inside the sandbox */
  readonly env?: Record<string, string>;
  /** Allow network access (defaults to true for API calls) */
  readonly networkAccess?: boolean;
  /** Additional paths to mount inside the sandbox */
  readonly allowedPaths?: readonly PathMount[];
}

/** Result of a bubblewrap-sandboxed execution */
export interface SandboxResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
}

/** System paths that are bind-mounted read-only */
const SYSTEM_RO_PATHS = ["/usr", "/bin", "/lib", "/lib64", "/etc", "/sbin"] as const;

/** Home directory subdirectories mounted read-only */
const HOME_RO_DIRS = [
  ".dbcode",
  ".config",
  ".npm",
  ".cache",
  ".nvm",
  ".volta",
  ".rustup",
  ".cargo",
] as const;

/**
 * Check whether a host path exists before attempting to bind-mount it.
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the Windows home directory path accessible from WSL2 via DrvFs.
 * Returns null if not running on WSL2 or if the path is not accessible.
 */
async function detectWSL2WindowsHome(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("wslpath", ["-u", "%USERPROFILE%"]);
    const resolved = stdout.trim();

    // wslpath may return the literal %USERPROFILE% if it can't resolve
    if (resolved.startsWith("/mnt/") && (await pathExists(resolved))) {
      return resolved;
    }
  } catch {
    // wslpath not available or failed
  }

  // Fallback: try common default location
  const fallback = "/mnt/c/Users";
  if (await pathExists(fallback)) {
    // We can't determine the exact user directory without more info
    return null;
  }

  return null;
}

/**
 * Generate the bwrap argument array for the given configuration.
 *
 * Mounts:
 * - System paths (/usr, /bin, /lib, /lib64, /etc, /sbin) read-only
 * - /proc as procfs, /dev as devfs
 * - /tmp as tmpfs (with a writable dbcode temp subdirectory)
 * - Project directory read-write
 * - Home directory config subdirectories read-only
 * - Additional user-specified paths
 *
 * Isolation:
 * - PID namespace (--unshare-pid)
 * - New session (--new-session)
 * - Die with parent (--die-with-parent)
 * - Network: shared (default) or unshared
 */
export async function generateBubblewrapArgs(config: BubblewrapConfig): Promise<readonly string[]> {
  const {
    command,
    args = [],
    cwd,
    projectDir,
    homeDir = homedir(),
    tmpDir = tmpdir(),
    env,
    networkAccess = true,
    allowedPaths = [],
  } = config;

  const bwrapArgs: string[] = [];

  // System read-only bind mounts
  for (const sysPath of SYSTEM_RO_PATHS) {
    if (await pathExists(sysPath)) {
      bwrapArgs.push("--ro-bind", sysPath, sysPath);
    }
  }

  // Symlinks that some distros expect
  if (!(await pathExists("/lib")) && (await pathExists("/usr/lib"))) {
    bwrapArgs.push("--symlink", "usr/lib", "/lib");
  }
  if (!(await pathExists("/lib64")) && (await pathExists("/usr/lib64"))) {
    bwrapArgs.push("--symlink", "usr/lib64", "/lib64");
  }
  if (!(await pathExists("/bin")) && (await pathExists("/usr/bin"))) {
    bwrapArgs.push("--symlink", "usr/bin", "/bin");
  }
  if (!(await pathExists("/sbin")) && (await pathExists("/usr/sbin"))) {
    bwrapArgs.push("--symlink", "usr/sbin", "/sbin");
  }

  // Proc and dev
  bwrapArgs.push("--proc", "/proc");
  bwrapArgs.push("--dev", "/dev");

  // Tmpfs at /tmp
  bwrapArgs.push("--tmpfs", "/tmp");

  // Writable temp directory for dbcode
  if (await pathExists(tmpDir)) {
    bwrapArgs.push("--bind", tmpDir, "/tmp/dbcode");
  }

  // Project directory (read-write)
  bwrapArgs.push("--bind", projectDir, projectDir);

  // Home directory config subdirectories (read-only)
  for (const subDir of HOME_RO_DIRS) {
    const fullPath = `${homeDir}/${subDir}`;
    if (await pathExists(fullPath)) {
      bwrapArgs.push("--ro-bind", fullPath, `${homeDir}/${subDir}`);
    }
  }

  // Mount home directory .local read-write (for tools that need it)
  const localPath = `${homeDir}/.local`;
  if (await pathExists(localPath)) {
    bwrapArgs.push("--bind", localPath, `${homeDir}/.local`);
  }

  // WSL2: mount Windows home directory read-only if available
  if (await isWSL2()) {
    const winHome = await detectWSL2WindowsHome();
    if (winHome) {
      bwrapArgs.push("--ro-bind", winHome, winHome);
    }
  }

  // Additional user-specified path mounts
  for (const mount of allowedPaths) {
    const sandboxPath = mount.sandboxPath ?? mount.hostPath;
    if (await pathExists(mount.hostPath)) {
      if (mount.writable) {
        bwrapArgs.push("--bind", mount.hostPath, sandboxPath);
      } else {
        bwrapArgs.push("--ro-bind", mount.hostPath, sandboxPath);
      }
    }
  }

  // Environment variables
  bwrapArgs.push("--setenv", "HOME", homeDir);

  if (env) {
    for (const [key, value] of Object.entries(env)) {
      bwrapArgs.push("--setenv", key, value);
    }
  }

  // Working directory
  if (cwd) {
    bwrapArgs.push("--chdir", cwd);
  }

  // Namespace isolation
  bwrapArgs.push("--unshare-pid");
  bwrapArgs.push("--die-with-parent");
  bwrapArgs.push("--new-session");

  // Network access
  if (networkAccess) {
    bwrapArgs.push("--share-net");
  } else {
    bwrapArgs.push("--unshare-net");
  }

  // Command separator and the actual command
  bwrapArgs.push("--", command, ...args);

  return bwrapArgs;
}

/**
 * Execute a command inside a bubblewrap sandbox.
 *
 * Only available on Linux (native or WSL2). Throws BubblewrapError if:
 * - bwrap is not installed
 * - Permission is denied
 * - The command times out
 * - Any other execution failure occurs
 */
export async function executeBubblewrapped(config: BubblewrapConfig): Promise<SandboxResult> {
  const { timeoutMs = 120_000 } = config;

  // Verify bwrap is available
  try {
    await execFileAsync("bwrap", ["--version"]);
  } catch (error) {
    const message =
      error instanceof Error && "code" in error && error.code === "ENOENT"
        ? "Bubblewrap (bwrap) is not installed. Install it with your package manager:\n" +
          "  Ubuntu/Debian: sudo apt install bubblewrap\n" +
          "  Fedora: sudo dnf install bubblewrap\n" +
          "  Arch: sudo pacman -S bubblewrap"
        : "Failed to verify bubblewrap installation.";

    throw new BubblewrapError(message, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const bwrapArgs = await generateBubblewrapArgs(config);

  // Set up timeout with AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await execFileAsync("bwrap", [...bwrapArgs], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      signal: controller.signal,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      timedOut: false,
    };
  } catch (error: unknown) {
    // Check for timeout / abort
    if (error instanceof Error && error.name === "AbortError") {
      return {
        stdout: "",
        stderr: "Command timed out",
        exitCode: 124,
        timedOut: true,
      };
    }

    if (error instanceof Error && "killed" in error && (error as Record<string, unknown>).killed) {
      return {
        stdout: "",
        stderr: "Command timed out",
        exitCode: 124,
        timedOut: true,
      };
    }

    // Permission denied
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EACCES"
    ) {
      throw new BubblewrapError(
        "Permission denied when executing bubblewrap. " +
          "Ensure your user has permission to use namespace features, " +
          "or check that the kernel allows unprivileged user namespaces: " +
          "sysctl kernel.unprivileged_userns_clone=1",
        {
          cause: error.message,
        },
      );
    }

    // Child process exited with non-zero code — this is a normal execution result
    if (
      error instanceof Error &&
      "code" in error &&
      typeof (error as Record<string, unknown>).code === "number"
    ) {
      const execError = error as Error & {
        readonly stdout: string;
        readonly stderr: string;
        readonly code: number;
      };
      return {
        stdout: execError.stdout ?? "",
        stderr: execError.stderr ?? "",
        exitCode: execError.code,
        timedOut: false,
      };
    }

    throw new BubblewrapError("Bubblewrap execution failed", {
      command: config.command,
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}
