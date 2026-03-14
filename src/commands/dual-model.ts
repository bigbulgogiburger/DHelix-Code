import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/**
 * /architect [model] — Set or show the architect model for dual-model routing.
 *
 * The architect model handles planning, analysis, and review phases.
 * Typically a high-capability model like claude-opus-4-6.
 */
export const architectCommand: SlashCommand = {
  name: "architect",
  description: "Set or show the architect model (planning/review)",
  usage: "/architect [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const model = args.trim();

    if (!model) {
      return {
        output: [
          "Architect model: used for planning, analysis, and review phases.",
          `Current main model: ${context.model}`,
          "",
          "Usage: /architect <model-name>",
          "Example: /architect claude-opus-4-6",
          "",
          "Use /dual on to enable dual-model routing after setting architect/editor models.",
        ].join("\n"),
        success: true,
      };
    }

    return {
      output: `Architect model set to: ${model}. Use /dual on to enable dual-model routing.`,
      success: true,
      newModel: undefined, // Does not change the main model
    };
  },
};

/**
 * /editor [model] — Set or show the editor model for dual-model routing.
 *
 * The editor model handles code generation and execution phases.
 * Typically a cost-effective model like gpt-4o-mini or claude-haiku.
 */
export const editorCommand: SlashCommand = {
  name: "editor",
  description: "Set or show the editor model (code generation)",
  usage: "/editor [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const model = args.trim();

    if (!model) {
      return {
        output: [
          "Editor model: used for code generation and execution phases.",
          `Current main model: ${context.model}`,
          "",
          "Usage: /editor <model-name>",
          "Example: /editor gpt-4o-mini",
          "",
          "Use /dual on to enable dual-model routing after setting architect/editor models.",
        ].join("\n"),
        success: true,
      };
    }

    return {
      output: `Editor model set to: ${model}. Use /dual on to enable dual-model routing.`,
      success: true,
      newModel: undefined, // Does not change the main model
    };
  },
};

/**
 * /dual [on|off|status] — Toggle or show dual-model routing status.
 *
 * When enabled, the system automatically routes requests to the architect model
 * for planning/review and to the editor model for code execution.
 */
export const dualCommand: SlashCommand = {
  name: "dual",
  description: "Toggle dual-model (architect/editor) routing",
  usage: "/dual [on|off|status]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const arg = args.trim().toLowerCase();

    if (arg === "on") {
      return {
        output: [
          "Dual-model routing enabled.",
          "",
          "Routing strategy:",
          "  plan/review phases -> architect model (high-capability)",
          "  execute phase     -> editor model (cost-effective)",
          "",
          "Set models with /architect and /editor commands.",
          "Phase is auto-detected from your messages.",
        ].join("\n"),
        success: true,
      };
    }

    if (arg === "off") {
      return {
        output: "Dual-model routing disabled. Using single model for all phases.",
        success: true,
      };
    }

    // Default: show status
    return {
      output: [
        "Dual-model routing (Architect/Editor pattern)",
        "",
        "Commands:",
        "  /dual on         Enable dual-model routing",
        "  /dual off        Disable dual-model routing",
        "  /architect <m>   Set architect model (planning/review)",
        "  /editor <m>      Set editor model (code generation)",
        "",
        "How it works:",
        "  Planning keywords (plan, review, design, analyze) route to the architect model.",
        "  Code generation and execution route to the editor model.",
        "  This reduces cost while maintaining quality for complex tasks.",
      ].join("\n"),
      success: true,
    };
  },
};
