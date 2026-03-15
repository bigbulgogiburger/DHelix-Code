/**
 * SlashCommandMenu.tsx — 슬래시 명령어 자동완성 메뉴 컴포넌트
 *
 * 사용자가 "/"를 입력하면 표시되는 자동완성 팝업 메뉴입니다.
 * 사용 가능한 슬래시 명령어를 필터링하여 보여주고,
 * 키보드로 탐색하여 선택할 수 있습니다.
 *
 * 키보드 조작:
 * - ↑/↓: 명령어 탐색
 * - Tab 또는 Enter: 선택한 명령어 실행
 * - Escape: 메뉴 닫기
 *
 * 예: "/mo" 입력 시 → /model 등 "mo"로 시작하는 명령어가 필터링됨
 */
import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { type SlashCommand } from "../../commands/registry.js";

/**
 * SlashCommandMenu 컴포넌트의 Props
 *
 * @param commands - 모든 사용 가능한 슬래시 명령어 배열
 * @param prefix - 현재 입력된 접두사 ("/" 이후의 텍스트로 명령어를 필터링)
 * @param onSelect - Tab 또는 Enter로 명령어 선택 시 호출 (명령어 이름 전달)
 * @param onClose - Escape로 메뉴 닫기 시 호출
 * @param visible - 메뉴 표시 여부
 */
export interface SlashCommandMenuProps {
  /** 모든 사용 가능한 슬래시 명령어 */
  readonly commands: readonly SlashCommand[];
  /** 명령어 필터링용 접두사 ("/" 이후 텍스트) */
  readonly prefix: string;
  /** 명령어 선택 시 콜백 */
  readonly onSelect: (name: string) => void;
  /** 메뉴 닫기 시 콜백 */
  readonly onClose: () => void;
  /** 메뉴 표시 여부 */
  readonly visible: boolean;
}

/**
 * 슬래시 명령어 자동완성 메뉴 — 키보드 탐색 + 스크롤 지원
 * 최대 6개까지 화면에 표시하고, 더 있으면 스크롤합니다.
 */
const MAX_VISIBLE = 6;

export function SlashCommandMenu({
  commands,
  prefix,
  onSelect,
  onClose,
  visible,
}: SlashCommandMenuProps) {
  const filtered = getMatchingCommands(prefix, commands);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Reset selection and scroll when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
    setScrollOffset(0);
  }, [filtered.length]);

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedIndex((prev) => {
          const next = Math.max(0, prev - 1);
          setScrollOffset((so) => Math.min(so, next));
          return next;
        });
      } else if (key.downArrow) {
        setSelectedIndex((prev) => {
          const next = Math.min(filtered.length - 1, prev + 1);
          setScrollOffset((so) => Math.max(so, next - MAX_VISIBLE + 1));
          return next;
        });
      } else if (key.tab || key.return) {
        if (filtered.length > 0) {
          onSelect(filtered[selectedIndex]!.name);
        }
      } else if (key.escape) {
        onClose();
      }
    },
    { isActive: visible && filtered.length > 0 },
  );

  if (!visible || filtered.length === 0) {
    return null;
  }

  const visibleItems = filtered.slice(scrollOffset, scrollOffset + MAX_VISIBLE);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + MAX_VISIBLE < filtered.length;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {hasMoreAbove && (
        <Text color="gray" dimColor>
          {"  ↑ more"}
        </Text>
      )}
      {visibleItems.map((cmd, idx) => {
        const actualIndex = scrollOffset + idx;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Box key={cmd.name}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected} dimColor={!isSelected}>
              {isSelected ? "▸ " : "  "}
            </Text>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected} dimColor={!isSelected}>
              {"/" + cmd.name}
            </Text>
            <Text color="gray" dimColor>
              {" — "}
            </Text>
            <Text color="gray" dimColor>
              {cmd.description}
            </Text>
          </Box>
        );
      })}
      {hasMoreBelow && (
        <Text color="gray" dimColor>
          {"  ↓ more"}
        </Text>
      )}
    </Box>
  );
}

/**
 * 사용자 입력을 기반으로 슬래시 명령어를 필터링합니다.
 * "/" 이후의 텍스트를 접두사로 사용하여 매칭되는 명령어를 반환합니다.
 * 이미 공백이 있으면(인수 입력 중) 빈 배열을 반환합니다.
 */
export function getMatchingCommands(
  input: string,
  allCommands: readonly SlashCommand[],
): readonly SlashCommand[] {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return [];

  const prefix = trimmed.slice(1).toLowerCase();
  if (prefix.includes(" ")) return []; // Already has args, don't show menu

  return allCommands.filter((cmd) => cmd.name.startsWith(prefix));
}
