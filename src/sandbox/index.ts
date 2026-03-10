import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isMacOS, isLinux } from "../utils/platform.js";
import { executeSandboxed as executeSeatbelt, SandboxConfig } from "./seatbelt.js";
import {
  executeBubblewrap,
  hasBubblewrap,
  isWSL,
  isWSL1,
  type LinuxSandboxConfig,
} from "./linux.js";

export type { SandboxConfig } from "./seatbelt.js";
export type { LinuxSandboxConfig } from "./linux.js";
export { SandboxError } from "./seatbelt.js";
export { BubblewrapError } from "./linux.js";

const execFileAsync = promisify(execFile);

/** Sandbox type detected on the current platform */
export type SandboxType = "seatbelt" | "bubblewrap" | "none";

/** Result of sandbox availability check */
export interface SandboxStatus {
  /** Whether a sandbox is available */
  readonly available: boolean;
  /** Type of sandbox available */
  readonly type: SandboxType;
  /** Warnings about the sandbox environment */
  readonly warnings: readonly string[];
}

/**
 * Execute a command in the appropriate sandbox for the current platform.
 *
 * - macOS: uses Seatbelt (sandbox-exec)
 * - Linux: uses bubblewrap (bwrap)
 * - Windows/other: executes without sandboxing
 */
export async function executeSandboxed(
  config: SandboxConfig & { readonly allowNetwork?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  if (isMacOS()) {
    return executeSeatbelt(config);
  }

  if (isLinux()) {
    const bwrapConfig: LinuxSandboxConfig = {
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      projectDir: config.projectDir,
      homeDir: config.homeDir,
      timeoutMs: config.timeoutMs,
      env: config.env,
      allowNetwork: config.allowNetwork,
    };
    return executeBubblewrap(bwrapConfig);
  }

  // Windows/other: no sandbox, execute directly
  return executeUnsandboxed(config);
}

/**
 * Execute a command without any sandboxing.
 * Used as fallback on platforms without sandbox support.
 */
async function executeUnsandboxed(config: SandboxConfig): Promise<{
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

  const result = await execFileAsync(command, [...args], {
    cwd,
    timeout: timeoutMs,
    env: env ? { ...process.env, ...env } : undefined,
    maxBuffer: 10 * 1024 * 1024,
  });

  return { stdout: result.stdout, stderr: result.stderr };
}

/**
 * Get the current sandbox availability status for the running platform.
 *
 * Returns the sandbox type, availability, and any warnings
 * (e.g., WSL1 detected, bwrap not installed).
 */
export async function getSandboxStatus(): Promise<SandboxStatus> {
  const warnings: string[] = [];

  if (isMacOS()) {
    // macOS always has sandbox-exec available
    return {
      available: true,
      type: "seatbelt",
      warnings: [],
    };
  }

  if (isLinux()) {
    // Check for WSL1 (unsupported)
    const wsl1 = await isWSL1();
    if (wsl1) {
      warnings.push(
        "WSL1 detected. Bubblewrap sandbox requires WSL2. " +
          "Upgrade with: wsl --set-version <distro> 2",
      );
      return {
        available: false,
        type: "none",
        warnings,
      };
    }

    // Check for WSL2 (supported but note it)
    const wsl = await isWSL();
    if (wsl) {
      warnings.push(
        "WSL2 detected. Bubblewrap sandbox is supported but may require installation.",
      );
    }

    // Check if bwrap is installed
    const bwrapAvailable = await hasBubblewrap();
    if (!bwrapAvailable) {
      warnings.push(
        "bubblewrap (bwrap) is not installed. " +
          "Install with: sudo apt install bubblewrap (Debian/Ubuntu) " +
          "or sudo dnf install bubblewrap (Fedora)",
      );
      return {
        available: false,
        type: "none",
        warnings,
      };
    }

    return {
      available: true,
      type: "bubblewrap",
      warnings,
    };
  }

  // Windows/other: no sandbox
  warnings.push(
    "No sandbox available on this platform. Commands will execute without filesystem isolation.",
  );
  return {
    available: false,
    type: "none",
    warnings,
  };
}
