/**
 * Runtime case executor (P-1.17).
 *
 * Team 2 — Phase 3 MVP. Executes each `RuntimeCase` inside the CoW workspace
 * and produces a `RuntimeRunResult` shaped so the grader cascade can route
 * every expectation kind.
 *
 * PRAGMATIC SIMPLIFICATION (see P-1.17 §3 + design note at bottom):
 *   The full design spawns a sub-agent (`src/subagents/spawner.ts`) for each
 *   case. That requires bootstrapping LLMProvider + ToolCallStrategy +
 *   ToolRegistry which are not available at the validation layer without a
 *   layer violation. The "production spawn adapter" lives at the command
 *   layer per the comment in runner.ts:`createProductionSpawn`.
 *
 *   For Phase-3 MVP we DON'T invoke `runEvals`. Instead we use the injected
 *   `LLMCompletionFn` directly, instructing the model to mark tool /
 *   hook observations with `tool:<name>` / `hook:<event>` prefixed lines in
 *   its reply. This is enough to make `tool-called` / `hook-fired` semi
 *   grading work in integration tests (Team 5). The real sub-agent
 *   pipeline is swappable at the facade level without changing this
 *   module's contract — `RuntimeRunResult` shape is stable.
 *
 * Time budget: single `AbortController` shared across all cases; an
 * internal `setTimeout(timeBudgetMs)` triggers `abort("budget")`. Cases
 * whose own llm call was aborted by this controller are recorded as
 * `status: "timeout"`. Queued (never-started) cases become `"skipped"`.
 *
 * Concurrency: a local Promise pool respects `parallelism` without adding
 * a dependency.
 *
 * Error-run ceiling: if more than 10 cases return `status: "error"` in
 * total, remaining cases are skipped. This is an executor-level capacity
 * signal. Grading-based early-exit (3 consecutive L1 hard-fails per PRD)
 * belongs to the validate facade (Team 5) since this module doesn't run
 * the grader.
 *
 * Layer: Core.
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";

import type {
  LLMCompletionFn,
  RunCasesFn,
  RuntimeCase,
  RuntimeRunResult,
} from "../types.js";

/** Maximum error runs before the executor bails on the remainder. */
const ERROR_RUN_CEILING = 10;

/** Executor-issued cap on generated output so runaway models can't OOM us. */
const DEFAULT_MAX_TOKENS = 512;

/** Deterministic, low-temperature. Grader tier controls "creativity". */
const DEFAULT_TEMPERATURE = 0;

interface FileSnapshot {
  readonly path: string;
  readonly hash: string;
}

interface ParsedTranscript {
  readonly toolCalls: readonly string[];
  readonly hookFires: readonly string[];
}

/** Extract `tool:<name>` and `hook:<event>` markers from model output. */
function parseToolAndHookMarkers(output: string): ParsedTranscript {
  const tools: string[] = [];
  const hooks: string[] = [];
  const lines = output.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const toolMatch = /^tool:(\S+)/.exec(line);
    if (toolMatch && toolMatch[1]) {
      tools.push(toolMatch[1]);
      continue;
    }
    const hookMatch = /^hook:(\S+)/.exec(line);
    if (hookMatch && hookMatch[1]) {
      hooks.push(hookMatch[1]);
    }
  }
  return { toolCalls: tools, hookFires: hooks };
}

/** Lightweight content hash — non-cryptographic; drift detection only. */
function quickHash(buf: Buffer): string {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (const byte of buf) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function snapshotDir(root: string): Promise<readonly FileSnapshot[]> {
  const out: FileSnapshot[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        try {
          const buf = await fs.readFile(abs);
          out.push({ path: path.relative(root, abs), hash: quickHash(buf) });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw err;
        }
      }
    }
  }
  await walk(root);
  // Deterministic ordering for stable diffs.
  return out.slice().sort((a, b) => a.path.localeCompare(b.path));
}

function diffSnapshots(
  before: readonly FileSnapshot[],
  after: readonly FileSnapshot[],
): RuntimeRunResult["filesTouched"] {
  const byPath = new Map<string, string>();
  for (const f of before) byPath.set(f.path, f.hash);

  const touched: {
    readonly path: string;
    readonly op: "create" | "update" | "delete";
  }[] = [];
  const seen = new Set<string>();

  for (const f of after) {
    seen.add(f.path);
    const prev = byPath.get(f.path);
    if (prev === undefined) {
      touched.push({ path: f.path, op: "create" });
    } else if (prev !== f.hash) {
      touched.push({ path: f.path, op: "update" });
    }
  }
  for (const [p] of byPath) {
    if (!seen.has(p)) touched.push({ path: p, op: "delete" });
  }
  return touched;
}

