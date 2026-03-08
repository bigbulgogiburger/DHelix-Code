import { join } from "node:path";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";
import { loadSkillsFromDirectory } from "./loader.js";
import { executeSkill } from "./executor.js";
import { type SkillDefinition, type SkillContext, type SkillExecutionResult } from "./types.js";

/** Directories scanned for skills */
const SKILL_DIRS = {
  /** Project-level commands: .dbcode/commands/ */
  projectCommands: (cwd: string) => join(cwd, `.${APP_NAME}`, "commands"),
  /** Project-level skills: .dbcode/skills/ */
  projectSkills: (cwd: string) => join(cwd, `.${APP_NAME}`, "skills"),
  /** User-level commands: ~/.dbcode/commands/ */
  globalCommands: () => join(homedir(), `.${APP_NAME}`, "commands"),
  /** User-level skills: ~/.dbcode/skills/ */
  globalSkills: () => join(homedir(), `.${APP_NAME}`, "skills"),
} as const;

/**
 * SkillManager — loads and manages skills from multiple directories.
 *
 * Skills are loaded from (in priority order):
 * 1. Project commands: .dbcode/commands/
 * 2. Project skills: .dbcode/skills/
 * 3. Global commands: ~/.dbcode/commands/
 * 4. Global skills: ~/.dbcode/skills/
 *
 * Project-level skills override global skills with the same name.
 * Frontmatter is always available; body is loaded on demand for progressive loading.
 */
export class SkillManager {
  private readonly skills = new Map<string, SkillDefinition>();

  /** Get all loaded skills */
  getAll(): readonly SkillDefinition[] {
    return [...this.skills.values()];
  }

  /** Get a skill by name */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /** Check if a skill exists */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /** Get user-invocable skills (for /command listing) */
  getUserInvocable(): readonly SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.frontmatter.userInvocable);
  }

  /** Get skills the LLM can see (not disabled for model invocation) */
  getModelVisible(): readonly SkillDefinition[] {
    return [...this.skills.values()].filter((s) => !s.frontmatter.disableModelInvocation);
  }

  /**
   * Load all skills from project and global directories.
   * Project-level skills take precedence over global ones with the same name.
   */
  async loadAll(workingDirectory: string): Promise<void> {
    // Load in reverse priority order so higher-priority overwrites lower
    const dirs = [
      SKILL_DIRS.globalSkills(),
      SKILL_DIRS.globalCommands(),
      SKILL_DIRS.projectSkills(workingDirectory),
      SKILL_DIRS.projectCommands(workingDirectory),
    ];

    for (const dir of dirs) {
      const skills = await loadSkillsFromDirectory(dir);
      for (const skill of skills) {
        this.skills.set(skill.frontmatter.name, skill);
      }
    }
  }

  /**
   * Execute a skill by name with the given arguments.
   * Returns null if skill not found.
   */
  async execute(
    name: string,
    args: string,
    options: {
      readonly sessionId?: string;
      readonly workingDirectory: string;
      readonly projectDir?: string;
    },
  ): Promise<SkillExecutionResult | null> {
    const skill = this.skills.get(name);
    if (!skill) return null;

    const positionalArgs = args.trim() ? args.trim().split(/\s+/) : [];

    const context: SkillContext = {
      arguments: args,
      positionalArgs,
      sessionId: options.sessionId,
      skillDir: skill.sourcePath
        ? skill.sourcePath.substring(0, skill.sourcePath.lastIndexOf("/"))
        : undefined,
      projectDir: options.projectDir ?? options.workingDirectory,
      workingDirectory: options.workingDirectory,
    };

    return executeSkill(skill, context);
  }

  /**
   * Build the system prompt section listing available skills.
   * Only includes skills visible to the model.
   */
  buildPromptSection(): string | null {
    const visible = this.getModelVisible();
    if (visible.length === 0) return null;

    const lines = ["# Available Skills", ""];
    lines.push(
      "The user has configured the following skills. " +
        "When a user invokes a skill with /<name>, the skill's prompt will be expanded and you should follow its instructions.",
    );
    lines.push("");

    for (const skill of visible) {
      const { name, description, argumentHint, userInvocable } = skill.frontmatter;
      const invocable = userInvocable ? `/${name}` : `(internal) ${name}`;
      const hint = argumentHint ? ` ${argumentHint}` : "";
      lines.push(`- **${invocable}${hint}**: ${description}`);
    }

    return lines.join("\n");
  }
}
