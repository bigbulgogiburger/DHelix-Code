/**
 * /context 명령어 핸들러 — 컨텍스트 윈도우 사용량 시각화
 *
 * 사용자가 /context를 입력하면 현재 컨텍스트 윈도우의 사용 상태를
 * 진행 막대(progress bar)로 시각적으로 보여줍니다.
 *
 * 컨텍스트 윈도우란? LLM이 한 번에 처리할 수 있는 텍스트의 최대 크기입니다.
 * 예: 128K 컨텍스트 = 약 128,000 토큰까지의 대화 내역을 기억할 수 있음
 *
 * 표시 정보:
 *   - 모델명과 최대 컨텍스트/출력 토큰 수
 *   - 현재 사용량 시각적 막대와 백분율
 *   - 압축(compaction) 트리거까지 남은 토큰 수
 *   - 메시지 수 (사용자/어시스턴트별)
 *
 * 사용 시점: 대화가 길어져서 컨텍스트 한계에 가까운지 확인하고 싶을 때
 */
import { type SlashCommand } from "./registry.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { countMessageTokens } from "../llm/token-counter.js";
import { AGENT_LOOP } from "../constants.js";

/**
 * 토큰 수를 천 단위 구분자와 함께 포맷하는 헬퍼 함수
 *
 * @param count - 포맷할 토큰 수
 * @returns 포맷된 문자열 (예: 12,345)
 */
function formatTokenCount(count: number): string {
  return count.toLocaleString("en-US");
}

/**
 * /context 슬래시 명령어 정의 — 컨텍스트 윈도우 사용 현황 표시
 *
 * 현재 모델의 최대 컨텍스트 크기 대비 사용량을
 * 시각적 진행 막대와 수치로 표시합니다.
 */
export const contextCommand: SlashCommand = {
  name: "context",
  description: "Show context window usage",
  usage: "/context",
  execute: async (_args, context) => {
    const caps = getModelCapabilities(context.model);
    const maxTokens = caps.maxContextTokens;

    // Count tokens from actual conversation messages
    const messages = context.messages ?? [];
    const estimatedTokens = messages.length > 0
      ? countMessageTokens(messages)
      : 0;

    const usedRatio = maxTokens > 0 ? Math.min(estimatedTokens / maxTokens, 1) : 0;

    // Build visual progress bar
    const barWidth = 40;
    const filledCount = Math.round(usedRatio * barWidth);
    const emptyCount = barWidth - filledCount;
    const bar = "[" + "#".repeat(filledCount) + "-".repeat(emptyCount) + "]";

    // Message breakdown
    const totalMessages = messages.length;
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = messages.filter((m) => m.role === "assistant").length;

    // Compaction threshold
    const compactionThreshold = AGENT_LOOP.compactionThreshold;
    const compactionTokens = Math.round(maxTokens * compactionThreshold);
    const tokensUntilCompaction = Math.max(0, compactionTokens - estimatedTokens);

    const lines = [
      "Context Window",
      "==============",
      "",
      `  Model: ${context.model} (${caps.capabilityTier} tier)`,
      `  Max context: ${(maxTokens / 1000).toFixed(0)}K tokens`,
      `  Max output: ${(caps.maxOutputTokens / 1000).toFixed(0)}K tokens`,
      "",
      `  Usage: ${bar} ${(usedRatio * 100).toFixed(0)}%`,
      `         ${formatTokenCount(estimatedTokens)} / ${formatTokenCount(maxTokens)} tokens`,
      "",
      `  Compaction threshold: ${(compactionThreshold * 100).toFixed(1)}%`,
      `  Tokens until compaction: ~${formatTokenCount(tokensUntilCompaction)}`,
      "",
      `  Messages: ${totalMessages} total (${userMessages} user, ${assistantMessages} assistant)`,
      "",
      "  Tip: Use /compact to reduce context usage when approaching limits.",
    ];

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
