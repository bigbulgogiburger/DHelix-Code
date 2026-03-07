import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface PermissionPromptProps {
  readonly toolName: string;
  readonly description: string;
  readonly onResponse: (response: "yes" | "no" | "always") => void;
}

const OPTIONS = [
  { label: "Allow once", response: "yes" },
  { label: "Allow for session", response: "always" },
  { label: "Deny", response: "no" },
] as const;

/** Permission confirmation prompt with arrow-key selection */
export function PermissionPrompt({ toolName, description, onResponse }: PermissionPromptProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [answered, setAnswered] = useState(false);

  useInput(
    (_input, key) => {
      if (answered) return;
      if (key.leftArrow) {
        setSelectedIndex((prev) => (prev - 1 + OPTIONS.length) % OPTIONS.length);
      } else if (key.rightArrow) {
        setSelectedIndex((prev) => (prev + 1) % OPTIONS.length);
      } else if (key.return) {
        setAnswered(true);
        onResponse(OPTIONS[selectedIndex].response);
      }
    },
    { isActive: !answered },
  );

  if (answered) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text color="yellow" bold>
        Permission required
      </Text>
      <Box marginTop={0}>
        <Text>
          Tool: <Text bold>{toolName}</Text>
        </Text>
      </Box>
      <Text color="gray">{description}</Text>
      <Box marginTop={1} gap={2}>
        {OPTIONS.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Text
              key={option.label}
              color={isSelected ? "cyan" : "gray"}
              bold={isSelected}
              underline={isSelected}
              dimColor={!isSelected}
            >
              {isSelected ? "\u25B8 " : "  "}
              {option.label}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
