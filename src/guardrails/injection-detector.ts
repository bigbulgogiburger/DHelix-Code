export interface InjectionDetectionResult {
  readonly detected: boolean;
  readonly type?: string;
  readonly severity: "info" | "warn" | "block";
}

interface InjectionPattern {
  readonly name: string;
  readonly regex: RegExp;
  readonly severity: "warn" | "block";
}

/**
 * Patterns that attempt to override system-level instructions.
 * Ordered from most severe (block) to advisory (warn).
 */
const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  // Direct instruction override attempts — block
  {
    name: "instruction_override",
    regex:
      /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?|guidelines?)/i,
    severity: "block",
  },
  {
    name: "instruction_override",
    regex:
      /disregard\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?|guidelines?)/i,
    severity: "block",
  },
  {
    name: "instruction_override",
    regex:
      /forget\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?|guidelines?)/i,
    severity: "block",
  },

  // Role hijacking — block
  {
    name: "role_hijack",
    regex: /you\s+are\s+now\s+(?:a\s+)?(?!going|about|ready)/i,
    severity: "block",
  },
  {
    name: "role_hijack",
    regex: /act\s+as\s+(?:a\s+)?(?:different|new)\s+/i,
    severity: "block",
  },
  {
    name: "role_hijack",
    regex: /from\s+now\s+on\s*,?\s*you\s+(?:are|will|must|should)\b/i,
    severity: "block",
  },

  // System message spoofing — block
  {
    name: "system_spoof",
    regex: /^\s*\[?\s*SYSTEM\s*\]?\s*:/im,
    severity: "block",
  },
  {
    name: "system_spoof",
    regex: /^\s*<\s*system\s*>/im,
    severity: "block",
  },
  {
    name: "system_spoof",
    regex: /^\s*system\s*:\s+/im,
    severity: "block",
  },

  // Hidden instruction embedding — warn
  {
    name: "hidden_instruction",
    regex: /\[INST\]/i,
    severity: "warn",
  },
  {
    name: "hidden_instruction",
    regex: /<<\s*SYS\s*>>/i,
    severity: "warn",
  },
  {
    name: "hidden_instruction",
    regex: /### (?:Instruction|System|Human|Assistant):/i,
    severity: "warn",
  },

  // Encoded payload attempts — warn
  {
    name: "encoded_payload",
    regex: /(?:execute|run|eval)\s*\(\s*(?:atob|Buffer\.from)\s*\(/i,
    severity: "warn",
  },
];

/**
 * Unicode homoglyph ranges used to disguise text.
 * Detects Cyrillic, Greek, and other look-alike characters mixed with Latin text.
 */
const HOMOGLYPH_REGEX =
  /[\u0400-\u04FF\u0370-\u03FF\uFF01-\uFF5E].*[a-zA-Z]|[a-zA-Z].*[\u0400-\u04FF\u0370-\u03FF\uFF01-\uFF5E]/;

/**
 * Detect potential prompt injection patterns in text.
 *
 * Checks for:
 * - Instruction override attempts ("ignore previous instructions")
 * - Role hijacking ("you are now...")
 * - System message spoofing ("[SYSTEM]:" prefixes)
 * - Hidden instruction embedding ([INST], <<SYS>>)
 * - Encoded payload execution attempts
 * - Base64-encoded instruction payloads
 * - Unicode homoglyph attacks (mixed-script obfuscation)
 */
export function detectInjection(text: string): InjectionDetectionResult {
  // Check explicit injection patterns
  for (const { name, regex, severity } of INJECTION_PATTERNS) {
    if (regex.test(text)) {
      return {
        detected: true,
        type: name,
        severity,
      };
    }
  }

  // Check for base64-encoded instructions
  const base64Result = checkBase64Injection(text);
  if (base64Result.detected) {
    return base64Result;
  }

  // Check for Unicode homoglyph attacks
  if (HOMOGLYPH_REGEX.test(text)) {
    // Only flag if the text also contains instruction-like keywords
    const lowered = text.toLowerCase();
    const suspiciousKeywords = [
      "ignore",
      "system",
      "instruction",
      "override",
      "admin",
      "execute",
      "password",
      "secret",
    ];
    const hasSuspiciousKeyword = suspiciousKeywords.some((kw) => lowered.includes(kw));
    if (hasSuspiciousKeyword) {
      return {
        detected: true,
        type: "homoglyph_attack",
        severity: "warn",
      };
    }
  }

  return { detected: false, severity: "info" };
}

/**
 * Detect base64-encoded strings that decode to instruction-like content.
 * Only checks strings that are long enough to be meaningful (>20 chars).
 */
function checkBase64Injection(text: string): InjectionDetectionResult {
  const base64Pattern = /(?:^|[\s"'=])([A-Za-z0-9+/]{20,}={0,2})(?:[\s"']|$)/g;
  let match: RegExpExecArray | null;

  while ((match = base64Pattern.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(match[1], "base64").toString("utf-8");
      // Check if the decoded content looks like an instruction override
      const instructionKeywords = [
        "ignore",
        "system",
        "instruction",
        "override",
        "you are now",
        "disregard",
        "forget previous",
      ];
      const decodedLower = decoded.toLowerCase();
      const hasInstruction = instructionKeywords.some((kw) => decodedLower.includes(kw));
      if (hasInstruction) {
        return {
          detected: true,
          type: "base64_encoded_injection",
          severity: "block",
        };
      }
    } catch {
      // Not valid base64 — ignore
    }
  }

  return { detected: false, severity: "info" };
}
