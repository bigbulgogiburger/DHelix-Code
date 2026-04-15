#!/usr/bin/env node
/**
 * grade-session.ts — Evaluate an eval's assertions against a completed session.
 *
 * Inputs:
 *   - session-log.json     (written by the harness in test-projects/<dir>/)
 *   - evals.json entry     (matched by eval id)
 *
 * Output: grading.json alongside session-log.json, shaped like
 *   { eval_id, passed, results: [{ name, type, passed, evidence }] }
 *
 * Usage:
 *   npx tsx .claude/skills/dhelix-e2e-test/scripts/grade-session.ts \
 *     --session <projectDir>/session-log.json \
 *     --evals   .claude/skills/dhelix-e2e-test/evals/evals.json \
 *     --id      4
 *
 * Exits 0 when every assertion in the eval passes, 1 otherwise.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseCoverage, runBuild } from "./validate-session.js";

interface SessionTurn {
  readonly turn: number;
  readonly name: string;
  readonly userMessage: string;
  readonly lastContent: string;
  readonly iterations: number;
  readonly durationMs: number;
}

interface ToolCall {
  readonly turn: number;
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly tMs: number;
}

interface SessionLog {
  readonly stack: string;
  readonly projectDir: string;
  readonly model: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly totalDurationMs: number;
  readonly metrics: {
    readonly totalIterations: number;
    readonly turnsCompleted: number;
    readonly dhelixReads: readonly string[];
    readonly toolCalls: readonly ToolCall[];
    readonly turns: readonly SessionTurn[];
    readonly errors: readonly string[];
  };
}

interface Assertion {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  /** Optional hints consumed by specific assertion types (path, needle, cmd, …) */
  readonly path?: string;
  readonly needle?: string;
  readonly turn?: number;
  readonly cmd?: string;
  readonly min?: number;
  readonly max?: number;
}

interface EvalEntry {
  readonly id: number;
  readonly mode: string;
  readonly scenario?: string;
  readonly prompt: string;
  readonly assertions: readonly Assertion[];
}

interface Result {
  readonly text: string;
  readonly type: string;
  readonly passed: boolean;
  readonly evidence: string;
}

const projectDir = (log: SessionLog): string => log.projectDir;

function responsesJoined(log: SessionLog, turn?: number): string {
  const turns = turn ? log.metrics.turns.filter((t) => t.turn === turn) : log.metrics.turns;
  return turns.map((t) => t.lastContent).join("\n---\n");
}

function fileRead(log: SessionLog, relPath: string): string | null {
  const full = join(projectDir(log), relPath);
  return existsSync(full) ? readFileSync(full, "utf-8") : null;
}

