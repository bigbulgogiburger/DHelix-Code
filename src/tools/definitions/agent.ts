import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { type LLMProvider } from "../../llm/provider.js";
import { type ToolCallStrategy } from "../../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../registry.js";
import { type AppEventEmitter } from "../../utils/events.js";
import { spawnSubagent, type SubagentType } from "../../subagents/spawner.js";

const paramSchema = z.object({
  prompt: z.string().describe("The task or question for the subagent to work on"),
  description: z
    .string()
    .describe("Brief human-readable description of this subagent's purpose"),
  subagent_type: z
    .enum(["explore", "plan", "general"])
    .describe(
      "Type of subagent: 'explore' for codebase investigation, 'plan' for implementation planning, 'general' for task execution",
    ),
  run_in_background: z
    .boolean()
    .optional()
    .describe("Run subagent in background, returns immediately with agent ID"),
  isolation: z
    .enum(["worktree"])
    .optional()
    .describe("Isolation mode: 'worktree' creates a git worktree for file-safe isolation"),
  resume: z
    .string()
    .optional()
    .describe("Resume from a previous subagent by providing its agent ID"),
  allowed_tools: z
    .array(z.string())
    .optional()
    .describe("Restrict subagent to only these tool names"),
});

type Params = z.infer<typeof paramSchema>;

/** Dependencies required to create the agent tool */
export interface AgentToolDeps {
  readonly client: LLMProvider;
  readonly model: string;
  readonly strategy: ToolCallStrategy;
  readonly toolRegistry: ToolRegistry;
  readonly events?: AppEventEmitter;
}

/**
 * Create the agent tool definition with injected dependencies.
 * Uses a factory pattern because spawnSubagent requires LLM client,
 * strategy, and tool registry which are not part of the standard ToolContext.
 */
export function createAgentTool(deps: AgentToolDeps): ToolDefinition<Params> {
  async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
    const subagentType: SubagentType = params.subagent_type;

    try {
      const result = await spawnSubagent({
        type: subagentType,
        prompt: params.prompt,
        client: deps.client,
        model: deps.model,
        strategy: deps.strategy,
        toolRegistry: deps.toolRegistry,
        workingDirectory: context.workingDirectory,
        signal: context.abortSignal,
        parentEvents: deps.events,
        allowedTools: params.allowed_tools,
        run_in_background: params.run_in_background,
        isolation: params.isolation,
        resume: params.resume,
      });

      return {
        output: result.response,
        isError: false,
        metadata: {
          agentId: result.agentId,
          type: result.type,
          iterations: result.iterations,
          aborted: result.aborted,
          workingDirectory: result.workingDirectory,
          description: params.description,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Agent (${subagentType}) failed: ${message}`,
        isError: true,
        metadata: {
          type: subagentType,
          description: params.description,
        },
      };
    }
  }

  return {
    name: "agent",
    description:
      "Spawn a subagent to perform a task in an isolated context. Use 'explore' for codebase investigation, 'plan' for implementation planning, 'general' for task execution. The subagent runs its own agent loop with access to tools and returns its findings.",
    parameterSchema: paramSchema,
    permissionLevel: "confirm",
    execute,
  };
}
