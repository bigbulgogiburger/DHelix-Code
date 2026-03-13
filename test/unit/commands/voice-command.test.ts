import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCheckSoxInstalled = vi.fn();

vi.mock("../../../src/voice/recorder.js", () => ({
  checkSoxInstalled: mockCheckSoxInstalled,
}));

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/voice command", () => {
  let voiceCommand: (typeof import("../../../src/commands/voice.js"))["voiceCommand"];

  beforeEach(async () => {
    vi.resetModules();
    mockCheckSoxInstalled.mockReset();
    const mod = await import("../../../src/commands/voice.js");
    voiceCommand = mod.voiceCommand;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct metadata", () => {
    expect(voiceCommand.name).toBe("voice");
    expect(voiceCommand.description).toContain("voice");
    expect(voiceCommand.usage).toContain("/voice");
    expect(typeof voiceCommand.execute).toBe("function");
  });

  it('should disable voice with "off" argument', async () => {
    const result = await voiceCommand.execute("off", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("disabled");
  });

  it('should disable voice with "OFF" (case-insensitive)', async () => {
    const result = await voiceCommand.execute("OFF", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("disabled");
  });

  it("should fail when SoX is not installed", async () => {
    mockCheckSoxInstalled.mockResolvedValueOnce(false);

    const result = await voiceCommand.execute("", baseContext);

    expect(result.success).toBe(false);
    expect(result.output).toContain("SoX");
    expect(result.output).toContain("brew install sox");
    expect(result.output).toContain("apt install sox");
    expect(result.output).toContain("choco install sox");
  });

  it("should fail when OPENAI_API_KEY is not set", async () => {
    mockCheckSoxInstalled.mockResolvedValueOnce(true);
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await voiceCommand.execute("", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("OPENAI_API_KEY");
    } finally {
      if (originalKey !== undefined) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    }
  });

  it("should succeed when SoX is installed and API key is set", async () => {
    mockCheckSoxInstalled.mockResolvedValueOnce(true);
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-api-key";

    try {
      const result = await voiceCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Voice input enabled");
      expect(result.output).toContain("SPACE");
    } finally {
      if (originalKey !== undefined) {
        process.env.OPENAI_API_KEY = originalKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    }
  });

  it('should succeed with "on" argument', async () => {
    mockCheckSoxInstalled.mockResolvedValueOnce(true);
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-api-key";

    try {
      const result = await voiceCommand.execute("on", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Voice input enabled");
    } finally {
      if (originalKey !== undefined) {
        process.env.OPENAI_API_KEY = originalKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    }
  });
});
