import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      audio = {
        transcriptions: {
          create: mockCreate,
        },
      };
      constructor(readonly config: { apiKey: string; baseURL?: string }) {}
    },
  };
});

describe("transcriber", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockReset();
  });

  describe("transcribe", () => {
    it("should call OpenAI API with correct params", async () => {
      mockCreate.mockResolvedValueOnce({
        text: "Hello world",
        language: "en",
      });

      const { transcribe } = await import("../../../src/voice/transcriber.js");
      const audioBuffer = Buffer.from("fake-wav-data");

      const result = await transcribe(audioBuffer, {
        apiKey: "test-key",
        baseUrl: "https://api.example.com/v1",
        model: "whisper-1",
        language: "en",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        file: expect.any(File),
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json",
      });

      expect(result.text).toBe("Hello world");
      expect(result.language).toBe("en");
      expect(typeof result.duration).toBe("number");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should use default model when not specified", async () => {
      mockCreate.mockResolvedValueOnce({
        text: "test",
        language: "ko",
      });

      const { transcribe } = await import("../../../src/voice/transcriber.js");

      await transcribe(Buffer.from("data"), {
        apiKey: "key",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "whisper-1",
        }),
      );
    });

    it("should return language from response", async () => {
      mockCreate.mockResolvedValueOnce({
        text: "Korean text",
        language: "ko",
      });

      const { transcribe } = await import("../../../src/voice/transcriber.js");

      const result = await transcribe(Buffer.from("data"), {
        apiKey: "key",
        language: "ko",
      });

      expect(result.language).toBe("ko");
    });

    it("should fall back to options language when response has none", async () => {
      mockCreate.mockResolvedValueOnce({
        text: "Some text",
        language: undefined,
      });

      const { transcribe } = await import("../../../src/voice/transcriber.js");

      const result = await transcribe(Buffer.from("data"), {
        apiKey: "key",
        language: "ja",
      });

      expect(result.language).toBe("ja");
    });

    it("should fall back to 'unknown' when no language info available", async () => {
      mockCreate.mockResolvedValueOnce({
        text: "Some text",
        language: undefined,
      });

      const { transcribe } = await import("../../../src/voice/transcriber.js");

      const result = await transcribe(Buffer.from("data"), {
        apiKey: "key",
      });

      expect(result.language).toBe("unknown");
    });

    it("should calculate duration in seconds", async () => {
      // Mock Date.now to control timing
      const startTime = 1000;
      const endTime = 3500;
      let callCount = 0;
      const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
        return callCount++ === 0 ? startTime : endTime;
      });

      mockCreate.mockResolvedValueOnce({
        text: "timed",
        language: "en",
      });

      const { transcribe } = await import("../../../src/voice/transcriber.js");

      const result = await transcribe(Buffer.from("data"), {
        apiKey: "key",
      });

      expect(result.duration).toBe(2.5);

      dateNowSpy.mockRestore();
    });
  });
});
