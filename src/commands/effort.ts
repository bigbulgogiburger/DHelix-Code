import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** Valid effort levels */
const EFFORT_LEVELS = ["low", "medium", "high", "max"] as const;
type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** Current effort level (module state) */
let currentEffort: EffortLevel = "high";

/** Get the current effort level */
export function getEffortLevel(): EffortLevel {
  return currentEffort;
}

/**
 * Map effort level to temperature and max tokens.
 */
export function getEffortConfig(level: EffortLevel): {
  readonly temperature: number;
  readonly maxTokens: number;
} {
  switch (level) {
    case "low":
      return { temperature: 0.0, maxTokens: 1024 };
    case "medium":
      return { temperature: 0.0, maxTokens: 2048 };
    case "high":
      return { temperature: 0.0, maxTokens: 4096 };
    case "max":
      return { temperature: 0.0, maxTokens: 8192 };
  }
}

/**
 * /effort [level] — Set the reasoning effort level.
 * Without arguments, shows the current level.
 */
export const effortCommand: SlashCommand = {
  name: "effort",
  description: "Set reasoning effort level (low/medium/high/max)",
  usage: "/effort [low|medium|high|max]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const level = args.trim().toLowerCase();

    if (!level) {
      return {
        output: `Current effort level: ${currentEffort}`,
        success: true,
      };
    }

    if (!EFFORT_LEVELS.includes(level as EffortLevel)) {
      return {
        output: `Invalid effort level: "${level}". Use: ${EFFORT_LEVELS.join(", ")}`,
        success: false,
      };
    }

    currentEffort = level as EffortLevel;
    const config = getEffortConfig(currentEffort);

    return {
      output: `Effort level set to: ${currentEffort} (maxTokens: ${config.maxTokens})`,
      success: true,
    };
  },
};
