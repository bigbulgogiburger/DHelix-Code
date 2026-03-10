import { mkdir, writeFile, readFile, readdir, stat, unlink } from "node:fs/promises";
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

/** Default cold storage TTL in milliseconds (24 hours) */
const COLD_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

/** Run garbage collection every N compactions */
const GC_COMPACTION_INTERVAL = 10;

/** Tools that produce write/mutation results (higher priority in hot tail) */
const WRITE_TOOLS = new Set(["file_edit", "file_write"]);

/** Context window usage statistics */
export interface ContextUsage {
  readonly totalTokens: number;
  readonly maxTokens: number;
  readonly usageRatio: number;
  readonly messageCount: number;
}

/** Result of cold storage garbage collection */
export interface CleanupResult {
  readonly removedFiles: number;
  readonly bytesFreed: number;
}

/** Metrics about compaction effectiveness */
export interface CompactionMetrics {
  readonly compactionCount: number;
  readonly totalTokensSaved: number;
  readonly coldStorageEntries: number;
  readonly coldStorageSizeBytes: number;
  readonly averageCompressionRatio: number;
  readonly lastCompactionAt: string | null;
}

/** Rehydration strategy for post-compaction file re-reading */
export type RehydrationStrategy = "recency" | "frequency" | "mixed";

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
  /** Cold storage TTL in milliseconds (default: 24 hours) */
  readonly coldStorageTtlMs?: number;
  /** Strategy for selecting files to re-read after compaction */
  readonly rehydrationStrategy?: RehydrationStrategy;
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
 *   Keeps a "hot tail" of the last N tool results inline,
 *   prioritized by content type (errors first, writes over reads).
 *   Older results become cold references.
 *
 * Layer 2 — Auto-compaction (threshold-based):
 *   Triggers at ~83.5% context usage (down from 95%).
 *   Structured summarization preserving user intent, decisions,
 *   files touched, errors/resolutions, and pending tasks.
 *   Tracks compaction metrics for observability.
 *
 * Layer 3 — Post-compaction rehydration:
 *   After compaction, re-reads files based on configurable strategy
 *   (recency, frequency, or mixed). Restores todo list state.
 *   Adds a boundary marker.
 *
 * Garbage Collection:
 *   Periodically cleans up stale cold storage files that exceed TTL
 *   or are orphaned (no longer referenced in memory).
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
  private readonly coldStorageTtlMs: number;
  private readonly rehydrationStrategy: RehydrationStrategy;

  /** Track cold storage references for potential re-read */
  private readonly coldRefs: Map<string, ColdStorageRef> = new Map();

  /** Track recently accessed file paths (for rehydration) */
  private readonly recentFiles: string[] = [];

  /** Track file access frequency (for frequency-based rehydration) */
  private readonly fileAccessFrequency: Map<string, number> = new Map();

  /** Track cold storage ref access frequency (for smart hot tail) */
  private readonly coldRefAccessCount: Map<string, number> = new Map();

  /** Number of compactions performed (for boundary markers) */
  private compactionCount = 0;

  /** --- Compaction metrics tracking --- */
  private totalTokensSaved = 0;
  private totalCompressionRatios: number[] = [];
  private lastCompactionAt: string | null = null;
  private lastGcCompactionCount = 0;

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
    this.coldStorageTtlMs = config?.coldStorageTtlMs ?? COLD_STORAGE_TTL_MS;
    this.rehydrationStrategy = config?.rehydrationStrategy ?? "recency";
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
   * Also increments the frequency counter for frequency-based rehydration.
   */
  trackFileAccess(filePath: string): void {
    // Update recency list
    const idx = this.recentFiles.indexOf(filePath);
    if (idx !== -1) {
      this.recentFiles.splice(idx, 1);
    }
    this.recentFiles.unshift(filePath);
    if (this.recentFiles.length > REHYDRATION_FILE_COUNT * 2) {
      this.recentFiles.length = REHYDRATION_FILE_COUNT * 2;
    }

    // Update frequency counter
    const currentCount = this.fileAccessFrequency.get(filePath) ?? 0;
    this.fileAccessFrequency.set(filePath, currentCount + 1);
  }

  /**
   * Get compaction and cold storage metrics for observability.
   */
  getCompactionMetrics(): CompactionMetrics {
    let coldStorageSizeBytes = 0;
    this.coldRefs.forEach((ref) => {
      // Approximate bytes from token count (4 chars per token average)
      coldStorageSizeBytes += ref.originalTokens * 4;
    });

    const averageCompressionRatio =
      this.totalCompressionRatios.length > 0
        ? this.totalCompressionRatios.reduce((a, b) => a + b, 0) /
          this.totalCompressionRatios.length
        : 0;

    return {
      compactionCount: this.compactionCount,
      totalTokensSaved: this.totalTokensSaved,
      coldStorageEntries: this.coldRefs.size,
      coldStorageSizeBytes,
      averageCompressionRatio,
      lastCompactionAt: this.lastCompactionAt,
    };
  }

  /**
   * Clean up stale and orphaned cold storage files.
   * Removes files older than the configured TTL and files not referenced
   * by any cold ref in memory.
   */
  async cleanupColdStorage(): Promise<CleanupResult> {
    const coldStorageDir = join(SESSIONS_DIR, this.sessionId, "cold-storage");
    let removedFiles = 0;
    let bytesFreed = 0;

    let entries: string[];
    try {
      entries = await readdir(coldStorageDir);
    } catch {
      // Directory doesn't exist — nothing to clean
      return { removedFiles: 0, bytesFreed: 0 };
    }

    const now = Date.now();
    const activeHashes = new Set(Array.from(this.coldRefs.keys()));

    for (const entry of entries) {
      if (!entry.endsWith(".txt")) continue;

      const filePath = join(coldStorageDir, entry);
      const hash = entry.replace(/\.txt$/, "");

      try {
        const fileStat = await stat(filePath);
        const ageMs = now - fileStat.mtimeMs;
        const isOrphaned = !activeHashes.has(hash);
        const isExpired = ageMs > this.coldStorageTtlMs;

        if (isOrphaned || isExpired) {
          await unlink(filePath);
          removedFiles++;
          bytesFreed += fileStat.size;

          // Remove from tracking maps if present
          this.coldRefs.delete(hash);
          this.coldRefAccessCount.delete(hash);
        }
      } catch {
        // File may have been deleted concurrently — skip
      }
    }

    return { removedFiles, bytesFreed };
  }

  /**
   * Layer 1: Microcompaction — move bulky tool outputs to cold storage.
   * Keeps the HOT_TAIL_SIZE highest-priority tool results inline using
   * content-aware prioritization (errors > writes > reads).
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

    // Score each tool message for hot tail priority
    const scored = toolIndices.map((idx) => ({
      idx,
      priority: this.hotTailPriority(messages[idx]),
    }));

    // Sort by priority descending; for equal priority, prefer later (more recent) messages
    const sorted = [...scored].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.idx - a.idx;
    });

    // The top HOT_TAIL_SIZE indices stay hot
    const hotIndices = new Set(sorted.slice(0, HOT_TAIL_SIZE).map((s) => s.idx));

    // Everything else is a cold candidate
    const coldCandidateIndices = new Set(
      toolIndices.filter((idx) => !hotIndices.has(idx)),
    );

    const coldStorageDir = await this.ensureColdStorageDir();

    const result: ChatMessage[] = [];
    let microcompactTokensSaved = 0;

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
      microcompactTokensSaved += ref.originalTokens;

      result.push({
        ...msg,
        content: `[Tool output stored at: ${ref.path}. Re-read if needed. Original: ${ref.originalTokens} tokens]`,
      });
    }

    // Track microcompaction token savings in overall metrics
    this.totalTokensSaved += microcompactTokensSaved;

    return result;
  }

  /**
   * Prepare messages for the LLM by applying microcompaction and auto-compaction.
   * Layer 1 runs first (continuous), then Layer 2 checks threshold.
   * Periodically triggers cold storage garbage collection.
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

    // Periodic cold storage garbage collection
    if (
      this.compactionCount > 0 &&
      this.compactionCount - this.lastGcCompactionCount >= GC_COMPACTION_INTERVAL
    ) {
      this.lastGcCompactionCount = this.compactionCount;
      // Run GC in the background — don't block prepare()
      this.cleanupColdStorage().catch(() => {
        // Swallow GC errors — cleanup is best-effort
      });
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
    this.lastCompactionAt = new Date().toISOString();

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
      const compactedTokens = countMessageTokens(truncated);
      this.trackCompactionRatio(originalTokens, compactedTokens);

      return {
        messages: truncated,
        result: {
          originalTokens,
          compactedTokens,
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

    // Track metrics
    this.trackCompactionRatio(originalTokens, compactedTokens);

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
   * Calculate a priority score for keeping a tool message in the hot tail.
   * Higher scores mean higher priority to stay inline (not moved to cold storage).
   *
   * Priority tiers:
   *   100 — Error results (always keep for debugging context)
   *    80 — Write/edit tool results (mutation context is critical)
   *    60 — Frequently accessed cold refs (access count > 2)
   *    40 — Other tool results (reads, searches, etc.)
   *    +N — Recency bonus (0-10 based on position)
   */
  private hotTailPriority(msg: ChatMessage): number {
    let score = 40; // Base score for generic tool results

    const content = msg.content;
    const toolName = this.extractToolName(msg);

    // Error results get highest priority — always keep for debugging
    if (content.startsWith("Error:") || content.includes("STDERR:") || content.includes("error:")) {
      score = 100;
    }
    // Write/edit results are high priority — mutation context matters
    else if (WRITE_TOOLS.has(toolName)) {
      score = 80;
    }
    // Check if this is a frequently re-accessed cold storage ref
    else {
      const refMatch = content.match(/\[Tool output stored at: .+?\/([a-f0-9]+)\.txt/);
      if (refMatch) {
        const hash = refMatch[1];
        const accessCount = this.coldRefAccessCount.get(hash) ?? 0;
        if (accessCount > 2) {
          score = 60;
        }
      }
    }

    return score;
  }

  /**
   * Track a cold storage reference access (when the LLM or user re-reads cold content).
   * Increments the access counter used for smart hot tail prioritization.
   */
  trackColdRefAccess(hash: string): void {
    const currentCount = this.coldRefAccessCount.get(hash) ?? 0;
    this.coldRefAccessCount.set(hash, currentCount + 1);
  }

  /**
   * Layer 3: Post-compaction rehydration.
   * Selects files to re-read based on the configured rehydration strategy:
   * - "recency": N most recently accessed files (original behavior)
   * - "frequency": N most frequently accessed files
   * - "mixed": 3 most recent + 2 most frequent (deduplicated)
   *
   * Appends file content as a system message so the LLM has fresh context.
   */
  private async rehydrate(messages: readonly ChatMessage[]): Promise<readonly ChatMessage[]> {
    const filesToRehydrate = this.selectRehydrationFiles();
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

    const strategyLabel = this.rehydrationStrategy === "recency"
      ? "recently accessed"
      : this.rehydrationStrategy === "frequency"
        ? "frequently accessed"
        : "recent + frequent";

    const rehydrationMessage: ChatMessage = {
      role: "system",
      content: [
        "[Post-compaction rehydration]",
        `Re-read ${fileContents.length} ${strategyLabel} files:`,
        "",
        ...fileContents,
      ].join("\n"),
    };

    return [...messages, rehydrationMessage];
  }

  /**
   * Select files for rehydration based on the configured strategy.
   */
  private selectRehydrationFiles(): readonly string[] {
    switch (this.rehydrationStrategy) {
      case "frequency":
        return this.selectByFrequency(REHYDRATION_FILE_COUNT);

      case "mixed": {
        // 3 most recent + 2 most frequent, deduplicated
        const recent = this.recentFiles.slice(0, 3);
        const recentSet = new Set(recent);
        const frequent = this.selectByFrequency(REHYDRATION_FILE_COUNT)
          .filter((f) => !recentSet.has(f))
          .slice(0, 2);
        return [...recent, ...frequent];
      }

      case "recency":
      default:
        return this.recentFiles.slice(0, REHYDRATION_FILE_COUNT);
    }
  }

  /**
   * Select the top N most frequently accessed files.
   */
  private selectByFrequency(count: number): readonly string[] {
    if (this.fileAccessFrequency.size === 0) {
      // Fall back to recency if no frequency data
      return this.recentFiles.slice(0, count);
    }

    return Array.from(this.fileAccessFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([filePath]) => filePath);
  }

  /**
   * Track compression ratio for compaction metrics.
   */
  private trackCompactionRatio(originalTokens: number, compactedTokens: number): void {
    const saved = originalTokens - compactedTokens;
    this.totalTokensSaved += saved;

    if (originalTokens > 0) {
      this.totalCompressionRatios.push(compactedTokens / originalTokens);
    }
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
      for (const f of Array.from(modifiedFiles).slice(0, 20)) {
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
