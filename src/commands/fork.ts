import { SessionManager } from "../core/session-manager.js";
import { type SlashCommand } from "./registry.js";

/**
 * /fork — Fork the current conversation into a new session.
 * Copies all messages from the current session into a new one.
 */
export const forkCommand: SlashCommand = {
  name: "fork",
  description: "Fork conversation into a new session",
  usage: "/fork [name]",
  execute: async (args, context) => {
    const sessionId = context.sessionId;
    if (!sessionId) {
      return {
        output: "No active session to fork.",
        success: false,
      };
    }

    const forkName = args.trim() || undefined;
    const sessionManager = new SessionManager();

    try {
      const newId = await sessionManager.forkSession(sessionId, {
        name: forkName,
      });

      return {
        output: [
          `Session forked successfully.`,
          `New session: ${newId}`,
          forkName ? `Name: "${forkName}"` : "",
          "",
          `Resume with: dbcode --resume ${newId}`,
        ]
          .filter(Boolean)
          .join("\n"),
        success: true,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        output: `Fork failed: ${msg}`,
        success: false,
      };
    }
  },
};
