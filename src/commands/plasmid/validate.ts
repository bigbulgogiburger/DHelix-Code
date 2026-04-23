/**
 * `/plasmid validate [<id>]` — Phase 1 L1 static validation.
 *
 * Phase 1 scope: Zod schema (done by loader) + cross-reference checks
 * (extends/requires/conflicts point at known ids). L2/L4 adversarial
 * validation is Phase 2+.
 *
 * Reports `pass | warn | fail` with counts. A warning is recoverable
 * (missing optional metadata); a failure means the plasmid will not
 * compile.
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type { LoadResult } from "../../plasmids/types.js";
import type { CommandDeps } from "./deps.js";

type Verdict = "pass" | "warn" | "fail";

interface Finding {
  readonly id: string;
  readonly verdict: Verdict;
  readonly reasons: readonly string[];
}

export async function validateSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseArgs(args);
  if ("error" in parsed) return { output: parsed.error, success: false };

  const result = await deps.loadPlasmids({
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    sharedRegistryPath: deps.sharedRegistryPath,
    draftsPath: deps.draftsPath,
    scopes: deps.scopes,
  });

  const findings = parsed.id
    ? findingsForSingle(parsed.id, result)
    : findingsForAll(result);

  if (findings.length === 0) {
    return {
      output: parsed.id
        ? `Plasmid not found: ${parsed.id}`
        : "No plasmids loaded from the configured registry.",
      success: parsed.id === undefined,
    };
  }

  const counts = tallyVerdicts(findings);
  const lines: string[] = [];
  for (const f of findings) {
    const icon = f.verdict === "pass" ? "OK  " : f.verdict === "warn" ? "WARN" : "FAIL";
    lines.push(`[${icon}] ${f.id}`);
    for (const r of f.reasons) lines.push(`       - ${r}`);
  }
  lines.push("");
  lines.push(`Summary: pass=${counts.pass} warn=${counts.warn} fail=${counts.fail}`);

  const success = counts.fail === 0;
  return { output: lines.join("\n"), success };
}

// ──────────────────────────────────────────────────────────────────────────

interface ParsedArgs {
  readonly id?: string;
}

function parseArgs(args: readonly string[]): ParsedArgs | { error: string } {
  let id: string | undefined;
  for (const tok of args) {
    if (tok.startsWith("--")) {
      return { error: `Unknown flag: ${tok}. Usage: /plasmid validate [<id>]` };
    }
    if (id !== undefined) {
      return { error: "Only one plasmid id may be passed to /plasmid validate." };
    }
    id = tok;
  }
  return { id };
}

function findingsForSingle(id: string, result: LoadResult): readonly Finding[] {
  const hit = result.loaded.find((p) => p.metadata.id === id);
  if (hit) {
    return [crossRef(hit, result)];
  }
  const failed = result.failed.find((f) => f.path.includes(id));
  if (failed) {
    return [
      { id, verdict: "fail", reasons: [`${failed.code}: ${failed.reason}`] },
    ];
  }
  return [];
}

function findingsForAll(result: LoadResult): readonly Finding[] {
  const passes = result.loaded.map((p) => crossRef(p, result));
  const fails = result.failed.map<Finding>((f) => ({
    id: f.path,
    verdict: "fail",
    reasons: [`${f.code}: ${f.reason}`],
  }));
  return [...passes, ...fails];
}

function crossRef(
  p: LoadResult["loaded"][number],
  result: LoadResult,
): Finding {
  const known = new Set<string>(result.loaded.map((q) => q.metadata.id));
  const reasons: string[] = [];
  if (p.metadata.extends && !known.has(p.metadata.extends)) {
    reasons.push(`extends unknown plasmid '${p.metadata.extends}'`);
  }
  for (const req of p.metadata.requires ?? []) {
    if (!known.has(req)) reasons.push(`requires unknown plasmid '${req}'`);
  }
  for (const cnf of p.metadata.conflicts ?? []) {
    if (!known.has(cnf)) {
      reasons.push(`conflicts with unknown plasmid '${cnf}' (soft warning)`);
    }
  }
  if (p.evalCases.length === 0) {
    reasons.push("no eval cases defined — Phase 1 L1 validation only");
  }

  const hasErrors = reasons.some(
    (r) => r.startsWith("extends unknown") || r.startsWith("requires unknown"),
  );
  const verdict: Verdict = hasErrors ? "fail" : reasons.length > 0 ? "warn" : "pass";
  return { id: p.metadata.id, verdict, reasons };
}

function tallyVerdicts(
  findings: readonly Finding[],
): { readonly pass: number; readonly warn: number; readonly fail: number } {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const f of findings) {
    if (f.verdict === "pass") pass++;
    else if (f.verdict === "warn") warn++;
    else fail++;
  }
  return { pass, warn, fail };
}
