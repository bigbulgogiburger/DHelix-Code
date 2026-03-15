/**
 * RetryCountdown.tsx — 재시도 대기 카운트다운 타이머 컴포넌트
 *
 * API 요청이 실패(rate limit 등)했을 때 재시도까지 남은 시간을
 * 카운트다운으로 표시합니다. "⏳ 재시도까지 5초..." 형태로 표시되며,
 * 0초가 되면 자동으로 사라집니다.
 */
import { useState, useEffect } from "react";
import { Text } from "ink";

/**
 * @param seconds - 카운트다운 시작 초
 * @param label - 카운트다운 앞에 표시할 레이블 (기본값: "재시도까지")
 */
interface RetryCountdownProps {
  readonly seconds: number;
  readonly label?: string;
}

/** 재시도 카운트다운 타이머 — seconds가 변경되면 카운트다운을 재시작 */
export function RetryCountdown({ seconds, label = "재시도까지" }: RetryCountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) return;

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remaining]);

  if (remaining <= 0) return null;

  return (
    <Text dimColor>
      {"\u23F3"} {label} {remaining}
      {"\uCD08"}...
    </Text>
  );
}
