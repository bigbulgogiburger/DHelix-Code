/**
 * Blind pairwise comparator — judges outputs of iteration A vs iteration B
 * per eval case using an injected LLM judge, then aggregates into a
 * `Comparison` artefact suitable for persistence (comparison.json) and HTML
 * rendering by `html-report.ts`.
 *
 * Design principles:
 * - Pure aggregation + DI boundary: the actual LLM call is injected through
 *   `ComparatorDeps.judgePair` so unit tests can stub it deterministically.
 * - fs is injectable for the same reason.
 * - AbortSignal is propagated end-to-end; an aborted signal rejects the call.
 * - Cases missing on either side (no `output.md`) are skipped, not errored.
 *
 * @see src/commands/skill-review.ts — invokes this for `--compare M`.
 * @see src/skills/creator/compare/html-report.ts — consumes the Comparison.
 */

import * as defaultFs from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { getRunDir } from "../evals/workspace.js";

// ---------------------------------------------------------------------------
// Rubric + Comparison schemas
// ---------------------------------------------------------------------------

export const rubricScoreSchema = z.object({
  content: z.number().min(0).max(5),
  structure: z.number().min(0).max(5),
  safety: z.number().min(0).max(5),
  trigger_alignment: z.number().min(0).max(5),
});
export type RubricScore = z.infer<typeof rubricScoreSchema>;

export const comparisonSchema = z.object({
  skill_name: z.string(),
  iteration_a: z.number().int().nonnegative(),
  iteration_b: z.number().int().nonnegative(),
  a_wins: z.number().int().nonnegative(),
  b_wins: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  rubric_a: rubricScoreSchema,
  rubric_b: rubricScoreSchema,
  per_case_winners: z.array(
    z.object({
      case_id: z.string(),
      winner: z.enum(["A", "B", "tie"]),
      reason: z.string(),
    }),
  ),
});
export type Comparison = z.infer<typeof comparisonSchema>;

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

/** Result of a single blind A-vs-B judgement for one case. */
export interface JudgePairResult {
  readonly winner: "A" | "B" | "tie";
  readonly reason: string;
  readonly rubricA: RubricScore;
  readonly rubricB: RubricScore;
}

/**
 * Injectable dependency surface — the judge is normally an LLM wrapper but
 * can be any deterministic function in tests.
 */
export interface ComparatorDeps {
  readonly judgePair: (args: {
    readonly prompt: string;
    readonly outputA: string;
    readonly outputB: string;
    readonly expectations: readonly string[];
    readonly signal?: AbortSignal;
  }) => Promise<JudgePairResult>;
}

// ---------------------------------------------------------------------------
// compareIterations
// ---------------------------------------------------------------------------

interface CompareArgs {
  readonly skillDir: string;
  readonly skillName: string;
  readonly iterationA: number;
  readonly iterationB: number;
  /** config bucket to read from (default `"with_skill"`). */
  readonly configName?: string;
}

interface CompareOpts {
  readonly signal?: AbortSignal;
  readonly fs?: typeof defaultFs;
  /** Read evals.json for prompt/expectation metadata (default from disk). */
  readonly readEvals?: (skillDir: string) => Promise<EvalsIndex | null>;
  /** Max parallel judge calls (default 4). */
  readonly concurrency?: number;
}

/** Narrow slice of evals.json we need to pass to the judge. */
export interface EvalsIndex {
  readonly cases: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly expectations: readonly string[];
  }[];
}

/**
 * Run a blind pairwise comparison of two iterations.
 *
 * For each case id present in `evals.json`, read the `output.md` for both
 * iterations (skip if either is missing). Call `deps.judgePair` up to
 * `concurrency` times in parallel. Aggregate winners, ties, and rubric means.
 */
