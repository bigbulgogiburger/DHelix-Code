import { type SlashCommand } from "./registry.js";
import { VERSION, APP_NAME } from "../constants.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/**
 * Format uptime seconds into a human-readable string (e.g., "45m 23s").
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
 * /status — Display current session status overview.
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
