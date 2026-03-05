import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

const paramSchema = z.object({
  question: z.string().describe("Question to ask the user"),
  choices: z
    .array(z.string())
    .optional()
    .describe("Optional list of choices for the user to pick from"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, _context: ToolContext): Promise<ToolResult> {
  // In the CLI context, this tool emits an event that the UI handles.
  // The actual user interaction happens asynchronously through the UI layer.
  // For now, return a placeholder that the agent loop will handle specially.
  const choicesText = params.choices
    ? `\nChoices: ${params.choices.map((c, i) => `[${i + 1}] ${c}`).join(", ")}`
    : "";

  return {
    output: `[AWAITING_USER_INPUT] ${params.question}${choicesText}`,
    isError: false,
    metadata: { question: params.question, choices: params.choices },
  };
}

export const askUserTool: ToolDefinition<Params> = {
  name: "ask_user",
  description:
    "Ask the user a question. Use this when you need clarification, want to confirm an action, or need the user to make a decision.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 300_000, // 5 minutes — user might take time
  execute,
};
