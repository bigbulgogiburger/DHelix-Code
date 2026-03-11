import React, { useMemo } from "react";
import { Box, Text } from "ink";

// ─── Display Types ──────────────────────────────────────────────────────────

/** Simplified task data for display */
export interface TaskDisplayItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly assignedTo?: string;
  readonly dependsOn?: readonly string[];
  readonly elapsed?: number;
  readonly results?: string;
}

/** Task sorting and filtering options */
export interface TaskViewOptions {
  readonly sortBy: "priority" | "status" | "created";
  readonly filterStatus?: string;
  readonly showCompleted: boolean;
}

/** Aggregated task statistics */
export interface TaskStats {
  readonly total: number;
  readonly completed: number;
  readonly running: number;
  readonly pending: number;
  readonly blocked: number;
  readonly failed: number;
  readonly cancelled: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Status icons matching TeammateStatus conventions */
const STATUS_ICONS: Readonly<Record<string, string>> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
  failed: "✕",
  blocked: "⊘",
  cancelled: "⊘",
};

/** Status colors matching TeammateStatus conventions */
const STATUS_COLORS: Readonly<Record<string, string>> = {
  pending: "gray",
  in_progress: "yellow",
  completed: "green",
  failed: "red",
  blocked: "cyan",
  cancelled: "gray",
};

/** Priority stars (higher = more stars) */
const PRIORITY_STARS: Readonly<Record<string, string>> = {
  critical: "★★★★",
  high: "★★★",
  medium: "★★",
  low: "★",
};

/** Priority colors */
const PRIORITY_COLORS: Readonly<Record<string, string>> = {
  critical: "red",
  high: "yellow",
  medium: "blue",
  low: "gray",
};

/** Numeric weight for priority-based sorting (lower = higher priority) */
const PRIORITY_WEIGHT: Readonly<Record<string, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Numeric weight for status-based sorting (lower = earlier in list) */
const STATUS_WEIGHT: Readonly<Record<string, number>> = {
  in_progress: 0,
  pending: 1,
  blocked: 2,
  failed: 3,
  completed: 4,
  cancelled: 5,
};

/** Maximum title length before truncation */
const MAX_TITLE_LENGTH = 40;

// ─── Helper Functions ───────────────────────────────────────────────────────

/** Get the status icon character for a given status */
export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] ?? "?";
}

/** Get the ink color name for a given status */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "gray";
}

/** Get priority stars string for a given priority level */
export function getPriorityStars(priority: string): string {
  return PRIORITY_STARS[priority] ?? "★";
}

/** Get the ink color name for a given priority level */
export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] ?? "gray";
}

/**
 * Sort tasks by the specified criteria.
 * - "priority": critical first, then high, medium, low
 * - "status": in_progress first, then pending, blocked, failed, completed, cancelled
 * - "created": falls back to original order (stable sort by index)
 */
export function sortTasks(
  tasks: readonly TaskDisplayItem[],
  sortBy: string,
): readonly TaskDisplayItem[] {
  const items = [...tasks];

  if (sortBy === "priority") {
    items.sort((a, b) => {
      const wa = PRIORITY_WEIGHT[a.priority] ?? 99;
      const wb = PRIORITY_WEIGHT[b.priority] ?? 99;
      return wa - wb;
    });
  } else if (sortBy === "status") {
    items.sort((a, b) => {
      const wa = STATUS_WEIGHT[a.status] ?? 99;
      const wb = STATUS_WEIGHT[b.status] ?? 99;
      return wa - wb;
    });
  }
  // "created" or unknown sortBy: return in original order

  return items;
}

/** Compute aggregate statistics from a list of tasks */
export function getTaskStats(tasks: readonly TaskDisplayItem[]): TaskStats {
  let completed = 0;
  let running = 0;
  let pending = 0;
  let blocked = 0;
  let failed = 0;
  let cancelled = 0;

  for (const task of tasks) {
    switch (task.status) {
      case "completed":
        completed++;
        break;
      case "in_progress":
        running++;
        break;
      case "pending":
        pending++;
        break;
      case "blocked":
        blocked++;
        break;
      case "failed":
        failed++;
        break;
      case "cancelled":
        cancelled++;
        break;
      // Unknown statuses are silently ignored in stats
    }
  }

  return {
    total: tasks.length,
    completed,
    running,
    pending,
    blocked,
    failed,
    cancelled,
  };
}

/** Truncate a title to the maximum length, appending ellipsis if needed */
export function truncateTitle(title: string, maxLength: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength - 1) + "…";
}

