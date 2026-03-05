import { type SlashCommand } from "./registry.js";

/**
 * /context — Show context window usage with color grid visualization.
 */
export const contextCommand: SlashCommand = {
  name: "context",
  description: "Show context window usage",
  usage: "/context",
  execute: async (_args, _context) => {
    // In a real implementation, this would read from ContextManager.
    // For now, provide a template that the LLM can use to display info.
    const prompt = [
      "Show the current context window usage.",
      "",
      "Steps:",
      "1. Calculate total tokens used in the conversation",
      "2. Show percentage of context window consumed",
      "3. Break down by: system prompt, user messages, assistant messages, tool results",
      "4. Display a visual usage bar",
      "",
      "Present the information clearly with usage percentages.",
    ].join("\n");

    return {
      output: prompt,
      success: true,
    };
  },
};
