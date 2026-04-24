/**
 * Stage 2c — Compression pipeline public entry point (P-1.13).
 *
 * Layer: Core (Layer 2).
 *
 * Orchestrates the 4-layer pipeline:
 *
 *   Layer A (frontmatter extraction, deterministic)
 *     → Layer B (abstractive / extractive plasmid summary)
 *     → Layer C (bucket routing + assembly)
 *     → Layer D (project profile, LLM or static template)
 *
 * Budget + overflow governor apply between Layer B and Layer C so only
 * kept summaries reach the assembler.
 *
 * Contract obligations (from `recombination/types.ts`):
 *   - Consume `CompressRequest` (irs + strategies + workingDirectory + llm + signal).
 *   - Produce `CompressionOutput` (summaries, sections, projectProfileMarkdown,
 *     totalTokenEstimate, budgetTokens, droppedPlasmidIds).
 *   - Never write to disk here — Stage 4 (Team 5) persists.
 */

import type { PlasmidId } from "../../plasmids/types.js";
import type {
  CompressFn,
  CompressRequest,
  CompressedPlasmidSummary,
  CompressionOutput,
} from "../types.js";

import { routeBucket } from "./bucket-router.js";
import { computeBudget, resolveOverflow } from "./budget.js";
import { buildProjectProfile } from "./project-profiler.js";
import { summarizePlasmid } from "./plasmid-summarizer.js";
import { assembleSections } from "./section-assembler.js";
import { estimateTokens } from "./token-estimator.js";

/** Bumped when pipeline ordering / outputs change. */
export const COMPRESSION_VERSION = "1.0.0";

/** Model identifier used inside cache keys when the strategy does not specify one. */
const COMPRESSION_MODEL_FALLBACK = "default";

export const compress: CompressFn = async (req) => {
  throwIfAborted(req.signal);

  const modelId = resolveModelId(req);

  // ─── Layer A + B per plasmid ─────────────────────────────────────────────
  const rawSummaries: CompressedPlasmidSummary[] = [];
  const droppedFromSummarizer: PlasmidId[] = [];

  for (const ir of req.irs) {
    throwIfAborted(req.signal);
    const bucket = routeBucket(ir);
    try {
      const { summary, downgraded } = await summarizePlasmid({
        ir,
        bucket,
        strategy: req.strategies.compression,
        modelId,
        workingDirectory: req.workingDirectory,
        llm: req.llm,
        signal: req.signal,
      });
      rawSummaries.push(summary);
      // `downgraded` is an observability signal handled by caller via metrics;
      // for the public contract we only surface drops via budget overflow.
      void downgraded;
    } catch (err) {
      // Abort errors propagate; anything else downgrades to a drop so the
      // pipeline keeps producing a usable artefact.
      if (isAbortError(err)) throw err;
      droppedFromSummarizer.push(ir.plasmidId);
    }
  }

  // ─── Budget + overflow governor ──────────────────────────────────────────
  // Budget applies to Layer B (plasmid sections) — Layer D is reported alongside
  // but allocated from its own reserve. Mirrors P-1.13 §7.3 where
  // `plasmidSectionsBudget` (1500) is separate from `compressedProjectBudget`.
  const layerBBudget = computeBudget(req.irs.length);
  const overflow = resolveOverflow(rawSummaries, layerBBudget);

  // ─── Layer C — assemble buckets ──────────────────────────────────────────
  const sections = assembleSections(overflow.kept);

  // ─── Layer D — project profile ───────────────────────────────────────────
  const profile = await buildProjectProfile({
    workingDirectory: req.workingDirectory,
    mode: req.strategies.projectProfile,
    modelId,
    llm: req.llm,
    signal: req.signal,
  });

  const allDropped: readonly PlasmidId[] = [
    ...droppedFromSummarizer,
    ...overflow.droppedPlasmidIds,
  ];

  const totalTokenEstimate =
    sumTokens(sections.map((s) => s.tokenEstimate)) +
    profile.tokenEstimate;

  const output: CompressionOutput = {
    summaries: overflow.kept,
    sections,
    projectProfileMarkdown: profile.markdown,
    totalTokenEstimate,
    budgetTokens: layerBBudget,
    droppedPlasmidIds: allDropped,
  };

  // Light sanity check — if for any reason no sections + no profile output,
  // still return a valid structure (consumers expect stable shape).
  void estimateTokens; // satisfy lint re-export usage checks
  return output;
};

// ─── Internal helpers ──────────────────────────────────────────────────────

function resolveModelId(req: CompressRequest): string {
  const raw = (req as { readonly modelId?: string }).modelId;
  if (typeof raw === "string" && raw.length > 0) return raw;
  return COMPRESSION_MODEL_FALLBACK;
}

function sumTokens(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("compression aborted");
  }
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    if (err.message === "compression aborted") return true;
    if (err.message === "project profiler aborted") return true;
  }
  return false;
}

// Re-exports so Team 5 / tests can import bits without reaching into subfiles.
export { routeBucket } from "./bucket-router.js";
export { computeBudget, resolveOverflow } from "./budget.js";
export { buildProjectProfile } from "./project-profiler.js";
export { summarizePlasmid, SUMMARIZER_VERSION } from "./plasmid-summarizer.js";
export {
  assembleSections,
  projectProfileRelativePath,
  projectProfileHeading,
} from "./section-assembler.js";
export { estimateTokens } from "./token-estimator.js";
export { extractFrontmatter } from "./frontmatter-extractor.js";
export { cacheKey, cachePath, readCache, writeCache } from "./cache.js";