/** Format a human-readable status label from the status key */
function formatStatusLabel(status: string): string {
  if (status === "in_progress") return "running";
  return status;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

interface TaskRowProps {
  readonly task: TaskDisplayItem;
}

/** Renders a single task row with priority, status, title, and assignment */
export const TaskRow = React.memo(function TaskRow({ task }: TaskRowProps) {
  const stars = getPriorityStars(task.priority);
  const priorityColor = getPriorityColor(task.priority);
  const icon = getStatusIcon(task.status);
  const statusColor = getStatusColor(task.status);
  const statusLabel = formatStatusLabel(task.status);
  const title = truncateTitle(task.title);
  const isBold = task.status === "in_progress";

  return (
    <Box>
      <Box width={8}>
        <Text color={priorityColor} bold={task.priority === "critical"}>
          {stars}
        </Text>
      </Box>
      <Box width={14}>
        <Text color={statusColor} bold={isBold}>
          {icon} {statusLabel}
        </Text>
      </Box>
      <Box width={MAX_TITLE_LENGTH + 2}>
        <Text bold={isBold}>{title}</Text>
      </Box>
      {task.assignedTo ? (
        <Box>
          <Text color="cyan">{task.assignedTo}</Text>
        </Box>
      ) : null}
      {task.dependsOn && task.dependsOn.length > 0 ? (
        <Box marginLeft={1}>
          <Text dimColor>[deps: {task.dependsOn.length}]</Text>
        </Box>
      ) : null}
    </Box>
  );
});

interface TaskSummaryBarProps {
  readonly stats: TaskStats;
}

/** Renders a summary bar showing task counts by status */
export const TaskSummaryBar = React.memo(function TaskSummaryBar({ stats }: TaskSummaryBarProps) {
  const parts: string[] = [`${stats.completed}/${stats.total} complete`];

  if (stats.running > 0) {
    parts.push(`${stats.running} running`);
  }
  if (stats.blocked > 0) {
    parts.push(`${stats.blocked} blocked`);
  }
  if (stats.failed > 0) {
    parts.push(`${stats.failed} failed`);
  }
  if (stats.cancelled > 0) {
    parts.push(`${stats.cancelled} cancelled`);
  }

  return (
    <Box>
      <Text dimColor>Tasks: {parts.join(" | ")}</Text>
    </Box>
  );
});

// ─── Main Panel ─────────────────────────────────────────────────────────────

export interface TaskViewPanelProps {
  /** Whether the panel overlay is visible */
  readonly visible: boolean;
  /** Tasks to display */
  readonly tasks: readonly TaskDisplayItem[];
  /** Optional team/project name shown in the header */
  readonly teamName?: string;
  /** Called when the panel requests to close */
  readonly onClose?: () => void;
}

/**
 * Toggleable overlay panel that displays SharedTaskList contents.
 *
 * Keyboard integration notes:
 * - Ctrl+T toggles visibility (handled by the parent component, e.g. App.tsx)
 * - The parent should maintain `taskViewVisible` state:
 *   ```tsx
 *   const [taskViewVisible, setTaskViewVisible] = useState(false);
 *   // In keybinding setup:
 *   // "toggle-task-view": () => setTaskViewVisible(v => !v)
 *   ```
 * - This component itself does NOT handle keyboard input.
 */
export const TaskViewPanel = React.memo(function TaskViewPanel({
  visible,
  tasks,
  teamName,
  onClose: _onClose,
}: TaskViewPanelProps) {
  const sorted = useMemo(() => sortTasks(tasks, "priority"), [tasks]);
  const stats = useMemo(() => getTaskStats(tasks), [tasks]);

  if (!visible) {
    return null;
  }

  const headerTitle = teamName ? `Task View ─── ${teamName}` : "Task View";

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={1} paddingY={0}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="blue">
          {headerTitle}
        </Text>
      </Box>

      {tasks.length === 0 ? (
        <Box marginY={1}>
          <Text color="gray">No tasks.</Text>
        </Box>
      ) : (
        <>
          {/* Column headers */}
          <Box>
            <Box width={8}>
              <Text dimColor>Priority</Text>
            </Box>
            <Box width={14}>
              <Text dimColor>Status</Text>
            </Box>
            <Box width={MAX_TITLE_LENGTH + 2}>
              <Text dimColor>Title</Text>
            </Box>
            <Box>
              <Text dimColor>Assigned</Text>
            </Box>
          </Box>

          {/* Separator */}
          <Box>
            <Box width={8}>
              <Text dimColor>────────</Text>
            </Box>
            <Box width={14}>
              <Text dimColor>──────</Text>
            </Box>
            <Box width={MAX_TITLE_LENGTH + 2}>
              <Text dimColor>─────</Text>
            </Box>
            <Box>
              <Text dimColor>────────</Text>
            </Box>
          </Box>

          {/* Task rows */}
          {sorted.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}

          {/* Summary */}
          <Box marginTop={1}>
            <TaskSummaryBar stats={stats} />
          </Box>
        </>
      )}

      {/* Footer */}
      <Box marginTop={0}>
        <Text dimColor>Press Ctrl+T to close</Text>
      </Box>
    </Box>
  );
});
