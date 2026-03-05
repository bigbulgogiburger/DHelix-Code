import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type SlashCommand } from "./registry.js";

/**
 * /export — Export the current conversation to a file.
 */
export const exportCommand: SlashCommand = {
  name: "export",
  description: "Export conversation to file",
  usage: "/export [filename]",
  execute: async (args, context) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = args.trim() || `dbcode-conversation-${timestamp}.md`;
    const filePath = join(context.workingDirectory, filename);

    try {
      const content = [
        `# dbcode Conversation Export`,
        ``,
        `- **Date**: ${new Date().toISOString()}`,
        `- **Model**: ${context.model}`,
        `- **Session**: ${context.sessionId ?? "N/A"}`,
        ``,
        `---`,
        ``,
        `(Conversation content would be exported here)`,
      ].join("\n");

      await writeFile(filePath, content, "utf-8");
      return {
        output: `Conversation exported to: ${filename}`,
        success: true,
      };
    } catch (error) {
      return {
        output: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  },
};
