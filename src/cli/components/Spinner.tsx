import { Text } from "ink";
import { useState, useEffect } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_INTERVAL = 80;

interface SpinnerProps {
  readonly label?: string;
}

/** Animated spinner component for loading states */
export function Spinner({ label }: SpinnerProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const frame = SPINNER_FRAMES[frameIndex];

  return (
    <Text>
      <Text color="cyan">{frame}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}
