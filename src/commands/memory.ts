import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME } from "../constants.js";
import { type SlashCommand } from "./registry.js";

/** Memory directory within the project */
const MEMORY_DIR = `.${APP_NAME}/memory`;

/**
 * List memory files in the project memory directory.
 */
async function listMemoryFiles(cwd: string): Promise<readonly string[]> {
  const memoryDir = join(cwd, MEMORY_DIR);
  try {
    const entries = await readdir(memoryDir);
    return entries.filter((e) => e.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

/**
 * Read a specific memory file.
 */
async function readMemoryFile(cwd: string, name: string): Promise<string | null> {
  const fileName = name.endsWith(".md") ? name : `${name}.md`;
  const filePath = join(cwd, MEMORY_DIR, fileName);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write content to a memory file (creates the memory directory if needed).
 */
async function writeMemoryFile(cwd: string, name: string, content: string): Promise<void> {
  const fileName = name.endsWith(".md") ? name : `${name}.md`;
  const memoryDir = join(cwd, MEMORY_DIR);
  await mkdir(memoryDir, { recursive: true });
  await writeFile(join(memoryDir, fileName), content, "utf-8");
}

/**
 * /memory — View and edit project memory files.
 *
 * Usage:
 *   /memory           — List all memory files
 *   /memory <name>    — View a specific memory file
 *   /memory <name> <content> — Write content to a memory file
 */
export const memoryCommand: SlashCommand = {
  name: "memory",
  description: "View and edit project memory files (.dbcode/memory/)",
  usage: "/memory [name] [content]",

  async execute(args, context) {
    const trimmed = args.trim();

    // No args: list memory files
    if (!trimmed) {
      const files = await listMemoryFiles(context.workingDirectory);
      if (files.length === 0) {
        return {
          output: [
            "No memory files found.",
            "",
            `Memory directory: ${MEMORY_DIR}/`,
            "",
            "Usage:",
            "  /memory <name> <content>  — Create or update a memory file",
            "  /memory <name>            — View a memory file",
          ].join("\n"),
          success: true,
        };
      }

      const lines = [
        `Memory files (${MEMORY_DIR}/):`,
        "",
        ...files.map((f) => `  ${f}`),
        "",
        "Usage: /memory <name> to view a file",
      ];
      return { output: lines.join("\n"), success: true };
    }

    // Parse: first word is the name, rest is optional content
    const spaceIdx = trimmed.indexOf(" ");
    const name = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const content = spaceIdx === -1 ? null : trimmed.slice(spaceIdx + 1).trim();

    // If content provided: write
    if (content) {
      await writeMemoryFile(context.workingDirectory, name, content);
      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      return {
        output: `Memory file written: ${MEMORY_DIR}/${fileName}`,
        success: true,
      };
    }

    // Otherwise: read
    const fileContent = await readMemoryFile(context.workingDirectory, name);
    if (fileContent === null) {
      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      return {
        output: `Memory file not found: ${MEMORY_DIR}/${fileName}\n\nUse /memory ${name} <content> to create it.`,
        success: false,
      };
    }

    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    return {
      output: `--- ${MEMORY_DIR}/${fileName} ---\n\n${fileContent}`,
      success: true,
    };
  },
};
