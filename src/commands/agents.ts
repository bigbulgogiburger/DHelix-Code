import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { homedir } from "node:os";
import { type SlashCommand, type CommandResult } from "./registry.js";
import { APP_NAME } from "../constants.js";
import { AGENT_TYPES, listAgentTypes } from "../subagents/agent-types.js";

/**
 * Metadata extracted from an agent definition file.
 */
interface AgentFileInfo {
  readonly name: string;
  readonly description: string;
  readonly model: string;
  readonly scope: "project" | "user";
  readonly filePath: string;
  readonly maxTurns: string;
  readonly permissionMode: string;
}

/**
 * Parse basic YAML-style frontmatter from a markdown file.
 * Returns key-value pairs from the `---` delimited section.
 * Handles malformed input gracefully by returning an empty record.
 */
function parseBasicFrontmatter(content: string): Record<string, string> {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return {};
  }

  const endIdx = lines.indexOf("---", 1);
  if (endIdx === -1) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of lines.slice(1, endIdx)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    result[key] = value;
  }

  return result;
}

/**
 * Scan a directory for .md agent definition files.
 * Returns metadata for each valid agent file found.
 * Handles missing directories (ENOENT) gracefully.
 */
async function scanAgentDirectory(
  dirPath: string,
  scope: "project" | "user",
): Promise<readonly AgentFileInfo[]> {
  try {
    const entries = await readdir(dirPath);
    const mdFiles = entries.filter((f) => extname(f) === ".md");
    const agents: AgentFileInfo[] = [];

    for (const file of mdFiles) {
      const filePath = join(dirPath, file);
      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) continue;

        const content = await readFile(filePath, "utf-8");
        const frontmatter = parseBasicFrontmatter(content);

        const name = frontmatter.name || basename(file, ".md");
        const description = frontmatter.description || "(no description)";
        const model = frontmatter.model || "inherit";
        const maxTurns = frontmatter["max-turns"] || frontmatter.maxTurns || "-";
        const permissionMode =
          frontmatter["permission-mode"] || frontmatter.permissionMode || "default";

        agents.push({
          name,
          description,
          model,
          scope,
          filePath,
          maxTurns,
          permissionMode,
        });
      } catch {
        // Non-fatal: skip files that fail to read or parse
      }
    }

    return agents;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    return [];
  }
}

/**
 * Format agent list as an aligned text table.
 */
function formatAgentTable(agents: readonly AgentFileInfo[]): string {
  if (agents.length === 0) {
    return "  (none found)";
  }

  const nameWidth = Math.max(6, ...agents.map((a) => a.name.length)) + 2;
  const scopeWidth = 9;
  const modelWidth = 9;

  const header = [
    "  " + "Name".padEnd(nameWidth),
    "Scope".padEnd(scopeWidth),
    "Model".padEnd(modelWidth),
    "Description",
  ].join("");

  const separator = "  " + "-".repeat(nameWidth + scopeWidth + modelWidth + 20);

  const rows = agents.map(
    (a) =>
      "  " +
      a.name.padEnd(nameWidth) +
      a.scope.padEnd(scopeWidth) +
      a.model.padEnd(modelWidth) +
      a.description,
  );

  return [header, separator, ...rows].join("\n");
}

/**
 * /agents list — Show all available agent definitions.
 */
