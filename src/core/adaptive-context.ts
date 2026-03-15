/** Task complexity level estimated from user input */
export type TaskComplexity = "simple" | "moderate" | "complex";

/** Strategy for what context to include based on task complexity */
export interface ContextStrategy {
  readonly includeRepoMap: boolean;
  readonly includeFullInstructions: boolean;
  readonly maxSystemPromptSections: number;
}

/** Keyword patterns that indicate higher complexity */
const COMPLEX_INDICATORS: readonly RegExp[] = [
  /refactor/i,
  /architect/i,
  /redesign/i,
  /migrate/i,
  /implement\s+(?:a\s+)?(?:new\s+)?(?:system|module|feature|service|pipeline|framework)/i,
  /multi[- ]?(?:step|phase|stage)/i,
  /across\s+(?:multiple|all|several)\s+files/i,
  /end[- ]?to[- ]?end/i,
  /integration/i,
  /performance\s+(?:optimi|audit|profil)/i,
  /security\s+(?:audit|review|harden)/i,
  /debug.*(?:complex|intermittent|race|deadlock)/i,
];

/** Keyword patterns that indicate simple tasks */
const SIMPLE_INDICATORS: readonly RegExp[] = [
  /^(?:fix|change|update|rename|remove|delete|add)\s+(?:a\s+)?(?:typo|comment|import|line|variable|constant)/i,
  /^(?:what|where|how|which|show|explain|describe|list)\b/i,
  /^read\s/i,
  /^run\s/i,
  /^check\s/i,
  /^cat\s/i,
  /^ls\b/i,
  /^find\s+(?:the\s+)?(?:file|function|class|variable|import)/i,
];

/** Threshold for word count to bump complexity */
const MODERATE_WORD_THRESHOLD = 30;
const COMPLEX_WORD_THRESHOLD = 80;

/** Threshold for number of file references to bump complexity */
const FILE_REFERENCE_PATTERN = /(?:[\w.-]+\.(?:ts|js|tsx|jsx|py|go|rs|java|rb|css|html|json|yaml|yml|toml|md))/g;
const MULTI_FILE_THRESHOLD = 3;

/**
 * Estimate the complexity of a task based on the user's input text.
 *
 * Uses a scoring heuristic combining:
 * - Keyword pattern matching (complex/simple indicators)
 * - Input length (word count)
 * - Number of file references
 *
 * @param input - The user's raw input text
 * @returns Estimated task complexity
 */
export function estimateTaskComplexity(input: string): TaskComplexity {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "simple";
  }

  let score = 0;

  // Check complex indicators (+2 each)
  for (const pattern of COMPLEX_INDICATORS) {
    if (pattern.test(trimmed)) {
      score += 2;
    }
  }

  // Check simple indicators (-2 each)
  for (const pattern of SIMPLE_INDICATORS) {
    if (pattern.test(trimmed)) {
      score -= 2;
    }
  }

  // Word count contribution
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= COMPLEX_WORD_THRESHOLD) {
    score += 2;
  } else if (wordCount >= MODERATE_WORD_THRESHOLD) {
    score += 1;
  }

  // File reference count contribution
  const fileMatches = trimmed.match(FILE_REFERENCE_PATTERN);
  const fileRefCount = fileMatches ? fileMatches.length : 0;
  if (fileRefCount >= MULTI_FILE_THRESHOLD) {
    score += 1;
  }

  // Map score to complexity
  if (score >= 3) {
    return "complex";
  }
  if (score >= 1) {
    return "moderate";
  }
  return "simple";
}

/**
 * Get the context loading strategy for a given task complexity.
 *
 * - simple: minimal context (no repo map, abbreviated instructions, few sections)
 * - moderate: balanced context (repo map included, full instructions, moderate sections)
 * - complex: full context (everything loaded, maximum sections)
 *
 * @param complexity - The estimated task complexity
 * @returns Context strategy configuration
 */
export function getContextStrategy(complexity: TaskComplexity): ContextStrategy {
  switch (complexity) {
    case "simple":
      return {
        includeRepoMap: false,
        includeFullInstructions: false,
        maxSystemPromptSections: 4,
      };
    case "moderate":
      return {
        includeRepoMap: true,
        includeFullInstructions: true,
        maxSystemPromptSections: 8,
      };
    case "complex":
      return {
        includeRepoMap: true,
        includeFullInstructions: true,
        maxSystemPromptSections: 16,
      };
  }
}
