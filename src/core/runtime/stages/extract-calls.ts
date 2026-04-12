/**
 * ExtractCalls Stage — 도구 호출 추출, 검증, fallback, doom loop 감지
 *
 * LLM 응답에서 도구 호출을 추출하고, 유효성을 검증하며,
 * 빈 응답/incomplete 응답/중복 호출 등의 이상 상태를 감지합니다.
 *
 * @module core/runtime/stages/extract-calls
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ExtractedToolCall } from "../../../tools/types.js";
import { type ChatMessage } from "../../../llm/provider.js";
import { filterValidToolCalls } from "../../tool-call-utils.js";

const trace = (tag: string, msg: string) => {
  if (process.env.DHELIX_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

/** 빈 응답 최대 재시도 횟수 */
const MAX_EMPTY_RESPONSE_RETRIES = 2;

/**
 * ExtractCalls stage를 생성합니다.
 *
 * 추출 로직, fallback (native toolCalls → direct extraction),
 * 빈 응답/incomplete 응답 감지, subagent 자동 재시도를 처리합니다.
 * shouldContinueLoop를 true로 설정하면 pipeline이 이번 iteration을 중단하고
 * 다음 iteration으로 진행합니다.
 *
 * @returns ExtractCalls stage 인스턴스
 */
export function createExtractCallsStage(): RuntimeStage {
  return {
    name: "extract-calls",

    async execute(ctx: RuntimeContext): Promise<void> {
      const { events, strategy, response } = ctx;
      if (!response) return;

      // Extract tool calls and filter out incomplete ones
      const rawExtractedCalls = strategy.extractToolCalls(response.content, response.toolCalls);
      let extractedCalls = filterValidToolCalls(rawExtractedCalls, events);

      // Fallback: direct extraction from native toolCalls
      if (extractedCalls.length === 0 && response.toolCalls.length > 0) {
        const fallbackCalls: ExtractedToolCall[] = response.toolCalls.map((tc) => {
          let args: Record<string, unknown>;
          try {
            args =
              typeof tc.arguments === "string"
                ? (JSON.parse(tc.arguments) as Record<string, unknown>)
                : ((tc.arguments as Record<string, unknown>) ?? {});
          } catch {
            args = {};
          }
          return { id: tc.id, name: tc.name, arguments: args };
        });
        const validFallback = filterValidToolCalls(fallbackCalls, events);
        if (validFallback.length > 0) {
          extractedCalls = validFallback;
        }
      }

      trace(
        "extract-calls",
        `extractedCalls=${extractedCalls.length} (raw=${rawExtractedCalls.length})`,
      );

      // All tool calls had invalid JSON — inject feedback and retry
      if (rawExtractedCalls.length > 0 && extractedCalls.length === 0) {
        const droppedNames = rawExtractedCalls.map((tc) => tc.name).join(", ");
        const errorFeedback: ChatMessage = {
          role: "user",
          content:
            `[System] Your tool calls (${droppedNames}) had invalid or incomplete JSON arguments ` +
            `and were dropped. Please retry with valid, complete JSON arguments.`,
        };
        ctx.messages.push(errorFeedback);
        ctx.extractedCalls = [];
        ctx.shouldContinueLoop = true;
        return;
      }

      // HeadlessGuard: empty response detection
      if (response.content.trim() === "" && extractedCalls.length === 0) {
        ctx.consecutiveEmptyResponses++;
        if (ctx.consecutiveEmptyResponses <= MAX_EMPTY_RESPONSE_RETRIES) {
          events.emit("llm:error", {
            error: new Error(
              `Empty response detected (attempt ${ctx.consecutiveEmptyResponses}/${MAX_EMPTY_RESPONSE_RETRIES}), retrying...`,
            ),
          });
          const nudgeMessage: ChatMessage = {
            role: "user",
            content:
              "[System] Your previous response was empty. Please complete the requested task. " +
              "Provide a substantive response with your answer or explanation.",
          };
          ctx.messages.push(nudgeMessage);
          ctx.extractedCalls = [];
          ctx.shouldContinueLoop = true;
          return;
        }
      } else {
        ctx.consecutiveEmptyResponses = 0;
      }

      // Emit assistant message event
      events.emit("agent:assistant-message", {
        content: response.content,
        toolCalls: extractedCalls.map((tc) => ({ id: tc.id, name: tc.name })),
        iteration: ctx.iteration,
        isFinal: extractedCalls.length === 0,
      });

      ctx.extractedCalls = extractedCalls;
    },
  };
}
