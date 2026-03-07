import { Box, Text, useInput } from "ink";
import { useState, useCallback } from "react";

export interface UserInputProps {
  readonly onSubmit: (text: string) => void;
  readonly onChange?: (value: string) => void;
  readonly isDisabled?: boolean;
  readonly placeholder?: string;
}

/** User input component with cursor movement and readline shortcuts */
export function UserInput({
  onSubmit,
  onChange,
  isDisabled = false,
  placeholder = "Type a message...",
}: UserInputProps) {
  const [value, setValue] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);

  const updateValue = useCallback(
    (next: string, nextCursor: number) => {
      setValue(next);
      setCursorOffset(nextCursor);
      onChange?.(next);
    },
    [onChange],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed);
      setValue("");
      setCursorOffset(0);
    }
  }, [value, onSubmit]);

  useInput(
    (input, key) => {
      if (isDisabled) return;

      if (key.return) {
        handleSubmit();
        return;
      }

      // Ctrl+C — exit
      if (key.ctrl && input === "c") {
        process.exit(0);
      }

      // Ctrl+A — jump to start
      if (key.ctrl && input === "a") {
        setCursorOffset(0);
        return;
      }

      // Ctrl+E — jump to end
      if (key.ctrl && input === "e") {
        setCursorOffset(value.length);
        return;
      }

      // Ctrl+K — kill from cursor to end of line
      if (key.ctrl && input === "k") {
        updateValue(value.slice(0, cursorOffset), cursorOffset);
        return;
      }

      // Ctrl+U — kill entire line
      if (key.ctrl && input === "u") {
        updateValue("", 0);
        return;
      }

      // Left arrow
      if (key.leftArrow) {
        setCursorOffset((prev) => Math.max(0, prev - 1));
        return;
      }

      // Right arrow
      if (key.rightArrow) {
        setCursorOffset((prev) => Math.min(value.length, prev + 1));
        return;
      }

      // Backspace — delete char before cursor
      if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          const next = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
          updateValue(next, cursorOffset - 1);
        }
        return;
      }

      // Character insertion at cursor position
      if (input && !key.ctrl && !key.meta) {
        const next = value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
        updateValue(next, cursorOffset + input.length);
      }
    },
    { isActive: !isDisabled },
  );

  const renderContent = () => {
    if (value.length === 0 && !isDisabled) {
      // Show cursor at start with placeholder faded after it
      return (
        <>
          <Text inverse>{" "}</Text>
          <Text color="gray">{placeholder}</Text>
        </>
      );
    }

    if (value.length === 0) {
      return <Text color="gray">{placeholder}</Text>;
    }

    const before = value.slice(0, cursorOffset);
    const cursorChar = value[cursorOffset];
    const after = value.slice(cursorOffset + 1);

    if (isDisabled) {
      return <Text>{value}</Text>;
    }

    return (
      <>
        {before.length > 0 && <Text>{before}</Text>}
        <Text inverse>{cursorChar ?? " "}</Text>
        {after.length > 0 && <Text>{after}</Text>}
      </>
    );
  };

  return (
    <Box>
      <Text color="blue" bold>
        {"> "}
      </Text>
      {renderContent()}
    </Box>
  );
}
