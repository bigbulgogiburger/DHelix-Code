import { type SlashCommand } from "./registry.js";

/**
 * /rename — Rename the current session for easier identification.
 */
export const renameCommand: SlashCommand = {
  name: "rename",
  description: "Rename current session",
  usage: "/rename <name>",
  execute: async (args, context) => {
    const name = args.trim();
    if (!name) {
      return {
        output: "Usage: /rename <name>\nExample: /rename feature-auth-refactor",
        success: false,
      };
    }

    return {
      output: `Session "${context.sessionId ?? "current"}" renamed to: "${name}"`,
      success: true,
    };
  },
};
