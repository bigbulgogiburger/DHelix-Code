import type { GuardrailResult } from "./types.js";

interface CommandPattern {
  readonly regex: RegExp;
  readonly description: string;
}

const BLOCK_PATTERNS: readonly CommandPattern[] = [
  { regex: /rm\s+-rf\s+\/(?!\w)/, description: "Recursive delete of root filesystem" },
  { regex: />\s*\/dev\/sd/, description: "Direct write to block device" },
  { regex: /mkfs/, description: "Filesystem format command" },
  { regex: /dd\s+if=/, description: "Low-level disk write (dd)" },
  { regex: /:\(\)\{\s*:\|:&\s*\};:/, description: "Fork bomb" },
];

const WARN_PATTERNS: readonly CommandPattern[] = [
  { regex: /DROP\s+TABLE/i, description: "SQL DROP TABLE" },
  { regex: /DELETE\s+FROM/i, description: "SQL DELETE FROM" },
  { regex: /chmod\s+777/, description: "Overly permissive chmod" },
  { regex: /sudo\s+rm/, description: "Sudo remove" },
];

export function checkCommand(command: string): GuardrailResult {
  for (const { regex, description } of BLOCK_PATTERNS) {
    if (regex.test(command)) {
      return {
        passed: false,
        reason: `Blocked dangerous command: ${description}`,
        severity: "block",
      };
    }
  }

  for (const { regex, description } of WARN_PATTERNS) {
    if (regex.test(command)) {
      return {
        passed: true,
        reason: `Warning: ${description}`,
        severity: "warn",
      };
    }
  }

  return {
    passed: true,
    severity: "info",
  };
}