export async function compareIterations(
  args: CompareArgs,
  deps: ComparatorDeps,
  opts: CompareOpts = {},
): Promise<Comparison> {
  const fs = opts.fs ?? defaultFs;
  const signal = opts.signal;
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const configName = args.configName ?? "with_skill";

  if (signal?.aborted) throw toAbortError(signal.reason);

  const evals = opts.readEvals
    ? await opts.readEvals(args.skillDir)
    : await defaultReadEvals(args.skillDir, fs);

  if (!evals || evals.cases.length === 0) {
    return emptyComparison(args);
  }

  // Pre-load output pairs; skip cases missing either side.
  interface Prepared {
    readonly caseId: string;
    readonly prompt: string;
    readonly expectations: readonly string[];
    readonly outputA: string;
    readonly outputB: string;
  }

  const prepared: Prepared[] = [];
  for (const c of evals.cases) {
    if (signal?.aborted) throw toAbortError(signal.reason);
    const pathA = join(
      getRunDir(args.skillDir, args.iterationA, c.id, configName),
      "output.md",
    );
    const pathB = join(
      getRunDir(args.skillDir, args.iterationB, c.id, configName),
      "output.md",
    );
    const outputA = await safeRead(fs, pathA);
    const outputB = await safeRead(fs, pathB);
    if (outputA === null || outputB === null) continue;
    prepared.push({
      caseId: c.id,
      prompt: c.prompt,
      expectations: c.expectations,
      outputA,
      outputB,
    });
  }

  if (prepared.length === 0) {
    return emptyComparison(args);
  }

  // Run judgements with a simple concurrency pool (Promise-based, no deps).
  const results: (JudgePairResult & { readonly caseId: string })[] = new Array(
    prepared.length,
  );
  let cursor = 0;
  let firstError: unknown;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (firstError !== undefined) return;
      if (signal?.aborted) {
        firstError = toAbortError(signal.reason);
        return;
      }
      const idx = cursor;
      cursor += 1;
      if (idx >= prepared.length) return;
      const item = prepared[idx];
      if (!item) return;
      try {
        const r = await deps.judgePair({
          prompt: item.prompt,
          outputA: item.outputA,
          outputB: item.outputB,
          expectations: item.expectations,
          signal,
        });
        results[idx] = { ...r, caseId: item.caseId };
      } catch (err) {
        if (firstError === undefined) firstError = err;
        return;
      }
    }
  };

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, prepared.length); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  if (firstError !== undefined) throw firstError;

  // Aggregate
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  const rubricASum: RubricScore = { content: 0, structure: 0, safety: 0, trigger_alignment: 0 };
  const rubricBSum: RubricScore = { content: 0, structure: 0, safety: 0, trigger_alignment: 0 };
  const perCase: { readonly case_id: string; readonly winner: "A" | "B" | "tie"; readonly reason: string }[] = [];

  for (const r of results) {
    if (!r) continue;
    if (r.winner === "A") aWins += 1;
    else if (r.winner === "B") bWins += 1;
    else ties += 1;
    perCase.push({ case_id: r.caseId, winner: r.winner, reason: r.reason });
    addRubric(rubricASum, r.rubricA);
    addRubric(rubricBSum, r.rubricB);
  }

  const n = results.filter((r) => r).length;
  const rubricA = n > 0 ? divideRubric(rubricASum, n) : zeroRubric();
  const rubricB = n > 0 ? divideRubric(rubricBSum, n) : zeroRubric();

  return {
    skill_name: args.skillName,
    iteration_a: args.iterationA,
    iteration_b: args.iterationB,
    a_wins: aWins,
    b_wins: bWins,
    ties,
    rubric_a: rubricA,
    rubric_b: rubricB,
    per_case_winners: perCase,
  };
}

// ---------------------------------------------------------------------------
// Helpers (internal)
// ---------------------------------------------------------------------------

function emptyComparison(args: CompareArgs): Comparison {
  return {
    skill_name: args.skillName,
    iteration_a: args.iterationA,
    iteration_b: args.iterationB,
    a_wins: 0,
    b_wins: 0,
    ties: 0,
    rubric_a: zeroRubric(),
    rubric_b: zeroRubric(),
    per_case_winners: [],
  };
}

function zeroRubric(): RubricScore {
  return { content: 0, structure: 0, safety: 0, trigger_alignment: 0 };
}

function addRubric(acc: RubricScore, add: RubricScore): void {
  // Mutation is confined to local accumulator (never escapes this module).
  (acc as { content: number }).content = acc.content + add.content;
  (acc as { structure: number }).structure = acc.structure + add.structure;
  (acc as { safety: number }).safety = acc.safety + add.safety;
  (acc as { trigger_alignment: number }).trigger_alignment =
    acc.trigger_alignment + add.trigger_alignment;
}

function divideRubric(r: RubricScore, n: number): RubricScore {
  return {
    content: r.content / n,
    structure: r.structure / n,
    safety: r.safety / n,
    trigger_alignment: r.trigger_alignment / n,
  };
}

