import { z } from "zod";

/** Model choices for agent definitions */
export type AgentModel = "sonnet" | "opus" | "haiku" | "inherit";

/** Permission modes available for agent definitions */
export type AgentPermissionMode =
  | "default"
  | "acceptEdits"
  | "dontAsk"
  | "bypassPermissions"
  | "plan";

/** Memory scope for agent definitions */
export type AgentMemoryScope = "user" | "project" | "local";

/** Agent hook entry (command to execute) */
export interface AgentHookEntry {
  readonly type: "command";
  readonly command: string;
}

/** Agent hook rule (matcher + hooks) */
export interface AgentHookRule {
  readonly matcher?: string;
  readonly hooks: readonly AgentHookEntry[];
}

/** Agent hook configuration by lifecycle event */
export interface AgentHookConfig {
  readonly PreToolUse?: readonly AgentHookRule[];
  readonly PostToolUse?: readonly AgentHookRule[];
  readonly Stop?: readonly AgentHookRule[];
}

/**
 * Zod schema for agent definition frontmatter.
 *
 * Agent names must be lowercase kebab-case starting with a letter.
 * All fields except name and description are optional.
 */
export const agentDefinitionSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "Agent name must be lowercase kebab-case"),
  description: z.string().min(1),
  tools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  model: z.enum(["sonnet", "opus", "haiku", "inherit"]).optional(),
  permissionMode: z
    .enum(["default", "acceptEdits", "dontAsk", "bypassPermissions", "plan"])
    .optional(),
  maxTurns: z.number().int().positive().optional(),
  skills: z.array(z.string()).optional(),
  memory: z.enum(["user", "project", "local"]).optional(),
  background: z.boolean().optional(),
  isolation: z.enum(["worktree"]).optional(),
});

/** Parsed agent definition frontmatter type */
export type AgentDefinitionFrontmatter = z.infer<typeof agentDefinitionSchema>;

/** Source origin for an agent definition */
export type AgentDefinitionSource = "project" | "user" | "cli";

/** A fully loaded agent definition */
export interface AgentDefinition {
  /** Parsed and validated frontmatter metadata */
  readonly frontmatter: AgentDefinitionFrontmatter;
  /** System prompt body (markdown content after frontmatter) */
  readonly systemPrompt: string;
  /** Where this definition was loaded from */
  readonly source: AgentDefinitionSource;
  /** File path where the definition was loaded from (absent for CLI-defined) */
  readonly filePath?: string;
}
