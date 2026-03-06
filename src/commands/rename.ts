import { SessionManager } from "../core/session-manager.js";
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

    if (!context.sessionId) {
      return {
        output: "No active session to rename.",
        success: false,
      };
    }

    try {
      const sessionManager = new SessionManager();
      await sessionManager.renameSession(context.sessionId, name);

      return {
        output: `Session renamed to: "${name}"`,
        success: true,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        output: `Rename failed: ${msg}`,
        success: false,
      };
    }
  },
};
