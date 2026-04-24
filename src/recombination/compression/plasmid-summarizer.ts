/**
 * Layer B — abstractive summary of a single plasmid (P-1.13 §3).
 *
 * Takes a `CompiledPlasmidIR` (Stage 2a output) and produces a tier-sized
 * natural-language summary suitable for an AI coding agent to read. The
 * layer honours two strategies from `PipelineStrategies.compression`:
 *
 *   - `abstractive` → one LLM call per plasmid (cache keyed below).
 *   - `extractive`  → LLM is never invoked. Output is Layer A + the top-N
 *                     shortest `intents[].description` strings, trimmed to
 *                     the tier target.
 *
 * Abstractive path includes a lightweight 2-stage quality gate:
 *   1. LLM returns a summary. We verify every original constraint survives
 *      via a fuzzy substring check (case-/whitespace-insensitive).
 *   2. If any constraint is missing, we retry once with an explicit
 *      "must include constraints" reminder. If still missing, we downgrade
 *      to the extractive output and mark `downgraded: true` so the caller
 *      can surface a signal (dropped-list or metric).
 *
 * The layer NEVER includes `ir.body` in prompts — only `ir.summary`,
 * `ir.intents`, `ir.metadata.description`. This is the mechanical guard
 * for I-8 (compile-runtime hermeticity) at the compression boundary.
 */

import type {
  CompiledPlasmidIR,
  CompressedPlasmidSummary,
  CompressionStrategy,
  LLMCompletionFn,
  PlasmidIntentNode,
  PromptSectionBucket,
} from "../types.js";

import {
  cacheKey,
  readCache,
  writeCache,
} from "./cache.js";
import { extractFrontmatter } from "./frontmatter-extractor.js";
import { estimateTokens } from "./token-estimator.js";

/** Deterministic per-tier size ceiling — P-1.13 §6.1. */
const TIER_TARGETS = {
  L1: 50,
  L2: 100,
  L3: 150,
  L4: 250,
} as const;

/** Extractive path — number of intents to splice in alongside Layer A. */
const EXTRACTIVE_INTENT_COUNT = 3;

/** Version stamp — bump when the prompt changes so caches invalidate. */
export const SUMMARIZER_VERSION = "1.0.0";

export interface SummarizeRequest {
  readonly ir: CompiledPlasmidIR;
  readonly bucket: PromptSectionBucket;
  readonly strategy: CompressionStrategy;
  readonly modelId: string;
  readonly workingDirectory: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

export interface SummarizeResult {
  readonly summary: CompressedPlasmidSummary;
  readonly downgraded: boolean;
  readonly cacheHit: boolean;
}

/** Public entry point — one call per plasmid per recombination. */
export async function summarizePlasmid(
  req: SummarizeRequest,
): Promise<SummarizeResult> {
  throwIfAborted(req.signal);

  const target = TIER_TARGETS[req.ir.tier];
  const constraints = collectConstraints(req.ir.intents);
  const frontmatter = extractFrontmatter(req.ir);

  if (req.strategy === "extractive") {
    const markdown = buildExtractive(req.ir, frontmatter.line, target);
    return {
      summary: finaliseSummary(req, markdown, constraints, req.bucket),
      downgraded: false,
      cacheHit: false,
    };
  }

  const key = cacheKey([
    req.ir.bodyFingerprint,
    req.ir.cacheKey,
    req.ir.tier,
    req.modelId,
    SUMMARIZER_VERSION,
    "B",
    req.strategy,
  ]);

  const cached = await readCache<CompressedPlasmidSummary>(
    req.workingDirectory,
    key,
  );
  if (cached) {
    return { summary: cached, downgraded: false, cacheHit: true };
  }

  let llmMarkdown: string;
  try {
    llmMarkdown = await runLLM(req, frontmatter.line, target, constraints, false);
  } catch {
    const markdown = buildExtractive(req.ir, frontmatter.line, target);
    const finalized = finaliseSummary(req, markdown, constraints, req.bucket);
    const finalizedWithKey: CompressedPlasmidSummary = {
      ...finalized,
      cacheKey: key,
    };
    return { summary: finalizedWithKey, downgraded: true, cacheHit: false };
  }

  const missingAfterFirst = findMissing(constraints, llmMarkdown);
  if (missingAfterFirst.length > 0) {
    throwIfAborted(req.signal);
    try {
      llmMarkdown = await runLLM(
        req,
        frontmatter.line,
        target,
        constraints,
        true,
      );
    } catch {
      const markdown = buildExtractive(req.ir, frontmatter.line, target);
      const finalized: CompressedPlasmidSummary = {
        ...finaliseSummary(req, markdown, constraints, req.bucket),
        cacheKey: key,
      };
      return { summary: finalized, downgraded: true, cacheHit: false };
    }
  }

  const stillMissing = findMissing(constraints, llmMarkdown);
  if (stillMissing.length > 0) {
    const markdown = buildExtractive(req.ir, frontmatter.line, target);
    const finalized: CompressedPlasmidSummary = {
      ...finaliseSummary(req, markdown, constraints, req.bucket),
      cacheKey: key,
    };
    return { summary: finalized, downgraded: true, cacheHit: false };
  }

  const markdown = `${frontmatter.line}\n\n${llmMarkdown.trim()}`.trim();
  const finalized: CompressedPlasmidSummary = {
    ...finaliseSummary(req, markdown, constraints, req.bucket),
    cacheKey: key,
  };

  // Best-effort cache write (never throws).
  await writeCache(req.workingDirectory, key, finalized);

  return { summary: finalized, downgraded: false, cacheHit: false };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function collectConstraints(
  intents: readonly PlasmidIntentNode[],
): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const intent of intents) {
    for (const raw of intent.constraints) {
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      ordered.push(trimmed);
    }
  }
  return ordered;
}

