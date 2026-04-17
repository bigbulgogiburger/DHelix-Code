/**
 * Description optimizer — iteratively rewrites a skill's description to maximise
 * triggering accuracy on an auto-generated set of should-trigger / should-not-trigger
 * prompts.
 *
 * Algorithm (plan §10.2):
 *   1. Generate N should-trigger + N should-not-trigger prompts via LLM.
 *   2. Measure baseline accuracy of the current description.
 *   3. For each iteration up to maxIterations:
 *      - Ask the LLM to rewrite the description, attending to the failing cases.
 *      - Measure the candidate's accuracy.
 *      - Accept the candidate if accuracy > bestAccuracy + improvementThreshold.
 *      - Break early (regression guard) if accuracy < bestAccuracy - regressionThreshold.
 *   4. Return the best description ever seen plus the full iteration history.
 *
 * Design principles:
 *   - Pure dependency injection — `OptimizerDeps` is fully stubbable for tests.
 *   - `createProductionOptimizerDeps` wires real dependencies by lazily importing
 *     `createGraderClient`. Tests never hit the network.
 *   - AbortSignal is propagated to every LLM call; aborted promises reject with
 *     an AbortError.
 *   - Concurrency pool keeps the number of in-flight `checkTrigger` calls
 *     bounded (default 4).
 */

import { createGraderClient } from "../evals/grader.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TriggerEval {
  readonly prompt: string;
  readonly shouldTrigger: boolean;
}

export interface TriggerEvalResult {
  readonly prompt: string;
  readonly shouldTrigger: boolean;
  readonly didTrigger: boolean;
  readonly passed: boolean;
}

export interface DescriptionIteration {
  readonly version: number;
  readonly description: string;
  readonly accuracy: number;
  readonly triggerEvals?: readonly TriggerEvalResult[];
  readonly accepted: boolean;
  readonly reason?: "won" | "regression-guard" | "no-improvement";
}

export interface OptimizerDeps {
  readonly generateTriggerEvals: (args: {
    readonly skillBody: string;
    readonly count: number;
    readonly signal?: AbortSignal;
  }) => Promise<readonly TriggerEval[]>;

  readonly checkTrigger: (args: {
    readonly description: string;
    readonly prompt: string;
    readonly signal?: AbortSignal;
  }) => Promise<boolean>;

  readonly rewriteDescription: (args: {
    readonly currentDescription: string;
    readonly failures: readonly TriggerEvalResult[];
    readonly signal?: AbortSignal;
  }) => Promise<string>;
}

export interface OptimizeOptions {
  readonly maxIterations?: number;
  readonly improvementThreshold?: number;
  readonly regressionThreshold?: number;
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
}

