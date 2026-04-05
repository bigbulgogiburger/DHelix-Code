/**
 * JobPanel.tsx — 현재 실행 중인 에이전트 작업 상태를 표시하는 패널 컴포넌트
 *
 * 에이전트가 수행 중인 작업(Job)의 상태, 진행률, 경과 시간을 표시합니다.
 * 상태별로 다른 색상과 아이콘을 사용하여 직관적인 시각화를 제공합니다.
 *
 * 상태별 색상:
 * - running  → cyan (실행 중)
 * - completed → green (완료)
 * - failed   → red (실패)
 * - pending  → dim gray (대기 중)
 */
import { Box, Text } from "ink";

/** 에이전트 작업의 현재 상태 */
export type JobStatus = "running" | "completed" | "failed" | "pending";

/** 단일 에이전트 작업 정보 */
export interface JobInfo {
  /** 고유 식별자 */
  readonly id: string;
  /** 작업 이름/제목 */
  readonly name: string;
  /** 현재 상태 */
  readonly status: JobStatus;
  /** 진행률 (0~100, 선택적) */
  readonly progress?: number;
  /** 경과 시간 (초 단위, 선택적) */
  readonly duration?: number;
}

/** 상태별 표시 색상 토큰 */
const STATUS_COLORS: Record<JobStatus, string> = {
  running: "cyan",
  completed: "green",
  failed: "red",
  pending: "gray",
};

/** 상태별 유니코드 아이콘 */
const STATUS_ICONS: Record<JobStatus, string> = {
  running: "⟳",
  completed: "✓",
  failed: "✕",
  pending: "○",
};

/**
 * 초 단위 경과 시간을 사람이 읽기 좋은 문자열로 변환합니다.
 * @example formatDuration(65) → "1m 5s"
 * @example formatDuration(30) → "30s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * 진행률 바 문자열을 생성합니다.
 * @example formatProgressBar(50, 10) → "[█████░░░░░]"
 */
export function formatProgressBar(progress: number, width: number = 10): string {
  const clamped = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${clamped}%`;
}

/** JobPanel 컴포넌트의 Props */
interface JobPanelProps {
  /** 표시할 에이전트 작업 목록 */
  readonly jobs: readonly JobInfo[];
  /** 패널 제목 (기본값: "Jobs") */
  readonly title?: string;
}

/**
 * 에이전트 작업 목록을 표시하는 패널 컴포넌트
 *
 * 각 작업의 상태 아이콘, 이름, 진행률, 경과 시간을 한 줄로 표시합니다.
 * 작업이 없으면 빈 상태 메시지를 보여줍니다.
 */
export function JobPanel({ jobs, title = "Jobs" }: JobPanelProps) {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Text color="gray"> ({jobs.length})</Text>
      </Box>

      {jobs.length === 0 ? (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            No active jobs.
          </Text>
        </Box>
      ) : (
        jobs.map((job) => {
          const color = STATUS_COLORS[job.status];
          const icon = STATUS_ICONS[job.status];

          return (
            <Box key={job.id} flexDirection="column" marginBottom={0}>
              <Box>
                <Text color={color}>{icon} </Text>
                <Text bold={job.status === "running"}>{job.name}</Text>
                {job.duration !== undefined ? (
                  <Text color="gray"> [{formatDuration(job.duration)}]</Text>
                ) : null}
              </Box>
              {job.progress !== undefined && job.status === "running" ? (
                <Box marginLeft={2}>
                  <Text color="cyan" dimColor>
                    {formatProgressBar(job.progress)}
                  </Text>
                </Box>
              ) : null}
            </Box>
          );
        })
      )}
    </Box>
  );
}
