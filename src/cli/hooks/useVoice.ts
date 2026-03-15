/**
 * useVoice.ts — 음성 입력 생명주기를 관리하는 React 훅
 *
 * 마이크 녹음과 텍스트 변환(STT)의 전체 사이클을 관리합니다.
 * SoX(명령줄 오디오 도구)로 녹음하고, OpenAI Whisper API로
 * 음성을 텍스트로 변환합니다.
 *
 * 동작 흐름:
 * 1. /voice 명령으로 voiceEnabled 활성화
 * 2. Alt+V(또는 설정된 키)로 toggleRecording() 호출
 * 3. 첫 호출: 녹음 시작 (SoX 프로세스 시작)
 * 4. 두 번째 호출: 녹음 중지 → Whisper API로 변환 → onTranscription 콜백 호출
 *
 * 전제 조건:
 * - SoX가 시스템에 설치되어 있어야 함
 * - OPENAI_API_KEY 환경변수가 설정되어 있어야 함
 */
import { useState, useCallback, useRef } from "react";
import { createRecorder, type RecorderHandle } from "../../voice/recorder.js";
import { transcribe } from "../../voice/transcriber.js";

/**
 * @param language - 음성 인식 언어 (기본값: "ko" 한국어)
 * @param soxPath - SoX 실행 파일 경로 (선택적, 기본값: 시스템 경로)
 * @param onTranscription - 텍스트 변환 완료 시 호출되는 콜백 (변환된 텍스트 전달)
 */
export interface UseVoiceOptions {
  readonly language?: string;
  readonly soxPath?: string;
  readonly onTranscription?: (text: string) => void;
}

/**
 * useVoice 훅의 반환값
 * @param isRecording - 현재 녹음 중 여부
 * @param isTranscribing - Whisper API 변환 중 여부
 * @param lastTranscription - 마지막으로 변환된 텍스트
 * @param voiceEnabled - 음성 입력 기능 활성화 여부
 * @param setVoiceEnabled - 음성 기능 활성화/비활성화 함수
 * @param toggleRecording - 녹음 시작/중지 토글 함수
 */
export interface UseVoiceReturn {
  readonly isRecording: boolean;
  readonly isTranscribing: boolean;
  readonly lastTranscription: string | undefined;
  readonly voiceEnabled: boolean;
  readonly setVoiceEnabled: (enabled: boolean) => void;
  readonly toggleRecording: () => void;
}

/**
 * 음성 입력 생명주기 관리 훅
 *
 * 녹음(SoX) → 중지 → 변환(Whisper) → 콜백 호출의 전체 사이클을 관리합니다.
 * voiceEnabled가 false이면 toggleRecording()이 아무 동작도 하지 않습니다.
 * 변환 실패 시 조용히 복구합니다 (에러를 throw하지 않음).
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
