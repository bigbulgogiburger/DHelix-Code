import { type SlashCommand } from "./registry.js";
import { VERSION, APP_NAME } from "../constants.js";

/**
 * /status — Display current session status overview.
 */
export const statusCommand: SlashCommand = {
  name: "status",
  description: "Show current session status",
  usage: "/status",
  execute: async (_args, context) => {
    const messageCount = context.messages?.length ?? 0;
    const userMessages = context.messages?.filter((m) => m.role === "user").length ?? 0;

    const lines = [
      `${APP_NAME} Session Status`,
      "=".repeat(20),
      "",
      `  Model:     ${context.model}`,
      `  Session:   ${context.sessionId ?? "none"}`,
      `  Directory: ${context.workingDirectory}`,
      `  Version:   v${VERSION}`,
      "",
      `  Messages:  ${messageCount} total (${userMessages} user turns)`,
    ];

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