export interface OptimizeResult {
  readonly final: string;
  readonly history: readonly DescriptionIteration[];
  readonly baselineAccuracy: number;
  readonly bestAccuracy: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ITERATIONS = 5;
const DEFAULT_IMPROVEMENT_THRESHOLD = 0.05;
const DEFAULT_REGRESSION_THRESHOLD = 0.1;
const DEFAULT_CONCURRENCY = 4;
/** Number of should-trigger prompts AND should-not-trigger prompts to generate. */
const DEFAULT_TRIGGER_COUNT = 10;
/** Maximum number of failures passed into the rewrite prompt. */
const MAX_FAILURE_EXAMPLES = 6;

// ---------------------------------------------------------------------------
// optimizeDescription
// ---------------------------------------------------------------------------

export async function optimizeDescription(
  args: {
    readonly baselineDescription: string;
    readonly skillBody: string;
  },
  deps: OptimizerDeps,
  opts?: OptimizeOptions,
): Promise<OptimizeResult> {
  const maxIterations = opts?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const improvementThreshold =
    opts?.improvementThreshold ?? DEFAULT_IMPROVEMENT_THRESHOLD;
  const regressionThreshold =
    opts?.regressionThreshold ?? DEFAULT_REGRESSION_THRESHOLD;
  const concurrency = Math.max(1, opts?.concurrency ?? DEFAULT_CONCURRENCY);
  const signal = opts?.signal;

  throwIfAborted(signal);

  const triggerEvals = await deps.generateTriggerEvals({
    skillBody: args.skillBody,
    count: DEFAULT_TRIGGER_COUNT,
    signal,
  });

  throwIfAborted(signal);

  // Baseline -----------------------------------------------------------------
  const baselineResults = await evaluateTriggers({
    description: args.baselineDescription,
    triggerEvals,
    deps,
    concurrency,
    signal,
  });
  const baselineAccuracy = accuracyOf(baselineResults);

  const history: DescriptionIteration[] = [
    {
      version: 0,
      description: args.baselineDescription,
      accuracy: baselineAccuracy,
      triggerEvals: baselineResults,
      accepted: true,
      reason: "won",
    },
  ];

  let currentDescription = args.baselineDescription;
  let bestAccuracy = baselineAccuracy;
  let bestDescription = args.baselineDescription;

  for (let version = 1; version <= maxIterations; version += 1) {
    throwIfAborted(signal);

    const lastEntry = history[history.length - 1];
    const lastEvals = lastEntry?.triggerEvals ?? baselineResults;
    const failures = lastEvals
      .filter((e) => !e.passed)
      .slice(0, MAX_FAILURE_EXAMPLES);

    const candidate = await deps.rewriteDescription({
      currentDescription,
      failures,
      signal,
    });

    throwIfAborted(signal);

    const candidateResults = await evaluateTriggers({
      description: candidate,
      triggerEvals,
      deps,
      concurrency,
      signal,
    });
    const candidateAccuracy = accuracyOf(candidateResults);

    const accepted = candidateAccuracy > bestAccuracy + improvementThreshold;
    const regressed = candidateAccuracy < bestAccuracy - regressionThreshold;

    history.push({
      version,
      description: candidate,
      accuracy: candidateAccuracy,
      triggerEvals: candidateResults,
      accepted,
      reason: accepted
        ? "won"
        : regressed
          ? "regression-guard"
          : "no-improvement",
    });

    if (accepted) {
      currentDescription = candidate;
      bestAccuracy = candidateAccuracy;
      bestDescription = candidate;
    }

    if (regressed) {
      break;
    }
  }

  // Keep triggerEvals only on the LAST history entry to save memory / tokens.
  const slimHistory = history.map((entry, idx) =>
    idx === history.length - 1
      ? entry
      : ({ ...entry, triggerEvals: undefined } as DescriptionIteration),
  );

  return {
    final: bestDescription,
    history: slimHistory,
    baselineAccuracy,
    bestAccuracy,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function evaluateTriggers(args: {
  readonly description: string;
  readonly triggerEvals: readonly TriggerEval[];
  readonly deps: OptimizerDeps;
  readonly concurrency: number;
  readonly signal?: AbortSignal;
}): Promise<readonly TriggerEvalResult[]> {
  const results: TriggerEvalResult[] = new Array<TriggerEvalResult>(
    args.triggerEvals.length,
  );

  await runWithConcurrency(
    args.triggerEvals.length,
    args.concurrency,
    async (idx) => {
      throwIfAborted(args.signal);
      const evalCase = args.triggerEvals[idx];
      if (!evalCase) return;
      const didTrigger = await args.deps.checkTrigger({
        description: args.description,
        prompt: evalCase.prompt,
        signal: args.signal,
      });
      results[idx] = {
        prompt: evalCase.prompt,
        shouldTrigger: evalCase.shouldTrigger,
        didTrigger,
        passed: evalCase.shouldTrigger === didTrigger,
      };
    },
  );

  return results;
}

function accuracyOf(results: readonly TriggerEvalResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.passed).length;
  return passed / results.length;
}

async function runWithConcurrency(
  count: number,
  limit: number,
  worker: (index: number) => Promise<void>,
): Promise<void> {
  if (count === 0) return;
  const effectiveLimit = Math.min(limit, count);
  let nextIndex = 0;
  let firstError: unknown;

  const runSlot = async (): Promise<void> => {
    while (true) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= count) return;
      try {
        await worker(idx);
      } catch (err) {
        if (firstError === undefined) firstError = err;
      }
    }
  };

