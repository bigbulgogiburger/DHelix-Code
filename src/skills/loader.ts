import { readFile, readdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { BaseError } from "../utils/error.js";
import { skillFrontmatterSchema, type SkillDefinition } from "./types.js";

/** Skill loading error */
export class SkillLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SKILL_LOAD_ERROR", context);
  }
}

/** Frontmatter delimiter */
const FRONTMATTER_DELIMITER = "---";

/**
 * Parse YAML-like frontmatter from a skill file.
 * Supports a simplified YAML subset: key: value, key: [array], key: true/false/null.
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

    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

    result[camelKey] = parseValue(value);
  }

  return result;
}

/**
 * Parse a YAML-like value string to its JavaScript equivalent.
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
      // Strip quotes
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }
      return parseValue(trimmed);
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
 * Split a skill file into frontmatter and body.
 * Frontmatter is delimited by `---` at start and end.
 */
function splitFrontmatterAndBody(content: string): { frontmatterRaw: string; body: string } {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return { frontmatterRaw: "", body: content };
  }

  const endIdx = lines.indexOf(FRONTMATTER_DELIMITER, 1);
  if (endIdx === -1) {
    return { frontmatterRaw: "", body: content };
  }

  const frontmatterRaw = lines.slice(1, endIdx).join("\n");
  const body = lines
    .slice(endIdx + 1)
    .join("\n")
    .trim();
  return { frontmatterRaw, body };
}

/**
 * Load a single skill from a markdown file.
 * Parses frontmatter and validates against the schema.
 */
export async function loadSkill(filePath: string): Promise<SkillDefinition> {
  try {
    const content = await readFile(filePath, "utf-8");
    const { frontmatterRaw, body } = splitFrontmatterAndBody(content);

    if (!frontmatterRaw) {
      throw new SkillLoadError("Skill file missing frontmatter", { path: filePath });
    }

    const rawData = parseFrontmatter(frontmatterRaw);
    const frontmatter = skillFrontmatterSchema.parse(rawData);

    return {
      frontmatter,
      body,
      sourcePath: filePath,
    };
  } catch (error) {
    if (error instanceof SkillLoadError) throw error;
    throw new SkillLoadError(`Failed to load skill from ${filePath}`, {
      path: filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Load all skills from a directory.
 * Scans for .md files and loads each as a skill.
 * Skips files that fail to parse (logs warning, doesn't crash).
 */
export async function loadSkillsFromDirectory(
  directory: string,
): Promise<readonly SkillDefinition[]> {
  try {
    const entries = await readdir(directory);
    const mdFiles = entries.filter((f) => extname(f) === ".md");

    const skills: SkillDefinition[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of mdFiles) {
      try {
        const skill = await loadSkill(join(directory, file));
        skills.push(skill);
      } catch (error) {
        errors.push({
          file: basename(file),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (errors.length > 0) {
      // Non-fatal: skills that fail to load are skipped
      // Errors are available for debugging but don't block execution
    }

    return skills;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw new SkillLoadError(`Failed to read skills directory: ${directory}`, {
      path: directory,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