function evaluate(a: Assertion, log: SessionLog): Result {
  const cwd = projectDir(log);
  switch (a.type) {
    case "file_exists": {
      const path = a.path ?? inferPathFromName(a.name);
      const ok = path ? existsSync(join(cwd, path)) : false;
      return r(a, ok, path ? `path=${path}` : "no path hint");
    }
    case "file_contains": {
      const path = a.path ?? inferPathFromName(a.name);
      const needle = a.needle ?? a.description;
      if (!path) return r(a, false, "missing path hint");
      const contents = fileRead(log, path);
      if (contents === null) return r(a, false, `missing file ${path}`);
      const ok = contents.includes(needle);
      return r(a, ok, ok ? `found in ${path}` : `"${needle}" not in ${path}`);
    }
    case "pattern_absence":
    case "pattern_present": {
      const path = a.path;
      const needle = a.needle ?? a.description;
      const want = a.type === "pattern_present";
      if (!path) {
        // Scan all turn responses when no file given
        const hay = responsesJoined(log);
        const found = hay.includes(needle);
        return r(a, found === want, `needle=${needle} found=${found}`);
      }
      const contents = fileRead(log, path);
      if (contents === null) return r(a, !want, `missing ${path}`);
      const found = new RegExp(needle).test(contents);
      return r(a, found === want, `found=${found} in ${path}`);
    }
    case "response_contains":
    case "response_absence": {
      const want = a.type === "response_contains";
      const hay = responsesJoined(log, a.turn);
      const needle = a.needle ?? a.description;
      const found = hay.includes(needle);
      return r(a, found === want, `turn=${a.turn ?? "*"} found=${found}`);
    }
    case "tool_present": {
      const ok = log.metrics.toolCalls.some((c) => c.tool === (a.needle ?? a.name));
      return r(a, ok, `tool=${a.needle ?? a.name}`);
    }
    case "tool_sequence": {
      // Heuristic: every file_edit on path X should be preceded by a file_read of X
      const reads = new Set<string>();
      let ok = true;
      for (const c of log.metrics.toolCalls) {
        const p = String(c.args?.file_path ?? c.args?.path ?? "");
        if (c.tool === "file_read" && p) reads.add(p);
        if (c.tool === "file_edit" && p && !reads.has(p)) {
          ok = false;
          break;
        }
      }
      return r(a, ok, ok ? "read-before-edit holds" : "edit without prior read");
    }
    case "no_redundant_tools": {
      let redundant = 0;
      const seen = new Map<string, number>();
      for (const c of log.metrics.toolCalls) {
        const key = `${c.tool}:${JSON.stringify(c.args)}`;
        const prev = seen.get(key);
        if (prev !== undefined && c.tMs - prev < 5_000) redundant++;
        seen.set(key, c.tMs);
      }
      return r(a, redundant === 0, `redundant=${redundant}`);
    }
    case "file_consistency": {
      // Cross-file check: every "key: value" in file A must match file B
      const [aPath, bPath] = (a.path ?? "").split(",");
      if (!aPath || !bPath) return r(a, false, "expected path='a,b'");
      const A = fileRead(log, aPath);
      const B = fileRead(log, bPath);
      if (!A || !B) return r(a, false, "missing file");
      const kvs = [...A.matchAll(/"([a-zA-Z_][\w]*)"\s*:\s*"?([^,"\n}]+)"?/g)];
      let mismatched = 0;
      for (const [, k, v] of kvs) {
        if (!B.includes(String(v).trim())) mismatched++;
      }
      return r(a, mismatched === 0, `mismatched=${mismatched}`);
    }
    case "command_exit_code": {
      if (!a.cmd) return r(a, false, "no cmd given (hint in assertion.cmd)");
      const res = runBuild(a.cmd, cwd);
      return r(a, res.success, `exit=${res.success ? 0 : 1} duration=${res.durationMs}ms`);
    }
    case "numeric_threshold": {
      // Supports coverage or iteration-bound interpretations
      if (a.name.toLowerCase().includes("coverage")) {
        const pct = parseCoverage(cwd);
        const min = a.min ?? 80;
        const ok = pct !== null && pct >= min;
        return r(a, ok, `coverage=${pct ?? "null"} min=${min}`);
      }
      if (a.name.toLowerCase().includes("iteration") || a.name.toLowerCase().includes("bounded")) {
        const max = a.max ?? 50;
        const worst = Math.max(0, ...log.metrics.turns.map((t) => t.iterations));
        return r(a, worst <= max, `worstTurn=${worst} max=${max}`);
      }
      if (a.name.toLowerCase().includes("dhelix_read")) {
        const min = a.min ?? 2;
        const n = log.metrics.dhelixReads.length;
        return r(a, n >= min, `dhelixReads=${n} min=${min}`);
      }
      return r(a, false, "unknown numeric_threshold target");
    }
    case "boolean": {
      if (a.name === "all_turns_complete") {
        const ok = log.metrics.errors.length === 0;
        return r(a, ok, `errors=${log.metrics.errors.length}`);
      }
      return r(a, false, "unknown boolean target");
    }
    default:
      return r(a, false, `unsupported type ${a.type}`);
  }
}

function inferPathFromName(name: string): string | undefined {
  if (name.includes("dhelix_md")) return "DHELIX.md";
  if (name.includes("readme")) return "README.md";
  if (name.includes("config")) return "config.json";
  return undefined;
}

function r(a: Assertion, passed: boolean, evidence: string): Result {
  return { text: a.description, type: a.type, passed, evidence };
}

function parseArgs(argv: readonly string[]): { session: string; evals: string; id: number } {
  let session = "", evalsPath = "", id = 0;
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const v = argv[i + 1];
    if (f === "--session") session = v;
    else if (f === "--evals") evalsPath = v;
    else if (f === "--id") id = Number.parseInt(v, 10);
    else continue;
    i++;
  }
  if (!session || !evalsPath || !id) {
    console.error("usage: grade-session.ts --session path --evals path --id N");
    process.exit(2);
  }
  return { session, evals: evalsPath, id };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const log = JSON.parse(readFileSync(args.session, "utf-8")) as SessionLog;
  const evals = JSON.parse(readFileSync(args.evals, "utf-8")) as { evals: EvalEntry[] };
  const entry = evals.evals.find((e) => e.id === args.id);
  if (!entry) {
    console.error(`eval id ${args.id} not found in ${args.evals}`);
    process.exit(2);
  }

  const results = entry.assertions.map((a) => evaluate(a, log));
  const passed = results.every((r) => r.passed);

  const outPath = resolve(dirname(args.session), "grading.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        eval_id: entry.id,
        mode: entry.mode,
        scenario: entry.scenario,
        stack: log.stack,
        model: log.model,
        totalDurationMs: log.totalDurationMs,
        turnsCompleted: log.metrics.turnsCompleted,
        totalIterations: log.metrics.totalIterations,
        dhelixReads: log.metrics.dhelixReads.length,
        passed,
        results,
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify({ eval_id: entry.id, passed, outPath, results }, null, 2));
  process.exit(passed ? 0 : 1);
}

// silence unused-import complaint in environments that strip the reference
void execSync;

const invoked = process.argv[1] && process.argv[1].endsWith("grade-session.ts");
if (invoked) main();
