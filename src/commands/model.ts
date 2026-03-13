import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/** Well-known models available for interactive selection */
const KNOWN_MODELS = [
  { label: "gpt-4o", value: "gpt-4o", description: "128k context" },
  { label: "gpt-4o-mini", value: "gpt-4o-mini", description: "Cost-effective" },
  { label: "claude-sonnet-4-6", value: "claude-sonnet-4-6", description: "Best coding" },
  { label: "claude-opus-4-6", value: "claude-opus-4-6", description: "Deepest reasoning" },
  {
    label: "claude-haiku-4-5-20251001",
    value: "claude-haiku-4-5-20251001",
    description: "Fast",
  },
  { label: "o3-mini", value: "o3-mini", description: "Reasoning" },
  { label: "deepseek-chat", value: "deepseek-chat", description: "Open-source" },
] as const;

/**
 * /model [name] — Switch the active model mid-session.
 * Without arguments, shows an interactive model selector.
 */
export const modelCommand: SlashCommand = {
  name: "model",
  description: "Show or switch the active model",
  usage: "/model [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const newModel = args.trim();

    if (!newModel) {
      // Show interactive model selector with current model highlighted info
      const caps = getModelCapabilities(context.model);
      const currentInfo = `Current: ${context.model} (${(caps.maxContextTokens / 1000).toFixed(0)}K context)`;

      return {
        output: currentInfo,
        success: true,
        interactiveSelect: {
          options: KNOWN_MODELS,
          prompt: `Select a model (current: ${context.model}):`,
          onSelect: "/model",
        },
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
