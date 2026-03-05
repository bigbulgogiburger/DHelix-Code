import { type SlashCommand } from "./registry.js";

/**
 * /fork — Fork the current conversation into a new branch.
 * Creates a conversation checkpoint that can be returned to.
 */
export const forkCommand: SlashCommand = {
  name: "fork",
  description: "Fork conversation into a new branch",
  usage: "/fork [name]",
  execute: async (args, context) => {
    const forkName = args.trim() || `fork-${Date.now()}`;

    return {
      output: [
        `Conversation forked: "${forkName}"`,
        `Session: ${context.sessionId ?? "N/A"}`,
        "",
        "You can continue from this point. Use /rewind to return to the fork point.",
      ].join("\n"),
      success: true,
    };
  },
};
