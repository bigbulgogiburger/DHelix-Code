import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { type SelectOption } from "../../commands/registry.js";

export interface SelectListProps {
  /** Prompt text displayed above the list */
  readonly prompt: string;
  /** Available options to choose from */
  readonly options: readonly SelectOption[];
  /** Called when the user confirms a selection (Enter) */
  readonly onSelect: (value: string) => void;
  /** Called when the user cancels (Escape) */
  readonly onCancel: () => void;
  /** Maximum number of options visible at once (default: 8) */
  readonly maxVisible?: number;
}

/**
 * A reusable keyboard-navigable select list component.
 * Supports arrow key navigation, scrolling, and Enter/Escape.
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
        <Text color="yellow">{prompt}</Text>
        <Text dimColor>No options available.</Text>
      </Box>
    );
  }

  const visibleItems = options.slice(scrollOffset, scrollOffset + maxVisible);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + maxVisible < options.length;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginY={1}>
      <Text color="yellow" bold>
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
