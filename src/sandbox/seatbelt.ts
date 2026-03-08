import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";

const execFileAsync = promisify(execFile);

/** Sandbox execution error */
export class SandboxError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SANDBOX_ERROR", context);
  }
}

/** Configuration for a sandboxed command execution */
export interface SandboxConfig {
  /** Command to execute inside the sandbox */
  readonly command: string;
  /** Arguments for the command */
  readonly args?: readonly string[];
  /** Working directory for execution */
  readonly cwd?: string;
  /** Project directory to allow filesystem access to */
  readonly projectDir: string;
  /** Home directory (partial access allowed) */
  readonly homeDir?: string;
  /** Timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Environment variables to pass through */
  readonly env?: Record<string, string>;
}

/**
 * Generate a macOS Seatbelt (sandbox-exec) profile.
 *
 * Rules:
 * - Filesystem: project directory + /tmp + selected home directory paths (read/write)
 * - System paths are read-only (/usr, /bin, /Library, etc.)
 * - Network: outbound connections only (for API calls)
 * - Process: fork/exec allowed (for bash tool execution)
 * - No inbound network listening
 */
export function generateSeatbeltProfile(config: {
  projectDir: string;
  homeDir: string;
  tmpDir: string;
}): string {
  const { projectDir, homeDir, tmpDir } = config;

  return `(version 1)
(deny default)

;; Allow basic process operations
(allow process-fork)
(allow process-exec)
(allow signal (target self))

;; Allow reading system resources
(allow file-read*
  (subpath "/usr")
  (subpath "/bin")
  (subpath "/sbin")
  (subpath "/Library")
  (subpath "/System")
  (subpath "/private/etc")
  (subpath "/dev")
  (subpath "/Applications/Xcode.app")
  (literal "/")
  (literal "/etc")
  (literal "/tmp")
  (literal "/var")
  (literal "/private")
  (literal "/private/tmp")
  (literal "/private/var")
)

;; Allow read/write to project directory
(allow file-read* file-write*
  (subpath "${escapeProfilePath(projectDir)}")
)

;; Allow read/write to temp directories
(allow file-read* file-write*
  (subpath "${escapeProfilePath(tmpDir)}")
  (subpath "/private/tmp")
  (subpath "/private/var/folders")
)

;; Allow read/write to home directory config and tools
(allow file-read* file-write*
  (subpath "${escapeProfilePath(homeDir)}/.config")
  (subpath "${escapeProfilePath(homeDir)}/.local")
  (subpath "${escapeProfilePath(homeDir)}/.npm")
  (subpath "${escapeProfilePath(homeDir)}/.node_modules")
  (subpath "${escapeProfilePath(homeDir)}/.cache")
  (subpath "${escapeProfilePath(homeDir)}/.claude")
  (subpath "${escapeProfilePath(homeDir)}/.git")
)

;; Allow reading home directory itself and common tool configs
(allow file-read*
  (literal "${escapeProfilePath(homeDir)}")
  (subpath "${escapeProfilePath(homeDir)}/.nvm")
  (subpath "${escapeProfilePath(homeDir)}/.volta")
  (subpath "${escapeProfilePath(homeDir)}/.rustup")
  (subpath "${escapeProfilePath(homeDir)}/.cargo")
)

;; Allow outbound network connections (for LLM API calls)
(allow network-outbound
  (remote tcp)
)

;; Allow DNS resolution
(allow network-outbound
  (remote udp (to (local-port 53)))
)

;; Deny inbound network (no listening)
(deny network-inbound)

;; Allow sysctl for system info
(allow sysctl-read)

;; Allow IPC (for Node.js internal operations)
(allow ipc-posix-shm-read-data)
(allow ipc-posix-shm-write-data)

;; Allow mach lookups (required for many system operations)
(allow mach-lookup)
`;
}

/** Escape special characters in file paths for Seatbelt profiles */
function escapeProfilePath(path: string): string {
  return path.replace(/"/g, '\\"');
}

/**
 * Execute a command inside a macOS Seatbelt sandbox.
 * Only available on macOS (darwin). On other platforms, executes without sandboxing.
 */
export async function executeSandboxed(config: SandboxConfig): Promise<{
  stdout: string;
  stderr: string;
}> {
  const {
    command,
    args = [],
    cwd,
    projectDir,
    homeDir = process.env.HOME ?? "/Users/unknown",
    timeoutMs = 120_000,
    env,
  } = config;

  // Only sandbox on macOS
  if (process.platform !== "darwin") {
    const result = await execFileAsync(command, [...args], {
      cwd,
      timeout: timeoutMs,
      env: env ? { ...process.env, ...env } : undefined,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  }

  // Generate the Seatbelt profile
  const profile = generateSeatbeltProfile({
    projectDir,
    homeDir,
    tmpDir: tmpdir(),
  });

  // Write profile to temp file
  const profilePath = join(tmpdir(), `dbcode-sandbox-${randomUUID()}.sb`);
  await writeFile(profilePath, profile, "utf-8");

  try {
    const result = await execFileAsync(
      "sandbox-exec",
      ["-f", profilePath, command, ...args],
      {
        cwd,
        timeout: timeoutMs,
        env: env ? { ...process.env, ...env } : undefined,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      },
    );

    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (error instanceof Error && "killed" in error) {
      throw new SandboxError("Sandboxed command timed out", {
        command,
        timeoutMs,
      });
    }
    throw new SandboxError("Sandboxed command failed", {
      command,
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Clean up profile file
    await unlink(profilePath).catch(() => {});
  }
}
