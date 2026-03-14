import { useState, useCallback, useRef } from "react";
import { createRecorder, type RecorderHandle } from "../../voice/recorder.js";
import { transcribe } from "../../voice/transcriber.js";

export interface UseVoiceOptions {
  readonly language?: string;
  readonly soxPath?: string;
  readonly onTranscription?: (text: string) => void;
}

export interface UseVoiceReturn {
  readonly isRecording: boolean;
  readonly isTranscribing: boolean;
  readonly lastTranscription: string | undefined;
  readonly voiceEnabled: boolean;
  readonly setVoiceEnabled: (enabled: boolean) => void;
  readonly toggleRecording: () => void;
}

/**
 * Hook for voice input lifecycle management.
 * Handles recording via SoX and transcription via OpenAI Whisper.
 */
export function useVoice({
  language = "ko",
  soxPath,
  onTranscription,
}: UseVoiceOptions = {}): UseVoiceReturn {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastTranscription, setLastTranscription] = useState<string | undefined>(undefined);
  const recorderRef = useRef<RecorderHandle | null>(null);

  const toggleRecording = useCallback(() => {
    if (!voiceEnabled) return;

    if (isRecording && recorderRef.current) {
      // Stop recording → transcribe
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setIsRecording(false);
      setIsTranscribing(true);

      void recorder.stop().then(async (audioBuffer) => {
        try {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey || audioBuffer.length === 0) {
            setIsTranscribing(false);
            return;
          }

          const result = await transcribe(audioBuffer, {
            apiKey,
            language,
          });

          if (result.text.trim()) {
            setLastTranscription(result.text.trim());
            onTranscription?.(result.text.trim());
          }
        } catch {
          // Transcription failed — silently recover
        } finally {
          setIsTranscribing(false);
        }
      });
    } else if (!isRecording && !isTranscribing) {
      // Start recording
      const recorder = createRecorder({ soxPath });
      recorderRef.current = recorder;
      setIsRecording(true);
    }
  }, [voiceEnabled, isRecording, isTranscribing, language, soxPath, onTranscription]);

  return {
    isRecording,
    isTranscribing,
    lastTranscription,
    voiceEnabled,
    setVoiceEnabled,
    toggleRecording,
  };
}
