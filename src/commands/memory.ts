import { readdir, readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  MEMORY_MAIN_FILE,
  MEMORY_MAX_MAIN_LINES,
  getProjectMemoryDir,
  getGlobalMemoryDir,
} from "../constants.js";
import { type SlashCommand } from "./registry.js";

/** Metadata about a single memory file */
interface MemoryFileInfo {
  readonly name: string;
  readonly sizeBytes: number;
  readonly lineCount: number;
}

/**
 * Ensure a file name ends with .md extension.
 */
function ensureMdExtension(name: string): string {
  return name.endsWith(".md") ? name : `${name}.md`;
}

/**
 * List memory files with size and line count metadata.
 */
async function listMemoryFilesDetailed(memoryDir: string): Promise<readonly MemoryFileInfo[]> {
  try {
    const entries = await readdir(memoryDir);
    const mdFiles = entries.filter((e) => e.endsWith(".md")).sort();

    const infos = await Promise.all(
      mdFiles.map(async (name) => {
        const filePath = join(memoryDir, name);
        try {
          const [fileStat, content] = await Promise.all([
            stat(filePath),
            readFile(filePath, "utf-8"),
          ]);
          return {
            name,
            sizeBytes: fileStat.size,
            lineCount: content.split("\n").length,
          };
        } catch {
          return { name, sizeBytes: 0, lineCount: 0 };
        }
      }),
    );

    return infos;
  } catch {
    return [];
  }
}

/**
 * List memory file names only (backward-compatible helper).
 */
