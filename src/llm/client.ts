import OpenAI from "openai";
import {
  type LLMProvider,
  type ChatRequest,
  type ChatResponse,
  type ChatChunk,
  type ChatMessage,
  type ToolCallRequest,
  type ToolDefinitionForLLM,
} from "./provider.js";
import { countTokens } from "./token-counter.js";
import { LLMError } from "../utils/error.js";
import { getModelCapabilities, type ModelCapabilities } from "./model-capabilities.js";

/**
 * Convert our ChatMessage to OpenAI format, adapting for model capabilities.
 */
function toOpenAIMessages(
  messages: readonly ChatMessage[],
  capabilities: ModelCapabilities,
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    if (msg.role === "tool") {
      return {
        role: "tool" as const,
        content: msg.content,
        tool_call_id: msg.toolCallId ?? "",
      };
    }
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: "assistant" as const,
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    // o1/o3 models: convert system messages to developer role
    if (msg.role === "system" && capabilities.useDeveloperRole) {
      return {
        role: "developer" as const,
        content: msg.content,
      } as OpenAI.ChatCompletionMessageParam;
    }
    // Models that don't support system messages: convert to user messages
    if (
      msg.role === "system" &&
      !capabilities.supportsSystemMessage &&
      !capabilities.useDeveloperRole
    ) {
      return {
        role: "user" as const,
        content: `[System instructions]\n${msg.content}`,
      };
    }
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    };
  });
}

/** Convert our tool definitions to OpenAI format */
function toOpenAITools(tools: readonly ToolDefinitionForLLM[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as Record<string, unknown>,
    },
  }));
}

/** Configuration for OpenAI-compatible client */
export interface OpenAIClientConfig {
  readonly baseURL: string;
  readonly apiKey?: string;
  readonly timeout?: number;
}

/**
 * OpenAI-compatible LLM client.
 * Works with any OpenAI-compatible API (OpenAI, Ollama, vLLM, llama.cpp, etc.)
 */
export class OpenAICompatibleClient implements LLMProvider {
  readonly name = "openai-compatible";
  private readonly client: OpenAI;

  constructor(config: OpenAIClientConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey ?? "no-key-required",
      timeout: config.timeout ?? 60_000,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const caps = getModelCapabilities(request.model);
      const params: Record<string, unknown> = {
        model: request.model,
        messages: toOpenAIMessages(request.messages, caps),
        max_tokens: request.maxTokens,
      };
      // Only include temperature for models that support it
      if (caps.supportsTemperature && request.temperature !== undefined) {
        params.temperature = request.temperature;
      }
      // Only include tools for models that support them
      if (caps.supportsTools && request.tools) {
        params.tools = toOpenAITools(request.tools);
      }
      const response = await this.client.chat.completions.create(
        params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
        { signal: request.signal },
      );

      const choice = response.choices[0];
      if (!choice) {
        throw new LLMError("No response choice from LLM");
      }

      const toolCalls: ToolCallRequest[] =
        choice.message.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })) ?? [];

      return {
        content: choice.message.content ?? "",
        toolCalls,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        finishReason: choice.finish_reason ?? "stop",
      };
    } catch (error) {
      if (error instanceof LLMError) throw error;
      throw new LLMError("LLM chat request failed", {
        model: request.model,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    try {
      const caps = getModelCapabilities(request.model);
      const params: Record<string, unknown> = {
        model: request.model,
        messages: toOpenAIMessages(request.messages, caps),
        max_tokens: request.maxTokens,
        stream: true,
      };
      if (caps.supportsTemperature && request.temperature !== undefined) {
        params.temperature = request.temperature;
      }
      if (caps.supportsTools && request.tools) {
        params.tools = toOpenAITools(request.tools);
      }
      const stream = await this.client.chat.completions.create(
        params as unknown as OpenAI.ChatCompletionCreateParamsStreaming,
        { signal: request.signal },
      );

      const toolCallsInProgress = new Map<
        number,
        { id: string; name: string; arguments: string }
      >();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // Text content
        if (delta.content) {
          yield { type: "text-delta", text: delta.content };
        }

        // Tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallsInProgress.get(tc.index);
            if (existing) {
              existing.arguments += tc.function?.arguments ?? "";
            } else {
              toolCallsInProgress.set(tc.index, {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              });
            }
            yield {
              type: "tool-call-delta",
              toolCall: {
                id: tc.id ?? existing?.id,
                name: tc.function?.name ?? existing?.name,
                arguments: tc.function?.arguments ?? "",
              },
            };
          }
        }
      }

      yield {
        type: "done",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    } catch (error) {
      throw new LLMError("LLM stream request failed", {
        model: request.model,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  countTokens(text: string): number {
    return countTokens(text);
  }
}
