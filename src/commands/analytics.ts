/**
 * /analytics 명령어 핸들러 — 세션 분석 및 성능 메트릭 표시
 *
 * 사용자가 /analytics를 입력하면 현재 세션의 상세한 분석 데이터를 보여줍니다.
 * 토큰 사용량, 비용, 모델 분포, 도구 사용 빈도, 에이전트 성능,
 * 토큰 캐시 통계, 활동 타임라인 등 종합적인 세션 통계를 제공합니다.
 *
 * /stats보다 더 상세한 분석 정보를 원할 때 사용합니다.
 */
import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS, HISTOGRAMS } from "../telemetry/metrics.js";
import { formatDuration, getToolBreakdown } from "./stats.js";
import { formatCost } from "./cost.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { getTokenCacheStats } from "../llm/token-counter.js";

/** 세션 시작 시각 — 세션 지속 시간 계산에 사용 (밀리초 타임스탬프) */
const sessionStartedAt = Date.now();

/**
 * 텍스트 기반 막대 차트를 생성하는 헬퍼 함수
 *
 * 블록 문자(\u2588)를 반복하여 터미널에서 시각적 막대를 만듭니다.
 *
 * @param length - 막대 길이 (0 이상)
 * @param maxLength - 최대 막대 길이 (기본값: 20)
 * @returns 블록 문자로 구성된 막대 문자열
 */
function makeBar(length: number, maxLength = 20): string {
  const clamped = Math.max(0, Math.min(length, maxLength));
  return "\u2588".repeat(clamped);
}

/**
 * 백분율을 소수점 1자리로 포맷하는 헬퍼 함수
 *
 * @param value - 백분율 값 (예: 85.123)
 * @returns 포맷된 백분율 문자열 (예: "85.1%")
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * 카운터 데이터에서 모델별 토큰 분포를 수집하는 함수
 *
 * 텔레메트리(telemetry, 사용량 추적 시스템)에서 모델별 입력/출력 토큰 수를
 * 집계하여 총 토큰 수 내림차순으로 정렬된 배열을 반환합니다.
 *
 * 토큰이란? LLM이 텍스트를 처리하는 최소 단위로, 대략 영어 4글자 = 1토큰입니다.
 *
 * @returns 모델별 입력/출력 토큰 수 배열 (총 토큰 수 기준 내림차순)
 */
export function getModelDistribution(): ReadonlyArray<{
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}> {
  const counterData = metrics.getCounterData();
  const tokenPrefix = COUNTERS.tokensUsed.name;
  const models = new Map<string, { input: number; output: number }>();

  for (const [key, values] of counterData.entries()) {
    if (!key.startsWith(tokenPrefix)) continue;
    const modelMatch = key.match(/model=([^,}]+)/);
    const typeMatch = key.match(/type=(input|output)/);
    if (!modelMatch || !typeMatch) continue;

    const model = modelMatch[1];
    const type = typeMatch[1] as "input" | "output";
    const value = values.length > 0 ? values[values.length - 1].value : 0;

    if (!models.has(model)) {
      models.set(model, { input: 0, output: 0 });
    }
    const entry = models.get(model)!;
    if (type === "input") entry.input = value;
    else entry.output = value;
  }

  return [...models.entries()]
    .map(([model, counts]) => ({
      model,
      inputTokens: counts.input,
      outputTokens: counts.output,
    }))
    .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
}

/**
 * 도구(tool) 성공률을 카운터 데이터에서 계산하는 함수
 *
 * 도구란? LLM이 파일 읽기, 검색, 명령 실행 등을 수행하기 위해 호출하는
 * 기능 단위입니다. 각 도구 호출의 성공/실패를 집계하여 성공률을 산출합니다.
 *
 * @returns 전체 호출 수, 성공 수, 실패 수, 성공률(백분율)
 */
