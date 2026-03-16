import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StdioTransport, StdioTransportError } from "../../../../src/mcp/transports/stdio.js";
import type { MCPServerConfig, JsonRpcMessage } from "../../../../src/mcp/types.js";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

// Create mock process objects
function createMockProcess(): {
  process: ChildProcess;
  stdin: { writable: boolean; write: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
} {
  const mockStdin = { writable: true, write: vi.fn() };
  const mockStdout = new EventEmitter();
  const mockStderr = new EventEmitter();
  const proc = new EventEmitter() as unknown as ChildProcess;
  Object.defineProperty(proc, "stdin", { value: mockStdin, writable: true });
  Object.defineProperty(proc, "stdout", { value: mockStdout, writable: true });
  Object.defineProperty(proc, "stderr", { value: mockStderr, writable: true });
  (proc as unknown as { kill: ReturnType<typeof vi.fn> }).kill = vi.fn();
  return { process: proc, stdin: mockStdin, stdout: mockStdout, stderr: mockStderr };
}

// Mock child_process
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Mock readline to capture the input stream and emit lines manually
const mockReadlineInstances: Array<{
  emitter: EventEmitter;
  close: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("node:readline", () => ({
  createInterface: (opts: { input: EventEmitter }) => {
    const emitter = new EventEmitter();
    const closeFn = vi.fn();
    const instance = { emitter, close: closeFn, on: emitter.on.bind(emitter) };
    mockReadlineInstances.push(instance);
    return instance;
  },
}));

function createConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name: "test-stdio",
    transport: "stdio",
    command: "node",
    args: ["server.js"],
    ...overrides,
  };
}

