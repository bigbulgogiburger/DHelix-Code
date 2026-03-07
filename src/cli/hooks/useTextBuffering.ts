import { useState, useRef, useCallback, useEffect } from "react";

/** Hook that buffers text chunks and flushes them in batches to reduce re-renders */
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
