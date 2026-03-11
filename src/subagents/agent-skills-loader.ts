import { join } from "node:path";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";
import { loadSkill } from "../skills/loader.js";

/** A skill loaded for agent system prompt injection */
export interface LoadedSkill {
  readonly name: string;
  readonly content: string;
}

/**
 * Directories scanned for skills, in priority order.
 * Project-level directories are checked first so they take precedence.
 */
function getSkillDirectories(workingDirectory: string): readonly string[] {
  return [
    join(workingDirectory, `.${APP_NAME}`, "commands"),
    join(workingDirectory, `.${APP_NAME}`, "skills"),
    join(homedir(), `.${APP_NAME}`, "commands"),
    join(homedir(), `.${APP_NAME}`, "skills"),
  ];
}

/**
 * Attempt to load a skill by name from the known skill directories.
 * Returns the first match found (project-level takes precedence over global).
 */
async function findAndLoadSkill(
  name: string,
  directories: readonly string[],
): Promise<LoadedSkill | undefined> {
  for (const dir of directories) {
    try {
      const skill = await loadSkill(join(dir, `${name}.md`));
      return {
        name: skill.frontmatter.name,
        content: skill.body,
      };
    } catch {
      // Skill not found in this directory — try next
    }
  }
  return undefined;
}

/**
 * Load skill contents by name for system prompt injection.
 * Searches in the 4 skill directories:
 * - .dbcode/commands/
 * - .dbcode/skills/
 * - ~/.dbcode/commands/
 * - ~/.dbcode/skills/
 *
 * Skills not found in any directory are silently skipped.
 */
export async function loadSkillsForAgent(
  skillNames: readonly string[],
  workingDirectory: string,
): Promise<readonly LoadedSkill[]> {
  if (skillNames.length === 0) {
    return [];
  }

  const directories = getSkillDirectories(workingDirectory);
  const results: LoadedSkill[] = [];

  for (const name of skillNames) {
    const loaded = await findAndLoadSkill(name, directories);
    if (loaded) {
      results.push(loaded);
    }
  }

  return results;
}

/**
 * Build a system prompt section containing preloaded skill content.
 * Each skill's body is included under a header with its name.
 * Returns an empty string if no skills are provided.
 */
export function buildSkillPromptSection(skills: readonly LoadedSkill[]): string {
  if (skills.length === 0) {
    return "";
  }

  const lines = ["# Preloaded Skills", ""];

  for (const skill of skills) {
    lines.push(`## ${skill.name}`, "");
    lines.push(skill.content);
    lines.push("");
  }

  return lines.join("\n");
}
