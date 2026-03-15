/**
 * 음성 모듈 진입점 — 마이크 녹음 및 음성-텍스트 변환(STT) 기능 재내보내기
 *
 * 이 모듈은 SoX를 이용한 마이크 녹음(recorder)과
 * OpenAI Whisper API를 이용한 음성 인식(transcriber)을 제공합니다.
 *
 * 사전 요구사항:
 * - SoX(Sound eXchange) 설치: 마이크 녹음에 필요
 *   - macOS: brew install sox
 *   - Ubuntu: sudo apt install sox
 *   - Windows: https://sox.sourceforge.net/
 * - OpenAI API 키: Whisper 음성 인식에 필요
 *
 * @example
 * import { createRecorder, checkSoxInstalled, transcribe } from "./voice/index.js";
 *
 * if (await checkSoxInstalled()) {
 *   const recorder = createRecorder({ sampleRate: 16000 });
 *   // ... 녹음 중 ...
 *   const audioBuffer = await recorder.stop();
 *   const result = await transcribe(audioBuffer, { apiKey: "sk-..." });
 *   console.log(result.text); // "안녕하세요"
 * }
 */

export { createRecorder, checkSoxInstalled } from "./recorder.js";
export type { RecorderOptions, RecorderHandle } from "./recorder.js";
export { transcribe } from "./transcriber.js";
export type { TranscribeOptions, TranscribeResult } from "./transcriber.js";