export function getToolSuccessRate(): {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly rate: number;
} {
  const counterData = metrics.getCounterData();
  const toolPrefix = COUNTERS.toolInvocations.name;
  let succeeded = 0;
  let failed = 0;

  for (const [key, values] of counterData.entries()) {
    if (!key.startsWith(toolPrefix)) continue;
    const statusMatch = key.match(/status=(success|error|failure)/);
    const toolMatch = key.match(/tool=([^,}]+)/);
    if (!statusMatch || !toolMatch) continue;
    if (toolMatch[1] === "*") continue;

    const value = values.length > 0 ? values[values.length - 1].value : 0;
    if (statusMatch[1] === "success") {
      succeeded += value;
    } else {
      failed += value;
    }
  }

  const total = succeeded + failed;
  return {
    total,
    succeeded,
    failed,
    rate: total > 0 ? (succeeded / total) * 100 : 100,
  };
}

/**
 * 히스토그램 데이터에서 에이전트 평균 반복 횟수를 구하는 함수
 *
 * 에이전트 루프(agent loop)란? LLM이 사용자 요청을 처리하기 위해
 * "생각 → 도구 호출 → 결과 확인"을 반복하는 과정입니다.
 * 이 함수는 요청당 평균 몇 번의 반복이 필요했는지를 계산합니다.
 *
 * @returns 평균 반복 횟수 (데이터가 없으면 0)
 */
export function getAverageIterations(): number {
  const histData = metrics.getHistogramData();
  const iterKey = HISTOGRAMS.agentIterations.name;

  for (const [key, values] of histData.entries()) {
    if (!key.startsWith(iterKey) && key !== iterKey) continue;
    if (values.length === 0) continue;

    const sum = values.reduce((acc, v) => acc + v.value, 0);
    return sum / values.length;
  }

  return 0;
}

/**
 * /analytics 슬래시 명령어 정의 — 상세 세션 분석 및 성능 메트릭 표시
 *
 * 세션 개요(지속 시간, 모델, 사용자 턴 수), 토큰 사용량과 비용,
 * 모델별 분포 차트, 도구 사용 빈도/성공률, 에이전트 성능,
 * 토큰 캐시 통계, 활동 타임라인을 종합적으로 보여줍니다.
 */