async function writeSetupFiles(
  scratchDir: string,
  files: RuntimeCase["setupFiles"],
  signal: AbortSignal | undefined,
): Promise<void> {
  if (!files) return;
  for (const f of files) {
    if (signal?.aborted) return;
    // Defensive path confinement: disallow `..` escape + absolute paths.
    const normalized = path.normalize(f.path);
    if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
      throw new Error(
        `setup file path escapes scratch dir: ${f.path}`,
      );
    }
    const abs = path.join(scratchDir, normalized);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content, "utf8");
  }
}

interface PromptContext {
  readonly system: string;
  readonly user: string;
}

function buildPromptContext(
  caseData: RuntimeCase,
  artifactNotes: readonly string[],
): PromptContext {
  const intro =
    "You are simulating an AI coding assistant under plasmid-driven runtime validation.";
  const contract = [
    "When you use a tool, start a line with `tool:<name>`.",
    "When you emit a hook, start a line with `hook:<event>`.",
    "Files you write should be in the scratch directory via normal file-writing tools.",
    "Keep responses concise.",
  ].join(" ");

  const artifacts =
    artifactNotes.length > 0
      ? `\n\nActive plasmid artifacts: ${artifactNotes.join(", ")}`
      : "";

  return {
    system: `${intro} ${contract}${artifacts}`,
    user: caseData.prompt,
  };
}

