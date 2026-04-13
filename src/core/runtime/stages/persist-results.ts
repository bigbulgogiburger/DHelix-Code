/**
 * PersistResults Stage — 도구 결과를 메시지에 추가하고 이벤트를 발생시킵니다.
 *
 * 도구 실행 결과를 토큰/문자 예산에 맞게 잘라내고,
 * ToolCallStrategy를 사용하여 메시지 형식으로 변환한 뒤
 * 메시지 히스토리에 추가합니다. MCP 도구 실패 시 recovery guidance도 주입합니다.
 *
 * @module core/runtime/stages/persist-results
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ToolCallResult } from "../../../tools/types.js";
import { type ChatMessage } from "../../../llm/provider.js";
import { countTokens } from "../../../llm/token-counter.js";
import { extractFilePath } from "../../tool-call-utils.js";

/**
 * 도구 결과를 토큰 예산에 맞게 잘라냅니다.
 *
 * @param result - 잘라낼 도구 결과
 * @param maxChars - 최대 문자 수
 * @param maxTokens - 최대 토큰 수 (설정 시 토큰 기반 잘라내기 사용)
 * @returns 잘라내진 도구 결과
 */
function truncateToolResult(
  result: ToolCallResult,
  maxChars: number,
  maxTokens?: number,
): ToolCallResult {
  if (maxTokens !== undefined) {
    const tokenCount = countTokens(result.output);
    if (tokenCount <= maxTokens) return result;

    let charLimit = Math.floor(maxTokens * 3);
    let truncated = result.output.slice(0, charLimit);
    let truncatedTokens = countTokens(truncated);

    while (truncatedTokens > maxTokens && charLimit > 100) {
      charLimit = Math.floor(charLimit * 0.8);
      truncated = result.output.slice(0, charLimit);
      truncatedTokens = countTokens(truncated);
    }

    return {
      ...result,
      output:
        truncated + `\n\n[... truncated, showing ~${truncatedTokens} of ${tokenCount} tokens]`,
    };
  }

  if (result.output.length <= maxChars) return result;
  return {
    ...result,
    output:
      result.output.slice(0, maxChars) +
      `\n\n[... truncated, showing first ${maxChars} of ${result.output.length} chars]`,
  };
}

/**
 * PersistResults stage를 생성합니다.
 *
 * 1. 도구 사용량을 usage aggregator에 기록
 * 2. 파일 접근을 context manager에 추적
 * 3. 도구 결과를 토큰/문자 예산에 맞게 잘라내기
 * 4. 메시지 히스토리에 도구 결과 추가
 * 5. MCP 도구 실패 시 recovery guidance 주입
 *
 * @returns PersistResults stage 인스턴스
 */
export function createPersistResultsStage(): RuntimeStage {
  return {
    name: "persist-results",

    async execute(ctx: RuntimeContext): Promise<void> {
      if (ctx.toolResults.length === 0) return;

      const { strategy, contextManager, config } = ctx;

      // Record tool call count
      ctx.usageAggregator.recordToolCalls(ctx.extractedCalls.length);

      // Track file accesses for context manager rehydration
      for (const call of ctx.extractedCalls) {
        if (call.name === "file_read" || call.name === "file_edit" || call.name === "file_write") {
          const filePath = extractFilePath(call);
          if (filePath) {
            contextManager.trackFileAccess(filePath);
          }
        }
      }

      // Truncate oversized tool results
      const truncatedResults = ctx.toolResults.map((r) =>
        truncateToolResult(r, ctx.maxToolResultChars, config.maxToolResultTokens),
      );

      // Append tool results as messages
      const toolMessages = strategy.formatToolResults(truncatedResults);
      ctx.messages.push(...toolMessages);

      // MCP tool failure detection → inject recovery guidance
      const mcpFailures = ctx.toolResults.filter((r) => r.isError && r.name.startsWith("mcp__"));
      if (mcpFailures.length > 0) {
        const failedToolNames = mcpFailures.map((r) => r.name).join(", ");
        const hasTimeout = mcpFailures.some(
          (r) =>
            r.metadata?.mcpErrorType === "timeout" || r.output.toLowerCase().includes("timed out"),
        );
        const hasDenial = mcpFailures.some((r) =>
          r.output.toLowerCase().includes("permission denied"),
        );

        let guidance = `[System] ${mcpFailures.length} MCP tool(s) failed: ${failedToolNames}. `;
        if (hasTimeout) {
          guidance += "At least one tool timed out. Do NOT retry the same call. ";
        }
        if (hasDenial) {
          guidance += "At least one tool was denied by the user. Do NOT retry denied tools. ";
        }
        guidance +=
          "You MUST: (1) Acknowledge the failure to the user, " +
          "(2) Explain what you were trying to do, " +
          "(3) Suggest an alternative approach or ask the user how to proceed.";

        const recoveryGuidance: ChatMessage = {
          role: "user",
          content: guidance,
        };
        ctx.messages.push(recoveryGuidance);
      }
    },
  };
}
