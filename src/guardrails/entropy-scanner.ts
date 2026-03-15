export interface SecretCandidate {
  readonly value: string; // first 8 chars + "..."
  readonly entropy: number;
  readonly line: number;
  readonly pattern: string; // variable name pattern that matched
}

/**
 * Variable assignment patterns that commonly hold secrets.
 * Each regex captures the variable name (group 1) and the assigned value (group 2).
 */
const ASSIGNMENT_PATTERNS: readonly { readonly name: string; readonly regex: RegExp }[] = [
  // KEY = "value" or KEY = 'value'
  {
    name: "quoted_assignment",
    regex: /\b([A-Z_][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|API_KEY))\s*[:=]\s*["']([^"']{8,})["']/gi,
  },
  // export KEY="value"
  {
    name: "export_assignment",
    regex: /\bexport\s+([A-Z_][A-Z0-9_]*)\s*=\s*["']([^"']{8,})["']/gi,
  },
  // const/let/var name = "value"
  {
    name: "js_const_assignment",
    regex: /\b(?:const|let|var)\s+(\w*(?:key|token|secret|password|credential|auth)\w*)\s*=\s*["']([^"']{8,})["']/gi,
  },
  // YAML-style key: value (unquoted high-entropy values)
  {
    name: "yaml_assignment",
    regex: /^[ \t]*(\w*(?:key|token|secret|password|credential|auth)\w*)\s*:\s*([^\s#"']{12,})\s*$/gim,
  },
  // Generic assignment: name = "value" for common secret variable names
  {
    name: "generic_assignment",
    regex: /\b(\w*(?:api[_-]?key|access[_-]?key|secret[_-]?key|private[_-]?key|auth[_-]?token)\w*)\s*[:=]\s*["']?([^\s"']{12,})["']?/gi,
  },
];

/**
 * Compute the Shannon entropy of a string.
 *
 * Shannon entropy measures information density. High-entropy strings
 * (> 4.5 bits/char) are likely random/cryptographic values rather than
 * natural language or structured data.
 *
 * @returns entropy in bits per character (0 to log2(uniqueChars))
 */
export function shannonEntropy(str: string): number {
  if (str.length === 0) {
    return 0;
  }

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Default entropy threshold for flagging secrets.
 * 4.5 bits/char is conservative — most English text is ~3.5-4.0,
 * while random hex/base64 strings are typically 4.5-6.0.
 */
const ENTROPY_THRESHOLD = 4.5;

/**
 * Minimum string length to consider for entropy analysis.
 * Very short strings naturally have low entropy variety.
 */
const MIN_VALUE_LENGTH = 8;

/**
 * Detect high-entropy strings in variable assignments.
 *
 * Scans the provided content for known secret-assignment patterns and
 * computes Shannon entropy on the assigned value. Values exceeding the
 * entropy threshold (4.5 bits/char) are flagged as potential secrets.
 *
 * @param content - Source code or configuration content to scan
 * @returns Array of detected high-entropy secret candidates
 */
export function detectHighEntropySecrets(content: string): readonly SecretCandidate[] {
  const candidates: SecretCandidate[] = [];

  // Build a line-lookup map for fast line number resolution
  const lineStarts: readonly number[] = buildLineStarts(content);

  for (const { name, regex } of ASSIGNMENT_PATTERNS) {
    // Create a fresh regex to avoid shared lastIndex state
    const pattern = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const variableName = match[1];
      const value = match[2];

      if (!value || value.length < MIN_VALUE_LENGTH) {
        continue;
      }

      const entropy = shannonEntropy(value);
      if (entropy >= ENTROPY_THRESHOLD) {
        const lineNumber = getLineNumber(lineStarts, match.index);
        const truncatedValue = value.length > 8 ? value.slice(0, 8) + "..." : value;

        candidates.push({
          value: truncatedValue,
          entropy: Math.round(entropy * 100) / 100,
          line: lineNumber,
          pattern: variableName ?? name,
        });
      }
    }
  }

  // Deduplicate by line number + truncated value
  return deduplicateCandidates(candidates);
}

/**
 * Build an array of character offsets for the start of each line.
 * Used for efficient offset-to-line-number lookup.
 */
function buildLineStarts(content: string): readonly number[] {
  const starts: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

/**
 * Convert a character offset to a 1-based line number using binary search.
 */
function getLineNumber(lineStarts: readonly number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (lineStarts[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return low; // 1-based line number
}

/**
 * Remove duplicate candidates that share the same line and truncated value.
 */
function deduplicateCandidates(candidates: readonly SecretCandidate[]): readonly SecretCandidate[] {
  const seen = new Set<string>();
  const unique: SecretCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.line}:${candidate.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }

  return unique;
}