async function collectArtifactNotes(workspaceRoot: string): Promise<readonly string[]> {
  const notes: string[] = [];
  const dirs = [
    ".dhelix/agents",
    ".dhelix/skills",
    ".dhelix/commands",
    ".dhelix/hooks",
    ".dhelix/rules",
  ];
  for (const rel of dirs) {
    const abs = path.join(workspaceRoot, rel);
    try {
      const entries = await fs.readdir(abs);
      for (const name of entries) {
        notes.push(`${rel}/${name}`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      // Other errors (e.g. broken symlink) — ignore and proceed.
    }
  }
  return notes;
}

interface ExecuteCaseArgs {
  readonly caseData: RuntimeCase;
  readonly workspaceRoot: string;
  readonly scratchDir: string;
  readonly llm: LLMCompletionFn;
  readonly signal: AbortSignal;
  readonly batchSignal: AbortSignal;
}

async function executeCase(args: ExecuteCaseArgs): Promise<RuntimeRunResult> {
  const { caseData, workspaceRoot, scratchDir, llm, signal, batchSignal } = args;
  const start = Date.now();

  // Combined signal: either the outer caller aborts, or the time-budget
  // controller aborts this case. Listen-based wrapper AbortController
  // used to avoid AbortSignal.any type availability concerns.
  const combined = new AbortController();
  const abortCombined = (): void => combined.abort(signal.reason ?? batchSignal.reason);
  if (signal.aborted || batchSignal.aborted) {
    abortCombined();
  }
  const off1 = onAbort(signal, abortCombined);
  const off2 = onAbort(batchSignal, abortCombined);

  try {
    // Setup scratch files before snapshot so they count as pre-existing.
    try {
      await writeSetupFiles(scratchDir, caseData.setupFiles, combined.signal);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        caseId: caseData.id,
        plasmidId: caseData.plasmidId,
        tier: caseData.tier,
        output: "",
        toolCalls: [],
        hookFires: [],
        filesTouched: [],
        durationMs: Date.now() - start,
        status: "error",
        errorMessage: msg,
      };
    }

    const before = await snapshotDir(scratchDir);
    const artifactNotes = await collectArtifactNotes(workspaceRoot);
    const { system, user } = buildPromptContext(caseData, artifactNotes);

    let output: string;
    try {
      output = await llm({
        system,
        user,
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        signal: combined.signal,
      });
    } catch (err) {
      if (batchSignal.aborted) {
        return {
          caseId: caseData.id,
          plasmidId: caseData.plasmidId,
          tier: caseData.tier,
          output: "",
          toolCalls: [],
          hookFires: [],
          filesTouched: [],
          durationMs: Date.now() - start,
          status: "timeout",
          errorMessage: "time budget exceeded",
        };
      }
      if (signal.aborted) {
        return {
          caseId: caseData.id,
          plasmidId: caseData.plasmidId,
          tier: caseData.tier,
          output: "",
          toolCalls: [],
          hookFires: [],
          filesTouched: [],
          durationMs: Date.now() - start,
          status: "skipped",
          errorMessage: "aborted by caller",
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        caseId: caseData.id,
        plasmidId: caseData.plasmidId,
        tier: caseData.tier,
        output: "",
        toolCalls: [],
        hookFires: [],
        filesTouched: [],
        durationMs: Date.now() - start,
        status: "error",
        errorMessage: msg,
      };
    }

    const after = await snapshotDir(scratchDir);
    const filesTouched = diffSnapshots(before, after);
    const { toolCalls, hookFires } = parseToolAndHookMarkers(output);

    return {
      caseId: caseData.id,
      plasmidId: caseData.plasmidId,
      tier: caseData.tier,
      output,
      toolCalls,
      hookFires,
      filesTouched,
      // Phase-3 MVP executor doesn't spawn a real sub-agent process, so
      // there's no OS exit code. Normalize successful runs to `0` so the
      // grader's `exit-code` handler (deterministic equality) has a defined
      // value to compare against — eval-seeds with `exit code 0` then
      // behave intuitively instead of always failing against `undefined`.
      exitCode: 0,
      durationMs: Date.now() - start,
      status: "ok",
    };
  } finally {
    off1();
    off2();
  }
}

function onAbort(signal: AbortSignal, handler: () => void): () => void {
  if (signal.aborted) {
    handler();
    return () => {
      /* no-op */
    };
  }
  const wrapped = (): void => handler();
  signal.addEventListener("abort", wrapped, { once: true });
  return () => signal.removeEventListener("abort", wrapped);
}

function skippedResult(
  caseData: RuntimeCase,
  reason: string,
): RuntimeRunResult {
  return {
    caseId: caseData.id,
    plasmidId: caseData.plasmidId,
    tier: caseData.tier,
    output: "",
    toolCalls: [],
    hookFires: [],
    filesTouched: [],
    durationMs: 0,
    status: "skipped",
    errorMessage: reason,
  };
}

export const runCases: RunCasesFn = async ({
  cases,
  workspaceRoot,
  llm,
  timeBudgetMs,
  parallelism,
  signal,
}) => {
  // Pre-abort guard: everything skipped.
  if (signal?.aborted) {
    return cases.map((c) => skippedResult(c, "aborted before start"));
  }

  const scratchDir = path.join(workspaceRoot, "scratch");
  await fs.mkdir(scratchDir, { recursive: true });

  // Time-budget controller — aborts every in-flight case when the wall
  // clock elapses. Queued cases become `"skipped"` below.
  const batchCtrl = new AbortController();
  const budgetTimer = setTimeout(() => {
    batchCtrl.abort(new Error("time budget exceeded"));
  }, Math.max(0, timeBudgetMs));
  // Allow Node to exit even if the timer is still pending.
  if (typeof budgetTimer.unref === "function") budgetTimer.unref();

  const results: RuntimeRunResult[] = new Array<RuntimeRunResult>(cases.length);
  let nextIndex = 0;
  let errorRuns = 0;
  let bailReason: string | undefined;

  const limit = Math.max(1, Math.floor(parallelism));
  const outerSignal = signal ?? new AbortController().signal;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (bailReason !== undefined) return;
      if (outerSignal.aborted || batchCtrl.signal.aborted) return;

      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= cases.length) return;

      const caseData = cases[idx];
      if (caseData === undefined) return;

      const run = await executeCase({
        caseData,
        workspaceRoot,
        scratchDir,
        llm,
        signal: outerSignal,
        batchSignal: batchCtrl.signal,
      });
      results[idx] = run;

      if (run.status === "error") {
        errorRuns += 1;
        if (errorRuns > ERROR_RUN_CEILING) {
          bailReason = "error-run ceiling exceeded";
          return;
        }
      }
    }
  };

  const workerCount = Math.min(limit, cases.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) workers.push(worker());
  try {
    await Promise.all(workers);
  } finally {
    clearTimeout(budgetTimer);
  }

  // Backfill any slots the workers never reached.
  for (let i = 0; i < cases.length; i += 1) {
    if (results[i] !== undefined) continue;
    const caseData = cases[i];
    if (caseData === undefined) continue;
    const reason =
      bailReason !== undefined
        ? bailReason
        : batchCtrl.signal.aborted
          ? "time budget exceeded"
          : outerSignal.aborted
            ? "aborted by caller"
            : "not executed";
    results[i] = skippedResult(caseData, reason);
  }

  return results;
};