async function listMemoryFiles(memoryDir: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(memoryDir);
    return entries.filter((e) => e.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

/**
 * Read a specific memory file by name.
 */
async function readMemoryFile(memoryDir: string, name: string): Promise<string | null> {
  const fileName = ensureMdExtension(name);
  const filePath = join(memoryDir, fileName);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write content to a memory file (creates the memory directory if needed).
 */
async function writeMemoryFile(memoryDir: string, name: string, content: string): Promise<void> {
  const fileName = ensureMdExtension(name);
  await mkdir(memoryDir, { recursive: true });
  await writeFile(join(memoryDir, fileName), content, "utf-8");
}

/**
 * Delete a memory file by name.
 */
async function deleteMemoryFile(memoryDir: string, name: string): Promise<boolean> {
  const fileName = ensureMdExtension(name);
  const filePath = join(memoryDir, fileName);
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Search across all memory files for a query string (case-insensitive).
 */
async function searchMemoryFiles(
  memoryDir: string,
  query: string,
): Promise<readonly { readonly file: string; readonly matches: readonly string[] }[]> {
  const files = await listMemoryFiles(memoryDir);
  const lowerQuery = query.toLowerCase();
  const results: { readonly file: string; readonly matches: readonly string[] }[] = [];

  for (const file of files) {
    const content = await readMemoryFile(memoryDir, file);
    if (content === null) continue;

    const matchingLines = content
      .split("\n")
      .filter((line) => line.toLowerCase().includes(lowerQuery));

    if (matchingLines.length > 0) {
      results.push({ file, matches: matchingLines });
    }
  }

  return results;
}

/**
 * Format bytes into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Handle the /memory (no args) subcommand — list all memory files with details.
 */
async function handleList(
  memoryDir: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  const files = await listMemoryFilesDetailed(memoryDir);

  if (files.length === 0) {
    return {
      output: [
        "No memory files found.",
        "",
        `Memory directory: ${memoryDir}`,
        "",
        "Usage:",
        "  /memory                      — List all memory files",
        "  /memory view <name>          — View a specific memory file",
        "  /memory edit <name> <content> — Create or update a memory file",
        "  /memory delete <name>        — Delete a memory file",
        "  /memory status               — Show auto-memory status",
        "  /memory topics               — List topic files",
        "  /memory search <query>       — Search across all memory files",
      ].join("\n"),
      success: true,
    };
  }

  const lines = [
    `Memory files (${memoryDir}):`,
    "",
    ...files.map(
      (f) =>
        `  ${f.name.padEnd(30)} ${String(f.lineCount).padStart(4)} lines  ${formatBytes(f.sizeBytes).padStart(8)}`,
    ),
    "",
    `Total: ${files.length} file(s)`,
    "",
    "Usage: /memory view <name> to view a file",
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * Handle /memory view <name>
 */
async function handleView(
  memoryDir: string,
  name: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!name) {
    return {
      output: "Usage: /memory view <name>\n\nSpecify the name of the memory file to view.",
      success: false,
    };
  }

  const content = await readMemoryFile(memoryDir, name);
  if (content === null) {
    const fileName = ensureMdExtension(name);
    return {
      output: `Memory file not found: ${fileName}\n\nUse /memory edit ${name} <content> to create it.`,
      success: false,
    };
  }

  const fileName = ensureMdExtension(name);
  return {
    output: `--- ${fileName} ---\n\n${content}`,
    success: true,
  };
}

/**
 * Handle /memory edit <name> <content>
 */
async function handleEdit(
  memoryDir: string,
  nameAndContent: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!nameAndContent) {
    return {
      output: "Usage: /memory edit <name> <content>\n\nSpecify the file name and content to write.",
      success: false,
    };
  }

  const spaceIdx = nameAndContent.indexOf(" ");
  if (spaceIdx === -1) {
    return {
      output:
        "Usage: /memory edit <name> <content>\n\nMissing content. Provide both a name and content.",
      success: false,
    };
  }

  const name = nameAndContent.slice(0, spaceIdx);
  const content = nameAndContent.slice(spaceIdx + 1).trim();

  if (!content) {
    return {
      output: "Usage: /memory edit <name> <content>\n\nContent cannot be empty.",
      success: false,
    };
  }

  await writeMemoryFile(memoryDir, name, content);
  const fileName = ensureMdExtension(name);
  return {
    output: `Memory file written: ${fileName}`,
    success: true,
  };
}

/**
 * Handle /memory delete <name>
 */
async function handleDelete(
  memoryDir: string,
  name: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!name) {
    return {
      output: "Usage: /memory delete <name>\n\nSpecify the name of the memory file to delete.",
      success: false,
    };
  }

  const fileName = ensureMdExtension(name);
  const deleted = await deleteMemoryFile(memoryDir, name);

  if (!deleted) {
    return {
      output: `Memory file not found: ${fileName}`,
      success: false,
    };
  }

  return {
    output: `Memory file deleted: ${fileName}`,
    success: true,
  };
}

/**
 * Handle /memory status
 */
async function handleStatus(
  projectMemoryDir: string,
  globalMemoryDir: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  const [projectFiles, globalFiles] = await Promise.all([
    listMemoryFilesDetailed(projectMemoryDir),
    listMemoryFilesDetailed(globalMemoryDir),
  ]);

  const mainFileExists = projectFiles.some((f) => f.name === MEMORY_MAIN_FILE);
  const globalMainExists = globalFiles.some((f) => f.name === MEMORY_MAIN_FILE);

  const projectTotalLines = projectFiles.reduce((sum, f) => sum + f.lineCount, 0);
  const globalTotalLines = globalFiles.reduce((sum, f) => sum + f.lineCount, 0);

  const mainFileInfo = projectFiles.find((f) => f.name === MEMORY_MAIN_FILE);
  const mainLineStatus = mainFileInfo
    ? `${mainFileInfo.lineCount}/${MEMORY_MAX_MAIN_LINES} lines`
    : "not created";

  const lines = [
    "Auto-Memory Status",
    "==================",
    "",
    "Project Memory:",
    `  Directory:   ${projectMemoryDir}`,
    `  Main file:   ${mainFileExists ? "exists" : "not found"} (${mainLineStatus})`,
    `  Files:       ${projectFiles.length}`,
    `  Total lines: ${projectTotalLines}`,
    "",
    "Global Memory:",
    `  Directory:   ${globalMemoryDir}`,
    `  Main file:   ${globalMainExists ? "exists" : "not found"}`,
    `  Files:       ${globalFiles.length}`,
    `  Total lines: ${globalTotalLines}`,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * Handle /memory topics — list topic files (all files except MEMORY.md).
 */
async function handleTopics(
  memoryDir: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  const files = await listMemoryFilesDetailed(memoryDir);
  const topicFiles = files.filter((f) => f.name !== MEMORY_MAIN_FILE);

  if (topicFiles.length === 0) {
    return {
      output: [
        "No topic memory files found.",
        "",
        `Only the main file (${MEMORY_MAIN_FILE}) exists, or no memory files at all.`,
        "",
        "Use /memory edit <topic-name> <content> to create a topic file.",
      ].join("\n"),
      success: true,
    };
  }

  const lines = [
    `Topic memory files (${memoryDir}):`,
    "",
    ...topicFiles.map(
      (f) =>
        `  ${f.name.padEnd(30)} ${String(f.lineCount).padStart(4)} lines  ${formatBytes(f.sizeBytes).padStart(8)}`,
    ),
    "",
    `Total: ${topicFiles.length} topic file(s)`,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * Handle /memory search <query>
 */
async function handleSearch(
  memoryDir: string,
  query: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!query) {
    return {
      output:
        "Usage: /memory search <query>\n\nSpecify a search term to find across all memory files.",
      success: false,
    };
  }

  const results = await searchMemoryFiles(memoryDir, query);

  if (results.length === 0) {
    return {
      output: `No matches found for "${query}" in memory files.`,
      success: true,
    };
  }

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  const lines = [
    `Search results for "${query}" (${totalMatches} match(es) in ${results.length} file(s)):`,
    "",
  ];

  for (const result of results) {
    lines.push(`--- ${result.file} (${result.matches.length} match(es)) ---`);
    for (const match of result.matches) {
      lines.push(`  ${match.trim()}`);
    }
    lines.push("");
  }

  return { output: lines.join("\n"), success: true };
}

/**
 * /memory — View, edit, and manage project memory files.
 *
 * Subcommands:
 *   /memory                        — List all memory files with sizes and line counts
 *   /memory view <name>            — View a specific memory file
 *   /memory edit <name> <content>  — Write/update a memory file
 *   /memory delete <name>          — Delete a memory file
 *   /memory status                 — Show auto-memory status
 *   /memory topics                 — List topic files (excluding MEMORY.md)
 *   /memory search <query>         — Search across all memory files
 *
 * Backward-compatible:
 *   /memory <name>                 — View a specific memory file
 *   /memory <name> <content>       — Write content to a memory file
 */
export const memoryCommand: SlashCommand = {
  name: "memory",
  description: "View, edit, and manage project memory files (.dbcode/memory/)",
  usage: "/memory [view|edit|delete|status|topics|search] [name] [content]",

  async execute(args, context) {
    const trimmed = args.trim();
    const projectMemoryDir = getProjectMemoryDir(context.workingDirectory);
    const globalMemoryDir = getGlobalMemoryDir();

    // No args: list memory files with details
    if (!trimmed) {
      return handleList(projectMemoryDir);
    }

    // Parse subcommand
    const spaceIdx = trimmed.indexOf(" ");
    const firstWord = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const rest = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

    // Route subcommands
    switch (firstWord) {
      case "view":
        return handleView(projectMemoryDir, rest);

      case "edit":
        return handleEdit(projectMemoryDir, rest);

      case "delete":
        return handleDelete(projectMemoryDir, rest);

      case "status":
        return handleStatus(projectMemoryDir, globalMemoryDir);

      case "topics":
        return handleTopics(projectMemoryDir);

      case "search":
        return handleSearch(projectMemoryDir, rest);

      default: {
        // Backward compatibility: /memory <name> or /memory <name> <content>
        const name = firstWord;
        const content = rest;

        if (content) {
          // /memory <name> <content> — write
          await writeMemoryFile(projectMemoryDir, name, content);
          const fileName = ensureMdExtension(name);
          return {
            output: `Memory file written: ${fileName}`,
            success: true,
          };
        }

        // /memory <name> — read
        const fileContent = await readMemoryFile(projectMemoryDir, name);
        if (fileContent === null) {
          const fileName = ensureMdExtension(name);
          return {
            output: `Memory file not found: ${fileName}\n\nUse /memory edit ${name} <content> to create it.`,
            success: false,
          };
        }

        const fileName = ensureMdExtension(name);
        return {
          output: `--- ${fileName} ---\n\n${fileContent}`,
          success: true,
        };
      }
    }
  },
};
