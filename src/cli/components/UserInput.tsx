import { Box, Text, useInput } from "ink";
import { useState, useCallback, useRef, useEffect } from "react";
import fg from "fast-glob";
import { useInputHistory } from "../hooks/useInput.js";

export interface UserInputProps {
  readonly onSubmit: (text: string) => void;
  readonly onChange?: (value: string) => void;
  readonly isDisabled?: boolean;
  readonly slashMenuVisible?: boolean;
  readonly placeholder?: string;
}

/** Extract the token being typed at the cursor for path completion */
function extractCompletionToken(value: string, cursorOffset: number): string {
  const beforeCursor = value.slice(0, cursorOffset);
  const lastSpace = beforeCursor.lastIndexOf(" ");
  return beforeCursor.slice(lastSpace + 1);
}

/** Extract the @ mention token being typed at the cursor */
function extractMentionToken(
  value: string,
  cursorOffset: number,
): { token: string; start: number } | null {
  const beforeCursor = value.slice(0, cursorOffset);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex === -1) return null;
  // Ensure no space between @ and cursor
  const token = beforeCursor.slice(atIndex + 1);
  if (token.includes(" ")) return null;
  return { token, start: atIndex };
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

  // Tab completion state
  const [completions, setCompletions] = useState<string[]>([]);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  // @ mention state
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  const cancelCompletion = useCallback(() => {
    setIsCompleting(false);
    setCompletions([]);
    setCompletionIndex(0);
    setIsMentioning(false);
    setMentionSuggestions([]);
    setMentionIndex(0);
  }, []);

  const updateValue = useCallback(
    (next: string, nextCursor: number) => {
      setValue(next);
      setCursorOffset(nextCursor);
      onChange?.(next);
    },
    [onChange],
  );

  // Trigger @ mention search when user types after @
  useEffect(() => {
    const mention = extractMentionToken(value, cursorOffset);
    if (mention && mention.token.length > 0) {
      setIsMentioning(true);
      const pattern = `**/${mention.token}*`;
      fg(pattern, {
        dot: false,
        onlyFiles: true,
        cwd: process.cwd(),
        deep: 3,
        suppressErrors: true,
      })
        .then((results) => {
          setMentionSuggestions(results.slice(0, 10));
          setMentionIndex(0);
        })
        .catch(() => {
          setMentionSuggestions([]);
        });
    } else if (mention === null || (mention && mention.token.length === 0)) {
      if (isMentioning) {
        setIsMentioning(false);
        setMentionSuggestions([]);
        setMentionIndex(0);
      }
    }
  }, [value, cursorOffset, isMentioning]);

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

      // Enter handling: Enter ALWAYS submits.
      // Korean/CJK IME on macOS sets shift=true during character composition,
      // and this leaks into the Enter key event. So we cannot use key.shift
      // to distinguish Enter vs Shift+Enter. Use Ctrl+J for newlines instead.
      const isEnter =
        key.return ||
        input === "\n" ||
        input === "\r" ||
        input === "\r\n" ||
        (input.length === 1 && (input.charCodeAt(0) === 13 || input.charCodeAt(0) === 10));
      if (isEnter) {
        handleSubmit();
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

      // Escape — cancel completion/mention
      if (key.escape) {
        if (isCompleting || isMentioning) {
          cancelCompletion();
          return;
        }
        return;
      }

      // Tab — file path autocompletion or cycle through suggestions
      if (key.tab && !slashMenuVisible) {
        if (isMentioning && mentionSuggestions.length > 0) {
          // Cycle through mention suggestions
          setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
          return;
        }

        if (isCompleting && completions.length > 0) {
          // Cycle through completions
          setCompletionIndex((prev) => (prev + 1) % completions.length);
          return;
        }

        // Start new tab completion
        const token = extractCompletionToken(value, cursorOffset);
        if (token.length > 0) {
          const pattern = `${token}*`;
          fg(pattern, { dot: false, cwd: process.cwd(), deep: 3, suppressErrors: true })
            .then((results) => {
              if (results.length > 0) {
                setCompletions(results.slice(0, 10));
                setCompletionIndex(0);
                setIsCompleting(true);
              }
            })
            .catch(() => {
              // ignore glob errors
            });
        }
        return;
      }

      // When completing/mentioning, Enter or Space confirms selection
      if (
        (isCompleting || isMentioning) &&
        (key.return || input === "\n" || input === "\r" || input === " ")
      ) {
        if (isMentioning && mentionSuggestions.length > 0) {
          const selected = mentionSuggestions[mentionIndex];
          const mention = extractMentionToken(value, cursorOffset);
          if (mention && selected) {
            const before = value.slice(0, mention.start);
            const after = value.slice(cursorOffset);
            const insertion = `@file:${selected}`;
            const next = before + insertion + after;
            const nextCursor = before.length + insertion.length;
            cancelCompletion();
            updateValue(next, nextCursor);
            return;
          }
        }

        if (isCompleting && completions.length > 0) {
          const selected = completions[completionIndex];
          if (selected) {
            const token = extractCompletionToken(value, cursorOffset);
            const tokenStart = cursorOffset - token.length;
            const before = value.slice(0, tokenStart);
            const after = value.slice(cursorOffset);
            const next = before + selected + after;
            const nextCursor = before.length + selected.length;
            cancelCompletion();
            updateValue(next, nextCursor);
            // If Enter was used, don't also submit
            if (key.return || input === "\n" || input === "\r") {
              return;
            }
          }
        }

        // If Space triggered completion acceptance, don't fall through to char insertion
        if (input === " ") return;
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

        // Cancel tab completion on regular character input (not @ which starts mention)
        if (isCompleting) {
          cancelCompletion();
        }

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
          <Text inverse> </Text>
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

  // Active suggestions: either tab completions or @ mention suggestions
  const activeSuggestions = isMentioning ? mentionSuggestions : isCompleting ? completions : [];
  const activeIndex = isMentioning ? mentionIndex : completionIndex;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="blue" bold>
          {"> "}
        </Text>
        {renderContent()}
      </Box>
      {activeSuggestions.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {activeSuggestions.map((item, idx) => (
            <Text
              key={item}
              color={idx === activeIndex ? "blue" : "gray"}
              bold={idx === activeIndex}
            >
              {idx === activeIndex ? "> " : "  "}
              {isMentioning ? `@file:${item}` : item}
            </Text>
          ))}
          <Text color="gray" dimColor>
            Tab: cycle | Enter/Space: select | Esc: cancel
          </Text>
        </Box>
      )}
    </Box>
  );
}
