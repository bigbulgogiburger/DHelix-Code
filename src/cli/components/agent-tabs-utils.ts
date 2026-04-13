/**
 * agent-tabs-utils.ts — Agent tab UI 유틸리티 (순수 함수, React 무관)
 *
 * AgentTabs 컴포넌트에서 사용하는 순수 함수 모음입니다.
 * - 단축키 매핑: Alt+1..Alt+9
 * - 탭 라벨 포매팅: "[1] explore (3)" 형태
 */

/** 에이전트 탭의 상태 값 */
export type AgentTabStatus = "active" | "idle" | "completed" | "error";

/** 탭 라벨 포매팅에 필요한 최소 정보 */
export interface TabLabelInfo {
  readonly id: string;
  readonly name: string;
  readonly status: AgentTabStatus;
  readonly unreadCount?: number;
}

/** 최대 단축키 지원 탭 인덱스 (Alt+1..Alt+9) */
const MAX_SHORTCUT_INDEX = 9;

/**
 * 탭 인덱스(0-based)에 대응하는 단축키 문자열을 반환합니다.
 *
 * - 인덱스 0–8 → "Alt+1" ~ "Alt+9"
 * - 인덱스 9 이상 → "" (단축키 없음)
 *
 * @param index - 0-based 탭 인덱스
 * @returns 단축키 문자열, 없으면 빈 문자열
 *
 * @example
 * getTabShortcut(0) // "Alt+1"
 * getTabShortcut(8) // "Alt+9"
 * getTabShortcut(9) // ""
 */
export function getTabShortcut(index: number): string {
  if (index < 0 || index >= MAX_SHORTCUT_INDEX) {
    return "";
  }
  return `Alt+${index + 1}`;
}

/**
 * 탭 상태에 따른 접두 아이콘을 반환합니다.
 *
 * - active  → ★ (현재 포커스 / 작업 중)
 * - idle    → ○ (대기 중)
 * - completed → ● (완료)
 * - error   → ✗ (오류)
 *
 * @param status - 탭 상태
 * @returns 상태 아이콘 문자
 */
export function getStatusIcon(status: AgentTabStatus): string {
  switch (status) {
    case "active":
      return "\u2605"; // ★
    case "idle":
      return "\u25CB"; // ○
    case "completed":
      return "\u25CF"; // ●
    case "error":
      return "\u2717"; // ✗
  }
}

/**
 * 탭 라벨을 "[인덱스] 이름 (unread)" 형태로 포매팅합니다.
 *
 * - unreadCount가 0이거나 undefined이면 배지를 표시하지 않습니다.
 * - 인덱스가 MAX_SHORTCUT_INDEX 이상이면 숫자 대신 "+" 를 사용합니다.
 *
 * @param tab   - 탭 정보 (id, name, status, unreadCount)
 * @param index - 0-based 탭 인덱스
 * @returns 포매팅된 라벨 문자열
 *
 * @example
 * formatTabLabel({ id: "1", name: "explore", status: "active", unreadCount: 3 }, 0)
 * // "[1] explore (3)"
 *
 * formatTabLabel({ id: "2", name: "refactor", status: "idle" }, 1)
 * // "[2] refactor"
 *
 * formatTabLabel({ id: "10", name: "test", status: "idle" }, 9)
 * // "[+] test"
 */
export function formatTabLabel(tab: TabLabelInfo, index: number): string {
  const indexLabel = index < MAX_SHORTCUT_INDEX ? `${index + 1}` : "+";
  const badge = tab.unreadCount !== undefined && tab.unreadCount > 0 ? ` (${tab.unreadCount})` : "";
  return `[${indexLabel}] ${tab.name}${badge}`;
}

/**
 * 탭 상태에 따른 Ink 색상 토큰을 반환합니다.
 *
 * - active    → "#00E5FF" (bright accent)
 * - idle      → "gray"
 * - completed → "#00BCD4" (primary)
 * - error     → "red"
 *
 * @param status - 탭 상태
 * @returns Ink 색상 문자열
 */
export function getTabColor(status: AgentTabStatus): string {
  switch (status) {
    case "active":
      return "#00E5FF";
    case "idle":
      return "gray";
    case "completed":
      return "#00BCD4";
    case "error":
      return "red";
  }
}
