/**
 * /config 명령어 핸들러 — 설정 조회 및 변경
 *
 * 사용자가 /config를 입력하면 현재 설정(모델, 디렉토리, 세션)을 보여주고,
 * /config <key> <value> 형태로 설정값을 변경할 수 있습니다.
 *
 * 사용 예시:
 *   /config              → 현재 설정 조회
 *   /config model gpt-4o → 모델을 gpt-4o로 변경
 *
 * 사용 시점: 현재 세션의 설정을 확인하거나 모델을 변경하고 싶을 때
 */
import { type SlashCommand } from "./registry.js";

export const configCommand: SlashCommand = {
  name: "config",
  description: "View and modify settings",
  usage: "/config [key] [value]",
  execute: async (args, context) => {
    const parts = args.trim().split(/\s+/);

    if (!parts[0]) {
      return {
        output: [
          "Current Configuration:",
          "",
          `  Model:     ${context.model}`,
          `  Directory: ${context.workingDirectory}`,
          `  Session:   ${context.sessionId ?? "(none)"}`,
          "",
          "Usage: /config <key> [value]",
          "Keys: model, verbose, theme",
        ].join("\n"),
        success: true,
      };
    }

    const key = parts[0];
    const value = parts.slice(1).join(" ");

    if (key === "model" && value) {
      return {
        output: `Model changed to: ${value}`,
        success: true,
        newModel: value,
      };
    }

    return {
      output: `Unknown config key: ${key}`,
      success: false,
    };
  },
};
