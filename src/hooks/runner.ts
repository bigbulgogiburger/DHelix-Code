import { exec } from "node:child_process";
import { BaseError } from "../utils/error.js";
import {
  type HookConfig,
  type HookEvent,
  type HookEventPayload,
  type HookHandler,
  type HookHandlerResult,
  type HookRule,
  type HookRunResult,
  type CommandHookHandler,
  type HttpHookHandler,
  type PromptHookHandler,
  type AgentHookHandler,
} from "./types.js";

/** Default timeout for hook handlers (30 seconds) */
const DEFAULT_HOOK_TIMEOUT_MS = 30_000;

/** Hook execution error */
export class HookError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "HOOK_ERROR", context);
  }
}

/**
 * Interpolate variables in a string using the event payload.
 * Supports: $FILE_PATH, $TOOL_NAME, $SESSION_ID, $WORKING_DIR, and custom $data.key
 */
function interpolateVariables(template: string, payload: HookEventPayload): string {
  let result = template;
  result = result.replace(/\$FILE_PATH/g, payload.filePath ?? "");
  result = result.replace(/\$TOOL_NAME/g, payload.toolCall?.name ?? "");
  result = result.replace(/\$SESSION_ID/g, payload.sessionId ?? "");
  result = result.replace(/\$WORKING_DIR/g, payload.workingDirectory ?? process.cwd());

  if (payload.data) {
    for (const [key, value] of Object.entries(payload.data)) {
      result = result.replace(new RegExp(`\\$${key}`, "g"), String(value));
    }
  }

  return result;
}

/**
 * Check if a hook rule's matcher matches the current event context.
 * Matcher is a pipe-delimited list of patterns (e.g., "file_edit|file_write").
 * If no matcher is set, the rule always matches.
 */
function matchesRule(rule: HookRule, payload: HookEventPayload): boolean {
  if (!rule.matcher) return true;

  const patterns = rule.matcher.split("|").map((p) => p.trim());
  const toolName = payload.toolCall?.name ?? "";

  return patterns.some((pattern) => {
    if (pattern === toolName) return true;
    // Simple glob: * matches any sequence
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    return regex.test(toolName);
  });
}

/**
 * Execute a command hook handler.
 * Passes event payload as JSON on stdin. Reads stdout/stderr.
 * Exit code 0 = pass, 2 = block, other = error.
 */
async function executeCommandHandler(
  handler: CommandHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  const command = interpolateVariables(handler.command, payload);
  const timeoutMs = handler.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS;

  return new Promise<HookHandlerResult>((resolve) => {
    const child = exec(
      command,
      {
        timeout: timeoutMs,
        cwd: payload.workingDirectory ?? process.cwd(),
        env: {
          ...process.env,
          DBCODE_EVENT: payload.event,
          DBCODE_TOOL_NAME: payload.toolCall?.name ?? "",
          DBCODE_FILE_PATH: payload.filePath ?? "",
          DBCODE_SESSION_ID: payload.sessionId ?? "",
        },
      },
      (error, stdout, stderr) => {
        // child_process exec error has 'code' as exit code number on the error object
        const exitCode: number = error
          ? (((error as unknown as Record<string, unknown>).code as number) ?? 1)
          : 0;

        resolve({
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          blocked: exitCode === 2,
          handlerType: "command",
        });
      },
    );

    // Send payload as JSON on stdin
    // Handle EPIPE gracefully — child may exit before stdin write completes
    if (child.stdin) {
      child.stdin.on("error", () => {
        // Ignore EPIPE — the child process already exited
      });
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    }
  });
}

/**
 * Execute an HTTP hook handler.
 * POSTs the event payload as JSON to the configured URL.
 * Response JSON may contain { blocked: boolean, message: string }.
 */
async function executeHttpHandler(
  handler: HttpHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  const timeoutMs = handler.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(handler.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...handler.headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();
    let blocked = false;
    let stdout = text;

    try {
      const json = JSON.parse(text) as { blocked?: boolean; message?: string };
      blocked = json.blocked === true;
      stdout = json.message ?? text;
    } catch {
      // Response is not JSON — use raw text
    }

    return {
      exitCode: response.ok ? (blocked ? 2 : 0) : 1,
      stdout,
      stderr: "",
      blocked,
      handlerType: "http",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      blocked: false,
      handlerType: "http",
    };
  }
}

