#!/usr/bin/env node
/**
 * validate-session.ts — Runtime validators for dhelix E2E sessions.
 *
 * Used by the test harness itself (inside it()/expect()) and by
 * grade-session.ts after the session completes. Keeps the heavy,
 * easily-reusable checks in one place rather than duplicating regex
 * and exec logic across every stack-specific test file.
 *
 * Usage as a CLI:
 *   npx tsx .claude/skills/dhelix-e2e-test/scripts/validate-session.ts \
 *     <projectDir> [--build "<cmd>"] [--coverage "<cmd>"] [--min 80]
 *
 * Exits 0 when every check passes, 1 otherwise. Prints one JSON line
 * describing the result so callers can parse without re-running.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface BuildResult {
  readonly success: boolean;
  readonly output: string;
  readonly durationMs: number;
}

export function runBuild(
  command: string,
  cwd: string,
  timeoutMs = 180_000,
): BuildResult {
  const started = Date.now();
  try {
    const output = execSync(command, {
      cwd,
      timeout: timeoutMs,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output, durationMs: Date.now() - started };
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string };
    return {
      success: false,
      output: `STDOUT:\n${e.stdout ?? ""}\n\nSTDERR:\n${e.stderr ?? ""}`,
      durationMs: Date.now() - started,
    };
  }
}

/**
 * Parses coverage percentage from common report formats.
 *
 * Tries (in order): istanbul coverage-summary.json, JaCoCo csv/html, vitest text,
 * LCOV. Falls back to regex scan as a last resort.
 */
export function parseCoverage(projectDir: string, rawOutput = ""): number | null {
  // 1. Istanbul JSON (vitest --coverage default)
  const summaryPaths = [
    join(projectDir, "coverage", "coverage-summary.json"),
    join(projectDir, "coverage", "coverage-final.json"),
  ];
  for (const p of summaryPaths) {
    if (!existsSync(p)) continue;
    try {
      const json = JSON.parse(readFileSync(p, "utf-8"));
      const total = json.total ?? json["total"];
      if (total?.statements?.pct !== undefined) return Number(total.statements.pct);
      if (total?.lines?.pct !== undefined) return Number(total.lines.pct);
    } catch {
      // fall through
    }
  }

  // 2. JaCoCo CSV
  const jacoco = join(projectDir, "build", "reports", "jacoco", "test", "jacocoTestReport.csv");
  if (existsSync(jacoco)) {
    try {
      const csv = readFileSync(jacoco, "utf-8");
      const rows = csv.trim().split("\n").slice(1);
      let missed = 0;
      let covered = 0;
      for (const row of rows) {
        const cols = row.split(",");
        missed += Number(cols[3] ?? 0);
        covered += Number(cols[4] ?? 0);
      }
      const total = missed + covered;
      if (total > 0) return (covered / total) * 100;
    } catch {
      // fall through
    }
  }

  // 3. Regex on raw stdout (vitest text reporter, JaCoCo console, lcov, flutter)
  const patterns: readonly RegExp[] = [
    /All files\s*\|\s*([\d.]+)/,
    /Total:\s*([\d.]+)%/,
    /Statements\s*:\s*([\d.]+)%/,
    /([\d.]+)%\s*coverage/i,
  ];
  for (const re of patterns) {
    const m = rawOutput.match(re);
    if (m) return Number.parseFloat(m[1]);
  }

  return null;
}

export interface FileCheck {
  readonly path: string;
  readonly mustExist?: boolean;
  readonly mustContain?: readonly string[];
  readonly mustNotContain?: readonly string[];
  readonly minBytes?: number;
}

export interface CheckOutcome {
  readonly path: string;
  readonly ok: boolean;
  readonly reason?: string;
}

export function checkFile(projectDir: string, check: FileCheck): CheckOutcome {
  const full = join(projectDir, check.path);
  if (check.mustExist !== false && !existsSync(full)) {
    return { path: check.path, ok: false, reason: "missing" };
  }
  if (!existsSync(full)) return { path: check.path, ok: true };

  if (check.minBytes !== undefined) {
    const size = statSync(full).size;
    if (size < check.minBytes) {
      return { path: check.path, ok: false, reason: `size ${size} < ${check.minBytes}` };
    }
  }

  let content: string | null = null;
  const readOnce = (): string => (content ??= readFileSync(full, "utf-8"));

  for (const needle of check.mustContain ?? []) {
    if (!readOnce().includes(needle)) {
      return { path: check.path, ok: false, reason: `missing "${needle}"` };
    }
  }
  for (const needle of check.mustNotContain ?? []) {
    if (readOnce().includes(needle)) {
      return { path: check.path, ok: false, reason: `unexpected "${needle}"` };
    }
  }

  return { path: check.path, ok: true };
}

// ---- CLI ----

function parseArgs(argv: readonly string[]): {
  projectDir: string;
  build?: string;
  coverage?: string;
  min: number;
} {
  const [projectDir, ...rest] = argv;
  if (!projectDir) {
    console.error("usage: validate-session.ts <projectDir> [--build cmd] [--coverage cmd] [--min 80]");
    process.exit(2);
  }
  const out = { projectDir, min: 80 } as ReturnType<typeof parseArgs>;
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (flag === "--build") (out as { build?: string }).build = value;
    else if (flag === "--coverage") (out as { coverage?: string }).coverage = value;
    else if (flag === "--min") out.min = Number.parseFloat(value);
    else continue;
    i++;
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const report: Record<string, unknown> = { projectDir: args.projectDir };
  let ok = true;

  if (args.build) {
    const r = runBuild(args.build, args.projectDir);
    report.build = { success: r.success, durationMs: r.durationMs };
    if (!r.success) {
      report.buildOutput = r.output.slice(-2000);
      ok = false;
    }
  }

  if (args.coverage) {
    const r = runBuild(args.coverage, args.projectDir);
    const pct = parseCoverage(args.projectDir, r.output);
    report.coverage = { success: r.success, percent: pct, durationMs: r.durationMs };
    if (!r.success || pct === null || pct < args.min) {
      report.coverageOutput = r.output.slice(-2000);
      ok = false;
    }
  }

  report.ok = ok;
  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

// ESM-safe entrypoint guard
const invoked = process.argv[1] && process.argv[1].endsWith("validate-session.ts");
if (invoked) main();
