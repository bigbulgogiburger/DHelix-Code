import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** Fast mode state (module state) */
let fastModeEnabled = false;

/** Get the current fast mode state */
export function isFastMode(): boolean {
  return fastModeEnabled;
}

/**
 * /fast — Toggle fast output mode.
 * Fast mode may use a faster/smaller model variant or reduce response quality
 * for quicker responses.
 */
export const fastCommand: SlashCommand = {
  name: "fast",
  description: "Toggle fast output mode",
  usage: "/fast",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    fastModeEnabled = !fastModeEnabled;

    return {
      output: `Fast mode: ${fastModeEnabled ? "ON" : "OFF"}`,
      success: true,
    };
  },
};
