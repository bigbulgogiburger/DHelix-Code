import {
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  type ExtractedToolCall,
  type ToolCallResult,
} from "./types.js";
import { type ToolRegistry } from "./registry.js";
import { parseToolArguments } from "./validation.js";
import { getPlatform } from "../utils/platform.js";
import { TOOL_TIMEOUTS } from "../constants.js";

/**
 * Execute a single tool call with timeout, validation, and error handling.
 */
export async function executeTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: ToolDefinition<any>,
  args: Record<string, unknown>,
  options?: { workingDirectory?: string; signal?: AbortSignal },
): Promise<ToolResult> {
  const timeoutMs = tool.timeoutMs ?? TOOL_TIMEOUTS.default;
  const controller = new AbortController();
  const workingDirectory = options?.workingDirectory ?? process.cwd();

  // Link parent abort signal
  if (options?.signal) {
    if (options.signal.aborted) {
      return { output: "Aborted", isError: true };
    }
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  // Timeout
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const context: ToolContext = {
    workingDirectory,
    abortSignal: controller.signal,
    timeoutMs,
    platform: getPlatform(),
  };

  try {
    const validatedArgs = parseToolArguments(tool.parameterSchema, args);
    const result = await tool.execute(validatedArgs, context);
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      return { output: `Tool "${tool.name}" timed out after ${timeoutMs}ms`, isError: true };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Tool "${tool.name}" failed: ${message}`, isError: true };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Execute a tool call by looking it up in the registry.
 */
export async function executeToolCall(
  registry: ToolRegistry,
  call: ExtractedToolCall,
  options?: { workingDirectory?: string; signal?: AbortSignal },
): Promise<ToolCallResult> {
  const tool = registry.get(call.name);
  if (!tool) {
    return {
      id: call.id,
      name: call.name,
      output: `Unknown tool: ${call.name}`,
      isError: true,
    };
  }

  const result = await executeTool(tool, call.arguments, options);
  return {
    id: call.id,
    name: call.name,
    output: result.output,
    isError: result.isError,
  };
}
