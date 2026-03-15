/**
 * useTextBuffering.ts — 텍스트 청크를 버퍼링하여 리렌더를 줄이는 React 훅
 *
 * LLM 스트리밍에서 텍스트 청크가 매우 빠르게 도착할 수 있습니다.
 * 매 청크마다 상태를 업데이트하면 React 리렌더가 과다하게 발생합니다.
 * 이 훅은 청크를 내부 버퍼에 축적하고, 일정 간격(intervalMs)마다
 * 한꺼번에 상태를 업데이트하여 성능을 최적화합니다.
 *
 * 제공하는 함수:
 * - appendText(chunk): 버퍼에 텍스트 추가 (즉시 상태 업데이트하지 않음)
 * - flush(): 버퍼에 남은 텍스트를 즉시 상태에 반영
 * - reset(): 버퍼와 상태를 모두 초기화
 */
import { useState, useRef, useCallback, useEffect } from "react";

/**
 * 텍스트 청크 버퍼링 훅 — 리렌더 빈도를 줄여 성능을 최적화
 *
 * @param intervalMs - 버퍼 플러시 간격 (기본값: 50ms)
 * @returns text: 현재 축적된 전체 텍스트
 * @returns appendText: 청크를 버퍼에 추가하는 함수
 * @returns flush: 버퍼를 즉시 비우고 상태에 반영하는 함수
 * @returns reset: 모든 상태를 초기화하는 함수
 */
export function useTextBuffering(intervalMs = 50) {
  const [text, setText] = useState("");
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const appendText = useCallback(
    (chunk: string) => {
      bufferRef.current += chunk;
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          const buffered = bufferRef.current;
          bufferRef.current = "";
          timerRef.current = undefined;
          setText((prev) => prev + buffered);
        }, intervalMs);
      }
    },
    [intervalMs],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (bufferRef.current) {
      const buffered = bufferRef.current;
      bufferRef.current = "";
      setText((prev) => prev + buffered);
    }
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    bufferRef.current = "";
    setText("");
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { text, appendText, flush, reset } as const;
}
