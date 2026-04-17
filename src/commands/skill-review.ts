/**
 * /skill-review — generate a standalone HTML review report for a dhelix skill.
 *
 * Behaviour:
 *   1. Parse `<skill-name>` + optional `--iteration N`, `--compare M`, `--static path`.
 *   2. Resolve skill dir under `<workingDirectory>/.<APP_NAME>/skills/<name>`.
 *   3. Load SKILL.md body, benchmark.json, history.json (each optional → null).
 *   4. If `--compare M` present, run `compareIterations(A=N, B=M)`.
 *   5. Render the report via `renderHtmlReport` and write it.
 *   6. Return a human-readable summary + absolute output path.
 *
 * All I/O is routed through injectable deps (`SkillReviewDeps`) so unit tests
 * can run without touching the real filesystem or LLM.
 *
 * @see src/skills/creator/compare/comparator.ts
 * @see src/skills/creator/compare/html-report.ts
 * @see src/commands/skill-eval.ts — conventions mirror this command.
 */

import * as defaultFs from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { APP_NAME } from "../constants.js";
import { type CommandContext, type CommandResult, type SlashCommand } from "./registry.js";
import {
  benchmarkSchema,
  historySchema,
  type Benchmark,
  type History,
} from "../skills/creator/evals/types.js";
import { getIterationDir, nextIterationNumber } from "../skills/creator/evals/workspace.js";
import {
  type Comparison,
  type ComparatorDeps,
  compareIterations,
  createProductionComparatorDeps,
} from "../skills/creator/compare/comparator.js";
import {
  renderHtmlReport,
  writeHtmlReport,
  type ReportInput,
} from "../skills/creator/compare/html-report.js";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

/** Injectable dependency surface — overridable per-test via factory. */
export interface SkillReviewDeps {
  readonly fs: typeof defaultFs;
  readonly nextIterationNumber: (skillDir: string) => Promise<number>;
  readonly compareIterations: typeof compareIterations;
  readonly createComparatorDeps: () => ComparatorDeps;
  readonly renderHtmlReport: (input: ReportInput) => string;
  readonly writeHtmlReport: (
    outputPath: string,
    input: ReportInput,
    fs?: typeof defaultFs,
  ) => Promise<string>;
  readonly now: () => Date;
}

const productionDeps: SkillReviewDeps = {
  fs: defaultFs,
  nextIterationNumber: (skillDir) => nextIterationNumber(skillDir),
  compareIterations,
  createComparatorDeps: () => createProductionComparatorDeps(),
  renderHtmlReport,
  writeHtmlReport,
  now: () => new Date(),
};

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]*$/;

interface ParsedArgs {
  readonly name: string | undefined;
  readonly iteration: number | undefined;
  readonly compare: number | undefined;
  readonly staticPath: string | undefined;
  readonly parseError: string | undefined;
}

function parseArgs(raw: string): ParsedArgs {
  const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);
  let name: string | undefined;
  let iteration: number | undefined;
  let compare: number | undefined;
  let staticPath: string | undefined;
  let parseError: string | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t) continue;
    if (t === "--iteration" || t === "--compare" || t === "--static") {
      const next = tokens[i + 1];
      if (!next) {
        parseError = `${t} requires a value.`;
        break;
      }
      if (t === "--iteration") {
        const n = Number.parseInt(next, 10);
        if (!Number.isFinite(n) || n < 0) {
          parseError = `--iteration value '${next}' must be a non-negative integer.`;
          break;
        }
        iteration = n;
      } else if (t === "--compare") {
        const n = Number.parseInt(next, 10);
        if (!Number.isFinite(n) || n < 0) {
          parseError = `--compare value '${next}' must be a non-negative integer.`;
          break;
        }
        compare = n;
      } else {
        staticPath = next;
      }
      i += 1;
      continue;
    }
    if (t.startsWith("--")) {
      parseError = `Unknown flag: ${t}`;
      break;
    }
    if (name === undefined) name = t;
  }

  return { name, iteration, compare, staticPath, parseError };
}

// ---------------------------------------------------------------------------
// File loaders (use deps.fs only)
// ---------------------------------------------------------------------------

