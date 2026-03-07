import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { type SlashCommand } from "../../commands/registry.js";

export interface SlashCommandMenuProps {
  /** All available slash commands */
  readonly commands: readonly SlashCommand[];
  /** Current input prefix to filter commands (text after `/`) */
  readonly prefix: string;
  /** Called when a command is selected via Tab or Enter */
  readonly onSelect: (name: string) => void;
  /** Called when the menu is dismissed via Escape */
  readonly onClose: () => void;
  /** Whether the menu is visible */
  readonly visible: boolean;
}

/**
 * Autocomplete menu for slash commands with keyboard navigation.
 * Displays matching commands when the user types `/`.
 */
export function SlashCommandMenu({
  commands,
  prefix,
  onSelect,
  onClose,
  visible,
}: SlashCommandMenuProps) {
  const filtered = getMatchingCommands(prefix, commands);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
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

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {filtered.map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <Box key={cmd.name}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected} dimColor={!isSelected}>
              {isSelected ? "▸ " : "  "}
            </Text>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected} dimColor={!isSelected}>
              {"/" + cmd.name}
            </Text>
            <Text color="gray" dimColor>{" — "}</Text>
            <Text color="gray" dimColor>{cmd.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Filter commands based on user input prefix.
 * Returns commands matching the prefix after `/`.
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
