import { type z } from "zod";
import { type AppEventEmitter } from "../utils/events.js";

/** Permission level for a tool */
export type PermissionLevel = "safe" | "confirm" | "dangerous";

/** Context provided to tool execution */
export interface ToolContext {
  readonly workingDirectory: string;
  readonly abortSignal: AbortSignal;
  readonly timeoutMs: number;
  readonly platform: "win32" | "darwin" | "linux";
  /** Optional event emitter for streaming output (tool:output-delta) */
  readonly events?: AppEventEmitter;
  /** Tool call ID (for event correlation) */
  readonly toolCallId?: string;
}

/** Result from a tool execution */
export interface ToolResult {
  readonly output: string;
  readonly isError: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Tool definition — the core interface for all tools */
export interface ToolDefinition<TParams = unknown> {
  readonly name: string;
  readonly description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly parameterSchema: z.ZodType<TParams, z.ZodTypeDef, any>;
  readonly permissionLevel: PermissionLevel;
  readonly timeoutMs?: number;
  readonly execute: (params: TParams, context: ToolContext) => Promise<ToolResult>;
}

/** Tool definition for LLM function calling (JSON Schema format) */
export interface ToolDefinitionForLLM {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

/** Extracted tool call from LLM response */
export interface ExtractedToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

/** Result of a tool call with its ID */
export interface ToolCallResult {
  readonly id: string;
  readonly name: string;
  readonly output: string;
  readonly isError: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
