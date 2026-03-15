/**
 * Built-in code review using Generator-Critic pattern.
 * Builds a review prompt from diff and runs it through the LLM.
 */

/** Severity levels for review issues */
export type ReviewSeverity = "critical" | "high" | "medium" | "low";

/** Categories for review issues */
export type ReviewCategory = "security" | "correctness" | "style" | "performance";

/** A single issue found during code review */
export interface ReviewIssue {
  readonly severity: ReviewSeverity;
  readonly category: ReviewCategory;
  readonly message: string;
  readonly line?: number;
  readonly file?: string;
}

/** The complete result of a code review */
export interface ReviewResult {
  readonly issues: readonly ReviewIssue[];
  readonly summary: string;
  readonly score: number; // 0-100
}

/** Valid severity values for validation */
const VALID_SEVERITIES = new Set<string>(["critical", "high", "medium", "low"]);

/** Valid category values for validation */
const VALID_CATEGORIES = new Set<string>(["security", "correctness", "style", "performance"]);

/**
 * Build a structured review prompt from a diff string and optional focus areas.
 *
 * The prompt uses the Generator-Critic pattern:
 * 1. Generator: Analyze the diff for potential issues
 * 2. Critic: Re-evaluate each issue and remove false positives
 *
 * @param diff       - The git diff or code diff to review
 * @param focusAreas - Optional list of areas to focus on (e.g., ["security", "performance"])
 * @returns A prompt string ready to send to an LLM
 */
export function buildReviewPrompt(diff: string, focusAreas?: readonly string[]): string {
  const focusSection = focusAreas && focusAreas.length > 0
    ? `\n\nFocus especially on these areas: ${focusAreas.join(", ")}.`
    : "";

  const prompt = [
    "You are a senior code reviewer performing a thorough review of the following diff.",
    "Use the Generator-Critic pattern:",
    "",
    "STEP 1 (Generator): Analyze the diff and identify ALL potential issues.",
    "STEP 2 (Critic): Re-evaluate each issue. Remove false positives and noise.",
    "         Keep only issues that are genuinely problematic.",
    "",
    "For each confirmed issue, output a JSON object on its own line with this exact format:",
    '  {"severity": "<critical|high|medium|low>", "category": "<security|correctness|style|performance>", "message": "<description>", "line": <number or null>, "file": "<path or null>"}',
    "",
    "After all issues, output a summary section:",
    "  SUMMARY: <1-2 sentence overall assessment>",
    "  SCORE: <0-100 integer, where 100 is perfect code>",
    "",
    "Severity guide:",
    "  critical — Security vulnerabilities, data loss risks, crashes in production",
    "  high     — Logic errors, missing error handling, race conditions",
    "  medium   — Code smells, missing types, poor naming, lack of tests",
    "  low      — Style nits, minor formatting, documentation gaps",
    "",
    "Category guide:",
    "  security    — Auth, injection, secrets, permissions, input validation",
    "  correctness — Logic errors, edge cases, type mismatches, wrong behavior",
    "  style       — Naming, formatting, conventions, dead code, documentation",
    "  performance — N+1 queries, unnecessary allocations, algorithmic complexity",
    focusSection,
    "",
    "--- BEGIN DIFF ---",
    diff,
    "--- END DIFF ---",
  ].join("\n");

  return prompt;
}

/**
 * Parse the LLM's review output into a structured ReviewResult.
 *
 * Expects the LLM output to contain:
 * - JSON issue objects (one per line)
 * - A SUMMARY: line
 * - A SCORE: line
 *
 * Gracefully handles malformed output by skipping unparseable lines.
 *
 * @param llmOutput - The raw text output from the LLM
 * @returns A structured ReviewResult
 */
export function parseReviewResult(llmOutput: string): ReviewResult {
  const lines = llmOutput.split("\n");
  const issues: ReviewIssue[] = [];
  let summary = "";
  let score = 50; // Default score if not found

  for (const line of lines) {
    const trimmed = line.trim();

    // Try to parse as a JSON issue object
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const issue = tryParseIssue(trimmed);
      if (issue) {
        issues.push(issue);
        continue;
      }
    }

    // Check for SUMMARY line
    const summaryMatch = trimmed.match(/^SUMMARY:\s*(.+)$/i);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
      continue;
    }

    // Check for SCORE line
    const scoreMatch = trimmed.match(/^SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      const parsed = parseInt(scoreMatch[1], 10);
      if (parsed >= 0 && parsed <= 100) {
        score = parsed;
      }
      continue;
    }
  }

  // If no summary was found, generate one from issues
  if (!summary) {
    summary = generateFallbackSummary(issues);
  }

  return { issues, summary, score };
}

/**
 * Try to parse a JSON string as a ReviewIssue.
 * Returns null if parsing fails or the object is invalid.
 */
function tryParseIssue(jsonStr: string): ReviewIssue | null {
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (typeof parsed !== "object" || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;

    // Validate required fields
    if (typeof obj.severity !== "string" || !VALID_SEVERITIES.has(obj.severity)) return null;
    if (typeof obj.category !== "string" || !VALID_CATEGORIES.has(obj.category)) return null;
    if (typeof obj.message !== "string" || obj.message.length === 0) return null;

    const issue: ReviewIssue = {
      severity: obj.severity as ReviewSeverity,
      category: obj.category as ReviewCategory,
      message: obj.message,
      ...(typeof obj.line === "number" ? { line: obj.line } : {}),
      ...(typeof obj.file === "string" && obj.file.length > 0 ? { file: obj.file } : {}),
    };

    return issue;
  } catch {
    return null;
  }
}

/**
 * Generate a fallback summary when the LLM doesn't provide one.
 */
function generateFallbackSummary(issues: readonly ReviewIssue[]): string {
  if (issues.length === 0) {
    return "No issues found in the reviewed code.";
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "high").length;
  const mediumCount = issues.filter((i) => i.severity === "medium").length;
  const lowCount = issues.filter((i) => i.severity === "low").length;

  const parts: string[] = [`Found ${issues.length} issue(s):`];
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (highCount > 0) parts.push(`${highCount} high`);
  if (mediumCount > 0) parts.push(`${mediumCount} medium`);
  if (lowCount > 0) parts.push(`${lowCount} low`);

  return parts.join(" ");
}
