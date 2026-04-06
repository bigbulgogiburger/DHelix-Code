/**
 * TaskViewPanel.tsx — 작업(Task) 관리 패널 오버레이 컴포넌트
 *
 * 멀티 에이전트 작업의 진행 상황을 테이블 형태로 보여주는 패널입니다.
 * Ctrl+T로 표시/숨김을 토글할 수 있으며, 우선순위/상태별 정렬,
 * 진행률 요약 등을 제공합니다.
 *
 * 이 파일에는 다음이 포함됩니다:
 * - 표시용 타입 정의 (TaskDisplayItem, TaskViewOptions, TaskStats)
 * - 상수 정의 (아이콘, 색상, 우선순위, 정렬 가중치)
 * - 헬퍼 함수 (정렬, 통계, 아이콘/색상 조회)
 * - 서브 컴포넌트 (TaskRow, TaskSummaryBar)
 * - 메인 패널 컴포넌트 (TaskViewPanel)
 */
import React, { useMemo } from "react";
import { Box, Text } from "ink";

// ─── 표시용 타입 정의 ──────────────────────────────────────────────────────

/** 표시용으로 간소화된 작업 데이터 */
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

/** 작업 정렬 및 필터링 옵션 */
export interface TaskViewOptions {
  readonly sortBy: "priority" | "status" | "created";
  readonly filterStatus?: string;
  readonly showCompleted: boolean;
}

/** 집계된 작업 통계 — 전체, 완료, 실행 중, 대기, 차단, 실패, 취소 각각의 수 */
export interface TaskStats {
  readonly total: number;
  readonly completed: number;
  readonly running: number;
  readonly pending: number;
  readonly blocked: number;
  readonly failed: number;
  readonly cancelled: number;
}

// ─── 상수 정의 ──────────────────────────────────────────────────────────────

/** 상태별 아이콘 — TeammateStatus 컴포넌트와 동일한 규칙 사용 */
const STATUS_ICONS: Readonly<Record<string, string>> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
  failed: "✕",
  blocked: "⊘",
  cancelled: "⊘",
};

/** 상태별 색상 — TeammateStatus 컴포넌트와 동일한 규칙 사용 */
const STATUS_COLORS: Readonly<Record<string, string>> = {
  pending: "gray",
  in_progress: "yellow",
  completed: "#00E5FF",
  failed: "red",
  blocked: "#0097A7",
  cancelled: "gray",
};

/** 우선순위별 별 표시 (높을수록 별이 많음) — critical=★★★★, high=★★★ */
const PRIORITY_STARS: Readonly<Record<string, string>> = {
  critical: "★★★★",
  high: "★★★",
  medium: "★★",
  low: "★",
};

/** 우선순위별 색상 — critical=빨강, high=노랑, medium=시안, low=회색 */
const PRIORITY_COLORS: Readonly<Record<string, string>> = {
  critical: "red",
  high: "yellow",
  medium: "cyan",
  low: "gray",
};

/** 우선순위 기반 정렬용 가중치 (숫자가 작을수록 높은 우선순위) */
const PRIORITY_WEIGHT: Readonly<Record<string, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** 상태 기반 정렬용 가중치 (숫자가 작을수록 목록 앞에 표시) */
const STATUS_WEIGHT: Readonly<Record<string, number>> = {
  in_progress: 0,
  pending: 1,
  blocked: 2,
  failed: 3,
  completed: 4,
  cancelled: 5,
};

/** 제목 최대 길이 — 이를 초과하면 말줄임(…)으로 자름 */
const MAX_TITLE_LENGTH = 40;

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────

/** 상태에 해당하는 아이콘 문자를 반환 */
export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] ?? "?";
}

/** 상태에 해당하는 Ink 색상명을 반환 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "gray";
}

/** 우선순위에 해당하는 별 문자열을 반환 */
export function getPriorityStars(priority: string): string {
  return PRIORITY_STARS[priority] ?? "★";
}

/** 우선순위에 해당하는 Ink 색상명을 반환 */
export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] ?? "gray";
}

/**
 * 지정된 기준으로 작업을 정렬합니다.
 * - "priority": critical → high → medium → low 순
 * - "status": in_progress → pending → blocked → failed → completed → cancelled 순
 * - "created": 원래 순서 유지 (안정 정렬)
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

/** 작업 목록에서 상태별 집계 통계를 계산 */
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

/** 제목을 최대 길이로 자르고, 초과 시 말줄임(…) 추가 */
export function truncateTitle(title: string, maxLength: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength - 1) + "…";
}

/** 상태 키를 사람이 읽기 쉬운 레이블로 변환 — "in_progress" → "running" */
function formatStatusLabel(status: string): string {
  if (status === "in_progress") return "running";
  return status;
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────

interface TaskRowProps {
  readonly task: TaskDisplayItem;
}

/** 단일 작업 행을 렌더링 — 우선순위(★), 상태(아이콘), 제목, 담당자를 가로로 배치 */
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

/** 상태별 작업 수를 요약하는 바 — "5/10 complete | 2 running | 1 failed" */
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

// ─── 메인 패널 ─────────────────────────────────────────────────────────────

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
 * 토글 가능한 오버레이 패널 — SharedTaskList의 내용을 표시합니다.
 *
 * 키보드 연동 참고:
 * - Ctrl+T로 표시/숨김 토글 (부모 컴포넌트 App.tsx에서 처리)
 * - 이 컴포넌트 자체는 키보드 입력을 처리하지 않습니다.
 * - 부모에서 `taskViewVisible` 상태를 관리해야 합니다.
 *
 * 표시 구조: 헤더 → 열 제목 → 구분선 → 작업 행들 → 요약 바 → 안내문
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
    <Box flexDirection="column" borderStyle="single" borderColor="#0097A7" paddingX={1} paddingY={0}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
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
