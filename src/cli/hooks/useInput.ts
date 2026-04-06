/**
 * useInput.ts — 입력 히스토리를 관리하는 React 훅
 *
 * 사용자가 이전에 입력한 내용을 위/아래 화살표로 탐색할 수 있도록
 * 히스토리를 메모리와 디스크에 동시 관리합니다.
 *
 * 히스토리는 ~/.dhelix/input-history.json에 JSON 배열로 저장되며,
 * 최대 INPUT_HISTORY_MAX(상수)개까지 유지됩니다.
 * 같은 입력이 중복되면 기존 항목을 제거하고 최신으로 이동합니다.
 *
 * 사용 방식:
 * - addToHistory(input): 새 입력 추가
 * - navigateUp(): ↑ 키 — 이전 입력으로 이동
 * - navigateDown(): ↓ 키 — 다음 입력으로 이동 (빈 문자열이면 현재 입력 복원)
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { INPUT_HISTORY_FILE, INPUT_HISTORY_MAX } from "../../constants.js";

/** 디스크에서 저장된 히스토리를 로드 — JSON 배열 형태, 실패 시 빈 배열 반환 */
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

/** 히스토리를 디스크에 저장 — JSON 배열로 직렬화, 실패 시 조용히 무시 */
function saveHistory(history: readonly string[]): void {
  try {
    mkdirSync(dirname(INPUT_HISTORY_FILE), { recursive: true });
    writeFileSync(INPUT_HISTORY_FILE, JSON.stringify(history.slice(0, INPUT_HISTORY_MAX)), "utf-8");
  } catch {
    // Silently ignore write errors
  }
}

/**
 * 디스크 영속성을 가진 입력 히스토리 관리 훅
 *
 * 상태:
 * - history: 히스토리 배열 (최신이 인덱스 0)
 * - historyIndex: 현재 탐색 위치 (-1이면 현재 입력 모드)
 *
 * 디스크 동기화: history가 변경될 때마다 자동으로 파일에 저장
 * (첫 렌더링 시에는 저장하지 않음)
 */
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
