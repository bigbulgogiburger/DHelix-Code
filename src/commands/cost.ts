/**
 * /cost 명령어 핸들러 — 토큰 사용량 및 비용 상세 분석
 *
 * 사용자가 /cost를 입력하면 현재 세션의 토큰 사용량(입력/출력),
 * 예상 비용, 모델별 가격 정보, 효율성 메트릭(턴당 비용, 출력 비율 등)을
 * 상세하게 보여줍니다.
 *
 * 사용 시점: API 비용을 추적하고 싶을 때, 비용 효율적인 모델로
 * 전환해야 하는지 판단할 때
 */
import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS } from "../telemetry/metrics.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/**
 * 토큰 수를 천 단위 구분자와 함께 포맷하고 우측 정렬하는 함수
 *
 * @param n - 포맷할 숫자
 * @param width - 최소 출력 너비 (우측 정렬을 위한 패딩)
 * @returns 포맷된 문자열 (예: "  12,345")
 */
export function formatTokenCount(n: number, width: number): string {
  return n.toLocaleString("en-US").padStart(width);
}

/**
 * 달러 금액을 일관된 정밀도로 포맷하는 함수
 *
 * 금액 크기에 따라 적절한 소수점 자릿수를 적용합니다:
 * - $0: "$0.00"
 * - $0.01 미만: 소수점 4자리 (예: "$0.0023")
 * - $1 미만: 소수점 3자리 (예: "$0.123")
 * - $1 이상: 소수점 2자리 (예: "$1.50")
 *
 * @param cost - 포맷할 달러 금액
 * @returns 포맷된 금액 문자열 (예: "$0.0023")
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * 토큰 사용량과 턴 수로부터 효율성 메트릭을 계산하는 함수
 *
 * @param inputTokens - 입력 토큰 수 (사용자 → LLM으로 보낸 토큰)
 * @param outputTokens - 출력 토큰 수 (LLM → 사용자에게 생성한 토큰)
 * @param totalCost - 총 비용 (달러)
 * @param turns - 사용자 턴 수 (대화 회차)
 * @returns costPerTurn(턴당 비용), tokensPerTurn(턴당 토큰), outputRatio(출력 비율 %)
 */
export function calculateEfficiency(
  inputTokens: number,
  outputTokens: number,
  totalCost: number,
  turns: number,
): {
  readonly costPerTurn: number;
  readonly tokensPerTurn: number;
  readonly outputRatio: number;
} {
  const totalTokens = inputTokens + outputTokens;
  if (turns === 0) {
    return { costPerTurn: 0, tokensPerTurn: 0, outputRatio: 0 };
  }
  return {
    costPerTurn: totalCost / turns,
    tokensPerTurn: Math.round(totalTokens / turns),
    outputRatio: totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0,
  };
}

/**
 * /cost 슬래시 명령어 정의 — 토큰 사용량, 가격, 효율성 메트릭 상세 표시
 *
 * 현재 모델의 입력/출력 토큰 수, 비용, 가격 정보,
 * 턴당 비용/토큰 효율성을 한눈에 보여줍니다.
 */
export const costCommand: SlashCommand = {
  name: "cost",
  description: "Show token usage and cost breakdown",
  usage: "/cost",
  execute: async (_args, context) => {
    const inputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "input",
      model: context.model,
    });
    const outputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "output",
      model: context.model,
    });
    const trackedCost = metrics.getCounter(COUNTERS.tokenCost, { model: context.model });

    const caps = getModelCapabilities(context.model);
    const inputCost = (inputTokens / 1_000_000) * caps.pricing.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * caps.pricing.outputPerMillion;
    const totalCost = trackedCost > 0 ? trackedCost : inputCost + outputCost;

    const totalTokens = inputTokens + outputTokens;

    // Count user turns from messages
    const turns = context.messages ? context.messages.filter((m) => m.role === "user").length : 0;

    const efficiency = calculateEfficiency(inputTokens, outputTokens, totalCost, turns);

    // Determine column width for token alignment
    const maxTokenStr = totalTokens.toLocaleString("en-US");
    const colWidth = Math.max(maxTokenStr.length, 6);

    const lines = [
      "Token Usage & Cost",
      "===================",
      "",
      `  Current Model: ${context.model}`,
      "",
      "  Token Breakdown:",
      `    Input:  ${formatTokenCount(inputTokens, colWidth)}  (${formatCost(inputCost)})`,
      `    Output: ${formatTokenCount(outputTokens, colWidth)}  (${formatCost(outputCost)})`,
      `    Total:  ${formatTokenCount(totalTokens, colWidth)}`,
      "",
      `  Estimated Cost: ${formatCost(totalCost)}`,
      "",
      "  Pricing:",
      `    Input:  $${caps.pricing.inputPerMillion.toFixed(2)} / 1M tokens`,
      `    Output: $${caps.pricing.outputPerMillion.toFixed(2)} / 1M tokens`,
      "",
      "  Efficiency:",
    ];

    if (turns > 0) {
      lines.push(
        `    Cost per turn: ${formatCost(efficiency.costPerTurn)}`,
        `    Tokens per turn: ~${efficiency.tokensPerTurn.toLocaleString("en-US")}`,
        `    Output ratio: ${efficiency.outputRatio.toFixed(1)}%`,
      );
    } else {
      lines.push("    No turns recorded yet.");
    }

    lines.push("", "  Tip: Use /model to switch to a cheaper model for simple tasks.");

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
