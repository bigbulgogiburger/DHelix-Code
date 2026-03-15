/**
 * /status 명령어 핸들러 — 현재 세션 상태 개요 표시
 *
 * 사용자가 /status를 입력하면 현재 세션의 전반적인 상태를 보여줍니다.
 *
 * 표시 정보:
 *   - dbcode 버전
 *   - 활성 모델과 능력 티어(tier)
 *   - 세션 ID, 작업 디렉토리
 *   - 메시지 수, 가동 시간(uptime)
 *   - 모델 능력 (컨텍스트 크기, 최대 출력, 씽킹/캐싱 지원 여부)
 *
 * 사용 시점: 현재 세션 설정과 모델 능력을 빠르게 확인하고 싶을 때
 */
import { type SlashCommand } from "./registry.js";
import { VERSION, APP_NAME } from "../constants.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/**
 * 가동 시간(초)을 사람이 읽기 쉬운 형식으로 변환하는 함수
 *
 * @param seconds - 초 단위 가동 시간
 * @returns 포맷된 문자열 (예: "1h 23m 45s", "45m 23s")
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * /status 슬래시 명령어 정의 — 현재 세션 상태 개요 표시
 *
 * 버전, 모델, 세션, 디렉토리, 메시지 수, 가동 시간,
 * 모델 능력 정보를 종합적으로 보여줍니다.
 */
export const statusCommand: SlashCommand = {
  name: "status",
  description: "Show current session status",
  usage: "/status",
  execute: async (_args, context) => {
    const caps = getModelCapabilities(context.model);
    const messageCount = context.messages?.length ?? 0;
    const userMessages = context.messages?.filter((m) => m.role === "user").length ?? 0;

    const uptime = formatUptime(process.uptime());

    const lines = [
      `${APP_NAME} Session Status`,
      "=".repeat(`${APP_NAME} Session Status`.length),
      "",
      `  Version:   v${VERSION}`,
      `  Model:     ${context.model} (${caps.capabilityTier} tier)`,
      `  Session:   ${context.sessionId ?? "none"}`,
      `  Directory: ${context.workingDirectory}`,
      "",
      `  Messages:  ${messageCount} total (${userMessages} user turns)`,
      `  Uptime:    ${uptime}`,
      "",
      "  Capabilities:",
      `    Context window: ${(caps.maxContextTokens / 1000).toFixed(0)}K tokens`,
      `    Max output: ${(caps.maxOutputTokens / 1000).toFixed(0)}K tokens`,
      `    Thinking: ${caps.supportsThinking ? "supported" : "not supported"}`,
      `    Caching: ${caps.supportsCaching ? "supported" : "not supported"}`,
    ];

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
