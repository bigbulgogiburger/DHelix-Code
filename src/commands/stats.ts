/**
 * /stats 명령어 핸들러 — 세션 통계 표시
 *
 * 사용자가 /stats를 입력하면 현재 세션의 종합 사용 통계를 보여줍니다.
 *
 * 표시 정보:
 *   - 세션 지속 시간, 활성 모델, 세션 ID
 *   - 토큰 사용량 (입력/출력 비율을 시각적 막대로)
 *   - 예상 비용
 *   - 도구별 사용 빈도 (시각적 막대 차트)
 *   - 사용자 턴 수, 에러 횟수
 *
 * /analytics보다 간결한 요약을 제공합니다.
 *
 * 이 파일은 formatDuration, getToolBreakdown 등 다른 명령어에서도
 * 재사용되는 유틸리티 함수도 export합니다.
 */
import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS } from "../telemetry/metrics.js";

/** 세션 시작 시각 — 세션 지속 시간 계산에 사용 */
const sessionStartedAt = Date.now();

/**
 * 밀리초 단위의 시간을 사람이 읽기 쉬운 형식으로 변환하는 함수
 *
 * @param ms - 밀리초 단위 시간
 * @returns 포맷된 문자열 (예: "2h 15m 30s", "45m 12s", "30s")
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * 블록 문자(\u2588)로 시각적 막대를 생성하는 함수
 *
 * @param length - 막대 길이 (반복 횟수)
 * @returns 블록 문자열
 */
function makeBar(length: number): string {
  return "\u2588".repeat(length);
}

/** 분석할 도구(tool) 이름 목록 — 메트릭에서 사용량을 확인할 도구들 */
const KNOWN_TOOLS: readonly string[] = [
  "file_read",
  "file_edit",
  "file_write",
  "bash_exec",
  "grep_search",
  "glob_search",
  "list_dir",
  "web_search",
  "web_fetch",
  "notebook_edit",
  "mcp_tool",
  "agent",
  "task",
] as const;

/**
 * 메트릭에서 도구별 호출 횟수를 수집하는 함수
 *
 * 알려진 도구 목록(KNOWN_TOOLS)을 먼저 확인한 후,
 * 카운터 데이터에서 추가 도구도 스캔합니다.
 * 결과는 호출 횟수 내림차순으로 정렬됩니다.
 *
 * @returns 도구명과 호출 횟수의 배열
 */
export function getToolBreakdown(): ReadonlyArray<{
  readonly name: string;
  readonly count: number;
}> {
  const toolCounts: Array<{ readonly name: string; readonly count: number }> = [];

  // Check known tools first
  for (const toolName of KNOWN_TOOLS) {
    const count = metrics.getCounter(COUNTERS.toolInvocations, {
      tool: toolName,
      status: "success",
    });
    if (count > 0) {
      toolCounts.push({ name: toolName, count });
    }
  }

  // Also scan counter data for any tools not in the known list
  const counterData = metrics.getCounterData();
  const toolPrefix = COUNTERS.toolInvocations.name;
  const knownSet = new Set(KNOWN_TOOLS);

  for (const key of counterData.keys()) {
    if (!key.startsWith(toolPrefix)) continue;
    // Key format: dhelix.tools.invocations{status=success,tool=xyz}
    const toolMatch = key.match(/tool=([^,}]+)/);
    const statusMatch = key.match(/status=success/);
    if (toolMatch && statusMatch) {
      const toolName = toolMatch[1];
      if (toolName === "*" || knownSet.has(toolName)) continue;
      const values = counterData.get(key);
      if (values && values.length > 0) {
        const count = values[values.length - 1].value;
        if (count > 0) {
          toolCounts.push({ name: toolName, count });
        }
      }
    }
  }

  // Sort by count descending
  return [...toolCounts].sort((a, b) => b.count - a.count);
}

/**
 * /stats 슬래시 명령어 정의 — 세션 종합 통계 표시
 *
 * 지속 시간, 모델, 토큰 사용량, 비용, 도구 사용 빈도,
 * 사용자 턴 수, 에러 횟수를 시각적 막대와 함께 보여줍니다.
 */
export const statsCommand: SlashCommand = {
  name: "stats",
  description: "Show usage statistics",
  usage: "/stats",
  execute: async (_args, context) => {
    // Duration
    const durationMs = Date.now() - sessionStartedAt;
    const duration = formatDuration(durationMs);

    // Tokens
    const tokensInput = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "input",
      model: context.model,
    });
    const tokensOutput = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "output",
      model: context.model,
    });
    const totalTokens = tokensInput + tokensOutput;

    // Cost
    const totalCost = metrics.getCounter(COUNTERS.tokenCost, { model: context.model });

    // Tool usage
    const totalTools = metrics.getCounter(COUNTERS.toolInvocations, {
      tool: "*",
      status: "success",
    });
    const toolBreakdown = getToolBreakdown();

    // User turns (from messages)
    const userTurns = context.messages
      ? context.messages.filter((m) => m.role === "user").length
      : 0;

    // Errors
    const totalErrors = metrics.getCounter(COUNTERS.errors, { category: "llm" });

    // Build visual bars for tokens
    const maxBar = 30;
    const inputBar = totalTokens > 0 ? Math.round((tokensInput / totalTokens) * maxBar) : 0;
    const outputBar = totalTokens > 0 ? Math.round((tokensOutput / totalTokens) * maxBar) : 0;

    const lines: string[] = [
      "Session Statistics",
      "==================",
      "",
      `  Duration:    ${duration}`,
      `  Model:       ${context.model}`,
      `  Session:     ${context.sessionId ?? "N/A"}`,
      "",
      "  Tokens:",
      `    Input:     ${tokensInput.toLocaleString().padEnd(10)} ${makeBar(inputBar)}`,
      `    Output:    ${tokensOutput.toLocaleString().padEnd(10)} ${makeBar(outputBar)}`,
      `    Total:     ${totalTokens.toLocaleString()}`,
      "",
      `  Cost:        $${totalCost.toFixed(2)}`,
      "",
      `  Tool Usage:  ${totalTools} invocations`,
    ];

    // Tool breakdown with visual bars
    if (toolBreakdown.length > 0) {
      const maxToolCount = toolBreakdown[0].count;
      const maxToolBar = 14;
      const maxNameLen = Math.max(...toolBreakdown.map((t) => t.name.length));

      for (const tool of toolBreakdown) {
        const barLen =
          maxToolCount > 0 ? Math.max(1, Math.round((tool.count / maxToolCount) * maxToolBar)) : 0;
        const paddedName = tool.name.padEnd(maxNameLen);
        lines.push(`    ${paddedName}  ${String(tool.count).padStart(4)}  ${makeBar(barLen)}`);
      }
    }

    lines.push("");
    lines.push(`  Turns:       ${userTurns} (user messages)`);
    lines.push(`  Errors:      ${totalErrors}`);

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
