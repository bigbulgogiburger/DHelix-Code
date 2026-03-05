import {
  type ToolCall,
  type ToolCallResult,
  type AnyMessage,
  type UserMessage,
  type AssistantMessage,
  type ToolMessage,
  type SystemMessage,
  MessageRole,
} from "./message-types.js";

/**
 * Immutable conversation state.
 * All mutations return a new Conversation instance.
 */
export class Conversation {
  private constructor(
    readonly id: string,
    readonly messages: readonly AnyMessage[],
    readonly createdAt: Date,
    readonly metadata: Readonly<Record<string, unknown>>,
  ) {}

  /** Create a new empty conversation */
  static create(id: string): Conversation {
    return new Conversation(id, [], new Date(), {});
  }

  /** Append a system message. Returns new Conversation. */
  appendSystemMessage(content: string): Conversation {
    const message: SystemMessage = {
      role: MessageRole.System,
      content,
      timestamp: new Date(),
    };
    return new Conversation(this.id, [...this.messages, message], this.createdAt, this.metadata);
  }

  /** Append a user message. Returns new Conversation. */
  appendUserMessage(content: string): Conversation {
    const message: UserMessage = {
      role: MessageRole.User,
      content,
      timestamp: new Date(),
    };
    return new Conversation(this.id, [...this.messages, message], this.createdAt, this.metadata);
  }

  /** Append assistant response. Returns new Conversation. */
  appendAssistantMessage(content: string, toolCalls: readonly ToolCall[] = []): Conversation {
    const message: AssistantMessage = {
      role: MessageRole.Assistant,
      content,
      toolCalls,
      timestamp: new Date(),
    };
    return new Conversation(this.id, [...this.messages, message], this.createdAt, this.metadata);
  }

  /** Append tool results. Returns new Conversation. */
  appendToolResults(results: readonly ToolCallResult[]): Conversation {
    const toolMessages: ToolMessage[] = results.map((result) => ({
      role: MessageRole.Tool as typeof MessageRole.Tool,
      content: result.output,
      toolCallId: result.id,
      isError: result.isError,
      timestamp: new Date(),
    }));
    return new Conversation(
      this.id,
      [...this.messages, ...toolMessages],
      this.createdAt,
      this.metadata,
    );
  }

  /** Set metadata value. Returns new Conversation. */
  withMetadata(key: string, value: unknown): Conversation {
    return new Conversation(this.id, this.messages, this.createdAt, {
      ...this.metadata,
      [key]: value,
    });
  }

  /** Get total message count */
  get length(): number {
    return this.messages.length;
  }

  /** Get the last message */
  get lastMessage(): AnyMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  /** Get messages formatted for LLM (role + content) */
  toMessagesForLLM(): readonly {
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls?: readonly ToolCall[];
  }[] {
    return this.messages.map((msg) => {
      const base: {
        role: string;
        content: string;
        tool_call_id?: string;
        tool_calls?: readonly ToolCall[];
      } = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.role === MessageRole.Tool) {
        return { ...base, tool_call_id: (msg as ToolMessage).toolCallId };
      }
      if (msg.role === MessageRole.Assistant) {
        const assistantMsg = msg as AssistantMessage;
        if (assistantMsg.toolCalls.length > 0) {
          return { ...base, tool_calls: assistantMsg.toolCalls };
        }
      }
      return base;
    });
  }
}
