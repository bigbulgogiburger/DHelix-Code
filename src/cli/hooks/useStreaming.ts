import { useState, useCallback, useRef } from "react";
import { type LLMProvider, type ChatMessage } from "../../llm/provider.js";
import {
  consumeStream,
  type StreamAccumulator,
  createStreamAccumulator,
} from "../../llm/streaming.js";

interface UseStreamingOptions {
  readonly client: LLMProvider;
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

interface UseStreamingResult {
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly error: string | undefined;
  readonly sendMessage: (messages: readonly ChatMessage[]) => Promise<StreamAccumulator>;
  readonly abort: () => void;
}

/** Hook for managing LLM streaming state */
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
