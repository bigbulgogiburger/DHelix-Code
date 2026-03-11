import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";
import { BaseError } from "../utils/error.js";
import {
  agentDefinitionSchema,
  type AgentDefinition,
  type AgentDefinitionSource,
} from "./definition-types.js";

/** Agent definition loading error */
export class AgentDefinitionLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "AGENT_DEFINITION_LOAD_ERROR", context);
  }
}

/** Frontmatter delimiter */
const FRONTMATTER_DELIMITER = "---";

/**
 * Parse a simplified YAML value to its JavaScript equivalent.
 * Supports: booleans, null, numbers, inline arrays, quoted/unquoted strings.
 */
function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (raw === "") return "";

  // Inline array: [item1, item2]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => {
      const trimmed = item.trim();
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }
      return parseValue(trimmed) as string;
    });
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);

  // Quoted string
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  return raw;
}

/**
 * Parse simplified YAML frontmatter into a key-value record.
 * Supports flat key: value pairs with kebab-case to camelCase conversion.
 */
function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    // Convert kebab-case to camelCase (e.g., max-turns → maxTurns)
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

    result[camelKey] = parseValue(value);
  }

  return result;
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Expects `---` delimiters at the start of the content.
 * Returns the parsed frontmatter record and the body after the closing `---`.
 */
export function parseYamlFrontmatter(content: string): {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
} {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return { frontmatter: {}, body: content };
  }

  const endIdx = lines.indexOf(FRONTMATTER_DELIMITER, 1);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterRaw = lines.slice(1, endIdx).join("\n");
  const body = lines
    .slice(endIdx + 1)
    .join("\n")
    .trim();

  return { frontmatter: parseFrontmatter(frontmatterRaw), body };
}

/**
 * Parse a single agent definition file.
 * Extracts frontmatter, validates it against the schema, and returns
 * the full AgentDefinition with systemPrompt from the body.
 */
export function parseAgentFile(
  content: string,
  source: AgentDefinitionSource,
  filePath?: string,
): AgentDefinition {
  const { frontmatter: rawFrontmatter, body } = parseYamlFrontmatter(content);

  if (Object.keys(rawFrontmatter).length === 0) {
    throw new AgentDefinitionLoadError("Agent file missing frontmatter", {
      path: filePath,
    });
  }

  const parseResult = agentDefinitionSchema.safeParse(rawFrontmatter);
  if (!parseResult.success) {
    throw new AgentDefinitionLoadError(
      `Invalid agent frontmatter: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
      {
        path: filePath,
        issues: parseResult.error.issues,
      },
    );
  }

  return {
    frontmatter: parseResult.data,
    systemPrompt: body,
    source,
    filePath,
  };
}

/**
 * Load agent definitions from a single directory.
 * Reads all .md files, parses each as an agent definition,
 * and skips files that fail to parse (non-fatal).
 */
async function loadFromDirectory(
  directory: string,
  source: AgentDefinitionSource,
): Promise<readonly AgentDefinition[]> {
  try {
    const entries = await readdir(directory);
    const mdFiles = entries.filter((f) => extname(f) === ".md");

    const definitions: AgentDefinition[] = [];

    for (const file of mdFiles) {
      const filePath = join(directory, file);
      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) continue;

        const content = await readFile(filePath, "utf-8");
        const definition = parseAgentFile(content, source, filePath);
        definitions.push(definition);
      } catch {
        // Non-fatal: skip files that fail to parse
      }
    }

    return definitions;
  } catch (error) {
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
 * Load agent definitions from all configured directories.
 *
 * Load order (higher priority overrides by name):
 * 1. User scope: `~/.dbcode/agents/*.md` (priority 3 — lowest)
 * 2. Project scope: `.dbcode/agents/*.md` (priority 2 — highest)
 *
 * When multiple definitions share the same `name`, the higher-priority
 * source wins.
 *
 * @param workingDirectory - The project working directory
 * @returns Map of agent name to AgentDefinition
 */
export async function loadAgentDefinitions(
  workingDirectory: string,
): Promise<Map<string, AgentDefinition>> {
  const result = new Map<string, AgentDefinition>();

  // 1. User-scope agents (~/.dbcode/agents/) — lowest priority
  const userAgentsDir = join(homedir(), `.${APP_NAME}`, "agents");
  const userDefinitions = await loadFromDirectory(userAgentsDir, "user");
  for (const def of userDefinitions) {
    result.set(def.frontmatter.name, def);
  }

  // 2. Project-scope agents (.dbcode/agents/) — highest priority (overrides user)
  const projectAgentsDir = join(workingDirectory, `.${APP_NAME}`, "agents");
  const projectDefinitions = await loadFromDirectory(projectAgentsDir, "project");
  for (const def of projectDefinitions) {
    result.set(def.frontmatter.name, def);
  }

  return result;
}
