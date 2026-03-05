import { exec } from "node:child_process";
import { BaseError } from "../utils/error.js";
import { type SkillDefinition, type SkillContext, type SkillExecutionResult } from "./types.js";

/** Skill execution error */
export class SkillExecutionError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SKILL_EXECUTION_ERROR", context);
  }
}

/** Shell command timeout for dynamic context injection (10 seconds) */
const COMMAND_TIMEOUT_MS = 10_000;

/**
 * Interpolate variables in skill body text.
 * Supports: $ARGUMENTS, $0/$1/$2..., $ARGUMENTS[0], ${DBCODE_*} env vars.
 */
function interpolateVariables(body: string, context: SkillContext): string {
  let result = body;

  // $ARGUMENTS — full argument string
  result = result.replace(/\$ARGUMENTS(?!\[)/g, context.arguments);

  // $ARGUMENTS[N] — positional by array syntax
  result = result.replace(/\$ARGUMENTS\[(\d+)\]/g, (_, idx: string) => {
    return context.positionalArgs[Number(idx)] ?? "";
  });

  // $0, $1, $2 ... — positional args
  result = result.replace(/\$(\d+)/g, (_, idx: string) => {
    return context.positionalArgs[Number(idx)] ?? "";
  });

  // ${DBCODE_SESSION_ID}
  result = result.replace(/\$\{DBCODE_SESSION_ID\}/g, context.sessionId ?? "");

  // ${DBCODE_SKILL_DIR}
  result = result.replace(/\$\{DBCODE_SKILL_DIR\}/g, context.skillDir ?? "");

  // ${DBCODE_PROJECT_DIR}
  result = result.replace(/\$\{DBCODE_PROJECT_DIR\}/g, context.projectDir ?? "");

  return result;
}

/**
 * Execute a shell command and return its stdout.
 * Used for dynamic context injection (`!command` syntax in skill bodies).
 */
async function executeShellCommand(command: string, cwd: string): Promise<string> {
  return new Promise<string>((resolve) => {
    exec(command, { timeout: COMMAND_TIMEOUT_MS, cwd }, (error, stdout, stderr) => {
      if (error) {
        resolve(`[Command failed: ${stderr.trim() || error.message}]`);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Resolve dynamic context injection (`!command` backtick syntax).
 * Matches: `!command args` and replaces with command output.
 */
async function resolveDynamicContext(body: string, cwd: string): Promise<string> {
  const pattern = /`!([^`]+)`/g;
  const matches = [...body.matchAll(pattern)];

  if (matches.length === 0) return body;

  let result = body;
  // Execute commands sequentially (they may depend on order)
  for (const match of matches) {
    const command = match[1];
    const output = await executeShellCommand(command, cwd);
    result = result.replace(match[0], output);
  }

  return result;
}

/**
 * Execute a skill: interpolate variables, resolve dynamic context,
 * and produce a ready-to-send prompt.
 */
export async function executeSkill(
  skill: SkillDefinition,
  context: SkillContext,
): Promise<SkillExecutionResult> {
  const { frontmatter, body } = skill;

  if (!body) {
    throw new SkillExecutionError("Skill has no body content", {
      skill: frontmatter.name,
    });
  }

  // Step 1: Interpolate variables
  const interpolated = interpolateVariables(body, context);

  // Step 2: Resolve dynamic context injection
  const resolved = await resolveDynamicContext(interpolated, context.workingDirectory);

  return {
    prompt: resolved,
    model: frontmatter.model ?? undefined,
    fork: frontmatter.context === "fork",
    agentType: frontmatter.agent,
    allowedTools: frontmatter.allowedTools,
  };
}
