import OpenAI from "openai";

export interface TranscribeOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string; // default: "whisper-1"
  readonly language?: string; // ISO 639-1 (e.g., "ko")
}

export interface TranscribeResult {
  readonly text: string;
  readonly duration: number; // seconds
  readonly language: string;
}

/**
 * Transcribe an audio buffer to text using the OpenAI Whisper API.
 */
export async function transcribe(
  audioBuffer: Buffer,
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
  });

  const startTime = Date.now();
  const file = new File([audioBuffer], "recording.wav", { type: "audio/wav" });

  const response = await client.audio.transcriptions.create({
    file,
    model: options.model ?? "whisper-1",
    language: options.language,
    response_format: "verbose_json",
  });

  return {
    text: response.text,
    duration: (Date.now() - startTime) / 1000,
    language: response.language ?? options.language ?? "unknown",
  };
}
