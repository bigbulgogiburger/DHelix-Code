/**
 * EvaluateContinuation Stage — 루프 계속/종료 판단
 *
 * Circuit breaker 기록, subagent 자동 재시도, truncated/incomplete 응답 감지,
 * 중복 도구 호출 루프 감지 등을 처리하여 iteration 결과를 결정합니다.
 *
 * @module core/runtime/stages/evaluate-continuation
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ChatMessage } from "../../../llm/provider.js";

const trace = (tag: string, msg: string) => {
  if (process.env.DHELIX_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

/** 파일에 쓰는 도구들 */
const FILE_WRITE_TOOLS = new Set(["file_write", "file_edit"]);

/** 중복 도구 호출 최대 횟수 */
const MAX_DUPLICATE_TOOL_CALLS = 3;

/** Incomplete 응답 최대 재시도 횟수 */
const MAX_INCOMPLETE_RETRIES = 2;

/**
 * 도구 호출의 인자에서 파일 경로를 추출합니다.
 */
function extractFilePath(call: { readonly arguments: unknown }): string | undefined {
  const args = call.arguments as Record<string, unknown>;
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  return undefined;
}

/**
 * EvaluateContinuation stage를 생성합니다.
 *
 * 도구 호출이 없는 경우:
 * - Subagent 자동 재시도 (최대 2회)
 * - Truncated 응답 (finishReason=length) 자동 재시도
 * - Incomplete 응답 자동 재시도
 * - 정상 종료
 *
 * 도구 호출이 있는 경우:
 * - 중복 도구 호출 루프 감지
 * - Circuit breaker 기록
 * - 다음 iteration으로 진행
 *
 * @returns EvaluateContinuation stage 인스턴스
 */
export function createEvaluateContinuationStage(): RuntimeStage {
  return {
    name: "evaluate-continuation",

    async execute(ctx: RuntimeContext): Promise<void> {
      const { config, events, response, extractedCalls, circuitBreaker } = ctx;
      if (!response) return;

      // No tool calls — evaluate completion conditions
      if (extractedCalls.length === 0) {
        // Subagent auto-retry
        if (config.isSubagent && ctx.iteration <= 2) {
          const toolNames = config.toolRegistry
            .getAll()
            .map((t) => t.name)
            .join(", ");
          const nudgeMessage =
            ctx.iteration === 1
              ? `You MUST use your available tools to complete the task. Call a tool now — do not respond with text only. Available tools: ${toolNames}`
              : `CRITICAL: You have NOT called any tools yet. You MUST call one of these tools RIGHT NOW: ${toolNames}. For example, call list_dir with {"path": "."} or glob_search with {"pattern": "**/*.ts"}. Do NOT output any text without a tool call.`;
          trace(
            "evaluate-continuation",
            `Subagent produced no tool calls — injecting retry nudge (attempt ${ctx.iteration}/2)`,
          );
          ctx.messages.push({ role: "user", content: nudgeMessage });
          ctx.shouldContinueLoop = true;
          return;
        }

        // Auto-retry when response was truncated
        if (response.finishReason === "length") {
          events.emit("llm:error", {
            error: new Error(
              "Response truncated due to token limit, retrying with continuation...",
            ),
          });
          const continuationMessage: ChatMessage = {
            role: "user",
            content:
              "[System] Your previous response was cut off due to token limit. " +
              "Please continue exactly from where you left off.",
          };
          ctx.messages.push(continuationMessage);
          ctx.shouldContinueLoop = true;
          return;
        }

        // Auto-retry on incomplete status
        if (response.finishReason === "incomplete") {
          ctx.consecutiveIncompleteResponses++;
          if (ctx.consecutiveIncompleteResponses <= MAX_INCOMPLETE_RETRIES) {
            trace(
              "evaluate-continuation",
              `finishReason=incomplete, retrying (${ctx.consecutiveIncompleteResponses}/${MAX_INCOMPLETE_RETRIES})`,
            );
            events.emit("llm:error", {
              error: new Error(
                `Response incomplete (attempt ${ctx.consecutiveIncompleteResponses}/${MAX_INCOMPLETE_RETRIES}), nudging model to continue...`,
              ),
            });
            const incompleteNudge: ChatMessage = {
              role: "user",
              content:
                "[System] Your response ended with status 'incomplete' and no tool calls. " +
                "The task is NOT finished. Continue working by calling the appropriate tools. " +
                "Do not describe what you plan to do — take action with tools immediately.",
            };
            ctx.messages.push(incompleteNudge);
            ctx.shouldContinueLoop = true;
            return;
          }
        } else {
          ctx.consecutiveIncompleteResponses = 0;
        }

        // Normal completion — no tool calls, conversation turn complete
        // shouldContinueLoop stays false, pipeline returns "complete"
        return;
      }

      // --- Tool calls exist: evaluate continuation ---

      // Duplicate tool call loop detection
      const currentSignature = extractedCalls
        .map((tc) => `${tc.name}:${JSON.stringify(tc.arguments)}`)
        .join("|");
      if (currentSignature === ctx.lastToolCallSignature) {
        ctx.duplicateToolCallCount++;
        if (ctx.duplicateToolCallCount >= MAX_DUPLICATE_TOOL_CALLS) {
          events.emit("llm:error", {
            error: new Error(
              `Duplicate tool call loop detected (${ctx.duplicateToolCallCount} identical calls). Breaking loop.`,
            ),
          });
          const loopBreakMessage: ChatMessage = {
            role: "user",
            content:
              "[System] You are calling the same tool(s) with identical parameters repeatedly. " +
              "This appears to be a loop. Stop calling these tools and provide your final answer " +
              "based on the results you already have.",
          };
          ctx.messages.push(loopBreakMessage);
          ctx.shouldContinueLoop = true;
          return;
        }
      } else {
        ctx.lastToolCallSignature = currentSignature;
        ctx.duplicateToolCallCount = 1;
      }

      // Circuit breaker recording
      const filesModified = new Set<string>();
      for (const call of extractedCalls) {
        if (FILE_WRITE_TOOLS.has(call.name)) {
          const fp = extractFilePath(call);
          if (fp) filesModified.add(fp);
        }
      }

      circuitBreaker.recordIteration({
        filesModified,
        hasOutput: response.content.length > 0 || extractedCalls.length > 0,
        error: ctx.toolResults.some((r) => r.isError)
          ? ctx.toolResults.find((r) => r.isError)?.output
          : undefined,
      });

      if (!circuitBreaker.shouldContinue()) {
        const status = circuitBreaker.getStatus();
        events.emit("llm:error", {
          error: new Error(
            `Circuit breaker opened: ${status.reason ?? "No progress detected"}`,
          ),
        });
      }

      // Mark for continuation — tool results need to be sent to LLM
      ctx.shouldContinueLoop = true;
    },
  };
}