/**
 * Execute a prompt hook handler.
 * Displays a confirmation prompt to the user with the configured message.
 * In CI mode (DBCODE_HOOK_AUTO_APPROVE=true), auto-approves.
 * Otherwise, reports the prompt message and treats the hook as non-blocking
 * unless the environment indicates rejection.
 */
async function executePromptHandler(
  handler: PromptHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  const message = interpolateVariables(handler.promptMessage, payload);
  const isAutoApprove = process.env.DBCODE_HOOK_AUTO_APPROVE === "true";

  if (isAutoApprove) {
    return {
      exitCode: 0,
      stdout: `[prompt:auto-approved] ${message}`,
      stderr: "",
      blocked: false,
      handlerType: "prompt",
    };
  }

  // In interactive mode, report the prompt message.
  // The user confirmation is handled at the CLI layer — if
  // DBCODE_HOOK_REJECT is set to "true", treat as rejection.
  const isRejected = process.env.DBCODE_HOOK_REJECT === "true";

  if (isRejected) {
    return {
      exitCode: 2,
      stdout: `[prompt:rejected] ${message}`,
      stderr: "",
      blocked: true,
      handlerType: "prompt",
    };
  }

  return {
    exitCode: 0,
    stdout: `[prompt:shown] ${message}`,
    stderr: "",
    blocked: false,
    handlerType: "prompt",
  };
}

/**
 * Safely resolve a nested property from an object using a dot-separated path.
 * Returns undefined if the path does not resolve.
 */
