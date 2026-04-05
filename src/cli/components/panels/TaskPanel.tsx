/**
 * TaskPanel.tsx — 태스크 체크리스트를 표시하는 패널 컴포넌트
 *
 * todo / in-progress / done 상태의 태스크를 체크리스트 형태로 표시합니다.
 * 상단에 전체 진행률 바를 표시하여 작업 완료 상황을 한눈에 파악할 수 있습니다.
 *
 * 상태별 표시:
 * - todo       → ○ 회색 (미착수)
 * - in-progress → ◐ 노랑 (진행 중)
 * - done        → ● 밝은 시안 (완료)
 */
import { Box, Text } from "ink";

/** 태스크의 진행 상태 */
export type TaskStatus = "todo" | "in-progress" | "done";

/** 단일 태스크 정보 */
export interface TaskInfo {
  /** 고유 식별자 */
  readonly id: string;
  /** 태스크 제목/설명 */
  readonly subject: string;
  /** 현재 상태 */
  readonly status: TaskStatus;
  /** 이 태스크를 블로킹하는 태스크 ID 목록 (선택적) */
  readonly blockedBy?: readonly string[];
}

/** 상태별 표시 색상 */
const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "gray",
  "in-progress": "yellow",
  done: "#00E5FF",
};

/** 상태별 체크박스 아이콘 */
const TASK_STATUS_ICONS: Record<TaskStatus, string> = {
  todo: "○",
  "in-progress": "◐",
  done: "●",
};

/**
 * 완료된 태스크 수와 전체 태스크 수로부터 진행률 바 문자열을 생성합니다.
 * @example formatTaskProgressBar(4, 8) → "[████░░░░] 4/8"
 */
export function formatTaskProgressBar(done: number, total: number, width: number = 8): string {
  if (total === 0) return `[${"░".repeat(width)}] 0/0`;
  const filled = Math.round((done / total) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${done}/${total}`;
}

/**
 * 태스크가 블로킹 상태인지 확인합니다.
 * blockedBy 배열이 존재하고 비어 있지 않으면 블로킹 상태입니다.
 */
export function isBlocked(task: TaskInfo): boolean {
  return Array.isArray(task.blockedBy) && task.blockedBy.length > 0;
}

/** TaskPanel 컴포넌트의 Props */
interface TaskPanelProps {
  /** 표시할 태스크 목록 */
  readonly tasks: readonly TaskInfo[];
  /** 패널 제목 (기본값: "Tasks") */
  readonly title?: string;
}

/**
 * 태스크 체크리스트 패널 컴포넌트
 *
 * 전체 진행률 바와 함께 각 태스크의 상태를 체크리스트 형태로 표시합니다.
 * 블로킹 중인 태스크는 "blocked" 라벨을 추가로 표시합니다.
 * 태스크가 없으면 빈 상태 메시지를 보여줍니다.
 */
export function TaskPanel({ tasks, title = "Tasks" }: TaskPanelProps) {
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Text color="gray"> </Text>
        {total > 0 ? (
          <Text color="gray">{formatTaskProgressBar(doneCount, total)}</Text>
        ) : null}
      </Box>

      {tasks.length === 0 ? (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            No tasks.
          </Text>
        </Box>
      ) : (
        tasks.map((task) => {
          const color = TASK_STATUS_COLORS[task.status];
          const icon = TASK_STATUS_ICONS[task.status];
          const blocked = isBlocked(task);

          return (
            <Box key={task.id} marginBottom={0}>
              <Text color={color}>{icon} </Text>
              <Text
                bold={task.status === "in-progress"}
                strikethrough={task.status === "done"}
              >
                {task.subject}
              </Text>
              {blocked ? (
                <Text color="red"> [blocked]</Text>
              ) : null}
            </Box>
          );
        })
      )}
    </Box>
  );
}
