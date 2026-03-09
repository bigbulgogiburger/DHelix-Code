import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { type ChatMessage, type LLMProvider } from "../llm/provider.js";
import { countTokens, countMessageTokens } from "../llm/token-counter.js";
import { AGENT_LOOP, TOKEN_DEFAULTS, SESSIONS_DIR } from "../constants.js";
import { loadInstructions } from "../instructions/loader.js";
import { buildSystemPrompt } from "./system-prompt-builder.js";

/** Tools whose outputs are eligible for cold storage (bulky read-only outputs) */
const COLD_STORAGE_ELIGIBLE_TOOLS = new Set([
  "file_read",
  "bash_exec",
  "grep_search",
  "glob_search",
]);

/** Minimum token count for a tool result to be moved to cold storage */
const COLD_STORAGE_MIN_TOKENS = 200;

/** Number of most recent tool results to keep inline ("hot tail") */
const HOT_TAIL_SIZE = 5;

/** Number of most recently accessed files to re-read after compaction */
const REHYDRATION_FILE_COUNT = 5;

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
  /** Working directory for reloading instructions on compaction */
  readonly workingDirectory?: string;
  /** LLM provider for intelligent summarization */
  readonly client?: LLMProvider;
  /** Model to use for summaries (default: same as main) */
  readonly summaryModel?: string;
  /** Session ID for cold storage directory scoping */
  readonly sessionId?: string;
  /** Event emitter for PreCompact events */
  readonly onPreCompact?: () => void;
}

/** Result of a compaction operation */
export interface CompactionResult {
  readonly originalTokens: number;
  readonly compactedTokens: number;
  readonly removedMessages: number;
  readonly summary: string;
}

/** A reference to tool output stored on disk */
export interface ColdStorageRef {
  readonly hash: string;
  readonly path: string;
  readonly originalTokens: number;
}

/**
 * Context manager — handles context window management with 3-layer compaction:
 *
 * Layer 1 — Microcompaction (continuous):
 *   Saves bulky tool outputs to disk as "cold storage".
 *   Keeps a "hot tail" of the last N tool results inline.
 *   Older results become cold references.
 *
 * Layer 2 — Auto-compaction (threshold-based):
 *   Triggers at ~83.5% context usage (down from 95%).
 *   Structured summarization preserving user intent, decisions,
 *   files touched, errors/resolutions, and pending tasks.
 *
 * Layer 3 — Post-compaction rehydration:
 *   After compaction, re-reads the 5 most recently accessed files.
 *   Restores todo list state. Adds a boundary marker.
 */
export class ContextManager {
  private readonly maxContextTokens: number;
  private readonly compactionThreshold: number;
  private readonly preserveRecentTurns: number;
  private readonly responseReserveRatio: number;
  private readonly workingDirectory: string;
  private readonly client?: LLMProvider;
  private readonly summaryModel?: string;
  private readonly sessionId: string;
  private readonly onPreCompact?: () => void;

  /** Track cold storage references for potential re-read */
  private readonly coldRefs: Map<string, ColdStorageRef> = new Map();

  /** Track recently accessed file paths (for rehydration) */
  private readonly recentFiles: string[] = [];

  /** Number of compactions performed (for boundary markers) */
  private compactionCount = 0;

  constructor(config?: ContextManagerConfig) {
    this.maxContextTokens = config?.maxContextTokens ?? TOKEN_DEFAULTS.maxContextWindow;
    this.compactionThreshold = config?.compactionThreshold ?? AGENT_LOOP.compactionThreshold;
    this.preserveRecentTurns = config?.preserveRecentTurns ?? 5;
    this.responseReserveRatio = config?.responseReserveRatio ?? AGENT_LOOP.responseReserveRatio;
    this.workingDirectory = config?.workingDirectory ?? process.cwd();
    this.client = config?.client;
    this.summaryModel = config?.summaryModel;
    this.sessionId = config?.sessionId ?? "default";
    this.onPreCompact = config?.onPreCompact;
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
   * Track a file path as recently accessed (for rehydration after compaction).
   */
  trackFileAccess(filePath: string): void {
    const idx = this.recentFiles.indexOf(filePath);
    if (idx !== -1) {
      this.recentFiles.splice(idx, 1);
    }
    this.recentFiles.unshift(filePath);
    if (this.recentFiles.length > REHYDRATION_FILE_COUNT * 2) {
      this.recentFiles.length = REHYDRATION_FILE_COUNT * 2;
    }
  }

  /**
   * Layer 1: Microcompaction — move bulky tool outputs to cold storage.
   * Keeps the last HOT_TAIL_SIZE tool results inline; older ones become cold refs.
   * Returns a new message array (never mutates input).
   */
  async microcompact(messages: readonly ChatMessage[]): Promise<readonly ChatMessage[]> {
    // Find all tool messages with their indices
    const toolIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "tool") {
        toolIndices.push(i);
      }
    }