async function safeRead(
  fs: typeof defaultFs,
  path: string,
): Promise<string | null> {
  try {
    return await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function defaultReadEvals(
  skillDir: string,
  fs: typeof defaultFs,
): Promise<EvalsIndex | null> {
  const path = join(skillDir, "evals", "evals.json");
  try {
    const raw = await fs.readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const cases = parsed["cases"];
    if (!Array.isArray(cases)) return null;
    const out: { readonly id: string; readonly prompt: string; readonly expectations: readonly string[] }[] = [];
    for (const c of cases) {
      if (!isRecord(c)) continue;
      const id = c["id"];
      const prompt = c["prompt"];
      const expectations = c["expectations"];
      if (typeof id !== "string" || typeof prompt !== "string" || !Array.isArray(expectations)) continue;
      const exp = expectations.filter((e): e is string => typeof e === "string");
      out.push({ id, prompt, expectations: exp });
    }
    return { cases: out };
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  const err = new Error(typeof reason === "string" ? reason : "Aborted");
  err.name = "AbortError";
  return err;
}

// ---------------------------------------------------------------------------
// Production deps — wraps createLLMClientForModel as a blind judge
// ---------------------------------------------------------------------------

const JUDGE_SYSTEM_PROMPT = [
  "You blindly compare two candidate outputs (A and B) for the same task.",
  "Score each on content/structure/safety/trigger_alignment from 0 to 5.",
  "Then pick a winner: A, B, or tie.",
  "",
  "Reply ONLY with a single JSON object, no fences, no commentary:",
  "{",
  '  "winner": "A" | "B" | "tie",',
  '  "reason": "one short sentence",',
  '  "rubricA": { "content": 0-5, "structure": 0-5, "safety": 0-5, "trigger_alignment": 0-5 },',
  '  "rubricB": { "content": 0-5, "structure": 0-5, "safety": 0-5, "trigger_alignment": 0-5 }',
  "}",
].join("\n");

/**
 * Build production ComparatorDeps backed by the project LLM client factory.
 *
 * Kept in this module (and lazily imported) so tests never drag the LLM layer.
 */
export function createProductionComparatorDeps(opts?: {
  readonly model?: string;
}): ComparatorDeps {
  return {
    judgePair: async (args) => {
      // Lazy import to keep this module fast to load in tests.
      const [{ createLLMClientForModel }, { LLM_DEFAULTS }] = await Promise.all([
        import("../../../llm/client-factory.js"),
        import("../../../constants.js"),
      ]);
      const model = opts?.model ?? "claude-haiku-4-5-20251001";
      const apiKey =
        process.env["ANTHROPIC_API_KEY"] ||
        process.env["OPENAI_API_KEY"] ||
        process.env["LOCAL_API_KEY"] ||
        process.env["DHELIX_API_KEY"] ||
        "";
      const provider = createLLMClientForModel({
        model,
        baseURL: LLM_DEFAULTS.baseUrl,
        apiKey,
        timeout: 120_000,
      });

      const userPrompt = [
        "# Task Prompt",
        args.prompt,
        "",
        "# Expectations",
        args.expectations.map((e) => `- ${e}`).join("\n"),
        "",
        "# Output A",
        args.outputA,
        "",
        "# Output B",
        args.outputB,
        "",
        "Now respond with the JSON verdict.",
      ].join("\n");

      const response = await provider.chat({
        model,
        messages: [
          { role: "system", content: JUDGE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        maxTokens: 512,
        signal: args.signal,
      });

      return parseJudgeJson(response.content);
    },
  };
}

/** Defensive JSON extraction — mirrors grader.ts behaviour but no import. */
function parseJudgeJson(raw: string): JudgePairResult {
  const fallback: JudgePairResult = {
    winner: "tie",
    reason: "judge response unparseable",
    rubricA: zeroRubric(),
    rubricB: zeroRubric(),
  };
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(first, last + 1));
  } catch {
    return fallback;
  }
  if (!isRecord(parsed)) return fallback;
  const winnerRaw = parsed["winner"];
  const winner: "A" | "B" | "tie" =
    winnerRaw === "A" || winnerRaw === "B" ? winnerRaw : "tie";
  const reason = typeof parsed["reason"] === "string" ? parsed["reason"] : "";
  const rubricA = coerceRubric(parsed["rubricA"]);
  const rubricB = coerceRubric(parsed["rubricB"]);
  return { winner, reason, rubricA, rubricB };
}

function coerceRubric(v: unknown): RubricScore {
  if (!isRecord(v)) return zeroRubric();
  const clamp = (x: unknown): number => {
    if (typeof x !== "number" || !Number.isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 5) return 5;
    return x;
  };
  return {
    content: clamp(v["content"]),
    structure: clamp(v["structure"]),
    safety: clamp(v["safety"]),
    trigger_alignment: clamp(v["trigger_alignment"]),
  };
}
