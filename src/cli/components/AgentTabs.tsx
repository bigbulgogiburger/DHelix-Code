/**
 * AgentTabs.tsx — 다중 에이전트 세션을 탭으로 표시·전환하는 컴포넌트
 *
 * 수평 탭 바를 Ink Box 기반으로 렌더링합니다.
 *
 * 시각적 규칙:
 * - 활성 탭: bright accent(#00E5FF) + bold + 하단 밑줄(underline)
 * - 비활성 탭: dimColor
 * - 읽지 않은 메시지 배지: "(3)" 형태로 탭 이름 뒤에 표시
 * - 탭 구분자: " │ "
 *
 * 접근성:
 * - 탭이 1개 이하이면 탭 바 전체를 렌더링하지 않음 (null 반환)
 * - 각 탭에 Alt+1~9 단축키 힌트 표시
 */
import React from "react";
import { Box, Text } from "ink";
import {
  formatTabLabel,
  getTabColor,
  getTabShortcut,
  type AgentTabStatus,
} from "./agent-tabs-utils.js";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

/** 탭 하나의 표시 정보 */
export interface AgentTabInfo {
  readonly id: string;
  readonly name: string;
  readonly status: AgentTabStatus;
  readonly unreadCount?: number;
}

/** AgentTabs 컴포넌트 Props */
export interface AgentTabsProps {
  /** 탭 목록 */
  readonly tabs: readonly AgentTabInfo[];
  /** 현재 활성 탭 ID */
  readonly activeTabId: string;
  /** 탭 전환 콜백 (선택적, 테스트·호환성용) */
  readonly onTabChange?: (tabId: string) => void;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

/** 탭 사이 구분자 */
const TAB_SEPARATOR = " │ ";

/** 탭 바 좌측 패딩 */
const BAR_PREFIX = " ";

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

/** 개별 탭 Props */
interface SingleTabProps {
  readonly tab: AgentTabInfo;
  readonly index: number;
  readonly isActive: boolean;
  readonly isLast: boolean;
}

/**
 * 단일 탭 항목을 렌더링합니다.
 *
 * 활성 탭은 bold + underline + bright accent 색상,
 * 비활성 탭은 dimColor 로 표시합니다.
 * 마지막 탭이 아니면 구분자(" │ ")가 뒤에 붙습니다.
 */
const SingleTab = React.memo(function SingleTab({ tab, index, isActive, isLast }: SingleTabProps) {
  const color = isActive ? getTabColor("active") : getTabColor(tab.status);
  const label = formatTabLabel(tab, index);
  const shortcut = getTabShortcut(index);

  return (
    <>
      <Text color={color} bold={isActive} dimColor={!isActive} underline={isActive}>
        {label}
      </Text>
      {shortcut !== "" && !isActive ? <Text dimColor> </Text> : null}
      {!isLast ? <Text dimColor>{TAB_SEPARATOR}</Text> : null}
    </>
  );
});

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

/**
 * 다중 에이전트 탭 바 컴포넌트
 *
 * 탭이 2개 미만이면 렌더링하지 않습니다(null 반환).
 * 각 탭은 "[인덱스] 이름 (unread)" 형태로 표시됩니다.
 *
 * @example
 * ```tsx
 * <AgentTabs
 *   tabs={[
 *     { id: "main", name: "main", status: "active" },
 *     { id: "worker-1", name: "worker-1", status: "idle", unreadCount: 3 },
 *   ]}
 *   activeTabId="main"
 *   onTabChange={(id) => console.log("switch to", id)}
 * />
 * ```
 *
 * 렌더링 결과:
 * ```
 *  [1] main │ [2] worker-1 (3)
 * ```
 */
export const AgentTabs = React.memo(function AgentTabs({ tabs, activeTabId }: AgentTabsProps) {
  // 탭이 1개 이하면 탭 바 불필요
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <Box flexDirection="row" marginBottom={1}>
      <Text dimColor>{BAR_PREFIX}</Text>
      {tabs.map((tab, index) => (
        <SingleTab
          key={tab.id}
          tab={tab}
          index={index}
          isActive={tab.id === activeTabId}
          isLast={index === tabs.length - 1}
        />
      ))}
    </Box>
  );
});
