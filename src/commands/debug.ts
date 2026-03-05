import { type SlashCommand } from "./registry.js";

/**
 * /debug — Systematic debugging workflow.
 * Guides the LLM through structured debugging steps.
 */
export const debugCommand: SlashCommand = {
  name: "debug",
  description: "Systematic debugging workflow",
  usage: "/debug <error description or log path>",
  execute: async (args, _context) => {
    const trimmed = args.trim();
    if (!trimmed) {
      return {
        output:
          "Usage: /debug <error description or log path>\nExample: /debug TypeError: Cannot read property 'map' of undefined",
        success: false,
      };
    }

    const prompt = [
      "Perform a systematic debugging analysis:",
      "",
      `**Problem**: ${trimmed}`,
      "",
      "Follow this debugging workflow:",
      "",
      "1. **Reproduce**: Identify the exact conditions that trigger the issue",
      "2. **Locate**: Use grep_search and file_read to find the relevant code",
      "3. **Analyze**: Trace the data flow and identify the root cause",
      "4. **Fix**: Propose a minimal, targeted fix",
      "5. **Verify**: Explain how to verify the fix works",
      "",
      "Use the available tools to investigate. Start by searching for the error pattern in the codebase.",
    ].join("\n");

    return {
      output: prompt,
      success: true,
    };
  },
};
