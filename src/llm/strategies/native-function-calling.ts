import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "../provider.js";
import { type ToolCallStrategy, type PreparedRequest } from "../tool-call-strategy.js";
import { type ExtractedToolCall } from "../../tools/types.js";

/**
 * Native function calling strategy — uses OpenAI-style tool_calls.
 * Works with models that support the `tools` parameter in chat completions.
 */
export class NativeFunctionCallingStrategy implements ToolCallStrategy {
  readonly name = "native" as const;

  prepareRequest(
    messages: readonly ChatMessage[],
    tools: readonly ToolDefinitionForLLM[],
  ): PreparedRequest {
    return { messages, tools };
  }

  extractToolCalls(
    _content: string,
    toolCalls: readonly ToolCallRequest[],
  ): readonly ExtractedToolCall[] {
    return toolCalls.map((tc) => {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.arguments) as Record<string, unknown>;
      } catch {
        if (process.env.DBCODE_VERBOSE) {
          process.stderr.write(
            `[native-function-calling] Failed to parse tool arguments for "${tc.name}" (id: ${tc.id}): ${tc.arguments}\n`,
          );
        }
        args = {};
      }
      return {
        id: tc.id,
        name: tc.name,
        arguments: args,
      };
    });
  }

  formatToolResults(
    results: readonly { id: string; output: string; isError: boolean }[],
  ): readonly ChatMessage[] {
    return results.map((result) => ({
      role: "tool" as const,
      content: result.isError ? `Error: ${result.output}` : result.output,
      toolCallId: result.id,
    }));
  }
}
