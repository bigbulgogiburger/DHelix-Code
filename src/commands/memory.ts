import { MemoryManager } from "../memory/manager.js";
import type { SlashCommand } from "./registry.js";

/**
 * /memory — Auto-memory system for persistent project knowledge.
 *
 * Usage:
 *   /memory                — Show current memory content
 *   /memory save <text>    — Manually save a memory entry
 *   /memory topics         — List topic files
 *   /memory read <topic>   — Read a topic file
 *   /memory clear          — Clear all memory (with confirmation prompt)
 */
export const memoryCommand: SlashCommand = {
  name: "memory",
  description: "View and manage project memory (~/.dbcode/projects/)",
  usage: "/memory [save <text> | topics | read <topic> | clear]",

  async execute(args, context) {
    const manager = new MemoryManager(context.workingDirectory);
    const trimmed = args.trim();

    // /memory — show current memory content
    if (!trimmed) {
      return showMemory(manager);
    }

    // Parse subcommand
    const spaceIdx = trimmed.indexOf(" ");
    const subcommand = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const subArgs = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

    switch (subcommand) {
      case "save":
        return saveEntry(manager, subArgs);
      case "topics":
        return listTopics(manager);
      case "read":
        return readTopic(manager, subArgs);
      case "clear":
        return clearAllMemory(manager);
      default:
        // Treat unknown subcommand as a "save" with the full text as topic "general"
        return saveEntry(manager, trimmed);
    }
  },
};

/** Show the current MEMORY.md content */
async function showMemory(manager: MemoryManager): Promise<{ readonly output: string; readonly success: boolean }> {
  const result = await manager.loadMemory();

  if (!result.exists || !result.content.trim()) {
    const memoryDir = manager.getMemoryDir();
    return {
      output: [
        "No project memory found.",
        "",
        `Memory location: ${memoryDir}/MEMORY.md`,
        "",
        "Usage:",
        "  /memory save <text>   — Save a memory entry",
        "  /memory topics        — List topic files",
        "  /memory read <topic>  — Read a topic file",
        "  /memory clear         — Clear all memory",
      ].join("\n"),
      success: true,
    };
  }

  const topicInfo = result.topicFiles.length > 0
    ? `\n\nTopic files: ${result.topicFiles.join(", ")}`
    : "";

  return {
    output: `--- MEMORY.md ---\n\n${result.content}${topicInfo}`,
    success: true,
  };
}

/** Save a memory entry */
async function saveEntry(
  manager: MemoryManager,
  text: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!text.trim()) {
    return {
      output: "Usage: /memory save <text>\n\nProvide the text you want to remember.",
      success: false,
    };
  }

  // Parse optional topic prefix: "topic: content" or just "content" (defaults to "General")
  let topic = "General";
  let content = text;

  const colonIdx = text.indexOf(":");
  if (colonIdx > 0 && colonIdx < 30) {
    // Short prefix before colon is likely a topic
    const possibleTopic = text.slice(0, colonIdx).trim();
    // Only treat it as a topic if it looks like a simple label (no spaces or special chars)
    if (/^[a-zA-Z][a-zA-Z0-9 _-]*$/.test(possibleTopic)) {
      topic = possibleTopic;
      content = text.slice(colonIdx + 1).trim();
    }
  }

  const result = await manager.appendMemory({ topic, content });

  if (!result.written) {
    return {
      output: "Memory entry already exists (duplicate detected).",
      success: true,
    };
  }

  const overflowNote = result.overflowed
    ? "\n(Some older entries were moved to topic files due to size limit.)"
    : "";

  return {
    output: `Memory saved under "${topic}".${overflowNote}`,
    success: true,
  };
}

/** List available topic files */
async function listTopics(
  manager: MemoryManager,
): Promise<{ readonly output: string; readonly success: boolean }> {
  const topics = await manager.getTopicFiles();

  if (topics.length === 0) {
    return {
      output: "No topic files found.\n\nTopic files are created automatically when MEMORY.md overflows.",
      success: true,
    };
  }

  const lines = [
    `Topic files (${topics.length}):`,
    "",
    ...topics.map((t) => `  ${t}`),
    "",
    "Use /memory read <topic> to view a topic file.",
  ];

  return { output: lines.join("\n"), success: true };
}

/** Read a specific topic file */
async function readTopic(
  manager: MemoryManager,
  topic: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!topic.trim()) {
    return {
      output: "Usage: /memory read <topic>\n\nSpecify the topic name to read.",
      success: false,
    };
  }

  const content = await manager.readTopicFile(topic);

  if (content === null) {
    const topics = await manager.getTopicFiles();
    const available = topics.length > 0
      ? `\n\nAvailable topics: ${topics.join(", ")}`
      : "";
    return {
      output: `Topic file not found: ${topic}${available}`,
      success: false,
    };
  }

  return {
    output: `--- ${topic} ---\n\n${content}`,
    success: true,
  };
}

/** Clear all project memory */
async function clearAllMemory(
  manager: MemoryManager,
): Promise<{ readonly output: string; readonly success: boolean }> {
  await manager.clearMemory();
  return {
    output: "All project memory cleared.",
    success: true,
  };
}
