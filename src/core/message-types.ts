/** Message roles */
export const MessageRole = {
  System: "system",
  User: "user",
  Assistant: "assistant",
  Tool: "tool",
} as const;

export type MessageRoleValue = (typeof MessageRole)[keyof typeof MessageRole];

/** Tool call within an assistant message */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

/** Result from a tool execution */
export interface ToolCallResult {
  readonly id: string;
  readonly output: string;
  readonly isError: boolean;
}

/** Base chat message */
export interface ChatMessage {
  readonly role: MessageRoleValue;
  readonly content: string;
  readonly timestamp: Date;
}

/** User message */
export interface UserMessage extends ChatMessage {
  readonly role: typeof MessageRole.User;
}

/** Assistant message (may include tool calls) */
export interface AssistantMessage extends ChatMessage {
  readonly role: typeof MessageRole.Assistant;
  readonly toolCalls: readonly ToolCall[];
}

/** Tool result message */
export interface ToolMessage extends ChatMessage {
  readonly role: typeof MessageRole.Tool;
  readonly toolCallId: string;
  readonly isError: boolean;
}

/** System message */
export interface SystemMessage extends ChatMessage {
  readonly role: typeof MessageRole.System;
}

/** Union of all message types */
export type AnyMessage = UserMessage | AssistantMessage | ToolMessage | SystemMessage;

/** Type guard: is this a user message? */
export function isUserMessage(msg: ChatMessage): msg is UserMessage {
  return msg.role === MessageRole.User;
}

/** Type guard: is this an assistant message? */
export function isAssistantMessage(msg: ChatMessage): msg is AssistantMessage {
  return msg.role === MessageRole.Assistant;
}

/** Type guard: is this a tool message? */
export function isToolMessage(msg: ChatMessage): msg is ToolMessage {
  return msg.role === MessageRole.Tool;
}

/** Type guard: is this a system message? */
export function isSystemMessage(msg: ChatMessage): msg is SystemMessage {
  return msg.role === MessageRole.System;
}
