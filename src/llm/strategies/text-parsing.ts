import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "../provider.js";
import { type ToolCallStrategy, type PreparedRequest } from "../tool-call-strategy.js";
import { type ExtractedToolCall } from "../../tools/types.js";

/**
 * Regex to extract XML tool calls from LLM text output.
 *
 * Expected format:
 * ```
 * <tool_call>
 * <name>tool_name</name>
 * <arguments>{"param": "value"}</arguments>
 * </tool_call>
 * ```
 */
const TOOL_CALL_PATTERN =
  /<tool_call>\s*<name>([\s\S]*?)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_call>/g;

/** Counter for generating unique tool call IDs */
let callIdCounter = 0;

/**
 * Generate a unique tool call ID for text-parsed calls.
 */
function generateCallId(): string {
  callIdCounter++;
  return `tc_text_${Date.now()}_${callIdCounter}`;
}

/**
 * Format tool definitions as text instructions for models
 * that don't support native function calling.
 */
function formatToolInstructions(tools: readonly ToolDefinitionForLLM[]): string {
  const lines: string[] = [
    "You have access to the following tools. To use a tool, respond with the XML format shown below.",
    "",
    "## Available Tools",
    "",
  ];

  for (const tool of tools) {
    lines.push(`### ${tool.function.name}`);
    lines.push(tool.function.description);
    lines.push(`Parameters: ${JSON.stringify(tool.function.parameters, null, 2)}`);
    lines.push("");
  }

  lines.push("## How to use tools");
  lines.push("");
  lines.push("To call a tool, include the following XML in your response:");
  lines.push("```xml");
  lines.push("<tool_call>");
  lines.push("<name>tool_name</name>");
  lines.push('<arguments>{"param1": "value1"}</arguments>');
  lines.push("</tool_call>");
  lines.push("```");
  lines.push("");
  lines.push(
    "You can call multiple tools in a single response by including multiple <tool_call> blocks.",
  );
  lines.push("Write your reasoning and explanation BEFORE any tool calls.");

  return lines.join("\n");
}

/**
 * Text parsing strategy — parses XML-formatted tool calls from text output.
 * Fallback for models that don't support native function calling (e.g., some Ollama models).
 *
 * Injects tool definitions as a system prompt and extracts tool calls from
 * XML blocks in the assistant's text response.
 */
export class TextParsingStrategy implements ToolCallStrategy {
  readonly name = "text-parsing" as const;

  prepareRequest(
    messages: readonly ChatMessage[],
    tools: readonly ToolDefinitionForLLM[],
  ): PreparedRequest {
    if (tools.length === 0) {
      return { messages };
    }

    // Inject tool instructions as a system message
    const toolInstructions = formatToolInstructions(tools);
    const toolSystemMessage: ChatMessage = {
      role: "system",
      content: toolInstructions,
    };

    // Find the first non-system message index to insert after existing system messages
    const firstNonSystemIdx = messages.findIndex((m) => m.role !== "system");
    const insertIdx = firstNonSystemIdx === -1 ? messages.length : firstNonSystemIdx;

    const preparedMessages: ChatMessage[] = [
      ...messages.slice(0, insertIdx),
      toolSystemMessage,
      ...messages.slice(insertIdx),
    ];

    // Don't pass tools to the API — they're embedded in the prompt
    return { messages: preparedMessages };
  }

  extractToolCalls(
    content: string,
    _toolCalls: readonly ToolCallRequest[],
  ): readonly ExtractedToolCall[] {
    const calls: ExtractedToolCall[] = [];
    const regex = new RegExp(TOOL_CALL_PATTERN.source, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const name = match[1].trim();
      const argsStr = match[2].trim();

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(argsStr) as Record<string, unknown>;
      } catch {
        // If arguments aren't valid JSON, try to extract key-value pairs
        args = { raw: argsStr };
      }

      calls.push({
        id: generateCallId(),
        name,
        arguments: args,
      });
    }

    return calls;
  }

  formatToolResults(
    results: readonly { id: string; output: string; isError: boolean }[],
  ): readonly ChatMessage[] {
    // For text-parsing strategy, format tool results as user messages
    // since the model doesn't understand the "tool" role
    if (results.length === 0) return [];

    const parts = results.map((result) => {
      const status = result.isError ? "ERROR" : "SUCCESS";
      return `<tool_result id="${result.id}" status="${status}">\n${result.output}\n</tool_result>`;
    });

    return [
      {
        role: "user",
        content: `Tool execution results:\n\n${parts.join("\n\n")}`,
      },
    ];
  }

  /**
   * Strip tool call XML from the assistant's text content,
   * leaving only the reasoning/explanation text.
   */
  static stripToolCalls(content: string): string {
    return content.replace(TOOL_CALL_PATTERN, "").trim();
  }
}
