import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BubblewrapConfig } from "../../../src/sandbox/bubblewrap.js";

// Mock node:fs/promises (pathExists checks inside generateBubblewrapArgs)
vi.mock("node:fs/promises", () => ({
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(""),
}));

// Mock linux detection (isWSL2 used internally)
vi.mock("../../../src/sandbox/linux.js", () => ({
  isWSL2: vi.fn().mockResolvedValue(false),
}));

// Track calls to child_process.execFile
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock node:util promisify so it wraps our mockExecFile
vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    // Return a function that calls our mockExecFile and returns a promise
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

// Re-import after mocks are established
const { generateBubblewrapArgs, executeBubblewrapped, BubblewrapError } = await import(
  "../../../src/sandbox/bubblewrap.js"
);

describe("bubblewrap sandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: execFile succeeds
    mockExecFile.mockImplementation(
      (
        cmd: string,
        args: readonly string[],
        opts: unknown,
        cb?: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const callback = typeof opts === "function" ? opts : cb;
        if (callback) {
          callback(null, "mock stdout", "mock stderr");
        }
      },
    );
  });

  describe("generateBubblewrapArgs()", () => {
    const baseConfig: BubblewrapConfig = {
      command: "echo",
      args: ["hello"],
      projectDir: "/home/user/project",
      homeDir: "/home/user",
      tmpDir: "/tmp",
    };

    it("includes --ro-bind for system directories", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      for (const sysDir of ["/usr", "/bin", "/lib", "/etc"]) {
        const roBindIdx = args.indexOf(sysDir);
        expect(roBindIdx).toBeGreaterThan(-1);
        // The argument before the first occurrence of sysDir should be sysDir itself (source)
        // and two positions before should be "--ro-bind"
        const idx = args.indexOf("--ro-bind");
        expect(idx).toBeGreaterThan(-1);
      }

      // Verify all system paths are present as --ro-bind pairs
      expect(args.filter((a) => a === "--ro-bind").length).toBeGreaterThanOrEqual(4);
    });

    it("includes --bind (writable) for project directory", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      // Find --bind followed by the project directory
      let found = false;
      for (let i = 0; i < args.length - 2; i++) {
        if (args[i] === "--bind" && args[i + 1] === "/home/user/project") {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it("includes --proc /proc and --dev /dev", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      const procIdx = args.indexOf("--proc");
      expect(procIdx).toBeGreaterThan(-1);
      expect(args[procIdx + 1]).toBe("/proc");

      const devIdx = args.indexOf("--dev");
      expect(devIdx).toBeGreaterThan(-1);
      expect(args[devIdx + 1]).toBe("/dev");
    });

    it("includes --unshare-pid and --die-with-parent", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      expect(args).toContain("--unshare-pid");
      expect(args).toContain("--die-with-parent");
    });

    it("includes --chdir for cwd when specified", async () => {
      const config: BubblewrapConfig = {
        ...baseConfig,
        cwd: "/home/user/project/src",
      };
      const args = await generateBubblewrapArgs(config);

      const chdirIdx = args.indexOf("--chdir");
      expect(chdirIdx).toBeGreaterThan(-1);
      expect(args[chdirIdx + 1]).toBe("/home/user/project/src");
    });

    it("includes --share-net by default for API calls", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      expect(args).toContain("--share-net");
      expect(args).not.toContain("--unshare-net");
    });

    it("includes --unshare-net when networkAccess is false", async () => {
      const config: BubblewrapConfig = {
        ...baseConfig,
        networkAccess: false,
      };
      const args = await generateBubblewrapArgs(config);

      expect(args).toContain("--unshare-net");
      expect(args).not.toContain("--share-net");
    });

    it("handles custom allowedPaths with proper mount types", async () => {
      const config: BubblewrapConfig = {
        ...baseConfig,
        allowedPaths: [
          { hostPath: "/opt/tools", writable: false },
          { hostPath: "/var/data", sandboxPath: "/data", writable: true },
        ],
      };
      const args = await generateBubblewrapArgs(config);

      // Read-only mount for /opt/tools
      let foundRo = false;
      for (let i = 0; i < args.length - 2; i++) {
        if (args[i] === "--ro-bind" && args[i + 1] === "/opt/tools") {
          foundRo = true;
          // sandbox path should default to host path
          expect(args[i + 2]).toBe("/opt/tools");
          break;
        }
      }
      expect(foundRo).toBe(true);

      // Writable mount for /var/data → /data
      let foundRw = false;
      for (let i = 0; i < args.length - 2; i++) {
        if (args[i] === "--bind" && args[i + 1] === "/var/data") {
          foundRw = true;
          expect(args[i + 2]).toBe("/data");
          break;
        }
      }
      expect(foundRw).toBe(true);
    });

    it("sets HOME environment variable", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      const setenvIdx = args.indexOf("--setenv");
      expect(setenvIdx).toBeGreaterThan(-1);

      // Find the specific --setenv HOME pair
      let foundHome = false;
      for (let i = 0; i < args.length - 2; i++) {
        if (args[i] === "--setenv" && args[i + 1] === "HOME") {
          foundHome = true;
          expect(args[i + 2]).toBe("/home/user");
          break;
        }
      }
      expect(foundHome).toBe(true);
    });

    it("adds tmpfs for /tmp", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      const tmpfsIdx = args.indexOf("--tmpfs");
      expect(tmpfsIdx).toBeGreaterThan(-1);
      expect(args[tmpfsIdx + 1]).toBe("/tmp");
    });
  });

  describe("executeBubblewrapped()", () => {
    const baseConfig: BubblewrapConfig = {
      command: "ls",
      args: ["-la"],
      projectDir: "/home/user/project",
      homeDir: "/home/user",
      tmpDir: "/tmp",
    };

    it("returns stdout and stderr from bwrap", async () => {
      const result = await executeBubblewrapped(baseConfig);

      expect(result.stdout).toBe("mock stdout");
      expect(result.stderr).toBe("mock stderr");
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });

    it("handles bwrap not found error gracefully", async () => {
      // First call to bwrap --version should fail with ENOENT
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = typeof opts === "function" ? opts : cb;
          if (callback) {
            const error = new Error("spawn bwrap ENOENT") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            callback(error, "", "");
          }
        },
      );

      await expect(executeBubblewrapped(baseConfig)).rejects.toThrow(BubblewrapError);
      await expect(executeBubblewrapped(baseConfig)).rejects.toThrow(/not installed/);
    });

    it("respects timeout via AbortController", async () => {
      // Make the second execFile call (the actual command) throw an AbortError
      let callCount = 0;
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = typeof opts === "function" ? opts : cb;
          callCount++;
          if (callCount === 1) {
            // First call: bwrap --version check succeeds
            if (callback) callback(null, "bubblewrap 0.8.0", "");
          } else {
            // Second call: actual execution - simulate abort
            if (callback) {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              callback(error, "", "");
            }
          }
        },
      );

      const result = await executeBubblewrapped({
        ...baseConfig,
        timeoutMs: 100,
      });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    });

    it("handles non-zero exit code", async () => {
      let callCount = 0;
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: readonly string[],
          opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = typeof opts === "function" ? opts : cb;
          callCount++;
          if (callCount === 1) {
            // bwrap --version check succeeds
            if (callback) callback(null, "bubblewrap 0.8.0", "");
          } else {
            // Actual command exits with non-zero code
            if (callback) {
              const error = new Error("Command failed") as Error & {
                code: number;
                stdout: string;
                stderr: string;
              };
              (error as Record<string, unknown>).code = 1;
              (error as Record<string, unknown>).stdout = "partial output";
              (error as Record<string, unknown>).stderr = "error output";
              callback(error, "", "");
            }
          }
        },
      );

      const result = await executeBubblewrapped(baseConfig);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("partial output");
      expect(result.stderr).toBe("error output");
      expect(result.timedOut).toBe(false);
    });

    it("includes command and args after -- separator", async () => {
      const args = await generateBubblewrapArgs(baseConfig);

      const separatorIdx = args.indexOf("--");
      expect(separatorIdx).toBeGreaterThan(-1);
      expect(args[separatorIdx + 1]).toBe("ls");
      expect(args[separatorIdx + 2]).toBe("-la");
    });
  });
});
