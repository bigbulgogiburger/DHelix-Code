import { exec } from "node:child_process";
import { getPlatform } from "../utils/platform.js";
import { type SlashCommand } from "./registry.js";

/**
 * Extract fenced code blocks from markdown text.
 * Returns array of { lang, code } objects.
 */
function extractCodeBlocks(text: string): readonly { lang: string; code: string }[] {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: { lang: string; code: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push({ lang: match[1] || "", code: match[2].trimEnd() });
  }

  return blocks;
}

/**
 * Copy text to system clipboard using platform-appropriate command.
 */
function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = getPlatform();
    let cmd: string;

    if (platform === "win32") {
      cmd = "clip";
    } else if (platform === "darwin") {
      cmd = "pbcopy";
    } else {
      cmd = "xclip -selection clipboard";
    }

    const proc = exec(cmd, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    proc.stdin?.write(text);
    proc.stdin?.end();
  });
}

/**
 * /copy — Copy code block from conversation to clipboard.
 */
export const copyCommand: SlashCommand = {
  name: "copy",
  description: "Copy last code block to clipboard",
  usage: "/copy [block number]",
  execute: async (args, context) => {
    const blockNum = args.trim() ? parseInt(args.trim(), 10) : undefined;

    if (blockNum !== undefined && isNaN(blockNum)) {
      return {
        output: "Usage: /copy [block number]\nExample: /copy 1 (copies first code block)",
        success: false,
      };
    }

    // Collect all code blocks from assistant messages
    const messages = context.messages ?? [];
    const allBlocks = messages
      .filter((m) => m.role === "assistant")
      .flatMap((m) => extractCodeBlocks(m.content));

    if (allBlocks.length === 0) {
      return {
        output: "No code blocks found in conversation.",
        success: false,
      };
    }

    const targetIdx = blockNum !== undefined ? blockNum - 1 : allBlocks.length - 1;

    if (targetIdx < 0 || targetIdx >= allBlocks.length) {
      return {
        output: `Block #${blockNum} not found. ${allBlocks.length} code block(s) available.`,
        success: false,
      };
    }

    const block = allBlocks[targetIdx];

    try {
      await copyToClipboard(block.code);
      const langLabel = block.lang ? ` (${block.lang})` : "";
      return {
        output: `Copied code block #${targetIdx + 1}${langLabel} to clipboard (${block.code.length} chars).`,
        success: true,
      };
    } catch {
      return {
        output: `Failed to copy to clipboard. Clipboard command not available.`,
        success: false,
      };
    }
  },
};
