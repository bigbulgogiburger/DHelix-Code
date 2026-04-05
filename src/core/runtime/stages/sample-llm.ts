/**
 * SampleLLM Stage — LLM 호출 (스트리밍/비스트리밍) + 재시도 로직
 *
 * agent-loop에서 가장 큰 영역으로, LLM API 호출, 에러 분류,
 * 재시도 로직, recovery strategy 실행을 담당합니다.
 *
 * @module core/runtime/stages/sample-llm
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ChatResponse } from "../../../llm/provider.js";
import { LLMError } from "../../../utils/error.js";
import { consumeStream } from "../../../llm/streaming.js";
import { findRecoveryStrategy } from "../../recovery-strategy.js";
import { executeRecovery } from "../../recovery-executor.js";

/**
 * LLM 에러 분류 — 재시도 전략을 결정하는 데 사용
 */
type LLMErrorClass = "transient" | "overload" | "permanent";

/**
 * LLM 에러를 분류하여 재시도 전략을 결정합니다.
 *
 * @param error - 발생한 에러
 * @returns 에러 분류
 */
function classifyLLMError(error: unknown): LLMErrorClass {
  if (!(error instanceof Error)) return "permanent";

  const message = error.message.toLowerCase();

  if (message.includes("request too large") || message.includes("too many tokens")) {
    return "permanent";
  }

  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("overload") ||
    message.includes("503") ||
    message.includes("capacity")
  ) {
    return "overload";
  }

  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("network")
  ) {
    return "transient";
  }

  return "permanent";
}

/**
 * AbortSignal을 존중하면서 지정된 시간만큼 대기합니다.
 *
 * @param ms - 대기할 밀리초
 * @param signal - 취소 신호
 */
function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new LLMError("Aborted"));
    });
  });
}

/**
 * SampleLLM stage를 생성합니다.
 *
 * 스트리밍/비스트리밍 모드를 지원하며, transient 에러에 대한
 * 지수 백오프 재시도, recovery strategy 실행을 처리합니다.
 *
 * @returns SampleLLM stage 인스턴스
 */
export function createSampleLLMStage(): RuntimeStage {
  return {
    name: "sample-llm",

    async execute(ctx: RuntimeContext): Promise<void> {
      const { config, events, activeClient, activeModel } = ctx;

      events.emit("llm:start", { iteration: ctx.iteration });

      const chatRequest = {
        model: activeModel,
        messages: ctx.preparedMessages,
        tools: ctx.preparedTools,
        temperature: config.temperature ?? 0,
        maxTokens: config.maxTokens ?? 4096,
        signal: config.signal,
        thinking: config.thinking,
      };

      let response: ChatResponse | undefined;
      let lastError: unknown;

      for (let attempt = 0; attempt <= ctx.maxRetries; attempt++) {
        try {
          if (config.useStreaming) {
            const stream = activeClient.stream(chatRequest);
            const accumulated = await consumeStream(stream, {
              onTextDelta: (text) => {
                events.emit("llm:text-delta", { text });
              },
              onThinkingDelta: (text) => {
                events.emit("llm:thinking-delta", { text });
              },
              onUsage: (usage) => {
                events.emit("llm:usage", { usage, model: activeModel });
              },
            });

            if (accumulated.partial) {
              if (accumulated.text.length === 0 && accumulated.toolCalls.length === 0) {
                throw new LLMError("Stream disconnected with no recoverable content");
              }
              events.emit("llm:error", {
                error: new Error("Stream disconnected mid-response; using partial content"),
              });
            }

            response = {
              content: accumulated.text,
              toolCalls: accumulated.toolCalls,
              usage: accumulated.usage ?? {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
              },
              finishReason: accumulated.finishReason ?? (accumulated.partial ? "length" : "stop"),
            };
          } else {
            response = await activeClient.chat(chatRequest);
          }
          break;
        } catch (error) {
          lastError = error;
          const errorClass = classifyLLMError(error);

          // Check recovery strategies
          if (error instanceof Error) {
            const recovery = findRecoveryStrategy(error);
            if (recovery) {
              events.emit("llm:error", {
                error: new Error(`Recovery strategy: ${recovery.description}`),
              });

              if (recovery.action === "retry" && recovery.backoffMs) {
                events.emit("agent:retry", {
                  delayMs: recovery.backoffMs * Math.pow(2, attempt),
                  reason: recovery.description,
                  attempt: attempt + 1,
                  maxRetries: recovery.maxRetries,
                });
              }

              try {
                const recoveryResult = await executeRecovery(recovery, error, ctx.messages, {
                  maxContextTokens: config.maxContextTokens,
                  signal: config.signal,
                });
                if (recoveryResult.action === "retry") {
                  if (recoveryResult.messages) {
                    ctx.messages.length = 0;
                    ctx.messages.push(...recoveryResult.messages);
                  }
                  continue;
                }
              } catch {
                // Recovery failed — fall through to normal error handling
              }
            }
          }

          if (errorClass === "overload" || errorClass === "permanent") {
            throw error;
          }

          if (attempt < ctx.maxRetries) {
            ctx.usageAggregator.recordRetry();
            const delay = 1000 * Math.pow(2, attempt);
            events.emit("llm:error", {
              error: error instanceof Error ? error : new Error(String(error)),
            });
            events.emit("agent:retry", {
              delayMs: delay,
              reason: error instanceof Error ? error.message : String(error),
              attempt: attempt + 1,
              maxRetries: ctx.maxRetries,
            });
            await waitWithAbort(delay, config.signal);
          }
        }
      }

      if (!response) {
        throw lastError instanceof LLMError
          ? lastError
          : new LLMError("LLM call failed after retries", {
              cause: lastError instanceof Error ? lastError.message : String(lastError),
              attempts: ctx.maxRetries + 1,
            });
      }

      events.emit("llm:complete", { tokenCount: response.usage.totalTokens });

      // Record usage
      ctx.usageAggregator.recordLLMUsage(response.usage);
      const runningUsage = ctx.usageAggregator.snapshot();
      events.emit("agent:usage-update", {
        promptTokens: runningUsage.totalPromptTokens,
        completionTokens: runningUsage.totalCompletionTokens,
        totalTokens: runningUsage.totalTokens,
        iteration: ctx.iteration,
      });

      // Append assistant message
      const assistantMessage = {
        role: "assistant" as const,
        content: response.content,
        toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
      };
      ctx.messages.push(assistantMessage);

      ctx.response = response;
    },
  };
}
