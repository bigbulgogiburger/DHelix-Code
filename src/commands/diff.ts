import { type SlashCommand } from "./registry.js";

/**
 * /diff — Show git diff of current changes.
 * Provides a summary of staged and unstaged changes.
 */
export const diffCommand: SlashCommand = {
  name: "diff",
  description: "Show git diff of current changes",
  usage: "/diff [file path]",
  execute: async (args, _context) => {
    const target = args.trim();

    const prompt = [
      "Show the current git diff for review.",
      "",
      target ? `Focus on: ${target}` : "Show all changes.",
      "",
      "Steps:",
      "1. Run `git diff` to see unstaged changes",
      "2. Run `git diff --cached` to see staged changes",
      "3. Present a clear summary of all modifications",
      "4. Highlight any potential issues (large files, binary changes, etc.)",
    ].join("\n");

    return {
      output: prompt,
      success: true,
    };
  },
};