async function handleList(workingDirectory: string): Promise<CommandResult> {
  const projectDir = join(workingDirectory, `.${APP_NAME}`, "agents");
  const userDir = join(homedir(), `.${APP_NAME}`, "agents");

  const [projectAgents, userAgents] = await Promise.all([
    scanAgentDirectory(projectDir, "project"),
    scanAgentDirectory(userDir, "user"),
  ]);

  const allAgents = [...projectAgents, ...userAgents];

  const lines = ["Agent Definitions", "=".repeat(20), ""];

  if (allAgents.length === 0) {
    lines.push("  No agent definitions found.");
    lines.push("");
    lines.push("  Create agent definitions in:");
    lines.push(`    Project: .${APP_NAME}/agents/<name>.md`);
    lines.push(`    User:    ~/.${APP_NAME}/agents/<name>.md`);
  } else {
    lines.push(formatAgentTable(allAgents));
    lines.push("");
    lines.push(`  ${allAgents.length} agent(s) found.`);
  }

  lines.push("");
  lines.push("  Use /agents show <name> for details, /agents types for built-in types.");

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents show <name> — Display full details for a specific agent definition.
 */
async function handleShow(
  name: string | undefined,
  workingDirectory: string,
): Promise<CommandResult> {
  if (!name) {
    return {
      output: "Usage: /agents show <name>\nProvide the agent name to inspect.",
      success: false,
    };
  }

  const projectDir = join(workingDirectory, `.${APP_NAME}`, "agents");
  const userDir = join(homedir(), `.${APP_NAME}`, "agents");

  const [projectAgents, userAgents] = await Promise.all([
    scanAgentDirectory(projectDir, "project"),
    scanAgentDirectory(userDir, "user"),
  ]);

  const allAgents = [...projectAgents, ...userAgents];
  const agent = allAgents.find((a) => a.name === name);

  if (!agent) {
    const similar = allAgents
      .filter((a) => a.name.includes(name) || name.includes(a.name))
      .map((a) => a.name);

    const lines = [`Agent "${name}" not found.`];
    if (similar.length > 0) {
      lines.push(`Did you mean: ${similar.join(", ")}?`);
    }
    if (allAgents.length > 0) {
      lines.push(`Available agents: ${allAgents.map((a) => a.name).join(", ")}`);
    } else {
      lines.push("No agent definitions found. Use /agents list for setup instructions.");
    }
    return { output: lines.join("\n"), success: false };
  }

  // Read the full file for detailed display
  let systemPrompt = "(unable to read)";
  try {
    const content = await readFile(agent.filePath, "utf-8");
    const lines = content.split("\n");
    const startIdx = lines[0]?.trim() === "---" ? lines.indexOf("---", 1) : -1;
    if (startIdx !== -1) {
      systemPrompt =
        lines
          .slice(startIdx + 1)
          .join("\n")
          .trim() || "(empty)";
    }
  } catch {
    // Keep default "(unable to read)"
  }

  const lines = [
    `Agent: ${agent.name}`,
    "=".repeat(20),
    "",
    `  Description:     ${agent.description}`,
    `  Scope:           ${agent.scope}`,
    `  Model:           ${agent.model}`,
    `  Max turns:       ${agent.maxTurns}`,
    `  Permission mode: ${agent.permissionMode}`,
    `  File:            ${agent.filePath}`,
    "",
    "System Prompt:",
    "-".repeat(20),
    systemPrompt,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents types — List all built-in agent types.
 */
function handleTypes(): CommandResult {
  const types = listAgentTypes();
  const typeWidth = Math.max(6, ...types.map((t) => t.length)) + 2;
  const iterWidth = 12;
  const toolsWidth = 8;

  const lines = ["Built-in Agent Types", "=".repeat(20), ""];

  const header = [
    "  " + "Type".padEnd(typeWidth),
    "Max Iters".padEnd(iterWidth),
    "Tools".padEnd(toolsWidth),
    "Description",
  ].join("");

  const separator = "  " + "-".repeat(typeWidth + iterWidth + toolsWidth + 30);

  lines.push(header);
  lines.push(separator);

  for (const typeName of types) {
    const config = AGENT_TYPES.get(typeName);
    if (!config) continue;

    lines.push(
      "  " +
        config.type.padEnd(typeWidth) +
        String(config.defaultMaxIterations).padEnd(iterWidth) +
        String(config.allowedTools.length).padEnd(toolsWidth) +
        config.description.slice(0, 80),
    );
  }

  lines.push("");
  lines.push(`  ${types.length} built-in type(s) available.`);

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents status — Show active/recent agent sessions.
 */
function handleStatus(): CommandResult {
  const lines = [
    "Agent Status",
    "=".repeat(20),
    "",
    "  No active agent sessions.",
    "",
    "  Agent session tracking will show running and recently completed agents here.",
    "  Spawn agents with the agent tool or by referencing agent definitions.",
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents help — Show usage information for the /agents command.
 */
function handleHelp(): CommandResult {
  const lines = [
    "Agent Management:",
    "",
    "  /agents                        — List all agent definitions",
    "  /agents list                   — List all agent definitions",
    "  /agents show <name>            — Show details for a specific agent",
    "  /agents types                  — List built-in agent types",
    "  /agents status                 — Show active agent sessions",
    "",
    "Agent definitions are loaded from:",
    `  Project: .${APP_NAME}/agents/<name>.md`,
    `  User:    ~/.${APP_NAME}/agents/<name>.md`,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents — Manage and inspect agent definitions.
 * Subcommands: list, show <name>, types, status
 */
export const agentsCommand: SlashCommand = {
  name: "agents",
  description: "Manage agent definitions and view available agent types",
  usage: "/agents <list|show|types|status> [args]",
  execute: async (args, context): Promise<CommandResult> => {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase() || "list";

    switch (subcommand) {
      case "list":
        return handleList(context.workingDirectory);
      case "show":
        return handleShow(parts[1], context.workingDirectory);
      case "types":
        return handleTypes();
      case "status":
        return handleStatus();
      default:
        return handleHelp();
    }
  },
};