function resolveProperty(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Safely evaluate a validator expression against a payload.
 *
 * Instead of using eval(), this parses a restricted set of comparison expressions:
 *   - "payload.path.to.field !== 'value'"
 *   - "payload.path.to.field === 'value'"
 *   - "payload.path.to.field !== true"
 *   - "!payload.path.to.field?.includes('substring')"
 *   - Logical operators: "&&", "||" to combine comparisons
 *
 * Returns true if the validator passes (operation allowed), false if blocked.
 */
function evaluateValidator(validator: string, payload: HookEventPayload): boolean {
  // Handle logical operators by splitting and evaluating each part
  if (validator.includes("||")) {
    const parts = validator.split("||").map((p) => p.trim());
    return parts.some((part) => evaluateValidator(part, payload));
  }

  if (validator.includes("&&")) {
    const parts = validator.split("&&").map((p) => p.trim());
    return parts.every((part) => evaluateValidator(part, payload));
  }

  const trimmed = validator.trim();

  // Handle negated includes: "!payload.path?.includes('value')"
  const negatedIncludesMatch = trimmed.match(
    /^!payload\.(.+?)\?\.includes\(\s*['"](.+?)['"]\s*\)$/,
  );
  if (negatedIncludesMatch) {
    const propPath = negatedIncludesMatch[1];
    const searchValue = negatedIncludesMatch[2];
    const resolved = resolveProperty(payload, propPath);
    if (typeof resolved === "string") {
      return !resolved.includes(searchValue);
    }
    if (Array.isArray(resolved)) {
      return !resolved.includes(searchValue);
    }
    // Property not found or not a string/array — negation is true
    return true;
  }

  // Handle positive includes: "payload.path?.includes('value')"
  const includesMatch = trimmed.match(/^payload\.(.+?)\?\.includes\(\s*['"](.+?)['"]\s*\)$/);
  if (includesMatch) {
    const propPath = includesMatch[1];
    const searchValue = includesMatch[2];
    const resolved = resolveProperty(payload, propPath);
    if (typeof resolved === "string") {
      return resolved.includes(searchValue);
    }
    if (Array.isArray(resolved)) {
      return resolved.includes(searchValue);
    }
    return false;
  }

  // Handle strict inequality: "payload.path !== 'value'" or "payload.path !== true/false"
  const neqMatch = trimmed.match(/^payload\.(.+?)\s*!==\s*(.+)$/);
  if (neqMatch) {
    const propPath = neqMatch[1];
    const rawValue = neqMatch[2].trim();
    const resolved = resolveProperty(payload, propPath);
    const compareValue = parseLiteralValue(rawValue);
    return resolved !== compareValue;
  }

  // Handle strict equality: "payload.path === 'value'" or "payload.path === true/false"
  const eqMatch = trimmed.match(/^payload\.(.+?)\s*===\s*(.+)$/);
  if (eqMatch) {
    const propPath = eqMatch[1];
    const rawValue = eqMatch[2].trim();
    const resolved = resolveProperty(payload, propPath);
    const compareValue = parseLiteralValue(rawValue);
    return resolved === compareValue;
  }

  // Handle negated truthy check: "!payload.path"
  const negatedTruthyMatch = trimmed.match(/^!payload\.(.+)$/);
  if (negatedTruthyMatch) {
    const propPath = negatedTruthyMatch[1];
    const resolved = resolveProperty(payload, propPath);
    return !resolved;
  }

  // Handle truthy check: "payload.path"
  const truthyMatch = trimmed.match(/^payload\.(.+)$/);
  if (truthyMatch) {
    const propPath = truthyMatch[1];
    const resolved = resolveProperty(payload, propPath);
    return Boolean(resolved);
  }

  // Unrecognized expression — fail safe by rejecting (returning false)
  return false;
}

/**
 * Parse a literal value from a validator expression string.
 * Handles: 'string', "string", true, false, null, undefined, numbers.
 */
function parseLiteralValue(raw: string): unknown {
  // Quoted string (single or double quotes)
  const stringMatch = raw.match(/^['"](.*)['"]$/);
  if (stringMatch) return stringMatch[1];

  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw === "undefined") return undefined;

  // Number
  const num = Number(raw);
  if (!Number.isNaN(num)) return num;

  return raw;
}

/**
 * Execute an agent hook handler.
 * Evaluates a declarative validator expression against the event payload.
 * Does NOT use eval() — uses safe expression parsing instead.
 */
async function executeAgentHandler(
  handler: AgentHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  try {
    const passed = evaluateValidator(handler.validator, payload);

    if (passed) {
      return {
        exitCode: 0,
        stdout: `[agent:pass] ${handler.description}`,
        stderr: "",
        blocked: false,
        handlerType: "agent",
      };
    }

    return {
      exitCode: 2,
      stdout: `[agent:blocked] ${handler.description} — validator rejected the payload`,
      stderr: "",
      blocked: true,
      handlerType: "agent",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Agent validator error: ${error instanceof Error ? error.message : String(error)}`,
      blocked: false,
      handlerType: "agent",
    };
  }
}

/**
 * Execute a single hook handler, dispatching by type.
 */
async function executeHandler(
  handler: HookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  switch (handler.type) {
    case "command":
      return executeCommandHandler(handler, payload);
    case "http":
      return executeHttpHandler(handler, payload);
    case "prompt":
      return executePromptHandler(handler, payload);
    case "agent":
      return executeAgentHandler(handler, payload);
  }
}

/**
 * Hook runner — matches events to configured rules and executes handlers.
 * Provides error isolation: individual handler failures don't crash the system.
 */
export class HookRunner {
  constructor(private readonly config: HookConfig) {}

  /**
   * Run all hooks for a given event.
   * Executes matched rules' handlers sequentially.
   * If a blocking handler returns exit code 2, subsequent handlers still run
   * but the final result is marked as blocked.
   */
  async run(event: HookEvent, payload: HookEventPayload): Promise<HookRunResult> {
    const rules = this.config[event];
    if (!rules || rules.length === 0) {
      return { blocked: false, results: [], contextOutput: "" };
    }

    const fullPayload: HookEventPayload = { ...payload, event };
    const results: HookHandlerResult[] = [];
    let blocked = false;
    let blockReason: string | undefined;
    const contextParts: string[] = [];

    for (const rule of rules) {
      if (!matchesRule(rule, fullPayload)) continue;

      for (const handler of rule.hooks) {
        try {
          const result = await executeHandler(handler, fullPayload);
          results.push(result);

          if (result.stdout) {
            contextParts.push(result.stdout);
          }

          if (result.blocked && handler.blocking !== false) {
            blocked = true;
            if (!blockReason && result.stdout) {
              blockReason = result.stdout;
            }
          }
        } catch (error) {
          // Error isolation: log but don't crash
          results.push({
            exitCode: 1,
            stdout: "",
            stderr: error instanceof Error ? error.message : String(error),
            blocked: false,
            handlerType: handler.type,
          });
        }
      }
    }

    return {
      blocked,
      blockReason,
      results,
      contextOutput: contextParts.join("\n"),
    };
  }

  /** Check if any hooks are configured for a given event */
  hasHooks(event: HookEvent): boolean {
    const rules = this.config[event];
    return rules !== undefined && rules.length > 0;
  }

  /** Get all configured events that have hooks */
  getConfiguredEvents(): readonly HookEvent[] {
    return (Object.keys(this.config) as HookEvent[]).filter((event) => this.hasHooks(event));
  }
}
