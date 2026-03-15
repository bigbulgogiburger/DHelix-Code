/**
 * useStreaming.ts — LLM 스트리밍 상태를 관리하는 React 훅
 *
 * LLM에 메시지를 보내고 응답을 실시간 스트리밍으로 받아
 * streamingText 상태에 축적합니다. AbortController를 사용하여
 * 진행 중인 스트리밍을 취소할 수 있습니다.
 *
 * 참고: 현재 메인 에이전트 루프는 useAgentLoop에서 직접 스트리밍을
 * 처리하므로, 이 훅은 독립적인 스트리밍이 필요한 경우에 사용됩니다.
 */
import { useState, useCallback, useRef } from "react";
import { type LLMProvider, type ChatMessage } from "../../llm/provider.js";
import {
  consumeStream,
  type StreamAccumulator,
  createStreamAccumulator,
} from "../../llm/streaming.js";

/**
 * @param client - LLM 프로바이더 (stream() 메서드를 가진 객체)
 * @param model - 사용할 모델명
 * @param temperature - 응답의 무작위성 (0=결정적, 1=창의적, 기본값: 0)
 * @param maxTokens - 최대 응답 토큰 수 (기본값: 4096)
 */
interface UseStreamingOptions {
  readonly client: LLMProvider;
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/**
 * useStreaming 훅의 반환값
 * @param streamingText - 현재까지 축적된 스트리밍 텍스트
 * @param isStreaming - 스트리밍 진행 중 여부
 * @param error - 에러 메시지 (에러 발생 시)
 * @param sendMessage - 메시지를 보내고 스트리밍을 시작하는 함수
 * @param abort - 진행 중인 스트리밍을 취소하는 함수
 */
interface UseStreamingResult {
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly error: string | undefined;
  readonly sendMessage: (messages: readonly ChatMessage[]) => Promise<StreamAccumulator>;
  readonly abort: () => void;
}

/**
 * LLM 스트리밍 상태 관리 훅
 *
 * sendMessage()를 호출하면 LLM에 메시지를 보내고 스트리밍을 시작합니다.
 * 텍스트 청크가 도착할 때마다 streamingText가 업데이트됩니다.
 * abort()로 중단하면 AbortError를 무시하고 빈 결과를 반환합니다.
 */
export function useStreaming(options: UseStreamingOptions): UseStreamingResult {
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (messages: readonly ChatMessage[]): Promise<StreamAccumulator> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsStreaming(true);
      setStreamingText("");
      setError(undefined);

      try {
        const stream = options.client.stream({
          model: options.model,
          messages,
          temperature: options.temperature ?? 0,
          maxTokens: options.maxTokens ?? 4096,
          signal: controller.signal,
        });

        const result = await consumeStream(stream, {
          onTextDelta: (text) => {
            setStreamingText((prev) => prev + text);
          },
        });

        return result;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return createStreamAccumulator();
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return createStreamAccumulator();
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [options.client, options.model, options.temperature, options.maxTokens],
  );

  return { streamingText, isStreaming, error, sendMessage, abort };
}
