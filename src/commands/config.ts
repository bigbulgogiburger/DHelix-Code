import { type SlashCommand } from "./registry.js";

/**
 * /config — Interactive settings display and modification.
 */
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
