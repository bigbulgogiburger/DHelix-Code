/**
 * SelectList.tsx — 키보드로 탐색 가능한 선택 목록 컴포넌트
 *
 * 여러 옵션 중 하나를 선택할 수 있는 재사용 가능한 목록입니다.
 * 위/아래 화살표로 이동, Enter로 선택, Escape로 취소합니다.
 * 옵션이 많을 때는 자동으로 스크롤되며, 위/아래에 "↑ more"/"↓ more"가 표시됩니다.
 *
 * 사용 예: /model 명령에서 모델 선택, 기타 대화형 선택이 필요한 경우
 */
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { type SelectOption } from "../../commands/registry.js";

/**
 * SelectList 컴포넌트의 Props
 *
 * @param prompt - 목록 위에 표시할 프롬프트 텍스트
 * @param options - 선택 가능한 옵션 배열 (value, label, description 포함)
 * @param onSelect - Enter로 선택 확인 시 호출되는 콜백 (선택된 value 전달)
 * @param onCancel - Escape로 취소 시 호출되는 콜백
 * @param maxVisible - 한 번에 표시할 최대 옵션 수 (기본값: 8, 초과시 스크롤)
 */
export interface SelectListProps {
  /** 목록 위에 표시할 프롬프트 텍스트 */
  readonly prompt: string;
  /** 선택 가능한 옵션 배열 */
  readonly options: readonly SelectOption[];
  /** Enter로 선택 확인 시 호출 */
  readonly onSelect: (value: string) => void;
  /** Escape로 취소 시 호출 */
  readonly onCancel: () => void;
  /** 한 번에 표시할 최대 옵션 수 (기본값: 8) */
  readonly maxVisible?: number;
}

/**
 * 키보드 탐색 가능한 선택 목록 컴포넌트
 *
 * 화살표 키로 이동하면 selectedIndex와 scrollOffset을 함께 관리하여
 * 현재 선택된 항목이 항상 화면에 보이도록 합니다.
 * 선택된 항목은 시안색 + 볼드 + ▸ 마커로 강조됩니다.
 */
export function SelectList({
  prompt,
  options,
  onSelect,
  onCancel,
  maxVisible = 8,
}: SelectListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      const selected = options[selectedIndex];
      if (selected) {
        onSelect(selected.value);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const next = Math.max(0, prev - 1);
        setScrollOffset((so) => Math.min(so, next));
        return next;
      });
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => {
        const next = Math.min(options.length - 1, prev + 1);
        setScrollOffset((so) => Math.max(so, next - maxVisible + 1));
        return next;
      });
    }
  });

  if (options.length === 0) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color="#00BCD4">{prompt}</Text>
        <Text dimColor>No options available.</Text>
      </Box>
    );
  }

  const visibleItems = options.slice(scrollOffset, scrollOffset + maxVisible);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + maxVisible < options.length;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="#0097A7" paddingX={1} marginY={1}>
      <Text color="#00BCD4" bold>
        {prompt}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {hasMoreAbove && (
          <Text color="gray" dimColor>
            {"  \u2191 more"}
          </Text>
        )}
        {visibleItems.map((option, idx) => {
          const actualIndex = scrollOffset + idx;
          const isSelected = actualIndex === selectedIndex;
          return (
            <Box key={option.value}>
              <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
                {isSelected ? "\u25B8 " : "  "}
              </Text>
              <Text color={isSelected ? "cyan" : "gray"} bold={isSelected} dimColor={!isSelected}>
                {option.label}
              </Text>
              {option.description ? <Text dimColor>{" \u2014 " + option.description}</Text> : null}
            </Box>
          );
        })}
        {hasMoreBelow && (
          <Text color="gray" dimColor>
            {"  \u2193 more"}
          </Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {options.length > maxVisible ? `(${selectedIndex + 1}/${options.length}) ` : ""}
          Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
