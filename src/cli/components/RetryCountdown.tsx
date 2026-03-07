import { useState, useEffect } from "react";
import { Text } from "ink";

interface RetryCountdownProps {
  readonly seconds: number;
  readonly label?: string;
}

/** Displays a countdown timer for retry operations */
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
      {"\u23F3"} {label} {remaining}{"\uCD08"}...
    </Text>
  );
}
