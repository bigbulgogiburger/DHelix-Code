/**
 * `/recombination` (default + `--mode extend` + `--dry-run`) handler.
 *
 * Phase 2 supports:
 *   /recombination                          → extend with defaults
 *   /recombination --dry-run                → dry-run preview
 *   /recombination --mode <extend|dry-run>  → explicit mode
 *   /recombination --plasmid <id>           → restrict to one plasmid
 *   /recombination --model <name>           → override model for this run
 *   /recombination --validate=<profile>     → recorded in transcript only
 *
 * `rebuild` mode is deferred — returns a graceful "not yet implemented"
 * error (P-1.7 error catalog entry `RECOMBINATION_PLAN_ERROR`).
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type { CommandDeps } from "./deps.js";
import type {
  RecombinationMode,
  RecombinationOptions,
  RecombinationResult,
  StaticValidationMode,
} from "../../recombination/types.js";
import { RecombinationError } from "../../recombination/errors.js";
import type { PlasmidId } from "../../plasmids/types.js";

type ValidateProfile = "smoke" | "local" | "exhaustive" | "none" | "ci";

const VALIDATE_PROFILES: readonly ValidateProfile[] = [
  "smoke",
  "local",
  "exhaustive",
  "none",
  "ci",
];

interface ParsedArgs {
  readonly mode: RecombinationMode;
  readonly plasmidId?: PlasmidId;
  readonly modelOverride?: string;
  readonly validate?: ValidateProfile;
  readonly staticValidation: StaticValidationMode;
}

type ParseResult = { readonly args: ParsedArgs } | { readonly error: string };

export async function runRecombination(
  argv: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    return { output: parsed.error, success: false };
  }
  const { args } = parsed;

  if (args.mode === "rebuild") {
    return {
      output:
        "/recombination --mode rebuild is a Phase-4 feature and is not yet implemented.\n" +
        "Use --mode extend (default) or --mode dry-run for Phase-2 builds.",
      success: false,
    };
  }

  const opts: RecombinationOptions = {
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    mode: args.mode,
    staticValidation: args.staticValidation,
    approvalMode: "auto",
    ...(args.plasmidId !== undefined ? { plasmidId: args.plasmidId } : {}),
    ...(args.modelOverride !== undefined ? { modelOverride: args.modelOverride } : {}),
  };

  try {
    const result = await deps.execute(opts, {
      interpret: deps.interpret,
      generate: deps.generate,
      compress: deps.compress,
      reorganize: deps.reorganize,
      llm: deps.llm,
    });
    return {
      output: renderReport(result, args),
      success: result.applied || args.mode === "dry-run",
    };
  } catch (err) {
    const code =
      err instanceof RecombinationError ? err.code : "RECOMBINATION_PLAN_ERROR";
    const msg = err instanceof Error ? err.message : String(err);
    return {
      output: `/recombination failed (${code}): ${msg}`,
      success: false,
    };
  }
}

function parseArgs(argv: readonly string[]): ParseResult {
  let mode: RecombinationMode = "extend";
  let plasmidId: PlasmidId | undefined;
  let modelOverride: string | undefined;
  let validate: ValidateProfile | undefined;
  let staticValidation: StaticValidationMode = "strict";

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;

    if (token === "--dry-run") {
      mode = "dry-run";
      continue;
    }
    if (token === "--mode") {
      const value = argv[++i];
      if (value === undefined) return { error: "--mode requires a value (extend|rebuild|dry-run)" };
      if (value !== "extend" && value !== "rebuild" && value !== "dry-run") {
        return { error: `Unknown --mode '${value}'. Expected extend|rebuild|dry-run.` };
      }
      mode = value;
      continue;
    }
    const modeEq = matchFlagValue(token, "--mode=");
    if (modeEq !== undefined) {
      if (modeEq !== "extend" && modeEq !== "rebuild" && modeEq !== "dry-run") {
        return { error: `Unknown --mode '${modeEq}'. Expected extend|rebuild|dry-run.` };
      }
      mode = modeEq;
      continue;
    }

    if (token === "--plasmid") {
      const value = argv[++i];
      if (value === undefined) return { error: "--plasmid requires an id" };
      plasmidId = value as PlasmidId;
      continue;
    }
    const plasmidEq = matchFlagValue(token, "--plasmid=");
    if (plasmidEq !== undefined) {
      plasmidId = plasmidEq as PlasmidId;
      continue;
    }

    if (token === "--model") {
      const value = argv[++i];
      if (value === undefined) return { error: "--model requires a value" };
      modelOverride = value;
      continue;
    }
    const modelEq = matchFlagValue(token, "--model=");
    if (modelEq !== undefined) {
      modelOverride = modelEq;
      continue;
    }

    const validateEq = matchFlagValue(token, "--validate=");
    if (validateEq !== undefined) {
      if (!(VALIDATE_PROFILES as readonly string[]).includes(validateEq)) {
        return {
          error: `Unknown --validate profile '${validateEq}'. Expected one of: ${VALIDATE_PROFILES.join(", ")}.`,
        };
      }
      validate = validateEq as ValidateProfile;
      continue;
    }

    const staticEq = matchFlagValue(token, "--static-validation=");
    if (staticEq !== undefined) {
      if (staticEq !== "strict" && staticEq !== "warn-only" && staticEq !== "skip") {
        return {
          error: `Unknown --static-validation '${staticEq}'. Expected strict|warn-only|skip.`,
        };
      }
      staticValidation = staticEq;
      continue;
    }

    return { error: `Unknown flag: '${token}'.\n${usage()}` };
  }

  return {
    args: {
      mode,
      staticValidation,
      ...(plasmidId !== undefined ? { plasmidId } : {}),
      ...(modelOverride !== undefined ? { modelOverride } : {}),
      ...(validate !== undefined ? { validate } : {}),
    },
  };
}

function matchFlagValue(token: string, prefix: string): string | undefined {
  if (!token.startsWith(prefix)) return undefined;
  return token.slice(prefix.length);
}

function usage(): string {
  return [
    "Usage: /recombination [--mode <extend|rebuild|dry-run>] [options]",
    "",
    "Options:",
    "  --dry-run                 Plan only; nothing written to disk.",
    "  --plasmid <id>            Restrict compilation to one plasmid.",
    "  --model <name>            Override the LLM model for this run.",
    "  --validate=<profile>      smoke|local|exhaustive|none|ci (Phase-2: recorded only).",
    "  --static-validation=<m>   strict (default) | warn-only | skip.",
  ].join("\n");
}

/**
 * Render a concise report that mimics PRD §6.3.3. Includes stage timings
 * and a wiring summary; full details live in the transcript JSON.
 */
