import { useState, useCallback, useEffect, useRef } from "react";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { INPUT_HISTORY_FILE, INPUT_HISTORY_MAX } from "../../constants.js";

/** Load persisted history from disk */
function loadHistory(): readonly string[] {
  try {
    const raw = readFileSync(INPUT_HISTORY_FILE, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed.slice(0, INPUT_HISTORY_MAX);
    }
    return [];
  } catch {
    return [];
  }
}

/** Save history to disk */
function saveHistory(history: readonly string[]): void {
  try {
    mkdirSync(dirname(INPUT_HISTORY_FILE), { recursive: true });
    writeFileSync(INPUT_HISTORY_FILE, JSON.stringify(history.slice(0, INPUT_HISTORY_MAX)), "utf-8");
  } catch {
    // Silently ignore write errors
  }
}

/** Hook for managing input history with disk persistence */
export function useInputHistory(maxHistory = INPUT_HISTORY_MAX) {
  const loaded = useRef(false);
  const [history, setHistory] = useState<readonly string[]>(() => {
    loaded.current = true;
    return loadHistory();
  });
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Persist to disk whenever history changes (skip initial load)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveHistory(history);
  }, [history]);

  const addToHistory = useCallback(
    (input: string) => {
      setHistory((prev) => {
        // Deduplicate: remove if already exists
        const filtered = prev.filter((item) => item !== input);
        const next = [input, ...filtered];
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
