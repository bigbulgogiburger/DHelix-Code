import { type SlashCommand, type CommandResult } from "../commands/registry.js";
import { type SkillManager } from "./manager.js";

/**
 * Create slash commands from user-invocable skills.
 * Each skill with `userInvocable: true` (the default) becomes a `/name` command.
 *
 * When invoked, the skill body is interpolated and returned as a prompt
 * that the agent loop injects as a user message.
 */
export function createSkillCommands(skillManager: SkillManager): readonly SlashCommand[] {
  const invocable = skillManager.getUserInvocable();
  const commands: SlashCommand[] = [];

  for (const skill of invocable) {
    const { name, description, argumentHint } = skill.frontmatter;

    commands.push({
      name,
      description: `[skill] ${description}`,
      usage: `/${name}${argumentHint ? ` ${argumentHint}` : ""}`,

      async execute(args: string, commandContext): Promise<CommandResult> {
        const result = await skillManager.execute(name, args, {
          sessionId: commandContext.sessionId,
          workingDirectory: commandContext.workingDirectory,
        });

        if (!result) {
          return {
            output: `Skill '${name}' failed to execute.`,
            success: false,
          };
        }

        if (result.fork) {
          // For forked skills, emit an event that the agent loop can handle
          commandContext.emit("skill:fork", {
            prompt: result.prompt,
            model: result.model,
            agentType: result.agentType,
            allowedTools: result.allowedTools,
          });
          return {
            output: `Skill '${name}' launched as ${result.agentType ?? "general"} subagent.`,
            success: true,
          };
        }

        // For inline skills, return the prompt as output.
        // The agent loop's handleSubmit will see shouldInjectAsUserMessage
        // and send it through the LLM instead of displaying it.
        return {
          output: result.prompt,
          success: true,
          shouldInjectAsUserMessage: true,
          modelOverride: result.model,
        };
      },
    });
  }

  return commands;
}
