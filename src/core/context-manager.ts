import { type ChatMessage } from "../llm/provider.js";
import { countTokens, countMessageTokens } from "../llm/token-counter.js";
import { AGENT_LOOP, TOKEN_DEFAULTS } from "../constants.js";

/** Context window usage statistics */
export interface ContextUsage {
  readonly totalTokens: number;
  readonly maxTokens: number;
  readonly usageRatio: number;
  readonly messageCount: number;
}

/** Configuration for context management */
export interface ContextManagerConfig {
  /** Maximum context window size in tokens */
  readonly maxContextTokens?: number;
  /** Threshold ratio at which auto-compaction triggers (0-1) */
  readonly compactionThreshold?: number;
  /** Number of recent turns to always preserve */
  readonly preserveRecentTurns?: number;
  /** Reserve ratio for LLM response tokens (0-1) */
  readonly responseReserveRatio?: number;
}

/** Result of a compaction operation */
export interface CompactionResult {
  readonly originalTokens: number;
  readonly compactedTokens: number;
  readonly removedMessages: number;
  readonly summary: string;
}

/**
 * Context manager — handles context window management including
 * auto-compaction, targeted summarization, and token budget enforcement.
 *
 * Compaction strategy (from architecture-plan.md 13.1):
 * 1. System prompt: always preserved
 * 2. Recent N turns: always preserved (default: last 5 turns)
 * 3. Middle turns: summarized into a single message
 * 4. Tool results: truncated based on importance
 * 5. Task list: preserved separately
 */
export class ContextManager {
  private readonly maxContextTokens: number;
  private readonly compactionThreshold: number;
  private readonly preserveRecentTurns: number;
  private readonly responseReserveRatio: number;

  constructor(config?: ContextManagerConfig) {
    this.maxContextTokens = config?.maxContextTokens ?? TOKEN_DEFAULTS.maxContextWindow;
    this.compactionThreshold = config?.compactionThreshold ?? AGENT_LOOP.compactionThreshold;
    this.preserveRecentTurns = config?.preserveRecentTurns ?? 5;
    this.responseReserveRatio = config?.responseReserveRatio ?? AGENT_LOOP.responseReserveRatio;
  }

  /** Get the effective token budget (accounting for response reserve) */
  get tokenBudget(): number {
    return Math.floor(this.maxContextTokens * (1 - this.responseReserveRatio));
  }

  /**
   * Calculate current context usage for a set of messages.
   */
  getUsage(messages: readonly ChatMessage[]): ContextUsage {
    const totalTokens = countMessageTokens(messages);
    return {
      totalTokens,
      maxTokens: this.tokenBudget,
      usageRatio: totalTokens / this.tokenBudget,
      messageCount: messages.length,
    };
  }

  /**
   * Check if compaction is needed based on current usage.
   */
  needsCompaction(messages: readonly ChatMessage[]): boolean {
    const usage = this.getUsage(messages);
    return usage.usageRatio >= this.compactionThreshold;
  }

  /**
   * Prepare messages for the LLM by enforcing the token budget.
   * If usage exceeds the compaction threshold, compacts the middle messages.
   * Returns a new message array (never mutates input).
   */
  prepare(messages: readonly ChatMessage[]): readonly ChatMessage[] {
    if (!this.needsCompaction(messages)) {
      return messages;
    }
    return this.compact(messages).messages;
  }

