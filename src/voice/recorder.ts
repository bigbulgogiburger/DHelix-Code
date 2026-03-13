import { spawn, type ChildProcess } from "node:child_process";

export interface RecorderOptions {
  readonly sampleRate?: number; // default: 16000
  readonly channels?: number; // default: 1
  readonly soxPath?: string; // default: "sox"
}

export interface RecorderHandle {
  readonly stop: () => Promise<Buffer>;
  readonly cancel: () => void;
  readonly isRecording: boolean;
}

/**
 * Create a microphone recorder using SoX.
 * Returns a handle to stop/cancel recording and retrieve the audio buffer.
 */
export function createRecorder(options: RecorderOptions = {}): RecorderHandle {
  const { sampleRate = 16000, channels = 1, soxPath = "sox" } = options;
  const chunks: Buffer[] = [];
  let recording = true;
  let resolveStop: ((buf: Buffer) => void) | null = null;

  const proc: ChildProcess = spawn(
    soxPath,
    [
      "-d",
      "-t",
      "wav",
      "-r",
      String(sampleRate),
      "-c",
      String(channels),
      "-b",
      "16",
      "-e",
      "signed-integer",
      "-",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  proc.stdout?.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  proc.on("close", () => {
    recording = false;
    const buffer = Buffer.concat(chunks);
    resolveStop?.(buffer);
  });

  proc.on("error", () => {
    recording = false;
    resolveStop?.(Buffer.concat(chunks));
  });

  return {
    get isRecording() {
      return recording;
    },
    stop: () =>
      new Promise<Buffer>((resolve) => {
        resolveStop = resolve;
        proc.kill("SIGTERM");
      }),
    cancel: () => {
      recording = false;
      proc.kill("SIGKILL");
    },
  };
}

/**
 * Check if SoX is installed and available on the system PATH.
 */
export async function checkSoxInstalled(soxPath = "sox"): Promise<boolean> {
  try {
    const proc = spawn(soxPath, ["--version"], { stdio: "pipe" });
    return new Promise<boolean>((resolve) => {
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  } catch {
    return false;
  }
}
