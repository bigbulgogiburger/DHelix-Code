import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/**
 * /model [name] — Switch the active model mid-session.
 * Without arguments, shows the current model and its capabilities.
 */
export const modelCommand: SlashCommand = {
  name: "model",
  description: "Show or switch the active model",
  usage: "/model [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const newModel = args.trim();

    if (!newModel) {
      const caps = getModelCapabilities(context.model);
      const lines = [
        `Current model: ${context.model}`,
        `  Context: ${(caps.maxContextTokens / 1000).toFixed(0)}K tokens`,
        `  Max output: ${(caps.maxOutputTokens / 1000).toFixed(0)}K tokens`,
        `  Tools: ${caps.supportsTools ? "yes" : "no (text-parsing fallback)"}`,
        `  Tokenizer: ${caps.tokenizer}`,
      ];
      if (caps.useDeveloperRole) {
        lines.push("  Note: uses developer role (no system message)");
      }
      return {
        output: lines.join("\n"),
        success: true,
      };
    }

    const caps = getModelCapabilities(newModel);
    const notes: string[] = [];
    if (!caps.supportsTools) notes.push("text-parsing fallback for tools");
    if (caps.useDeveloperRole) notes.push("developer role instead of system");
    if (!caps.supportsTemperature) notes.push("temperature not supported");

    const info = `(${(caps.maxContextTokens / 1000).toFixed(0)}K context${notes.length > 0 ? ", " + notes.join(", ") : ""})`;

    return {
      output: `Model switched to: ${newModel} ${info}`,
      success: true,
      newModel,
    };
  },
};
