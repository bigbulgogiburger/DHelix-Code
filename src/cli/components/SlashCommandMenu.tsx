import { Box, Text } from "ink";
import { type SlashCommand } from "../../commands/registry.js";

interface SlashCommandMenuProps {
  /** Commands matching the current input */
  readonly commands: readonly SlashCommand[];
  /** Currently selected index */
  readonly selectedIndex: number;
  /** Whether the menu is visible */
  readonly isVisible: boolean;
}

/**
 * Autocomplete menu for slash commands.
 * Displays matching commands when the user types `/`.
 */
export function SlashCommandMenu({ commands, selectedIndex, isVisible }: SlashCommandMenuProps) {
  if (!isVisible || commands.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {commands.map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <Box key={cmd.name}>
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
              {isSelected ? "> " : "  "}
            </Text>
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
              {"/" + cmd.name}
            </Text>
            <Text color="gray">{" — "}</Text>
            <Text color="gray">{cmd.description}</Text>
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
