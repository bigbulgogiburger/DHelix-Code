import { type SlashCommand } from "./registry.js";

/**
 * /simplify — Review changed code for reuse, quality, and efficiency.
 * Gathers git diff and asks the LLM to analyze changes.
 */
export const simplifyCommand: SlashCommand = {
  name: "simplify",
  description: "Review changed code for reuse, quality, and efficiency",
  usage: "/simplify [file path]",
  execute: async (args, _context) => {
    const target = args.trim() || "all changed files";

    const prompt = [
      "Review the following code changes for opportunities to improve:",
      "",
      "1. **Reuse**: Are there existing utilities or patterns that could replace new code?",
      "2. **Quality**: Are there naming, structure, or readability improvements?",
      "3. **Efficiency**: Are there performance optimizations or unnecessary complexity?",
      "",
      `Target: ${target}`,
      "",
      "Please analyze the changed files and suggest specific improvements.",
      "Use the available tools to read the relevant files and provide actionable suggestions.",
    ].join("\n");

    return {
      output: prompt,
      success: true,
    };
  },
};
