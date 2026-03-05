import { z } from "zod";

/** Zod schema for skill frontmatter */
export const skillFrontmatterSchema = z.object({
  /** Skill name (used as /command name) */
  name: z.string().min(1),
  /** Short description shown in help */
  description: z.string().min(1),
  /** Hint for arguments (e.g., "[file path]") */
  argumentHint: z.string().optional(),
  /** Whether users can invoke this skill directly via /name */
  userInvocable: z.boolean().default(true),
  /** If true, only users can invoke (LLM cannot) */
  disableModelInvocation: z.boolean().default(false),
  /** Restrict tools available during skill execution */
  allowedTools: z.array(z.string()).optional(),
  /** Force a specific model for this skill */
  model: z.string().nullable().default(null),
  /** Execution context: "inline" (current context) or "fork" (subagent) */
  context: z.enum(["inline", "fork"]).default("inline"),
  /** Subagent type when context is "fork" */
  agent: z.enum(["explore", "plan", "general"]).optional(),
  /** Skill-scoped hooks (active only during this skill's execution) */
  hooks: z.array(z.unknown()).default([]),
});

/** Parsed skill frontmatter type */
export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/** A fully loaded skill definition */
export interface SkillDefinition {
  /** Parsed frontmatter metadata */
  readonly frontmatter: SkillFrontmatter;
  /** Raw markdown body (the prompt template) */
  readonly body: string;
  /** File path where the skill was loaded from */
  readonly sourcePath: string;
}

/** Context variables available for interpolation in skill bodies */
export interface SkillContext {
  /** Full argument string passed to the skill */
  readonly arguments: string;
  /** Positional arguments */
  readonly positionalArgs: readonly string[];
  /** Current session ID */
  readonly sessionId?: string;
  /** Skill directory path */
  readonly skillDir?: string;
  /** Project root directory path */
  readonly projectDir?: string;
  /** Current working directory */
  readonly workingDirectory: string;
}

/** Result from executing a skill */
export interface SkillExecutionResult {
  /** The assembled prompt to send to the LLM */
  readonly prompt: string;
  /** Model override (if skill specifies one) */
  readonly model?: string;
  /** Whether to execute in a forked context (subagent) */
  readonly fork: boolean;
  /** Subagent type for forked execution */
  readonly agentType?: "explore" | "plan" | "general";
  /** Allowed tools restriction */
  readonly allowedTools?: readonly string[];
}
