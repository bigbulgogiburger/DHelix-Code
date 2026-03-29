import { describe, it, expect, vi, beforeEach } from "vitest";
import { VERSION } from "../../../src/constants.js";

// Mock child_process exec
const mockExec = vi.fn();
vi.mock("node:child_process", () => ({
  exec: (...args: unknown[]) => mockExec(...args),
}));
vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    return async (command: string) => {
      // Call the mock exec and extract the callback-based result
      return new Promise((resolve, reject) => {
        (fn as (...args: unknown[]) => void)(
          command,
          { timeout: 30_000 },
          (error: Error | null, stdout: string, stderr: string) => {
            if (error) reject(error);
            else resolve({ stdout, stderr });
          },
        );
      });
    };
  },
}));

describe("update command (mocked)", () => {
  beforeEach(() => {
    mockExec.mockReset();
  });

  it("should report already on latest when versions match", async () => {
    // Mock exec to return current version
    mockExec.mockImplementation(
      (cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, VERSION + "\n", "");
      },
    );

    // Dynamic import to get the module with our mocks
    const { updateCommand } = await import("../../../src/commands/update.js");
    const result = await updateCommand.execute("", {
      workingDirectory: process.cwd(),
      model: "test",
      sessionId: "test",
      emit: () => {},
    });

    expect(result.output).toContain("Already running the latest version");
    expect(result.success).toBe(true);
  });

  it("should handle npm registry error", async () => {
    mockExec.mockImplementation(
      (cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, "ERR! 404 Not Found\n", "");
      },
    );

    const { updateCommand } = await import("../../../src/commands/update.js");
    const result = await updateCommand.execute("", {
      workingDirectory: process.cwd(),
      model: "test",
      sessionId: "test",
      emit: () => {},
    });

    expect(result.output).toContain("Could not check latest version");
    expect(result.success).toBe(false);
  });

  it("should handle empty response from npm", async () => {
    mockExec.mockImplementation(
      (cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, "\n", "");
      },
    );

    const { updateCommand } = await import("../../../src/commands/update.js");
    const result = await updateCommand.execute("", {
      workingDirectory: process.cwd(),
      model: "test",
      sessionId: "test",
      emit: () => {},
    });

    expect(result.output).toContain("Could not check latest version");
    expect(result.success).toBe(false);
  });

  it("should handle exec exception", async () => {
    mockExec.mockImplementation(
      (cmd: string, _opts: unknown, cb: (err: Error, stdout: string, stderr: string) => void) => {
        cb(new Error("Command failed"), "", "");
      },
    );

    const { updateCommand } = await import("../../../src/commands/update.js");
    const result = await updateCommand.execute("", {
      workingDirectory: process.cwd(),
      model: "test",
      sessionId: "test",
      emit: () => {},
    });

    expect(result.output).toContain("Update check failed");
    expect(result.success).toBe(false);
  });

  it("should perform successful update when newer version available", async () => {
    let callCount = 0;
    mockExec.mockImplementation(
      (cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        callCount++;
        if (callCount === 1) {
          // First call: npm view — returns newer version
          cb(null, "99.99.99\n", "");
        } else {
          // Second call: npm install — success
          cb(null, "added 1 package\n", "");
        }
      },
    );

    const { updateCommand } = await import("../../../src/commands/update.js");
    const result = await updateCommand.execute("", {
      workingDirectory: process.cwd(),
      model: "test",
      sessionId: "test",
      emit: () => {},
    });

    expect(result.output).toContain("Latest version: 99.99.99");
    expect(result.output).toContain("Updated to 99.99.99 successfully");
    expect(result.output).toContain("Restart dhelix");
    expect(result.success).toBe(true);
  });

  it("should handle update install failure with ERR in output", async () => {
    let callCount = 0;
    mockExec.mockImplementation(
      (cmd: string, _opts: unknown, cb: (err: null, stdout: string, stderr: string) => void) => {
        callCount++;
        if (callCount === 1) {
          // First call: npm view — returns newer version
          cb(null, "99.99.99\n", "");
        } else {
          // Second call: npm install — fails with ERR
          cb(null, "ERR! code EACCES\nERR! permission denied\n", "");
        }
      },
    );

    const { updateCommand } = await import("../../../src/commands/update.js");
    const result = await updateCommand.execute("", {
      workingDirectory: process.cwd(),
      model: "test",
      sessionId: "test",
      emit: () => {},
    });

    expect(result.output).toContain("Update failed");
    expect(result.output).toContain("Try manually");
    expect(result.success).toBe(false);
  });
});
