/**
 * transcript-frame.tsx — 스크롤 가능한 메시지 컨테이너 컴포넌트
 *
 * transcript(대화/활동 피드) 영역을 래핑하여 auto-scroll 동작과
 * 스크롤 상태 추적을 제공합니다. 새 메시지가 추가되면 자동으로
 * 하단으로 스크롤됩니다.
 *
 * Ink의 터미널 환경에서는 진정한 스크롤이 불가하므로,
 * children의 개수 변화를 감지하여 "isAtBottom" 상태를 관리하고,
 * overflow="hidden"으로 컨텐츠를 클리핑합니다.
 *
 * 아키텍처 위치: CLI Layer (Layer 1)
 *
 * @module layout/transcript-frame
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useStdout } from "ink";
import { getTerminalSize } from "./shell-layout.js";

/**
 * TranscriptFrame 컴포넌트의 Props
 *
 * @property children - 스크롤 영역 안에 렌더링할 콘텐츠
 * @property autoScroll - 자동 스크롤 활성화 여부 (기본값: true)
 * @property minHeight - 최소 높이 (줄 수, 기본값: 5)
 * @property onScrollStateChange - 스크롤 상태가 변경될 때 호출되는 콜백
 */
export interface TranscriptFrameProps {
  readonly children: React.ReactNode;
  readonly autoScroll?: boolean;
  readonly minHeight?: number;
  readonly onScrollStateChange?: (isAtBottom: boolean) => void;
}

/**
 * 스크롤 상태 정보
 *
 * @property isAtBottom - 현재 스크롤이 하단에 있는지 여부
 * @property childCount - 현재 children의 렌더 키 수 (변화 감지용)
 */
export interface ScrollState {
  readonly isAtBottom: boolean;
  readonly childCount: number;
}

/**
 * 초기 스크롤 상태 — 항상 하단에서 시작
 */
export function createInitialScrollState(): ScrollState {
  return {
    isAtBottom: true,
    childCount: 0,
  };
}

/**
 * TranscriptFrame — 스크롤 가능한 메시지 영역 래퍼
 *
 * children을 래핑하는 Box로, 다음 기능을 제공합니다:
 * - flexGrow=1로 부모의 남은 공간을 차지
 * - overflow="hidden"으로 넘치는 콘텐츠를 클리핑
 * - 새 콘텐츠 추가 시 자동 스크롤 상태 추적
 * - onScrollStateChange 콜백으로 외부에 스크롤 상태 전달
 *
 * 사용 예시:
 * ```tsx
 * <TranscriptFrame autoScroll={true}>
 *   <ActivityFeed completedTurns={turns} ... />
 * </TranscriptFrame>
 * ```
 *
 * @param props - TranscriptFrameProps
 * @returns Ink Box 기반 스크롤 컨테이너
 */
export const TranscriptFrame = React.memo(function TranscriptFrame({
  children,
  autoScroll = true,
  minHeight = 5,
  onScrollStateChange,
}: TranscriptFrameProps) {
  const { stdout } = useStdout();
  const terminalSize = getTerminalSize(stdout);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevChildrenRef = useRef(children);

  // 새 콘텐츠가 추가되면 auto-scroll 상태를 업데이트
  useEffect(() => {
    if (children !== prevChildrenRef.current) {
      prevChildrenRef.current = children;
      if (autoScroll) {
        setIsAtBottom(true);
      }
    }
  }, [children, autoScroll]);

  // 스크롤 상태 변경을 외부에 알림
  const handleScrollStateChange = useCallback(
    (newIsAtBottom: boolean) => {
      setIsAtBottom(newIsAtBottom);
      onScrollStateChange?.(newIsAtBottom);
    },
    [onScrollStateChange],
  );

  // isAtBottom이 변경될 때 콜백 호출
  useEffect(() => {
    handleScrollStateChange(isAtBottom);
  }, [isAtBottom, handleScrollStateChange]);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      minHeight={minHeight}
      width={terminalSize.columns > 2 ? terminalSize.columns - 2 : terminalSize.columns}
      overflowY="hidden"
    >
      {children}
    </Box>
  );
});
