export type { GuardrailResult, GuardrailRule } from "./types.js";
export { scanForSecrets } from "./secret-scanner.js";
export type { SecretScanResult } from "./secret-scanner.js";
export { checkCommand } from "./command-filter.js";
export { checkPath } from "./path-filter.js";
export type { PathFilterResult } from "./path-filter.js";
export { detectInjection } from "./injection-detector.js";
export type { InjectionDetectionResult } from "./injection-detector.js";
export { limitOutput } from "./output-limiter.js";
export type { OutputLimitResult } from "./output-limiter.js";
export { shannonEntropy, detectHighEntropySecrets } from "./entropy-scanner.js";
export type { SecretCandidate } from "./entropy-scanner.js";

import type { GuardrailResult } from "./types.js";
import { checkCommand } from "./command-filter.js";
import { checkPath } from "./path-filter.js";
import { detectInjection } from "./injection-detector.js";
import { scanForSecrets } from "./secret-scanner.js";
import { limitOutput } from "./output-limiter.js";

/** Tools that operate on file paths and should be checked for path traversal. */
const FILE_TOOLS: ReadonlySet<string> = new Set(["file_read", "file_write", "file_edit"]);

export function applyInputGuardrails(
  toolName: string,
  args: Record<string, unknown>,
  workingDirectory?: string,
): GuardrailResult {
  // Command safety check for shell execution
  if (toolName === "bash_exec" && typeof args["command"] === "string") {
    return checkCommand(args["command"]);
  }

  // Path safety check for file-related tools
  if (FILE_TOOLS.has(toolName) && workingDirectory) {
    const filePath =
      typeof args["file_path"] === "string"
        ? args["file_path"]
        : typeof args["path"] === "string"
          ? args["path"]
          : undefined;

    if (filePath) {
      const pathResult = checkPath(filePath, workingDirectory);
      if (!pathResult.safe) {
        return {
          passed: false,
          reason: pathResult.reason,
          severity: "block",
        };
      }
    }
  }

  return { passed: true, severity: "info" };
}

/**
 * Detect prompt injection patterns in user-provided text.
 * Returns a GuardrailResult; callers decide how to handle warn vs block.
 */
export function applyInjectionGuardrails(text: string): GuardrailResult {
  const result = detectInjection(text);
  if (!result.detected) {
    return { passed: true, severity: "info" };
  }

  return {
    passed: result.severity !== "block",
    reason: `Prompt injection detected (${result.type})`,
    severity: result.severity,
  };
}

export function applyOutputGuardrails(output: string): GuardrailResult {
  // Check for injection patterns in output (model may be relaying injected content)
  const injectionResult = detectInjection(output);
  if (injectionResult.detected && injectionResult.severity === "block") {
    return {
      passed: false,
      reason: `Output contains injection pattern (${injectionResult.type})`,
      severity: "block",
    };
  }

  // Scan for secrets and redact
  const scanResult = scanForSecrets(output);
  const text = scanResult.found ? scanResult.redacted : output;

  // Apply output size limits
  const limitResult = limitOutput(text);
  const finalText = limitResult.limited ? limitResult.result : text;

  const modified = scanResult.found || limitResult.limited ? finalText : undefined;

  if (scanResult.found) {
    return {
      passed: true,
      modified,
      reason: `Redacted secrets: ${scanResult.patterns.join(", ")}`,
      severity: "warn",
    };
  }

  if (limitResult.limited) {
    return {
      passed: true,
      modified,
      reason: "Output truncated due to size limit",
      severity: "info",
    };
  }

  // If injection was detected at warn level, note it but pass through
  if (injectionResult.detected) {
    return {
      passed: true,
      reason: `Output may contain injection pattern (${injectionResult.type})`,
      severity: "warn",
    };
  }

  return { passed: true, severity: "info" };
}
