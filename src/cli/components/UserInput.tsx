import { Box, Text, useInput } from "ink";
import { useState, useCallback } from "react";

interface UserInputProps {
  readonly onSubmit: (text: string) => void;
  readonly isDisabled?: boolean;
  readonly placeholder?: string;
}

/** User input component with basic editing support */
export function UserInput({
  onSubmit,
  isDisabled = false,
  placeholder = "Type a message...",
}: UserInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
      setValue("");
    }
  }, [value, onSubmit]);

  useInput(
    (input, key) => {
      if (isDisabled) return;

      if (key.return) {
        handleSubmit();
        return;
      }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        return;
      }

      if (key.ctrl && input === "c") {
        process.exit(0);
      }

      if (input && !key.ctrl && !key.meta) {
        setValue((prev) => prev + input);
      }
    },
    { isActive: !isDisabled },
  );

  return (
    <Box>
      <Text color="blue" bold>
        {"> "}
      </Text>
      {value.length > 0 ? <Text>{value}</Text> : <Text color="gray">{placeholder}</Text>}
      {!isDisabled ? <Text color="cyan">{"▌"}</Text> : null}
    </Box>
  );
}
