import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react
vi.mock("react", () => {
  return {
    default: {
      createElement: (
        type: unknown,
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ) => ({ type, props, children }),
    },
    createElement: (
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ) => ({ type, props, children }),
  };
});

// Mock ink
vi.mock("ink", () => ({
  Box: "Box",
  Text: "Text",
}));

describe("VoiceIndicator", () => {
  let VoiceIndicator: (typeof import("../../../../src/cli/components/VoiceIndicator.js"))["VoiceIndicator"];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../src/cli/components/VoiceIndicator.js");
    VoiceIndicator = mod.VoiceIndicator;
  });

  it("should return null when no state is active and no transcription", () => {
    const result = VoiceIndicator({
      isRecording: false,
      isTranscribing: false,
    });
    expect(result).toBeNull();
  });

  it("should return null when all props are falsy", () => {
    const result = VoiceIndicator({
      isRecording: false,
      isTranscribing: false,
      lastTranscription: undefined,
    });
    expect(result).toBeNull();
  });

  it("should render when isRecording is true", () => {
    const result = VoiceIndicator({
      isRecording: true,
      isTranscribing: false,
    });
    expect(result).not.toBeNull();
  });

  it("should render when isTranscribing is true", () => {
    const result = VoiceIndicator({
      isRecording: false,
      isTranscribing: true,
    });
    expect(result).not.toBeNull();
  });

  it("should render when lastTranscription is provided", () => {
    const result = VoiceIndicator({
      isRecording: false,
      isTranscribing: false,
      lastTranscription: "Hello world",
    });
    expect(result).not.toBeNull();
  });

  it("should render recording state even when transcription exists", () => {
    const result = VoiceIndicator({
      isRecording: true,
      isTranscribing: false,
      lastTranscription: "Previous text",
    });
    expect(result).not.toBeNull();
  });

  it("should render transcribing state even when transcription exists", () => {
    const result = VoiceIndicator({
      isRecording: false,
      isTranscribing: true,
      lastTranscription: "Previous text",
    });
    expect(result).not.toBeNull();
  });
});
