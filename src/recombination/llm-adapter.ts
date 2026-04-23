/**
 * Default LLM adapter for the recombination pipeline.
 *
 * Wraps `OpenAICompatibleClient.chat(...)` into the narrower
 * {@link LLMCompletionFn} shape defined by `./types.ts`, so every team
 * can reuse the same client without owning the OpenAI SDK vocabulary.
 *
 * Layer: Core → Infrastructure boundary. Consumers inject the returned
 * function into {@link ExecutorDeps}, so no other module needs to import
 * the LLM client directly.
 */
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { OpenAICompatibleClient } from "../llm/client.js";
import type { ChatMessage } from "../llm/provider.js";
import type { LLMCompletionFn, LLMCompletionRequest } from "./types.js";

/** Construction parameters for {@link createDefaultLLM}. */
export interface DefaultLLMConfig {
  readonly model: string;
  readonly baseURL: string;
  readonly apiKey?: string;
  readonly apiKeyHeader?: string;
  readonly timeoutMs?: number;
}

/** Build a {@link LLMCompletionFn} backed by a real OpenAI-compatible server. */
export function createDefaultLLM(config: DefaultLLMConfig): LLMCompletionFn {
  const client = new OpenAICompatibleClient({
    baseURL: config.baseURL,
    ...(config.apiKey !== undefined ? { apiKey: config.apiKey } : {}),
    ...(config.apiKeyHeader !== undefined ? { apiKeyHeader: config.apiKeyHeader } : {}),
    ...(config.timeoutMs !== undefined ? { timeout: config.timeoutMs } : {}),
  });
  const caps = getModelCapabilities(config.model);
  const preferJsonMode = caps.supportsJsonMode;

  return async function completion(req: LLMCompletionRequest): Promise<string> {
    if (req.signal?.aborted) {
      throw new Error("LLM completion aborted");
    }

    const wantJson = req.jsonMode === true;
    const messages: ChatMessage[] = [];

    // When json mode is requested but the server does not natively honour
    // `response_format`, append an explicit JSON-only suffix to the user
    // prompt. This matches the P-1.19 fallback plan for tier B models.
    const systemContent = wantJson && !preferJsonMode
      ? req.system +
        "\n\nRespond with a single valid JSON object. Do not wrap the output in Markdown code fences."
      : req.system;

    if (systemContent.trim() !== "") {
      messages.push({ role: "system", content: systemContent });
    }
    messages.push({ role: "user", content: req.user });

    const response = await client.chat({
      model: config.model,
      messages,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.maxTokens !== undefined ? { maxTokens: req.maxTokens } : {}),
      ...(req.signal !== undefined ? { signal: req.signal } : {}),
    });
    return response.content;
  };
}
