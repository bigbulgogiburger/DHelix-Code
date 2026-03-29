/**
 * TaskListView.tsx — 작업 목록을 트리 형태로 표시하는 컴포넌트
 *
 * 에이전트의 작업(Task) 목록을 계층적 트리 뷰로 보여줍니다.
 * 각 작업의 상태(pending, in_progress, completed, failed, cancelled)를
 * 아이콘과 색상으로 구분하며, 부모-자식 관계를 들여쓰기로 표현합니다.
 *
 * 상태 아이콘: ○ 대기, ◐ 진행 중, ● 완료, ✕ 실패, ⊘ 취소
 */
import { Box, Text } from "ink";
import { type Task, type TaskStatus } from "../../core/task-manager.js";

/** 작업 상태별 표시 색상 — pending=회색, in_progress=노랑, completed=밝은시안 등 */
const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "gray",
  in_progress: "yellow",
  completed: "#00E5FF",
  failed: "red",
  cancelled: "gray",
};

/** 작업 상태별 유니코드 심볼 — 각 상태를 시각적으로 구분 */
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

/** 단일 작업 항목을 들여쓰기와 함께 렌더링 — 자식 작업은 재귀적으로 표시 */
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
 * 작업 목록 UI 컴포넌트 — 작업을 계층적 트리 뷰로 표시
 *
 * 내부적으로 parentId 기반의 부모-자식 맵을 구축하여
 * 루트 작업 → 자식 작업 순으로 재귀 렌더링합니다.
 * 상단에는 "Tasks (완료/전체 complete)" 요약을 표시합니다.
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
