/**
 * Grader cascade (PRD §8.4, P-1.17 §4).
 *
 * Team 2 — Phase 3. For each `(RuntimeCase, RuntimeRunResult)` pair the
 * cascade parses every expectation via Team 1's `parseExpectations` and
 * routes each parsed expectation to the strictest applicable handler the
 * active strategy allows:
 *
 *   deterministic   output-contains / output-excludes /
 *                   file-exists / file-modified / exit-code
 *   semi            tool-called / hook-fired
 *     (gated by `strategies.gradingTiers.includes("semi")`)
 *   llm             free-text
 *     (gated by `strategies.gradingTiers.includes("llm")`)
 *
 * A missing handler for the required tier produces a
 * `handler: "skipped"` entry (not counted toward pass/fail).
 *
 * A case passes iff every non-skipped expectation passed AND at least
 * one non-skipped expectation exists.
 *
 * LLM judge failures (parse error, network error, …) degrade to a
 * `handler: "llm", passed: false, evidence: "LLM judge error: …"`
 * entry. This keeps the cascade a pure graceful-degradation pipeline.
 *
 * Layer: Core. LLM is invoked only for free-text under `"llm"` tier.
 */
import type {
  CaseGrading,
  Expectation,
  ExpectationResult,
  GradeCasesFn,
  GraderHandler,
  LLMCompletionFn,
  RuntimeCase,
  RuntimeRunResult,
} from "../types.js";

import { parseExpectations } from "./expectation-dsl.js";

/** Prompt reused from `src/skills/creator/evals/grader.ts::JUDGE_SYSTEM_PROMPT`. */
const JUDGE_SYSTEM_PROMPT = [
  "You are a strict but fair evaluator. Your job is to decide whether a single",
  "expectation is satisfied by the output of a coding assistant.",
  "",
  "Rules:",
  "- Answer ONLY with a JSON object of the form:",
  '  {"passed": <boolean>, "evidence": <string>, "reasoning": <string>}',
  "- `passed` is true iff the expectation is clearly supported by the output.",
  "- `evidence` is a short quote or paraphrase from the output (<=200 chars).",
  "- `reasoning` is 1-2 sentences explaining the verdict.",
  "- Do not include Markdown fences, commentary, or any text outside the JSON.",
].join("\n");

interface JudgeVerdict {
  readonly passed: boolean;
  readonly evidence: string;
  readonly confidence?: number;
}

function buildJudgeUserPrompt(args: {
  readonly prompt: string;
  readonly output: string;
  readonly expectation: string;
}): string {
  return [
    "# Original Prompt",
    args.prompt,
    "",
    "# Assistant Output",
    args.output,
    "",
    "# Expectation to verify",
    args.expectation,
    "",
    "Respond now with the JSON verdict.",
  ].join("\n");
}

function extractJsonObject(raw: string): string | undefined {
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenceMatch && fenceMatch[1]) {
    const inside = fenceMatch[1].trim();
    if (inside.startsWith("{") && inside.endsWith("}")) return inside;
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return undefined;
  return raw.slice(first, last + 1).trim();
}

