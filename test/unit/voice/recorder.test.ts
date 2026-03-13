import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

// Track spawned processes for assertions
let lastSpawnArgs: { command: string; args: string[]; options: unknown } | null = null;
let mockProcess: EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
};

function createMockProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn((signal?: string) => {
    // Simulate close after kill
    setTimeout(() => proc.emit("close", signal === "SIGKILL" ? 1 : 0), 0);
  });
  return proc;
}

vi.mock("node:child_process", () => ({
  spawn: (command: string, args: string[], options: unknown) => {
    lastSpawnArgs = { command, args, options };
    mockProcess = createMockProcess();
    return mockProcess as unknown as ChildProcess;
  },
}));

describe("recorder", () => {
  beforeEach(() => {
    lastSpawnArgs = null;
    vi.resetModules();
  });

  describe("createRecorder", () => {
    it("should return a handle with isRecording, stop, and cancel", async () => {
      const { createRecorder } = await import("../../../src/voice/recorder.js");
      const handle = createRecorder();

      expect(handle.isRecording).toBe(true);
      expect(typeof handle.stop).toBe("function");
      expect(typeof handle.cancel).toBe("function");
    });

    it("should spawn sox with default options", async () => {
      const { createRecorder } = await import("../../../src/voice/recorder.js");
      createRecorder();

      expect(lastSpawnArgs).not.toBeNull();
      expect(lastSpawnArgs!.command).toBe("sox");
      expect(lastSpawnArgs!.args).toContain("-d");
      expect(lastSpawnArgs!.args).toContain("16000");
      expect(lastSpawnArgs!.args).toContain("1");
    });

    it("should spawn sox with custom options", async () => {
      const { createRecorder } = await import("../../../src/voice/recorder.js");
      createRecorder({ sampleRate: 44100, channels: 2, soxPath: "/usr/bin/sox" });

      expect(lastSpawnArgs!.command).toBe("/usr/bin/sox");
      expect(lastSpawnArgs!.args).toContain("44100");
      expect(lastSpawnArgs!.args).toContain("2");
    });

    it("should collect stdout data into buffer", async () => {
      const { createRecorder } = await import("../../../src/voice/recorder.js");
      const handle = createRecorder();

      // Simulate audio data arriving on stdout
      const chunk1 = Buffer.from("audio-data-1");
      const chunk2 = Buffer.from("audio-data-2");
      mockProcess.stdout.emit("data", chunk1);
      mockProcess.stdout.emit("data", chunk2);

      // Stop and get the buffer
      const bufferPromise = handle.stop();
      // Wait for the close event
      const buffer = await bufferPromise;

      expect(buffer.length).toBe(chunk1.length + chunk2.length);
      expect(buffer.toString()).toBe("audio-data-1audio-data-2");
    });

    it("stop() should kill process with SIGTERM and resolve with buffer", async () => {
      const { createRecorder } = await import("../../../src/voice/recorder.js");
      const handle = createRecorder();

      mockProcess.stdout.emit("data", Buffer.from("test-audio"));

      const bufferPromise = handle.stop();
      const buffer = await bufferPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
      expect(buffer.toString()).toBe("test-audio");
    });

    it("cancel() should kill process with SIGKILL", async () => {
      const { createRecorder } = await import("../../../src/voice/recorder.js");
      const handle = createRecorder();

      handle.cancel();

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGKILL");
      expect(handle.isRecording).toBe(false);
    });

    it("should set isRecording to false after process closes", async () => {
      const { createRecorder } = await import("../../../src/voice/recorder.js");
      const handle = createRecorder();

      expect(handle.isRecording).toBe(true);

      await handle.stop();

      expect(handle.isRecording).toBe(false);
    });
  });

  describe("checkSoxInstalled", () => {
    it("should return true when sox exits with code 0", async () => {
      const { checkSoxInstalled } = await import("../../../src/voice/recorder.js");
      const result = checkSoxInstalled();

      // Simulate successful exit
      mockProcess.emit("close", 0);

      expect(await result).toBe(true);
    });

    it("should return false when sox exits with non-zero code", async () => {
      const { checkSoxInstalled } = await import("../../../src/voice/recorder.js");
      const result = checkSoxInstalled();

      mockProcess.emit("close", 1);

      expect(await result).toBe(false);
    });

    it("should return false when spawn emits error", async () => {
      const { checkSoxInstalled } = await import("../../../src/voice/recorder.js");
      const result = checkSoxInstalled();

      mockProcess.emit("error", new Error("ENOENT"));

      expect(await result).toBe(false);
    });

    it("should use custom soxPath", async () => {
      const { checkSoxInstalled } = await import("../../../src/voice/recorder.js");
      checkSoxInstalled("/custom/sox");

      expect(lastSpawnArgs!.command).toBe("/custom/sox");

      mockProcess.emit("close", 0);
    });
  });
});
