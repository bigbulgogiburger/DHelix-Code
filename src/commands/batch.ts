import { type SlashCommand } from "./registry.js";

/**
 * /batch — Apply the same operation to multiple files.
 * Provides a structured prompt for batch file operations.
 */
export const batchCommand: SlashCommand = {
  name: "batch",
  description: "Apply same operation to multiple files",
  usage: "/batch <glob pattern> <operation description>",
  execute: async (args, _context) => {
    const trimmed = args.trim();
    if (!trimmed) {
      return {
        output:
          "Usage: /batch <glob pattern> <operation description>\nExample: /batch src/**/*.ts add error handling to all exported functions",
        success: false,
      };
    }

    // Split into pattern and operation
    const parts = trimmed.split(/\s+/);
    const pattern = parts[0];
    const operation = parts.slice(1).join(" ");

    if (!operation) {
      return {
        output:
          "Please provide both a glob pattern and an operation description.\nExample: /batch src/**/*.ts add JSDoc comments",
        success: false,
      };
    }

    const prompt = [
      `Apply the following operation to all files matching \`${pattern}\`:`,
      "",
      `**Operation**: ${operation}`,
      "",
      "Steps:",
      `1. Use glob_search to find all files matching \`${pattern}\``,
      "2. For each file, read it and apply the operation",
      "3. Use file_edit to make the changes",
      "4. Report a summary of all changes made",
      "",
      "Process files one at a time and report progress.",
    ].join("\n");

    return {
      output: prompt,
      success: true,
    };
  },
};
