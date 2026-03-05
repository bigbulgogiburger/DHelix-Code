import { useState, useCallback } from "react";

/** Hook for managing input history */
export function useInputHistory(maxHistory = 100) {
  const [history, setHistory] = useState<readonly string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const addToHistory = useCallback(
    (input: string) => {
      setHistory((prev) => {
        const next = [input, ...prev];
        return next.length > maxHistory ? next.slice(0, maxHistory) : next;
      });
      setHistoryIndex(-1);
    },
    [maxHistory],
  );

  const navigateUp = useCallback((): string | undefined => {
    if (history.length === 0) return undefined;
    const nextIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(nextIndex);
    return history[nextIndex];
  }, [history, historyIndex]);

  const navigateDown = useCallback((): string | undefined => {
    if (historyIndex <= 0) {
      setHistoryIndex(-1);
      return "";
    }
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    return history[nextIndex];
  }, [history, historyIndex]);

  const reset = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  return {
    history,
    addToHistory,
    navigateUp,
    navigateDown,
    reset,
  };
}
