import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** Registry reference for generating help text dynamically */
let allCommands: readonly SlashCommand[] = [];

/**
 * Set the command list for help display.
 * Called by the main app during initialization.
 */
export function setHelpCommands(commands: readonly SlashCommand[]): void {
  allCommands = commands;
}

/**
 * /help — Show available slash commands.
 */
export const helpCommand: SlashCommand = {
  name: "help",
  description: "Show available commands",
  usage: "/help",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    const lines: string[] = ["Available commands:", ""];

    const commandsToShow = allCommands.length > 0 ? allCommands : [helpCommand];

    for (const cmd of commandsToShow) {
      lines.push(`  ${cmd.usage.padEnd(30)} ${cmd.description}`);
    }

    lines.push("");
    lines.push("Type a command to execute it.");

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
