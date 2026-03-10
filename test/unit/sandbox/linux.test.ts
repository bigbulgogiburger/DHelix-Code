import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node:fs/promises
const mockReadFile = vi.fn();
const mockAccess = vi.fn();
vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

// Mock node:child_process
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock node:util promisify to wrap our mockExecFile
vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    return (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        (fn as Function)(...args, (err: Error | null, stdout?: string, stderr?: string) => {
          if (err) reject(err);
          else resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
        });
      });
    };
  },
}));

// Store original process.platform
const originalPlatform = process.platform;

const { isWSL2, isWSL1, hasBubblewrap, getBubblewrapVersion, checkLinuxSandboxReady } =
  await import("../../../src/sandbox/linux.js");

describe("Linux sandbox detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: set platform to linux
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
  });

  describe("isWSL2()", () => {
    it('returns true when /proc/version contains "microsoft" (lowercase)', async () => {
      mockReadFile.mockResolvedValue(
        "Linux version 5.15.90.1-microsoft-standard-WSL2 (gcc version 12)",
      );
      mockAccess.mockResolvedValue(undefined); // WSLInterop exists

      expect(await isWSL2()).toBe(true);
    });

    it('returns true when /proc/version contains "Microsoft" (uppercase)', async () => {
      mockReadFile.mockResolvedValue(
        "Linux version 4.4.0-19041-Microsoft (Microsoft@Microsoft.com)",
      );
      // WSL2 also needs WSLInterop to exist
      mockAccess.mockResolvedValue(undefined);

      expect(await isWSL2()).toBe(true);
    });

    it("returns false on native Linux", async () => {
      mockReadFile.mockResolvedValue(
        "Linux version 6.1.0-13-amd64 (debian-kernel@lists.debian.org)",
      );

      expect(await isWSL2()).toBe(false);
    });

    it("returns false when /proc/version doesn't exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT: no such file or directory"));

      expect(await isWSL2()).toBe(false);
    });
  });

  describe("isWSL1()", () => {
    it("detects WSL1 (Microsoft in /proc/version but no WSLInterop)", async () => {
      mockReadFile.mockResolvedValue(
        "Linux version 4.4.0-19041-Microsoft (Microsoft@Microsoft.com)",
      );
      // WSL1: WSLInterop does NOT exist
      mockAccess.mockRejectedValue(new Error("ENOENT: no such file or directory"));

      expect(await isWSL1()).toBe(true);
    });

    it("returns false when /proc/version has no Microsoft and no WSLInterop", async () => {
      mockReadFile.mockResolvedValue(
        "Linux version 6.1.0-13-amd64 (debian-kernel@lists.debian.org)",
      );

      expect(await isWSL1()).toBe(false);
    });

    it("returns false on WSL2 (has both Microsoft and WSLInterop)", async () => {
      mockReadFile.mockResolvedValue(
        "Linux version 5.15.90.1-microsoft-standard-WSL2 (gcc version 12)",
      );
      mockAccess.mockResolvedValue(undefined); // WSLInterop exists

      expect(await isWSL1()).toBe(false);
    });
  });

  describe("hasBubblewrap()", () => {
    it("returns true when bwrap --version succeeds", async () => {
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            (callback as Function)(null, "bubblewrap 0.8.0\n", "");
          }
        },
      );

      expect(await hasBubblewrap()).toBe(true);
    });

    it("returns false when bwrap is not found (ENOENT)", async () => {
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            const error = new Error("spawn bwrap ENOENT") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            (callback as Function)(error, "", "");
          }
        },
      );

      expect(await hasBubblewrap()).toBe(false);
    });
  });

  describe("getBubblewrapVersion()", () => {
    it("parses version string correctly", async () => {
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            (callback as Function)(null, "bubblewrap 0.8.0\n", "");
          }
        },
      );

      const version = await getBubblewrapVersion();
      expect(version).toBe("bubblewrap 0.8.0");
    });

    it("returns null when bwrap is not installed", async () => {
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            const error = new Error("ENOENT") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            (callback as Function)(error, "", "");
          }
        },
      );

      const version = await getBubblewrapVersion();
      expect(version).toBeNull();
    });
  });

  describe("checkLinuxSandboxReady()", () => {
    it("returns available=true when bwrap installed on native Linux", async () => {
      // Native Linux: no "microsoft" in /proc/version
      mockReadFile.mockImplementation((path: string) => {
        if (path === "/proc/version") {
          return Promise.resolve("Linux version 6.1.0-13-amd64 (debian-kernel@lists.debian.org)");
        }
        return Promise.reject(new Error("ENOENT"));
      });

      // bwrap is available
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            (callback as Function)(null, "bubblewrap 0.8.0\n", "");
          }
        },
      );

      const result = await checkLinuxSandboxReady();

      expect(result.available).toBe(true);
      expect(result.environment).toBe("native-linux");
      expect(result.bubblewrapInstalled).toBe(true);
    });

    it("returns available=true when bwrap installed on WSL2", async () => {
      // WSL2: "microsoft" in /proc/version + WSLInterop exists
      mockReadFile.mockImplementation((path: string) => {
        if (path === "/proc/version") {
          return Promise.resolve("Linux version 5.15.90.1-microsoft-standard-WSL2");
        }
        return Promise.reject(new Error("ENOENT"));
      });
      mockAccess.mockResolvedValue(undefined); // WSLInterop exists

      // bwrap is available
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            (callback as Function)(null, "bubblewrap 0.8.0\n", "");
          }
        },
      );

      const result = await checkLinuxSandboxReady();

      expect(result.available).toBe(true);
      expect(result.environment).toBe("wsl2");
      expect(result.bubblewrapInstalled).toBe(true);
    });

    it("returns available=false on WSL1 with recommendation", async () => {
      // WSL1: "Microsoft" in /proc/version but no WSLInterop
      mockReadFile.mockImplementation((path: string) => {
        if (path === "/proc/version") {
          return Promise.resolve("Linux version 4.4.0-19041-Microsoft");
        }
        return Promise.reject(new Error("ENOENT"));
      });
      mockAccess.mockRejectedValue(new Error("ENOENT")); // No WSLInterop

      // bwrap may or may not be installed - doesn't matter for WSL1
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            const error = new Error("ENOENT") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            (callback as Function)(error, "", "");
          }
        },
      );

      const result = await checkLinuxSandboxReady();

      expect(result.available).toBe(false);
      expect(result.environment).toBe("wsl1");
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.includes("WSL2"))).toBe(true);
    });

    it("returns install recommendations for Ubuntu/Debian", async () => {
      // Native Linux, no bwrap installed, Debian distro
      mockReadFile.mockImplementation((path: string) => {
        if (path === "/proc/version") {
          return Promise.resolve("Linux version 6.1.0-13-amd64 (debian-kernel@lists.debian.org)");
        }
        if (path === "/etc/os-release") {
          return Promise.resolve('ID=ubuntu\nID_LIKE="debian"\nVERSION_ID="22.04"');
        }
        return Promise.reject(new Error("ENOENT"));
      });

      // bwrap not installed
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            const error = new Error("ENOENT") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            (callback as Function)(error, "", "");
          }
        },
      );

      const result = await checkLinuxSandboxReady();

      expect(result.available).toBe(false);
      expect(result.bubblewrapInstalled).toBe(false);
      expect(result.recommendations.some((r) => r.includes("apt"))).toBe(true);
    });

    it("returns install recommendations for Fedora", async () => {
      // Native Linux, no bwrap installed, Fedora distro
      mockReadFile.mockImplementation((path: string) => {
        if (path === "/proc/version") {
          return Promise.resolve("Linux version 6.5.0-0.rc6.44 (fedora-kernel)");
        }
        if (path === "/etc/os-release") {
          return Promise.resolve('ID=fedora\nVERSION_ID="39"');
        }
        return Promise.reject(new Error("ENOENT"));
      });

      // bwrap not installed
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = cb ?? args[args.length - 1];
          if (typeof callback === "function") {
            const error = new Error("ENOENT") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            (callback as Function)(error, "", "");
          }
        },
      );

      const result = await checkLinuxSandboxReady();

      expect(result.available).toBe(false);
      expect(result.bubblewrapInstalled).toBe(false);
      expect(result.recommendations.some((r) => r.includes("dnf"))).toBe(true);
    });

    it("identifies correct environment type", async () => {
      // Non-Linux platform
      Object.defineProperty(process, "platform", { value: "darwin", writable: true });

      const result = await checkLinuxSandboxReady();

      expect(result.environment).toBe("unknown");
      expect(result.available).toBe(false);
    });
  });
});
