import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** Current plan mode state */
let planModeEnabled = false;

/** Get whether plan mode is currently enabled */
export function isPlanMode(): boolean {
  return planModeEnabled;
}

/**
 * /plan [on|off] — Toggle plan mode.
 * In plan mode, the assistant explains its implementation plan
 * without executing any file modifications.
 */
export const planCommand: SlashCommand = {
  name: "plan",
  description: "Toggle plan mode (explain without executing)",
  usage: "/plan [on|off]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const arg = args.trim().toLowerCase();

    if (arg === "off") {
      planModeEnabled = false;
      return {
        output: [
          "Plan mode disabled.",
          "Tools will execute normally.",
        ].join("\n"),
        success: true,
      };
    }

    // "on" or no argument: enable plan mode
    planModeEnabled = true;
    return {
      output: [
        "Plan mode enabled.",
        "",
        "The assistant will explain its implementation plan",
        "without modifying any files.",
        "",
        "Use /plan off to resume normal execution.",
      ].join("\n"),
      success: true,
    };
  },
};
