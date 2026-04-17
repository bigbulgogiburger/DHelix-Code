/**
 * /skill-improve — refine an existing dhelix skill from feedback + grader output
 *
 * Wraps `improveSkill` from src/skills/creator/improve/improve.ts. Resolves the
 * target `<workingDirectory>/.dhelix/skills/<name>/`, computes the baseline
 * iteration (default = latest, overridden by `--from-iteration N`), and emits a
 * human-readable summary pointing at the candidate file + next step.
 *
 * DI-friendly factory `createSkillImproveCommand` lets tests inject a stub
 * `improveSkill` and workspace probe; `skillImproveCommand` is the default
 * instance registered in `builtin-commands.ts`.
 */

import * as defaultFs from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME } from "../constants.js";
import {
  type CommandContext,
  type CommandResult,
  type SlashCommand,
} from "./registry.js";
import {
  ImproveError,
  createProductionImproveDeps,
  improveSkill as defaultImproveSkill,
  type ImproveDeps,
  type ImproveResult,
} from "../skills/creator/improve/improve.js";
import { nextIterationNumber as defaultNextIterationNumber } from "../skills/creator/evals/workspace.js";

/** kebab-case skill name — must start with a letter. */
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]*$/;

/** Parsed form of `args`. */
interface ParsedArgs {
  readonly name: string | undefined;
  readonly fromIteration: number | undefined;
  readonly parseError: string | undefined;
}

function parseArgs(raw: string): ParsedArgs {
  const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);
  let name: string | undefined;
  let fromIteration: number | undefined;
  let parseError: string | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;

    if (token === "--from-iteration") {
      const next = tokens[i + 1];
      if (!next) {
        parseError = "--from-iteration requires a non-negative integer argument.";
        break;
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        parseError = `--from-iteration value '${next}' is not a non-negative integer.`;
        break;
      }
      fromIteration = parsed;
      i += 1;
      continue;
    }

    if (token.startsWith("--")) {
      parseError = `Unknown flag: ${token}`;
      break;
    }

    if (name === undefined) {
      name = token;
    }
  }

  return { name, fromIteration, parseError };
}

/** Injection point for tests. */
export interface SkillImproveDepsBundle {
  readonly improveSkill: typeof defaultImproveSkill;
  readonly createProductionDeps: () => ImproveDeps;
  readonly nextIterationNumber: typeof defaultNextIterationNumber;
  readonly fs: {
    readonly access: (path: string) => Promise<void>;
  };
}

const productionBundle: SkillImproveDepsBundle = {
  improveSkill: defaultImproveSkill,
  createProductionDeps: () => createProductionImproveDeps(),
  nextIterationNumber: defaultNextIterationNumber,
  fs: {
    access: (path) => defaultFs.access(path),
  },
};

/**
 * Create a /skill-improve command with DI overrides. Defaults bind real modules.
 */
export function createSkillImproveCommand(
  overrides: Partial<SkillImproveDepsBundle> = {},
): SlashCommand {
  const deps: SkillImproveDepsBundle = { ...productionBundle, ...overrides };

  return {
    name: "skill-improve",
    description:
      "Improve an existing dhelix skill using feedback.json and latest grader output. Use when the user says 'improve skill X', '스킬 개선', 'refine my skill', 'rewrite description', 'make skill better'.",
    usage: "/skill-improve <skill-name> [--from-iteration N]",
    execute: async (args: string, ctx: CommandContext): Promise<CommandResult> => {
      try {
        const parsed = parseArgs(args);
        if (parsed.parseError) {
          return { output: parsed.parseError, success: false };
        }
        if (!parsed.name || parsed.name.length === 0) {
          return {
            output:
              "skill name is required. Usage: /skill-improve <skill-name> [--from-iteration N]",
            success: false,
          };
        }
        if (!KEBAB_CASE_REGEX.test(parsed.name)) {
          return {
            output: `INVALID_NAME: '${parsed.name}' is not a valid kebab-case skill name. Use lowercase letters, digits, and hyphens (must start with a letter).`,
            success: false,
          };
        }

        const skillDir = join(
          ctx.workingDirectory,
          `.${APP_NAME}`,
          "skills",
          parsed.name,
        );

        try {
          await deps.fs.access(skillDir);
        } catch {
          return {
            output: `skill directory not found at ${skillDir}. Run /create-skill ${parsed.name} --intent "..." first, or check the skill name.`,
            success: false,
          };
        }

        // Resolve baseline iteration: explicit flag, else latest existing.
        let baselineIteration: number;
        if (parsed.fromIteration !== undefined) {
          baselineIteration = parsed.fromIteration;
        } else {
          const next = await deps.nextIterationNumber(skillDir);
          // next is the number of the NEXT iteration to create. The latest
          // existing one (if any) is next-1. When the workspace is empty we
          // treat iteration 0 as the baseline.
          baselineIteration = next > 0 ? next - 1 : 0;
        }

        const improveDeps = deps.createProductionDeps();
        const signal = (ctx as { readonly abortSignal?: AbortSignal }).abortSignal;
        const result: ImproveResult = await deps.improveSkill(
          {
            skillDir,
            skillName: parsed.name,
            baselineIteration,
          },
          improveDeps,
          signal ? { signal } : {},
        );

        const lines: string[] = [];
        lines.push(
          `skill '${parsed.name}' improved: iteration ${String(result.previousIteration)} → ${String(result.newIteration)}`,
        );
        lines.push("");
        lines.push(`candidate: ${result.newSkillMdPath}`);
        lines.push(`history: version ${String(result.historyEntry.version)} (hash ${result.historyEntry.skill_md_hash})`);
        lines.push("");
        lines.push("diff summary:");
        for (const ln of result.diffSummary.split("\n")) lines.push(`  ${ln}`);
        lines.push("");
        lines.push(
          `Next: review ${result.newSkillMdPath}, copy over SKILL.md if satisfied, then run /skill-eval ${parsed.name} to benchmark the new iteration.`,
        );

        return { output: lines.join("\n"), success: true };
      } catch (err) {
        if (err instanceof ImproveError) {
          return {
            output: `${err.code}: ${err.message}`,
            success: false,
          };
        }
        const msg = err instanceof Error ? err.message : String(err);
        return {
          output: `/skill-improve failed: ${msg}`,
          success: false,
        };
      }
    },
  };
}

/** Default registered instance for builtin-commands.ts. */
export const skillImproveCommand: SlashCommand = createSkillImproveCommand();
