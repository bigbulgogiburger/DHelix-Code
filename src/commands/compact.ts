import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/**
 * /compact [focus] — Manually trigger context compaction.
 * Optionally focus the summary on a specific topic.
 */
export const compactCommand: SlashCommand = {
  name: "compact",
  description: "Compact conversation context (optional: focus topic)",
  usage: "/compact [focus topic]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const focusTopic = args.trim() || undefined;

    // The actual compaction is handled by the context manager in the agent loop.
    // This command signals the loop to trigger manual compaction.
    return {
      output: focusTopic
        ? `Compaction triggered with focus: "${focusTopic}"`
        : "Compaction triggered.",
      success: true,
    };
  },
};