function finaliseSummary(
  req: SummarizeRequest,
  markdown: string,
  constraints: readonly string[],
  bucket: PromptSectionBucket,
): CompressedPlasmidSummary {
  return {
    plasmidId: req.ir.plasmidId,
    bucket,
    tier: req.ir.tier,
    markdown,
    tokenEstimate: estimateTokens(markdown),
    preservedConstraints: constraints,
    cacheKey: "",
  };
}

function buildExtractive(
  ir: CompiledPlasmidIR,
  frontmatterLine: string,
  targetTokens: number,
): string {
  const intentSnippets = [...ir.intents]
    .filter((i) => i.description.trim().length > 0)
    .sort((a, b) => a.description.length - b.description.length)
    .slice(0, EXTRACTIVE_INTENT_COUNT)
    .map((i) => `- ${i.title.trim()}: ${collapseWhitespace(i.description)}`);

  const constraintLines = collectConstraints(ir.intents).map(
    (c) => `- constraint: ${collapseWhitespace(c)}`,
  );

  const lines = [frontmatterLine, "", ...intentSnippets, ...constraintLines];
  const joined = lines.join("\n").trim();
  return truncateToTokens(joined, targetTokens);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function truncateToTokens(text: string, targetTokens: number): string {
  const budgetChars = Math.max(1, targetTokens * 4);
  if (text.length <= budgetChars) return text;
  return `${text.slice(0, budgetChars - 1).trimEnd()}…`;
}

function findMissing(
  constraints: readonly string[],
  markdown: string,
): readonly string[] {
  if (constraints.length === 0) return [];
  const haystack = normalise(markdown);
  return constraints.filter((c) => {
    const needle = normalise(c);
    if (needle.length === 0) return false;
    // Coarse fuzzy match — strip punctuation, compare lowercased whitespace-collapsed.
    return !haystack.includes(needle);
  });
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

async function runLLM(
  req: SummarizeRequest,
  frontmatterLine: string,
  targetTokens: number,
  constraints: readonly string[],
  emphasiseConstraints: boolean,
): Promise<string> {
  const system = [
    "You compress plasmid intents for an AI coding agent's system prompt.",
    `Output at most ${targetTokens} tokens (≈${targetTokens * 4} characters).`,
    "Preserve every constraint verbatim (NOT / NEVER / MUST remain).",
    "Drop rhetorical fluff; keep imperative voice.",
    "Do NOT include raw code, URLs, examples, or evidence.",
    "Return plain markdown (no JSON, no fences).",
  ].join("\n");

  const intentsBlock = req.ir.intents
    .map(
      (i) =>
        `- [${i.kind}] ${i.title.trim()}: ${collapseWhitespace(i.description)}`,
    )
    .join("\n");
  const constraintsBlock =
    constraints.length === 0
      ? "(none)"
      : constraints.map((c) => `- ${c}`).join("\n");

  const emphasis = emphasiseConstraints
    ? "\n\nIMPORTANT: earlier output dropped constraints. Include EVERY constraint line exactly, even if it costs extra tokens."
    : "";

  const user = [
    `Plasmid ID: ${req.ir.plasmidId}`,
    `Tier: ${req.ir.tier}`,
    `Bucket: ${req.bucket}`,
    `Frontmatter line: ${frontmatterLine}`,
    "",
    `Interpreter summary:\n${collapseWhitespace(req.ir.summary)}`,
    "",
    `Intents:\n${intentsBlock || "(none)"}`,
    "",
    `Constraints (MUST preserve):\n${constraintsBlock}`,
    emphasis,
  ].join("\n");

  return req.llm({
    system,
    user,
    jsonMode: false,
    temperature: 0,
    maxTokens: Math.max(targetTokens * 2, 256),
    signal: req.signal,
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("compression aborted");
  }
}
