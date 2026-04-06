/**
 * AgentStatus.tsx — 에이전트 처리 중 상태를 표시하는 애니메이션 컴포넌트
 *
 * 에이전트가 LLM 응답을 기다리는 동안 표시되는 컴포넌트입니다.
 * "생각하는 중…", "코드 읽는 중…" 등의 한국어 메시지가 랜덤으로 순환되며,
 * 별 아이콘(✦/✧)이 깜빡이고, 경과 시간과 토큰 수를 보여줍니다.
 *
 * React.memo로 감싸서 불필요한 리렌더링을 방지합니다.
 */
import React, { useState, useEffect } from "react";
import { Text } from "ink";

/** 에이전트 처리 중 랜덤으로 표시되는 한국어 상태 메시지 목록 */
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
  "주화입마에 빠지는 중…",
  "K-Pop Demon Hunting 중…",
  "버그 퇴마 의식 중…",
  "코드 연금술 시전 중…",
  "깃허브 크롤링하다 눈 돌아가는 중…",
  "들숨에 코드 날숨에 버그…",
  "스택오버플로우 영혼 소환 중…",
  "세미콜론 하나에 우주가 갈리는 중…",
  "AI가 AI를 코딩하는 중…",
  "무한 루프 탈출 시도 중…",
  "코드 분석 중… 근데 이제 AI를 곁들인",
] as const;

/** 별 애니메이션 프레임 — ✦와 ✧가 번갈아 표시됨 */
const STAR_FRAMES = ["✦", "✧"] as const;
/** 별 깜빡임 간격 (400ms) */
const STAR_INTERVAL = 400;
/** 경과 시간 업데이트 간격 (1초) */
const ELAPSED_INTERVAL = 1000;

/**
 * @param tokenCount - 현재까지 소비한 토큰 수 (선택적, 표시용)
 */
interface AgentStatusProps {
  readonly tokenCount?: number;
}

/** 경과 시간을 "N초" 또는 "N분 N초" 형식의 한국어 문자열로 변환 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}분 ${remaining}초` : `${minutes}분`;
}

/** 상태 메시지 옆에 표시할 메타 정보 문자열을 생성 — "(3초 · ↓ 1,234 tokens)" */
function buildMeta(elapsed: number, tokenCount: number): string {
  const timePart = formatElapsed(elapsed);
  const tokenPart = tokenCount > 0 ? ` · ↓ ${tokenCount.toLocaleString()} tokens` : "";
  return `(${timePart}${tokenPart})`;
}

/**
 * 애니메이션이 있는 에이전트 상태 표시 컴포넌트
 * 한국어 메시지 + 경과 시간 + 토큰 수를 표시합니다.
 * 3개의 독립적인 타이머로 각각 별, 시간, 메시지를 업데이트합니다.
 */
export const AgentStatus = React.memo(function AgentStatus({ tokenCount = 0 }: AgentStatusProps) {
  const [starIndex, setStarIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [messageIndex] = useState(() => Math.floor(Math.random() * STATUS_MESSAGES.length));
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

  // 메시지는 컴포넌트 마운트 시 1회만 랜덤 선택 (순환하지 않음)
  // AgentStatus가 표시될 때마다 새 메시지가 선택됨

  const star = STAR_FRAMES[starIndex];
  const message = STATUS_MESSAGES[messageIndex];
  const meta = buildMeta(elapsed, tokenCount);

  return (
    <Text>
      <Text color="#00BCD4" bold>
        {star}
      </Text>
      <Text> {message} </Text>
      <Text dimColor>{meta}</Text>
    </Text>
  );
});
