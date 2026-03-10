import {
  type MemoryConfig,
  readMainMemory,
  readTopicMemory,
  readGlobalMemory,
  writeMainMemory,
  writeTopicMemory,
} from "./memory-storage.js";
import { BaseError } from "../utils/error.js";
import { getLogger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Categories of auto-detected memories */
export type MemoryCategory =
  | "architecture"
  | "patterns"
  | "debugging"
  | "preferences"
  | "infrastructure"
  | "conventions"
  | "dependencies"
  | "files";

/** A single auto-detected memory entry */
export interface AutoMemoryEntry {
  readonly category: MemoryCategory;
  readonly content: string;
  readonly confidence: number;
  readonly source: string;
}

/** Configuration for the auto-memory collector */
export interface AutoMemoryConfig {
  readonly enabled: boolean;
  readonly minConfidence: number;
  readonly maxEntriesPerSession: number;
  readonly deduplication: boolean;
}

/** Context from a completed agent loop turn */
export interface TurnContext {
  readonly userMessage: string;
  readonly assistantResponse: string;
  readonly toolCalls: readonly ToolCallInfo[];
  readonly filesAccessed: readonly string[];
  readonly errorsEncountered: readonly string[];
}

/** Information about a single tool call within a turn */
export interface ToolCallInfo {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: string;
  readonly success: boolean;
}

/** Error for auto-memory operations */
export class AutoMemoryError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "AUTO_MEMORY_ERROR", context);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AutoMemoryConfig = {
  enabled: true,
  minConfidence: 0.7,
  maxEntriesPerSession: 20,
  deduplication: true,
};

/** Category → topic file name mapping */
const CATEGORY_TOPIC_MAP: Readonly<Record<MemoryCategory, string>> = {
  architecture: "architecture",
  patterns: "patterns",
  debugging: "debugging",
  preferences: "preferences",
  infrastructure: "infrastructure",
  conventions: "conventions",
  dependencies: "dependencies",
  files: "files",
};

/** Maximum lines allowed in MEMORY.md before spilling to topic files */
const MAIN_MEMORY_MAX_LINES = 200;

// ---------------------------------------------------------------------------
// Pattern detection rules
// ---------------------------------------------------------------------------

interface PatternRule {
  readonly category: MemoryCategory;
  readonly patterns: readonly RegExp[];
  readonly baseConfidence: number;
  readonly extractor: (match: RegExp, text: string) => string | null;
}

/**
 * Build pattern rules for detecting memorable content.
 * Each rule has keyword patterns, a base confidence score,
 * and an extractor that pulls the relevant snippet from the text.
 */
