import { Box, Text, useInput } from "ink";
import { useState, useCallback, useRef } from "react";
import { useInputHistory } from "../hooks/useInput.js";

export interface UserInputProps {
  readonly onSubmit: (text: string) => void;
  readonly onChange?: (value: string) => void;
  readonly isDisabled?: boolean;
  readonly slashMenuVisible?: boolean;
  readonly placeholder?: string;
}

/** User input component with cursor movement, input history, and multiline support */
export function UserInput({
  onSubmit,
  onChange,
  isDisabled = false,
  slashMenuVisible = false,
  placeholder = "Type a message...",
}: UserInputProps) {
  const [value, setValue] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);
  const savedInputRef = useRef<string | null>(null);
  const { addToHistory, navigateUp, navigateDown } = useInputHistory();

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
      addToHistory(trimmed);
      onSubmit(trimmed);
      setValue("");
      setCursorOffset(0);
      savedInputRef.current = null;
    }
  }, [value, onSubmit, addToHistory]);

  useInput(
    (input, key) => {
      if (isDisabled) return;

      // Enter handling: Enter submits, Shift+Enter inserts newline.
      // Ink's parseKeypress maps \r → name='return' and \n → name='enter'.
      // Most terminals send \r in raw mode, but some may send \n.
      // Korean/CJK IME may send Enter differently after character composition.
      // We check multiple conditions to catch all terminal/IME variations.
      const isEnter =
        key.return ||
        input === "\n" ||
        input === "\r" ||
        input === "\r\n" ||
        (input.length === 1 && (input.charCodeAt(0) === 13 || input.charCodeAt(0) === 10));
      if (isEnter) {
        // Shift+Enter → newline (only works in terminals that send distinct
        // escape sequences for Shift+Enter, e.g. Kitty, WezTerm).
        // For other terminals, use Ctrl+J as the newline shortcut.
        if (key.shift) {
          const next = value.slice(0, cursorOffset) + "\n" + value.slice(cursorOffset);
          updateValue(next, cursorOffset + 1);
        } else {
          handleSubmit();
        }
        return;
      }

      // Ctrl+J — newline insertion (works in all terminals)
      if (key.ctrl && input === "j") {
        const next = value.slice(0, cursorOffset) + "\n" + value.slice(cursorOffset);
        updateValue(next, cursorOffset + 1);
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

      // Ctrl+W — delete word backward
      if (key.ctrl && input === "w") {
        let pos = cursorOffset;
        while (pos > 0 && value[pos - 1] === " ") pos--;
        while (pos > 0 && value[pos - 1] !== " ") pos--;
        const next = value.slice(0, pos) + value.slice(cursorOffset);
        updateValue(next, pos);
        return;
      }

      // Ctrl+D — delete forward / exit when empty
      if (key.ctrl && input === "d") {
        if (value.length === 0) {
          process.exit(0);
        }
        if (cursorOffset < value.length) {
          const next = value.slice(0, cursorOffset) + value.slice(cursorOffset + 1);
          updateValue(next, cursorOffset);
        }
        return;
      }

      // When slash menu is visible, delegate navigation keys to SlashCommandMenu
      if (slashMenuVisible && (key.upArrow || key.downArrow || key.tab)) {
        return;
      }

      // Up arrow — navigate history
      if (key.upArrow) {
        if (savedInputRef.current === null) {
          savedInputRef.current = value;
        }
        const prev = navigateUp();
        if (prev !== undefined) {
          updateValue(prev, prev.length);
        }
        return;
      }

      // Down arrow — navigate history
      if (key.downArrow) {
        const next = navigateDown();
        if (next !== undefined) {
          if (next === "") {
            const restored = savedInputRef.current ?? "";
            savedInputRef.current = null;
            updateValue(restored, restored.length);
          } else {
            updateValue(next, next.length);
          }
        }
        return;
      }

      // Alt+Left — move cursor one word backward
      if (key.meta && key.leftArrow) {
        let pos = cursorOffset;
        while (pos > 0 && value[pos - 1] === " ") pos--;
        while (pos > 0 && value[pos - 1] !== " ") pos--;
        setCursorOffset(pos);
        return;
      }

      // Alt+Right — move cursor one word forward
      if (key.meta && key.rightArrow) {
        let pos = cursorOffset;
        while (pos < value.length && value[pos] === " ") pos++;
        while (pos < value.length && value[pos] !== " ") pos++;
        setCursorOffset(pos);
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
      // Filter out control characters (ASCII 0-31) that shouldn't be inserted as text.
      // Newlines should only be inserted via Shift+Enter or Ctrl+J, not here.
      if (input && !key.ctrl && !key.meta) {
        const code = input.charCodeAt(0);
        if (code < 32 && code !== 9) return; // allow Tab (9), block other control chars
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

    if (isDisabled) {
      return <Text>{value}</Text>;
    }

    // Multiline rendering: split by newlines and render each line
    const lines = value.split("\n");
    let charIndex = 0;

    return (
      <Box flexDirection="column">
        {lines.map((line, lineIdx) => {
          const lineStart = charIndex;
          charIndex += line.length + (lineIdx < lines.length - 1 ? 1 : 0); // +1 for '\n'

          const cursorInLine = cursorOffset >= lineStart && cursorOffset <= lineStart + line.length;

          if (!cursorInLine) {
            return (
              <Box key={lineIdx}>
                {lineIdx > 0 && (
                  <Text color="blue" bold>
                    {"  "}
                  </Text>
                )}
                <Text>{line}</Text>
              </Box>
            );
          }

          const localCursor = cursorOffset - lineStart;
          const before = line.slice(0, localCursor);
          const cursorChar = line[localCursor];
          const after = line.slice(localCursor + 1);

          return (
            <Box key={lineIdx}>
              {lineIdx > 0 && (
                <Text color="blue" bold>
                  {"  "}
                </Text>
              )}
              {before.length > 0 && <Text>{before}</Text>}
              <Text inverse>{cursorChar ?? " "}</Text>
              {after.length > 0 && <Text>{after}</Text>}
            </Box>
          );
        })}
      </Box>
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