    // Only microcompact if we have more than HOT_TAIL_SIZE tool results
    if (toolIndices.length <= HOT_TAIL_SIZE) {
      return messages;
    }

    // Indices to potentially cold-store (everything except the hot tail)
    const coldCandidateIndices = new Set(toolIndices.slice(0, -HOT_TAIL_SIZE));
    const coldStorageDir = await this.ensureColdStorageDir();

    const result: ChatMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (!coldCandidateIndices.has(i)) {
        result.push(msg);
        continue;
      }

      // Check if this tool result is eligible and large enough for cold storage
      const toolName = this.extractToolName(msg);
      const tokens = countTokens(msg.content);

      if (!COLD_STORAGE_ELIGIBLE_TOOLS.has(toolName) || tokens < COLD_STORAGE_MIN_TOKENS) {
        result.push(msg);
        continue;
      }

      // Store to disk and replace with cold reference
      const ref = await this.writeColdStorage(coldStorageDir, msg.content);
      this.coldRefs.set(ref.hash, ref);

      result.push({
        ...msg,
        content: `[Tool output stored at: ${ref.path}. Re-read if needed. Original: ${ref.originalTokens} tokens]`,
      });
    }

    return result;
  }

  /**
   * Prepare messages for the LLM by applying microcompaction and auto-compaction.
   * Layer 1 runs first (continuous), then Layer 2 checks threshold.
   * Returns a new message array (never mutates input).
   */
  async prepare(messages: readonly ChatMessage[]): Promise<readonly ChatMessage[]> {
    // Layer 1: Microcompaction (continuous, always runs)
    let result = await this.microcompact(messages);

    // Layer 2: Auto-compaction (threshold-based)
    if (this.needsCompaction(result)) {
      const { messages: compacted } = await this.compact(result);
      result = [...compacted];
    }

    return result;
  }

  /**
   * Layer 2 + 3: Full compaction with structured summarization and rehydration.
   * Preserves system prompts and recent turns.
   * Re-reads DBCODE.md from disk to pick up any changes made during the session.
   * Returns compacted messages and a summary of what was removed.
   */
  async compact(
    messages: readonly ChatMessage[],
    focusTopic?: string,
  ): Promise<{ readonly messages: readonly ChatMessage[]; readonly result: CompactionResult }> {
    // Emit PreCompact event
    this.onPreCompact?.();

    const originalTokens = countMessageTokens(messages);
    this.compactionCount++;

    // Re-read DBCODE.md from disk to pick up changes made during session
    const freshSystemMessage = await this.reloadSystemPrompt();

    // Separate system messages from conversation messages
    const systemMessages = freshSystemMessage
      ? [freshSystemMessage]
      : messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    // Identify conversation turns (user + assistant + tool results = 1 turn)
    const turns = this.identifyTurns(conversationMessages);

    // If few enough turns, just truncate tool results
    if (turns.length <= this.preserveRecentTurns) {
      const truncated = this.truncateToolResults([...systemMessages, ...conversationMessages]);
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

    // Summarize middle turns with structured contract
    const summary = await this.summarizeWithFallback(middleTurns, focusTopic);

    // Build compaction boundary marker
    const boundaryMarker = [
      `[Compaction #${this.compactionCount} boundary]`,
      `Compacted at: ${new Date().toISOString()}`,
      `Turns summarized: ${middleTurns.length}`,
      `Original tokens: ${originalTokens}`,
    ].join("\n");

    const summaryMessage: ChatMessage = {
      role: "system",
      content: `${boundaryMarker}\n\n[Conversation summary]\n${summary}`,
    };

    // Reconstruct: system messages + summary + recent turns
    const recentMessages = recentTurns.flatMap((turn) => turn.messages);
    const compactedMessages: ChatMessage[] = [...systemMessages, summaryMessage, ...recentMessages];

    // Also truncate tool results in recent messages
    const truncatedResult = this.truncateToolResults(compactedMessages);

    // Layer 3: Post-compaction rehydration
    const rehydrated = await this.rehydrate(truncatedResult);
    const compactedTokens = countMessageTokens(rehydrated);

    return {
      messages: rehydrated,
      result: {
        originalTokens,
        compactedTokens,
        removedMessages: messages.length - rehydrated.length,
        summary,
      },
    };
  }

  /**
   * Manual compaction with an optional focus topic.
   * Like /compact [focus] — user-triggered targeted summarization.
   */
  async manualCompact(
    messages: readonly ChatMessage[],
    focusTopic?: string,
  ): Promise<{ readonly messages: readonly ChatMessage[]; readonly result: CompactionResult }> {
    return this.compact(messages, focusTopic);
  }

  /**
   * Layer 3: Post-compaction rehydration.
   * Re-reads the N most recently accessed files and appends their content
   * as a system message so the LLM has fresh context after compaction.
   */
  private async rehydrate(messages: readonly ChatMessage[]): Promise<readonly ChatMessage[]> {
    const filesToRehydrate = this.recentFiles.slice(0, REHYDRATION_FILE_COUNT);
    if (filesToRehydrate.length === 0) {
      return messages;
    }

    const fileContents: string[] = [];
    for (const filePath of filesToRehydrate) {
      try {
        const content = await readFile(filePath, "utf-8");
        // Limit each file to a reasonable size for rehydration
        const truncated =
          content.length > 4000
            ? content.slice(0, 3800) + "\n[... truncated for rehydration ...]"
            : content;
        fileContents.push(`--- ${filePath} ---\n${truncated}`);
      } catch {
        // File may have been deleted or moved — skip it
      }
    }

    if (fileContents.length === 0) {
      return messages;
    }

    const rehydrationMessage: ChatMessage = {
      role: "system",
      content: [
        "[Post-compaction rehydration]",
        `Re-read ${fileContents.length} recently accessed files:`,
        "",
        ...fileContents,
      ].join("\n"),
    };

    return [...messages, rehydrationMessage];
  }

  /**
   * Reload instructions from disk and rebuild the system prompt.
   * Returns a fresh system message, or null if reloading fails.
   */
  private async reloadSystemPrompt(): Promise<ChatMessage | null> {
    try {
      const freshInstructions = await loadInstructions(this.workingDirectory);
      const freshPrompt = buildSystemPrompt({
        projectInstructions: freshInstructions.combined,
        workingDirectory: this.workingDirectory,
      });
      return { role: "system", content: freshPrompt };
    } catch {
      return null;
    }
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
   * Attempt LLM summarization with fallback to local extraction.
   */
  private async summarizeWithFallback(
    turns: readonly { readonly messages: readonly ChatMessage[] }[],
    focusTopic?: string,
  ): Promise<string> {
    if (this.client) {
      try {
        return await this.summarizeWithLLM(turns, focusTopic);
      } catch {
        // LLM summarization failed — fall back to local extraction
      }
    }
    return this.summarizeTurns(turns, focusTopic);
  }

  /**
   * Summarize conversation turns using an LLM with structured summarization contract.
   * Preserves: user intent, decisions, files touched, errors+resolutions, pending tasks.
   */
  private async summarizeWithLLM(
    turns: readonly { readonly messages: readonly ChatMessage[] }[],
    focusTopic?: string,
  ): Promise<string> {
    const turnTexts = turns.map((turn, i) => {
      const parts: string[] = [`--- Turn ${i + 1} ---`];
      for (const msg of turn.messages) {
        const label = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        const truncated = this.truncateText(msg.content, 1000);
        parts.push(`[${label}]: ${truncated}`);
      }
      return parts.join("\n");
    });

    const focusInstruction = focusTopic
      ? `\nPay special attention to anything related to: "${focusTopic}".`
      : "";

    const systemPrompt = [
      "You are a conversation summarizer for a coding assistant session.",
      "Summarize the following conversation turns concisely (200-500 tokens).",
      "",
      "Structure your summary with these REQUIRED sections:",
      "",
      "## User Intent",
      "The original task/goal the user is trying to accomplish.",
      "",
      "## Key Decisions",
      "Technical decisions made and their reasoning.",
      "",
      "## Files Touched",
      "Files read, created, or modified (list paths).",
      "",
      "## Errors & Resolutions",
      "Bugs, errors, or issues discovered and how they were resolved.",
      "",
      "## Pending Tasks",
      "What still needs to be done / next steps.",
      focusInstruction,
      "",
      "Output ONLY the structured summary, no preamble.",
    ].join("\n");

    const response = await this.client!.chat({
      model: this.summaryModel ?? "default",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: turnTexts.join("\n\n") },
      ],
      maxTokens: 1024,
    });

    return response.content;
  }

  /**
   * Summarize a list of turns into a structured text summary (local, no LLM).
   * Extracts key information following the structured contract.
   */
  private summarizeTurns(
    turns: readonly { readonly messages: readonly ChatMessage[] }[],
    focusTopic?: string,
  ): string {
    const parts: string[] = [];
    const modifiedFiles = new Set<string>();
    const errors: string[] = [];
    const userIntents: string[] = [];

    if (focusTopic) {
      parts.push(`Focus: ${focusTopic}`);
    }

    parts.push(`Summarized ${turns.length} conversation turns:`);

    for (const turn of turns) {
      const userMsg = turn.messages.find((m) => m.role === "user");
      const assistantMsg = turn.messages.find((m) => m.role === "assistant");
      const toolMsgs = turn.messages.filter((m) => m.role === "tool");

      if (userMsg) {
        const userSummary = this.truncateText(userMsg.content, 200);
        parts.push(`- User: ${userSummary}`);
        userIntents.push(userSummary);
      }

      if (assistantMsg) {
        const assistantSummary = this.truncateText(assistantMsg.content, 300);
        parts.push(`  Assistant: ${assistantSummary}`);
      }

      if (toolMsgs.length > 0) {
        parts.push(`  (${toolMsgs.length} tool calls executed)`);
        for (const tm of toolMsgs) {
          // Extract file paths
          const fileMatches = tm.content.match(/(?:file_path|path)['":\s]+([^\s'"}\]]+)/g);
          if (fileMatches) {
            for (const match of fileMatches) {
              const path = match.replace(/.*['":\s]+/, "").trim();
              if (path && path.includes("/")) modifiedFiles.add(path);
            }
          }
          // Extract errors
          if (tm.content.startsWith("Error:") || tm.content.includes("STDERR:")) {
            const errLine = this.truncateText(tm.content, 150);
            errors.push(errLine);
          }
        }
      }
    }

    // Structured sections
    if (modifiedFiles.size > 0) {
      parts.push("");
      parts.push("## Files Touched");
      for (const f of [...modifiedFiles].slice(0, 20)) {
        parts.push(`  - ${f}`);
      }
    }

    if (errors.length > 0) {
      parts.push("");
      parts.push("## Errors Encountered");
      for (const e of errors.slice(0, 10)) {
        parts.push(`  - ${e}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Truncate large tool results to reduce token count.
   * Error results get 1000 token limit; others get 500.
   * Uses head+tail truncation to preserve both beginning and end context.
   */
  private truncateToolResults(messages: readonly ChatMessage[]): readonly ChatMessage[] {
    return messages.map((msg) => {
      if (msg.role !== "tool") return msg;

      const tokens = countTokens(msg.content);
      const isError = msg.content.startsWith("Error:") || msg.content.includes("STDERR:");
      const maxToolTokens = isError ? 1000 : 500;

      if (tokens <= maxToolTokens) return msg;

      // Head + tail truncation: keep beginning and end for better context
      const approxChars = maxToolTokens * 4;
      const headChars = Math.floor(approxChars * 0.6);
      const tailChars = Math.floor(approxChars * 0.4);
      const head = msg.content.slice(0, headChars);
      const tail = msg.content.slice(-tailChars);
      const removedTokens = tokens - maxToolTokens;

      return {
        ...msg,
        content: `${head}\n\n[... ${removedTokens} tokens omitted ...]\n\n${tail}`,
      };
    });
  }

  /** Truncate text to a maximum length, adding ellipsis if needed */
  private truncateText(text: string, maxLength: number): string {
    const singleLine = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (singleLine.length <= maxLength) return singleLine;
    return singleLine.slice(0, maxLength - 3) + "...";
  }

  /** Extract a tool name from a tool message (best-effort from toolCallId or content) */
  private extractToolName(msg: ChatMessage): string {
    // Try to detect from common tool output patterns
    if (msg.name) return msg.name;

    const content = msg.content;
    if (
      content.startsWith("Error:") ||
      content.startsWith("STDOUT:") ||
      content.startsWith("STDERR:")
    ) {
      return "bash_exec";
    }
    if (content.includes("matches found") || content.includes("No matches")) {
      return "grep_search";
    }
    if (content.includes("files found") || content.includes("No files")) {
      return "glob_search";
    }
    // Large outputs with line numbers are typically file_read
    if (/^\s*\d+[│|]/.test(content) || /^\s+\d+\t/.test(content)) {
      return "file_read";
    }
    return "unknown";
  }

  /** Get or create the cold storage directory */
  private async ensureColdStorageDir(): Promise<string> {
    const dir = join(SESSIONS_DIR, this.sessionId, "cold-storage");
    await mkdir(dir, { recursive: true });
    return dir;
  }

  /** Write content to cold storage and return a reference */
  private async writeColdStorage(dir: string, content: string): Promise<ColdStorageRef> {
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
    const filePath = join(dir, `${hash}.txt`);

    // Don't rewrite if already exists (content-addressable)
    try {
      await readFile(filePath, "utf-8");
    } catch {
      await writeFile(filePath, content, "utf-8");
    }

    return {
      hash,
      path: filePath,
      originalTokens: countTokens(content),
    };
  }
}
