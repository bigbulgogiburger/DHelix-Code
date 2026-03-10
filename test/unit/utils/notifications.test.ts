import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendNotification, isNotificationAvailable } from "../../../src/utils/notifications.js";

// Mock node:child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// Mock platform detection
vi.mock("../../../src/utils/platform.js", () => ({
  getPlatform: vi.fn(),
}));

import { execFile } from "node:child_process";
import { getPlatform } from "../../../src/utils/platform.js";

const mockExecFile = vi.mocked(execFile);
const mockGetPlatform = vi.mocked(getPlatform);

/**
 * Helper to make the mocked execFile call its callback with success or error.
 */
function mockExecFileResult(success: boolean): void {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
    const cb = callback as (error: Error | null) => void;
    if (success) {
      cb(null);
    } else {
      cb(new Error("command failed"));
    }
    return { unref: vi.fn() } as unknown as ReturnType<typeof execFile>;
  });
}

describe("sendNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("macOS", () => {
    beforeEach(() => {
      mockGetPlatform.mockReturnValue("darwin");
    });

    it("should send notification via osascript", async () => {
      mockExecFileResult(true);

      const result = await sendNotification({
        title: "Test Title",
        message: "Test message",
      });

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        "osascript",
        ["-e", 'display notification "Test message" with title "Test Title"'],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    });

    it("should include sound when requested", async () => {
      mockExecFileResult(true);

      await sendNotification({
        title: "Test",
        message: "msg",
        sound: true,
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "osascript",
        ["-e", 'display notification "msg" with title "Test" sound name "default"'],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    });

    it("should escape special characters in AppleScript", async () => {
      mockExecFileResult(true);

      await sendNotification({
        title: 'Say "hello"',
        message: "back\\slash",
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "osascript",
        ["-e", 'display notification "back\\\\slash" with title "Say \\"hello\\""'],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    });

    it("should return false when osascript fails", async () => {
      mockExecFileResult(false);

      const result = await sendNotification({
        title: "Test",
        message: "msg",
      });

      expect(result).toBe(false);
    });
  });

  describe("Linux", () => {
    beforeEach(() => {
      mockGetPlatform.mockReturnValue("linux");
    });

    it("should send notification via notify-send", async () => {
      mockExecFileResult(true);

      const result = await sendNotification({
        title: "Test Title",
        message: "Test message",
      });

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        "notify-send",
        ["Test Title", "Test message"],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    });

    it("should include icon when provided", async () => {
      mockExecFileResult(true);

      await sendNotification({
        title: "Test",
        message: "msg",
        icon: "/path/to/icon.png",
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        "notify-send",
        ["--icon", "/path/to/icon.png", "Test", "msg"],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    });

    it("should return false when notify-send fails", async () => {
      mockExecFileResult(false);

      const result = await sendNotification({
        title: "Test",
        message: "msg",
      });

      expect(result).toBe(false);
    });
  });

  describe("Windows", () => {
    beforeEach(() => {
      mockGetPlatform.mockReturnValue("win32");
    });

    it("should send notification via PowerShell", async () => {
      mockExecFileResult(true);

      const result = await sendNotification({
        title: "Test Title",
        message: "Test message",
      });

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        "powershell",
        expect.arrayContaining(["-NoProfile", "-NonInteractive", "-Command"]),
        expect.objectContaining({ timeout: 10000 }),
        expect.any(Function),
      );
    });

    it("should escape single quotes for PowerShell", async () => {
      mockExecFileResult(true);

      await sendNotification({
        title: "It's a test",
        message: "Don't panic",
      });

      const args = mockExecFile.mock.calls[0]?.[1] as string[];
      const script = args[args.length - 1];
      expect(script).toContain("It''s a test");
      expect(script).toContain("Don''t panic");
    });

    it("should return false when PowerShell fails", async () => {
      mockExecFileResult(false);

      const result = await sendNotification({
        title: "Test",
        message: "msg",
      });

      expect(result).toBe(false);
    });
  });

  describe("error resilience", () => {
    it("should return false when execFile throws synchronously", async () => {
      mockGetPlatform.mockReturnValue("darwin");
      mockExecFile.mockImplementation(() => {
        throw new Error("spawn failed");
      });

      const result = await sendNotification({
        title: "Test",
        message: "msg",
      });

      expect(result).toBe(false);
    });

    it("should never throw regardless of errors", async () => {
      mockGetPlatform.mockImplementation(() => {
        throw new Error("platform detection failed");
      });

      // Should not throw
      const result = await sendNotification({
        title: "Test",
        message: "msg",
      });

      expect(result).toBe(false);
    });
  });
});

describe("isNotificationAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should check osascript on macOS", async () => {
    mockGetPlatform.mockReturnValue("darwin");
    mockExecFileResult(true);

    const result = await isNotificationAvailable();

    expect(result).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      "osascript",
      ["-e", "return"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("should check notify-send on Linux", async () => {
    mockGetPlatform.mockReturnValue("linux");
    mockExecFileResult(true);

    const result = await isNotificationAvailable();

    expect(result).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      "which",
      ["notify-send"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("should check PowerShell on Windows", async () => {
    mockGetPlatform.mockReturnValue("win32");
    mockExecFileResult(true);

    const result = await isNotificationAvailable();

    expect(result).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", "exit 0"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("should return false when check command fails", async () => {
    mockGetPlatform.mockReturnValue("linux");
    mockExecFileResult(false);

    const result = await isNotificationAvailable();

    expect(result).toBe(false);
  });

  it("should return false on unknown platform errors", async () => {
    mockGetPlatform.mockImplementation(() => {
      throw new Error("unexpected");
    });

    const result = await isNotificationAvailable();

    expect(result).toBe(false);
  });
});