describe("StdioTransport", () => {
  let mockProcess: ReturnType<typeof createMockProcess>;

  beforeEach(() => {
    mockSpawn.mockReset();
    mockReadlineInstances.length = 0;
    mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess.process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connect", () => {
    it("should throw when command is missing", async () => {
      const transport = new StdioTransport({
        name: "no-cmd",
        transport: "stdio",
      });

      await expect(transport.connect()).rejects.toThrow("stdio transport requires a command");
      await expect(transport.connect()).rejects.toThrow(StdioTransportError);
    });

    it("should spawn child process with correct arguments", async () => {
      const transport = new StdioTransport(createConfig());
      await transport.connect();

      // On Windows, resolveCommand appends .cmd for known Node CLI tools
      const expectedCommand = "node";
      expect(mockSpawn).toHaveBeenCalledWith(
        expectedCommand,
        ["server.js"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    });

    it("should spawn with empty args when none provided", async () => {
      const transport = new StdioTransport(createConfig({ args: undefined }));
      await transport.connect();

      const expectedCommand = "node";
      expect(mockSpawn).toHaveBeenCalledWith(
        expectedCommand,
        [],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      );
    });

    it("should resolve environment variables in config", async () => {
      process.env.TEST_STDIO_VAR = "resolved-value";

      const transport = new StdioTransport(
        createConfig({
          env: {
            CUSTOM: "${TEST_STDIO_VAR}",
            WITH_DEFAULT: "${MISSING_VAR:-fallback}",
            PLAIN: "plain-value",
          },
        }),
      );
      await transport.connect();

      const [, , options] = mockSpawn.mock.calls[0] as [
        string,
        string[],
        { env: Record<string, string> },
      ];
      expect(options.env.CUSTOM).toBe("resolved-value");
      expect(options.env.WITH_DEFAULT).toBe("fallback");
      expect(options.env.PLAIN).toBe("plain-value");

      delete process.env.TEST_STDIO_VAR;
    });

    it("should resolve ${VAR} with no default to empty string when missing", async () => {
      const transport = new StdioTransport(
        createConfig({
          env: { EMPTY: "${DEFINITELY_MISSING_VAR}" },
        }),
      );
      await transport.connect();

      const [, , options] = mockSpawn.mock.calls[0] as [
        string,
        string[],
        { env: Record<string, string> },
      ];
      expect(options.env.EMPTY).toBe("");
    });

    it("should throw when stdin or stdout is not available", async () => {
      const badProcess = createMockProcess();
      Object.defineProperty(badProcess.process, "stdout", { value: null, writable: true });
      mockSpawn.mockReturnValue(badProcess.process);

      const transport = new StdioTransport(createConfig());
      await expect(transport.connect()).rejects.toThrow("Failed to attach to child process stdio");
    });

    it("should register exit and error handlers on the process", async () => {
      const transport = new StdioTransport(createConfig());
      const errorHandler = vi.fn();
      const closeHandler = vi.fn();
      transport.onError(errorHandler);
      transport.onClose(closeHandler);

      await transport.connect();

      // Simulate process exit
      mockProcess.process.emit("exit", 1);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler.mock.calls[0][0].message).toContain("exited with code 1");
      expect(closeHandler).toHaveBeenCalledTimes(1);
    });

    it("should handle process error event", async () => {
      const transport = new StdioTransport(createConfig());
      const errorHandler = vi.fn();
      transport.onError(errorHandler);

      await transport.connect();

      mockProcess.process.emit("error", new Error("spawn failed"));

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler.mock.calls[0][0].message).toContain("Server process error: spawn failed");
    });
  });

  describe("disconnect", () => {
    it("should kill the child process", async () => {
      const transport = new StdioTransport(createConfig());
      await transport.connect();

      await transport.disconnect();

      expect(
        (mockProcess.process as unknown as { kill: ReturnType<typeof vi.fn> }).kill,
      ).toHaveBeenCalled();
    });

    it("should close readline interface", async () => {
      const transport = new StdioTransport(createConfig());
      await transport.connect();

      const rl = mockReadlineInstances[0];
      await transport.disconnect();

      expect(rl.close).toHaveBeenCalled();
    });

    it("should be safe to call when not connected", async () => {
      const transport = new StdioTransport(createConfig());
      // Calling disconnect without connecting should not throw
      await transport.disconnect();
    });
  });

  describe("sendRequest", () => {
    it("should write JSON-RPC request to stdin", async () => {
      const transport = new StdioTransport(createConfig());
      await transport.connect();

      transport.sendRequest(1, "tools/list", {});

      expect(mockProcess.stdin.write).toHaveBeenCalledTimes(1);
      const written = mockProcess.stdin.write.mock.calls[0][0] as string;
      const parsed = JSON.parse(written.trim()) as Record<string, unknown>;
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(1);
      expect(parsed.method).toBe("tools/list");
      expect(parsed.params).toEqual({});
    });

    it("should append newline to each message", async () => {
      const transport = new StdioTransport(createConfig());
      await transport.connect();

      transport.sendRequest(1, "test", {});

      const written = mockProcess.stdin.write.mock.calls[0][0] as string;
      expect(written.endsWith("\n")).toBe(true);
    });

    it("should throw when stdin is not writable", async () => {
      const transport = new StdioTransport(createConfig());
      await transport.connect();

      mockProcess.stdin.writable = false;

      expect(() => transport.sendRequest(1, "test", {})).toThrow("Server stdin not writable");
    });
  });

  describe("sendNotification", () => {
    it("should write JSON-RPC notification without id", async () => {
      const transport = new StdioTransport(createConfig());
      await transport.connect();

      transport.sendNotification("notifications/initialized", {});

      const written = mockProcess.stdin.write.mock.calls[0][0] as string;
      const parsed = JSON.parse(written.trim()) as Record<string, unknown>;
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.method).toBe("notifications/initialized");
      expect(parsed).not.toHaveProperty("id");
    });
  });

  describe("message handling", () => {
    it("should parse JSON-RPC messages from stdout lines", async () => {
      const transport = new StdioTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      const rl = mockReadlineInstances[0];
      const message: JsonRpcMessage = {
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      };
      rl.emitter.emit("line", JSON.stringify(message));

      expect(messageHandler).toHaveBeenCalledTimes(1);
      expect(messageHandler).toHaveBeenCalledWith(message);
    });

    it("should ignore empty lines", async () => {
      const transport = new StdioTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      const rl = mockReadlineInstances[0];
      rl.emitter.emit("line", "");
      rl.emitter.emit("line", "   ");

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it("should ignore non-JSON lines", async () => {
      const transport = new StdioTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      const rl = mockReadlineInstances[0];
      rl.emitter.emit("line", "DEBUG: some debug output");

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it("should handle multiple messages", async () => {
      const transport = new StdioTransport(createConfig());
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      await transport.connect();

      const rl = mockReadlineInstances[0];
      const msg1: JsonRpcMessage = { jsonrpc: "2.0", id: 1, result: "first" };
      const msg2: JsonRpcMessage = { jsonrpc: "2.0", id: 2, result: "second" };
      rl.emitter.emit("line", JSON.stringify(msg1));
      rl.emitter.emit("line", JSON.stringify(msg2));

      expect(messageHandler).toHaveBeenCalledTimes(2);
      expect(messageHandler).toHaveBeenCalledWith(msg1);
      expect(messageHandler).toHaveBeenCalledWith(msg2);
    });
  });

  describe("handler registration", () => {
    it("should register message handler", () => {
      const transport = new StdioTransport(createConfig());
      transport.onMessage(vi.fn());
      // No error
    });

    it("should register error handler", () => {
      const transport = new StdioTransport(createConfig());
      transport.onError(vi.fn());
    });

    it("should register close handler", () => {
      const transport = new StdioTransport(createConfig());
      transport.onClose(vi.fn());
    });
  });

  describe("Windows command resolution", () => {
    it("should resolve npx to npx.cmd on Windows", async () => {
      const transport = new StdioTransport(createConfig({ command: "npx" }));
      await transport.connect();

      const expectedCommand = process.platform === "win32" ? "npx.cmd" : "npx";
      expect(mockSpawn).toHaveBeenCalledWith(
        expectedCommand,
        expect.any(Array),
        expect.any(Object),
      );
    });

    it("should not append .cmd if already present", async () => {
      const transport = new StdioTransport(createConfig({ command: "npx.cmd" }));
      await transport.connect();

      expect(mockSpawn).toHaveBeenCalledWith("npx.cmd", expect.any(Array), expect.any(Object));
    });

    it("should not modify unknown commands", async () => {
      const transport = new StdioTransport(createConfig({ command: "my-custom-server" }));
      await transport.connect();

      expect(mockSpawn).toHaveBeenCalledWith(
        "my-custom-server",
        expect.any(Array),
        expect.any(Object),
      );
    });

    it("should handle ENOENT errors with descriptive message", async () => {
      const transport = new StdioTransport(createConfig({ command: "npx" }));
      const errorHandler = vi.fn();
      transport.onError(errorHandler);

      await transport.connect();

      const enoentError = new Error("spawn npx ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      mockProcess.process.emit("error", enoentError);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      const reportedError = errorHandler.mock.calls[0][0] as StdioTransportError;
      expect(reportedError.message).toContain("Command not found");
      expect(reportedError.message).toContain("Ensure it is installed and in your PATH");
    });

    it("should include command in error context for ENOENT", async () => {
      const transport = new StdioTransport(createConfig({ command: "npx" }));
      const errorHandler = vi.fn();
      transport.onError(errorHandler);

      await transport.connect();

      const enoentError = new Error("spawn npx ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      mockProcess.process.emit("error", enoentError);

      const reportedError = errorHandler.mock.calls[0][0] as StdioTransportError;
      expect(reportedError.context).toHaveProperty("command");
    });
  });

  describe("StdioTransportError", () => {
    it("should have correct code and context", () => {
      const error = new StdioTransportError("test error", { server: "test" });
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("STDIO_TRANSPORT_ERROR");
      expect(error.message).toBe("test error");
      expect(error.context).toEqual({ server: "test" });
    });
  });
});
