import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

const todoItemSchema = z.object({
  content: z.string().describe("Description of the todo item"),
  status: z
    .enum(["pending", "in_progress", "completed"])
    .describe("Current status of the todo item"),
});

const paramSchema = z.object({
  todos: z
    .array(todoItemSchema)
    .min(1)
    .describe("Complete list of todo items. Exactly one item must have status 'in_progress'."),
});

type TodoItem = z.infer<typeof todoItemSchema>;
type Params = z.infer<typeof paramSchema>;

/** Session-scoped in-memory todo state */
let currentTodos: readonly TodoItem[] = [];

/** Read current todo state (for testing or external access) */
export function getTodos(): readonly TodoItem[] {
  return currentTodos;
}

/** Reset todo state (for testing) */
export function resetTodos(): void {
  currentTodos = [];
}

const STATUS_INDICATORS: Readonly<Record<TodoItem["status"], string>> = {
  completed: "\u2713",
  in_progress: "\u2192",
  pending: " ",
};

function formatTodoList(todos: readonly TodoItem[]): string {
  const lines = todos.map(
    (item, i) => `${i + 1}. [${STATUS_INDICATORS[item.status]}] ${item.content}`,
  );
  return `Todo List Updated:\n${lines.join("\n")}`;
}

async function execute(params: Params, _context: ToolContext): Promise<ToolResult> {
  const { todos } = params;

  // Validate: exactly one item must be in_progress
  const inProgressCount = todos.filter((t) => t.status === "in_progress").length;
  if (inProgressCount !== 1) {
    return {
      output: `Validation error: exactly one todo must have status 'in_progress', but found ${inProgressCount}.`,
      isError: true,
    };
  }

  // Update in-memory state
  currentTodos = Object.freeze(todos.map((t) => ({ ...t })));

  return {
    output: formatTodoList(currentTodos),
    isError: false,
    metadata: {
      total: currentTodos.length,
      completed: currentTodos.filter((t) => t.status === "completed").length,
      inProgress: 1,
      pending: currentTodos.filter((t) => t.status === "pending").length,
    },
  };
}

export const todoWriteTool: ToolDefinition<Params> = {
  name: "todo_write",
  description:
    "Track and update a todo list for the current task. Use this to break down complex tasks into steps and track progress. The full list must be provided each time. Exactly one item must be 'in_progress' at any time.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 5_000,
  execute,
};
