import { Box, Text } from "ink";
import { type Task, type TaskStatus } from "../../core/task-manager.js";

/** Status indicator colors */
const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "gray",
  in_progress: "yellow",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

/** Status indicator symbols */
const STATUS_SYMBOLS: Record<TaskStatus, string> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
  failed: "✕",
  cancelled: "⊘",
};

interface TaskItemProps {
  readonly task: Task;
  readonly depth: number;
  readonly children?: readonly Task[];
}

/** Render a single task item with indentation */
function TaskItem({ task, depth, children }: TaskItemProps) {
  const indent = "  ".repeat(depth);
  const symbol = STATUS_SYMBOLS[task.status];
  const color = STATUS_COLORS[task.status];

  return (
    <Box flexDirection="column">
      <Box>
        <Text>
          {indent}
          <Text color={color}>{symbol}</Text>{" "}
          <Text bold={task.status === "in_progress"}>{task.title}</Text>
          <Text color="gray"> [{task.status}]</Text>
          {task.description ? <Text color="gray"> — {task.description}</Text> : null}
        </Text>
      </Box>
      {children?.map((child) => <TaskItem key={child.id} task={child} depth={depth + 1} />)}
    </Box>
  );
}

interface TaskListViewProps {
  /** All tasks to display */
  readonly tasks: readonly Task[];
  /** Optional title for the task list */
  readonly title?: string;
}

/**
 * Task list UI component — displays tasks in a hierarchical tree view.
 * Groups tasks by parent, showing status, progress, and dependencies.
 */
export function TaskListView({ tasks, title }: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <Box marginY={1}>
        <Text color="gray">No tasks.</Text>
      </Box>
    );
  }

  // Build parent-child map
  const childMap = new Map<string | undefined, Task[]>();
  for (const task of tasks) {
    const parentKey = task.parentId;
    const existing = childMap.get(parentKey) ?? [];
    childMap.set(parentKey, [...existing, task]);
  }

  // Get root tasks (no parent)
  const rootTasks = childMap.get(undefined) ?? [];

  // Calculate summary
  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;

  return (
    <Box flexDirection="column" marginY={1}>
      {title ? (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
          <Text color="gray">
            {" "}
            ({completed}/{total} complete)
          </Text>
        </Box>
      ) : null}
      {rootTasks.map((task) => (
        <TaskItem key={task.id} task={task} depth={0} children={childMap.get(task.id)} />
      ))}
    </Box>
  );
}