function renderReport(result: RecombinationResult, args: ParsedArgs): string {
  const lines: string[] = [];
  lines.push(
    `/recombination ${args.mode === "dry-run" ? "(dry-run)" : "(extend)"} — ` +
      `${result.applied ? "applied" : "not applied"}`,
  );
  lines.push(`  id:    ${result.transcript.id}`);
  lines.push(`  model: ${result.transcript.model}`);
  lines.push(
    `  plasmids: ${result.transcript.activePlasmidIds.length} active ` +
      `(${result.transcript.activePlasmidIds.join(", ") || "—"})`,
  );
  lines.push("");
  lines.push("  Stages:");
  for (const stage of result.transcript.stages) {
    const dur = stage.durationMs !== undefined ? `${stage.durationMs}ms` : "—";
    const msg = stage.message !== undefined ? ` — ${stage.message}` : "";
    lines.push(
      `    [${stage.stage}] ${stage.name.padEnd(20)} ${stage.status.padEnd(8)} ${dur}${msg}`,
    );
  }
  lines.push("");
  lines.push(
    `  Artifacts: ${result.plan.artifacts.length} generated, ${result.transcript.writtenFiles.length} written.`,
  );
  lines.push(
    `  Wiring:    errors=${result.transcript.wiring.errorCount} ` +
      `warns=${result.transcript.wiring.warnCount} ` +
      `infos=${result.transcript.wiring.infoCount}`,
  );
  if (result.transcript.errorCode !== undefined) {
    lines.push("");
    lines.push(`  Error: ${result.transcript.errorCode}`);
    if (result.transcript.errorMessage !== undefined) {
      lines.push(`         ${result.transcript.errorMessage}`);
    }
  }
  if (args.validate !== undefined) {
    lines.push("");
    lines.push(`  (validate=${args.validate} — recorded in transcript, Phase-3)`);
  }
  return lines.join("\n");
}
