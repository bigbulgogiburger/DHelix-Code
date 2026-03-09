export type { GuardrailResult, GuardrailRule } from "./types.js";
export { scanForSecrets } from "./secret-scanner.js";
export type { SecretScanResult } from "./secret-scanner.js";
export { checkCommand } from "./command-filter.js";
export { limitOutput } from "./output-limiter.js";
export type { OutputLimitResult } from "./output-limiter.js";

import type { GuardrailResult } from "./types.js";
import { checkCommand } from "./command-filter.js";
import { scanForSecrets } from "./secret-scanner.js";
import { limitOutput } from "./output-limiter.js";

export function applyInputGuardrails(
  toolName: string,
  args: Record<string, unknown>,
): GuardrailResult {
  if (toolName === "bash_exec" && typeof args["command"] === "string") {
    return checkCommand(args["command"]);
  }

  return { passed: true, severity: "info" };
}

export function applyOutputGuardrails(output: string): GuardrailResult {
  const scanResult = scanForSecrets(output);
  const text = scanResult.found ? scanResult.redacted : output;

  const limitResult = limitOutput(text);
  const finalText = limitResult.result;

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

  return { passed: true, severity: "info" };
}
