import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/**
 * /clear — Clear the current conversation.
 * Resets the conversation state while preserving the session.
 */
export const clearCommand: SlashCommand = {
  name: "clear",
  description: "Clear the conversation history",
  usage: "/clear",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    return {
      output: "Conversation cleared.",
      success: true,
      shouldClear: true,
    };
  },
};
