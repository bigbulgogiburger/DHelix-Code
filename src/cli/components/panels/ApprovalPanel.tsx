/**
 * ApprovalPanel.tsx — 승인 대기 중인 도구 호출 목록을 표시하는 패널 컴포넌트
 *
 * 에이전트가 실행 권한을 요청하는 도구 호출 목록을 최신순으로 표시합니다.
 * 각 항목에 대기 시간을 표시하여 사용자가 우선순위를 파악할 수 있도록 합니다.
 *
 * 표시 정보:
 * - 도구 이름 (toolName)
 * - 실행 명령/인수 (command)
 * - 대기 시간 (timestamp 기반 계산)
 */
import { Box, Text } from "ink";

/** 승인 대기 중인 단일 도구 호출 정보 */
export interface ApprovalInfo {
  /** 고유 식별자 */
  readonly id: string;
  /** 승인을 요청하는 도구 이름 (예: "bash_exec", "file_write") */
  readonly toolName: string;
  /** 실행하려는 명령 또는 인수 요약 */
  readonly command: string;
  /** 요청이 생성된 Unix 타임스탬프 (밀리초) */
  readonly timestamp: number;
}

/**
 * 현재 시각과 timestamp의 차이를 사람이 읽기 좋은 대기 시간 문자열로 변환합니다.
 * @example formatWaitTime(Date.now() - 65000) → "1m 5s ago"
 * @example formatWaitTime(Date.now() - 5000)  → "5s ago"
 */
export function formatWaitTime(timestamp: number, now: number = Date.now()): string {
  const elapsedMs = now - timestamp;
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));

  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  return secs > 0 ? `${mins}m ${secs}s ago` : `${mins}m ago`;
}

/**
 * 승인 항목 목록을 최신순(timestamp 내림차순)으로 정렬합니다.
 * 원본 배열을 변경하지 않고 새 배열을 반환합니다.
 */
export function sortApprovalsByNewest(approvals: readonly ApprovalInfo[]): readonly ApprovalInfo[] {
  return [...approvals].sort((a, b) => b.timestamp - a.timestamp);
}

/** ApprovalPanel 컴포넌트의 Props */
interface ApprovalPanelProps {
  /** 표시할 승인 대기 항목 목록 */
  readonly approvals: readonly ApprovalInfo[];
  /** 패널 제목 (기본값: "Pending Approvals") */
  readonly title?: string;
  /** 대기 시간 계산 기준 시각 (테스트 목적 — 기본값: Date.now()) */
  readonly now?: number;
}

/**
 * 승인 대기 목록 패널 컴포넌트
 *
 * 도구 호출 권한 요청 목록을 최신순으로 정렬하여 표시합니다.
 * 각 항목은 도구 이름(노랑), 명령 요약(회색), 대기 시간(빨강)으로 구성됩니다.
 * 승인 대기 항목이 없으면 빈 상태 메시지를 보여줍니다.
 */
export function ApprovalPanel({
  approvals,
  title = "Pending Approvals",
  now = Date.now(),
}: ApprovalPanelProps) {
  const sorted = sortApprovalsByNewest(approvals);

  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          {title}
        </Text>
        {approvals.length > 0 ? (
          <Text color="red" bold>
            {" "}
            ({approvals.length})
          </Text>
        ) : (
          <Text color="gray"> (0)</Text>
        )}
      </Box>

      {sorted.length === 0 ? (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            No pending approvals.
          </Text>
        </Box>
      ) : (
        sorted.map((approval) => (
          <Box key={approval.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color="yellow" bold>
                ⚠ {approval.toolName}
              </Text>
              <Text color="red" dimColor>
                {" "}
                {formatWaitTime(approval.timestamp, now)}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray">{approval.command}</Text>
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}
