import React, { useState, useEffect, useRef } from "react";
import { Text } from "ink";

const STATUS_MESSAGES: readonly string[] = [
  "생각하는 중…",
  "코드 읽는 중…",
  "뇌세포 굴리는 중…",
  "영감 받는 중…",
  "커피 마시는 중…",
  "삼매경 돌입…",
  "뉴런 발화 중…",
  "코드 해독 중…",
  "패턴 분석 중…",
  "아이디어 조합 중…",
  "컨텍스트 흡수 중…",
  "시냅스 연결 중…",
  "로직 탐색 중…",
  "차원 돌파 중…",
  "지식 소환 중…",
] as const;

const STAR_FRAMES = ["✦", "✧"] as const;
const STAR_INTERVAL = 400;
const MESSAGE_INTERVAL = 4000;
const ELAPSED_INTERVAL = 1000;

interface AgentStatusProps {
  readonly tokenCount?: number;
}

function pickRandomIndex(length: number, excludeIndex: number): number {
  if (length <= 1) return 0;
  let next: number;
  do {
    next = Math.floor(Math.random() * length);
  } while (next === excludeIndex);
  return next;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}분 ${remaining}초` : `${minutes}분`;
}

function buildMeta(elapsed: number, tokenCount: number): string {
  const timePart = formatElapsed(elapsed);
  const tokenPart = tokenCount > 0 ? ` · ↓ ${tokenCount.toLocaleString()} tokens` : "";
  return `(${timePart}${tokenPart})`;
}

/** Animated agent status with Korean messages, elapsed time, and token count */
export const AgentStatus = React.memo(function AgentStatus({ tokenCount = 0 }: AgentStatusProps) {
  const [starIndex, setStarIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * STATUS_MESSAGES.length),
  );
  const messageIndexRef = useRef(messageIndex);

  // Star toggle animation
  useEffect(() => {
    const timer = setInterval(() => {
      setStarIndex((prev) => (prev + 1) % STAR_FRAMES.length);
    }, STAR_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, ELAPSED_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Random message cycling (never repeats consecutively)
  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = pickRandomIndex(STATUS_MESSAGES.length, messageIndexRef.current);
      messageIndexRef.current = nextIndex;
      setMessageIndex(nextIndex);
    }, MESSAGE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const star = STAR_FRAMES[starIndex];
  const message = STATUS_MESSAGES[messageIndex];
  const meta = buildMeta(elapsed, tokenCount);

  return (
    <Text>
      <Text color="magenta" bold>
        {star}
      </Text>
      <Text> {message} </Text>
      <Text dimColor>{meta}</Text>
    </Text>
  );
});
