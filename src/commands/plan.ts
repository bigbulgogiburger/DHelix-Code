import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** /plan [on|off] — Toggle plan mode (read-only). */
export const planCommand: SlashCommand = {
  name: "plan",
  description: "Toggle plan mode (read-only, no file modifications)",
  usage: "/plan [on|off]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const arg = args.trim().toLowerCase();

    if (arg === "off") {
      return {
        output: "Plan mode disabled. Tools will execute normally.",
        success: true,
        newPermissionMode: "default",
        refreshInstructions: true,
      };
    }

    return {
      output: [
        "Plan mode enabled (read-only).",
        "",
        "Available: file_read, glob_search, grep_search, list_dir",
        "Blocked: file_write, file_edit, bash_exec, and all write operations",
        "",
        "Use /plan off to resume normal execution.",
      ].join("\n"),
      success: true,
      newPermissionMode: "plan",
      refreshInstructions: true,
    };
  },
};
