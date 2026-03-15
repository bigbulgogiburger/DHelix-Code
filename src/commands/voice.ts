/**
 * /voice 명령어 핸들러 — 음성 입력 모드 토글 (푸시투토크)
 *
 * 사용자가 /voice를 입력하면 음성으로 프롬프트를 입력할 수 있는
 * 모드를 활성화합니다.
 *
 * 동작 방식:
 *   1. SPACE 키를 누르면 녹음 시작
 *   2. SPACE 키를 떼면 녹음 중지
 *   3. OpenAI Whisper API로 음성을 텍스트로 변환(STT)
 *   4. 변환된 텍스트가 프롬프트로 입력됨
 *
 * 필수 요구사항:
 *   - SoX (음성 녹음 도구): brew install sox (macOS)
 *   - OPENAI_API_KEY 환경변수 (Whisper API 사용)
 *
 * 사용 예시:
 *   /voice      또는 /voice on  → 음성 모드 활성화
 *   /voice off                   → 음성 모드 비활성화
 *
 * 사용 시점: 키보드 대신 음성으로 LLM과 대화하고 싶을 때
 */
import { checkSoxInstalled } from "../voice/recorder.js";
import type { SlashCommand } from "./registry.js";

export const voiceCommand: SlashCommand = {
  name: "voice",
  description: "Toggle voice input mode (push-to-talk)",
  usage: "/voice [on|off]",
  execute: async (args, _context) => {
    const toggle = args.trim().toLowerCase();

    if (toggle === "off") {
      return { output: "Voice input disabled.", success: true, voiceEnabled: false };
    }

    const soxInstalled = await checkSoxInstalled();
    if (!soxInstalled) {
      return {
        output: [
          "Voice input requires SoX to be installed.",
          "",
          "Install:",
          "  macOS:   brew install sox",
          "  Ubuntu:  sudo apt install sox",
          "  Windows: choco install sox",
        ].join("\n"),
        success: false,
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        output: "Voice transcription requires OPENAI_API_KEY for Whisper API.",
        success: false,
      };
    }

    return {
      output: "Voice input enabled. Press SPACE to start/stop recording.",
      success: true,
      voiceEnabled: true,
    };
  },
};