  /**
   * Compact messages by summarizing middle turns.
   * Preserves system prompts and recent turns.
   * Returns compacted messages and a summary of what was removed.
   */
  compact(
    messages: readonly ChatMessage[],
    focusTopic?: string,
  ): { readonly messages: readonly ChatMessage[]; readonly result: CompactionResult } {
    const originalTokens = countMessageTokens(messages);

    // Separate system messages from conversation messages
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    // Identify conversation turns (user + assistant + tool results = 1 turn)
    const turns = this.identifyTurns(conversationMessages);

    // If few enough turns, just truncate tool results
    if (turns.length <= this.preserveRecentTurns) {
      const truncated = this.truncateToolResults(messages);
      return {
        messages: truncated,
        result: {
          originalTokens,
          compactedTokens: countMessageTokens(truncated),
          removedMessages: messages.length - truncated.length,
          summary: "Truncated large tool results",
        },
      };
    }

    // Split into middle and recent
    const recentStartIdx = turns.length - this.preserveRecentTurns;
    const middleTurns = turns.slice(0, recentStartIdx);
    const recentTurns = turns.slice(recentStartIdx);

    // Summarize middle turns into a single message
    const summary = this.summarizeTurns(middleTurns, focusTopic);
    const summaryMessage: ChatMessage = {
      role: "system",
      content: `[Conversation summary]\n${summary}`,
    };

    // Reconstruct: system messages + summary + recent turns
    const recentMessages = recentTurns.flatMap((turn) => turn.messages);
    const compactedMessages: ChatMessage[] = [...systemMessages, summaryMessage, ...recentMessages];

    // Also truncate tool results in recent messages
    const result = this.truncateToolResults(compactedMessages);
    const compactedTokens = countMessageTokens(result);

    return {
      messages: result,
      result: {
        originalTokens,
        compactedTokens,
        removedMessages: messages.length - result.length,
        summary,
      },
    };
  }

  /**
   * Manual compaction with an optional focus topic.
   * Like /compact [focus] — user-triggered targeted summarization.
   */
  manualCompact(
    messages: readonly ChatMessage[],
    focusTopic?: string,
  ): { readonly messages: readonly ChatMessage[]; readonly result: CompactionResult } {
    return this.compact(messages, focusTopic);
  }

  /**
   * Identify conversation turns from a flat message array.
   * A turn is: user message + all following assistant/tool messages until next user message.
   */
  private identifyTurns(
    messages: readonly ChatMessage[],
  ): readonly { readonly messages: readonly ChatMessage[] }[] {
    const turns: { messages: ChatMessage[] }[] = [];
    let currentTurn: ChatMessage[] = [];

    for (const msg of messages) {
      if (msg.role === "user" && currentTurn.length > 0) {
        turns.push({ messages: [...currentTurn] });
        currentTurn = [];
      }
      currentTurn.push(msg);
    }

    if (currentTurn.length > 0) {
      turns.push({ messages: [...currentTurn] });
    }

    return turns;
  }

  /**
   * Summarize a list of turns into a text summary.
   * This is a local summary (no LLM call) — extracts key information.
   */
  private summarizeTurns(
    turns: readonly { readonly messages: readonly ChatMessage[] }[],
    focusTopic?: string,
  ): string {
    const parts: string[] = [];

    if (focusTopic) {
      parts.push(`Focus: ${focusTopic}`);
    }

    parts.push(`Summarized ${turns.length} conversation turns:`);

    for (const turn of turns) {
      const userMsg = turn.messages.find((m) => m.role === "user");
      const assistantMsg = turn.messages.find((m) => m.role === "assistant");
      const toolMsgs = turn.messages.filter((m) => m.role === "tool");

      if (userMsg) {
        const userSummary = this.truncateText(userMsg.content, 100);
        parts.push(`- User: ${userSummary}`);
      }

      if (assistantMsg) {
        const assistantSummary = this.truncateText(assistantMsg.content, 100);
        parts.push(`  Assistant: ${assistantSummary}`);
      }

      if (toolMsgs.length > 0) {
        parts.push(`  (${toolMsgs.length} tool calls executed)`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Truncate large tool results to reduce token count.
   * Tool results over 500 tokens are truncated with a note.
   */
  private truncateToolResults(messages: readonly ChatMessage[]): readonly ChatMessage[] {
    const maxToolTokens = 500;

    return messages.map((msg) => {
      if (msg.role !== "tool") return msg;

      const tokens = countTokens(msg.content);
      if (tokens <= maxToolTokens) return msg;

      // Truncate to approximately maxToolTokens worth of chars
      const approxChars = maxToolTokens * 4;
      const truncated = msg.content.slice(0, approxChars);
      return {
        ...msg,
        content: truncated + `\n\n[... truncated ${tokens - maxToolTokens} tokens]`,
      };
    });
  }

  /** Truncate text to a maximum length, adding ellipsis if needed */
  private truncateText(text: string, maxLength: number): string {
    const singleLine = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (singleLine.length <= maxLength) return singleLine;
    return singleLine.slice(0, maxLength - 3) + "...";
  }
}
