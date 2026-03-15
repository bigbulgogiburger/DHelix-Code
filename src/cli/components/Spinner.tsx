/**
 * Spinner.tsx — 로딩 상태를 표시하는 애니메이션 스피너 컴포넌트
 *
 * 브레일(Braille) 유니코드 문자를 순환하여 터미널에서 스피너 효과를 만듭니다.
 * 500ms 간격으로 프레임이 변경되며, 선택적으로 옆에 레이블 텍스트를 표시합니다.
 * React.memo로 감싸서 불필요한 리렌더링을 방지합니다.
 */
import { Text } from "ink";
import React, { useState, useEffect } from "react";

/** 브레일 유니코드 문자로 구성된 스피너 프레임 배열 (10프레임) */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
/** 프레임 전환 간격 (500ms) */
const FRAME_INTERVAL = 500;

/**
 * @param label - 스피너 옆에 표시할 텍스트 (선택적)
 */
interface SpinnerProps {
  readonly label?: string;
}

/** 애니메이션 스피너 — setInterval로 프레임 인덱스를 순환하여 회전 효과 생성 */
export const Spinner = React.memo(function Spinner({ label }: SpinnerProps) {
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
});