  const slots: Promise<void>[] = [];
  for (let i = 0; i < effectiveLimit; i += 1) {
    slots.push(runSlot());
  }
  await Promise.all(slots);
  if (firstError !== undefined) throw firstError;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const reason = signal.reason;
    if (reason instanceof Error) throw reason;
    const err = new Error(typeof reason === "string" ? reason : "Aborted");
    err.name = "AbortError";
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Production deps — wire real LLM grader client
// ---------------------------------------------------------------------------

const REWRITE_SYSTEM_PROMPT = [
  "You optimize skill descriptions to better match trigger phrases and better",
  "reject negative examples.",
  "",
  "Rules:",
  "- Keep the description pushy and imperative.",
  "- 3 sentences or fewer, under 400 characters.",
  "- Preserve the existing 'Use when ...' clause verbatim if present.",
  "- Respond with ONLY the new description text — no Markdown, no commentary.",
].join("\n");

const TRIGGER_EVAL_SYSTEM_PROMPT = [
  "You generate evaluation prompts for a skill's triggering behaviour.",
  "You will be given the skill body. Produce exactly `count` should-trigger",
  "prompts (realistic user requests that MUST match this skill) and exactly",
  "`count` should-not-trigger prompts (plausible-but-unrelated requests).",
  "",
  "Respond with a JSON object of the form:",
  '  {"shouldTrigger": string[], "shouldNotTrigger": string[]}',
  "No Markdown fences, no commentary.",
].join("\n");

const CHECK_TRIGGER_SYSTEM_PROMPT = [
  "You are a strict routing classifier. Given a single skill description and a",
  "single user prompt, decide whether this skill should be invoked for the",
  "prompt.",
  "",
  'Respond with exactly one of: "yes" or "no". No punctuation, no explanation.',
].join("\n");

export interface CreateProductionOptimizerDepsOptions {
  readonly model?: string;
}

/**
 * Build a real `OptimizerDeps` by closing over the shared grader client.
 *
 * The grader client is reused for all three LLM-backed dependencies: it is a
 * thin wrapper around `createLLMClientForModel` with a strict-judge prompt,
 * which is good enough for yes/no routing decisions and short JSON generation.
 * Each dep overrides the system prompt via the `expectation` argument.
 *
 * NOTE: tests always inject stubs. This factory is only used at runtime and is
 * exercised in tests solely at the shape level (presence of methods).
 */
export function createProductionOptimizerDeps(
  opts?: CreateProductionOptimizerDepsOptions,
): OptimizerDeps {
  const grader = createGraderClient(
    opts?.model ? { model: opts.model } : undefined,
  );

  return {
    generateTriggerEvals: async (args) => {
      const raw = await grader.grade({
        prompt: args.skillBody,
        output: "",
        expectation: `${TRIGGER_EVAL_SYSTEM_PROMPT}\n\ncount=${args.count}`,
        signal: args.signal,
      });
      return parseTriggerEvalsPayload(raw.evidence || raw.reasoning || "");
    },

    checkTrigger: async (args) => {
      const verdict = await grader.grade({
        prompt: args.prompt,
        output: args.description,
        expectation: CHECK_TRIGGER_SYSTEM_PROMPT,
        signal: args.signal,
      });
      return verdict.passed;
    },

    rewriteDescription: async (args) => {
      const failureLines = args.failures
        .slice(0, MAX_FAILURE_EXAMPLES)
        .map(
          (f, i) =>
            `${i + 1}. [${f.shouldTrigger ? "should-trigger" : "should-not-trigger"}] ${f.prompt}`,
        )
        .join("\n");
      const verdict = await grader.grade({
        prompt: `Current description:\n${args.currentDescription}\n\nFailures:\n${failureLines}`,
        output: args.currentDescription,
        expectation: REWRITE_SYSTEM_PROMPT,
        signal: args.signal,
      });
      const text = (verdict.evidence || verdict.reasoning || "").trim();
      return text.length > 0 ? text : args.currentDescription;
    },
  };
}

function parseTriggerEvalsPayload(raw: string): readonly TriggerEval[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "shouldTrigger" in parsed &&
      "shouldNotTrigger" in parsed
    ) {
      const st = (parsed as { readonly shouldTrigger: unknown }).shouldTrigger;
      const sn = (parsed as { readonly shouldNotTrigger: unknown })
        .shouldNotTrigger;
      if (Array.isArray(st) && Array.isArray(sn)) {
        const pos: TriggerEval[] = st
          .filter((x): x is string => typeof x === "string")
          .map((p) => ({ prompt: p, shouldTrigger: true }));
        const neg: TriggerEval[] = sn
          .filter((x): x is string => typeof x === "string")
          .map((p) => ({ prompt: p, shouldTrigger: false }));
        return [...pos, ...neg];
      }
    }
  } catch {
    // fall through
  }
  return [];
}
