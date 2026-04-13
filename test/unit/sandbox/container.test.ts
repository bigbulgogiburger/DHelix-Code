import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock execFile before imports
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    return (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        (fn as (...a: unknown[]) => void)(
          ...args,
          (err: Error | null, stdout?: string, stderr?: string) => {
            if (err) reject(err);
            else resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
          },
        );
      });
    };
  },
}));

const {
  buildSandboxArgs,
  isDockerAvailable,
  getDockerVersion,
  executeInContainer,
  ContainerSandboxError,
} = await import("../../../src/sandbox/container.js");

// Helper: simulate successful execFile
function mockSuccess(stdout = "mock stdout", stderr = "mock stderr") {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: readonly string[],
      _opts: unknown,
      cb?: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      const callback = typeof _opts === "function" ? _opts : cb;
      if (callback) callback(null, stdout, stderr);
    },
  );
}

// Helper: simulate failed execFile
function mockFailure(err: Error) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: readonly string[],
      _opts: unknown,
      cb?: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      const callback = typeof _opts === "function" ? _opts : cb;
      if (callback) callback(err, "", "");
    },
  );
}

describe("container sandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildSandboxArgs()", () => {
    it("should include --rm and --read-only flags", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/home/user/project",
      });
      expect(args).toContain("--rm");
      expect(args).toContain("--read-only");
    });

    it("should use default image node:20-slim when not specified", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
      });
      expect(args).toContain("node:20-slim");
    });

    it("should use custom image when specified", () => {
      const args = buildSandboxArgs({
        command: "python",
        projectDir: "/project",
        image: "python:3.12-slim",
      });
      expect(args).toContain("python:3.12-slim");
    });

    it("should mount projectDir as /workspace:ro", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/home/user/myapp",
      });
      expect(args).toContain("-v");
      const mountIndex = args.indexOf("-v");
      expect(args[mountIndex + 1]).toBe("/home/user/myapp:/workspace:ro");
    });

    it("should set workdir to /workspace", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
      });
      expect(args).toContain("-w");
      const wIndex = args.indexOf("-w");
      expect(args[wIndex + 1]).toBe("/workspace");
    });

    it("should disable network by default (--network none)", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
      });
      expect(args).toContain("--network");
      const netIndex = args.indexOf("--network");
      expect(args[netIndex + 1]).toBe("none");
    });

    it("should enable network bridge when networkAccess is true", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
        networkAccess: true,
      });
      const netIndex = args.indexOf("--network");
      expect(args[netIndex + 1]).toBe("bridge");
    });

    it("should apply default memory limit of 512m", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
      });
      expect(args).toContain("--memory=512m");
    });

    it("should apply custom memory limit", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
        memoryLimitMb: 256,
      });
      expect(args).toContain("--memory=256m");
    });

    it("should apply default cpu limit of 1.0", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
      });
      expect(args).toContain("--cpus=1");
    });

    it("should apply custom cpu limit", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
        cpuLimit: 0.5,
      });
      expect(args).toContain("--cpus=0.5");
    });

    it("should inject environment variables with -e flags", () => {
      const args = buildSandboxArgs({
        command: "node",
        projectDir: "/project",
        env: { NODE_ENV: "production", PORT: "3000" },
      });
      expect(args).toContain("-e");
      expect(args).toContain("NODE_ENV=production");
      expect(args).toContain("PORT=3000");
    });

    it("should include command and args at the end", () => {
      const args = buildSandboxArgs({
        command: "node",
        args: ["index.js", "--port", "3000"],
        projectDir: "/project",
      });
      const nodeIndex = args.lastIndexOf("node");
      expect(args[nodeIndex + 1]).toBe("index.js");
      expect(args[nodeIndex + 2]).toBe("--port");
      expect(args[nodeIndex + 3]).toBe("3000");
    });

    it("should start with 'run' as the first argument", () => {
      const args = buildSandboxArgs({
        command: "echo",
        projectDir: "/project",
      });
      expect(args[0]).toBe("run");
    });
  });

  describe("isDockerAvailable()", () => {
    it("should return true when docker info succeeds", async () => {
      mockSuccess("Docker version info", "");
      const result = await isDockerAvailable();
      expect(result).toBe(true);
    });

    it("should return false when docker info fails", async () => {
      mockFailure(new Error("docker: command not found"));
      const result = await isDockerAvailable();
      expect(result).toBe(false);
    });
  });

  describe("getDockerVersion()", () => {
    it("should return version string when docker --version succeeds", async () => {
      mockSuccess("Docker version 24.0.5, build ced0996", "");
      const version = await getDockerVersion();
      expect(version).toBe("24.0.5");
    });

    it("should return null when docker --version fails", async () => {
      mockFailure(new Error("not found"));
      const version = await getDockerVersion();
      expect(version).toBeNull();
    });

    it("should return trimmed stdout when version pattern does not match", async () => {
      mockSuccess("some other output", "");
      const version = await getDockerVersion();
      expect(version).toBe("some other output");
    });
  });

  describe("executeInContainer()", () => {
    it("should throw ContainerSandboxError when docker is unavailable", async () => {
      // First call (docker info) fails → isDockerAvailable returns false
      mockFailure(new Error("ENOENT"));

      await expect(
        executeInContainer({ command: "node", projectDir: "/project" }),
      ).rejects.toBeInstanceOf(ContainerSandboxError);
    });

    it("should return stdout and stderr on success", async () => {
      // First call (docker info) succeeds, second call (docker run) succeeds
      let callCount = 0;
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: readonly string[],
          _opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = typeof _opts === "function" ? _opts : cb;
          callCount++;
          if (callback) callback(null, callCount === 1 ? "info" : "hello world", "");
        },
      );

      const result = await executeInContainer({
        command: "echo",
        args: ["hello world"],
        projectDir: "/project",
      });

      expect(result.stdout).toBe("hello world");
      expect(result.exitCode).toBe(0);
    });

    it("should return non-zero exitCode when command fails", async () => {
      let callCount = 0;
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: readonly string[],
          _opts: unknown,
          cb?: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          const callback = typeof _opts === "function" ? _opts : cb;
          callCount++;
          if (callCount === 1) {
            // docker info succeeds
            if (callback) callback(null, "info", "");
          } else {
            // docker run fails with exit code
            const err = Object.assign(new Error("exit 1"), {
              code: 1,
              stdout: "",
              stderr: "error",
            });
            if (callback) callback(err as unknown as Error, "", "error");
          }
        },
      );

      const result = await executeInContainer({
        command: "false",
        projectDir: "/project",
      });

      expect(result.exitCode).toBe(1);
    });
  });
});