export const analyticsCommand: SlashCommand = {
  name: "analytics",
  description: "Show detailed session analytics and performance metrics",
  usage: "/analytics",
  execute: async (_args, context) => {
    const durationMs = Date.now() - sessionStartedAt;
    const duration = formatDuration(durationMs);

    // Token totals
    const inputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "input",
      model: context.model,
    });
    const outputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "output",
      model: context.model,
    });
    const totalTokens = inputTokens + outputTokens;

    // Cost
    const trackedCost = metrics.getCounter(COUNTERS.tokenCost, { model: context.model });
    const caps = getModelCapabilities(context.model);
    const calculatedInputCost = (inputTokens / 1_000_000) * caps.pricing.inputPerMillion;
    const calculatedOutputCost = (outputTokens / 1_000_000) * caps.pricing.outputPerMillion;
    const totalCost = trackedCost > 0 ? trackedCost : calculatedInputCost + calculatedOutputCost;

    // Model distribution
    const modelDist = getModelDistribution();

    // Tool metrics
    const toolBreakdown = getToolBreakdown();
    const toolSuccessRate = getToolSuccessRate();

    // Average iterations
    const avgIterations = getAverageIterations();

    // Token cache stats
    const cacheStats = getTokenCacheStats();

    // User turns
    const userTurns = context.messages
      ? context.messages.filter((m) => m.role === "user").length
      : 0;

    // Errors
    const llmErrors = metrics.getCounter(COUNTERS.errors, { category: "llm" });

    // Build output
    const lines: string[] = [
      "Session Analytics",
      "==================",
      "",
      "  Overview",
      "  --------",
      `    Duration:       ${duration}`,
      `    Active Model:   ${context.model}`,
      `    Session:        ${context.sessionId ?? "N/A"}`,
      `    User Turns:     ${userTurns}`,
      "",
      "  Token Usage",
      "  -----------",
      `    Input:          ${inputTokens.toLocaleString()}`,
      `    Output:         ${outputTokens.toLocaleString()}`,
      `    Total:          ${totalTokens.toLocaleString()}`,
      `    Est. Cost:      ${formatCost(totalCost)}`,
      "",
    ];

    // Model distribution
    if (modelDist.length > 0) {
      lines.push("  Model Distribution");
      lines.push("  ------------------");
      const totalAllTokens = modelDist.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
      const maxModelNameLen = Math.max(...modelDist.map((m) => m.model.length), 5);

      for (const entry of modelDist) {
        const entryTotal = entry.inputTokens + entry.outputTokens;
        const pct = totalAllTokens > 0 ? (entryTotal / totalAllTokens) * 100 : 0;
        const barLen =
          totalAllTokens > 0 ? Math.max(1, Math.round((entryTotal / totalAllTokens) * 15)) : 0;
        const paddedName = entry.model.padEnd(maxModelNameLen);
        lines.push(`    ${paddedName}  ${formatPercent(pct).padStart(6)}  ${makeBar(barLen, 15)}`);
      }
      lines.push("");
    }

    // Tool usage
    lines.push("  Tool Usage");
    lines.push("  ----------");
    lines.push(`    Total Invocations:  ${toolSuccessRate.total}`);
    lines.push(`    Succeeded:          ${toolSuccessRate.succeeded}`);
    lines.push(`    Failed:             ${toolSuccessRate.failed}`);
    lines.push(`    Success Rate:       ${formatPercent(toolSuccessRate.rate)}`);
    lines.push("");

    if (toolBreakdown.length > 0) {
      lines.push("  Tool Frequency");
      lines.push("  --------------");
      const maxToolCount = toolBreakdown[0].count;
      const maxNameLen = Math.max(...toolBreakdown.map((t) => t.name.length));

      for (const tool of toolBreakdown) {
        const barLen =
          maxToolCount > 0 ? Math.max(1, Math.round((tool.count / maxToolCount) * 12)) : 0;
        const paddedName = tool.name.padEnd(maxNameLen);
        lines.push(`    ${paddedName}  ${String(tool.count).padStart(4)}  ${makeBar(barLen, 12)}`);
      }
      lines.push("");
    }

    // Agent performance
    lines.push("  Agent Performance");
    lines.push("  -----------------");
    lines.push(
      `    Avg Iterations/Request:  ${avgIterations > 0 ? avgIterations.toFixed(1) : "N/A"}`,
    );
    lines.push(`    LLM Errors:              ${llmErrors}`);
    lines.push("");

    // Cache stats
    lines.push("  Token Cache");
    lines.push("  -----------");
    lines.push(`    Size:       ${cacheStats.size} entries`);
    lines.push(`    Hits:       ${cacheStats.hits}`);
    lines.push(`    Misses:     ${cacheStats.misses}`);
    lines.push(`    Hit Rate:   ${formatPercent(cacheStats.hitRate * 100)}`);
    lines.push("");

    // Activity timeline
    lines.push("  Activity Timeline");
    lines.push("  -----------------");

    const durationSec = Math.floor(durationMs / 1000);
    if (userTurns > 0 && durationSec > 0) {
      const turnsPerMin = (userTurns / (durationSec / 60)).toFixed(1);
      const tokensPerMin =
        durationSec >= 60
          ? Math.round(totalTokens / (durationSec / 60)).toLocaleString()
          : totalTokens.toLocaleString();

      lines.push(`    Turns/min:    ${turnsPerMin}`);
      lines.push(
        `    Tokens/min:   ${durationSec >= 60 ? tokensPerMin : `${tokensPerMin} (< 1 min)`}`,
      );
    } else {
      lines.push("    No activity recorded yet.");
    }

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