function buildPatternRules(): readonly PatternRule[] {
  return [
    {
      category: "architecture",
      patterns: [
        /(?:architecture|architectural)\s+(?:decision|pattern|design)/i,
        /design\s+decision/i,
        /(?:decided|choosing|chose)\s+to\s+use/i,
        /(?:class|interface|module)\s+(?:structure|hierarchy|diagram)/i,
        /layer(?:ed|ing)?\s+architecture/i,
        /separation\s+of\s+concerns/i,
        /dependency\s+(?:injection|inversion)/i,
      ],
      baseConfidence: 0.8,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      category: "debugging",
      patterns: [
        /(?:fixed|resolved)\s+by/i,
        /root\s+cause(?:\s+was)?/i,
        /workaround(?:\s+for)?/i,
        /the\s+(?:issue|bug|problem)\s+was/i,
        /(?:solution|fix):\s+/i,
        /error\s+was\s+caused\s+by/i,
        /turns?\s+out\s+(?:that\s+)?the/i,
      ],
      baseConfidence: 0.85,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      category: "preferences",
      patterns: [
        /always\s+use/i,
        /(?:prefer|recommended)\s+(?:to\s+use|using)/i,
        /(?:don't|do\s+not|never)\s+use/i,
        /(?:instead\s+of|rather\s+than)\s+using/i,
        /(?:we|I)\s+(?:always|usually|prefer\s+to)/i,
      ],
      baseConfidence: 0.75,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      category: "conventions",
      patterns: [
        /naming\s+convention/i,
        /(?:code|coding)\s+style/i,
        /(?:format|formatting)\s+(?:rule|standard|convention)/i,
        /(?:prefix|suffix)\s+(?:with|using)/i,
        /(?:camelCase|PascalCase|snake_case|kebab-case)/i,
      ],
      baseConfidence: 0.75,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      category: "infrastructure",
      patterns: [
        /(?:build|deploy)\s+(?:command|script|step)/i,
        /(?:ci|cd|pipeline)\s+(?:config|setup|step)/i,
        /environment\s+variable/i,
        /(?:docker|kubernetes|k8s)\s+(?:config|setup)/i,
        /(?:npm|pnpm|yarn)\s+(?:run|script)/i,
      ],
      baseConfidence: 0.7,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      category: "dependencies",
      patterns: [
        /(?:requires?|depends?\s+on)\s+(?:version|package)/i,
        /(?:upgraded?|downgraded?|migrated?)\s+(?:from|to)/i,
        /(?:incompatible|breaking\s+change)\s+(?:with|in)/i,
        /peer\s+dependency/i,
      ],
      baseConfidence: 0.7,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      category: "patterns",
      patterns: [
        /(?:pattern|approach)\s+(?:for|to|that)/i,
        /(?:best\s+practice|recommended\s+approach)/i,
        /(?:this|the)\s+(?:pattern|technique)\s+(?:works?|is)/i,
        /(?:common|recurring)\s+pattern/i,
      ],
      baseConfidence: 0.7,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
  ];
}

// ---------------------------------------------------------------------------
// AutoMemoryCollector
// ---------------------------------------------------------------------------

/**
 * Collects and manages auto-detected memories from agent loop turns.
 *
 * Analyzes each completed turn for patterns worth remembering (architecture
 * decisions, debugging insights, user preferences, etc.) using keyword-based
 * detection. Collected entries are flushed to disk either in the main
 * MEMORY.md or in category-specific topic files.
 */
export class AutoMemoryCollector {
  private readonly storage: MemoryConfig;
  private readonly config: AutoMemoryConfig;
  private readonly pending: AutoMemoryEntry[] = [];
  private readonly patternRules: readonly PatternRule[];
  private readonly fileAccessCounts: Map<string, number> = new Map();
  private totalEntriesThisSession = 0;

  constructor(storage: MemoryConfig, config?: Partial<AutoMemoryConfig>) {
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.patternRules = buildPatternRules();
  }

  /**
   * Analyze a completed turn for content worth remembering.
   * Returns detected entries with confidence >= minConfidence.
   * Does NOT persist anything — call flush() to write to disk.
   */
  analyzeForMemories(turn: TurnContext): readonly AutoMemoryEntry[] {
    if (!this.config.enabled) {
      return [];
    }

    if (this.totalEntriesThisSession >= this.config.maxEntriesPerSession) {
      return [];
    }

    const entries: AutoMemoryEntry[] = [];

    // Analyze assistant response for patterns
    const responseEntries = this.detectPatterns(turn.assistantResponse, "assistant-response");
    entries.push(...responseEntries);

    // Analyze user message for preferences/corrections
    const userEntries = this.detectPatterns(turn.userMessage, "user-message");
    entries.push(...userEntries);

    // Track frequently accessed files
    const fileEntries = this.detectFrequentFiles(turn.filesAccessed);
    entries.push(...fileEntries);

    // Detect resolved error patterns
    const errorEntries = this.detectResolvedErrors(turn);
    entries.push(...errorEntries);

    // Enforce session limit
    const remainingBudget = this.config.maxEntriesPerSession - this.totalEntriesThisSession;
    const accepted = entries.slice(0, remainingBudget);

    for (const entry of accepted) {
      this.pending.push(entry);
    }
    this.totalEntriesThisSession += accepted.length;

    return accepted;
  }

  /**
   * Check if an entry's content is already stored in existing memory files.
   * Uses normalized substring matching (case-insensitive for headers,
   * whitespace-normalized for content).
   */
  async isDuplicate(entry: AutoMemoryEntry): Promise<boolean> {
    if (!this.config.deduplication) {
      return false;
    }

    const normalized = normalizeForComparison(entry.content);

    // Check main memory
    const mainContent = await readMainMemory(this.storage);
    if (mainContent && containsNormalized(mainContent, normalized)) {
      return true;
    }

    // Check the relevant topic file
    const topicName = CATEGORY_TOPIC_MAP[entry.category];
    const topicContent = await readTopicMemory(this.storage, topicName);
    if (topicContent && containsNormalized(topicContent, normalized)) {
      return true;
    }

    // Check against other pending entries
    return this.pending.some(
      (p) => p !== entry && normalizeForComparison(p.content) === normalized,
    );
  }

  /**
   * Flush all pending entries to disk.
   * Entries that fit within the main MEMORY.md line limit are appended there.
   * Overflow entries go to category-specific topic files.
   * Returns the number of entries successfully saved.
   */
  async flush(): Promise<number> {
    if (this.pending.length === 0) {
      return 0;
    }

    const logger = getLogger();
    let savedCount = 0;

    // Deduplicate before writing
    const toWrite: AutoMemoryEntry[] = [];
    for (const entry of this.pending) {
      try {
        const duplicate = await this.isDuplicate(entry);
        if (!duplicate) {
          toWrite.push(entry);
        }
      } catch (error: unknown) {
        logger.warn({ error: String(error) }, "Failed to check duplicate, skipping entry");
      }
    }

    if (toWrite.length === 0) {
      this.pending.length = 0;
      return 0;
    }

    // Read current main memory
    let mainContent = await readMainMemory(this.storage);
    const mainLineCount = mainContent ? mainContent.split("\n").length : 0;

    // Separate entries: those that fit in main vs overflow to topics
    const forMain: AutoMemoryEntry[] = [];
    const forTopics: AutoMemoryEntry[] = [];
    let projectedLines = mainLineCount;

    for (const entry of toWrite) {
      const entryLines = formatEntryForStorage(entry).split("\n").length;
      if (projectedLines + entryLines + 1 <= MAIN_MEMORY_MAX_LINES) {
        forMain.push(entry);
        projectedLines += entryLines + 1;
      } else {
        forTopics.push(entry);
      }
    }

    // Write to main MEMORY.md
    if (forMain.length > 0) {
      const newSections = forMain.map(formatEntryForStorage);
      const separator = mainContent ? "\n\n" : "";
      const updatedContent = mainContent + separator + newSections.join("\n\n");
      try {
        await writeMainMemory(this.storage, updatedContent);
        savedCount += forMain.length;
      } catch (error: unknown) {
        logger.error({ error: String(error) }, "Failed to write main memory");
      }
    }

    // Write overflow to topic files
    const topicGroups = groupByCategory(forTopics);
    for (const [category, entries] of topicGroups) {
      const topicName = CATEGORY_TOPIC_MAP[category];
      try {
        const existingContent = (await readTopicMemory(this.storage, topicName)) ?? "";
        const newSections = entries.map(formatEntryForStorage);
        const separator = existingContent ? "\n\n" : "";
        const updatedContent = existingContent + separator + newSections.join("\n\n");
        await writeTopicMemory(this.storage, topicName, updatedContent);
        savedCount += entries.length;
      } catch (error: unknown) {
        logger.error({ error: String(error), topic: topicName }, "Failed to write topic memory");
      }
    }

    this.pending.length = 0;
    return savedCount;
  }

  /**
   * Get all entries collected this session that have not been flushed.
   */
  getPending(): readonly AutoMemoryEntry[] {
    return [...this.pending];
  }

  /**
   * Build a system prompt section containing loaded memories.
   * Loads MEMORY.md (first 200 lines), global memory, and relevant topic files.
   */
  async buildMemoryPrompt(): Promise<string> {
    const sections: string[] = [];

    // Load project main memory
    const mainContent = await readMainMemory(this.storage);
    if (mainContent) {
      sections.push(`## MEMORY.md\n\n${mainContent}`);
    }

    // Load global memory
    const globalContent = await readGlobalMemory(this.storage);
    if (globalContent) {
      sections.push(`## Global Memory\n\n${globalContent}`);
    }

    // Load topic files that exist
    for (const topicName of Object.values(CATEGORY_TOPIC_MAP)) {
      try {
        const topicContent = await readTopicMemory(this.storage, topicName);
        if (topicContent) {
          const displayName = topicName.charAt(0).toUpperCase() + topicName.slice(1);
          sections.push(`## Topic: ${displayName}\n\n${topicContent}`);
        }
      } catch {
        // Skip topics that fail to load
      }
    }

    if (sections.length === 0) {
      return "";
    }

    return `# Auto-Memory (Project)\n\n${sections.join("\n\n")}`;
  }

  /**
   * Clear all pending entries without writing them to disk.
   */
  clearPending(): void {
    this.pending.length = 0;
  }

  // -----------------------------------------------------------------------
  // Internal detection methods
  // -----------------------------------------------------------------------

  /** Detect memorable patterns in text using keyword rules. */
  private detectPatterns(text: string, source: string): AutoMemoryEntry[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const entries: AutoMemoryEntry[] = [];
    const seen = new Set<string>();

    for (const rule of this.patternRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          const extracted = rule.extractor(pattern, text);
          if (extracted && !seen.has(extracted)) {
            seen.add(extracted);
            const confidence = computeConfidence(rule.baseConfidence, extracted);
            if (confidence >= this.config.minConfidence) {
              entries.push({
                category: rule.category,
                content: extracted,
                confidence,
                source,
              });
            }
          }
        }
      }
    }

    return entries;
  }

  /** Track file access frequency and generate entries for key files. */
  private detectFrequentFiles(filesAccessed: readonly string[]): AutoMemoryEntry[] {
    const entries: AutoMemoryEntry[] = [];

    for (const filePath of filesAccessed) {
      const currentCount = (this.fileAccessCounts.get(filePath) ?? 0) + 1;
      this.fileAccessCounts.set(filePath, currentCount);

      // A file accessed 3+ times is likely important
      if (currentCount === 3) {
        entries.push({
          category: "files",
          content: `Key file: ${filePath} (accessed frequently during this session)`,
          confidence: 0.75,
          source: "file-access-tracking",
        });
      }
    }

    return entries;
  }

  /** Detect errors that were encountered and then resolved in the same turn. */
  private detectResolvedErrors(turn: TurnContext): AutoMemoryEntry[] {
    if (turn.errorsEncountered.length === 0) {
      return [];
    }

    const entries: AutoMemoryEntry[] = [];
    const responseLC = turn.assistantResponse.toLowerCase();

    // Look for resolution indicators in the assistant response
    const resolutionIndicators = [
      "fixed",
      "resolved",
      "solution",
      "the issue was",
      "the problem was",
      "root cause",
      "workaround",
    ];

    const hasResolution = resolutionIndicators.some((indicator) => responseLC.includes(indicator));

    if (hasResolution) {
      for (const error of turn.errorsEncountered) {
        const trimmedError = error.trim();
        if (trimmedError.length > 0) {
          entries.push({
            category: "debugging",
            content: `Error resolved: "${truncateString(trimmedError, 200)}" - See assistant response for solution.`,
            confidence: 0.85,
            source: "error-resolution",
          });
        }
      }
    }

    return entries;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Extract the sentence(s) surrounding a regex match in text. */
function extractSentenceAround(pattern: RegExp, text: string): string | null {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) {
    return null;
  }

  // Find sentence boundaries around the match
  const beforeMatch = text.slice(0, match.index);
  const afterMatch = text.slice(match.index + match[0].length);

  // Walk backward to find the start of the sentence
  const sentenceStartChars = ["\n", ".", "!", "?"];
  let sentenceStart = 0;
  for (let i = beforeMatch.length - 1; i >= 0; i--) {
    if (sentenceStartChars.includes(beforeMatch[i]!)) {
      sentenceStart = i + 1;
      break;
    }
  }

  // Walk forward to find the end of the sentence
  const sentenceEndMatch = /[.!?\n]/.exec(afterMatch);
  const sentenceEnd = sentenceEndMatch
    ? match.index + match[0].length + sentenceEndMatch.index + 1
    : Math.min(text.length, match.index + match[0].length + 200);

  const sentence = text.slice(sentenceStart, sentenceEnd).trim();
  return sentence.length > 0 ? truncateString(sentence, 500) : null;
}

/** Compute final confidence based on base + content quality signals. */
function computeConfidence(baseConfidence: number, content: string): number {
  let confidence = baseConfidence;

  // Boost for longer, more detailed content (likely more useful)
  if (content.length > 100) {
    confidence = Math.min(1, confidence + 0.05);
  }

  // Reduce for very short content (might be noise)
  if (content.length < 20) {
    confidence = Math.max(0, confidence - 0.15);
  }

  // Boost for content with code-like tokens
  if (/`[^`]+`/.test(content) || /\b(?:function|class|interface|const|let|var)\b/.test(content)) {
    confidence = Math.min(1, confidence + 0.05);
  }

  return Math.round(confidence * 100) / 100;
}

/** Normalize text for deduplication comparison. */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^#+\s*/gm, "")
    .trim();
}

/** Check if haystack contains the normalized needle. */
function containsNormalized(haystack: string, normalizedNeedle: string): boolean {
  const normalizedHaystack = normalizeForComparison(haystack);
  return normalizedHaystack.includes(normalizedNeedle);
}

/** Format an AutoMemoryEntry for writing to a .md file. */
function formatEntryForStorage(entry: AutoMemoryEntry): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const categoryLabel = entry.category.charAt(0).toUpperCase() + entry.category.slice(1);
  return `### ${categoryLabel} (${timestamp})\n\n${entry.content}`;
}

/** Group entries by their category. */
function groupByCategory(
  entries: readonly AutoMemoryEntry[],
): Map<MemoryCategory, AutoMemoryEntry[]> {
  const groups = new Map<MemoryCategory, AutoMemoryEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.category);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.category, [entry]);
    }
  }
  return groups;
}

/** Truncate a string to a maximum length, adding ellipsis if truncated. */
function truncateString(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}
