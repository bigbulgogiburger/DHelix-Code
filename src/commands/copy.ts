import { type SlashCommand } from "./registry.js";

/**
 * /copy — Copy the last code block or specified content to clipboard.
 */
export const copyCommand: SlashCommand = {
  name: "copy",
  description: "Copy last code block to clipboard",
  usage: "/copy [block number]",
  execute: async (args, _context) => {
    const blockNum = args.trim() ? parseInt(args.trim(), 10) : undefined;

    if (blockNum !== undefined && isNaN(blockNum)) {
      return {
        output: "Usage: /copy [block number]\nExample: /copy 1 (copies first code block)",
        success: false,
      };
    }

    return {
      output:
        blockNum !== undefined
          ? `Code block #${blockNum} would be copied to clipboard.`
          : "Last code block would be copied to clipboard.",
      success: true,
    };
  },
};