async function readOptionalJson<T>(
  fs: typeof defaultFs,
  path: string,
  parse: (raw: unknown) => T,
): Promise<T | null> {
  try {
    const raw = await fs.readFile(path, "utf8");
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function readOptionalText(
  fs: typeof defaultFs,
  path: string,
): Promise<string | null> {
  try {
    return await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

/** Factory — mirrors createSkillEvalCommand. Tests inject overrides here. */
export function createSkillReviewCommand(
  overrides: Partial<SkillReviewDeps> = {},
): SlashCommand {
  const deps: SkillReviewDeps = { ...productionDeps, ...overrides };

  return {
    name: "skill-review",
    description:
      "Generate a standalone HTML review report for a dhelix skill's latest (or selected) iteration — pass-rate, benchmark, history, comparison, SKILL.md. Use when the user says 'review my skill', '스킬 리뷰', 'show skill report', 'compare iterations'.",
    usage: "/skill-review <skill-name> [--iteration N] [--compare M] [--static path]",
    execute: async (args: string, ctx: CommandContext): Promise<CommandResult> => {
      try {
        const parsed = parseArgs(args);
        if (parsed.parseError) {
          return { output: parsed.parseError, success: false };
        }
        if (!parsed.name) {
          return {
            output:
              "skill name is required. Usage: /skill-review <skill-name> [--iteration N] [--compare M] [--static path]",
            success: false,
          };
        }
        if (!KEBAB_CASE_REGEX.test(parsed.name)) {
          return {
            output: `INVALID_NAME: '${parsed.name}' is not a valid kebab-case skill name.`,
            success: false,
          };
        }

        const skillDir = join(
          ctx.workingDirectory,
          `.${APP_NAME}`,
          "skills",
          parsed.name,
        );

        // Confirm skill dir exists — friendlier error than cascade of nulls.
        try {
          await deps.fs.stat(skillDir);
        } catch {
          return {
            output: `skill directory not found: ${skillDir}. Hint: run /create-skill ${parsed.name} first, or verify the name.`,
            success: false,
          };
        }

        // Resolve iteration — default to latest (nextIteration - 1; clamp at 0).
        let iteration = parsed.iteration;
        if (iteration === undefined) {
          const next = await deps.nextIterationNumber(skillDir);
          iteration = next > 0 ? next - 1 : 0;
        }

        // Load optional artefacts.
        const iterDir = getIterationDir(skillDir, iteration);
        const benchmarkPath = join(iterDir, "benchmark.json");
        const historyPath = join(skillDir, "workspace", "history.json");
        const skillMdPath = join(skillDir, "SKILL.md");

        const benchmark: Benchmark | null = await readOptionalJson(
          deps.fs,
          benchmarkPath,
          (raw) => benchmarkSchema.parse(raw),
        );
        const history: History | null = await readOptionalJson(
          deps.fs,
          historyPath,
          (raw) => historySchema.parse(raw),
        );
        const skillMd: string | null = await readOptionalText(deps.fs, skillMdPath);

        // Optional blind comparison.
        let comparison: Comparison | null = null;
        if (parsed.compare !== undefined) {
          const cmpDeps = deps.createComparatorDeps();
          comparison = await deps.compareIterations(
            {
              skillDir,
              skillName: parsed.name,
              iterationA: iteration,
              iterationB: parsed.compare,
            },
            cmpDeps,
            { fs: deps.fs },
          );
        }

        // Resolve output path.
        const outPath = parsed.staticPath
          ? isAbsolute(parsed.staticPath)
            ? parsed.staticPath
            : resolve(ctx.workingDirectory, parsed.staticPath)
          : join(iterDir, "report.html");

        const input: ReportInput = {
          skillName: parsed.name,
          iteration,
          benchmark,
          history,
          comparison,
          skillMd,
          generatedAt: deps.now().toISOString(),
        };

        const written = await deps.writeHtmlReport(outPath, input, deps.fs);

        const lines: string[] = [];
        lines.push(
          `skill '${parsed.name}' — iteration ${String(iteration)} — report written.`,
        );
        lines.push(`  path: ${written}`);
        if (benchmark?.configs["with_skill"]) {
          lines.push(
            `  with_skill pass_rate: ${(benchmark.configs["with_skill"].summary.pass_rate.mean * 100).toFixed(1)}%`,
          );
        }
        if (comparison) {
          lines.push(
            `  comparison: A=${String(comparison.a_wins)} B=${String(comparison.b_wins)} ties=${String(comparison.ties)} (it.${String(comparison.iteration_a)} vs it.${String(comparison.iteration_b)})`,
          );
        }

        return { output: lines.join("\n"), success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { output: `/skill-review failed: ${msg}`, success: false };
      }
    },
  };
}

/** Default instance registered by builtin-commands.ts. */
export const skillReviewCommand: SlashCommand = createSkillReviewCommand();
