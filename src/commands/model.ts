import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/**
 * /model [name] — Switch the active model mid-session.
 * Without arguments, shows the current model.
 */
export const modelCommand: SlashCommand = {
  name: "model",
  description: "Show or switch the active model",
  usage: "/model [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const newModel = args.trim();

    if (!newModel) {
      return {
        output: `Current model: ${context.model}`,
        success: true,
      };
    }

    return {
      output: `Model switched to: ${newModel}`,
      success: true,
      newModel,
    };
  },
};
