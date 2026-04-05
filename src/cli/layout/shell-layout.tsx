/**
 * shell-layout.tsx — 구조화된 Shell Layout 컨테이너 컴포넌트
 *
 * App.tsx에 혼합된 flat layout 로직을 슬롯(slot) 기반의 구조화된
 * 레이아웃으로 분리합니다. Ink Box의 flexDirection: "column"을 사용하여
 * header, transcript, prompt, footer를 수직으로 배치합니다.
 *
 * 설계 원칙:
 * - 각 slot은 독립적으로 re-render 가능 (React.memo boundary)
 * - transcript 영역은 flexGrow=1로 남은 공간을 차지
 * - prompt는 하단에 고정
 * - footer(상태바)는 최하단에 위치
 * - useStdout()로 터미널 크기를 감지하여 반응형 대응
 *
 * 아키텍처 위치: CLI Layer (Layer 1)
 * 참조: docs/revolution/04-cli-ux-ui-and-gui-plan.md §3.A
 *
 * @module layout/shell-layout
 */
import React, { useMemo } from "react";
import { Box, useStdout } from "ink";

/**
 * ShellLayout에 배치할 콘텐츠 슬롯 정의
 *
 * 각 슬롯은 독립적인 React 노드를 받아서 수직 레이아웃의
 * 정해진 위치에 배치합니다. header와 footer는 선택적이며,
 * transcript와 prompt는 필수입니다.
 *
 * @property header - 선택적 헤더 영역 (모델명, 토큰 카운트 등)
 * @property transcript - 스크롤 가능한 메시지/활동 피드 영역 (필수)
 * @property prompt - 하단 고정 사용자 입력 영역 (필수)
 * @property footer - 최하단 상태바 영역 (선택적)
 */
export interface ShellLayoutSlots {
  readonly header?: React.ReactNode;
  readonly transcript: React.ReactNode;
  readonly prompt: React.ReactNode;
  readonly footer?: React.ReactNode;
}

/**
 * ShellLayout 컴포넌트의 Props
 *
 * @property slots - 각 레이아웃 영역에 배치할 콘텐츠
 * @property padding - 외부 패딩 (기본값: 1)
 */
export interface ShellLayoutProps {
  readonly slots: ShellLayoutSlots;
  readonly padding?: number;
}

/**
 * 터미널 크기 정보
 *
 * @property columns - 터미널 가로 문자 수
 * @property rows - 터미널 세로 줄 수
 */
export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

/**
 * 터미널 크기를 기반으로 레이아웃 메트릭을 계산합니다.
 *
 * header와 footer가 존재하는 경우 각각 고정 높이를 차감하여
 * transcript에 할당 가능한 최소 높이를 결정합니다.
 * 패딩도 고려합니다.
 *
 * @param terminalRows - 터미널 세로 줄 수
 * @param hasHeader - 헤더 슬롯 존재 여부
 * @param hasFooter - 푸터 슬롯 존재 여부
 * @param padding - 외부 패딩 값
 * @returns transcript 영역의 최소 높이 (줄 수)
 */
export function computeTranscriptMinHeight(
  terminalRows: number,
  hasHeader: boolean,
  hasFooter: boolean,
  padding: number,
): number {
  // 고정 영역: prompt (최소 2줄) + padding * 2 (상하)
  const promptHeight = 2;
  const paddingTotal = padding * 2;
  const headerHeight = hasHeader ? 3 : 0;
  const footerHeight = hasFooter ? 3 : 0;

  const fixedHeight = promptHeight + paddingTotal + headerHeight + footerHeight;
  const available = terminalRows - fixedHeight;

  // 최소 3줄은 확보
  return Math.max(3, available);
}

/**
 * 터미널 크기를 안전하게 읽어오는 헬퍼
 *
 * useStdout()가 undefined를 반환할 수 있으므로
 * 기본값(80x24)으로 폴백합니다.
 *
 * @param stdout - useStdout()의 반환값
 * @returns 터미널 크기 객체
 */
export function getTerminalSize(stdout: NodeJS.WriteStream | undefined): TerminalSize {
  return {
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  };
}

/**
 * Header 슬롯 래퍼 — React.memo로 불필요한 리렌더 방지
 *
 * header가 없으면 null을 반환합니다.
 */
const HeaderSlot = React.memo(function HeaderSlot({
  children,
}: {
  readonly children?: React.ReactNode;
}) {
  if (!children) {
    return null;
  }
  return (
    <Box flexDirection="column" flexShrink={0}>
      {children}
    </Box>
  );
});

/**
 * Transcript 슬롯 래퍼 — flexGrow=1로 남은 공간을 차지
 *
 * React.memo로 감싸서 다른 슬롯이 변경되어도
 * transcript가 불필요하게 리렌더되지 않도록 합니다.
 */
const TranscriptSlot = React.memo(function TranscriptSlot({
  children,
  minHeight,
}: {
  readonly children: React.ReactNode;
  readonly minHeight: number;
}) {
  return (
    <Box flexDirection="column" flexGrow={1} minHeight={minHeight}>
      {children}
    </Box>
  );
});

/**
 * Prompt 슬롯 래퍼 — 하단 고정 (flexShrink=0)
 *
 * 입력 영역은 항상 표시되어야 하므로 축소되지 않습니다.
 */
const PromptSlot = React.memo(function PromptSlot({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <Box flexDirection="column" flexShrink={0} marginTop={1}>
      {children}
    </Box>
  );
});

/**
 * Footer 슬롯 래퍼 — 최하단 상태바 (flexShrink=0)
 *
 * footer가 없으면 null을 반환합니다.
 */
const FooterSlot = React.memo(function FooterSlot({
  children,
}: {
  readonly children?: React.ReactNode;
}) {
  if (!children) {
    return null;
  }
  return (
    <Box flexDirection="column" flexShrink={0}>
      {children}
    </Box>
  );
});

/**
 * ShellLayout — 구조화된 터미널 레이아웃 컨테이너
 *
 * Ink Box 기반의 수직(column) 레이아웃을 제공합니다.
 * 4개의 슬롯(header, transcript, prompt, footer)을 수직으로 배치하며,
 * transcript 영역이 남은 공간을 차지합니다.
 *
 * 사용 예시:
 * ```tsx
 * <ShellLayout
 *   slots={{
 *     header: <HeaderBar model="gpt-4o" />,
 *     transcript: <ActivityFeed ... />,
 *     prompt: <UserInput ... />,
 *     footer: <StatusBar ... />,
 *   }}
 * />
 * ```
 *
 * @param props - ShellLayoutProps
 * @returns Ink Box 기반 레이아웃
 */
export const ShellLayout = React.memo(function ShellLayout({
  slots,
  padding = 1,
}: ShellLayoutProps) {
  const { stdout } = useStdout();
  const terminalSize = useMemo(() => getTerminalSize(stdout), [stdout]);

  const hasHeader = slots.header != null;
  const hasFooter = slots.footer != null;

  const transcriptMinHeight = useMemo(
    () => computeTranscriptMinHeight(terminalSize.rows, hasHeader, hasFooter, padding),
    [terminalSize.rows, hasHeader, hasFooter, padding],
  );

  return (
    <Box flexDirection="column" padding={padding} width={terminalSize.columns}>
      <HeaderSlot>{slots.header}</HeaderSlot>
      <TranscriptSlot minHeight={transcriptMinHeight}>{slots.transcript}</TranscriptSlot>
      <PromptSlot>{slots.prompt}</PromptSlot>
      <FooterSlot>{slots.footer}</FooterSlot>
    </Box>
  );
});
