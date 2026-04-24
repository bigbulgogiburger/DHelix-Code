/**
 * `/cure` handler — arg parse + dispatch to deps.executeCure.
 *
 * Team 4 — Phase 3. Pattern matches `/recombination`'s extend.ts.
 *
 * Phase-3 MVP UX: interactive approval prompt is deferred to Phase-4.
 * Users must pass `--yes` to execute; otherwise we run an implicit
 * `--dry-run` and print the plan with a hint.
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type {
  CureMode,
  CureOptions,
} from "../../recombination/types.js";
import type { PlasmidId } from "../../plasmids/types.js";

import type { CommandDeps } from "./deps.js";
import { renderCureReport } from "./render.js";

interface ParsedFlags {
  readonly all: boolean;
  readonly transcript?: string;
  readonly plasmid?: string;
  readonly dryRun: boolean;
  readonly purge: boolean;
  readonly yes: boolean;
}

type ParseResult = { readonly flags: ParsedFlags } | { readonly error: string };

function matchFlagValue(token: string, prefix: string): string | undefined {
  if (!token.startsWith(prefix)) return undefined;
  return token.slice(prefix.length);
}

function parseFlags(argv: readonly string[]): ParseResult {
  let all = false;
  let transcript: string | undefined;
  let plasmid: string | undefined;
  let dryRun = false;
  let purge = false;
  let yes = false;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;

    if (token === "--all") {
      all = true;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (token === "--purge") {
      purge = true;
      continue;
    }
    if (token === "--yes" || token === "-y") {
      yes = true;
      continue;
    }

    if (token === "--transcript") {
      const value = argv[++i];
      if (value === undefined) return { error: "--transcript requires an id" };
      transcript = value;
      continue;
    }
    const transcriptEq = matchFlagValue(token, "--transcript=");
    if (transcriptEq !== undefined) {
      if (transcriptEq === "") return { error: "--transcript requires an id" };
      transcript = transcriptEq;
      continue;
    }

    if (token === "--plasmid") {
      const value = argv[++i];
      if (value === undefined) return { error: "--plasmid requires an id" };
      plasmid = value;
      continue;
    }
    const plasmidEq = matchFlagValue(token, "--plasmid=");
    if (plasmidEq !== undefined) {
      if (plasmidEq === "") return { error: "--plasmid requires an id" };
      plasmid = plasmidEq;
      continue;
    }

    return { error: `Unknown flag: '${token}'.\n${usage()}` };
  }

  const selectorCount =
    (all ? 1 : 0) +
    (transcript !== undefined ? 1 : 0) +
    (plasmid !== undefined ? 1 : 0);
  if (selectorCount > 1) {
    return {
      error:
        "At most one of --all, --transcript, --plasmid may be specified. Default is `latest`.",
    };
  }

  return {
    flags: {
      all,
      dryRun,
      purge,
      yes,
      ...(transcript !== undefined ? { transcript } : {}),
      ...(plasmid !== undefined ? { plasmid } : {}),
    },
  };
}

function usage(): string {
  return [
    "Usage: /cure [--all | --transcript <id> | --plasmid <id>] [--dry-run] [--purge] [--yes]",
    "",
    "Options:",
    "  (no mode)                   Revert the latest recombination transcript (default).",
    "  --all                       Revert every transcript under .dhelix/recombination/transcripts/.",
    "  --transcript <id>           Revert a specific transcript by id.",
    "  --plasmid <id>              Revert the transcript referenced by this plasmid.",
    "  --dry-run                   Preview only — nothing is written to disk.",
    "  --purge                     Also archive plasmid directories (I-1 safe move).",
    "  --yes, -y                   Execute without confirmation (Phase-3 MVP requires this).",
  ].join("\n");
}

function buildMode(flags: ParsedFlags): CureMode {
  if (flags.all) return { kind: "all" };
  if (flags.transcript !== undefined) {
    return { kind: "transcript", id: flags.transcript };
  }
  if (flags.plasmid !== undefined) {
    return { kind: "plasmid", id: flags.plasmid as PlasmidId };
  }
  return { kind: "latest" };
}

export const runCure: (
  argv: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
) => Promise<CommandResult> = async (argv, context, deps) => {
  const parsed = parseFlags(argv);
  if ("error" in parsed) {
    return { output: parsed.error, success: false };
  }
  const { flags } = parsed;

  const opts: CureOptions = {
    workingDirectory: context.workingDirectory,
    mode: buildMode(flags),
    dryRun: flags.dryRun,
    purge: flags.purge,
    approvalMode: flags.yes ? "auto" : "interactive",
  };

  try {
    // Phase-3 MVP: require `--yes` for execution. Anything else → dry-run preview.
    if (!flags.yes && !flags.dryRun) {
      const previewResult = await deps.executeCure({
        ...opts,
        dryRun: true,
      });
      return {
        output:
          renderCureReport(previewResult) +
          "\n\nRun with --yes to execute. Nothing written to disk.",
        success: true,
      };
    }

    const result = await deps.executeCure(opts);
    return {
      output: renderCureReport(result),
      success: result.executed || flags.dryRun
        ? result.errorCode === undefined
        : false,
    };
  } catch (err) {
    const code =
      err instanceof Error && typeof (err as unknown as { code?: unknown }).code === "string"
        ? (err as unknown as { code: string }).code
        : "CURE_ABORTED";
    const msg = err instanceof Error ? err.message : String(err);
    return {
      output: `/cure failed (${code}): ${msg}`,
      success: false,
    };
  }
};