function parseJudgeVerdict(raw: string): JudgeVerdict {
  const extracted = extractJsonObject(raw);
  if (!extracted) {
    return { passed: false, evidence: "LLM judge error: non-JSON response" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { passed: false, evidence: `LLM judge error: ${msg}` };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { passed: false, evidence: "LLM judge error: not an object" };
  }
  const record = parsed as Record<string, unknown>;
  const passed = record["passed"];
  const evidenceField = record["evidence"];
  const confidenceField = record["confidence"];
  if (typeof passed !== "boolean") {
    return {
      passed: false,
      evidence:
        typeof evidenceField === "string"
          ? evidenceField
          : "LLM judge error: missing `passed` field",
    };
  }
  return {
    passed,
    evidence: typeof evidenceField === "string" ? evidenceField : "",
    ...(typeof confidenceField === "number" ? { confidence: confidenceField } : {}),
  };
}

// ─── Deterministic handlers ────────────────────────────────────────────────

function gradeDeterministic(
  expectation: Expectation,
  run: RuntimeRunResult,
): ExpectationResult | undefined {
  switch (expectation.kind) {
    case "output-contains": {
      const passed = run.output.includes(expectation.text);
      return makeResult(expectation, "deterministic", passed,
        passed ? `contains "${expectation.text}"` : `missing "${expectation.text}"`);
    }
    case "output-excludes": {
      const passed = !run.output.includes(expectation.text);
      return makeResult(expectation, "deterministic", passed,
        passed
          ? `absent "${expectation.text}"`
          : `forbidden substring present: "${expectation.text}"`);
    }
    case "file-exists": {
      const passed = run.filesTouched.some(
        (f) => f.path === expectation.path && (f.op === "create" || f.op === "update"),
      );
      return makeResult(expectation, "deterministic", passed,
        passed ? `file created/updated: ${expectation.path}` : `no create/update for ${expectation.path}`);
    }
    case "file-modified": {
      const passed = run.filesTouched.some(
        (f) => f.path === expectation.path && f.op === "update",
      );
      return makeResult(expectation, "deterministic", passed,
        passed ? `file updated: ${expectation.path}` : `no update on ${expectation.path}`);
    }
    case "exit-code": {
      const passed = run.exitCode === expectation.code;
      return makeResult(expectation, "deterministic", passed,
        `exitCode=${run.exitCode ?? "undefined"}, expected=${expectation.code}`);
    }
    default:
      return undefined;
  }
}

function gradeSemi(
  expectation: Expectation,
  run: RuntimeRunResult,
): ExpectationResult | undefined {
  switch (expectation.kind) {
    case "tool-called": {
      const passed = run.toolCalls.includes(expectation.tool);
      return makeResult(expectation, "semi", passed,
        passed ? `tool called: ${expectation.tool}` : `tool not called: ${expectation.tool}`);
    }
    case "hook-fired": {
      const passed = run.hookFires.includes(expectation.event);
      return makeResult(expectation, "semi", passed,
        passed ? `hook fired: ${expectation.event}` : `hook not fired: ${expectation.event}`);
    }
    default:
      return undefined;
  }
}

async function gradeViaLlm(
  expectation: Expectation & { readonly kind: "free-text" },
  caseData: RuntimeCase,
  run: RuntimeRunResult,
  llm: LLMCompletionFn,
  signal: AbortSignal | undefined,
): Promise<ExpectationResult> {
  try {
    const raw = await llm({
      system: JUDGE_SYSTEM_PROMPT,
      user: buildJudgeUserPrompt({
        prompt: caseData.prompt,
        output: run.output,
        expectation: expectation.text,
      }),
      temperature: 0,
      maxTokens: 512,
      ...(signal ? { signal } : {}),
    });
    const verdict = parseJudgeVerdict(raw);
    return {
      original: expectation.original,
      parsed: expectation,
      handler: "llm",
      passed: verdict.passed,
      evidence: verdict.evidence,
      ...(typeof verdict.confidence === "number"
        ? { llmConfidence: verdict.confidence }
        : {}),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      original: expectation.original,
      parsed: expectation,
      handler: "llm",
      passed: false,
      evidence: `LLM judge error: ${msg}`,
    };
  }
}

function makeResult(
  expectation: Expectation,
  handler: GraderHandler,
  passed: boolean,
  evidence: string,
): ExpectationResult {
  return {
    original: expectation.original,
    parsed: expectation,
    handler,
    passed,
    evidence,
  };
}

function makeSkipped(expectation: Expectation, reason: string): ExpectationResult {
  return {
    original: expectation.original,
    parsed: expectation,
    handler: "skipped",
    passed: false,
    evidence: reason,
  };
}

function isDeterministicKind(kind: Expectation["kind"]): boolean {
  return (
    kind === "output-contains" ||
    kind === "output-excludes" ||
    kind === "file-exists" ||
    kind === "file-modified" ||
    kind === "exit-code"
  );
}

function isSemiKind(kind: Expectation["kind"]): boolean {
  return kind === "tool-called" || kind === "hook-fired";
}

export const gradeCases: GradeCasesFn = async ({
  cases,
  runs,
  strategies,
  llm,
  signal,
}) => {
  const runsByCase = new Map<string, RuntimeRunResult>();
  for (const r of runs) runsByCase.set(r.caseId, r);

  const semiEnabled = strategies.gradingTiers.includes("semi");
  const llmEnabled = strategies.gradingTiers.includes("llm");

  const gradings: CaseGrading[] = [];

  for (const caseData of cases) {
    if (signal?.aborted) break;
    const run = runsByCase.get(caseData.id);
    if (!run) {
      // Missing run — treat as all-skipped, case fails.
      gradings.push({
        caseId: caseData.id,
        plasmidId: caseData.plasmidId,
        tier: caseData.tier,
        passed: false,
        expectationResults: [],
      });
      continue;
    }

    // Runs already skipped / timed out get an empty result set so the
    // caller can still report them per case.
    if (run.status === "skipped" || run.status === "timeout") {
      gradings.push({
        caseId: caseData.id,
        plasmidId: caseData.plasmidId,
        tier: caseData.tier,
        passed: false,
        expectationResults: [],
      });
      continue;
    }

    const parsed = parseExpectations(caseData.expectations);
    const results: ExpectationResult[] = [];

    for (const expectation of parsed) {
      if (signal?.aborted) break;

      // deterministic tier: always attempted (pass 1).
      if (isDeterministicKind(expectation.kind)) {
        const det = gradeDeterministic(expectation, run);
        if (det) {
          results.push(det);
          continue;
        }
      }

      if (isSemiKind(expectation.kind)) {
        if (!semiEnabled) {
          results.push(makeSkipped(expectation, "semi tier not enabled"));
          continue;
        }
        const semi = gradeSemi(expectation, run);
        if (semi) {
          results.push(semi);
          continue;
        }
      }

      if (expectation.kind === "free-text") {
        if (!llmEnabled) {
          results.push(makeSkipped(expectation, "llm tier not enabled"));
          continue;
        }
        const llmRes = await gradeViaLlm(expectation, caseData, run, llm, signal);
        results.push(llmRes);
        continue;
      }

      // Fallthrough — shouldn't happen given the three branches above.
      results.push(makeSkipped(expectation, "no handler matched"));
    }

    const nonSkipped = results.filter((r) => r.handler !== "skipped");
    const passed = nonSkipped.length > 0 && nonSkipped.every((r) => r.passed);

    gradings.push({
      caseId: caseData.id,
      plasmidId: caseData.plasmidId,
      tier: caseData.tier,
      passed,
      expectationResults: results,
    });
  }

  return gradings;
};
