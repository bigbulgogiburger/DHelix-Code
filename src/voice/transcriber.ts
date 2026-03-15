/**
 * 음성 인식(STT) — OpenAI Whisper API를 사용한 오디오-텍스트 변환
 *
 * 녹음된 오디오 Buffer를 OpenAI Whisper API에 전송하여
 * 텍스트로 변환(transcription)합니다.
 *
 * Whisper 모델은 다국어를 지원하며, 한국어(ko)를 포함한
 * 다양한 언어의 음성을 인식할 수 있습니다.
 *
 * @example
 * const result = await transcribe(audioBuffer, {
 *   apiKey: "sk-...",
 *   language: "ko", // 한국어 인식
 * });
 * console.log(result.text); // "안녕하세요"
 * console.log(result.duration); // API 호출에 걸린 시간 (초)
 */

import OpenAI from "openai";

/** 음성 인식(Whisper) API 호출 옵션 */
export interface TranscribeOptions {
  /** OpenAI API 키 (필수) */
  readonly apiKey: string;
  /** OpenAI API 기본 URL (커스텀 엔드포인트 사용 시, 선택적) */
  readonly baseUrl?: string;
  /** Whisper 모델명 (기본값: "whisper-1") */
  readonly model?: string;
  /** 인식할 언어 (ISO 639-1 코드, 예: "ko" = 한국어, "en" = 영어) */
  readonly language?: string;
}

/** 음성 인식 결과 */
export interface TranscribeResult {
  /** 인식된 텍스트 */
  readonly text: string;
  /** API 호출 소요 시간 (초) */
  readonly duration: number;
  /** 감지된 또는 지정된 언어 코드 */
  readonly language: string;
}

/**
 * 오디오 Buffer를 OpenAI Whisper API로 전사(transcribe)합니다.
 *
 * 실행 과정:
 * 1. OpenAI 클라이언트를 생성합니다 (API 키, 기본 URL 설정)
 * 2. 오디오 Buffer를 File 객체로 변환합니다 (WAV 형식)
 * 3. Whisper API에 전송하여 텍스트를 받아옵니다
 * 4. 응답에서 텍스트, 언어, 소요 시간을 추출합니다
 *
 * @param audioBuffer - WAV 형식의 오디오 데이터 (recorder.stop()에서 반환)
 * @param options - Whisper API 옵션 (apiKey 필수, language/model 선택)
 * @returns 인식 결과 (텍스트, 소요 시간, 언어)
 *
 * @example
 * const result = await transcribe(audioBuffer, {
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   language: "ko",      // 한국어로 인식 정확도 향상
 *   model: "whisper-1",  // 기본 모델
 * });
 *
 * if (result.text.trim()) {
 *   console.log(`인식 결과: ${result.text} (${result.duration}초 소요)`);
 * }
 */
export async function transcribe(
  audioBuffer: Buffer,
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  // OpenAI 클라이언트 생성
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
  });

  // API 호출 시간 측정 시작
  const startTime = Date.now();

  // Buffer → File 객체로 변환 (Whisper API가 File 형식을 요구)
  const file = new File([audioBuffer], "recording.wav", { type: "audio/wav" });

  // Whisper API 호출
  // response_format: "verbose_json" → 언어 감지 결과 등 상세 정보 포함
  const response = await client.audio.transcriptions.create({
    file,
    model: options.model ?? "whisper-1",
    language: options.language, // 미지정 시 Whisper가 자동 감지
    response_format: "verbose_json",
  });

  return {
    text: response.text,
    duration: (Date.now() - startTime) / 1000, // 밀리초 → 초 변환
    language: response.language ?? options.language ?? "unknown",
  };
}
