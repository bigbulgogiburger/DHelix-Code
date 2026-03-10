import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Result of checking Linux sandbox readiness */
export interface SandboxReadiness {
  readonly available: boolean;
  readonly reason?: string;
  readonly environment: "native-linux" | "wsl2" | "wsl1" | "unknown";
  readonly bubblewrapInstalled: boolean;
  readonly bubblewrapVersion?: string;
  readonly recommendations: readonly string[];
}

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
      return false; // WSLInterop exists → WSL2, not WSL1
    } catch {
      return true; // No WSLInterop → WSL1
    }
  } catch {
    return false;
  }
}

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
